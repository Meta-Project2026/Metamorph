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
import { buildTrustedRuntime } from "./runtime-broker.mjs";

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
const body = (http) =>
  JSON.parse(Buffer.from(http.bodyBase64, "base64").toString());
let image;
let runtime;
let caseIndex = 0;
async function exercise(
  id,
  bundle,
  operation,
  expectedError,
  runtimeCheck,
  options = {},
) {
  const worker = new TargetWorker(
    runtime,
    bundle,
    "real",
    options.workerOptions,
  );
  let error = null;
  let cleanupError = null;
  let observation;
  try {
    await worker.provision(options.signal);
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
  runtime = await buildTrustedRuntime(save);
  image = runtime.imageId;
  report.image = runtime.provenance;
  report.hostNode = process.version;
  report.docker = requireSuccess(
    await command(["version", "--format", "{{json .}}"]),
  );
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
    worker.evidence.unitSmoke = requireSuccess(
      await worker.cmd([
        "exec",
        worker.runtime.name,
        "node",
        "/opt/worker/unit-smoke.mjs",
      ]),
    );
    await worker.reset("public-independent-observation");
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
        return worker.request("must-fail", "GET", "/items");
      },
      /RUNTIME_FAILED|TIMEOUT/,
      (evidence) => {
        const execution = evidence.cleanup.findLast(
          (entry) => entry.execution,
        )?.execution;
        assert.ok(execution, `${id}: missing subprocess receipt`);
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
  await exercise("bounded-cli-wait", bundle, async (worker) => {
    const timed = await worker.cmd(["wait", worker.runtime.name], {
      timeoutMs: 750,
    });
    assert.equal(timed.timedOut, true);
    return timed;
  });
  await exercise("cancel-reap", bundle, async (worker) => {
    const cancelled = await worker.cmd(
      ["exec", worker.runtime.name, "sleep", "30"],
      { signal: AbortSignal.timeout(200), background: true },
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
      return worker.request("malformed", "GET", "/items");
    },
    /RUNTIME_FAILED/,
    (evidence) => {
      assert.ok(
        evidence.readiness.some((probe) => probe.reason === "MALFORMED_HTTP"),
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
        const alive = await worker.request("alive", "GET", "/absent");
        assert.equal(alive.status, 404);
        return worker.snapshot("must-fail");
      },
      id === "corrupt-db" ? /RUNTIME_FAILED/ : /OBSERVATION_ERROR/,
      id === "corrupt-db"
        ? (evidence) => {
            const execution = evidence.cleanup.findLast(
              (entry) => entry.execution,
            )?.execution;
            assert.equal(execution?.exitCode, 1);
            assert.match(execution.stderr, /ERR_SQLITE_ERROR/);
          }
        : undefined,
    );
  await exercise(
    "corrupt-db-independent-parser",
    mutated(
      original +
        '\nserver.on("request", req => { if (req.url === "/corrupt-control") require("node:fs").writeFileSync("/state/target.sqlite", "corrupt"); });',
    ),
    async (worker) => {
      assert.equal(
        (
          await worker.request(
            "corrupt-public-control",
            "GET",
            "/corrupt-control",
          )
        ).status,
        404,
      );
      return worker.snapshot("corrupt-independent");
    },
    /OBSERVATION_ERROR/,
    (evidence) => {
      assert.ok(
        evidence.commands.some(
          (receipt) =>
            receipt.args.includes("/opt/worker/inspect.mjs") &&
            receipt.exitCode === 1 &&
            /ERR_SQLITE_ERROR/.test(receipt.stderr),
        ),
      );
    },
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
  await exercise(
    "nonfinite-sqlite-rejected",
    mutated(
      original +
        '\ndb.exec("CREATE TABLE nonfinite(value REAL); INSERT INTO nonfinite VALUES(1e999)");',
    ),
    async (worker) => {
      assert.equal(
        (await worker.request("alive", "GET", "/absent")).status,
        404,
      );
      return worker.snapshot("nonfinite");
    },
    /OBSERVATION_ERROR/,
    (evidence) => {
      assert.ok(
        evidence.commands.some((receipt) =>
          receipt.stderr.includes("UNREPRESENTABLE_SQLITE_VALUE"),
        ),
      );
    },
  );
  await exercise(
    "slow-startup-no-client-sleep",
    mutated(
      original.replace(
        'server.listen(3000, "127.0.0.1");',
        'setTimeout(() => server.listen(3000, "127.0.0.1"), 1800);',
      ),
    ),
    async (worker) => {
      assert.deepEqual(
        body(await worker.request("immediate", "GET", "/items")),
        { items: [] },
      );
    },
  );
  for (const [id, source, expected] of [
    ["never-listen", "setInterval(() => {}, 1000);", /TIMEOUT/],
    [
      "wrong-port",
      original.replace("server.listen(3000,", "server.listen(3001,"),
      /TIMEOUT/,
    ],
    [
      "wrong-response",
      original.replace(
        "res.end(\n    JSON.stringify({",
        "res.statusCode = 503; res.end(\n    JSON.stringify({",
      ),
      /RUNTIME_FAILED/,
    ],
    [
      "hung-http",
      'import { createServer } from "node:net"; createServer(() => {}).listen(3000, "127.0.0.1");',
      /TIMEOUT/,
    ],
  ])
    await exercise(id, mutated(source), async () => {}, expected);
  await exercise("eight-resets-resource-inventory", bundle, async (worker) => {
    worker.evidence.resetInventories = [];
    for (let index = 0; index < 8; index++) {
      const previousId = worker.runtime.id;
      await worker.reset(`resource-${index}`);
      assert.notEqual(worker.runtime.id, previousId);
      const containers = requireSuccess(
        await command([
          "container",
          "ls",
          "--all",
          "--filter",
          "label=metamorph.target-worker=true",
          "--format",
          "{{.Names}}",
        ]),
      );
      const volumes = requireSuccess(
        await command([
          "volume",
          "ls",
          "--filter",
          "label=metamorph.target-worker=true",
          "--format",
          "{{.Name}}",
        ]),
      );
      worker.evidence.resetInventories.push({ containers, volumes });
      assert.deepEqual(
        containers.stdout
          .trim()
          .split(/\s+/)
          .filter((n) => n.startsWith(worker.runId)),
        [worker.runtime.name],
      );
      assert.deepEqual(
        volumes.stdout
          .trim()
          .split(/\s+/)
          .filter((n) => n.startsWith(worker.runId)),
        [worker.runtime.volume],
      );
      assert.equal(
        (await worker.request("immediate", "GET", "/items")).status,
        200,
      );
    }
  });
  await exercise(
    "aggregate-deadline-real-monotonic",
    bundle,
    async (worker) => {
      const deadline = worker.endsAt;
      worker.evidence.aggregateResets = [];
      for (let index = 0; index < 2; index++) {
        const ready = await worker.reset(`budget-${index}`);
        assert.equal(worker.endsAt, deadline);
        worker.evidence.aggregateResets.push({
          runtimeId: ready.runtimeId,
          scenarioId: ready.scenarioId,
          deadline,
          elapsedMs: worker.now() - worker.startedAt,
        });
      }
      // A real pending Docker wait uses the remaining *original* run budget.
      // No client sleep or candidate Date patch can advance/renew this deadline.
      await worker.operation(() =>
        worker.cmd(["wait", worker.runtime.name], {
          timeoutMs: worker.policy.lifetimeMs,
        }),
      );
    },
    /TIMEOUT/,
    (evidence) => {
      assert.equal(evidence.operationError, "TIMEOUT");
      assert.equal(evidence.aggregateResets.length, 2);
      assert.equal(
        evidence.aggregateResets[0].deadline,
        evidence.aggregateResets[1].deadline,
      );
      assert.ok(
        evidence.commands.some(
          (receipt) =>
            receipt.args[0] === "wait" &&
            (receipt.timedOut || receipt.cancelled),
        ),
      );
      assert.equal(evidence.cleanupVerified, true);
    },
    { workerOptions: { limits: { lifetimeMs: 20000 } } },
  );
  const cancellation = new AbortController();
  await exercise(
    "abort-pending-readiness",
    mutated(
      original.replace(
        'server.listen(3000, "127.0.0.1");',
        'setTimeout(() => server.listen(3000, "127.0.0.1"), 9000);',
      ),
    ),
    async () => {},
    /CANCELLED/,
    undefined,
    {
      signal: cancellation.signal,
      workerOptions: {
        trustedTest: {
          command: async (args, config) => {
            const receipt = await command(args, config);
            if (
              args.includes("/opt/worker/inspect.mjs") &&
              JSON.parse(args.at(-1)).kind === "readiness"
            )
              cancellation.abort();
            return receipt;
          },
        },
      },
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
