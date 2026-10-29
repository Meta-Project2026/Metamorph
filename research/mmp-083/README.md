# MMP-083: Docker reliability, #84 and independent #34 triage

Base and real Docker driver: `84de165f6d1da5bd99fba3ad250319a0c3ae9a89`
(reviewed main, merged PR #90). Branch: `ilia/mmp083-docker-reliability`.

Investigation in progress. No production correction is justified yet. Three
sequential clean Ubuntu Docker trials use the exact driver SHA with
`model_provider=none`; run 40956644174 passed all original controls and cleanup
0/0/0. Run 40957774797 is the second repetition. Each next trial requires
successful normal and independent final cleanup of its predecessor. No reruns.

Issue #84 is a failed deterministic known-good replay, not the separate real
model trial #81. The original public G1 contains both `ENVIRONMENT_ERROR` and
`BUILD_FAILED`, with no executed G1 IDs and 0/17 HTTP, 0/20 SQLite coverage.
Three different synthetic compiler-process failures and an outer overflow with
exit 2 produce this same signature.
This discriminates a failure boundary but does not identify the historical cause.

Issue #34 is independently unresolved: two historical attempts required one
emergency removal each. Four earlier standalone 30-case Docker controls passed;
their ZIP/member hashes have been independently rechecked. Exact original failing
case, child exit/signal and survivor ownership are unavailable. No new #34 Docker
trial is claimed and no link between the incidents is established.

See [historical audit](historical-audit.md), [hypotheses](root-cause.md),
[experiment matrix](experiment-matrix.json) and [security](security.md).
New controls in `packages/agent-real/test/docker-reliability.test.mjs` are
`SYNTHETIC_UNIT_ONLY`; they use the real controller/report functions with injected
Docker command receipts. They never compile or execute candidate code on host.
There is no new research JavaScript directory and no CI coverage-matrix change.

Product remains `NOT_ESTABLISHED`; G0/G4 remain `INCONCLUSIVE`.
`AI_GENERATION_NOT_RUN`. Neither issue is fixed or eligible for closure here.

Independent ChatGPT review of the final exact PR head is required after delivery;
this investigation does not self-approve or self-merge.
