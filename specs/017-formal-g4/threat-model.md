# G4 threat model (proposed)

Applies to a future registered epoch under [protocol.md](protocol.md).
Protected assets: unseen inputs/expected results, original reference fixtures,
candidate identity, comparator/control semantics, selection fairness, complete
raw evidence, access receipts and immutable outcomes.

Assume untrusted PHP/reference and generated TS code, accidental human disclosure,
candidate optimization from feedback, and a custodian who could otherwise cherry
pick cases. Trust the explicitly appointed custodian, independently reviewed
broker/runtime and storage/key boundary to enforce policy. Hashes detect changes
only relative to a prior authenticated commitment; they do not prove truth,
independence or absence of collusion.

| Threat | Required mitigation | Receipt / consequence |
| --- | --- | --- |
| Candidate author reads hidden tests or future requests | Separate principals/storage; no corpus mounts in candidate/build/Agent; only current request reaches a worker | Access grant/denial tests and exposure declarations; exposure invalidates held-out use |
| Expected outputs leak through fixtures, DBs or diffs | Custodian-only expected state; trusted reference/inspection, separate volumes; no raw repair feedback | Mount/network audit and canary export tests; leak burns affected version |
| Adaptive case selection / RNG grinding | Commit complete pool and selection policy before candidate freeze; one recorded post-freeze draw, no operator seed/override or resampling | Registration, freeze and draw ordered in append-only journal; unaccounted draw invalidates epoch |
| Oracle/control tampering | Candidate writer cannot write evaluator/reference/control paths; pin code/dependencies/images/policy; separately reviewed changes | Exact digests and positive/negative controls; mismatch or uncontrolled edit blocks execution |
| Fixture, clock or source drift | Pinned source/license/initial logical fixture, fixed clock and observed runtime receipts; reset fresh state per pair | Verify bootstrap/initial state; drift is ERROR, never silently repair the reference |
| Retrying until green | Preregister attempt limit; retain every start/result; technical retry only under protocol; terminal FAIL never replaced | Complete attempt ledger; unsupported rerun cannot be accepted |
| Candidate SHA or build swapped after freeze | Verify full Git commit plus admitted source-bundle and built-artifact identity; read-only staging and receipt binding | Startup and final identity checks; mismatch is ERROR |
| Evidence destroyed, truncated or substituted | All-path partial capture, exact catalog and sealed indexes after teardown; authenticated encrypted durable copies and restore | Per-file bytes/hashes, complete flags, remote version and recovery receipts; missing evidence cannot PASS |
| Public logs leak private values | Private stdout/stderr, strict allowlist public serializer; fixed code taxonomy, no paths/stacks/seed/raw hashes permitting guesses | Synthetic canary/export tests and restricted review; spill triggers access revocation and invalidation |
| Candidate exfiltrates request via output/timing | No outbound network, no arbitrary worker output in public reports; release only preregistered IDs/counts/coarse codes after epoch closes | Egress/output controls; timings and arbitrary candidate strings remain private |
| Runner escape / malicious DB parser input | Disposable dedicated runner/daemon, bounded nonroot workers, no Docker socket/host mounts/credentials, separate isolated inspectors | Actual sandbox controls/inventory; suspected escape is ERROR and security invalidation, no recovery of independence by cleanup alone |
| Human-context overlap / shared chat or credentials | Declare candidate authorship, corpus and answer exposure, shared sessions and administrative rights; fresh unexposed corpus; appointed reviewer | Named independence profile and limitations; same-corpus access is never waived by two signatures |
| Colluding operators / repository admin changes | Independent reviewer observes prior commitments and access/attempt history; storage retention and separate credentials | Explicit residual trust. Two-person profile cannot establish strong organizational independence |
| Denial of service, cancellation or hard kill | Aggregate useful-work budgets, independent cleanup/storage budgets, out-of-band finalizer, conservative missing-receipt handling | Preserve primary and secondary faults, partial evidence; absent finalizer/retention means ERROR or INCONCLUSIVE |

## Minimum access matrix

C = candidate owner/author, E = evaluator custodian, R = appointed reviewer.
These are named human roles with separate credentials and work contexts; an LLM
review of public code cannot attest human custody or replace the human reviewer.

| Asset/action | C | E | R |
| --- | --- | --- | --- |
| Public specification, source provenance, public tests | Read/write within owned scope | Read | Read |
| Candidate during development | Write | Read public submission only; no repair during epoch | Review frozen bytes |
| Hidden pool, expected state, selection entropy | No access | Restricted author/ingest/read | Restricted read only for assigned private review; never through LLM |
| Evaluator/reference/control code | Read public code; no candidate-generated writes | Maintain before freeze under review | Review pinned implementation |
| Run dispatch and raw capture | Submit candidate only | Execute exact jointly authorized run | Observe authenticated receipts |
| Storage encryption/decryption keys | None while C remains a candidate author | Scoped service access | Temporary restore access via approved key recovery; no key in Git/LLM |
| Final verdict | Receive allowlisted result after closure | Produce signed/authenticated receipt | Independently verify and attest; cannot rewrite observation |
| Run/architecture authorization | Explicit owner decision | Explicit owner decision if an owner | Review evidence; does not impersonate either owner |

Infrastructure administrators capable of bypassing ACLs are inside the declared
trust base, even if they never exercise those rights. Record this fact and avoid
shared root/cloud accounts. Splitting folders or starting another chat does not
create an independent principal. A reviewer exposed to raw cases becomes
ineligible to author later candidates qualified against that corpus.

## Independence profiles

**LIMITED_TWO_PERSON**: two owners explicitly accept limited human independence.
One is the candidate owner, the other acts solely as custodian during the epoch.
Historical candidate involvement and shared administrative control are disclosed.
The reviewer is appointed explicitly; if it must be one of those two people,
record that it is a process/code review, not an independent third-person
attestation. Actual new hidden inputs and expected outputs must still be unseen
by every candidate author/model/repair context. The custodian must not repair the
candidate or share private diagnostics. Use a fresh registered version; the
MMP-010B selection cannot be retrospectively qualified. Any accepted future
G4 result must carry this profile and limitations; an unqualified claim of full
human/organizational independence is forbidden.

**INDEPENDENT_CUSTODIAN**: where strong organizational independence is required,
appoint a custodian with no candidate authorship or disqualifying case exposure,
and a reviewer separate from the candidate author and from the work being
attested. At least a third qualified human is needed; a third person's presence
alone does not make an otherwise overlapping role independent. If the existing
owners cannot supply an eligible reviewer, appoint another eligible reviewer.
Neither candidate owner nor its service account can decrypt hidden storage.

Both profiles require technical isolation and complete evidence. Neither allows
the author to have seen the same hidden corpus, expected outputs or a reconstructible
selection seed before evaluation. If that minimum cannot be met, or either owner
rejects the limited claim and no qualified independent appointments exist, status
is **BLOCKED**. No signatures can turn contaminated cases into unseen cases.

Residual risks include privileged custodian dishonesty, undiscovered runtime
escape, incomplete exposure history and finite test coverage. Scope these in the
final report; do not claim that cryptography proves semantic correctness or that
sample parity proves unregistered routes complete.
