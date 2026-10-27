import assert from "node:assert/strict";
import {
  chmodSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { compareSqlite, snapshotSqlite, verifyPair } from "../dist/index.js";
import {
  DockerReferenceTransport,
  decodeHttp,
  decodeInspection,
  isolation,
  validateRuntime,
} from "../dist/reference/docker.js";
import { PrivateEvidence } from "../dist/reference/evidence.js";
import {
  MANIFEST,
  SOURCE,
  sha256,
  stepId,
} from "../dist/reference/manifest.js";
import { mapPhpSnapshot } from "../dist/reference/mapping.js";
import { boundedCommand } from "../dist/reference/process.js";
import { publicSummary } from "../dist/reference/public.js";
import { PhpReferenceWorker } from "../dist/reference/worker.js";

const signal = () => AbortSignal.timeout(10000);
const scratch = mkdtempSync(join(tmpdir(), "mmp-reference-test-"));
const memory = () => ({
  entries: [],
  write(id, value) {
    this.entries.push({ id, value });
  },
});
const fixturePath = join(scratch, "fixture.sqlite");
const db = new DatabaseSync(fixturePath);
db.exec(readFileSync(new URL("fixture.sql", import.meta.url), "utf8"));
const expected = snapshotSqlite(fixturePath);
// Original trusted fixture only. Real PHP inspector equivalence is a separate Docker proof.
const legacy = {
  format: "php74-logical-v1",
  schema: expected.schema.map((s) => ({
    type: s.type,
    name: s.name,
    tbl_name: s.table,
    sql: s.sql,
  })),
  tables: expected.tables.map((t) => ({
    name: t.name,
    columns: db.prepare(`PRAGMA table_xinfo("${t.name}")`).all(),
    rows: t.rows.map((r) =>
      r.map((c) => ({
        type: c.type,
        value:
          c.type === "null"
            ? null
            : c.type === "blob"
              ? c.value.toUpperCase()
              : c.value,
      })),
    ),
  })),
};
db.close();
const clone = (v) => structuredClone(v);
const empty = { format: "sqlite-logical-v1", schema: [], tables: [] };
const inspect = () => ({
  snapshot: clone(empty),
  legacySha256: SOURCE.initialSha256,
  raw: {},
});
const http = () => ({
  observation: {
    status: 200,
    headers: { "content-type": "application/json" },
    body: Buffer.from('{"ok":true}'),
  },
  raw: { bodyBase64: "eyJvayI6dHJ1ZX0=" },
});
function fake(overrides = {}) {
  return {
    closed: 0,
    reset: async () => {},
    inspect: async () => inspect(),
    http: async () => http(),
    async close() {
      this.closed++;
    },
    ...overrides,
  };
}
const create = (transport = fake(), schedule = [MANIFEST[0].id]) =>
  new PhpReferenceWorker(transport, memory(), schedule);

test.after(() => rmSync(scratch, { recursive: true, force: true }));
test("legacy mapping equals core snapshot including defaults, DDL, bigint, blobs, null, sequence, composite PK and multisets", () => {
  assert.deepEqual(mapPhpSnapshot(legacy), expected);
  const mutated = clone(legacy);
  mutated.tables[0].rows.reverse();
  mutated.schema.reverse();
  assert.deepEqual(mapPhpSnapshot(mutated), expected);
});
test("legacy PRAGMA decimal metadata strings map without changing business value types", () => {
  const wire = clone(legacy);
  for (const table of wire.tables)
    for (const c of table.columns)
      for (const key of ["cid", "notnull", "pk", "hidden"])
        c[key] = String(c[key]);
  assert.deepEqual(mapPhpSnapshot(wire), expected);
  wire.tables[0].columns[0].cid = "0x0";
  assert.throws(() => mapPhpSnapshot(wire));
});
for (const [label, mutate] of [
  [
    "missing schema",
    (x) => {
      x.schema = [];
    },
  ],
  [
    "missing sequence",
    (x) => {
      x.schema = x.schema.filter((s) => s.name !== "sqlite_sequence");
      x.tables = x.tables.filter((t) => t.name !== "sqlite_sequence");
    },
  ],
  [
    "wrong columns",
    (x) => {
      x.tables[0].columns[0].cid = 42;
    },
  ],
  [
    "unsupported hidden column",
    (x) => {
      x.tables[0].columns[0].hidden = 1;
    },
  ],
  [
    "unknown wire field",
    (x) => {
      x.tables[0].rawAnswer = "secret";
    },
  ],
  [
    "int64 overflow",
    (x) => {
      x.tables.find((t) => t.name === "typed").rows[0][1].value =
        "9223372036854775808";
    },
  ],
  [
    "wrong type",
    (x) => {
      x.tables.find((t) => t.name === "typed").rows[0][1].type = "decimal";
    },
  ],
  [
    "truncated row",
    (x) => {
      x.tables[0].rows[0].pop();
    },
  ],
  [
    "duplicate column",
    (x) => {
      x.tables[0].columns[1].name = x.tables[0].columns[0].name;
    },
  ],
  [
    "missing DDL",
    (x) => {
      x.schema.find((s) => s.type === "table").sql = null;
    },
  ],
])
  test(`mapping rejects ${label}`, () => {
    const x = clone(legacy);
    mutate(x);
    assert.throws(() => mapPhpSnapshot(x));
  });

test("schema/default and sequence changes remain observable to the existing comparator", () => {
  const changed = clone(legacy);
  changed.schema.find((s) => s.name === "typed").sql += " ";
  assert.equal(
    compareSqlite(expected, mapPhpSnapshot(changed))[0].code,
    "DB_SCHEMA",
  );
  const seq = clone(legacy);
  seq.tables.find((t) => t.name === "sqlite_sequence").rows[0][1].value = "99";
  assert.equal(
    compareSqlite(expected, mapPhpSnapshot(seq))[0].code,
    "DB_STATE",
  );
});
test("raw HTTP is bounded and binary-safe; corrupt base64/status/header types fail closed", () => {
  const value = {
    status: 200,
    headers: { "content-type": "application/octet-stream" },
    rawHeaders: ["HTTP/1.1 200 OK"],
    bodyBase64: "AP8=",
  };
  assert.deepEqual(
    decodeHttp(Buffer.from(JSON.stringify(value))).observation.body,
    Buffer.from([0, 255]),
  );
  for (const patch of [
    { bodyBase64: "bad===" },
    { status: 999 },
    { headers: { "Content-Type": 42 } },
    { rawHeaders: [42] },
    { raw: "secret" },
  ])
    assert.throws(() =>
      decodeHttp(Buffer.from(JSON.stringify({ ...value, ...patch }))),
    );
});
test("inspector envelope validates runtime and independently hashed legacy bytes", () => {
  const state = Buffer.from(JSON.stringify(legacy));
  const value = {
    stateBase64: state.toString("base64"),
    legacySha256: sha256(state),
    runtime: {
      php: "7.4.33",
      sqlite: "3.34.1",
      phpUtc: SOURCE.clock,
      sqliteUtc: SOURCE.clock,
      monotonicMs: 51,
      extensions: ["PDO", "pdo_sqlite", "mbstring"],
      clockNoticeSha256:
        "6c361c87f8a9a7999ffab9924fabaaf499b372379cd8a7c19e7eca94d43df7ef",
      clockPackageVersion: "0.9.8-9",
      clockLibrarySha256: "a".repeat(64),
    },
  };
  assert.deepEqual(
    decodeInspection(Buffer.from(JSON.stringify(value))).snapshot,
    expected,
  );
  for (const patch of [
    { legacySha256: "0".repeat(64) },
    { stateBase64: "aA==" },
    { runtime: { ...value.runtime, sqlite: "wrong" } },
    { runtime: { ...value.runtime, monotonicMs: 0 } },
  ])
    assert.throws(() =>
      decodeInspection(Buffer.from(JSON.stringify({ ...value, ...patch }))),
    );
});
test("wrong source/base/image digests are rejected before source admission", () => {
  const good = {
    sourceSha256: SOURCE.archiveSha256,
    baseImage: SOURCE.image,
    imageId: `sha256:${"a".repeat(64)}`,
    archivePath: join(scratch, "wrong.tgz"),
  };
  writeFileSync(good.archivePath, "wrong archive");
  for (const patch of [
    { sourceSha256: "wrong" },
    { baseImage: "php:latest" },
    { imageId: "latest" },
    {},
  ])
    assert.throws(() => validateRuntime({ ...good, ...patch }));
});
test("app isolation has bounded resources and no privileged/workspace/secret/inspector mounts", () => {
  const args = isolation("unit");
  for (const required of [
    "none",
    "--read-only",
    "65534:65534",
    "ALL",
    "no-new-privileges",
    "--cpus",
    "--memory",
    "--pids-limit",
    "--tmpfs",
    "--log-driver",
  ])
    assert.ok(args.includes(required));
  assert.ok(!args.join(" ").includes("--privileged"));
});
test("stepwise schedule returns full independent snapshots and captures every request", async () => {
  const evidence = memory();
  const transport = fake();
  const worker = new PhpReferenceWorker(transport, evidence, [MANIFEST[0].id]);
  await worker.reset(signal());
  assert.deepEqual(await worker.snapshot(signal()), empty);
  for (const [i, request] of MANIFEST[0].requests.entries())
    await worker.requestStep(MANIFEST[0].id, stepId(i), request, signal());
  assert.equal(
    evidence.entries.filter((e) => e.id.includes("-step-")).length,
    6,
  );
  assert.ok(
    evidence.entries.find((e) => e.id.endsWith("step-01")).value.before.tables,
  );
  await worker.close(signal());
  assert.equal(transport.closed, 1);
  await assert.rejects(worker.snapshot(signal()));
});
for (const [label, scenario, id, request] of [
  ["missing ID", "workshop-business", undefined, MANIFEST[0].requests[0]],
  ["wrong ID", "workshop-business", "step-02", MANIFEST[0].requests[0]],
  ["wrong scenario", "workshop-rejected", "step-01", MANIFEST[0].requests[0]],
  [
    "undeclared path",
    "workshop-business",
    "step-01",
    { method: "GET", path: "/other" },
  ],
  [
    "changed body",
    "workshop-business",
    "step-01",
    { ...MANIFEST[0].requests[0], body: "different" },
  ],
])
  test(`broker rejects ${label} before application HTTP`, async () => {
    let calls = 0;
    const t = fake({
      http: async () => {
        calls++;
        return http();
      },
    });
    const worker = create(t);
    await worker.reset(signal());
    await assert.rejects(worker.requestStep(scenario, id, request, signal()));
    assert.equal(calls, 1);
    assert.equal(t.closed, 1);
  });
test("dirty reset is rejected and container cleanup is mandatory", async () => {
  const t = fake({
    inspect: async () => ({ ...inspect(), legacySha256: "0".repeat(64) }),
  });
  await assert.rejects(create(t).reset(signal()));
  assert.equal(t.closed, 1);
});
test("request before reset and incomplete or exhausted reset schedule fail", async () => {
  await assert.rejects(create().request(MANIFEST[0].requests[0], signal()));
  const w = create();
  await w.reset(signal());
  await assert.rejects(w.reset(signal()));
});
test("uncommanded DB change is rejected instead of cached away", async () => {
  let n = 0;
  const t = fake({
    inspect: async () => ({
      ...inspect(),
      snapshot: ++n > 1 ? expected : empty,
    }),
  });
  const w = create(t);
  await w.reset(signal());
  await assert.rejects(w.snapshot(signal()));
});
test("crash, aborted request and malformed observation poison the worker and clean up", async () => {
  for (const reason of ["crash", "corrupt", "abort"]) {
    const t = fake();
    const w = create(t);
    await w.reset(signal());
    t.http = async () => {
      if (reason === "crash") throw new Error("private detail");
      return { ...http(), observation: { status: 999 } };
    };
    const s = reason === "abort" ? AbortSignal.abort() : signal();
    await assert.rejects(w.request(MANIFEST[0].requests[0], s));
    assert.equal(t.closed, 1);
    await assert.rejects(w.snapshot(signal()));
  }
});
test("cleanup failure is ERROR and never accepted as successful close", async () => {
  const t = fake({
    close: async () => {
      throw new Error("cleanup");
    },
  });
  await assert.rejects(create(t).close(signal()), /cleanup/);
  const w = create(t);
  await w.reset(signal());
  t.http = async () => {
    throw new Error();
  };
  await assert.rejects(
    w.request(MANIFEST[0].requests[0], signal()),
    /CLEANUP_ERROR/,
  );
});
test("close drains an aborted in-flight operation and the trusted reset schedule is copied", async () => {
  const schedule = [MANIFEST[0].id];
  const t = fake();
  const w = create(t, schedule);
  schedule[0] = "wrong";
  await w.reset(signal());
  const ac = new AbortController();
  let entered;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  t.http = async (_request, inputSignal) => {
    entered();
    return new Promise((_resolve, reject) =>
      inputSignal.addEventListener("abort", () => reject(new Error("abort")), {
        once: true,
      }),
    );
  };
  const request = w.request(MANIFEST[0].requests[0], ac.signal);
  await ready;
  ac.abort();
  const close = w.close(signal());
  await assert.rejects(request);
  await close;
  assert.ok(t.closed >= 1);
});
test("WorkerAdapter integrates with verifyPair without DTO changes (synthetic transport only)", async () => {
  const make = () => create();
  const result = await verifyPair({
    reference: make(),
    candidate: make(),
    scenarios: [MANIFEST[0]],
    artifactParent: scratch,
    operationTimeoutMs: 10000,
  });
  assert.ok(
    result.gateResults.some(
      (g) => g.gate === "G4" && g.verdict === "INCONCLUSIVE",
    ),
  );
});
test("transport rejects actual image ID mismatch and still removes its inspector", async () => {
  const calls = [];
  const t = Object.assign(Object.create(DockerReferenceTransport.prototype), {
    runtime: { imageId: `sha256:${"a".repeat(64)}` },
    inspectors: new Set(),
    command: async (args) => {
      calls.push(args);
      return {
        stdout: Buffer.from(args[0] === "image" ? "wrong-image" : ""),
        stderr: Buffer.alloc(0),
        elapsedMs: 0,
      };
    },
  });
  await assert.rejects(
    t.inspectFixture("/fixture.sql", signal()),
    /IMAGE_DIGEST/,
  );
  assert.ok(!calls.some((args) => args[0] === "run"));
  assert.equal(t.inspectors.size, 0);
});
test("transport reports residual container as cleanup ERROR and retains name for retry", async () => {
  const t = Object.assign(Object.create(DockerReferenceTransport.prototype), {
    app: "unit-residual",
    inspectors: new Set(),
    command: async () => ({
      stdout: Buffer.from("residual"),
      stderr: Buffer.alloc(0),
      elapsedMs: 0,
    }),
  });
  await assert.rejects(t.close(), /CLEANUP_ERROR/);
  assert.equal(t.app, "unit-residual");
});
for (const [label, code, timeout, aborted] of [
  ["crash", "process.exit(7)", 2000, false],
  ["hang", "setInterval(()=>{},1000)", 150, false],
  ["abort", "setInterval(()=>{},1000)", 3000, true],
])
  test(`real process supervision handles ${label} without exposing stdout/stderr`, async () => {
    const evidence = memory();
    const run = boundedCommand(process.execPath, evidence);
    const ac = new AbortController();
    if (aborted) setTimeout(() => ac.abort(), 150);
    await assert.rejects(
      run(
        ["-e", `console.error('private-control');${code}`],
        ac.signal,
        undefined,
        timeout,
      ),
    );
    assert.equal(evidence.entries.length, 1);
    assert.ok("stderrBase64" in evidence.entries[0].value);
  });
test("public summary rejects raw fields and incomplete proof", () => {
  const input = {
    headSha: "a".repeat(40),
    imageId: `sha256:${"b".repeat(64)}`,
    packSha256: "c".repeat(64),
    attempts: 6,
    steps: 34,
    replayEqual: true,
    mappingEqual: true,
    privateVerified: true,
  };
  const summary = publicSummary(input);
  assert.equal(summary.retention.external, "EXTERNAL_RETENTION_NOT_RUN");
  for (const patch of [
    { raw: "secret" },
    { body: "answer" },
    { steps: 33 },
    { privateVerified: false },
    { headSha: "private-path" },
  ])
    assert.throws(() => publicSummary({ ...input, ...patch }));
});
test("private evidence survives worker teardown, verifies hashes, rejects tampering and insecure storage", {
  skip: process.platform === "win32",
}, () => {
  chmodSync(scratch, 0o700);
  const p = new PrivateEvidence(scratch, resolve("."), { source: SOURCE });
  p.write("attempt-1-step-01", {
    raw: "private",
    before: expected,
    after: expected,
  });
  const hash = p.seal();
  assert.equal(PrivateEvidence.verify(p.path, hash), 2);
  assert.equal(statSync(join(p.path, "index.json")).mode & 0o777, 0o600);
  writeFileSync(join(p.path, "attempt-1-step-01.json"), "tampered");
  assert.throws(
    () => PrivateEvidence.verify(p.path, hash),
    /EVIDENCE_TAMPERED/,
  );
  assert.throws(() => p.write("late", {}));
  const q = new PrivateEvidence(scratch, resolve("."), {});
  for (const id of ["../escape", "a/b", "UPPER", "", "index.json"])
    assert.throws(() => q.write(id, {}));
  q.write("once", {});
  assert.throws(() => q.write("once", {}));
  assert.throws(() => q.write("large", "x".repeat(17 * 1024 * 1024)));
  const insecure = join(scratch, "insecure");
  mkdirSync(insecure, { mode: 0o755 });
  assert.throws(() => new PrivateEvidence(insecure, resolve("."), {}));
  const symlink = join(scratch, "linked");
  symlinkSync(scratch, symlink);
  assert.throws(() => new PrivateEvidence(symlink, resolve("."), {}));
  const r = new PrivateEvidence(scratch, resolve("."), {});
  const h = r.seal();
  linkSync(join(r.path, "provenance.json"), join(scratch, "hardlink"));
  assert.throws(() => PrivateEvidence.verify(r.path, h));
  const inside = join(scratch, "public");
  mkdirSync(inside, { mode: 0o700 });
  assert.throws(() => new PrivateEvidence(inside, scratch, {}));
});
