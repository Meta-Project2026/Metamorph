# Attribution and falsifiable hypotheses

## #84: historical boundary, not a demonstrated root cause

The first known-good attempt in run 40907197167 has exactly one pair
(`workshop-business`), no G1 executed IDs, G1 ERROR with codes
`ENVIRONMENT_ERROR, BUILD_FAILED`, G2/G3 ERROR with `BUILD_FAILED`, zero coverage,
and verified normal cleanup. Compiler sidecar is `DIAGNOSTIC_UNAVAILABLE`.
The later repair attempt uses the identical known-good candidate SHA and passes.

`runtime.buildReceipt` distinguishes the Docker CLI envelope from the inner
trusted build recipe's phase receipts. `controller.provision` first preserves
the Docker build receipt, then classifies outer exit 2 as `BUILD_FAILED`.
`buildReceipt` classifies an inner `error`, `signal` or noninteger exit as
`ENVIRONMENT_ERROR`. `runPair` retains the operation error unless a genuine
G1 FAIL is present; `aggregateAttempt` appends it and preserves ERROR precedence.
`proof.mjs` later rejects the incomplete known-good predicate as `EVIDENCE_ERROR`.
That last error is a consequence of missing proof, not a Docker root cause.

The five implementation files `proof.mjs`, `runtime.mjs`, `report.mjs`,
`controller.mjs`, `runtime-broker.mjs` are byte-identical in Git between the
failing historical SHA d9b5f62 and this base. The trusted build recipe is also
unchanged. No source reconstruction is used.

| Hypothesis | Discriminator / falsification | Current evidence |
| --- | --- | --- |
| Inner compiler process timed out | Private phase `error=ETIMEDOUT` and signal; falsified by a complete normal phase receipt | Synthetic actual-controller path reproduces public signature; historical receipt unavailable |
| Inner compiler was killed or failed to spawn | Phase signal/status/error plus resource counters; falsified by normal exit | SIGKILL and EAGAIN controls independently produce identical signature; OOM itself is NOT established |
| Docker CLI timeout/cancel/spawn/transport failure | Outer envelope flags/exit; compare public codes | Synthetic TIMEOUT/CANCELLED/exit125 differ from original mixed signature; overflow with exit2 can still share it, so not excluded |
| Ordinary TS semantic diagnostic | Normal inner exit2, real compiler diagnostic and G1 FAIL | Synthetic diagnostic control yields FAIL, not the historical ERROR |
| Initial image inspection, reset/readiness, PHP or DB failed first | Stage/command receipt; a build receipt must exist to explain G1 environment finding | Less consistent with the preserved BUILD_FAILED plus G1 environment signature; no claim to reconstruct missing private sequence |
| Cleanup caused original #84 failure | Nonzero normal/final inventory or cleanup error | Contradicted by all recorded cleanup scopes: zero resources, zero emergency removals |

The build recipe's existing 12 s compiler subprocess deadline, 35 s outer build
deadline and 256 MiB sandbox are hypotheses' context, not evidence of an actual
limit breach. No limits, retries, classification or isolation are changed.

## Bounded protocol registered before results

Three independent workflow_dispatch runs of the existing
`agent-workshop-compose.yml`, `model_provider=none`, exact main SHA 84de165.
Check head before each dispatch; never overlap; require previous normal cleanup,
compiler-control cleanup and independent finalizer all 0 containers / 0 volumes /
0 emergency removals. Stop on cleanup error or remaining resources. No reruns;
expand to at most five only with new discriminatory evidence. Record step-level
times and images; fields absent from the public evidence stay UNKNOWN.

Existing lifecycle tests cover readiness deadline/race, cancellation during
volume creation/probe, partial resources and sticky cleanup failure. Added
synthetic cases cover the narrower build-envelope/inner-process distinctions
and post-creation transport loss. Synthetic resource sets are not Docker inventory.

Final verdict: `NOT_REPRODUCED_ROOT_CAUSE_UNKNOWN`. All three independent trials
passed the original good/negative/repair, six runtime controls, compiler control
and normal/finalizer cleanup. No new discriminatory failure justified a fourth
trial. Passing three trials does not establish FIXED or statistical reliability.
If a future failure occurs, inspect trusted private receipts inside that runner
and publish only reviewed fixed phase/cause enums, exit/signal/timedOut flags,
bounded durations and cleanup counts. The next useful discriminator is the
outer Docker receipt versus the first compiler phase receipt, not another blind
rerun. Any diagnostic export must remain separate from the active #89 work.

## #34: independent stopping point

Verdict: `BLOCKED_NOT_RUN` for exact original-case reproduction in this sprint;
historical root remains unknown. Original wrapper collapses nonzero child exit,
missing/malformed summary and assertion failure to the same `items-smoke: ERROR`.
Its independent finalizer proves one residual owned resource, but not resource
type, owner child or first failed case. The finalizer runs after both smoke and
mismatch pilot; do not assign the survivor to a child without evidence.

Prior four standalone executions are historical controls, not repetitions of the
original two-child wrapper. All 120 cases passed, cleanup 0/0/0; the prior report
already establishes their limited scope. Missing original receipts cannot be
recovered by manufacturing a case or by another generic smoke run. Future exact
case work requires the original private first-uncompleted-case/command receipt
and inventory between children, if legitimately retained. No common cause with
#84, corrective production change or issue closure is supported.
