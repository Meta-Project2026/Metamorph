# Shared interface note for Ilia — MMP-001

**Status**: implemented boundary v0.1; both-owner agreement/review pending.
First concrete DTOs refine the architecture draft, without changing or approving
the [Oracle contract](../../metamorph-architecture-v0.1/docs/architecture/oracle-contract.md).
Review together before extending interfaces in MMP-002/MMP-003.

Import schemas and inferred types from `@metamorph/contracts`. No adapters, Oracle
implementation or run aggregator exist. All objects reject unknown fields;
numeric inputs are neither coerced nor defaulted.

| Boundary | Concrete choice / refinement |
| --- | --- |
| BenchmarkDefinition | Draft fields retained; HTTPS URL, full 40/64-hex commit, nonblank runtime/license/normalization and unique nonempty scenario/unit IDs. Parsing does not prove runtime eligibility or license validity. No real manifest/registry exists. |
| RunConfig | Draft fields retained; explicit limits, nonnegative safe-integer repairs/escalations, finite nonnegative USD cap, positive safe-integer seconds. Zero spend is valid. Strategy labels do not imply model access; no guessed hostname/model IDs/defaults. |
| GateResult | Draft fields retained. PASS/FAIL requires executed IDs and relative evidence references; FAIL/INCONCLUSIVE/ERROR requires a finding. INCONCLUSIVE/ERROR can have no executions. Paths use relative POSIX syntax without traversal; file existence/content is not verified. |
| ModelUsage | Required requestId, provider, modelId, inputTokens, outputTokens, cachedInputTokens, estimatedCostUsd, durationMs. Unavailable counts/cost are null, never invented zero. Counts are nonnegative safe integers; cached tokens cannot exceed known input. Cost is explicitly an estimate; no pricing assumptions. |
| RunEvent | Discriminated union: `run-state-changed` with state; `gate-result` with result; `model-usage` with usage. Every event has runId and UTC ISO timestamp. Lifecycle names follow the draft; transitions/persistence/verdict authority are not implemented. |
| Verdict / Gate | Exactly PASS/FAIL/INCONCLUSIVE/ERROR and G0/G1/G2/G3/G4. NOT_RUN is a reporting label, not a fabricated executed gate verdict. |
| HealthResponse | Additional foundation HTTP DTO; capabilities unimplemented/undecided, without a verdict. |

IDs start with a letter/digit, then letters/digits/dot/underscore/colon/hyphen.
Evidence references look like `http/scenario-1.json`; future runtime code must
resolve paths safely within its artifact root. Provider/model strings are open
nonblank values, not verified integration identifiers. A parsed manifest is a
declaration, not evidence of eligibility.

| Gate | Unchanged meaning; actual execution belongs to future Oracle |
| --- | --- |
| G0 | Independent complete target with PHP unavailable; no proxy/replay/baseline access |
| G1 | Actually executed build/typecheck/unit smoke |
| G2 | Mandatory HTTP contracts, scalar types, ordering, statuses and errors |
| G3 | Stateful HTTP and logical SQLite parity from equivalent initial state |
| G4 | Positive and deliberately mutated negative controls; held-out isolation |

A structurally valid G1 PASS does not establish run PASS. Even valid records for
all gates require independently verified executions, mandatory coverage, controls
and evidence. Schemas cannot authenticate callers, check isolation or establish
applicability. Ilia owns those checks. A migration agent must never supply trusted
Oracle verdicts; no such write path exists in this foundation.

The imported `metamorph-architecture-v0.1/docs/architecture/oracle-contract.md`
was not moved or edited. This checked-in note is the reviewable handoff; no
external teammate message was sent.
