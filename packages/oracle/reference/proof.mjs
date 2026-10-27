// Trusted host proof; never loads upstream PHP, never opens its SQLite DB on host.

import { randomUUID } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { compareHttp, compareSqlite, snapshotSqlite } from "../dist/index.js";
import {
  DockerReferenceTransport,
  isolation,
  provisionRuntime,
} from "../dist/reference/docker.js";
import { PrivateEvidence } from "../dist/reference/evidence.js";
import {
  ensure,
  MANIFEST,
  MANIFEST_SHA256,
  ReferenceWorkerError,
  SOURCE,
  stepId,
} from "../dist/reference/manifest.js";
import { dockerCommand } from "../dist/reference/process.js";
import { publicSummary } from "../dist/reference/public.js";
import { PhpReferenceWorker } from "../dist/reference/worker.js";

const oracleRoot = fileURLToPath(new URL("..", import.meta.url));
const publicRoot = resolve(oracleRoot, "../..");
const output = resolve("reference-public");
mkdirSync(output, { recursive: true });
let phase = "private-storage";
let worker;
try {
  ensure(process.platform !== "win32", "LINUX_REQUIRED");
  const parent =
    process.env.ORACLE_PRIVATE_PARENT ??
    mkdtempSync(join(tmpdir(), "mmp-reference-private-"));
  if (!process.env.ORACLE_PRIVATE_PARENT) chmodSync(parent, 0o700);
  const schedule = MANIFEST.flatMap((s) => [s.id, s.id]);
  const evidence = new PrivateEvidence(parent, publicRoot, {
    source: SOURCE,
    manifest: MANIFEST,
    manifestSha256: MANIFEST_SHA256,
    schedule,
    headSha: process.env.REFERENCE_HEAD_SHA,
    wallStart: new Date().toISOString(),
  });
  const directory = mkdtempSync(join(tmpdir(), "mmp-reference-source-"));
  chmodSync(directory, 0o700);
  const command = dockerCommand(evidence);
  phase = "provision";
  const signal = AbortSignal.timeout(12 * 60 * 1000);
  const runtime = await provisionRuntime({
    command,
    directory,
    oracleRoot,
    signal,
    evidence,
  });
  const transport = new DockerReferenceTransport(runtime, command);
  phase = "lifecycle-controls";
  for (const kind of ["crash", "hang", "abort"]) {
    const name = `mmp-control-${randomUUID()}`;
    let rejected = false;
    try {
      await command(
        [
          "create",
          ...isolation(name),
          runtime.imageId,
          "timeout",
          "--signal=KILL",
          "10",
          "php",
          "-r",
          kind === "crash" ? "exit(7);" : "sleep(60);",
        ],
        signal,
      );
      const ac = new AbortController();
      const timer =
        kind === "abort" ? setTimeout(() => ac.abort(), 300) : undefined;
      try {
        await command(
          ["start", "-ai", name],
          kind === "abort" ? ac.signal : signal,
          undefined,
          kind === "hang" ? 300 : 5000,
        );
      } catch {
        rejected = true;
      } finally {
        clearTimeout(timer);
      }
    } finally {
      await command(["rm", "-f", name], AbortSignal.timeout(5000));
      const remaining = await command(
        ["ps", "-aq", "--filter", `name=^/${name}$`],
        AbortSignal.timeout(5000),
      );
      ensure(!remaining.stdout.toString().trim(), "CLEANUP_ERROR");
    }
    ensure(rejected, "LIFECYCLE_CONTROL_ACCEPTED");
    evidence.write(`lifecycle-${kind}`, {
      expectedRejection: true,
      residualContainers: 0,
    });
  }
  phase = "mapping";
  const sqlPath = join(oracleRoot, "reference", "fixture.sql");
  const fixturePath = join(directory, "trusted-fixture.sqlite");
  const db = new DatabaseSync(fixturePath);
  try {
    db.exec(readFileSync(sqlPath, "utf8"));
  } finally {
    db.close();
  }
  const fixture = await transport.inspectFixture(sqlPath, signal);
  ensure(
    compareSqlite(snapshotSqlite(fixturePath), fixture.snapshot).length === 0,
    "MAPPING_MISMATCH",
  );
  evidence.write("mapping-control", {
    snapshot: fixture.snapshot,
    inspector: fixture.raw,
    result: "EQUAL",
  });
  phase = "replay";
  worker = new PhpReferenceWorker(transport, evidence, schedule);
  let steps = 0;
  const count = (snapshot) =>
    snapshot.tables.find((t) => t.name === "appointments").rows.length;
  const values = (snapshot) => {
    const table = snapshot.tables.find((t) => t.name === "appointments");
    return table.rows.map((row) =>
      Object.fromEntries(
        table.columns.map((name, i) => [name, row[i].value ?? null]),
      ),
    );
  };
  for (const scenario of MANIFEST) {
    const observations = [];
    for (let replay = 0; replay < 2; replay++) {
      phase = `${scenario.id}-reset-${replay + 1}`;
      await worker.reset(signal);
      phase = `${scenario.id}-initial-${replay + 1}`;
      const initial = await worker.snapshot(signal);
      ensure(count(initial) === 0);
      const current = [{ snapshot: initial }];
      for (const [i, request] of scenario.requests.entries()) {
        phase = `${scenario.id}-${stepId(i)}-${replay + 1}`;
        const before = current.at(-1).snapshot;
        const http = await worker.requestStep(
          scenario.id,
          stepId(i),
          request,
          signal,
        );
        const snapshot = await worker.snapshot(signal);
        const json = JSON.parse(Buffer.from(http.body).toString());
        ensure(http.status === 200);
        const rejection =
          (scenario.id === "workshop-rejected" && [1, 3].includes(i)) ||
          (scenario.id === "workshop-capacity" && i === 4);
        if (request.method === "GET" || rejection)
          ensure(compareSqlite(before, snapshot).length === 0);
        if (rejection) ensure(json.success === false);
        if (scenario.id === "workshop-rejected" && i === 1)
          ensure(json.error_type === "DUPLICATE_CLIENT");
        if (scenario.id === "workshop-capacity") {
          ensure(count(snapshot) === Math.min(i + 1, 4));
          if (i === 4) ensure(json.error_type === "MECHANIC_FULL");
          if (i === 5)
            ensure(
              json.mechanics[0].booked_count === 4 &&
                json.mechanics[0].is_full === true,
            );
        }
        if (scenario.id === "workshop-business") {
          ensure(count(snapshot) === (i >= 4 ? 0 : 1));
          if (i <= 3)
            ensure(
              values(snapshot)[0].client_name === "Public Qualification 1",
            );
          if ([2, 3].includes(i))
            ensure(
              values(snapshot)[0].appointment_date === "2099-06-16" &&
                values(snapshot)[0].mechanic_id === "2",
            );
          if (request.method === "POST") ensure(json.success === true);
          if ([1, 3, 5].includes(i))
            ensure(json.appointments.length === (i === 5 ? 0 : 1));
          if (i === 3)
            ensure(
              json.appointments[0].appointment_date === "2099-06-16" &&
                Number(json.appointments[0].mechanic_id) === 2,
            );
        }
        if (scenario.id === "workshop-rejected") {
          ensure(count(snapshot) === 1);
          if (request.method === "GET") ensure(json.appointments.length === 1);
        }
        current.push({ http, snapshot });
        steps++;
      }
      observations.push(current);
    }
    for (let i = 0; i < observations[0].length; i++) {
      const a = observations[0][i];
      const b = observations[1][i];
      ensure(
        compareSqlite(a.snapshot, b.snapshot).length === 0,
        "REPLAY_DATABASE",
      );
      if (a.http)
        ensure(
          compareHttp(a.http, b.http).length === 0 &&
            Buffer.from(a.http.body).equals(Buffer.from(b.http.body)),
          "REPLAY_HTTP",
        );
    }
  }
  phase = "cleanup";
  await worker.close(AbortSignal.timeout(15000));
  worker = undefined;
  evidence.write("completion", {
    attempts: 6,
    steps,
    wallEnd: new Date().toISOString(),
    cleanup: "COMPLETE",
  });
  phase = "retention-verification";
  const packSha256 = evidence.seal();
  ensure(
    PrivateEvidence.verify(evidence.path, packSha256) > 34,
    "EVIDENCE_INCOMPLETE",
  );
  const summary = publicSummary({
    headSha: process.env.REFERENCE_HEAD_SHA,
    imageId: runtime.imageId,
    packSha256,
    attempts: 6,
    steps,
    replayEqual: true,
    mappingEqual: true,
    privateVerified: true,
  });
  writeFileSync(
    join(output, "reference-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  console.log(
    "Reference-only proof complete: 6 clean attempts, 34 steps; private pack verified after cleanup. External retention NOT_RUN.",
  );
} catch (error) {
  const code =
    error instanceof ReferenceWorkerError &&
    new Set([
      "MAPPING_MISMATCH",
      "WORKER_CRASH",
      "PHP_CLIENT_PARSE_ERROR",
      "COMMAND_EXEC_ERROR",
      "COMMAND_CP_ERROR",
      "COMMAND_RUN_ERROR",
      "COMMAND_PAUSE_ERROR",
      "COMMAND_UNPAUSE_ERROR",
      "COMMAND_IMAGE_ERROR",
      "COMMAND_PULL_ERROR",
      "COMMAND_BUILD_ERROR",
      "COMMAND_PROCESS_ERROR",
      "INSPECTOR_ADMIT",
      "INSPECTOR_SCHEMA",
      "INSPECTOR_CLOCK",
      "INSPECTOR_VERSION",
      "RUNTIME_MISMATCH",
      "CLOCK_PROVENANCE",
      "REFERENCE_INVALID",
      "COLUMN_METADATA",
      "DEFAULT_METADATA",
      "NULL_WIRE",
      "INTEGER_WIRE",
      "REAL_WIRE",
      "TEXT_WIRE",
      "BLOB_WIRE",
      "SNAPSHOT_FIELDS",
      "UNSUPPORTED_COLUMN",
      "IMAGE_DIGEST",
      "REFERENCE_OPERATION_ERROR",
      "CLEANUP_ERROR",
      "DIRTY_RESET",
      "WORKER_NOT_RESET",
      "BOOTSTRAP_ERROR",
      "WORKER_TIMEOUT",
      "WORKER_ABORTED",
      "UNEXPECTED_STATE_CHANGE",
    ]).has(error.code)
      ? error.code
      : "TRUSTED_ERROR";
  let cleanup = "NOT_REQUIRED";
  if (worker) {
    try {
      await worker.close(AbortSignal.timeout(15000));
      cleanup = "COMPLETE";
    } catch {
      cleanup = "ERROR";
    }
  }
  writeFileSync(
    join(output, "reference-summary.json"),
    `${JSON.stringify({ format: "php74-reference-summary-v1", status: "ERROR", phase, code, cleanup, external: "EXTERNAL_RETENTION_NOT_RUN" }, null, 2)}\n`,
  );
  console.error(
    `Reference-only proof ERROR in trusted phase: ${phase}; code ${code}; cleanup ${cleanup}. Raw diagnostics are private.`,
  );
  process.exitCode = 1;
}
