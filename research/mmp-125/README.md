# MMP-125 — first-HTTP correlation and consented diagnostic attempt

Refs [#125](https://github.com/Meta-Project2026/Metamorph/issues/125), #104, #108,
#123, #124, #116, #61. Base: `074af751e9012abad1be2749c360c5d8b86218e0`.
Main post-merge CI41375878083 was independently read: Node22/24 SUCCESS.

**AUDIT_COMPLETE_CAUSE_UNRESOLVED. Diagnostic attempt: ERROR_ENVIRONMENT;
candidate validation NOT_RUN (Docker daemon unavailable).**
The user requested this issue in the project chat. That starts its read-only
evidence audit, not the separately gated Docker run. The owner also explicitly
reported that no local private MMP123 evidence copy remains. This owner report is
not a filesystem proof that no copy exists anywhere. No private pack or G4 input
was opened. During the read-only phase no additional model request, repair, Docker invocation, paid workflow,
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

## Authorized diagnostic

On 2026-11-02 the user authorized preparation and exactly one run of the plan
published at f3895d1: «Разрешаю подготовку и один прогон по плану».
The research-only observer and manual launcher are implemented; production
verifier/runtime/comparators, immutable candidates and historical receipts stay
byte-identical. Audit/observer tests: 41 PASS; PowerShell launcher: three stateful
stub controls PASS. These are local controls, not a real candidate replay.

The authorized single Docker attempt uses the unchanged MMP123 repair CLI once, a
host-issued identity, 20-minute outer deadline, 4GiB/512-PID outer envelope and
unchanged worker limits. A durable consumed marker forbids automatic retry.
Command metadata is sampled only at trusted host checkpoints; raw exceptions,
stdout/stderr, payloads, SQL and source never enter public output. A bounded
categorical trace is retained in the safe receipt for independent review.

The one invocation authorized by that consent has already been attempted and closed.
The script itself is manual-only; syntax CI does not launch it. No GitHub run
identity is invented for the local driver. Missing telemetry remains UNKNOWN.
Any second run, code repair, model request or artifact upload requires separate
authorization. #116 HOLD; #61 PRODUCT_NOT_ESTABLISHED; formal G4 NOT_RUN.
Independent exact-SHA review and owner merge decision remain pending.

## Actual attempt: environment ERROR before candidate execution

The manual launcher was invoked once on driver head
`1c3581acadbc14382b4a9007d4701904639480de`, diagnostic ID
`a173d103-3da4-4697-9baa-87e612625e28`; exit1. Docker Desktop Linux Engine was
unreachable: its named pipe was absent. Separate read-only Docker version,
container inventory and volume inventory commands each exited1. No outer
container launch, volume creation, verifier child or candidate execution occurred.
The raw launcher receipt says ERROR_CLEANUP because its final inventory also
could not reach the daemon. This is not evidence of leaked resources: no resource
creation was reached, and global daemon inventory is UNAVAILABLE, not verified0.

See [diagnostic-outcome](evidence/diagnostic-outcome-a173d103.json) and the
[host receipt (JSON fields preserved; LF formatting)](evidence/host-execution-a173d103.json). There is no
candidate boundary trace and no new gate/coverage result. All historical results
and immutable source hashes remain unchanged. Candidate failed side/class/root
cause and historical Meta cause remain UNKNOWN. This attempt proves only a
current host environment obstacle, not the cause of either earlier VERIFIER_ERROR.

No retry, Docker startup, extra repair, model, Actions dispatch or artifact upload
was performed. The attempt is closed; the local scratch contains an explicit
no-retry marker after the failed preflight. A future attempt requires a running
Docker daemon and separate consent. #125 stays OPEN for that decision and the
independent exact-SHA review; #116 HOLD, #61 PRODUCT_NOT_ESTABLISHED, G4 NOT_RUN.

## Review corrections for issue #130 (no diagnostic authorization)

Independent review of f77b8b1 identified two P1 launcher defects: consumption was
after Docker preflight, and the stopwatch did not bound subprocess execution.
The corrected entrypoint keeps only ScratchRoot/AuthorizedHead parameters and
loads launcher-core.psm1. After exact-head, clean-tree and immutable-audit checks,
FileMode.CreateNew / FileShare.None / Flush(true) consumes consent before any
Docker resolution or invocation. Existing, partial, inaccessible or failed-write
markers refuse Docker entirely, including final inventory. Nothing reads,
rewrites or deletes a prior marker to grant permission. Concurrent processes
compete for the same exclusive file; only one can proceed.

Every host Docker command now uses BoundedProcess.cs via one wrapper. The native
ProcessStartInfo.ArgumentList preserves argv without shell parsing. One monotonic
1200-second budget starts at core entry and includes admission, bundle, Docker
preflight/setup/run/poll/copy. Each CLI call gets min(15seconds, remaining budget).
Cleanup has its own60-second budget and min(5seconds, remaining) per command.
Stdout+stderr are bounded to64KiB, stderr is discarded, stdout stays internal;
timeout/cancellation/output overflow terminates the child tree where supported.
Execution and pipe draining are both bounded; there is no unbounded WaitForExit,
ReadToEnd or post-kill EOF wait. Worker/verifier/image limits are unchanged.

The v2 host receipt separates main status, cleanup status and inventory status.
A refused marker does not call Docker even for cleanup. Unavailable/invalid/
truncated/failed inventory leaves counts null, never verified zero. Removal still
requires this run's exact outer label, volume labels and narrowly validated
private ledger; no global pruning or broad provenance-prefix deletion exists.
The previous v1 receipt, local closed marker and categorical outcome are untouched.

launcher.test.ps1 substitutes private module functions only inside separate test
controller processes. Its subprocesses are node plus the original fake-docker.mjs;
the production CLI/environment exposes no fake executable or budget override.
Tests exercise real child waits/tree termination/cancellation, cross-process
marker races, missing→recovered daemon, partial and failed marker writes, output
limits, unknown inventory, foreign owners and stale ledgers. These are LOCAL_ONLY
synthetic controls; hosted CI only syntax-checks the MJS fixture. PowerShell/C#
behavior is not hosted-gated. No real Docker/daemon/diagnostic or model is run.
#130 and #125 stay OPEN pending independent exact-SHA re-review. #116 HOLD;
#61 PRODUCT_NOT_ESTABLISHED; formal G4 NOT_RUN. No self-merge or self-approval.
