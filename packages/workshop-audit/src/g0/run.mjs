import { setTimeout as delay } from "node:timers/promises";
import { validateBundle } from "../../../target-worker/src/admission.mjs";
import { challenge } from "./challenge.mjs";
import { G0Docker, requireAdmittedImage } from "./docker.mjs";
import { Evidence, verifyEvidence } from "./evidence.mjs";
import { finalizeLedger } from "./finalizer.mjs";
import {
  CONTROLS,
  candidateProvenance,
  check,
  digest,
  exactIds,
  freeze,
  identity,
  inspectSource,
  LIMITS,
  makeRunId,
  requireScope,
  safeCode,
} from "./policy.mjs";

const issued = new WeakSet();
const observations = new WeakMap();
const qualifications = new Map();
const runtimeKey = (i) =>
  digest({
    imageId: i.imageId,
    recipeSha: i.recipeSha,
    evaluatorSha: i.evaluatorSha,
  });
// Only live adapter observations of fixed public fixtures/mutants qualify an
// adapter. A supplied or historical JSON PASS cannot satisfy this boundary.
export async function qualifyAdapter(receipts) {
  const { syntheticCases } = await import("./synthetic.mjs");
  const fixtures = await syntheticCases();
  check(
    Array.isArray(receipts) && receipts.length === fixtures.length,
    "G0_CONTROL_FAILED",
  );
  const first = receipts[0]?.identity,
    key = runtimeKey(first ?? {});
  for (let n = 0; n < fixtures.length; n++) {
    const r = receipts[n],
      fixture = fixtures[n],
      observed = observations.get(r);
    check(
      issued.has(r) &&
        observed?.evidenceVerified === true &&
        observed?.verdict === fixture.verdict &&
        observed.fault === fixture.code &&
        r.identity.candidateSha === fixture.bundle.candidateSha &&
        runtimeKey(r.identity) === key &&
        r.evidenceVerified === true &&
        r.cleanup?.containers === 0 &&
        r.cleanup.volumes === 0 &&
        r.finalizer?.emergencyRemoved === 0,
      "G0_CONTROL_FAILED",
    );
  }
  const qualification = freeze({
    version: "g0-public-controls-v1",
    imageId: first.imageId,
    recipeSha: first.recipeSha,
    evaluatorSha: first.evaluatorSha,
    cases: fixtures.map((f, n) => ({
      id: f.id,
      candidateSha: f.bundle.candidateSha,
      runId: receipts[n].identity.runId,
      evidenceSha: receipts[n].evidence.sha256,
    })),
  });
  qualifications.set(key, qualification);
  return qualification;
}
export function consumePass(receipt, expectedIdentity) {
  check(
    issued.has(receipt) &&
      receipt.verdict === "PASS" &&
      observations.get(receipt)?.evidenceVerified === true &&
      receipt.qualification ===
        qualifications.get(runtimeKey(receipt.identity)) &&
      digest(receipt.identity) === digest(expectedIdentity),
    "G0_UNTRUSTED_RECEIPT",
  );
  issued.delete(receipt);
  return receipt;
}

const admissionFailures = new Set(["G0_FORBIDDEN_IMPORT", "G0_SOURCE_SYNTAX"]);
const behavioralFailures = new Set([
  "G0_CHALLENGE",
  "G0_DEFECT_REFERENCE",
  "G0_DEFECT_NETWORK",
  "G0_DEFECT_CORPUS",
  "G0_DEFECT_DOCKER",
]);
export function assess({
  controls,
  tests,
  scope,
  cleanup,
  finalizer,
  fault,
  faults = fault ? [fault] : [],
  evidence,
  evidenceVerified,
}) {
  // Evidence/cleanup faults take precedence without discarding the primary fault.
  if (
    !cleanup ||
    !finalizer ||
    cleanup.containers !== 0 ||
    cleanup.volumes !== 0 ||
    cleanup.emergencyRemoved !== 0 ||
    finalizer.containers !== 0 ||
    finalizer.volumes !== 0 ||
    finalizer.emergencyRemoved !== 0 ||
    !evidence ||
    evidenceVerified !== true ||
    faults.some(
      (code) => !admissionFailures.has(code) && !behavioralFailures.has(code),
    )
  )
    return "ERROR";
  if (faults.length) return "FAIL";
  try {
    exactIds(controls, CONTROLS);
    exactIds(tests, scope.testIds);
  } catch {
    return "INCONCLUSIVE";
  }
  return "PASS";
}

// No injected command, provider verdict, prior receipt, candidate-defined
// challenge, hidden pack or reference endpoint is accepted at this entrypoint.
export async function runG0(scope, bundle, output, signal) {
  requireScope(scope);
  const admitted = validateBundle(bundle.files, scope.candidateSha);
  const runId = makeRunId();
  const sink = new Evidence(output);
  const adapter = new G0Docker(runId, sink);
  adapter.save();
  const controls = [],
    tests = [],
    faults = [];
  let cleanup, finalizer, artifactSha, evidence;
  let evidenceVerified = false;
  const cancel = () => adapter.workAbort.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => {
    adapter.expired = true;
    cancel();
  }, LIMITS.lifetimeMs);
  try {
    check(!signal?.aborted, "G0_CANCELLED");
    check(process.platform === "linux", "G0_LINUX_REQUIRED");
    requireAdmittedImage(scope.imageId, scope.recipeSha);
    controls.push("scope");
    inspectSource(admitted);
    controls.push("source");
    sink.record("freeze", { identity: identity(scope, runId), scope });
    await adapter.health();
    await adapter.inspectImage(scope.imageId, scope.recipeSha);
    const artifacts = await adapter.build(admitted);
    artifactSha = digest(artifacts);
    controls.push("build", "isolation-build");
    await adapter.launch(artifacts);
    // A monotonic bounded readiness loop; failed probes remain in private trace.
    const readyUntil = performance.now() + 10000;
    while (true) {
      try {
        await adapter.request(
          scope.driver,
          "GET",
          scope.driver === "items-v1"
            ? "/items"
            : "/api.php?action=get_appointments",
        );
        break;
      } catch (e) {
        check(!adapter.exited, "G0_RUNTIME_EXIT");
        if (e.code !== "G0_ENVIRONMENT") throw e;
        check(performance.now() < readyUntil, "G0_TIMEOUT");
        await delay(100);
      }
    }
    controls.push("isolation-runtime", ...(await adapter.probes()));
    tests.push(
      ...(await challenge(scope.driver, (method, path, body) =>
        adapter.request(scope.driver, method, path, body),
      )),
    );
    controls.push("challenge");
    // Re-inspect the running namespace/process policy after the final challenge.
    await adapter.probes();
    check(!adapter.exited && artifactSha === digest(artifacts), "G0_IDENTITY");
  } catch (e) {
    faults.push(adapter.expired ? "G0_TIMEOUT" : safeCode(e));
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    try {
      cleanup = await adapter.close();
      controls.push("cleanup");
    } catch (e) {
      faults.push(safeCode(e) === "G0_INTERNAL" ? "G0_CLEANUP" : safeCode(e));
    }
    if (adapter.evidenceFailed) faults.push("G0_EVIDENCE");
    try {
      // Separate budget/descriptor/trace: exhausted or failed normal capture
      // must not disable the independent cleanup attempt.
      const independent = new Evidence(`${output}-finalizer`);
      let finalizerEvidence;
      try {
        finalizer = await finalizeLedger(output, independent, runId);
      } finally {
        try {
          finalizerEvidence = independent.seal();
          verifyEvidence(`${output}-finalizer`, finalizerEvidence);
        } catch {
          faults.push("G0_EVIDENCE");
          check(false, "G0_EVIDENCE");
        }
      }
      finalizer = { ...finalizer, evidence: finalizerEvidence };
      sink.write("finalizer.json", { runId, ...finalizer });
    } catch (e) {
      faults.push(safeCode(e) === "G0_EVIDENCE" ? "G0_EVIDENCE" : "G0_CLEANUP");
    }
    try {
      sink.record("completion", {
        controls,
        tests,
        faults,
        cleanup,
        finalizer,
      });
      evidence = sink.seal(["ledger.json", "finalizer.json"]);
      verifyEvidence(output, evidence);
      evidenceVerified = !faults.includes("G0_EVIDENCE");
    } catch {
      faults.push("G0_EVIDENCE");
    }
  }
  const fault = faults[0];
  const observedVerdict = assess({
    controls,
    tests,
    scope,
    cleanup,
    finalizer,
    fault,
    faults,
    evidence,
    evidenceVerified,
  });
  const qualification =
    qualifications.get(runtimeKey(identity(scope, runId))) ?? null;
  const verdict =
    observedVerdict === "PASS" && !qualification
      ? "INCONCLUSIVE"
      : observedVerdict;
  if (observedVerdict === "PASS" && !qualification)
    faults.push("G0_QUALIFICATION_REQUIRED");
  // This allowlisted envelope contains no paths, source, requests, logs, process
  // strings, challenge nonces, raw outputs or arbitrary candidate text.
  const receipt = freeze({
    identity: identity(scope, runId),
    verdict,
    status: verdict === "PASS" ? "G0_PASS" : `G0_${verdict}`,
    implementationStatus: "G0_IMPLEMENTATION_READY_PENDING_REVIEW",
    bounds: LIMITS,
    qualification,
    controls,
    tests,
    faults: [...new Set(faults)],
    artifactSha: artifactSha ?? null,
    cleanup: cleanup ?? null,
    finalizer: finalizer ?? null,
    evidence: evidence ?? null,
    evidenceVerified,
    candidateProvenance: candidateProvenance(scope.candidateSha),
    realCandidate: "NOT_RUN",
  });
  // Only verified completion gets live authority. An uncertain join can still
  // publish an ERROR, with no normal zero-cleanup claim or late writer access.
  try {
    sink.write("receipt.json", receipt);
    if (evidenceVerified) {
      verifyEvidence(output, evidence);
      verifyEvidence(`${output}-finalizer`, finalizer.evidence);
    }
  } catch {
    return freeze({
      ...receipt,
      verdict: "ERROR",
      status: "G0_ERROR",
      faults: [...receipt.faults, "G0_EVIDENCE"],
      realCandidate: "NOT_RUN",
      evidenceVerified: false,
    });
  }
  issued.add(receipt);
  observations.set(receipt, {
    verdict: observedVerdict,
    fault: fault ?? null,
    evidenceVerified,
  });
  return receipt;
}
