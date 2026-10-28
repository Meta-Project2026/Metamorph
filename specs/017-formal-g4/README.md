# MMP-038: formal G4 protocol proposal

Status: **PROPOSED / PENDING BOTH OWNERS**. Refs
[Issue #38](https://github.com/Meta-Project2026/Metamorph/issues/38).
Reviewed repository baseline: `00c913243ba7a4c05259dd1da25bdcfa7cf9e127`
(`origin/main`, fetched 2026-10-28). This directory is a specification and
decision package; it does not register a benchmark, authorize implementation or
dispatch, or establish a gate verdict. Root governance remains
[PROPOSED / PENDING OWNER RATIFICATION](../../.specify/memory/constitution.md).

- [Protocol](protocol.md): roles, registration, freeze, real execution, finality.
- [Threat model](threat-model.md): assets, trust limits and auditable mitigations.
- [Private storage](storage.md): complete raw packs, integrity, recovery, deletion.
- [Local-first architecture decision](local-first-decision.md): locally executable
  engine, optional cloud adapters and independent encrypted physical backups;
  **both owners' agreement reported by requester**, with **minimum 180-day
  retention and independent day-90 restore approved as project policy**. Concrete
  media/keys and authenticated second-owner receipt remain pending.
- [Acceptance checklist](checklist.md): protocol readiness, first-run admission,
  executed acceptance and outcome table.
- [Owner decision record](decision-record.md): explicit alternatives and pending
  decisions. No signature or appointment is supplied by this PR.
- [Implementation plan](plan.md): five bounded follow-up slices.
- [Validation](validation.md): checks of this documentation change only.

## Current evidence versus required evidence

Historical receipts stay bound to their executed source. This table records
public metadata and committed reports, not a new independent runtime verification.

| Area | Current evidence at the reviewed baseline | Required for the proposed formal process |
| --- | --- | --- |
| Offline Agent composition | MMP-010A reports real workers and public repair `PASS_SCOPED`; final Agent INCONCLUSIVE, AI generation NOT_RUN ([record](../012-agent-real-composition/validation.md)) | Exact admitted candidate and executed G0-G4; public repair receipts cannot certify later hidden qualification |
| Sampled workshop audit | PR #31 executed `b142201c07df45d4c10b470ba4f6f8e6b32d9b82`: seven sampled pairs, 59 HTTP / 66 SQLite, six PASS / one FAIL, **AUDIT_FAIL** ([handoff](../013-workshop-independent-audit/interface-handoff.md), [public receipt](../013-workshop-independent-audit/hosted-proof.json)) | Preregistered corpus/selection, custody, complete mandatory coverage, controls, retained evidence and separate acceptance |
| Audit controls and cleanup | Both real controls behaved correctly; all nine pairs zero resources; finalizer containers=0, volumes=0, emergencyRemoved=0 in that historical run | Fresh controls, normal teardown and independent finalizer for the exact formal run; prior receipts are not transferable |
| Human and data isolation | Same participant worked on MMP-008B candidate and MMP-010B auditor; formal held-out isolation **NOT_PROVEN** | Exposure declarations, enforced access boundaries and an explicitly accepted independence profile; no retrospective human independence |
| G0 | **NOT_RUN** in PR #31; other scoped reports retain G0 INCONCLUSIVE | Actual complete target with PHP/reference unavailable, plus anti-proxy/replay evidence; cannot waive a mandatory G0 |
| Raw evidence | Executed code attests 27 local private pair indexes plus provenance; private raw bytes were not independently downloaded/inspected here | Post-teardown complete index verification, encrypted durable copies, independent restricted restore and byte/index verification |
| External raw retention | **EXTERNAL_RETENTION_NOT_RUN**; public hashes are commitments only | Recoverable owner-restricted storage outside runner temp and GitHub public artifacts, with tested key recovery and retention |
| Public follow-ups | Current main includes public MMP-044 triage and separate MMP-049 compatibility candidate ([PR #46](https://github.com/Meta-Project2026/Metamorph/pull/46), [PR #50](https://github.com/Meta-Project2026/Metamorph/pull/50), [MMP-049 report](../016-candidate-compat/validation.md)) | Public evidence may motivate a separately frozen future candidate; it cannot convert PR #31's AUDIT_FAIL or requalify the old hidden selection |
| Formal registration and owner acceptance | NOT_RUN / PENDING; no accepted formal G4 receipt found in the specified records | Both-owner decision, qualified appointments, implementation evidence and separate exact-run authorization |

**Current canonical G4 remains INCONCLUSIVE; product NOT_ESTABLISHED.**
G4_PROTOCOL_READY is a proposed process milestone, distinct from G4_PASS.
A workflow SUCCESS, accepted protocol PR or public parity PASS supplies neither.
Issues [#44](https://github.com/Meta-Project2026/Metamorph/issues/44),
[#26](https://github.com/Meta-Project2026/Metamorph/issues/26) and
[#34](https://github.com/Meta-Project2026/Metamorph/issues/34) remain separate
tracks. No issue disposition or root-cause reclassification is made here.

## Implementation anchors and limits

| Existing code | Reuse / boundary to preserve | Missing formal capability |
| --- | --- | --- |
| [contracts](../../packages/contracts/src/index.ts): BenchmarkDefinitionSchema, GateResultSchema | Strict G0-G4 and PASS/FAIL/INCONCLUSIVE/ERROR records, executed IDs and evidence references | No registration authority, benchmark version, custody, retention or authenticated verdict authority; schema validity proves none of these |
| [Oracle runner](../../packages/oracle/src/runner.ts): verifyPair | Sequential reset, initial state, every HTTP step and full post-state, private raw publication; scope explicitly public/synthetic | Its G4 is deliberately INCONCLUSIVE after synthetic controls; a future formal orchestrator cannot relabel this result |
| [HTTP policy](../../packages/oracle/src/http.ts), [SQLite policy](../../packages/oracle/src/sqlite.ts) | Existing exact typed comparison and versioned stable headers; no hidden-driven normalization changes | Eligibility must reject coverage the unchanged policies/transports cannot observe |
| [audit runner](../../packages/workshop-audit/src/run.mjs), [adapters](../../packages/workshop-audit/src/adapters.mjs) | Admitted candidate, persisted freeze before sampling, ordered real PHP/TS observations, positive and corrupted-status negative control | Current hardcoded candidate/profile and unregistered post-freeze generator are a provisional audit, not the proposed registry |
| [audit lifecycle](../../packages/workshop-audit/src/lifecycle.mjs): PairRegistry, catalogRaw | All-path cleanup, partial evidence, late-writer rejection, post-cleanup seals/verification; bounded 256-file / 64 MiB raw catalog | Does not itself provide external storage, independent custody or organizational isolation |
| [private packs](../../packages/oracle/src/reference/evidence.ts): PrivateEvidence | POSIX owner/no-link checks, atomic records, SHA-256 indexes; 16 MiB per record / 128 MiB per pack | Explicit durable-retention-not-configured status; no encryption/recovery service |
| [retention bridge](../../packages/differential/src/private-run.mjs): retainOracle | Complete catalog/reference cross-checking, fail-closed limits | Still <100 files / 64 MiB and caller-umask interaction in runner; #26 is unresolved in reviewed code. The audit's separate 256-file catalog does not fix this helper |
| [finalizer](../../packages/workshop-audit/src/finalizer.mjs) | Zero owned containers/volumes and no emergency removals | Name-based inventory assumes a dedicated disposable daemon; no proof against malicious runner/daemon compromise |
| [Fast CI](../../.github/workflows/ci.yml) | Frozen install, lint, typecheck, unit/contract smoke and build | No formal G4; retain current fast CI scope and timeout |

The imported [Oracle contract](../../metamorph-architecture-v0.1/docs/architecture/oracle-contract.md)
is a proposal. This package makes a bounded acceptance proposal against actual
implementation without ratifying that contract or changing shared APIs. No
candidate, comparator, MANIFEST, contracts, worker, workflow or corpus is edited.
