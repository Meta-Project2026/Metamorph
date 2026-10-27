// Trusted pair registry. No diagnostic, input, path or exception is public.
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { PrivateEvidence } from "@metamorph/oracle";
import { atomicJson } from "../../differential/src/private-run.mjs";
import { requireCheck } from "../../differential/src/strict.mjs";
import { DECLARED } from "./corpus.mjs";

const IDS = new Set([
  "audit-public-positive",
  "audit-public-negative",
  ...DECLARED.map((x) => x.id),
]);
const PHASES = new Set([
  "creation",
  "provision",
  "clock",
  "reference",
  "oracle",
  "retention",
  "coverage",
  "cleanup",
  "catalog",
  "sealing",
  "complete",
]);
const TYPES = ["php", "bridge", "oracle"];
const error = (code) => Object.assign(new Error(code), { code });
const rawError = (e) => ({
  code: typeof e?.code === "string" ? e.code : null,
  diagnostic: String(e?.stack ?? e),
});
export async function bounded(operation, milliseconds, code, parentSignal) {
  const controller = new AbortController();
  let timer, listener;
  const fail = new Promise((_, reject) => {
    const stop = () => {
      controller.abort();
      reject(error(parentSignal?.aborted ? "CANCELLED" : code));
    };
    timer = setTimeout(stop, milliseconds);
    if (parentSignal) {
      listener = stop;
      parentSignal.addEventListener("abort", listener, { once: true });
      if (parentSignal.aborted) stop();
    }
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return operation(controller.signal);
      }),
      fail,
    ]);
  } finally {
    clearTimeout(timer);
    if (listener) parentSignal.removeEventListener("abort", listener);
    controller.abort();
  }
}

// Bounded, strict partial catalog; it does not certify a complete Oracle result.
export function catalogRaw(root, pack, complete) {
  const files = [];
  let bytes = 0,
    directories = 0;
  const directory = (path) => {
    const s = lstatSync(path);
    requireCheck(
      s.isDirectory() &&
        !s.isSymbolicLink() &&
        s.uid === process.getuid() &&
        (s.mode & 0o077) === 0,
      "CATALOG_ADMISSION",
    );
  };
  const walk = (path, depth = 0) => {
    requireCheck(++directories <= 300 && depth <= 8, "CATALOG_LIMIT");
    directory(path);
    for (const name of readdirSync(path).sort()) {
      const pathName = join(path, name),
        s = lstatSync(pathName);
      if (s.isDirectory() && !s.isSymbolicLink()) {
        walk(pathName, depth + 1);
        continue;
      }
      requireCheck(
        files.length < 256 &&
          s.isFile() &&
          !s.isSymbolicLink() &&
          s.nlink === 1 &&
          s.uid === process.getuid() &&
          (s.mode & 0o077) === 0 &&
          s.size <= 12 * 1024 * 1024,
        "CATALOG_ADMISSION",
      );
      const fd = openSync(pathName, constants.O_RDONLY | constants.O_NOFOLLOW);
      let data;
      try {
        const before = fstatSync(fd);
        requireCheck(
          before.ino === s.ino && before.dev === s.dev,
          "CATALOG_CHANGED",
        );
        data = readFileSync(fd);
        const after = fstatSync(fd);
        requireCheck(
          before.size === data.length &&
            after.size === before.size &&
            after.mtimeMs === before.mtimeMs,
          "CATALOG_CHANGED",
        );
      } finally {
        closeSync(fd);
      }
      bytes += data.length;
      requireCheck(bytes <= 64 * 1024 * 1024, "CATALOG_LIMIT");
      const id = `partial-file-${files.length + 1}`,
        nameRelative = relative(root, pathName);
      pack.write(id, {
        relativePath: nameRelative,
        base64: data.toString("base64"),
      });
      files.push({ id, relativePath: nameRelative });
    }
  };
  walk(root);
  pack.write("partial-catalog", {
    status: complete ? "COMPLETE" : "INCOMPLETE",
    files,
    bytes,
  });
  return { files: files.length, status: complete ? "COMPLETE" : "INCOMPLETE" };
}

class Pack {
  constructor(raw) {
    this.raw = raw;
    this.accepting = true;
    this.sealed = false;
    this.hash = null;
    this.entries = 0;
    this.failure = null;
  }
  get path() {
    return this.raw.path;
  }
  write(id, value) {
    requireCheck(this.accepting && !this.sealed, "LATE_RECEIPT");
    this.raw.write(id, value);
  }
  finalize(metadata, verify) {
    this.accepting = false;
    try {
      this.raw.write("pair-finalization", metadata);
      this.hash = this.raw.seal();
      this.sealed = true;
      requireCheck(/^[a-f0-9]{64}$/.test(this.hash), "EVIDENCE_SEAL_ERROR");
      this.entries = verify(this.raw.path, this.hash);
      requireCheck(
        Number.isSafeInteger(this.entries) && this.entries > 0,
        "EVIDENCE_VERIFY_ERROR",
      );
      return { status: "VERIFIED", sha256: this.hash, entries: this.entries };
    } catch (e) {
      this.failure = rawError(e);
      return { status: "ERROR", sha256: null, entries: 0 };
    }
  }
}

export class PairRegistry {
  constructor({
    parent,
    root,
    identity,
    inventory,
    reap,
    record,
    packFactory = (p, r, v) => new PrivateEvidence(p, r, v),
    verify = PrivateEvidence.verify,
    catalog = catalogRaw,
    cleanupMs = 25000,
    persist,
  }) {
    this.parent = parent;
    this.root = root;
    this.identity = identity;
    this.inventory = inventory;
    this.reap = reap;
    this.record = record;
    this.packFactory = packFactory;
    this.verify = verify;
    this.catalog = catalog;
    this.cleanupMs = cleanupMs;
    this.pairs = [];
    this.persist =
      persist ??
      ((value) => atomicJson(join(parent, "pair-registry.json"), value));
  }
  save() {
    this.persist({
      identity: this.identity,
      pairs: this.pairs.map((p) => p.privateState()),
    });
  }
  open(id) {
    requireCheck(
      IDS.has(id) && !this.pairs.some((p) => p.id === id),
      "PAIR_IDENTITY",
    );
    const p = new Pair(this, id);
    this.pairs.push(p);
    this.save();
    return p;
  }
  async finishAll() {
    for (const p of this.pairs) await p.finish();
  }
  publicState() {
    return this.pairs.map((p) => p.publicState());
  }
  get complete() {
    return this.pairs.every(
      (p) => p.done && p.status === "FINALIZED_PRIVATE_COMPLETE",
    );
  }
}
class Pair {
  constructor(registry, id) {
    this.registry = registry;
    this.id = id;
    this.phase = "creation";
    this.primary = null;
    this.secondary = [];
    this.packs = new Map();
    this.closers = new Map();
    this.status = "ACTIVE";
    this.cleanup = "NOT_RUN";
    this.catalogStatus = "INCOMPLETE";
    this.done = false;
    this.serial = 0;
    this.frozen = false;
    this.workComplete = false;
    this.pending = null;
  }
  privateState() {
    return {
      id: this.id,
      identity: this.registry.identity,
      phase: this.phase,
      status: this.status,
      primary: this.primary,
      secondary: this.secondary,
      cleanup: this.cleanup,
      catalog: this.catalogStatus,
      packs: [...this.packs].map(([type, p]) => ({
        type,
        path: p?.path ?? null,
        status: p?.result?.status ?? "UNSEALED",
        sha256: p?.result?.sha256 ?? null,
        failure: p?.failure ?? null,
      })),
    };
  }
  fail(code, e) {
    if (!this.primary)
      this.primary = { code, phase: this.phase, detail: rawError(e) };
    else this.secondary.push({ code, phase: this.phase, detail: rawError(e) });
  }
  async step(phase, fn, signal, milliseconds = 180000) {
    requireCheck(
      PHASES.has(phase) && !this.frozen && !this.pending,
      "PAIR_STATE",
    );
    this.phase = phase;
    this.registry.save();
    const code = `${phase.toUpperCase()}_ERROR`;
    const pending = bounded(fn, milliseconds, "TIMEOUT", signal);
    this.pending = pending;
    try {
      return await pending;
    } catch (e) {
      this.fail(
        e?.code === "TIMEOUT" || e?.code === "CANCELLED" ? e.code : code,
        e,
      );
      throw e;
    } finally {
      this.pending = null;
    }
  }
  create() {
    const directory = join(this.registry.parent, this.id);
    mkdirSync(directory, { mode: 0o700 });
    this.directory = directory;
    for (const type of TYPES) {
      this.packs.set(type, null);
      this.registry.save();
      try {
        const pack = new Pack(
          this.registry.packFactory(directory, this.registry.root, {
            identity: this.registry.identity,
            scenarioId: this.id,
            type,
          }),
        );
        this.packs.set(type, pack);
        this.registry.save();
      } catch (e) {
        this.fail("EVIDENCE_CREATE_ERROR", e);
        throw e;
      }
    }
    this.oracleParent = join(directory, "oracle-raw");
    mkdirSync(this.oracleParent, { mode: 0o700 });
    this.registry.save();
  }
  pack(type) {
    const p = this.packs.get(type);
    requireCheck(p, "PAIR_PACK");
    return p;
  }
  receipt(kind, value) {
    requireCheck(!this.frozen, "LATE_RECEIPT");
    this.pack("bridge").write(`pair-${++this.serial}-${kind}`, value);
  }
  closeWith(key, fn) {
    requireCheck(!this.frozen, "PAIR_STATE");
    this.closers.set(key, fn);
  }
  finish() {
    this.finalizing ??= this.finalize();
    return this.finalizing;
  }
  async finalize() {
    this.phase = "cleanup";
    try {
      const closed = await Promise.allSettled(
        [...this.closers.values()].map((fn) =>
          bounded(fn, this.registry.cleanupMs, "CLEANUP_TIMEOUT"),
        ),
      );
      for (const c of closed)
        if (c.status === "rejected") this.fail("CLEANUP_ERROR", c.reason);
      const x = await bounded(
        () => this.registry.reap(),
        this.registry.cleanupMs,
        "CLEANUP_TIMEOUT",
      );
      requireCheck(
        x?.before &&
          x?.after &&
          x.before.containers.length === 0 &&
          x.before.volumes.length === 0 &&
          x.after.containers.length === 0 &&
          x.after.volumes.length === 0,
        "CLEANUP_ERROR",
      );
      this.cleanup = closed.every((c) => c.status === "fulfilled")
        ? "VERIFIED_ZERO_RESOURCES"
        : "ERROR";
    } catch (e) {
      this.fail("CLEANUP_ERROR", e);
      this.cleanup = "ERROR";
    }
    try {
      if (this.captureExecution)
        this.receipt("partial-execution-status", this.captureExecution());
    } catch (e) {
      this.fail("EVIDENCE_STATUS_ERROR", e);
    }
    // Revoke every async writer BEFORE catalog/seal, including Docker receipts.
    // A timed-out late operation cannot alter an index after it is verified.
    this.frozen = true;
    for (const p of this.packs.values()) if (p) p.accepting = false;
    const complete =
      !!this.workComplete &&
      !this.primary &&
      !this.secondary.length &&
      this.cleanup === "VERIFIED_ZERO_RESOURCES";
    this.phase = "catalog";
    try {
      if (this.oracleParent && this.packs.get("oracle")) {
        const p = this.pack("oracle");
        const x = this.registry.catalog(
          this.oracleParent,
          { write: (id, v) => p.raw.write(id, v) },
          complete,
        );
        this.catalogStatus = x.status;
      } else throw error("CATALOG_INCOMPLETE");
    } catch (e) {
      this.fail("EVIDENCE_CATALOG_ERROR", e);
      this.catalogStatus = "ERROR";
    }
    this.phase = "sealing";
    for (const type of TYPES) {
      const p = this.packs.get(type);
      if (!p) {
        this.fail("EVIDENCE_SEAL_ERROR", error("PACK_UNAVAILABLE"));
        continue;
      }
      p.result = p.finalize(
        {
          identity: this.registry.identity,
          scenarioId: this.id,
          executionStatus:
            complete && !this.primary && !this.secondary.length
              ? "COMPLETE"
              : "ERROR",
          catalog: this.catalogStatus,
          cleanup: this.cleanup,
          primary: this.primary,
          secondary: this.secondary,
        },
        this.registry.verify,
      );
      if (p.result.status !== "VERIFIED")
        this.fail("EVIDENCE_SEAL_ERROR", error("PACK_INDEX_UNVERIFIED"));
    }
    this.status =
      complete &&
      !this.primary &&
      !this.secondary.length &&
      this.catalogStatus === "COMPLETE"
        ? "FINALIZED_PRIVATE_COMPLETE"
        : "FINALIZED_PRIVATE_ERROR";
    this.phase = "complete";
    this.done = true;
    try {
      this.registry.save();
      this.registry.record("pair-finalized", this.privateState());
    } catch (e) {
      this.fail("EVIDENCE_REGISTRY_ERROR", e);
      this.status = "FINALIZED_PRIVATE_ERROR";
    }
    return this;
  }
  publicState() {
    return {
      id: this.id,
      status: this.done ? this.status : "FINALIZED_PRIVATE_ERROR",
      primaryCode: this.primary?.code ?? null,
      secondaryCodes: [...new Set(this.secondary.map((e) => e.code))],
      cleanup: this.cleanup,
      catalog: this.catalogStatus,
      packs: TYPES.map((type) => {
        const r = this.packs.get(type)?.result;
        return {
          type,
          status: r?.status ?? "ERROR",
          sha256: r?.status === "VERIFIED" ? r.sha256 : null,
          entries: r?.status === "VERIFIED" ? r.entries : 0,
        };
      }),
    };
  }
}
