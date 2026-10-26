# MMP-003: bounded agent foundation

**Branch:** `feat/mmp-003-agent` from `081e1b999e2573d3897b2b0b00d444ecb799e140`.
**Owner:** Vladimir. **Acceptance:** [Issue #3](https://github.com/Meta-Project2026/Metamorph/issues/3).
Root constitution remains PROPOSED / PENDING OWNER RATIFICATION.

## Runnable slice

Implement a local orchestrator consuming existing contracts, with injected model,
candidate writer and trusted verifier ports. A scripted demo must execute initial
generation, failed verification, bounded repair, cascade escalation and synthetic
PASS. No public HTTP run API, real benchmark, Oracle implementation or model call.

## Requirements and acceptance scenarios

- R1: Validate configuration/manifest and emit schema-valid RunEvent entries with
  explicit lifecycle transitions and exactly one terminal state. Provider data
  cannot supply verdicts. PASS requires the trusted verifier's current-candidate
  results for all G0–G4 and every mandatory scenario. Incomplete evidence is
  INCONCLUSIVE; exceptions/deadline/cancellation are ERROR; proven mismatch FAIL.
- R2: Implement spark-only, wonder-only and cascade as policy labels. Generate
  every unit before whole-candidate verification. On FAIL, repair units in manifest
  order within each unit's total repair cap, then allow bounded spark-to-wonder
  escalation per unit. Repairs do not reset after escalation; no automatic retry
  on exceptions or incomplete evidence. All limits apply across the entire run.
- R3: Zero spend blocks every provider invocation. Paid requests need a trusted
  maximum request cost within remaining budget; unknown bounds block admission.
  Record unavailable usage as null. Missing paid accounting terminates
  INCONCLUSIVE; reported overspend/bound violation is ERROR. Synthetic providers
  are explicitly nonbillable and may have null accounting without blocking demo.
- R4: Model output contains only bounded source edits and usage, never verification
  reports. Write only src/**/*.ts inside a fresh candidate directory; reject
  traversal, absolute paths, protected names, links and duplicate paths. No host
  execution. Ports are trusted host code, not arbitrary candidate modules.
- R5: Deadline and caller cancellation cover provider, writer and verifier.
  Propagate AbortSignal; ignore late responses. Do not publish secrets, raw provider
  exceptions, source contents or held-out findings in the event journal/feedback.
- R6: Keep contracts, health semantics, Oracle-owned files, CI scope, governance
  and feature pointer unchanged. Add no live credentials, endpoints or model IDs.

Tests must cover first success, repair, escalation/fallback exhaustion, all limits,
zero budget/no call, provider errors/deadlines, late results, missing/untrusted
verdicts, multi-unit final verification and filesystem boundary attacks.

## Evidence and exclusions

Synthetic PASS is orchestration evidence, never product/Oracle acceptance. A real
verifier must independently execute/check coverage, isolation, controls and actual
evidence; this slice does not authenticate those facts. Live Meta configuration,
entitlements, pricing and authorized isolation remain separate integration work.
Commit, push and open an unmerged PR; report actual checks and remaining NOT_RUN.
