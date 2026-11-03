// PR153 review regression controls. Only original trusted synthetic child code.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  publicRepairDecision,
  runSyntheticAutonomousRepair,
} from "../src/autonomous-repair.mjs";
import { spawnJoinedProcess } from "../src/joined-process.mjs";
import {
  clean,
  context,
  syntheticCustody,
  syntheticVerification,
  TEST_HEAD,
  TEST_TIME,
  wireReply,
} from "./autonomous-repair-fixture.mjs";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function setup(t, overrides = {}) {
  t.mock.method(Date, "now", () => TEST_TIME);
  const parent = mkdtempSync(join(tmpdir(), "mmp151-review-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const options = {
    context: context(),
    parent,
    runId: randomUUID(),
    headSha: TEST_HEAD,
    transport: async () => wireReply(),
    custody: async (v) => syntheticCustody(v),
    verify: async (v) => syntheticVerification(v.candidateSha),
    cleanup: async () => clean(),
    stopGraceMs: 250,
    ...overrides,
  };
  return { parent, options, run: () => runSyntheticAutonomousRepair(options) };
}

for (const phase of ["custody", "verify"]) {
  test(`${phase} timeout joins operation before source release and cleanup`, async (t) => {
    const events = [];
    const h = setup(t, {
      custodyTimeoutMs: 10,
      oracleTimeoutMs: 10,
      [phase]: async (v) => {
        events.push("operation-start");
        await pause(70); // deliberately ignores abort
        events.push("operation-finished");
        return phase === "custody"
          ? syntheticCustody(v)
          : syntheticVerification(v.candidateSha);
      },
      cleanup: async () => {
        events.push("cleanup");
        return clean();
      },
    });
    const r = await h.run();
    await pause(90);
    assert.equal(r.code, "TIMEOUT");
    assert.ok(
      events.indexOf("cleanup") > events.indexOf("operation-finished"),
      `premature cleanup: ${events.join(",")}`,
    );
    assert.equal(r.simulatedRequests, 1);
    assert.equal(r.repairs, 0);
  });
}

test("non-cooperative child is killed and close joined before cleanup; no late write", async (t) => {
  let child,
    closed,
    cleanupWhileActive = false;
  const h = setup(t, { oracleTimeoutMs: 30, stopGraceMs: 1500 });
  const late = join(h.parent, "late-write");
  h.options.verify = async ({ registerResource }) => {
    child = spawn(
      process.execPath,
      [
        "-e",
        'const fs=require("fs");process.on("SIGTERM",()=>{});setTimeout(()=>fs.writeFileSync(process.argv[1],"late"),300);setInterval(()=>{},1000);',
        late,
      ],
      { env: { SystemRoot: process.env.SystemRoot ?? "" }, stdio: "ignore" },
    );
    closed = new Promise((resolve) => child.once("close", resolve));
    // Before the fix this callback argument is absent and the child outlives cleanup.
    registerResource?.({
      closed,
      stop: () => {
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 30).unref();
      },
    });
    await closed;
    throw Object.assign(new Error("CANCELLED"), { code: "CANCELLED" });
  };
  h.options.cleanup = async () => {
    cleanupWhileActive = child.exitCode === null && child.signalCode === null;
    return clean();
  };
  try {
    const r = await h.run();
    await pause(650);
    assert.equal(
      cleanupWhileActive,
      false,
      "cleanup ran while child was alive",
    );
    assert.equal(
      existsSync(late),
      false,
      "operation wrote after timeout/cleanup",
    );
    assert.equal(r.simulatedRequests, 1);
    assert.equal(r.repairs, 0);
  } finally {
    child?.kill("SIGKILL");
    await closed;
  }
});

test("unjoinable operation quarantines its lease and cannot claim verified cleanup", async (t) => {
  let finish,
    cleanupCalls = 0;
  const h = setup(t, {
    custodyTimeoutMs: 10,
    stopGraceMs: 20,
    custody: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    cleanup: async () => {
      cleanupCalls++;
      return clean();
    },
  });
  const r = await h.run(),
    snapshot = JSON.stringify(r);
  assert.equal(r.code, "OPERATION_UNSETTLED");
  assert.equal(r.cleanup, "UNVERIFIED_OPERATION_ACTIVE");
  assert.equal(cleanupCalls, 0);
  assert.equal(r.sourceLease, "QUARANTINED");
  finish(null);
  await pause(10);
  assert.equal(JSON.stringify(r), snapshot);
  assert.equal((await h.run()).code, "RUN_ALREADY_CLAIMED");
});
test("Linux process-group termination joins a non-cooperative grandchild before cleanup", {
  skip: process.platform !== "linux" ? "Linux process groups only" : false,
  timeout: 10000,
}, async (t) => {
  const h = setup(t),
    late = join(h.parent, "grandchild-late"),
    ready = join(h.parent, "grandchild-ready");
  const descendant =
    'const fs=require("fs");process.on("SIGTERM",()=>{});fs.writeFileSync(process.argv[1],"ready");setTimeout(()=>fs.writeFileSync(process.argv[2],"late"),600);setInterval(()=>{},1000);';
  const script =
    'const {spawn}=require("child_process");process.on("SIGTERM",()=>{});spawn(process.execPath,["-e",process.argv[1],process.argv[2],process.argv[3]],{stdio:"ignore"});setInterval(()=>{},1000);';
  const group = spawnJoinedProcess(
    process.execPath,
    ["-e", script, descendant, ready, late],
    {
      env: { PATH: "/usr/bin:/bin" },
      cwd: h.parent,
      killAfterMs: 30,
    },
  );
  try {
    for (let n = 0; n < 150 && !existsSync(ready); n++) await pause(10);
    assert.ok(existsSync(ready), "grandchild did not start");
    group.stop();
    const completion = await group.closed;
    assert.equal(completion.stopped, true);
    assert.equal(completion.signal, "SIGKILL");
    await pause(700);
    assert.equal(
      existsSync(late),
      false,
      "grandchild continued after group closure",
    );
  } finally {
    group.stop();
  }
});

const mutations = [
  [
    "pair build FAIL",
    (v) => {
      v.attempts[0].pairs[0].build = {
        gate: "G1",
        verdict: "FAIL",
        executedTestIds: ["workshop-business:typecheck"],
        findingCodes: ["BUILD_FAILED"],
      };
    },
  ],
  [
    "foreign pair candidate",
    (v) => {
      v.attempts[0].pairs[0].candidateSha = "b".repeat(64);
    },
  ],
  [
    "foreign pair attempt",
    (v) => {
      v.attempts[0].pairs[0].attemptId = randomUUID();
    },
  ],
  [
    "pair error",
    (v) => {
      v.attempts[0].pairs[0].errorCode = "ENVIRONMENT_ERROR";
    },
  ],
  [
    "attempt error",
    (v) => {
      v.attempts[0].errorCode = "ENVIRONMENT_ERROR";
    },
  ],
  [
    "absent build binding",
    (v) => {
      delete v.attempts[0].pairs[0].compilerDiagnostics;
    },
  ],
  [
    "foreign build binding",
    (v) => {
      v.attempts[0].pairs[0].compilerDiagnostics.candidateSha = "b".repeat(64);
    },
  ],
  [
    "G1 diagnostic contradiction",
    (v) => {
      v.attempts[0].pairs[0].compilerDiagnostics.g1Verdict = "FAIL";
    },
  ],
];
for (const [name, mutate] of mutations) {
  test(`receipt rejects ${name} for both public PASS and FAIL`, () => {
    for (const fail of [true, false]) {
      const v = syntheticVerification("a".repeat(64), fail);
      mutate(v);
      assert.throws(() => publicRepairDecision(v, v.candidateSha));
    }
  });
}
test("receipt rejects malformed/unknown build bindings and incomplete phase evidence", () => {
  const sha = "a".repeat(64);
  const mutatePair = [
    (p) => {
      p.compilerDiagnostics = null;
    },
    (p) => {
      p.compilerDiagnostics.format = "future-unverified-v9";
    },
    (p) => {
      p.compilerDiagnostics.sourceSha = "b".repeat(40);
    },
    (p) => {
      p.compilerDiagnostics.attemptId = randomUUID();
    },
    (p) => {
      p.compilerDiagnostics.pairId = randomUUID();
    },
    (p) => {
      p.compilerDiagnostics.entries.push({ raw: "private-SQL-HTTP-canary" });
    },
    (p) => {
      p.compilerDiagnostics.errorCount = 1;
    },
    (p) => {
      p.compilerDiagnostics.truncated = true;
    },
    (p) => {
      p.build = null;
    },
    (p) => {
      p.build = {
        gate: "G1",
        verdict: "PASS",
        executedTestIds: ["workshop-business:typecheck"],
        findingCodes: [],
      };
    },
    (p) => {
      p.errorCode = undefined;
    },
  ];
  for (const fail of [true, false]) {
    for (const mutate of mutatePair) {
      const v = syntheticVerification(sha, fail);
      mutate(v.attempts[0].pairs[0]);
      assert.throws(() => publicRepairDecision(v, sha));
    }
    const valid = syntheticVerification(sha, fail),
      a = valid.attempts[0];
    a.errorCode = null;
    for (const p of a.pairs) {
      Object.assign(p, {
        candidateSha: sha,
        attemptId: a.attemptId,
        errorCode: null,
        build: {
          gate: "G1",
          verdict: "PASS",
          executedTestIds: [
            `${p.scenarioId}:typecheck`,
            `${p.scenarioId}:build`,
          ],
          findingCodes: [],
        },
      });
    }
    assert.equal(
      publicRepairDecision(valid, sha).verdict,
      fail ? "FAIL" : "PASS",
    );
  }
});
test("contradictory pair build cannot reach second send or leak diagnostics", async (t) => {
  const h = setup(t, {
    verify: async (v) => {
      const r = syntheticVerification(v.candidateSha, true);
      mutations[0][1](r);
      r.attempts[0].pairs[0].build.privateRaw = "private-SQL-HTTP-canary";
      return r;
    },
  });
  const r = await h.run();
  assert.equal(r.status, "ERROR");
  assert.equal(r.simulatedRequests, 1);
  assert.equal(r.repairs, 0);
  assert.equal(r.completedOracleVerifications, 0);
  assert.doesNotMatch(JSON.stringify(r), /private-SQL-HTTP-canary/);
});
test("normal serialized public reports preserve G4 INCONCLUSIVE and complete coverage", () => {
  for (const fail of [true, false]) {
    const v = JSON.parse(
      JSON.stringify(syntheticVerification("a".repeat(64), fail)),
    );
    const d = publicRepairDecision(v, v.candidateSha);
    assert.equal(d.verdict, fail ? "FAIL" : "PASS");
    assert.equal(d.feedback, fail ? "HTTP_JSON_TYPE" : null);
    assert.ok(
      v.attempts[0].pairs.every((p) => p.gates[2].verdict === "INCONCLUSIVE"),
    );
  }
});
