# MMP-125 validation — read-only phase

Base: `074af751e9012abad1be2749c360c5d8b86218e0`, fetched canonical main.
Post-merge [CI41375878083](https://github.com/Meta-Project2026/Metamorph/actions/runs/41375878083)
was independently read SUCCESS on Node22/24. Dedicated branch
`codex/mmp125-first-http-forensics`, existing clean isolated checkout reused after
the completed/merged PR117. No teammate checkout or active feature pointer edited.

## Actually executed locally

Windows Node24.21.0 / pnpm11.25.0. Commands executed against the MMP125 source
working tree before delivery commit; only this validation document was added
after that full cycle. Exact final source SHA and hosted run/job evidence are
recorded in the PR conversation after commit. Old CI is not reused.

| Command                                                                              | Exit | Result                                                       |
| ------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------ |
| pnpm install --frozen-lockfile                                                       | 0    | Frozen install                                               |
| pnpm lint                                                                            | 0    | PASS                                                         |
| pnpm exec biome check research/mmp-125                                               | 0    | New audit/tests/docs/config lint/format PASS                 |
| pnpm typecheck                                                                       | 0    | PASS                                                         |
| pnpm test                                                                            | 0    | 782 total / 672 PASS / 110 Windows/environment SKIP / 0 FAIL |
| pnpm build                                                                           | 0    | PASS                                                         |
| node research/mmp-069/validate.mjs                                                   | 0    | VALID; 99 research modules                                   |
| node --test research/mmp-069/validate.test.mjs                                       | 0    | 45 PASS / 0 FAIL                                             |
| node research/mmp-069/check-syntax.mjs                                               | 0    | 98 files syntax PASS; modules not executed                   |
| node research/mmp-125/audit.mjs                                                      | 0    | 47 pinned public inputs; AUDIT_COMPLETE_CAUSE_UNRESOLVED     |
| node --test research/mmp-125/audit.test.mjs                                          | 0    | 21 PASS / 0 FAIL / 0 SKIP                                    |
| node --test packages/agent-real/test/verifier-forensics.test.mjs                     | 0    | 20 total / 19 PASS / 1 Linux-only preserver SKIP / 0 FAIL    |
| node --test research/mmp-108/*.test.mjs, with available Git sh on process-local PATH | 0    | 18 PASS / 0 FAIL; stateful Docker stub only                  |
| git diff --check; scoped protected-content comparisons                               | 0    | No scoring/source/candidate/receipt/workflow changes         |

The first additional MMP108 shell-suite invocation exited1: 18 total / 8 PASS /
10 FAIL because sh was not resolvable from this Windows PATH (spawn status null).
A shell-only probe confirmed ENOENT. After adding the existing
C:/Program Files/Git/bin to only that command's PATH, a shell-only exit0 probe and
the unchanged suite passed18/18, exit0. Its docker is a private stateful stub,
not the real daemon; no real Docker invocation/container/volume was made.
The initial nested Biome config used a string instead of the required path array;
corrected to the repository's existing root:false/extends-array convention.

Initial strict pinning also detected Windows autocrlf drift in four clean tracked
Dockerfile/shell files. They were rehydrated from exact HEAD Git blobs; scoped
git diff/cached comparisons exit0. Auditor/source/recipe normalization was not
added. The dedicated newline-drift negative control passes. No candidate TS or
historical JSON bytes changed.

## Scope and evidence limits

Only research/mmp-125/** and one accurate LOCAL_ONLY / GATED_HOSTED_SYNTAX /
NOT_VERIFIED coverage row are changed. All existing matrix rows are retained.
New21 behavior controls are **local-only, not hosted-gated**; existing CI only
syntax-checks these new modules. No package test bridge or CI expansion is used
to disguise that distinction. The existing root/forensic/MMP108 suites are
independent trusted synthetic controls, never candidate execution on the host.

The audit independently recomputes original/repaired candidate hashes and target
runtime recipe from exact byte-pinned data. Its negative controls reject false
semantic-FAIL/error equivalence, wrong stage/counts, discarded findings, side/error
claims, changed/foreign receipts and run heads, mutated/extra/linked source or
recipe files, namespace aliases, newline drift and invalid CLI arguments.
The report contains fixed categorical fields, hashes and counts only.

Historical MMP104/MMP108/MMP123 Docker execution remains agent-reported prior
evidence, not rerun here. The owner explicitly reported no retained local MMP123
private evidence copy; private inspection, Docker volume inventory and hidden G4
are NOT_RUN. Same public shape cannot identify a side or establish identical
causes. Root cause / failed side / error class remain UNKNOWN.

The separate diagnostic-plan.md is PROPOSED / NOT_AUTHORIZED / NOT_RUN. Its
instrumentation controls are proposals, not executed tests. No provider/model
call, paid workflow/validate_only/rerun, second repair, new Docker run, private
key, artifact upload or product/G4 acceptance. #116 HOLD; #61
PRODUCT_NOT_ESTABLISHED. Keep #125 OPEN for its separate owner decision and
independent exact-SHA review; no self-merge.
