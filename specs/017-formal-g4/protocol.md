# Formal G4 protocol (proposed v1)

Normative words in this document describe requirements for a future accepted
process. They are not claims about implemented behavior or owner approval.
[Decision record](decision-record.md), [storage](storage.md) and
[checklist](checklist.md) are part of this proposal.

## 1. Authority, roles and phases

Vladimir owns candidate/orchestration/integration; Ilia owns baseline/comparator/
Oracle. Role assignments for each epoch must additionally satisfy the
[exposure rules](threat-model.md); module ownership alone establishes no custody.
Name C (candidate owner), E (custodian), R (reviewer), storage administrator and
recovery delegate, with principals, conflicts and accepted independence profile.

Both owners approve the protocol/claim limits, registration and scope, role/access
record, storage policy and first-run admission. E implements and operates the
approved evaluator, R verifies evidence, and both owners record acceptance.
No model/Agent supplies trusted gate verdicts. No single operator changes policy,
chooses cases after observations or waives a missing mandatory gate.

The process has separate milestones:

1. PROPOSED -> G4_PROTOCOL_READY: both-owner acceptance of this bounded decision
   package with no unresolved normative choices. This says the protocol is ready.
2. IMPLEMENTATION_READY: independently reviewed future implementation and public/
   synthetic boundary tests satisfy the chosen profile and storage requirements.
3. REGISTERED -> CANDIDATE_FROZEN -> SELECTION_COMMITTED -> AUTHORIZED_RUN:
   concrete receipts and a separate jointly authorized, bounded execution.
4. EXECUTED -> TEARDOWN_VERIFIED -> PRIVATE_RETAINED -> REVIEWED -> FINAL:
   evidence-based gate results and a distinct owner acceptance record.

Step 3 authorization may name a registered epoch before the draw, provided it
fixes the exact candidate and selection algorithm/counts; dispatch still requires
the draw commitment before the first request. State names are proposed journal
labels, not changes to existing RunEvent or GateResult schemas. BLOCKED is an
admission status, NOT_RUN an execution label, and neither is a new Verdict enum.

## 2. Registration before candidate qualification

E prepares a registration bundle outside Git/model context for private material,
with a public-safe registration record. R checks provenance and boundaries;
both owners accept before candidate freeze. Required fields:

| Record | Required content |
| --- | --- |
| Identity | Unique benchmark ID and version, protocol version, epoch ID, registration ID/time, status and predecessor/superseded references |
| Provenance | Source repository and exact commit/archive SHA-256, verified license and retained notice hashes, upstream versus original test provenance, ingestion actor/date and exposure history |
| Scope | All mandatory routes/scenarios and migration units; exact HTTP/DB step counts; public opaque hidden IDs and coverage families; unit-to-scenario map and explicit unsupported areas |
| Policy | Normalization/header/typed DB versions, fixed clock/random controls, runtime/profile/recipe identities, request admission rules, completeness criteria and G0-G4 applicability |
| Public/hidden split | Public development/repair corpus commitments and separate private pool index; comparison of known public inputs with held-out material; duplicate/derived/exposed cases excluded before registration |
| Custody | Named roles/principals and independence profile, access matrix, ACL/key/recovery approvals, conflict declarations, private evidence reviewers |
| Selection | Finite eligible pool size, mandatory strata/counts, select-all or fixed sampling algorithm/version, uniqueness/order rules, entropy source, no caller seed/override, attempts and invalidation policy |
| Budgets | Concrete CPU/RAM/PIDs/state/response limits, aggregate useful wall time, per-operation/cleanup/evidence/restore deadlines and maximum invocation count |
| Retention | Storage locations and immutable version policy, exact retention duration, key recovery and deletion rules, tested restoration reference |
| Commitments | Exact-byte SHA-256 integrity indexes plus private-blinded public commitments, authenticated approvers and append-only journal location |

No benchmark is registered by filling this table with guesses. License/startup
qualification is evidence, not just a nonblank schema field. Both owners must
resolve unsupported request/header/DB features before admitting the claimed
scope; no broad "complete PHP application" claim from a narrow scenario subset.
Known exposure cannot be disproved by a disjoint filename. Record lineage and
shared human/model contexts; a corpus whose unseen status is uncertain is
INCONCLUSIVE, not qualified held-out evidence.

For the first version, use a sealed finite pool ingested **before candidate
freeze**. Every case's bytes, initial state, unit coverage and expected behavior
derivation rule are fixed in its private index. Expected observations come from
the pinned real PHP reference, not an LLM or candidate-written golden output.
Any cached expectations require independently retained reference derivation.
Do not use the current audit generator as an already registered pool.

Commit the complete pool, selection policy, evaluator, reference fixture and
controls before evaluation. For a public commitment to secret material, use a
fresh private 32-byte random blinding nonce and a domain-separated,
length-prefixed SHA-256 commitment over that nonce and the immutable indexed
bytes. Keep the nonce in the encrypted private registration bundle. Public
digests of low-entropy input/answer files must not enable guessing attacks.
Exact serialization/byte encoding and commitment test vectors are fixed and
reviewed in the future registration implementation; no ad hoc JSON reserialization.
R verifies the private commitment opening through the restricted review path.

An authenticated journal records ordering and actors before observations, with a
copy witnessed by R. A timestamp/hash written only after the run cannot establish
preregistration. Repo authors cannot replace prior registration history.

## 3. Candidate freeze and one selection

1. C submits exact full Git commit, admitted candidate bundle SHA-256, source
   provenance, lockfile/build inputs and claimed unit completeness. E admits bytes
   using the trusted existing boundary, outside candidate code.
2. E binds registration/epoch, candidate, source archive/initial fixture,
   evaluator/dependencies, controls, normalization/profile, image IDs and recipe
   digests to an atomic persisted freeze receipt. R verifies it against the
   already witnessed registration. Mutable branch/tag names are insufficient.
3. After freeze, select once with the committed algorithm using fresh OS
   cryptographic entropy. Record entropy, full selected ID/order list and
   algorithm transcript privately; publish only the blinded commitment and
   preregistered safe counts/IDs. No user-chosen seed or second draw.
4. Persist/witness selection before the first hidden request. Verify the same
   candidate bytes/build artifact and identities at launch and finalization.
   No Agent or candidate writer runs during hidden evaluation.
5. Candidate change ends this qualification. It cannot inherit another
   candidate's G0/G1 or repaired public/hidden parity receipt.

All mandatory public scenarios and the entire mandatory registered selection
execute. A sample is an explicitly scoped finite selection, not proof of the
whole pool or all possible inputs. Test IDs/counts cannot be optionalized after a
result. No hidden case, expectation, future request, private entropy or raw diff
enters source repair, prompts, shared chat, public logs or candidate storage.
A worker necessarily receives its current HTTP request to answer it; it must
not receive the rest of the pool or expected observations.

## 4. Execution contract

Run PHP 7.4 and TS only in authorized real disposable isolation, never on the
developer host. Use a dedicated disposable daemon/runner, pinned images and actual
runtime receipts, nonroot/read-only workers, no privileged mode/Docker socket,
no credentials/corpus/evaluator host mounts in candidate workers and bounded
network/CPU/RAM/PIDs/state/wall time. Build in isolation too. Separate fresh
reference and candidate SQLite state for every scenario; preserve sequential
state within each scenario. Trusted isolated inspectors observe actual state,
not a candidate-reported DB endpoint. The candidate cannot reach PHP/reference,
the trusted broker, private storage or outbound network.

Preserve current useful-work limits unless a separately approved version
changes them; cleanup grace never adds useful execution time. Observe initial
logical state equality, every response and every post-step snapshot. Include
accepted/rejected transactions, subsequent reads, schema/defaults/sequence and
registered nondeterminism controls. Never drop rows/fields, sort arrays, replace
timestamps or relax normalization to obtain parity.

| Gate | Required executed proof |
| --- | --- |
| G0 | Complete target against every registered mandatory route/unit with PHP stopped/unreachable; process/dependency/network observations and real anti-proxy/replay controls; no PHP subprocess/FFI, baseline DB, golden-output lookup or hardcoded test replay |
| G1 | Actual isolated typecheck/build/unit smoke for the exact admitted candidate, commands/exit statuses and built identity |
| G2 | All mandatory HTTP steps: method/path admission, status, registered stable business headers, errors, complete JSON with scalar types/null/missing/array ordering, exact meaningful text/HTML bytes |
| G3 | Equivalent clean initial state plus each HTTP response and full logical typed SQLite post-state, schema/defaults/indexes/triggers, int64/blobs, duplicate rows and sqlite_sequence; independent DBs and isolated inspection |
| G4 | Accepted custody/isolation profile and registration, correctly behaving independent positive/negative controls, unseen mandatory selection kept outside repair context, complete verified durable evidence and independent review |

"Full HTTP" means full bodies and all business headers required by the registered
policy, not a subset of fields or differences-only logging. Existing
oracle-exact-v1 compares content-type/location/cache-control/allow; it does not
compare every transport header. If another business header is mandatory, current
policy is insufficient: block that scope pending separately approved version,
rather than silently claim coverage. Unsupported JSON/SQLite/transport limits
are explicit ERROR/coverage gaps, never dropped data.

Before the first hidden request, execute real known-equal PHP/TS positive control
and a deliberate independently
captured known-bad observation through the same trusted comparison path. Require
positive PASS and expected negative FAIL in the intended gate, with proof the
mutation actually occurred. Include existing scalar/order/DB mutation controls
and real lifecycle/resource controls relevant to the admitted runner. An ERROR
is not a successful negative control. If controls fail or error, stop before
hidden execution and retain that outcome; do not spend hidden cases on a broken
evaluation path. Synthetic controls alone cannot establish
Docker parity or G0 isolation. Do not mutate the qualification candidate or
Oracle semantics to create a control.

Ordinary mismatches do not stop remaining mandatory scenarios. A safety/harness
failure stops useful work, records partial coverage and preserves raw partial
evidence. Always attempt bounded teardown, revoke late writers, catalog and seal
available packs; preserve primary and secondary faults. Verify normal cleanup
and independent finalizer containers=0, volumes=0, emergencyRemoved=0. Ending
empty only after emergency removal stays ERROR. Missing finalizer or suspected
escape never implies zero resources.

## 5. Evidence, review and immutable finality

Follow [storage.md](storage.md). Final verdict publication waits for post-teardown
index verification, complete durable upload and independent restore verification.
On failure retain the available incomplete pack and ERROR/INCONCLUSIVE receipt;
do not fabricate an index or discard the unsuccessful invocation.

R verifies registration ordering, actual access/custody, exact candidate/source/
runtime/selection binding, executed coverage, controls, inventories and recoverable
private contents. Private review is by an authorized human in restricted tooling;
never send hidden raw material to ChatGPT/another model. Public independent
ChatGPT code review can supplement this review, but cannot establish unseen human
custody or inspect private contents by inference.

E publishes an authenticated immutable final receipt containing run/epoch/
registration IDs, exact frozen identities, all attempt IDs, actual G0-G4 results,
coverage/control/cleanup/retention status, safe pack commitments, independence
profile, reviewer attestation and findings. Public opaque evidence references
resolve to restricted private receipts through the custodian, not public raw URLs.
Keep existing GateResult evidencePaths relative within a pack; a proposed outer
acceptance record binds storage versions and authority without forging current DTOs.
The final receipt and owner acceptance are distinct append-only records.

Both owners record acceptance or refusal and the precise claim scope after R's
review. They cannot vote a FAIL/ERROR/missing mandatory test into PASS. All
applicable mandatory G0-G4 must PASS for product PASS in the registered scope.
G4_PASS alone never establishes product PASS. LIMITED_TWO_PERSON results always
carry that qualification and cannot be advertised as full organizational
independence. No profile waives actual same-corpus author exposure.

## 6. Attempts, invalidation and nonleaking follow-up

Default proposal: one invocation, at most one jointly authorized technical retry,
fixed before registration. A retry requires a classified environment/harness
ERROR, unchanged candidate/selection/meaning, no raw disclosure or candidate
repair, and R's evidence that the selection is reusable. Prelaunch errors still
get an attempt receipt. After observations, retry the identical full mandatory
selection only; never draw replacements or keep only the best attempt. Preserve
the original ERROR and full attempt history; an unexplained failure cannot be
dismissed as flaky. No retry of a terminal behavioral FAIL or PASS.

| Change/event | Required disposition |
| --- | --- |
| Candidate edited after receiving hidden verdict, codes or other evaluation feedback | New candidate freeze and fresh unexposed benchmark version/epoch; old version is regression-only for that author |
| Hidden inputs/answers/entropy leaked, same-corpus author access, public diagnostic spill or suspected escape | Invalidate held-out eligibility, stop/revoke access, retain incident receipt; fresh independently held corpus/version before qualification |
| Pool, expectations, source/fixture, scope, normalization/control semantics or sampler changed | New benchmark version and epoch with preregistration; retain old commitments/results |
| Runtime/evaluator implementation fix with unchanged test meaning | New freeze/epoch and independent review; document whether corpus remains unexposed. If meaning changed or exposure uncertain, fresh version required |
| Technical retry with all predicates above | Same epoch, same identities/selection, new linked attempt ID within fixed budget; no silent green replacement |
| Evidence lost/tampered or custody history cannot be verified | Preserve observed outcomes, disallow PASS; ERROR for storage failure / INCONCLUSIVE for missing historical proof; new independently reviewable qualification required |
| Documentation correction or later root-cause classification | Append a signed/authenticated correction or invalidation referencing old receipt; never overwrite original observation |

An epoch closes after finalization (including FAIL/ERROR), except the bounded
technical retry admitted before terminal closure. No retroactive registration or
recertification of PR #31. A proven evaluator defect may invalidate acceptance of
an old receipt but cannot rewrite its observed AUDIT_FAIL to PASS. Diagnose through
independently constructed public behavior under the #44 boundary; hidden raw
inputs, expectations, diffs, minimizations and repair hints remain unavailable to
candidate authors/models. Even safe coarse result feedback consumes the hidden
qualification for subsequent candidate optimization.
