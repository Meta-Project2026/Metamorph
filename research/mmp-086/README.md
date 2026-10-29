# MMP-086 — G1 diagnostic spike

Phase A only, 2026-10-29. [Issue #86](https://github.com/Meta-Project2026/Metamorph/issues/86).
**ROOT_CAUSE_UNKNOWN.** The original failure has not been repaired or recreated.
No Meta API GET/POST, paid request, workflow dispatch or workflow rerun is part of
this work. Product remains **NOT_ESTABLISHED**; G0/G4 remain INCONCLUSIVE.

## OBSERVED

The freshly fetched base main is
`3fb4772ef9c5d2c659530ae75b3076612eb18a3f`, unchanged from the task's starting
point. Original paid run
[40900698372](https://github.com/Meta-Project2026/Metamorph/actions/runs/40900698372)
at `d21376747c7147043ca618e149fac87c0df80111` produced candidate
`afd9f726bcbc2a9dfc2f67128871db307fbd00f2ba4febdc41b5633da98dad8f` in one
HTTP 200 `muse-spark-1.3` Standard inference, reasoning_effort=low.
attemptedRequests=1 and confirmedResponseCount=1. Provider usage was 5818 input /
9239 output tokens; estimated cost $0.04653825, settled charge UNKNOWN/null.
G1 FAIL / BUILD_FAILED at `workshop-business:typecheck`; G2/G3 INCONCLUSIVE,
0/17 HTTP and 0/20 SQLite. Cleanup was 0 containers / 0 volumes / 0 emergency
removals. This authorization is consumed.

Both original real artifact ZIP hashes match GitHub's identities. Neither ZIP
nor the original job log contains the generated TS or its compiler errors:
**ORIGINAL_CANDIDATE_UNAVAILABLE**, **ORIGINAL_COMPILER_ERRORS_UNAVAILABLE**.
The negative claim is limited to the examined authorized evidence; no assertion
is made about an undisclosed owner copy. No credentials or hidden G4 were searched.

The compiler actually uses strict TS 5.9.3, NodeNext/CommonJS without a package
manifest, and @types/node 22.20.5 with Node runtime 24.11.0. The prompt previously
omitted that module interpretation and types version. The small context patch
adds these facts, local import guidance, strict/SQLite narrowing and startup
constraints. It contains no target implementation or test answers.

All eight new actual paid-validator Docker controls passed: one positive with
17 HTTP / 20 SQLite comparisons, seven genuine compiler FAIL controls with safe
candidate-bound diagnostics and zero downstream coverage. The unchanged original
positive/defect/repair proof passed separately (51 HTTP / 60 SQLite; six runtime
controls). All normal worker inventories and the independent finalizer are 0/0/0.
Code-head Node22/24 Fast CI passed. Local and hosted evidence remain distinct;
the initial Linux harness umask error and corrected unchanged-test run are retained.

## HYPOTHESIS

Unnarrowed SQLite values, implicit-any parameters, unavailable modules, malformed
TS, top-level await or import.meta could cause G1 compilation failure. Independent
offline controls discriminate these classes. None identifies the historical
model candidate's actual error. A prompt clarification is a measured contract
change, not evidence that a future model follows it or that parity improves.

## UNKNOWN

Original precise TS error and source; actual settled charge; the next model's
output; provider acceptance of the changed request; global worker reliability
tracked separately in [#84](https://github.com/Meta-Project2026/Metamorph/issues/84).
Passing deterministic controls does not close that issue or establish product
acceptance. No independent ChatGPT review is claimed by this executor.

## NEXT TEST

See [offline-matrix.md](offline-matrix.md) for executed control results and
[compiler-contract-audit.md](compiler-contract-audit.md) for the compiler audit.
[paid-v2-decision.md](paid-v2-decision.md) sets the separate decision gate for
private diagnosis and any later one-request authorization. Current codes and
locations improve public observability, but the existing hosted workflow offers
no human source inspection after ephemeral runner cleanup. Do not spend again
until the review and private-data decision are concrete.

Exact original evidence and new request identities are in
[evidence-index.md](evidence-index.md). The public receipt directory contains
allowlisted metadata only; synthetic source expressions in reproduction scripts
are independently authored, not recovered model output. Existing positive
fixtures and MIT notices remain untouched. See [plan.md](plan.md) for scope.
