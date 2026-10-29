# MMP-083: Docker reliability, #84 and independent #34 triage

Base and real Docker driver: `84de165f6d1da5bd99fba3ad250319a0c3ae9a89`
(reviewed main, merged PR #90). Branch: `ilia/mmp083-docker-reliability`.

Verdict for #84: **NOT_REPRODUCED_ROOT_CAUSE_UNKNOWN**. Three sequential clean
Ubuntu Docker trials passed at the exact driver SHA with `model_provider=none`.
No production correction is justified. No further trials or workflow reruns.

| Trial | Scoped proof | good / negative / repair coverage | Runtime controls | Compiler control | Normal / independent cleanup |
| --- | --- | --- | --- | --- | --- |
| [40956644174](https://github.com/Meta-Project2026/Metamorph/actions/runs/40956644174) | PASS_SCOPED | 17 HTTP + 20 SQLite each | 6/6 PASS | PASS (expected G1 FAIL) | 0/0/0 in both |
| [40957774797](https://github.com/Meta-Project2026/Metamorph/actions/runs/40957774797) | PASS_SCOPED | 17 HTTP + 20 SQLite each | 6/6 PASS | PASS (expected G1 FAIL) | 0/0/0 in both |
| [40958752426](https://github.com/Meta-Project2026/Metamorph/actions/runs/40958752426) | PASS_SCOPED | 17 HTTP + 20 SQLite each | 6/6 PASS | PASS (expected G1 FAIL) | 0/0/0 in both |

Cleanup triples mean containers / volumes / emergency removals. All pair,
proof-completion, compiler-control and independent finalizer scopes passed.
Each subsequent dispatch followed verification of its predecessor's cleanup.
The deliberate defect produced G2/G3 FAIL; known-good and scripted repair passed
G1/G2/G3. Total public differential comparisons: 153 HTTP / 180 SQLite across
nine attempts. These are deterministic controls, not AI-generated migrations.

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
[experiment matrix](experiment-matrix.json), [validation](validation.md) and
[security](security.md).
New controls in `packages/agent-real/test/docker-reliability.test.mjs` are
`SYNTHETIC_UNIT_ONLY`; they use the real controller/report functions with injected
Docker command receipts. They never compile or execute candidate code on host.
There is no new research JavaScript directory and no CI coverage-matrix change.
All 11 new synthetic controls pass. Nine historical public ZIPs and six fresh
public ZIPs have verified SHA256/member custody. Docker daemon/context and host
utilization were not published by the unchanged driver and remain UNKNOWN.

Product remains `NOT_ESTABLISHED`; G0/G4 remain `INCONCLUSIVE`.
`AI_GENERATION_NOT_RUN`. Neither issue is fixed or eligible for closure here.

Independent ChatGPT review of the final exact PR head is required after delivery;
this investigation does not self-approve or self-merge.
