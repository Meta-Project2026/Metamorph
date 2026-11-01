# MMP-104-T2 bounded telemetry contract v1

**NONPRODUCTION / DRAFT / GOVERNANCE_NOT_MERGEABLE.** Baseline inspected:
`main@07568d576565c2b83254655585ed869b270befd3` (2026-11-01).
This is the permitted offline proposal while the shared-contract gate is pending.
No production module imports these modules; no shared API/schema is changed.

[Decision request and Ilia's Oracle-side technical sign-off](https://github.com/Meta-Project2026/Metamorph/issues/104#issuecomment-6561627815).
**Vladimir's separate explicit approval: PENDING.** The earlier parallel-track
request is explicitly not consent. Neither executor tests nor CI are independent
security acceptance. Both owners must agree before production integration;
independent exact-SHA review is required and the executor must not self-merge.

## Executable proposal

`contract.mjs` validates a fixed record and independently expected trusted context.
`recorder.mjs` observes trusted callbacks without reading their values or exception
properties. The targeted package test runs these research modules through the
existing root test wildcard. No benchmark/candidate code executes on the host.

```powershell
pnpm install --offline --frozen-lockfile
pnpm build
node --test packages/agent-real/test/trusted-stage-contract.test.mjs
```

Every public record has exactly these keys (including UNAVAILABLE records):

| Field              | Contract                                                                |
| ------------------ | ----------------------------------------------------------------------- |
| format             | `mmp104-trusted-stage-v1`                                               |
| scope              | `PUBLIC_MANIFEST` only                                                  |
| status             | `AVAILABLE` or `UNAVAILABLE`                                            |
| unavailableReason  | Fixed enum below; `NONE` only for AVAILABLE                             |
| binding            | Exact runId, headSha, sourceSha, candidateSha, attemptId, pairId        |
| scenarioIndex      | Zero-based ordinal in the pinned public MANIFEST                        |
| stepIndex          | Null or zero-based request ordinal within that scenario                 |
| firstFailureStage  | Null or one of the 29 trusted stages below                              |
| failureCategory    | `OPERATION_REJECTED`, `SIGNAL_ABORTED`, `UNKNOWN`                       |
| lastCompletedStage | Null or a trusted stage; close success does not overwrite it            |
| cleanupFailures    | Zero to two unique sorted `{stage,category}` records, close stages only |
| truncated          | Boolean; true only for explicit UNAVAILABLE/TRUNCATED                   |

runId is a positive decimal GitHub run ID of 1..20 digits; headSha/sourceSha are
40 lowercase hex characters; candidateSha is 64; attemptId/pairId are canonical
lowercase 36-character UUIDs. Source must match the current pinned SOURCE.commit.
Binding/scenario must exactly match an independently supplied context. Indices
are safe integers in actual manifest bounds and at most99, never worker claims.
The canonical JSON must fit **2048 UTF-8 bytes**. No string/record is sliced to fit.
Exact own data descriptors reject accessors, inherited/custom prototypes, symbols,
extra/missing keys, sparse/overlong cleanup arrays and duplicate cleanup sides.

Reasons: `NONE`, `ABSENT`, `MISSING_BINDING`, `UNTRUSTED_RECORD`, `MALFORMED`,
`FOREIGN_BINDING`, `OVERSIZE`, `TRUNCATED`, `INTERNAL_ERROR`, `PUBLICATION_FAILED`.
UNAVAILABLE clears diagnostic fields, uses category UNKNOWN and empty cleanup;
expected binding remains available only when supplied by a branded trusted context.
Missing context produces null binding/scenario, never invented identifiers. Such an
unbound envelope is explicitly unavailable and cannot validate as authenticated.

Stage vocabulary (fixed constants, not generated from worker data):

| Boundary                    | Stages                                                                                                                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker lifecycle, each side | `REFERENCE_` and `CANDIDATE_` with `RESET`, `INITIAL_SNAPSHOT`, `REQUEST`, `STEP_SNAPSHOT`, `CLOSE`                                                                                                                                     |
| Clone                       | `REQUEST_CLONE`, `REFERENCE_OBSERVATION_CLONE`, `CANDIDATE_OBSERVATION_CLONE`                                                                                                                                                           |
| Serialization               | `REFERENCE_HTTP_SERIALIZE`, `CANDIDATE_HTTP_SERIALIZE`                                                                                                                                                                                  |
| Comparator                  | `HTTP_COMPARE`, `DB_INITIAL_COMPARE`, `DB_STEP_COMPARE`                                                                                                                                                                                 |
| Evidence                    | `EVIDENCE_CONTROLS_WRITE`; `EVIDENCE_INITIAL_REFERENCE_WRITE`, `EVIDENCE_INITIAL_PAIR_WRITE`, `EVIDENCE_INITIAL_DIFF_WRITE`; corresponding `EVIDENCE_HTTP_` and `EVIDENCE_DB_` reference/pair/diff writes; `EVIDENCE_PUBLICATION_WRITE` |

The record describes an observed trusted boundary, not the component or root cause.
SIGNAL_ABORTED means the supplied signal fired; it does not distinguish a timer
from parent cancellation. No elapsed-time inference or error code inspection.
First failure and its ordinal/category are first-write-only, including cleanup-only
failures. Up to two cleanup markers are secondary and retain their own categories.
Sealing freezes a detached record; late completions, invalidation and failures cannot
mutate it. Synchronous capture and asynchronous observation forward original values,
exception identity and signal. No new timer, retry or cleanup operation is introduced.
The abort listener is removed before returning to bounded() so successful-finally
abort does not create a false failure.

## Trust boundary and limits

Host-only context creation is a capability convention, not cryptographic attestation
or defense against malicious code already executing in the trusted evaluator.
Production must construct it from verified host receipts, never parsed worker claims.
`validateRecord` checks shape/binding only. `project` additionally accepts only records
issued by that recorder's private WeakSet and revalidates against independent context.
Copies and foreign issued records are refused even when their bytes match. Hostile
exception properties are never read; proxy traps during schema validation are caught
without inspecting the thrown object. No candidate object is used as an observation.

Only inert adapter wrappers are demonstrated with the actual unchanged verifyPair.
All 29 stages have direct synthetic rejection controls. Internal clone/compare/write
stages are **not instrumented inside production Oracle** in this gated proposal.
Actual evidence publication failure is also exercised with inert fixtures.
The old prototype remains for the original forensic tests; this v1 proposal is separate.

No URLs, SQL, HTTP body, command, path, error text/code/stack, source, provider output,
environment or hidden G4 content enters the proposed record. PUBLIC_MANIFEST cannot
be extended to held-out G4. Production reporting currently ignores the proposed
field entirely; tests preserve incomplete aggregate G1 despite per-pair build PASS,
G4 INCONCLUSIVE, fixed repair feedback and unchanged gate IDs/coverage/cleanup.
Existing forensic/retention tests continue to refuse partial evidence for export.

Historical run41327197036 root cause remains **UNKNOWN**; candidate/private packs
remain **UNAVAILABLE**. This work performs zero provider requests, dispatches/reruns,
candidate exports, Docker runs or age operations. The #100 paid attempt is consumed.
See [integration-plan.md](integration-plan.md) and [validation.md](validation.md).

Provenance: original research code and inert synthetic controls, reusing repository
Oracle/report code and manifest. No dependency, fixture, pin or license notice changed.
