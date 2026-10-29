# Validation and delivery boundaries

Implementation SHA: `7f1a87351b3886795bc3dde6293438ed9fb3391a`.
Later evidence-only commits do not change the controller, recipes, workflow or
new test file. The real Docker driver/source checkout is independently pinned to
reviewed main `84de165f6d1da5bd99fba3ad250319a0c3ae9a89`.

## Local Windows checks on implementation SHA

Frozen install, lint, typecheck, root test, build, target-worker, differential,
Oracle reference and agent-real all exited 0. Commands, times and counts are
recorded in experiment-matrix.json. Node v24.21.0, pnpm 11.25.0.

| Suite | PASS | FAIL | SKIP |
| --- | ---: | ---: | ---: |
| root | 348 | 0 | 102 |
| target-worker | 69 | 0 | 0 |
| differential | 77 | 0 | 45 |
| Oracle reference | 55 | 0 | 1 |
| agent-real | 217 | 0 | 0 |
| new synthetic controls (subset of root and agent-real) | 11 | 0 | 0 |

Windows OS/permission skips are NOT_RUN, not successful Linux checks. No local
candidate compilation/execution or Docker trial is claimed. The strict coverage
validator returned VALID and selects the new package test through existing globs.

One development test run initially had 9 PASS / 1 FAIL because the synthetic
ordinary compiler-FAIL fixture lacked a mandatory evidence reference. Only that
fixture was corrected; production validation was preserved. A subsequent
restricted-sandbox agent suite had 212 PASS / 4 FAIL (hardlink EPERM and admission
fixture environment errors); the same 216-test revision passed outside the
sandbox without code changes. The final additional overflow case brings the suite
to 217 tests. These development failures are not Docker incident reproductions.

## Hosted Fast CI history

- Base main 84de165: [40954083259](https://github.com/Meta-Project2026/Metamorph/actions/runs/40954083259), SUCCESS.
- Initial delivery 29c7eb2: [40957473375](https://github.com/Meta-Project2026/Metamorph/actions/runs/40957473375), Node22/24 SUCCESS.
- Implementation 7f1a873: [40958154021](https://github.com/Meta-Project2026/Metamorph/actions/runs/40958154021), Node24 SUCCESS; Node22 FAILURE in existing shallow-history cleanup.

Node22 job 123743620682 passed root tests (including all new controls), build,
reference/target/differential, audit, research syntax and coverage validation.
The first shallow-history test then failed in `rmSync` with `ENOTEMPTY` under the
temporary clone's `.git/objects`. The second missing-remote negative test passed.
Connected adversarial and demo steps were skipped after this failure. This is
separate evidence from #84/#34; the responsible concurrent writer is UNKNOWN.
No retry, timeout increase, weakened assertion or unrelated CI fix is made here.
The failed workflow is not rerun. Final delivery CI is checked on its own SHA and
reported in PR #91; earlier results never attest the final head.

## Review and scope

Delivery: [PR #91](https://github.com/Meta-Project2026/Metamorph/pull/91),
refs #84 and #34. Request independent ChatGPT review against the final exact head,
its CI and the separately pinned three-run Docker matrix. Review is not an owner
approval until actually returned. No self-merge or issue closure.

Only `packages/agent-real/test/docker-reliability.test.mjs` and
`research/mmp-083/` change. The historical #34 proof job carried forward in the
attempt-2 API is not counted twice. Historical source receipts and fresh driver
receipts are labeled separately. #89 crypto/export, provider/billing, original
Oracle/comparator/fixtures and all workflows remain unchanged.
