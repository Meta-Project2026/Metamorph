# Exact handoff for the unexecuted public experiment

**DOCKER_NOT_RUN.** This Windows host has no Docker executable and cannot provide
the required Linux x86_64 disposable isolation. No candidate/PHP was run on the
host. This document specifies future implementation; it is not a runnable probe
or evidence of runtime success. No workflow is added to dispatch unreviewed code.

## Public interfaces and constraints

The high-level `PhpReferenceWorker` constructor accepts only MANIFEST scenario
ids, and requestStep enforces exact frozen requests. `TargetOracleAdapter` calls
checkedScenarios, which accepts only byte-equivalent MANIFEST entries. Thus these
high-level adapters cannot accept the new corpus. Do not mutate/replace MANIFEST,
reuse its ids for different requests, patch the adapters, or disable validation.

The accepted **low-level** APIs support a separate host-only public experiment:

| Operation | Existing trusted API |
| --- | --- |
| PHP runtime before admission | Oracle provisionRuntime({command, directory, oracleRoot, signal, evidence}) with dockerCommand(PrivateEvidence) |
| PHP state/request/DB/cleanup | new DockerReferenceTransport(runtime, trackedCommand); reset(signal), http(request, signal), inspect(signal), close() |
| TS runtime before admission | buildTrustedRuntime(record) |
| Exact frozen bundle | admitDirectory(workshopFixtureDirectory, pins.candidateSha256) |
| TS state/request/DB/cleanup | new TargetWorker(runtime, bundle, "fixed-experiment", {profile: WORKSHOP_PROFILE}); provision(signal), request(stepId, method, path, body, signal), snapshot(stepId, signal), close() |
| Trusted mapping | mapTargetHttp(raw, stepId, requestId), mapTargetSnapshot(raw, identity, stepId), strictJson of original inspector command stdout |
| Trusted comparison | compareHttp(php.observation, targetObservation), compareSqlite(php.snapshot, targetSnapshot), unchanged oracle-exact-v1 |
| Resource ledger | Existing Resources tracking each PHP command's exact names and target runId; normal cleanup and final independent inventory |

This low-level route deliberately does not claim formal verifyPair/G4 admission.
All requestPolicy checks must execute before calling either transport. Nothing in
this work establishes EVALUATOR_ERROR_CONFIRMED or a shared-API change requirement.

## Bounded driver sequence for a future Docker host

1. Fresh disposable Linux amd64 checkout of the published PR head. Verify pins
   and raw recipe bytes **without normalization**. Linux checkout with LF must
   produce recipe `f09b12fe...`. Preserve 0700/0600 evidence outside the checkout;
   publish only the explicitly public fixture/observations after review.
2. Freeze `cases.public.json` SHA-256, head SHA and count table before comparison.
   Stop after these 14 cases; do not adapt or add cases based on any private audit.
   Prepare original trusted PHP and TS images before source admission, record
   measured image/toolchain/library/source/license identities. Validate both
   actual clock receipts; use fixed 2026-10-27 12:00:00 UTC and real monotonic time.
3. For each case create a **fresh** TargetWorker and DockerReferenceTransport.
   Track ownership before provision. PHP reset starts its service but does not
   initialize its DB: call unchanged BOOTSTRAP through the low-level transport,
   verify response 200 and the inspected `legacySha256 === SOURCE.initialSha256`.
   Target provision initializes its DB. Compare full initial snapshots (14 total).
4. For each declared request, sequentially capture PHP then TS HTTP, strict raw
   inspector identity and unchanged mapping, then compare HTTP. Capture both DB
   snapshots after that step and compare complete schema/rows/sequence. Record
   actual statuses/headers/typed JSON and first HTTP/DB differing step separately.
   There are 38 planned HTTP and 38 post-step DB comparisons. Bootstrap/control
   traffic is counted separately. An initial mismatch is a stop/error requiring
   investigation; do not silently include a dirty pair in later totals.
5. Use good-lifecycle as the real positive control. Corrupt only a copy of its
   public status observation to 503 for a deliberate HTTP_STATUS negative. Raw
   observation and unmodified comparison must independently support each result.
   If the positive control fails, investigate before classifying candidate cause.
6. Preserve unchanged target aggregate 180s deadline, 128 operations, 16 resets,
   per-operation bounds, 16MiB state limit and original PHP resource limits.
   Eight requests plus snapshots fit the operation count; actual elapsed time
   must be measured, never presumed. Set a bounded overall pilot deadline and
   signal handlers; await cancellation and worker cleanup on timeout/error.
7. Always close both workers in finally, with independent cleanup grace. Query
   actual owned container/volume inventory after every case and at the end.
   Record normal cleanup, emergencyRemoved and remaining resources independently.
   Any timeout, inspection, cleanup failure or emergency removal is ERROR for
   the affected procedure; empty final inventory does not erase earlier errors.
8. Separately report runtime FAIL (observed mismatch), ERROR (harness/environment),
   and NOT_RUN. Classification requires independent raw/control evidence. A
   public candidate mismatch does not establish the private audit's cause.

No automated Docker command is supplied because no such driver was implemented
or tested in this environment. A next small PR can add this isolated driver under
`research/mmp-044/`, using only these existing APIs, with no worker, comparator,
policy or workflow changes. Both owners review any later shared boundary or
candidate-fix proposal; this handoff asserts no such approval.
