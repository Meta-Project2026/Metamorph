// Bounded private evidence, with no umask-dependent or candidate-selected paths.
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { strictJson } from "../../../differential/src/strict.mjs";
import { sha256 } from "../../../target-worker/src/admission.mjs";
import { check, fields } from "./policy.mjs";

export function privatePath(path, directory = false) {
  const s = lstatSync(path);
  check(
    !s.isSymbolicLink() &&
      realpathSync(path) === resolve(path) &&
      (directory ? s.isDirectory() : s.isFile() && s.nlink === 1) &&
      (process.platform === "win32" ||
        (s.uid === process.getuid() && (s.mode & 0o077) === 0)),
    "G0_EVIDENCE",
  );
  return s;
}
export function readPrivateJson(path) {
  const before = privatePath(path);
  check(before.size <= 1024 * 1024, "G0_EVIDENCE");
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const s = fstatSync(fd);
    check(s.ino === before.ino && s.dev === before.dev, "G0_EVIDENCE");
    try {
      return strictJson(readFileSync(fd, "utf8"), 1024 * 1024);
    } catch {
      check(false, "G0_EVIDENCE");
    }
  } finally {
    closeSync(fd);
  }
}
export class Evidence {
  constructor(root) {
    this.root = resolve(root);
    // Must be a fresh direct child of an existing owner-controlled directory.
    privatePath(resolve(this.root, ".."), true);
    mkdirSync(this.root, { mode: 0o700 });
    privatePath(this.root, true);
    this.fd = openSync(join(this.root, "trace.jsonl"), "wx", 0o600);
    this.stat = fstatSync(this.fd);
    this.bytes = 0;
    this.sequence = 0;
    this.closed = false;
  }
  record(kind, value) {
    check(!this.closed && ++this.sequence <= 512, "G0_EVIDENCE");
    privatePath(this.root, true);
    const current = privatePath(join(this.root, "trace.jsonl"));
    check(
      current.ino === this.stat.ino && current.dev === this.stat.dev,
      "G0_EVIDENCE",
    );
    const bytes = Buffer.from(
      `${JSON.stringify({ sequence: this.sequence, kind, value })}\n`,
    );
    this.bytes += bytes.length;
    check(this.bytes <= 32 * 1024 * 1024, "G0_EVIDENCE");
    let offset = 0;
    while (offset < bytes.length) offset += writeSync(this.fd, bytes, offset);
    fsyncSync(this.fd);
  }
  write(name, value) {
    check(
      (!this.closed || (name === "receipt.json" && !this.receiptWritten)) &&
        ["ledger.json", "receipt.json", "finalizer.json"].includes(name),
      "G0_EVIDENCE",
    );
    privatePath(this.root, true);
    const path = join(this.root, name),
      temporary = `${path}.next`;
    const fd = openSync(temporary, "wx", 0o600);
    try {
      const bytes = Buffer.from(`${JSON.stringify(value)}\n`);
      check(bytes.length <= 1024 * 1024, "G0_EVIDENCE");
      let offset = 0;
      while (offset < bytes.length) offset += writeSync(fd, bytes, offset);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temporary, path);
    if (name === "receipt.json") this.receiptWritten = true;
  }
  ledger(value) {
    this.write("ledger.json", value);
  }
  seal(required = []) {
    check(!this.closed, "G0_EVIDENCE");
    fsyncSync(this.fd);
    closeSync(this.fd);
    this.closed = true;
    const path = join(this.root, "trace.jsonl"),
      stat = privatePath(path);
    check(
      stat.ino === this.stat.ino &&
        stat.dev === this.stat.dev &&
        stat.size === this.bytes,
      "G0_EVIDENCE",
    );
    const names = readdirSync(this.root).sort();
    check(
      names.every((n) =>
        ["trace.jsonl", "ledger.json", "finalizer.json"].includes(n),
      ) && required.every((n) => names.includes(n)),
      "G0_EVIDENCE",
    );
    const files = names.map((name) => {
      const path = join(this.root, name),
        s = privatePath(path);
      check(s.size <= 32 * 1024 * 1024, "G0_EVIDENCE");
      return { path: name, bytes: s.size, sha256: sha256(readFileSync(path)) };
    });
    return {
      path: "trace.jsonl",
      bytes: this.bytes,
      sha256: sha256(readFileSync(path)),
      events: this.sequence,
      files,
    };
  }
}
export function verifyEvidence(root, proof) {
  privatePath(root, true);
  check(
    proof &&
      Array.isArray(proof.files) &&
      proof.files.length > 0 &&
      proof.files.length <= 3 &&
      new Set(proof.files.map((f) => f.path)).size === proof.files.length &&
      proof.files.some(
        (f) =>
          f.path === "trace.jsonl" &&
          f.sha256 === proof.sha256 &&
          f.bytes === proof.bytes,
      ),
    "G0_EVIDENCE",
  );
  check(
    readdirSync(root)
      .filter((n) => n !== "receipt.json")
      .sort()
      .join() ===
      proof.files
        .map((f) => f.path)
        .sort()
        .join(),
    "G0_EVIDENCE",
  );
  for (const f of proof.files) {
    check(
      ["trace.jsonl", "ledger.json", "finalizer.json"].includes(f.path),
      "G0_EVIDENCE",
    );
    const path = join(root, f.path),
      s = privatePath(path);
    check(
      s.size === f.bytes &&
        s.size <= 32 * 1024 * 1024 &&
        sha256(readFileSync(path)) === f.sha256,
      "G0_EVIDENCE",
    );
  }
}
export function validateLedger(value) {
  fields(value, ["version", "runId", "owner", "resources"], "G0_OWNERSHIP");
  check(
    value.version === 1 &&
      /^g0-[a-f0-9-]{36}$/.test(value.runId) &&
      /^[a-f0-9-]{36}$/.test(value.owner) &&
      Array.isArray(value.resources) &&
      value.resources.length <= 8,
    "G0_OWNERSHIP",
  );
  const names = new Set(),
    ids = new Set();
  for (const r of value.resources) {
    fields(r, ["name", "role", "script", "id", "removed"], "G0_OWNERSHIP");
    check(
      r.name.startsWith(`${value.runId}-`) &&
        /^[a-f0-9-]{36}$/.test(r.name.slice(value.runId.length + 1)) &&
        ["provenance", "build", "runtime"].includes(r.role) &&
        r.script ===
          `/opt/worker/${r.role === "runtime" ? "launch" : r.role}.mjs` &&
        (r.id === null || /^[a-f0-9]{64}$/.test(r.id)) &&
        typeof r.removed === "boolean" &&
        !names.has(r.name) &&
        (!r.id || !ids.has(r.id)),
      "G0_OWNERSHIP",
    );
    names.add(r.name);
    if (r.id) ids.add(r.id);
  }
  return value;
}
