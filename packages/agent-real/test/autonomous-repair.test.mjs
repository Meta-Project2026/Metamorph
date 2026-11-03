import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import https from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";
import {
  planSyntheticRepair,
  publicRepairDecision,
  runSyntheticAutonomousRepair,
} from "../src/autonomous-repair.mjs";
import { requireMigrationMode } from "../src/autonomous-repair-policy.mjs";
import { authorizePaidWorkflow } from "../src/meta-paid-authorization.mjs";
import {
  changes,
  clean,
  context,
  syntheticCustody,
  syntheticVerification,
  TEST_HEAD,
  TEST_TIME,
  wireReply,
} from "./autonomous-repair-fixture.mjs";
import { offlinePaid } from "./custody-fixture.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
function harness(t, overrides = {}) {
  t.mock.method(Date, "now", () => TEST_TIME);
  const parent = mkdtempSync(join(tmpdir(), "mmp151-synthetic-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const bodies = [],
    sources = [],
    events = [];
  const options = {
    context: context(),
    parent,
    runId: randomUUID(),
    headSha: TEST_HEAD,
    transport: async ({ body }) => {
      bodies.push(JSON.parse(body));
      events.push("send");
      return wireReply(changes(bodies.length));
    },
    custody: async (v) => {
      sources.push(v.candidateRoot);
      events.push("custody");
      return syntheticCustody(v);
    },
    verify: async (v) => {
      events.push("verify");
      return syntheticVerification(v.candidateSha, v.attempt === 1);
    },
    cleanup: async () => {
      events.push("cleanup");
      return clean();
    },
    ...overrides,
  };
  return {
    options,
    bodies,
    sources,
    events,
    run: () => runSyntheticAutonomousRepair(options),
  };
}
test("two synthetic sends bind complete own changes and public codes; separate candidates and monotonic ledger", async (t) => {
  const h = harness(t),
    r = await h.run();
  assert.equal(r.status, "SYNTHETIC_PUBLIC_PASS");
  assert.equal(r.simulatedRequests, 2);
  assert.equal(r.repairs, 1);
  assert.equal(r.paidRequests, 0);
  assert.equal(r.completedOracleVerifications, 2);
  assert.equal(r.product, "NOT_ESTABLISHED");
  assert.equal(r.G4, "INCONCLUSIVE");
  assert.equal(r.chargedCostUsd, null);
  assert.equal(r.pendingExposureUsd, r.reservedEstimatedUsd);
  assert.ok(
    r.reservedEstimatedUsd <= 1 && r.reservedEstimatedUsd > r.estimatedCostUsd,
  );
  assert.deepEqual(h.events, [
    "send",
    "custody",
    "verify",
    "send",
    "custody",
    "verify",
    "cleanup",
  ]);
  const repair = JSON.parse(h.bodies[1].messages[1].content);
  assert.equal(repair.action, "repair");
  assert.deepEqual(repair.repairCodes, ["HTTP_JSON_TYPE"]);
  assert.deepEqual(repair.previousGeneratedChanges, changes(1));
  assert.notEqual(h.sources[0], h.sources[1]);
  assert.notEqual(r.candidates[0], r.candidates[1]);
  assert.equal(
    readFileSync(join(h.sources[0], "src/main.ts"), "utf8"),
    changes(1)[0].content,
  );
  assert.notEqual(r.receipts[0].nonce, r.receipts[1].nonce);
  const ledger = join(h.options.parent, `mmp151-${h.options.runId}`);
  assert.equal(
    JSON.parse(readFileSync(join(ledger, "send-2.json"))).status,
    "UNKNOWN",
  );
  assert.equal(readdirSync(ledger).filter((f) => /^send-/.test(f)).length, 2);
  const rerun = await h.run();
  assert.equal(rerun.code, "RUN_ALREADY_CLAIMED");
  assert.equal(h.bodies.length, 2);
  assert.doesNotMatch(
    JSON.stringify(r),
    /syntheticOnly|candidateRoot|SELECT|private-value|manual derivative/i,
  );
});
test("first success skips repair; second failure stops without third send", async (t) => {
  for (const fail of [false, true]) {
    const h = harness(t, {
      verify: async (v) => syntheticVerification(v.candidateSha, fail),
    });
    const r = await h.run();
    assert.equal(r.simulatedRequests, fail ? 2 : 1);
    assert.equal(
      r.status,
      fail ? "SYNTHETIC_PUBLIC_FAIL" : "SYNTHETIC_PUBLIC_PASS",
    );
    assert.equal(r.pendingExposureUsd, r.reservedEstimatedUsd);
  }
});
test("projection is aggregate, exact generation plus bounded repair, never a charged guarantee", (t) => {
  const h = harness(t),
    p = planSyntheticRepair(h.options.context);
  assert.equal(p.reservedNanos, p.reservations[0] + p.reservations[1]);
  assert.ok(p.reservedNanos <= 1e9);
  for (const budget of [0, null, NaN, Infinity, 2, p.reservations[0] / 1e9])
    assert.throws(() => planSyntheticRepair(context(), budget), {
      code: "ESTIMATED_BUDGET_BLOCKED",
    });
  assert.throws(
    () => planSyntheticRepair(context(), 1, Date.parse("2026-11-05T00:00:00Z")),
    { code: "TARIFF_EXPIRED" },
  );
});
test("unknown/exhausted budget and expired tariff stop before transport", async (t) => {
  for (const budgetUsd of [null, 0.1]) {
    const h = harness(t, { budgetUsd });
    const r = await h.run();
    assert.equal(r.simulatedRequests, 0);
    assert.equal(h.events.length, 0);
  }
  const h = harness(t);
  t.mock.method(Date, "now", () => Date.parse("2026-11-06T00:00:00Z"));
  assert.equal((await h.run()).code, "TARIFF_EXPIRED");
  assert.equal(h.bodies.length, 0);
});
test("unknown usage, HTTP errors, malformed replies and transport ambiguity preserve liability without repair", async (t) => {
  for (const transport of [
    async () => {
      const r = wireReply();
      const b = JSON.parse(r.body);
      delete b.usage;
      return { ...r, body: JSON.stringify(b) };
    },
    async () => ({ ...wireReply(), status: 500 }),
    async () => ({ ...wireReply(), body: "{private-value" }),
    async () => {
      throw Error("Bearer private-value SQL SELECT * /private/path");
    },
  ]) {
    const h = harness(t, { transport }),
      r = await h.run();
    assert.equal(r.status, "ERROR");
    assert.equal(r.simulatedRequests, 1);
    assert.equal(r.oracleInvocations, 0);
    assert.ok(r.pendingExposureUsd > 0);
    assert.equal(r.estimatedCostUsd, null);
    assert.doesNotMatch(
      JSON.stringify(r),
      /private-value|Bearer|SELECT|\/private/,
    );
    assert.equal((await h.run()).code, "RUN_ALREADY_CLAIMED");
  }
});
test("oversized own changes exceed reserved repair envelope; no second send", async (t) => {
  const h = harness(t, {
    transport: async () =>
      wireReply([{ path: "src/main.ts", content: `//${"x".repeat(100000)}` }]),
  });
  const r = await h.run();
  assert.equal(r.code, "INPUT_LIMIT");
  assert.equal(r.simulatedRequests, 1);
});
test("missing feedback, G1 failure, wrong SHA, incomplete or stale receipts never progress", async (t) => {
  for (const mutate of [
    (v) => {
      v.attempts[0].gates[2].findingCodes = [];
      v.attempts[0].gates[3].findingCodes = [];
    },
    (v) => {
      v.attempts[0].gates[1].verdict = "FAIL";
      v.publicG1 = "FAIL";
    },
    (v) => {
      v.candidateSha = "b".repeat(64);
    },
    (v) => {
      v.attempts[0].coverage.http = 16;
    },
    (v) => {
      v.attempts[0].pairs[0].gates[0].executedTestIds.pop();
    },
    (v) => {
      v.cleanup.emergencyRemoved = 1;
    },
    (v) => {
      v.attempts[0].pairs[0].cleanup = "CLEANUP_ERROR";
    },
    (v) => {
      v.attempts[0].gates[2].findingCodes = ["raw SQL private-value"];
    },
  ]) {
    const h = harness(t, {
      verify: async (v) => {
        const out = syntheticVerification(v.candidateSha, true);
        mutate(out);
        return out;
      },
    });
    const r = await h.run();
    assert.equal(r.status, "ERROR");
    assert.equal(r.simulatedRequests, 1);
    assert.equal(r.completedOracleVerifications, 0);
    assert.doesNotMatch(JSON.stringify(r), /private-value/);
  }
});
test("feedback ignores private diagnostics, raw blockers and G0/G4 information", () => {
  const v = syntheticVerification("a".repeat(64), true);
  v.blockers = ["SQL private-value", "HELD_OUT_SECRET"];
  v.attempts[0].pairs[0].compilerDiagnostics = { raw: "private-value" };
  const d = publicRepairDecision(v, "a".repeat(64));
  assert.equal(d.feedback, "HTTP_JSON_TYPE");
  assert.doesNotMatch(JSON.stringify(d), /private-value|HELD_OUT/);
});
test("real Oracle per-pair G4 stays INCONCLUSIVE; missing or failed public controls block repair", () => {
  const sha = "a".repeat(64);
  const valid = syntheticVerification(sha, true);
  assert.ok(
    valid.attempts[0].pairs.every((p) => p.gates[2].verdict === "INCONCLUSIVE"),
  );
  assert.equal(publicRepairDecision(valid, sha).feedback, "HTTP_JSON_TYPE");
  for (const mutate of [
    (g) => {
      g.executedTestIds.pop();
    },
    (g) => {
      g.verdict = "FAIL";
      g.findingCodes = ["CONTROL_FAILURE"];
    },
    (g) => {
      g.verdict = "PASS";
      g.findingCodes = [];
    },
    (g) => {
      g.findingCodes = ["HELD_OUT_NOT_RUN", "CONTROL_FAILURE"];
    },
  ]) {
    const invalid = syntheticVerification(sha, true);
    mutate(invalid.attempts[0].pairs[0].gates[2]);
    assert.throws(() => publicRepairDecision(invalid, sha), {
      code: "VERIFICATION_INCOMPLETE",
    });
  }
});
test("corrupt ciphertext, missing ack, wrong custody SHA and cleanup failure block Oracle", async (t) => {
  for (const mutate of [
    (s) => {
      s.readback[0] ^= 1;
    },
    (s) => {
      s.acknowledged = false;
    },
    (s) => {
      s.candidateSha = "b".repeat(64);
    },
    (s) => {
      s.cleanup = "CLEANUP_ERROR";
    },
    (s) => {
      s.attempt = 3;
    },
  ]) {
    const h = harness(t, {
      custody: async (v) => {
        const s = syntheticCustody(v);
        mutate(s);
        return s;
      },
    });
    const r = await h.run();
    assert.equal(r.code, "CUSTODY_FAILED");
    assert.equal(r.oracleInvocations, 0);
  }
});
test("candidate mutation during custody is rejected by SHA admission", async (t) => {
  const h = harness(t, {
    custody: async (v) => {
      const s = syntheticCustody(v);
      writeFileSync(join(v.candidateRoot, "src/main.ts"), "private-value");
      return s;
    },
  });
  const r = await h.run();
  assert.equal(r.status, "ERROR");
  assert.equal(r.oracleInvocations, 0);
});
test("final cleanup failure overrides public success", async (t) => {
  const h = harness(t, {
    cleanup: async () => ({ ...clean(), emergencyRemoved: 1 }),
  });
  const r = await h.run();
  assert.equal(r.code, "CLEANUP_ERROR");
  assert.equal(r.status, "ERROR");
});
test("late response cannot write candidate, repair or overwrite timed out outcome", async (t) => {
  let finish;
  const h = harness(t, {
    timeoutMs: 10,
    transport: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const r = await h.run(),
    before = JSON.stringify(r);
  assert.equal(r.code, "TIMEOUT");
  assert.equal(r.simulatedRequests, 1);
  finish(wireReply());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(JSON.stringify(r), before);
  assert.equal(r.candidates.length, 0);
  assert.equal((await h.run()).code, "RUN_ALREADY_CLAIMED");
});
test("cancelled possible send retains claim and independent cleanup signal", async (t) => {
  const controller = new AbortController();
  const h = harness(t, {
    signal: controller.signal,
    transport: async () => {
      controller.abort();
      return wireReply();
    },
    cleanup: async (s) => {
      assert.equal(s.aborted, false);
      return clean();
    },
  });
  const r = await h.run();
  assert.equal(r.code, "CANCELLED");
  assert.equal(r.simulatedRequests, 1);
  assert.equal(r.cleanup, "VERIFIED_ZERO_RESOURCES");
});
test("concurrent claim and partial crash record refuse redispatch", async (t) => {
  const h = harness(t),
    results = await Promise.all([h.run(), h.run()]);
  assert.equal(
    results.filter((r) => r.code === "RUN_ALREADY_CLAIMED").length,
    1,
  );
  assert.equal(h.bodies.length, 2);
  const other = harness(t);
  mkdirSync(join(other.options.parent, `mmp151-${other.options.runId}`));
  assert.equal((await other.run()).code, "RUN_ALREADY_CLAIMED");
  assert.equal(other.bodies.length, 0);
});
test("actual child process crash after dispatch cannot restart the same run", async (t) => {
  const h = harness(t);
  const moduleUrl = new URL("../src/autonomous-repair.mjs", import.meta.url)
    .href;
  const fixtureUrl = new URL("./autonomous-repair-fixture.mjs", import.meta.url)
    .href;
  const script = `import {runSyntheticAutonomousRepair} from ${JSON.stringify(moduleUrl)};
    import {context,TEST_TIME,TEST_HEAD,clean} from ${JSON.stringify(fixtureUrl)};
    Date.now=()=>TEST_TIME;
    await runSyntheticAutonomousRepair({context:context(),parent:process.argv[1],runId:process.argv[2],headSha:TEST_HEAD,
      transport:()=>process.exit(73),custody:()=>{},verify:()=>{},cleanup:async()=>clean()});`;
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script, h.options.parent, h.options.runId],
    {
      env: { SystemRoot: process.env.SystemRoot ?? "" },
      encoding: "utf8",
      timeout: 15000,
    },
  );
  assert.equal(child.status, 73, child.stderr);
  const ledger = join(h.options.parent, `mmp151-${h.options.runId}`);
  assert.equal(
    JSON.parse(readFileSync(join(ledger, "send-1.json"))).status,
    "UNKNOWN",
  );
  assert.equal((await h.run()).code, "RUN_ALREADY_CLAIMED");
  assert.equal(h.bodies.length, 0);
});
test("production opt-in never trusts YAML/env/CLI cap claims and leaves legacy default", async (t) => {
  t.mock.method(https, "request", () => assert.fail("native send forbidden"));
  t.mock.method(globalThis, "fetch", () => assert.fail("network forbidden"));
  requireMigrationMode();
  requireMigrationMode("single_generation");
  for (const value of [
    "autonomous_repair",
    "true",
    null,
    { providerHardCap: 1 },
    "single_generation --repair",
  ])
    assert.throws(() => requireMigrationMode(value));
  const yaml = parseDocument(
    readFileSync(
      join(root, ".github/workflows/meta-paid-migration.yml"),
      "utf8",
    ),
  ).toJS();
  assert.equal(
    yaml.on.workflow_dispatch.inputs.execution_mode.default,
    "single_generation",
  );
  assert.ok(
    yaml.on.workflow_dispatch.inputs.execution_mode.options.includes(
      "autonomous_repair",
    ),
  );
  assert.equal(yaml.jobs["generate-and-verify"].needs, "guard");
  const cli = spawnSync(
    process.execPath,
    [
      join(root, "research/mmp-151/preflight.mjs"),
      "--provider-hard-cap=1",
      "--approve",
      "--estimated-only",
    ],
    {
      env: {
        SystemRoot: process.env.SystemRoot ?? "",
        MMP151_APPROVED: "true",
        PROVIDER_HARD_CAP_USD: "1",
      },
      encoding: "utf8",
      timeout: 15000,
    },
  );
  assert.equal(cli.status, 1);
  assert.equal(JSON.parse(cli.stdout).status, "BLOCKED_BUDGET_GUARANTEE");
  assert.equal(JSON.parse(cli.stdout).paidRequests, 0);
});
test("even genuine signed legacy admission cannot authorize opt-in repair via event selection", async (t) => {
  const h = harness(t);
  const fixture = await offlinePaid(t, h.options.parent);
  const event = JSON.parse(
    readFileSync(fixture.values.GITHUB_EVENT_PATH, "utf8"),
  );
  event.inputs.execution_mode = "autonomous_repair";
  event.inputs.provider_hard_cap_usd = "1.00";
  event.inputs.independent_review = "approved";
  writeFileSync(fixture.values.GITHUB_EVENT_PATH, JSON.stringify(event));
  t.mock.method(globalThis, "fetch", () =>
    assert.fail("guard must precede metadata/OIDC network"),
  );
  await assert.rejects(authorizePaidWorkflow(fixture.context), {
    code: "BLOCKED_BUDGET_GUARANTEE",
  });
  assert.equal(fixture.calls.length, 0);
});
