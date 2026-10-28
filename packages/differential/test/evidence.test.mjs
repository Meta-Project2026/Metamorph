import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs, {
  appendFileSync,
  chmodSync,
  chownSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import fsPromises from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  MANIFEST,
  PrivateEvidence,
  snapshotSqlite,
  verifyPair,
} from "@metamorph/oracle";
import { retainOracle } from "../src/private-run.mjs";

const posix = {
  skip:
    process.platform !== "linux"
      ? "PrivateEvidence requires real Linux ownership/modes; no Windows ACL substitute"
      : false,
};
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
const save = (path, value) =>
  writeFileSync(path, JSON.stringify(value), { mode: 0o600 });

// Original synthetic adapters: independent actual SQLite databases and stateful
// observations. MANIFEST is read only as public request data; no PHP/candidate
// source is loaded, compiled or executed. This tests evidence plumbing, not parity.
function adapter(root, name, fail = "") {
  const path = join(root, `${name}.sqlite`);
  const db = new DatabaseSync(path);
  let closed = false;
  let requests = 0;
  return {
    async reset() {
      db.exec(
        "DROP TABLE IF EXISTS observations; CREATE TABLE observations (id INTEGER PRIMARY KEY AUTOINCREMENT, method TEXT, path TEXT)",
      );
    },
    async request(input) {
      requests++;
      if (fail === "request") throw new Error("synthetic-private-diagnostic");
      db.prepare("INSERT INTO observations(method,path) VALUES (?,?)").run(
        input.method,
        input.path,
      );
      return {
        status: fail === "comparison" ? 201 : 200,
        headers: { "content-type": "application/json" },
        body: Buffer.from('{"synthetic":true}'),
      };
    },
    async snapshot() {
      const state = snapshotSqlite(path);
      if (fail === "initial") state.schema[0].sql += " ";
      return state;
    },
    async close() {
      if (!closed) db.close();
      closed = true;
      if (fail === "close") throw new Error("synthetic-private-cleanup");
    },
    get closed() {
      return closed;
    },
    get requests() {
      return requests;
    },
  };
}

async function fixture(
  t,
  { scenarios = MANIFEST, fail = "", umask = 0o022 } = {},
) {
  const scratch = mkdtempSync(join(tmpdir(), "mmp026-synthetic-"));
  t.after(() => {
    const target = resolve(scratch);
    assert.equal(target, scratch);
    assert.ok(target.startsWith(join(resolve(tmpdir()), "mmp026-synthetic-")));
    rmSync(target, { recursive: true, force: true });
  });
  const parent = join(scratch, "raw");
  mkdirSync(parent, { mode: 0o700 });
  const reference = adapter(scratch, "reference");
  const candidate = adapter(scratch, "candidate", fail);
  const mask = process.umask(umask);
  let result;
  try {
    result = await verifyPair({
      reference,
      candidate,
      scenarios,
      artifactParent: parent,
      operationTimeoutMs: 1000,
    });
  } finally {
    process.umask(mask);
  }
  const pack = () =>
    new PrivateEvidence(scratch, process.cwd(), { synthetic: true });
  return {
    scratch,
    parent,
    root: result.evidenceDirectory,
    result,
    pack,
    reference,
    candidate,
  };
}

function rawFiles(root, prefix = "") {
  return readdirSync(join(root, prefix))
    .sort()
    .flatMap((name) => {
      const path = prefix + name;
      return lstatSync(join(root, path)).isDirectory()
        ? rawFiles(root, `${path}/`)
        : [path];
    });
}

function checkPack(pack, rawRoot, expectedStatus) {
  const catalog = parse(join(pack.path, "oracle-catalog.json"));
  assert.equal(catalog.status, expectedStatus);
  assert.equal(
    new Set(catalog.catalog.map((e) => e.path)).size,
    catalog.catalog.length,
  );
  assert.deepEqual(
    catalog.catalog.map((e) => e.path).sort(),
    rawFiles(rawRoot),
  );
  for (const entry of catalog.catalog) {
    const record = parse(join(pack.path, `${entry.id}.json`));
    const bytes = Buffer.from(record.base64, "base64");
    assert.equal(record.relativePath, entry.path);
    assert.equal(bytes.length, entry.bytes);
    assert.equal(sha(bytes), entry.sha256);
    assert.deepEqual(bytes, readFileSync(join(rawRoot, entry.path)));
  }
  // Callers may append final metadata before sealing; retainOracle must not seal.
  pack.write("completion", { synthetic: true });
  const digest = pack.seal();
  assert.equal(
    PrivateEvidence.verify(pack.path, digest),
    catalog.catalog.length + 3,
  );
  const index = parse(join(pack.path, "index.json"));
  assert.equal(sha(readFileSync(join(pack.path, "index.json"))), digest);
  assert.deepEqual(
    index.entries
      .map((e) => `${e.id}.json`)
      .concat("index.json")
      .sort(),
    readdirSync(pack.path).sort(),
  );
  for (const entry of index.entries) {
    const bytes = readFileSync(join(pack.path, `${entry.id}.json`));
    assert.equal(entry.bytes, bytes.length);
    assert.equal(entry.sha256, sha(bytes));
  }
  return { catalog, digest };
}

function rejectRetention(f, expected, pack = f.pack()) {
  assert.throws(() => retainOracle(f.result, f.parent, pack), expected);
  assert.equal(existsSync(join(pack.path, "oracle-catalog.json")), false);
  assert.equal(
    parse(join(pack.path, "oracle-retention-error.json")).status,
    "INCOMPLETE",
  );
  return pack;
}

test(
  "writer creates all private directories 0700 and files 0600 under umask 022",
  posix,
  async (t) => {
    const f = await fixture(t);
    for (const name of ["", "http", "db", "diffs"])
      assert.equal(lstatSync(join(f.root, name)).mode & 0o777, 0o700);
    for (const name of rawFiles(f.root))
      assert.equal(lstatSync(join(f.root, name)).mode & 0o777, 0o600);
  },
);

test(
  "full MANIFEST 3 scenarios / 17 requests retains 117/117 exact files under umask 022",
  posix,
  async (t) => {
    const f = await fixture(t);
    assert.equal(MANIFEST.length, 3);
    assert.equal(
      MANIFEST.reduce((n, s) => n + s.requests.length, 0),
      17,
    );
    assert.equal(rawFiles(f.root).length, 117);
    assert.equal(f.result.gateResults[0].executedTestIds.length, 17);
    assert.equal(f.result.gateResults[1].executedTestIds.length, 20);
    assert.equal(f.reference.requests, 17);
    assert.equal(f.candidate.requests, 17);
    assert.ok(f.reference.closed && f.candidate.closed);
    const pack = f.pack();
    const retained = retainOracle(f.result, f.parent, pack);
    assert.deepEqual(retained.gates, f.result.gateResults);
    const { catalog } = checkPack(pack, f.root, "COMPLETE");
    assert.equal(catalog.catalog.length, 117);
    assert.equal(catalog.fileBudget, 117);
  },
);

test(
  "single scenario and guarded write/path wrapper retain compatible return shape",
  posix,
  async (t) => {
    const f = await fixture(t, { scenarios: [MANIFEST[0]] });
    const raw = f.pack();
    const wrapper = {
      path: raw.path,
      write: (id, value) => raw.write(id, value),
    };
    assert.deepEqual(
      Object.keys(retainOracle(f.result, f.parent, wrapper)).sort(),
      ["gates", "initialDiffs", "manifest"],
    );
    checkPack(raw, f.root, "COMPLETE");
  },
);

test(
  "complete failed comparison retains all evidence without changing FAIL",
  posix,
  async (t) => {
    const f = await fixture(t, { fail: "comparison" });
    const pack = f.pack();
    const retained = retainOracle(f.result, f.parent, pack);
    assert.equal(retained.gates[0].verdict, "FAIL");
    assert.equal(retained.gates[1].verdict, "FAIL");
    assert.equal(
      checkPack(pack, f.root, "COMPLETE").catalog.catalog.length,
      117,
    );
  },
);

for (const fail of ["request", "initial", "close"]) {
  test(
    `partial/error publication preserves real writer evidence and cleanup: ${fail}`,
    posix,
    async (t) => {
      const f = await fixture(t, { fail });
      const pack = f.pack();
      const retained = retainOracle(f.result, f.parent, pack);
      assert.ok(f.reference.closed && f.candidate.closed);
      assert.ok(
        retained.gates.some((g) => ["ERROR", "FAIL"].includes(g.verdict)),
      );
      checkPack(pack, f.root, "INCOMPLETE");
      if (fail === "request")
        assert.ok(rawFiles(f.root).includes("http/0-0-reference.json"));
    },
  );
}

for (const missingDiff of ["0-initial.json", "0-0-http.json", "0-0-db.json"]) {
  test(
    `failed diff write preserves indexed observations: ${missingDiff}`,
    posix,
    async (t) => {
      const original = fsPromises.writeFile;
      let failed = false;
      t.mock.method(fsPromises, "writeFile", async (path, ...args) => {
        if (!failed && String(path).endsWith(`/diffs/${missingDiff}`)) {
          failed = true;
          throw new Error("synthetic disk failure");
        }
        return original(path, ...args);
      });
      syncBuiltinESMExports();
      let f;
      try {
        f = await fixture(t);
      } finally {
        t.mock.restoreAll();
        syncBuiltinESMExports();
      }
      assert.ok(failed);
      assert.ok(f.reference.closed && f.candidate.closed);
      assert.equal(f.result.gateResults[1].verdict, "ERROR");
      assert.equal(existsSync(join(f.root, "diffs", missingDiff)), false);
      const pack = f.pack();
      assert.deepEqual(
        retainOracle(f.result, f.parent, pack).gates,
        f.result.gateResults,
      );
      checkPack(pack, f.root, "INCOMPLETE");
    },
  );
}

const mutations = {
  "file permission bits": (f) =>
    chmodSync(join(f.root, "manifest.json"), 0o644),
  "directory permission bits": (f) => chmodSync(join(f.root, "db"), 0o755),
  symlink: (f) => {
    rmSync(join(f.root, "manifest.json"));
    symlinkSync(join(f.root, "controls.json"), join(f.root, "manifest.json"));
  },
  hardlink: (f) =>
    linkSync(join(f.root, "manifest.json"), join(f.scratch, "linked")),
  "extra file": (f) => save(join(f.root, "extra.json"), {}),
  "nested directory": (f) =>
    mkdirSync(join(f.root, "db", "nested"), { mode: 0o700 }),
  "unsafe name": (f) => save(join(f.root, "db", "0-00.json"), {}),
  "missing initial DB": (f) =>
    rmSync(join(f.root, "db/0-initial-reference.json")),
  "missing run-level file": (f) => rmSync(join(f.root, "events.jsonl")),
  "oversize raw file": (f) =>
    truncateSync(join(f.root, "report.html"), 12 * 1024 * 1024 + 1),
  "manifest count mismatch": (f) => {
    const x = parse(join(f.root, "manifest.json"));
    x.expectedSteps--;
    save(join(f.root, "manifest.json"), x);
  },
  "manifest overflow": (f) => {
    const x = parse(join(f.root, "manifest.json"));
    x.expectedSteps = Number.MAX_SAFE_INTEGER;
    save(join(f.root, "manifest.json"), x);
  },
  "duplicate scenario": (f) => {
    const x = parse(join(f.root, "manifest.json"));
    x.scenarioIds[1] = x.scenarioIds[0];
    save(join(f.root, "manifest.json"), x);
  },
  "duplicate metadata key": (f) =>
    writeFileSync(
      join(f.root, "manifest.json"),
      '{"scenarioIds":[],"scenarioIds":[]}',
    ),
  "publication mismatch": (f) => save(join(f.root, "gate-results.json"), []),
  "duplicate evidence path": (f) => {
    f.result.gateResults[0].evidencePaths.push(
      f.result.gateResults[0].evidencePaths[0],
    );
    save(join(f.root, "gate-results.json"), f.result.gateResults);
  },
  "missing initial DB even if references removed": (f) => {
    const path = "db/0-initial-reference.json";
    rmSync(join(f.root, path));
    f.result.gateResults[1].evidencePaths =
      f.result.gateResults[1].evidencePaths.filter((p) => p !== path);
    save(join(f.root, "gate-results.json"), f.result.gateResults);
  },
};
for (const [name, mutate] of Object.entries(mutations)) {
  test(
    `retention rejects ${name} before publishing any copied files`,
    posix,
    async (t) => {
      const f = await fixture(t);
      mutate(f);
      const pack = rejectRetention(f, /PRIVATE_|ORACLE_|WIRE_/);
      assert.deepEqual(readdirSync(pack.path).sort(), [
        "oracle-retention-error.json",
        "provenance.json",
      ]);
      pack.write("failure", { safe: true });
      assert.equal(PrivateEvidence.verify(pack.path, pack.seal()), 3);
    },
  );
}

test(
  "foreign ownership is rejected using real Linux chown",
  posix,
  async (t) => {
    const f = await fixture(t);
    const path = join(f.root, "manifest.json");
    if (process.getuid() === 0) chownSync(path, 65534, 65534);
    else if (spawnSync("sudo", ["-n", "true"]).status === 0)
      execFileSync("sudo", ["-n", "chown", "65534:65534", path]);
    else {
      t.skip(
        "Neither root nor passwordless sudo available for real foreign ownership; forged UID admission is tested separately",
      );
      return;
    }
    rejectRetention(f, /PRIVATE_FILE/);
  },
);

test(
  "foreign uid metadata is rejected on the same open/read admission path",
  posix,
  async (t) => {
    const f = await fixture(t);
    const original = fs.lstatSync;
    t.mock.method(fs, "lstatSync", (path, options) => {
      const stat = original(path, options);
      if (path === join(f.root, "manifest.json") && options?.bigint)
        stat.uid += 1n;
      return stat;
    });
    syncBuiltinESMExports();
    try {
      rejectRetention(f, /PRIVATE_FILE/);
    } finally {
      t.mock.restoreAll();
      syncBuiltinESMExports();
    }
  },
);

test(
  "raw 12 MiB cannot overflow the 16 MiB base64 JSON record",
  posix,
  async (t) => {
    const f = await fixture(t);
    truncateSync(join(f.root, "report.html"), 12 * 1024 * 1024);
    const pack = rejectRetention(f, /PRIVATE_RECORD_LIMIT/);
    assert.equal(readdirSync(pack.path).length, 2);
  },
);

test(
  "64 MiB aggregate raw budget rejects before any copied entry",
  posix,
  async (t) => {
    const f = await fixture(t);
    for (const path of rawFiles(f.root)
      .filter((p) => p.startsWith("http/"))
      .slice(0, 7))
      truncateSync(join(f.root, path), 10 * 1024 * 1024);
    rejectRetention(f, /PRIVATE_LIMIT/);
  },
);

test(
  "pack preflight includes existing occupancy and prospective index overhead",
  posix,
  async (t) => {
    const f = await fixture(t);
    const pack = f.pack();
    // All individual writes fit. The nearly full pack cannot fit raw records,
    // catalog and eventual index; failure must precede oracle-file-1.
    for (let n = 0; n < 8; n++)
      pack.write(`occupied-${n}`, "x".repeat(16 * 1024 * 1024 - 1024));
    rejectRetention(f, /PRIVATE_PACK_LIMIT/, pack);
    assert.equal(existsSync(join(pack.path, "oracle-file-1.json")), false);
  },
);

test(
  "source growth during a read is bounded and rejected",
  posix,
  async (t) => {
    const f = await fixture(t);
    const original = fs.readSync;
    let changed = false;
    t.mock.method(fs, "readSync", (...args) => {
      if (!changed) {
        changed = true;
        appendFileSync(join(f.root, "controls.json"), "x");
      }
      return original(...args);
    });
    syncBuiltinESMExports();
    try {
      rejectRetention(f, /PRIVATE_CHANGED/);
    } finally {
      t.mock.restoreAll();
      syncBuiltinESMExports();
    }
  },
);

test(
  "source changes during copy cannot publish a complete catalog",
  posix,
  async (t) => {
    const f = await fixture(t);
    const raw = f.pack();
    const pack = {
      path: raw.path,
      write(id, value) {
        raw.write(id, value);
        if (id === "oracle-file-1")
          appendFileSync(join(f.root, "report.html"), "changed");
      },
    };
    rejectRetention(f, /PRIVATE_CHANGED/, pack);
    assert.equal(PrivateEvidence.verify(raw.path, raw.seal()), 119);
  },
);

test(
  "interrupted destination write retains partial/error receipt without catalog",
  posix,
  async (t) => {
    const f = await fixture(t);
    const raw = f.pack();
    const pack = {
      path: raw.path,
      write(id, value) {
        if (id === "oracle-file-3")
          throw new Error("private synthetic disk error");
        raw.write(id, value);
      },
    };
    rejectRetention(f, /^BridgeError: PRIVATE_RETENTION_ERROR$/, pack);
    assert.equal(
      parse(join(raw.path, "oracle-retention-error.json")).copiedFiles,
      2,
    );
    assert.equal(PrivateEvidence.verify(raw.path, raw.seal()), 4);
  },
);

test(
  "corrupted retained bytes fail readback before catalog publication",
  posix,
  async (t) => {
    const f = await fixture(t);
    const raw = f.pack();
    const pack = {
      path: raw.path,
      write(id, value) {
        raw.write(id, value);
        if (id === "oracle-file-1")
          appendFileSync(join(raw.path, `${id}.json`), "x");
      },
    };
    rejectRetention(f, /PRIVATE_COPY_CHANGED/, pack);
    assert.throws(
      () => PrivateEvidence.verify(raw.path, raw.seal()),
      /EVIDENCE_TAMPERED/,
    );
  },
);

for (const fault of ["throw-after-catalog", "mutate-after-catalog"]) {
  test(
    `catalog publication failure cannot leave a verified COMPLETE result: ${fault}`,
    posix,
    async (t) => {
      const f = await fixture(t);
      const raw = f.pack();
      const pack = {
        path: raw.path,
        write(id, value) {
          raw.write(id, value);
          if (id === "oracle-catalog") {
            if (fault === "throw-after-catalog")
              throw new Error("synthetic post-rename failure");
            appendFileSync(join(raw.path, "oracle-file-1.json"), "changed");
          }
        },
      };
      rejectRetention(f, /PRIVATE_RETENTION_ERROR|PRIVATE_COPY_CHANGED/, pack);
      assert.throws(() => PrivateEvidence.verify(raw.path, raw.seal()));
    },
  );
}

for (const mutation of [
  "bytes",
  "index",
  "extra",
  "missing",
  "duplicate",
  "wrong-size",
  "wrong-hash",
]) {
  test(`sealed exact index rejects ${mutation}`, posix, async (t) => {
    const f = await fixture(t, { scenarios: [MANIFEST[0]] });
    const pack = f.pack();
    retainOracle(f.result, f.parent, pack);
    let digest = pack.seal();
    const indexPath = join(pack.path, "index.json");
    if (mutation === "bytes")
      appendFileSync(join(pack.path, "oracle-file-1.json"), "x");
    if (mutation === "index") appendFileSync(indexPath, "x");
    if (mutation === "extra") save(join(pack.path, "unindexed.json"), {});
    if (mutation === "missing") rmSync(join(pack.path, "oracle-file-1.json"));
    if (["duplicate", "wrong-size", "wrong-hash"].includes(mutation)) {
      const index = parse(indexPath);
      if (mutation === "duplicate") index.entries.push(index.entries[0]);
      if (mutation === "wrong-size") index.entries[0].bytes++;
      if (mutation === "wrong-hash") index.entries[0].sha256 = "0".repeat(64);
      save(indexPath, index);
      digest = sha(readFileSync(indexPath));
    }
    assert.throws(() => PrivateEvidence.verify(pack.path, digest));
  });
}
