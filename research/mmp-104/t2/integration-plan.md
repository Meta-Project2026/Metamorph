# Gated production implementation plan

Status: **NOT IMPLEMENTED / JOINT APPROVAL PENDING**. This plan makes the proposed
production change reviewable without changing the shared interface prematurely.
The [v1 decision request](https://github.com/Meta-Project2026/Metamorph/issues/104#issuecomment-6561627815)
records Ilia's own sign-off only. Vladimir's explicit decision is still required.
Any different field, vocabulary or visibility requires a renewed bounded decision.

## Before and proposed after

Before: `VerificationResult` exposes evidenceDirectory, gateResults and public scope;
runPair returns trusted identity/build/gates/cleanup/sealed pack metadata; publicAttempt
projects an explicit allowlist. A broad verifier catch exposes VERIFIER_ERROR without
identifying the boundary. Nothing in this proposal changes that current behavior.

After joint approval: add one optional `failureTelemetry` metadata-only sidecar to
the trusted verifyPair result and the matching public pair. Keep GateResult and
VerificationReport schemas unchanged. A sample meaningful observation would be
`firstFailureStage=REFERENCE_REQUEST, failureCategory=OPERATION_REJECTED, stepIndex=0`
with exact trusted identity. This says the request boundary rejected, not that the
PHP application caused the failure. Missing telemetry is explicitly UNAVAILABLE;
neither telemetry nor its absence may change any gate or export decision.

## Exact bounded implementation slice

1. **Oracle-local typed module**, e.g. `packages/oracle/src/failure-telemetry.ts`,
   and minimal `src/index.ts` exports. Port the approved contract/recorder into
   production TypeScript with no imports from research and no new dependencies.
   Trusted host constructs the expected ID binding/public ordinal independently.
   Module-local provenance and immutable detached projection must survive the
   verifyPair-to-runtime handoff; no serialization/reconstruction may manufacture
   trust. Missing binding produces UNAVAILABLE, never replacement random IDs.
2. **`packages/oracle/src/runner.ts`**: wrap existing operations at literal trusted
   call sites. Worker reset/initial snapshot/request/step snapshot/close occur on
   both sides. Wrap structuredClone(request/observations), rawHttp serialization,
   compareHttp/compareSqlite and existing save/publication calls separately.
   Labels indicate boundaries; raw values are never passed to the recorder.
   Keep executedHttp/Db.push at their present position: HTTP count follows compare
   and precedes post-step DB snapshots; initial DB count follows its comparison.
   Do not move writes, comparisons or coverage increments to simplify telemetry.
   Per-step positions use trusted loop indices; reset/initial/close use null.
   Pair context uses global public MANIFEST ordinal even when verifyPair's local
   scenarios array contains only one scenario. Do not publish arbitrary scenario
   names or labels. Controls/initialization/publication are context-bound fixed
   stages; pre-context failures remain explicitly UNAVAILABLE rather than guessed.
3. Observe inside existing bounded callbacks, using the same AbortSignal and
   operation ordering. Synchronous internal stages retain synchronous capture.
   No fresh timeout/retry/extra execution path. Preserve original thrown value,
   broad fatal handling, cleanup-error precedence and both cleanup attempts.
   Observe final publication on the existing path; if publication itself rejects,
   preserve the exception/ERROR and mark the sidecar UNAVAILABLE/PUBLICATION_FAILED
   through trusted recorder ownership, rather than inventing a successful result.
   Telemetry defects must be nonthrowing and unable to prevent mandatory cleanup.
4. **`packages/agent-real/src/runtime.mjs`** minimal adapter: create binding from
   verified context/lease/attempt/pair/source, pass only trusted context to Oracle,
   and obtain the sealed sidecar before returning the pair. Preserve runPair's
   independent final cleanup, finish()/private sealing and provenance checks.
   Existing private diagnostic behavior is outside this slice; the new telemetry
   path must not inspect error.stack/code/message or broaden private/public output.
5. **`packages/agent-real/src/report.mjs`**: project the approved optional pair
   sidecar through its trusted projector with independent binding checks. Do not
   spread raw pair/worker objects. Strict bounded schema failure becomes unavailable,
   never suppressed gate ERROR or implied PASS. No telemetry enters aggregateAttempt,
   repairFeedback, model context, build diagnostics or export selectors.
6. Add focused package tests for actual internal checkpoints and publication handoff,
   all worker stages and known-good parity, exact before/after gate IDs/counts,
   exception identity/signal/order, simultaneous cleanup/parent abort/deadline,
   late completions, hostile keys/getters/proxies/lengths, wrong bindings and absent
   records. Verify partial G1 vs pair PASS, actual cleanup precedence and G4 firewall.
   Tests in this proposal prove the research contract, not production instrumentation.

## Publication and retention boundary

Current validator writes a reviewed public trial projection; prepare-upload checks a
fixed public artifact set. Preserve uses separate candidate-only eligibility and
private receipt selectors. Telemetry must stay within the already reviewed public
synthetic trial JSON, not create new exported files, candidate package members,
private pack paths or alternative retention eligibility. Re-audit exact allowlists
after the runtime/report change. If those consumers reject the approved sidecar or
require any schema/file/policy widening, stop at a concrete follow-up owner decision;
do not alter preserve/prepare-upload/retention under this contract. No age/key access
is needed for the offline schema/selector controls.

## Completion gate

The implementation slice remains gated even with green research tests/CI. Record
both attributable owner URLs first; implement only the approved contract; run frozen
install, lint/typecheck/test/build and targeted controls, research syntax/inventory.
Push and inspect Node22/24 CI for the exact PR head, then independent read-only
code/security review. No self-merge, model GET/POST, dispatch/validate_only, rerun,
actual candidate, source plaintext export or held-out execution. #105 budget, #107
custody and #108 Docker work remain separate. Production readiness and historical
root-cause discovery are not established by this proposal.
