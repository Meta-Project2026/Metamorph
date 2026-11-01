// MMP104: actual Oracle/report functions with inert original synthetic adapters.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { completedFixture } from "../../../research/mmp-097/synthetic-fixture.mjs";
import { inspectIncident } from "../../../research/mmp-104/inspect-incident.mjs";
import { createStagePrototype } from "../../../research/mmp-104/stage-prototype.mjs";
import {
  EARLY_FAULTS,
  FIRST_STEP_FAULTS,
  runSyntheticControl,
} from "../../../research/mmp-104/synthetic-control.mjs";
import {
  collectPreservationPackage,
  preservationIdentity,
} from "../src/candidate-retention.mjs";

const temporary = (t) => {
  const path = mkdtempSync(join(tmpdir(), "mmp104-offline-"));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
};
const gate = (receipt, id) => receipt.gates.find((g) => g.gate === id);
function assertPartialRefused(receipt) {
  const f = completedFixture();
  f.trial.attempts[0].pairs.forEach((pair, i) => {
    pair.packs = [0, 1].map((j) => ({
      id: `oracle-synthetic104-${i}-${j}`,
      sha256: "b".repeat(64),
    }));
  });
  // Begin with valid bindings, then change only aggregate gate observations.
  // This cannot pass simply because expected identity was missing/malformed.
  assert.doesNotThrow(() => preservationIdentity(f.trial, f.expected));
  for (const id of ["G1", "G2", "G3"])
    f.trial[`public${id}`] = gate(receipt, id).verdict;
  assert.throws(() => preservationIdentity(f.trial, f.expected));
  assert.throws(() =>
    collectPreservationPackage(f.trial, f.expected, "MUST_NOT_READ_SOURCE"),
  );
}
for (const fault of FIRST_STEP_FAULTS) {
  test(`MMP104 ${fault}: initial SQLite only, ERROR parity, aggregate G1 incomplete`, async (t) => {
    const r = await runSyntheticControl(temporary(t), fault);
    assert.equal(gate(r.receipt, "G1").verdict, "INCONCLUSIVE");
    assert.deepEqual(gate(r.receipt, "G1").findingCodes, ["BUILD_NOT_RUN"]);
    assert.deepEqual(gate(r.receipt, "G1").executedTestIds, [
      "workshop-business:typecheck",
      "workshop-business:build",
    ]);
    assert.equal(r.receipt.pairs[0].compilerDiagnostics.g1Verdict, "PASS");
    for (const id of ["G2", "G3"]) {
      assert.equal(gate(r.receipt, id).verdict, "ERROR");
      assert.deepEqual(gate(r.receipt, id).findingCodes, ["VERIFIER_ERROR"]);
    }
    assert.deepEqual(r.receipt.coverage, {
      http: 0,
      sqlite: 1,
      requiredHttp: 17,
      requiredSqlite: 20,
    });
    assert.deepEqual(r.closed, ["candidate", "reference"]);
    assert.equal(r.pendingOperations, 0);
    assert.equal(r.receipt.pairs[0].cleanup, "VERIFIED_ZERO_RESOURCES");
    assertPartialRefused(r.receipt);
    assert.doesNotMatch(
      JSON.stringify(r),
      /SYNTHETIC_PRIVATE_TEXT_MUST_NOT_BE_PUBLISHED|stack|stderr|bodyBase64/,
    );
    const expectedStage =
      fault.startsWith("reference-request") ||
      fault.startsWith("reference-transport") ||
      fault.startsWith("reference-timeout")
        ? "REFERENCE_REQUEST"
        : fault.startsWith("candidate-request") ||
            fault.startsWith("candidate-transport") ||
            fault.startsWith("candidate-timeout")
          ? "CANDIDATE_REQUEST"
          : "UNCLASSIFIED_TRUSTED_PIPELINE";
    assert.equal(r.stage.primary.stage, expectedStage);
    assert.equal(
      r.stage.primary.category,
      fault.endsWith("timeout")
        ? "SIGNAL_ABORTED"
        : expectedStage === "UNCLASSIFIED_TRUSTED_PIPELINE"
          ? "UNKNOWN"
          : "OPERATION_REJECTED",
    );
  });
}
for (const fault of EARLY_FAULTS) {
  test(`MMP104 ${fault}: does not falsely count an initial snapshot`, async (t) => {
    const r = await runSyntheticControl(temporary(t), fault);
    assert.deepEqual(r.receipt.coverage, {
      http: 0,
      sqlite: 0,
      requiredHttp: 17,
      requiredSqlite: 20,
    });
    assert.equal(gate(r.receipt, "G2").verdict, "ERROR");
    assert.equal(gate(r.receipt, "G3").verdict, "ERROR");
    assert.deepEqual(r.closed, ["candidate", "reference"]);
  });
}
test("MMP104 failed initial diff write cannot pass publication as the historical 0/1 receipt", async (t) => {
  await assert.rejects(
    runSyntheticControl(temporary(t), "initial-diff-write"),
    { code: "EVIDENCE_ERROR" },
  );
});
test("MMP104 successful single pair does not become full-migration PASS or export", async (t) => {
  const r = await runSyntheticControl(temporary(t), "none");
  assert.deepEqual(r.receipt.coverage, {
    http: 6,
    sqlite: 7,
    requiredHttp: 17,
    requiredSqlite: 20,
  });
  for (const id of ["G0", "G1", "G2", "G3", "G4"])
    assert.equal(gate(r.receipt, id).verdict, "INCONCLUSIVE");
  assert.equal(r.stage.primary, null);
  assertPartialRefused(r.receipt);
});
test("MMP104 cleanup fault takes precedence, retaining primary stage separately", async (t) => {
  const r = await runSyntheticControl(temporary(t), "reference-request", true);
  for (const id of ["G1", "G2", "G3"]) {
    assert.equal(gate(r.receipt, id).verdict, "ERROR");
    assert.ok(gate(r.receipt, id).findingCodes.includes("CLEANUP_ERROR"));
  }
  assert.equal(r.stage.primary.stage, "REFERENCE_REQUEST");
  assert.deepEqual(r.stage.cleanupFailures, ["CANDIDATE_CLOSE"]);
  assertPartialRefused(r.receipt);
});
test("MMP104 stage prototype ignores hostile exception getters and seals late completions", async () => {
  const trace = createStagePrototype();
  const hostile = Object.create(null, {
    code: {
      get() {
        throw new Error("DO_NOT_READ");
      },
    },
    message: {
      get() {
        throw new Error("DO_NOT_READ");
      },
    },
  });
  await assert.rejects(
    trace.observe("REFERENCE_REQUEST", null, async () => {
      throw hostile;
    }),
    (e) => e === hostile,
  );
  let release;
  const late = trace.observe(
    "CANDIDATE_REQUEST",
    null,
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const receipt = trace.finish(true);
  const frozen = JSON.stringify(receipt);
  release({ stage: "FAKE_CANDIDATE_PASS", secret: "NOT_EXPORTED" });
  await late;
  assert.equal(JSON.stringify(trace.finish(true)), frozen);
  assert.equal(receipt.primary.stage, "REFERENCE_REQUEST");
  assert.throws(() => trace.wrap("UNTRUSTED", {}));
  assert.ok(Object.isFrozen(receipt));
  assert.ok(Buffer.byteLength(frozen) < 512);
});
test("MMP104 trusted internal checkpoints classify comparator faults without error text", async () => {
  const trace = createStagePrototype();
  await assert.rejects(
    trace.observe("HTTP_COMPARE", null, async () => {
      throw new Error("RAW_SQL_HTTP_SECRET");
    }),
  );
  const receipt = trace.finish(true);
  assert.equal(receipt.primary.stage, "HTTP_COMPARE");
  assert.doesNotMatch(JSON.stringify(receipt), /RAW_SQL_HTTP_SECRET/);
});
test("MMP104 artifact inspector rejects altered bytes and CLI hides input paths", (t) => {
  const root = temporary(t);
  writeFileSync(join(root, "public.zip"), Buffer.alloc(4884));
  assert.throws(() => inspectIncident(root), /INCIDENT_PUBLIC_INPUT_REJECTED/);
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL(
          "../../../research/mmp-104/inspect-incident.mjs",
          import.meta.url,
        ),
      ),
      join(root, "DO_NOT_PRINT_INPUT_PATH"),
    ],
    { encoding: "utf8", timeout: 5000 },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr.trim(), "INCIDENT_PUBLIC_INPUT_REJECTED");
});
test("MMP104 production preserver refuses partial G1 before source read, age or Docker", {
  skip:
    process.platform !== "linux"
      ? "Actual preserver isolated CLI is Linux-only"
      : false,
}, async (t) => {
  const root = temporary(t);
  mkdirSync(join(root, "meta-paid-public"), { mode: 0o700 });
  for (const [publicG1, publicG2, publicG3] of [
    ["INCONCLUSIVE", "ERROR", "ERROR"],
    ["ERROR", "ERROR", "ERROR"],
    ["NOT_RUN", "NOT_RUN", "NOT_RUN"],
    ["PASS", "ERROR", "FAIL"],
    ["PASS", "PASS", "INCONCLUSIVE"],
  ]) {
    const isolatedRoot = join(root, `${publicG1}-${publicG2}-${publicG3}`);
    mkdirSync(join(isolatedRoot, "meta-paid-public"), {
      recursive: true,
      mode: 0o700,
    });
    writeFileSync(
      join(isolatedRoot, "meta-paid-public/trial.json"),
      JSON.stringify({
        modelGeneration: "GENERATED",
        publicG1,
        publicG2,
        publicG3,
      }),
      { mode: 0o600 },
    );
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(
          new URL("../../../research/mmp-089/preserve.mjs", import.meta.url),
        ),
        "--isolated",
      ],
      {
        cwd: "/",
        env: {
          PATH: "/nonexistent",
          HOME: "/nonexistent",
          RUNNER_TEMP: isolatedRoot,
        },
        encoding: "utf8",
        timeout: 5000,
      },
    );
    assert.equal(result.status, 0);
    assert.equal(result.signal, null);
    const record = JSON.parse(
      readFileSync(
        join(isolatedRoot, "meta-paid-public/preservation.json"),
        "utf8",
      ),
    );
    assert.equal(record.status, "NOT_APPLICABLE");
    assert.equal(record.identity, null);
    assert.equal(record.ciphertextSha256, null);
    assert.equal(record.ciphertextBytes, null);
    assert.equal(record.upload, "NOT_RUN");
  }
});
