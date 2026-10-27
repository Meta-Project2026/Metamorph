// TRUSTED host driver: never imports, evaluates or executes candidate source here.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { admitDirectory, sha256, validateBundle } from "./admission.mjs";
import {
  command,
  FIXED_ENV,
  requireSuccess,
  sandboxArgs,
  TargetWorker,
} from "./controller.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const evidenceRoot = resolve(
  process.env.TARGET_WORKER_EVIDENCE ?? join(packageRoot, "evidence-local"),
);
const report = {
  scope: "original-public-mini-api-only",
  sourceHead: process.env.TARGET_WORKER_HEAD_SHA ?? "UNKNOWN",
  startedAt: new Date().toISOString(),
  cases: [],
  clocks: [],
  G0: "NOT_RUN",
  G1: "NOT_RUN",
  G2: "NOT_RUN",
  G3: "NOT_RUN",
  G4: "NOT_RUN",
  product: "NOT_ESTABLISHED",
  notRun: [
    "complete G0 and all benchmark routes",
    "PHP-TS parity",
    "held-out",
    "model provider",
    "concurrency",
    "clock boundaries/midnight/DST",
    "benchmark registration",
    "joint owner API acceptance",
  ],
};
await mkdir(evidenceRoot, { recursive: true });
const save = (name, data) =>
  writeFile(join(evidenceRoot, name), `${JSON.stringify(data, null, 2)}\n`);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const body = (http) =>
  JSON.parse(Buffer.from(http.bodyBase64, "base64").toString());
let image;
let caseIndex = 0;
async function exercise(id, bundle, operation, expectedError, runtimeCheck) {
  const worker = new TargetWorker(image, bundle);
  let error = null;
  let cleanupError = null;
  let observation;
  try {
    await worker.provision();
    observation = await operation(worker);
  } catch (caught) {
    error = caught.message;
  } finally {
    try {
      await worker.close();
    } catch (caught) {
      cleanupError = caught.message;
    }
    await save(`${String(caseIndex++).padStart(2, "0")}-${id}.json`, {
      ...worker.evidence,
      error,
      cleanupError,
      observation,
    });
  }
  if (cleanupError) throw new Error(`${id}: ${cleanupError}`);
  if (runtimeCheck) runtimeCheck(worker.evidence);
  if (expectedError)
    assert.match(error ?? "UNEXPECTED_SUCCESS", expectedError, id);
  else assert.equal(error, null, `${id}: ${error}`);
  report.cases.push({
    id,
    control: expectedError ? "negative-rejected" : "positive-executed",
    outcome: error ?? "PASS_SCOPED",
    cleanupVerified: worker.evidence.cleanupVerified,
    sourceSha: bundle.candidateSha,
  });
  console.log(JSON.stringify(report.cases.at(-1)));
}
try {
  requireSuccess(await command(["info"], { timeoutMs: 15000 }));
  const build = await command(
    [
      "build",
      "--pull",
      "--tag",
      "metamorph-target-worker:mmp007",
      join(packageRoot, "runtime"),
    ],
    { timeoutMs: 240000 },
  );
  await save("image-build.json", build);
  requireSuccess(build);
  const inspected = JSON.parse(
    requireSuccess(
      await command(["image", "inspect", "metamorph-target-worker:mmp007"]),
    ).stdout,
  )[0];
  image = inspected.Id;
  report.image = inspected;
  const noticeName = `mmp007-notices-${process.pid}`;
  try {
    const notices = requireSuccess(
      await command([
        "run",
        ...sandboxArgs(noticeName),
        image,
        "sh",
        "-c",
        "node --version && cat /usr/share/doc/libfaketime/copyright /opt/toolchain/node_modules/typescript/LICENSE.txt /opt/toolchain/node_modules/@types/node/LICENSE /opt/toolchain/node_modules/undici-types/LICENSE",
      ]),
    );
    await save("dependency-notices.json", notices);
  } finally {
    requireSuccess(await command(["rm", "--force", noticeName]));
  }
  const bundle = await admitDirectory(join(packageRoot, "fixtures/public"));
  const original = bundle.files[0].content;
  const mutated = (content) =>
    validateBundle([{ path: "src/main.ts", content, sha256: sha256(content) }]);
  // No PHP worker is provisioned. Its executable/source/DB/network are absent.
  await exercise("public-write-read-reset", bundle, async (worker) => {
    await delay(300);
    worker.evidence.unitSmoke = requireSuccess(
      await worker.cmd([
        "exec",
        worker.runtime.name,
        "node",
        "/opt/worker/unit-smoke.mjs",
      ]),
    );
    await worker.reset("public-independent-observation");
    await delay(300);
    const initial = await worker.request("initial", "GET", "/items");
    assert.deepEqual(body(initial), { items: [] });
    const initialDb = await worker.snapshot("initial");
    const written = await worker.request(
      "write",
      "POST",
      "/items",
      '{"value":"original-public-value"}',
    );
    const read = await worker.request("read", "GET", "/items");
    assert.equal(written.status, 200);
    assert.equal(read.status, 200);
    assert.equal(body(read).items[0].value, "original-public-value");
    assert.equal(body(read).items[0].id, 1);
    assert.ok(body(read).items[0].created_at);
    const db = await worker.snapshot("after-write");
    const items = db.tables.find((table) => table.name === "items");
    assert.equal(items.rows.length, 1);
    assert.deepEqual(items.rows[0][1], {
      type: "text",
      value: "original-public-value",
    });
    assert.deepEqual(
      db.tables.find((table) => table.name === "sqlite_sequence").rows[0],
      [
        { type: "text", value: "items" },
        { type: "integer", value: "1" },
      ],
    );
    const rejected = await worker.request("rejected", "POST", "/items", "{}");
    assert.equal(rejected.status, 400);
    const rejectedDb = await worker.snapshot("after-rejection");
    assert.deepEqual(rejectedDb.tables, db.tables);
    const missing = await worker.request("missing", "GET", "/absent");
    assert.equal(missing.status, 404);
    const priorId = db.runtimeId;
    await worker.reset("public-fresh");
    await delay(300);
    const fresh = await worker.request("fresh", "GET", "/items");
    assert.deepEqual(body(fresh), { items: [] });
    assert.notEqual(worker.evidence.runtimeInspect.Id, priorId);
    return {
      initial,
      initialDb,
      written,
      read,
      db,
      rejected,
      rejectedDb,
      missing,
      fresh,
    };
  });
  for (const [id, source] of [
    ["syntax-error", "const invalid = ;"],
    ["type-error", 'const n: number = "wrong"; console.log(n);'],
    [
      "invalid-import",
      'import missing from "missing-package"; console.log(missing);',
    ],
  ])
    await exercise(id, mutated(source), async () => {}, /BUILD_FAILED/);
  for (const [id, source] of [
    ["bad-startup", 'throw new Error("original startup control");'],
    ["crash", "process.exit(7);"],
    [
      "oom",
      "const chunks: number[][] = []; while (true) chunks.push(new Array(100000).fill(1));",
    ],
    [
      "blocked-npm-script",
      'import { spawnSync } from "node:child_process"; spawnSync("npm", ["run", "postinstall"]);',
    ],
    [
      "blocked-php-process",
      'import { spawnSync } from "node:child_process"; spawnSync("php", ["/reference/api.php"]);',
    ],
    [
      "blocked-reference-file",
      'import { readFileSync } from "node:fs"; readFileSync("/reference/reference.sqlite");',
    ],
    [
      "blocked-external-network",
      'fetch("http://192.0.2.1:8080/reference", { signal: AbortSignal.timeout(900) }).then(() => process.exit(0), () => process.exit(8));',
    ],
  ])
    await exercise(
      id,
      mutated(source),
      async (worker) => {
        await delay(1200);
        return worker.request("must-fail", "GET", "/items");
      },
      /ENVIRONMENT_ERROR|TIMEOUT/,
      (evidence) => {
        const execution = evidence.cleanup.at(-1).execution;
        assert.notEqual(
          execution.exitCode,
          0,
          `${id}: candidate unexpectedly exited successfully`,
        );
        if (id === "crash") assert.equal(execution.exitCode, 7);
        if (id === "blocked-external-network")
          assert.equal(execution.exitCode, 8);
        if (id === "oom")
          assert.match(
            execution.stderr,
            /heap out of memory|Allocation failed/,
          );
        if (id.startsWith("blocked-") && id !== "blocked-external-network")
          assert.match(execution.stderr, /ERR_ACCESS_DENIED/);
        if (id === "bad-startup")
          assert.match(execution.stderr, /original startup control/);
      },
    );
  await exercise(
    "infinite-loop-timeout",
    mutated("while (true) {}"),
    async (worker) => {
      const timed = await worker.cmd(["wait", worker.runtime.name], {
        timeoutMs: 750,
      });
      assert.equal(timed.timedOut, true);
      await worker.kill();
      throw new Error("TIMEOUT");
    },
    /TIMEOUT/,
  );
  await exercise("cancel-reap", bundle, async (worker) => {
    const cancelled = await worker.cmd(
      ["exec", worker.runtime.name, "sleep", "30"],
      { signal: AbortSignal.timeout(200) },
    );
    assert.equal(cancelled.cancelled, true);
    // Killing the CLI alone is insufficient; close below reaps the whole container.
    return cancelled;
  });
  await exercise(
    "malformed-http",
    mutated(
      'import { createServer } from "node:net"; createServer(socket => socket.end("not-http\\r\\n")).listen(3000, "127.0.0.1");',
    ),
    async (worker) => {
      await delay(300);
      return worker.request("malformed", "GET", "/items");
    },
    /ENVIRONMENT_ERROR/,
    (evidence) => {
      assert.ok(
        evidence.commands.some((receipt) =>
          /HPE_INVALID_CONSTANT|Parse Error/.test(receipt.stderr),
        ),
      );
    },
  );
  for (const [id, injected] of [
    [
      "corrupt-db",
      'require("node:fs").writeFileSync("/state/target.sqlite", "corrupt");',
    ],
    ["missing-db", 'require("node:fs").unlinkSync("/state/target.sqlite");'],
    [
      "wrong-snapshot-source",
      'const fs = require("node:fs"); fs.renameSync("/state/target.sqlite", "/state/other.sqlite"); fs.symlinkSync("/state/other.sqlite", "/state/target.sqlite");',
    ],
  ])
    await exercise(
      id,
      mutated(original + injected),
      async (worker) => {
        await delay(300);
        const alive = await worker.request("alive", "GET", "/absent");
        assert.equal(alive.status, 404);
        return worker.snapshot("must-fail");
      },
      /ENVIRONMENT_ERROR|OBSERVATION_ERROR/,
    );
  await exercise(
    "ignore-candidate-snapshot-endpoint",
    mutated(
      original.replace(
        'if (req.url !== "/items"',
        'if (req.url === "/snapshot") { res.end(\'{"verdict":"PASS","tables":[]}\'); return; }\n  if (req.url !== "/items"',
      ),
    ),
    async (worker) => {
      await delay(300);
      const forged = await worker.request("forged", "GET", "/snapshot");
      assert.deepEqual(body(forged), { verdict: "PASS", tables: [] });
      await worker.request(
        "write",
        "POST",
        "/items",
        '{"value":"inspected-independently"}',
      );
      const db = await worker.snapshot("trusted");
      assert.equal(db.tables.find((t) => t.name === "items").rows.length, 1);
      return { forged, db };
    },
  );
  await exercise(
    "typed-sqlite",
    mutated(
      original +
        "\ndb.exec(\"CREATE TABLE primitives(id INTEGER PRIMARY KEY, big INTEGER, bytes BLOB, fraction REAL, empty TEXT); INSERT INTO primitives VALUES(1,9223372036854775807,x'00ff',1.25,NULL)\");",
    ),
    async (worker) => {
      await delay(300);
      const snapshot = await worker.snapshot("typed");
      assert.deepEqual(
        snapshot.tables.find((t) => t.name === "primitives").rows[0],
        [
          { type: "integer", value: "1" },
          { type: "integer", value: "9223372036854775807" },
          { type: "blob", value: "00ff" },
          { type: "real", value: 1.25 },
          { type: "null" },
        ],
      );
      return snapshot;
    },
  );
  report.G1 = "PASS_SCOPED_ORIGINAL_FIXTURE";
  report.G0Scoped = "PASS_SELECTED_PUBLIC_ROUTES_WITHOUT_PHP";
  for (const mode of ["real", "fixed-experiment", "drift-control"]) {
    const name = `mmp007-clock-${process.pid}-${mode}`;
    try {
      const result = await command([
        "run",
        ...sandboxArgs(name),
        ...(mode === "real"
          ? []
          : FIXED_ENV.map((value) =>
              mode === "drift-control" &&
              value === "FAKETIME=2026-10-27 12:00:00"
                ? "FAKETIME=2026-10-27 12:00:01"
                : value,
            )),
        image,
        "node",
        "/opt/worker/clock.mjs",
      ]);
      await save(`clock-${mode}.json`, result);
      const clock = JSON.parse(requireSuccess(result).stdout);
      assert.ok(
        clock.monotonicDeltaMs >= 1100 && clock.monotonicDeltaMs < 10000,
      );
      assert.ok(BigInt(clock.after.hrtime) > BigInt(clock.before.hrtime));
      report.clocks.push({ mode, ...clock });
    } finally {
      requireSuccess(await command(["rm", "--force", name]));
    }
  }
  const fixed = report.clocks.find(
    (clock) => clock.mode === "fixed-experiment",
  );
  const samples = [fixed.before, fixed.after];
  report.clockStatus = samples.every(
    (s) =>
      s.date === "2026-10-27T12:00:00.000Z" &&
      s.dateNow === 1793102400000 &&
      s.sqlite.datetime === "2026-10-27 12:00:00" &&
      s.sqlite.timestamp === "2026-10-27 12:00:00",
  )
    ? "MEASURED_NODE_SQLITE_FIXED_WALL_PARITY_ONLY"
    : "CLOCK_PARITY_BLOCKED";
  const drift = report.clocks.find((clock) => clock.mode === "drift-control");
  assert.equal(drift.before.sqlite.datetime, "2026-10-27 12:00:01");
  assert.notEqual(drift.before.sqlite.datetime, "2026-10-27 12:00:00");
  report.clockDriftControl = "REJECTED_WRONG_WALL_TIME";
  report.procedure = "PASS";
} catch (error) {
  report.procedure = "ERROR";
  report.error = error.message;
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  // Receipts may be public ONLY because this driver accepts original public fixtures.
  await save("summary.json", report);
  console.log(
    JSON.stringify({
      procedure: report.procedure,
      clockStatus: report.clockStatus,
      cases: report.cases.length,
      error: report.error,
    }),
  );
}
