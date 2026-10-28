# G4 acceptance checklist (proposed)

Each checked item requires an authenticated record or actual execution receipt.
These are deliberately unchecked: MMP-038 prepares a protocol, not an acceptance.
Use [decision-record.md](decision-record.md) to name owners and record decisions.

## A. G4_PROTOCOL_READY: both-owner protocol acceptance

- [ ] A1. Both Vladimir and Ilia explicitly accept the exact version of protocol,
  threat model, storage policy, this checklist and implementation plan; independent
  public review findings resolved. Root constitution remains separately pending.
- [ ] A2. Select LIMITED_TWO_PERSON with explicit claim limits, or require
  INDEPENDENT_CUSTODIAN and eligible appointments. Record candidate/corpus/chat/
  administrator exposure. No same-corpus author access may be waived.
- [ ] A3. Agree registration/selection/freeze ordering, mandatory coverage,
  outcome/finality rules, technical retry policy and fresh-version triggers.
- [ ] A4. Confirm the **already owner-reported agreed minimum 180-day retention
  and independent exact-byte restore by day 90** in an authenticated both-owner
  decision record. Separately choose concrete encrypted physical copies, distinct
  storage/key custodians, access/recovery and verified deletion procedures.
  Unknown implementation choices cannot count as readiness; D1/D2/D5 and
  D3/D6/D7 remain separate gates, not implied approvals.

This milestone approves a bounded protocol. It neither authorizes code changes
to shared APIs nor dispatches a formal evaluation.

## B. IMPLEMENTATION_READY and first-run authorization

- [ ] B1. Future authorized implementation independently reviewed at exact commits;
  protected comparator/candidate/corpus meanings preserved. Both owners approve
  any necessary shared API/runtime/contract change before it is implemented.
- [ ] B2. Synthetic registration tests reject exposure, invalid ordering, repeated
  draws, SHA swaps, missing/duplicate/extra IDs and modified commitments.
- [ ] B3. Synthetic storage tests prove full catalog under umask 022, admitted
  budgets, post-teardown tamper/link/permissions/late-write rejection, all-path
  partial failure retention, encrypted upload and independent restore/key recovery.
  #26 acceptance is satisfied for any reused affected path.
- [ ] B4. Public isolated worker controls prove real positive PASS, intentional
  negative FAIL with applied mutation, sandbox/timeout/cancel behavior and zero
  resources without emergency removal. Resolve or independently disposition #34
  and any later relevant build/provision instability before relying on that path.
- [ ] B5. Eligible E/R and storage principals appointed; real ACL/egress/mount
  denial checks pass. No shared-session or secret transfer into candidate/LLM.
- [ ] B6. Both owners accept the new benchmark registration: source/license,
  private ingestion/exposure review, scope/unit completeness, public/hidden split,
  pool commitment, fixed sampler/counts, budgets, version/epoch and allowed claim.
- [ ] B7. Verify source/fixture/evaluator/control/runtime digests and exact candidate
  Git/bundle/build inputs; freeze persists and is witnessed before one draw.
- [ ] B8. E records the one selection commitment before hidden execution and R
  checks its binding. Private entropy/cases remain outside Git/LLM/public logs.
- [ ] B9. Both owners issue explicit first-run authorization naming registration/
  epoch, exact candidate, implementation and bounded attempt/resource/storage
  budget; E dispatches only after B1-B8. Issue #38's dependency on acceptance of
  PR #31's scoped auditor is explicitly satisfied/dispositioned by both owners;
  merge alone is not product or formal G4 acceptance.

Protocol merge, a green PR or prior feature-ref dispatch permission is not B9.
The prior PR #31 launch authorization does not authorize this new formal run.
Private ingestion/generation occurs only in a later separately authorized slice.

## C. Executed acceptance: review receipts for the exact run

- [ ] C1. Every start/attempt and exact identity is recorded; no branch/SHA switch,
  resampling, hidden repair or unauthorized retry. Initial and final bytes agree.
- [ ] C2. Actual G0 independence/completeness and isolated G1 commands pass for this
  candidate. PHP/reference unreachable to target during G0; anti-proxy/replay
  control works. No G0 waiver for otherwise green G2/G3.
- [ ] C3. All registered public and selected hidden mandatory scenario IDs/steps
  execute: complete HTTP plus trusted initial/post-step typed DB counts, no
  omitted errors/rows/scalar types/array order. Scope and unsupported work explicit.
- [ ] C4. Independent real positive/negative, comparator and applicable lifecycle
  controls behave as required. Unexpected negative ERROR is a control failure.
- [ ] C5. Normal pair teardown plus finalizer show containers=0, volumes=0,
  emergencyRemoved=0. Missing receipts, timeouts or emergency cleanup stay errors.
- [ ] C6. Every complete/partial pair and provenance pack sealed; all indexes,
  exact bytes/hashes/evidence references verified after teardown. No partial
  catalog reported complete; primary/secondary faults retained.
- [ ] C7. Durable encrypted copies retained under approved ACL/keys/expiry;
  independent post-teardown restore matches all registered commitments, indexes,
  raw files, attempts and full coverage. No inference from public digests.
- [ ] C8. R attests custody/exposure/access history and private evidence through
  restricted human review. Public ChatGPT code review is recorded separately.
- [ ] C9. E finalizes immutable actual gate results with profile/limits, attempts,
  coverage, controls, cleanup and retention; both owners append acceptance/refusal
  without changing observed failures. G4_PASS and product acceptance separate.
- [ ] C10. Release only registered safe IDs/counts/coarse codes and commitments
  after epoch closure. Hidden feedback consumes the version for candidate repair;
  future changed candidate needs a fresh benchmark version.

## Decision table

Apply each row independently; preserve observed behavioral findings alongside
technical/missing-evidence status. No aggregate status erases another fact.

| Condition | Execution/gate reporting | Acceptance |
| --- | --- | --- |
| This docs PR, no both-owner decision | Formal execution NOT_RUN; canonical G4 INCONCLUSIVE | PROPOSED; product NOT_ESTABLISHED |
| A1-A4 accepted, no implementation/run | G4 execution NOT_RUN | G4_PROTOCOL_READY only |
| Any admission/custody/profile prerequisite absent | NOT_RUN before dispatch | BLOCKED; no formal claim |
| No execution for a mandatory gate | NOT_RUN reporting label; GateResult, if emitted, INCONCLUSIVE with reason | No product PASS |
| Known response/state mismatch with valid comparator/evidence | Relevant G2/G3 FAIL, retain exact findings | Qualification FAIL; historical receipt immutable |
| Positive rejects equal / negative accepts mutant | G4 FAIL if proven control mismatch; ERROR if control did not execute | No acceptance, inspect evaluator independently |
| Environment/build/provision/timeout/cancel/cleanup/storage operation fails | Relevant ERROR plus partial coverage and preserved behavioral FAIL findings | No PASS; only protocol-bounded technical retry eligible |
| Missing prior receipts, uncertain exposure or unverified retention | INCONCLUSIVE for unsupported claims; NOT_RUN for unexecuted work | No G4_PASS; product NOT_ESTABLISHED |
| All controls pass, hidden unseen, evidence complete/recoverable, G0 missing | G4 may PASS only in accepted profile; G0 INCONCLUSIVE/NOT_RUN | Product NOT_ESTABLISHED |
| C1-C10 satisfied, all applicable mandatory G0-G4 PASS | G4_PASS in named accepted profile; exact run and scope | Both-owner product acceptance permitted for registered scope only |
| LIMITED_TWO_PERSON used | Always publish limited human-independence qualification | No claim of full organizational independence |
| New successful public candidate or later run | New scoped receipt | Never overwrites PR #31 AUDIT_FAIL or proves old G4 |

FAIL is a proven mismatch, ERROR a technical/environment/evidence failure,
INCONCLUSIVE a claim missing sufficient evidence. NOT_RUN is not a fifth enum
value: existing VerdictSchema stays unchanged. Partial unexecuted mandatory tests
cannot PASS even when the workflow/job itself succeeds.
