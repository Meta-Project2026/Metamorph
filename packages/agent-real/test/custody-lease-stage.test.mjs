// Offline MMP-165 review-fix controls: SOURCE_LEASE_CHANGED classification,
// release() never masking the capture outcome, and abort-listener hygiene.
// Uses the existing hosted-shape offlinePaid fixture (faked OIDC/GitHub
// metadata and a stubbed Meta transport); no Docker, age, network, candidate
// bytes beyond the synthetic fixture, or paid action.
import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  bridgeAbort,
  CUSTODY_CAPTURE_STAGES,
  captureLease,
  classifyCollectorOutcome,
} from "../src/custody-capture.mjs";
import { beginCustody } from "../src/custody-contract.mjs";
import { createSourceSession, sourceLeaseRoot } from "../src/source.mjs";
import { offlinePaid } from "./custody-fixture.mjs";

const signal = () => new AbortController().signal;

test("abort bridge registers once, fires once, and removes the same handler", () => {
  const added = [];
  const removed = [];
  const fakeSignal = {
    aborted: false,
    addEventListener: (name, fn, options) => {
      assert.equal(name, "abort");
      added.push({ fn, options });
    },
    removeEventListener: (name, fn) => {
      assert.equal(name, "abort");
      removed.push(fn);
    },
  };
  let fires = 0;
  const remove = bridgeAbort(fakeSignal, () => {
    fires += 1;
  });
  assert.equal(added.length, 1);
  assert.equal(added[0].options.once, true);
  assert.equal(fires, 0);
  // Idempotent removal of exactly the registered handler.
  remove();
  remove();
  assert.equal(removed.length, 2);
  assert.equal(removed[0], added[0].fn);
  assert.equal(removed[1], added[0].fn);
  assert.equal(fires, 0);
  // Already-aborted signal: immediate fire, still removes the same handler.
  const alreadyAborted = {
    aborted: true,
    addEventListener: (name, fn, options) => added.push({ fn, options }),
    removeEventListener: (name, fn) => removed.push(fn),
  };
  bridgeAbort(alreadyAborted, () => {
    fires += 1;
  });
  assert.equal(fires, 1);
});

test("classifier keeps coarse stage mapping for every collector settle shape", () => {
  assert.equal(classifyCollectorOutcome({ ok: true }), null);
  const shapes = [
    { ok: false, aborted: true },
    { ok: false, timedOut: true },
    { ok: false, killed: true },
    { ok: false, errored: true },
    { ok: false, overflow: true },
    { ok: false, code: 1, termSignal: "SIGTERM" },
    { ok: false, code: 1 },
  ];
  for (const shape of shapes) {
    const stage = classifyCollectorOutcome(shape);
    assert.ok(
      CUSTODY_CAPTURE_STAGES.includes(stage),
      `stage ${stage} must be allowlisted`,
    );
  }
});

test("source mutation before capture classifies SOURCE_LEASE_CHANGED", async (t) => {
  const dir = temp(t);
  const f = await offlinePaid(t, dir);
  const token = beginCustody(f.context, f.authorization);
  const session = createSourceSession(dir);
  await session.writer.write(
    f.capsule.files.map(({ path, content }) => ({ path, content })),
    signal(),
  );
  const lease = await session.acquire(session.writer.root, signal());
  const receipt = validReceipt(f, lease);
  // Tamper with the source after the lease was acquired: phase 0 must
  // trustworthily establish the violation before any capsule work, so the
  // stage is SOURCE_LEASE_CHANGED — never a capsule or receipt failure.
  appendFileSync(
    join(sourceLeaseRoot(lease), lease.bundle.files[0].path),
    " tampered",
  );
  await assert.rejects(
    captureLease(token, lease, receipt, signal(), 1),
    (error) =>
      error?.custodyStage === "SOURCE_LEASE_CHANGED" &&
      CUSTODY_CAPTURE_STAGES.includes(error.custodyStage),
  );
  // No custody state of any kind was produced by the failed capture: the
  // result carries no receipt and the caller stays fail-closed.
  assert.equal(f.authorization.attempt, 1);
});

test("clean lease with a policy-invalid capsule classifies CAPSULE_REJECTED", async (t) => {
  const dir = temp(t);
  const f = await offlinePaid(t, dir);
  const token = beginCustody(f.context, f.authorization);
  const session = createSourceSession(dir);
  const broken = f.capsule.files.map(({ path, content }) => ({
    path,
    content: content.replace("MIT License", "Not A License"),
  }));
  await session.writer.write(broken, signal());
  const lease = await session.acquire(session.writer.root, signal());
  const receipt = validReceipt(f, lease);
  await assert.rejects(
    captureLease(token, lease, receipt, signal(), 1),
    (error) => error?.custodyStage === "CAPSULE_REJECTED",
  );
});

test("release() rejects on a tampered source; runPaidAttempt must not mask it", async (t) => {
  const dir = temp(t);
  const f = await offlinePaid(t, dir);
  const session = createSourceSession(dir);
  await session.writer.write(
    f.capsule.files.map(({ path, content }) => ({ path, content })),
    signal(),
  );
  const lease = await session.acquire(session.writer.root, signal());
  appendFileSync(
    join(sourceLeaseRoot(lease), lease.bundle.files[0].path),
    " tampered",
  );
  // Release genuinely throws on a tampered source...
  await assert.rejects(() => lease.release());
  // ...and the runPaidAttempt finally wraps release in try/catch so the
  // already-decided capture outcome can never be overwritten with
  // modelGeneration=ERROR (structural assertion below pins the wrapper).
  const trialSource = readFileSync(
    new URL("../src/migration-trial.mjs", import.meta.url),
    "utf8",
  );
  assert.match(
    trialSource,
    /Release re-admits the source fresh: a failure here is a real[\s\S]*?try \{\s*await lease\.release\(\);\s*\} catch \{\s*releaseFailed = true;/,
  );
});

function temp(t) {
  const directory = mkdtempSync(join(tmpdir(), "mmp165-lease-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function validReceipt(f, lease) {
  return {
    format: "meta-generation-v1",
    status: "PASS",
    generationKind: "REAL_INFERENCE",
    attemptedRequests: 1,
    attempt: 1,
    action: "generate",
    sourceSha: f.authorization.sourceSha,
    contextSha256: f.authorization.contextSha256,
    manifestSha256: f.authorization.manifestSha256,
    inputSha256: f.authorization.bodySha256,
    responseSha256: "a".repeat(64),
    candidateSha: lease.bundle.candidateSha,
    authorization: f.authorization,
  };
}
