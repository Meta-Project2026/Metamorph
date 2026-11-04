// Isolated Node module mocks exercise the real run/receipt lifecycle. All Docker
// observations are trusted test data; no candidate or probe program runs here.
import assert from "node:assert/strict";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { mock } from "node:test";
import * as docker from "../src/g0/docker.mjs";
import {
  Evidence,
  readPrivateJson,
  validateLedger,
  verifyEvidence,
} from "../src/g0/evidence.mjs";
import * as policy from "../src/g0/policy.mjs";

const { G0Docker } = docker;

const zero = { containers: 0, volumes: 0, emergencyRemoved: 0 };
const runtime = {
  imageId: `sha256:${"a".repeat(64)}`,
  recipeSha: "a".repeat(64),
};
let fault = null,
  cleanupMs = policy.LIMITS.cleanupMs,
  stuck = false,
  backgroundCapture = false,
  finalizations = 0,
  release,
  active;
class ObservedDocker extends G0Docker {
  constructor(runId, sink) {
    super(runId, sink, {
      // Integrity controls use the normal bounded budget. Timeout controls
      // opt into their own tight deadline rather than constraining every run.
      cleanupMs,
      execute: (args) =>
        args[0] === "start"
          ? new Promise((resolve) => {
              release = resolve;
            })
          : Promise.resolve({ stdout: "", exitCode: 0 }),
    });
    active = this;
  }
  async health() {}
  async inspectImage() {}
  async build() {
    return [{ sha256: "c".repeat(64) }];
  }
  async launch() {
    if (backgroundCapture) this.call(["test-background"]).catch(() => {});
    if (stuck)
      this.call(["start", "test-only"], { timeoutMs: 10 }).catch(() => {});
  }
  async request() {
    return {};
  }
  async probes() {
    return [
      "filesystem",
      "php",
      "reference",
      "corpus",
      "docker",
      "spawn",
      "native",
      "network",
      "ipc",
      "process",
      "environment",
    ];
  }
}
mock.module("../src/g0/docker.mjs", {
  namedExports: {
    ...docker,
    G0Docker: ObservedDocker,
    requireAdmittedImage() {},
  },
});
mock.module("../src/g0/policy.mjs", {
  namedExports: {
    ...policy,
    check(value, code) {
      // This isolated observation model is portable; production still rejects
      // non-Linux hosts before executing any Docker/candidate operation.
      if (code !== "G0_LINUX_REQUIRED") policy.check(value, code);
    },
  },
});
mock.module("../src/g0/challenge.mjs", {
  namedExports: {
    async challenge(driver) {
      policy.check(!fault, fault);
      return policy.DRIVERS[driver].map((id) => `route-${id}`);
    },
  },
});
mock.module("../src/g0/finalizer.mjs", {
  namedExports: {
    async finalizeLedger(root, sink, expectedRunId) {
      const ledger = validateLedger(readPrivateJson(join(root, "ledger.json")));
      assert.equal(ledger.runId, expectedRunId);
      finalizations++;
      sink.record("independent-ledger-finalizer", { runId: ledger.runId });
      // A fresh exact-ledger adapter observes an empty Docker inventory.
      const adapter = new G0Docker(ledger.runId, sink, {
        owner: ledger.owner,
        execute: async () => ({ stdout: "", exitCode: 0 }),
      });
      adapter.ledger = ledger.resources;
      return adapter.finalize();
    },
  },
});
const { runG0, qualifyAdapter, consumePass } = await import(
  "../src/g0/run.mjs"
);
const { publicScope, syntheticCases } = await import("../src/g0/synthetic.mjs");
const fixtures = await syntheticCases();
async function inPrivateParent(fn) {
  const parent = mkdtempSync(join(tmpdir(), "g0-live-model-"));
  chmodSync(parent, 0o700);
  try {
    await fn(parent);
  } finally {
    stuck = false;
    cleanupMs = policy.LIMITS.cleanupMs;
    backgroundCapture = false;
    fault = null;
    rmSync(parent, { recursive: true, force: true });
  }
}
async function run(fixture, output) {
  fault = fixture.code;
  return runG0(
    publicScope(fixture.bundle, runtime, "b".repeat(40), fixture.driver),
    fixture.bundle,
    output,
  );
}
function corruptSeal(t, predicate) {
  const seal = Evidence.prototype.seal;
  t.mock.method(Evidence.prototype, "seal", function (...args) {
    const proof = seal.apply(this, args);
    if (predicate(this.root))
      writeFileSync(join(this.root, "trace.jsonl"), "corrupted");
    return proof;
  });
}
function advanceCleanupCapture(t, milliseconds) {
  const now = performance.now.bind(performance);
  const record = Evidence.prototype.record;
  let offset = 0;
  t.mock.method(performance, "now", () => now() + offset);
  t.mock.method(Evidence.prototype, "record", function (kind, value) {
    const result = record.call(this, kind, value);
    // Model a scheduler/fsync pause after the first normal inventory capture.
    // Keep real cleanup, evidence, deadline checks and finalization in the path.
    if (
      offset === 0 &&
      this === active.sink &&
      kind === "command" &&
      value?.args?.[0] === "container"
    )
      offset = milliseconds;
    return result;
  });
  return () =>
    assert.equal(offset, milliseconds, "cleanup delay was exercised");
}

test("behavioral failure followed by post-seal tamper is ERROR with both findings retained", async (t) => {
  await inPrivateParent(async (parent) => {
    const output = join(parent, "static");
    const delayed = advanceCleanupCapture(t, 50);
    const before = finalizations;
    corruptSeal(t, (root) => root === output);
    const receipt = await run(fixtures[1], output);
    delayed();
    assert.equal(receipt.verdict, "ERROR");
    assert.deepEqual(receipt.faults, ["G0_CHALLENGE", "G0_EVIDENCE"]);
    assert.deepEqual(receipt.cleanup, zero);
    assert.ok(receipt.controls.includes("cleanup"));
    assert.equal(finalizations, before + 1);
    assert.equal(receipt.evidenceVerified, false);
    assert.equal(
      JSON.parse(readFileSync(join(output, "receipt.json"))).verdict,
      "ERROR",
    );
  });
});
test("explicit tight cleanup deadline retains cleanup and evidence faults after delayed capture", async (t) => {
  await inPrivateParent(async (parent) => {
    cleanupMs = 25;
    const output = join(parent, "delayed");
    const delayed = advanceCleanupCapture(t, 50);
    const before = finalizations;
    corruptSeal(t, (root) => root === output);
    const receipt = await run(fixtures[1], output);
    delayed();
    assert.equal(receipt.verdict, "ERROR");
    assert.deepEqual(receipt.faults, [
      "G0_CHALLENGE",
      "G0_CLEANUP",
      "G0_EVIDENCE",
    ]);
    assert.equal(receipt.cleanup, null);
    assert.equal(receipt.evidenceVerified, false);
    assert.equal(finalizations, before + 1);
    assert.deepEqual(
      { ...receipt.finalizer, evidence: undefined },
      { ...zero, evidence: undefined },
    );
    assert.throws(
      () => consumePass(receipt, receipt.identity),
      /G0_UNTRUSTED_RECEIPT/,
    );
  });
});

test("qualification rejects a live negative control with failed capture integrity", async (t) => {
  await inPrivateParent(async (parent) => {
    corruptSeal(t, (root) => root === join(parent, "static"));
    const receipts = [];
    for (const fixture of fixtures)
      receipts.push(await run(fixture, join(parent, fixture.id)));
    await assert.rejects(() => qualifyAdapter(receipts), /G0_CONTROL_FAILED/);
  });
});
test("corrupted independent finalizer evidence cannot qualify a behavioral FAIL", async (t) => {
  await inPrivateParent(async (parent) => {
    corruptSeal(t, (root) => root.endsWith("-finalizer"));
    const receipt = await run(fixtures[1], join(parent, "static"));
    assert.equal(receipt.verdict, "ERROR");
    assert.equal(receipt.faults[0], "G0_CHALLENGE");
    assert.ok(receipt.faults.includes("G0_EVIDENCE"));
    assert.equal(receipt.evidenceVerified, false);
  });
});
test("failed receipt write revokes the live receipt and its evidence condition", async (t) => {
  await inPrivateParent(async (parent) => {
    const write = Evidence.prototype.write;
    t.mock.method(Evidence.prototype, "write", function (name, value) {
      policy.check(name !== "receipt.json", "G0_EVIDENCE");
      return write.call(this, name, value);
    });
    const receipt = await run(fixtures[1], join(parent, "static"));
    assert.equal(receipt.verdict, "ERROR");
    assert.equal(receipt.evidenceVerified, false);
    assert.ok(receipt.faults.includes("G0_CHALLENGE"));
    assert.ok(receipt.faults.includes("G0_EVIDENCE"));
    assert.throws(
      () => consumePass(receipt, receipt.identity),
      /G0_UNTRUSTED_RECEIPT/,
    );
  });
});
test("a swallowed background capture error still overrides the original behavioral fault", async (t) => {
  await inPrivateParent(async (parent) => {
    backgroundCapture = true;
    const record = Evidence.prototype.record;
    t.mock.method(Evidence.prototype, "record", function (kind, value) {
      policy.check(value?.args?.[0] !== "test-background", "G0_EVIDENCE");
      return record.call(this, kind, value);
    });
    const receipt = await run(fixtures[1], join(parent, "static"));
    assert.equal(receipt.verdict, "ERROR");
    assert.equal(receipt.faults[0], "G0_CHALLENGE");
    assert.ok(receipt.faults.includes("G0_EVIDENCE"));
    assert.equal(receipt.evidenceVerified, false);
  });
});
test("abort-ignoring work cannot block the separate ledger finalizer or mutate sealed evidence later", async () => {
  await inPrivateParent(async (parent) => {
    stuck = true;
    cleanupMs = 25;
    const before = finalizations;
    const output = join(parent, "stuck");
    let guard;
    try {
      const receipt = await Promise.race([
        run(fixtures[1], output),
        new Promise((resolve) => {
          guard = setTimeout(() => resolve("HUNG"), 500);
        }),
      ]);
      assert.notEqual(receipt, "HUNG");
      assert.equal(receipt.verdict, "ERROR");
      assert.deepEqual(receipt.faults, ["G0_CHALLENGE", "G0_CLEANUP"]);
      assert.equal(receipt.cleanup, null);
      assert.equal(receipt.evidenceVerified, true);
      assert.equal(finalizations, before + 1);
      assert.deepEqual(
        { ...receipt.finalizer, evidence: undefined },
        { ...zero, evidence: undefined },
      );
      release({ stdout: "late", exitCode: 0 });
      await new Promise((resolve) => setImmediate(resolve));
      verifyEvidence(output, receipt.evidence);
      await assert.rejects(() => active.call(["rm", "late"]), /G0_CANCELLED/);
      stuck = false;
      cleanupMs = policy.LIMITS.cleanupMs;
      const receipts = [];
      for (const fixture of fixtures)
        receipts.push(
          fixture === fixtures[1]
            ? receipt
            : await run(fixture, join(parent, fixture.id)),
        );
      await assert.rejects(() => qualifyAdapter(receipts), /G0_CONTROL_FAILED/);
    } finally {
      clearTimeout(guard);
    }
  });
});
test("verified live controls still qualify; copies have no authority and real provenance stays NOT_RUN", async () => {
  await inPrivateParent(async (parent) => {
    const receipts = [];
    for (const fixture of fixtures)
      receipts.push(await run(fixture, join(parent, fixture.id)));
    for (const receipt of receipts)
      assert.equal(receipt.evidenceVerified, true);
    await assert.rejects(
      () => qualifyAdapter(receipts.slice(1)),
      /G0_CONTROL_FAILED/,
    );
    await assert.rejects(
      () => qualifyAdapter(structuredClone(receipts)),
      /G0_CONTROL_FAILED/,
    );
    await qualifyAdapter(receipts);
    const receipt = await run(fixtures[0], join(parent, "qualified"));
    assert.equal(receipt.verdict, "PASS");
    assert.equal(receipt.realCandidate, "NOT_RUN");
    assert.throws(
      () =>
        consumePass(receipt, {
          ...receipt.identity,
          candidateSha: "f".repeat(64),
        }),
      /G0_UNTRUSTED_RECEIPT/,
    );
    assert.equal(consumePass(receipt, receipt.identity), receipt);
    assert.throws(
      () => consumePass(receipt, receipt.identity),
      /G0_UNTRUSTED_RECEIPT/,
    );
  });
});
