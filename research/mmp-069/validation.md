# CI triple validation — 2026-10-29

PR [#90](https://github.com/Meta-Project2026/Metamorph/pull/90);
Refs #74, #63, #69. No merge or issue closure; independent review pending.

Implementation commit: `a2f03d97c53926786632569ddff77a49c271658a`.
Base/main verified again after tests:
`c3ddf08b1a7774c4a5ddecf89fd668c6b81c7651`.
Subsequent delivery changes only documentation and classification of #61/#78 as
PRIVILEGED_NOT_RUN (their secret-bound manual entrypoints are not CI executions).

## Actual hosted evidence

[Fast CI 40950462847](https://github.com/Meta-Project2026/Metamorph/actions/runs/40950462847)
completed SUCCESS for both Node22 and Node24 on implementation HEAD.

- [Node22 job 123716905703](https://github.com/Meta-Project2026/Metamorph/actions/runs/40950462847/job/123716905703)
- [Node24 job 123716905442](https://github.com/Meta-Project2026/Metamorph/actions/runs/40950462847/job/123716905442)

GitHub PR checks execute the generated merge context, not a detached branch HEAD.
Both checkout logs show `--depth=1`, merge commit
`7591ca8d46c1dec37d72f0d4e6d4e3bea1b41984` for PR90 at the above HEAD.
Both history-bootstrap steps report VERIFIED with exact pins/fix/parent/digests.
The depth-one clone negative controls then prove missing-history failure and
bounded recovery without any full-history fallback or skipped tests.

Actual per-job summaries, identical counts in both jobs:

| Suite | Total | PASS | FAIL | SKIP |
| --- | ---: | ---: | ---: | ---: |
| Root | 439 | 436 | 0 | 3 |
| Oracle reference | 56 | 56 | 0 | 0 |
| Target-worker | 69 | 69 | 0 | 0 |
| Differential | 122 | 122 | 0 | 0 |
| PHP qualification | 2 | 2 | 0 | 0 |
| Workshop-audit | 54 | 54 | 0 | 0 |
| Coverage CLI controls | 45 | 45 | 0 | 0 |
| Shallow history controls | 2 | 2 | 0 | 0 |
| Original connected adversarial checks | 21 | 21 | 0 | 0 |
| Demo-readiness | 50 | 50 | 0 | 0 |

Frozen install, lint, typecheck, build, scoped research lint and actual matrix
validation all succeeded. Syntax checker parsed all 56 active MJS modules,
zero failures, zero module execution. Runtime roughly 2m20s Node24 / 2m45s Node22
including setup; eight-minute job timeout unchanged.

The three root SKIPs are one Windows-specific ACL test and two root/uid-dependent
isolation tests. None is counted as PASS. No dedicated privileged runner decision.
PR87's additional demo files were not in this checkout: 50 is observed, 83 is not.
The wildcard and positive discovery control cover future test-file additions.

## Actual local checks

Windows, Node v24.21.0, pnpm11.25.0. All final commands below exited 0:

| Command | Observed result |
| --- | --- |
| pnpm install --frozen-lockfile | exact lockfile installed |
| pnpm lint | 192 files; final pass has no warnings |
| pnpm typecheck | all configured checks pass |
| pnpm test | 439 total, 337 PASS, 102 platform SKIP, 0 FAIL |
| pnpm build | all build scripts pass |
| pnpm --filter @metamorph/workshop-audit test | 54 total, 53 PASS, 1 POSIX SKIP |
| pnpm --filter @metamorph/oracle test:reference | 56 total, 55 PASS, 1 POSIX SKIP |
| pnpm --filter @metamorph/target-worker test | 69/69 PASS |
| pnpm --filter @metamorph/differential test | 122 total, 77 PASS, 45 platform SKIP |
| node --test packages/oracle/probes/qualification.test.mjs | 2/2 PASS |
| node --test research/mmp-054-connected/verify.test.mjs | 21/21 PASS |
| node --test research/mmp-054-connected/history.test.mjs | 2/2 PASS |
| node --test research/demo-readiness/*.test.mjs | 50/50 PASS |
| node --test research/mmp-069/validate.test.mjs | 45/45 PASS, including 43 nonzero invalid mutations |
| node research/mmp-069/validate.mjs | VALID, actual 11 manifests and 33 selected test files |
| node research/mmp-069/check-syntax.mjs | 56 modules, 0 failures, parse only |
| scoped pnpm exec biome check (demo/069/connected) | 11 files, clean |
| git diff --check | clean after removing a trailing README blank line |

Initial sandbox attempts failed at pnpm store registration, Git metadata writes
inside temporary repositories and loopback HTTP root tests. These are retained
as environment limitations, not passing test evidence. The same unchanged tests
passed with authorized normal host access; no assertion, skip or timeout was
weakened. An initial diff-check detected one trailing blank line; corrected in
delivery. Initial lint warnings for literal GitHub expressions were resolved
with local explanatory suppressions, no global rule disabling.

## Historical authenticity

Bootstrap fetches only:
- `7cf6e678802802d16336685771c842d0ce6cf37d`
- `8779dfeec71ac9ae3906859c15a237ec2b3f6f24`

Depth 2 verifies parent `bcf8275cb2673abbda7a340e25f8c8d5b01198bb`.
Historical pins SHA256:
`8ed5d1eb8d62ac51db97e1d05a755809fabb6b69f945e56fdeb7c1488857f7bc`.
Previous runner SHA256:
`87a9c4528402937d1be54a70a8903dc3ff025c3270b4a1eae93e404028aab94b`.
Original pin-refresh assertions and verifyPins implementation are unchanged.

## Limits / independent reviewer action

#74 and #63 have hosted acceptance evidence; keep open pending independent
review. #69 remains OPEN: active manual harnesses have syntax checks but lack
complete semantic lint/unit coverage; the separate privileged runner is
NO_DECISION / NOT_RUN. Matrix gaps identify these tracks explicitly.

Review PR90's final exact HEAD, especially disabled/inert workflow mutations,
real package/test discovery and the pinned parent/digest bootstrap. Confirm
Node22/24 final checks before accepting #74/#63. No self-review or merge.

No Meta GET/POST, model candidate, Docker/manual dispatch or private evidence was
executed/accessed by this task. G0/G4 INCONCLUSIVE; product NOT_ESTABLISHED.
#84, #89 and historical ROOT_CAUSE_UNKNOWN are unaffected.
