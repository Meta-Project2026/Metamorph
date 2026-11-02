# MMP-125 — first-HTTP forensic correlation, read-only phase

Refs [#125](https://github.com/Meta-Project2026/Metamorph/issues/125), #104, #108,
#123, #124, #116, #61. Base: `074af751e9012abad1be2749c360c5d8b86218e0`.
Main post-merge CI41375878083 was independently read: Node22/24 SUCCESS.

**AUDIT_COMPLETE_CAUSE_UNRESOLVED. New Docker diagnostic PROPOSED / NOT_RUN.**
The user requested this issue in the project chat. That starts its read-only
evidence audit, not the separately gated Docker run. The owner also explicitly
reported that no local private MMP123 evidence copy remains. This owner report is
not a filesystem proof that no copy exists anywhere. No private pack or G4 input
was opened. No additional model request, repair, Docker invocation, paid workflow,
provider credential, owner key or artifact upload was used.

## Reproducible audit

```sh
node research/mmp-125/audit.mjs
node --test research/mmp-125/audit.test.mjs
pnpm exec biome check research/mmp-125
```

Exit0 means the pinned evidence audit completed; it does not mean Oracle or
product PASS. CLI accepts no arguments, including Docker/provider/private-path
modes. Refusal is a fixed AUDIT_REJECTED JSON, exit2, without raw exception text.
The audit imports only Node built-ins. It reads 47 fixed public inputs as data,
verifies their Git-blob byte hashes, independently recomputes both candidate
canonical hashes and the target runtime recipe hash, and checks original
per-file metadata, MIT notice, run/case identity and shared recorded source pins.
Candidate TS is neither imported, compiled nor executed. It does not read the
known-good TS fixture, upstream tests/answers, private packs or hidden G4.

Use an exact Git-byte checkout. Windows autocrlf can change Dockerfile/shell
bytes; the audit rejects this rather than normalizing source or recipe. During
development four clean tracked text files were rehydrated from their exact HEAD
blobs (no Git diff); no candidate or historical receipt bytes changed. Pin hashes
are integrity/reproducibility checks anchored to this reviewed commit, not model
attestations or an independent signature on historical execution.

`pins.json` is the bounded public input index. `evidence/correlation.json` is the
allowlisted audit result. It labels historical agent-run Docker receipts as
records, not as executions repeated by this task. New tests and audit behavior are
LOCAL_ONLY / NOT_VERIFIED by hosted CI; the existing PR CI syntax-checks these
modules but has no MMP125 behavior-test glob. No CI/workflow/package bridge was
added to inflate that status. See validation.md for actual commands and results.

## Findings

| Record                           | Candidate aggregate G1                      | G2 HTTP           | G3 SQLite          | Interpretation                                                |
| -------------------------------- | ------------------------------------------- | ----------------- | ------------------ | ------------------------------------------------------------- |
| Meta D / MMP104                  | INCONCLUSIVE, 2/6; first-pair compiler PASS | ERROR 0/17        | ERROR 1/20 initial | Historical source unavailable; side/cause UNKNOWN             |
| GLM original draft               | FAIL, 1/6                                   | INCONCLUSIVE 0/17 | INCONCLUSIVE 0/20  | Compiler failure precedes HTTP; a different interval          |
| GLM separate one repair          | INCONCLUSIVE, 2/6; first-pair compiler PASS | ERROR 0/17        | ERROR 1/20 initial | Same public shape as Meta, not same proven cause              |
| MMP108 known-good public control | PASS 6/6                                    | PASS 17/17        | PASS 20/20         | Historical non-AI control; no current environment attestation |
| MMP108 HTTP status mutant        | PASS 6/6                                    | FAIL 17/17        | FAIL 20/20         | Scored semantic mismatch, not early verifier ERROR            |

The independent audit reproduces draft hash `4ff450d2ec5fdcdfd855b7a3ed02b9f369488cf55f354372e4dc11dfb9511e72`
and repair hash `0cf5ba0bb22fd1d335b3d061b0a9b258d7ac660f3038e1e651ddaad1262d03c1`.
Only the already-recorded phpcompat.ts repair differs; no second repair was made.
GLM 5.3 draft / OpenCode-reported glm-5.3-flash-free repair remains self-reported,
not an attested Sol run. Historical WITH_SOL_REPAIR strings remain untouched.
Reconstructed prompt/context equality to production is still NOT_VERIFIED.

Source commit/archive and recorded manifest pins agree. Recomputed target recipe
is `f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3`.
Both control/GLM summaries record the same PHP image and source pins. This does
not prove equal complete verifier versions or identical dynamic environments:
runner.ts and runtime.mjs changed between historical Meta and GLM executions.
Reference transport/worker/mapping, target adapter/controller and target runtime
recipe have identical Git blobs across those execution heads. The differing
runner/runtime add telemetry plumbing; no assertion of byte-identical whole
verifiers, causal equivalence or a reproduced historical Meta candidate is made.

Existing MMP108 synthetic candidate-request, reference-request and malformed-
observation faults all produce the same ERROR/0 HTTP/initial-only DB signature.
That is a constructive non-uniqueness proof. It rules out attributing the cause
from shape alone; it is not a probability estimate for any particular cause.
See [source-map.md](source-map.md) for the supported interval and evidence gap.

The result narrows the **failure interval**, not the faulty subsystem. Generated
candidate behavior, reference PHP/adapter, request/observation parsing, transport,
clock/deadline/isolation and trusted evidence/comparator operations remain
unresolved alternatives. Cleanup 0/0/0 excludes a recorded cleanup failure as
the final result; it does not exonerate the earlier environment or application.
No completed HTTP comparison does not mean no HTTP request reached either side.

## Next decision

The existing records cannot resolve the first failing side or error class.
[diagnostic-plan.md](diagnostic-plan.md) proposes exactly one bounded local
disposable Linux Docker validation of the **unchanged repair candidate** with
trusted categorical instrumentation. It is a plan, not an executable delegation
or authorization. No new Docker run is permitted without explicit owner consent.
The task's one-repair allowance is consumed. #116 remains HOLD, #61
PRODUCT_NOT_ESTABLISHED, formal G4 NOT_RUN. Independent exact-SHA review and
owner merge decision remain separate; no self-merge or issue closure.
