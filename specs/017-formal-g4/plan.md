# Follow-up implementation plan (not authorized by this PR)

Five focused future engineering slices; do not create a broad task framework or
dozens of issues. Complexity is relative implementation/review risk, not a time
estimate. Work begins only after both-owner scope/architecture decision and the
separate authorization required by Issue #38. Hidden material never enters an
engineering agent's context. Use public/synthetic data for implementation checks.

| Slice / accountable role | Minimal deliverable and reuse | Acceptance evidence | Dependencies / complexity |
| --- | --- | --- | --- |
| 1. Registration and epoch journal / E, R review | Thin trusted registration layer around existing candidate admission and persisted freeze; separate private pool index and public blinded commitment; immutable version/selection/attempt records | Synthetic ordering/tamper/exposure/SHA/duplicate/draw-grinding failures; one witnessed freeze/draw transcript; no caller seed | D1-D3/D5-D6; medium-high, primarily custody and canonical bytes |
| 2. Sealed private storage / E + storage custodian | Wrap PrivateEvidence and PairRegistry sealing; retain complete/partial per-pair packs; budget preflight, encrypted immutable storage adapter and independent restore/key recovery | Synthetic full catalogs under umask 022, #26 117-file acceptance for affected path, tamper/oversize/late-writer/interrupt controls, two-copy restore and deletion evidence | D4, registration identities; high, permissions/quotas/key recovery are main risks |
| 3. Formal runner / E; candidate owner supplies frozen bundle | New bounded orchestration composed from audit ordered adapters, isolated PHP/TS workers, unchanged verifyPair/HTTP/SQLite policies and independent finalizer; add actual G0 proof and real controls | Public/synthetic disposable Docker proof of exact binding, all registered steps, G0-G4 components, abort/partial evidence and zero normal resources; no private run on PR trigger | 1-2, #26/#34 disposition for reused paths; high, G0 completeness/escape and evidence lifecycle remain unproven |
| 4. Owner admission and final receipt / both owners | Outer authenticated acceptance record references existing strict GateResult/RunEvent and private pack roots; scope/profile/NOT_RUN/retention/attempt status; jointly authorized manual run | Synthetic decision-table cases reject missing gates/evidence and FAIL-to-PASS voting; concrete pending exact-run record independently reviewed | 1-3, D2/D6-D7; medium, authority and compatibility |
| 5. Independent readiness and qualification review / R + both owners | Public code/boundary review, restricted custody/storage review, then a separately authorized first hidden qualification; immutable final receipt and acceptance/refusal | Complete checklist B before dispatch and C after execution, actual recovery and profile attestation; no secret transferred to LLM | 1-4; high trust/review dependency, no run until both owners authorize |

Slices 1 and 2 can be developed against agreed synthetic interfaces. Runner and
acceptance integrate only their reviewed versions. Keep existing fast CI intact:
frozen install/lint/typecheck/unit/contract smoke/build. Expensive Docker/model
work stays manual and separately authorized. No new billable Meta calls are
needed for the G4 mechanism.

## Concrete reuse and required integration decisions

- Preserve `packages/contracts` strict schemas and existing public consumers.
  Store registration/custody/storage/acceptance metadata in a separate trusted
  envelope first; these documents are not an implemented schema. Both owners
  approve any eventual DTO change and backward-compatibility tests before coding.
- Reuse freeze-before-sampling ordering, admission digests, PairRegistry
  primary/secondary faults, late-writer revocation, isolated state inspection,
  PrivateEvidence and finalizer mechanics. Do not fork comparison semantics.
- Formal finite-pool registration is a future module. Existing
  `packages/workshop-audit/src/corpus.mjs` and historical sampled audit remain
  unchanged; no retrofit of private samples into this new registry.
- The current Oracle runner intentionally reports public/synthetic G4
  INCONCLUSIVE. A future separate formal orchestration result must cite new
  execution/custody/storage evidence; it must preserve the underlying G2/G3 and
  scoped G4 receipts rather than mutating them.
- #26 is a concrete retention helper/permissions dependency, not a reason to
  weaken bounds or rely on process umask. Name-based finalization needs a
  dedicated daemon and reviewed resource ownership; do not claim it detects
  every possible escape.
- #34 and later public provision/build ERRORs are environment reliability inputs,
  not diagnosed here. Before formal admission, independently resolve or record a
  justified owner/reviewer disposition of relevant path failures. An unknown
  error cannot be renamed a fix or waived out of the actual run.

## Principal risks and scope limits

G0 completeness and anti-replay are new proof work, not a flag to flip.
Two-person custody may be insufficient for the requested independence claim;
that blocks admission until appointments/access exist. Storage budgets differ
and base64 expands raw bytes; preflight must include failed paths. Encryption
without recoverable keys and complete indexes is insufficient. Old exposure or
hidden-result repair consumes the corpus and requires a fresh version. Finite
coverage cannot prove behavior outside registered units.

This PR does not fix any of these implementation gaps, create follow-up issues,
select a storage vendor or execute qualification. It supplies bounded proposals
for owner decisions and independent review.
