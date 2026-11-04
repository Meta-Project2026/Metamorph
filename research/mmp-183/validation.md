# MMP-183 validation — 2026-11-04

Fetched base: `3cf75ae4124bd1ef3c61a6f20c7f0510369fec3d`.
Dedicated branch: `codex/mmp183-g0`.
Host: Windows / PowerShell, Node `v24.21.0`, pnpm `11.25.0`.
Exact committed HEAD and hosted Node22/24 results are published in the Draft PR;
this document cannot contain its own commit hash.

| Command actually executed | Exit / result |
| --- | --- |
| `git fetch origin main` (sandbox) | 1; FETCH_HEAD write denied |
| `git fetch origin main` (approved escalation) | 0; actual base above |
| `git worktree add -b codex/mmp183-g0 .worktrees/mmp183-g0 origin/main` | 0 |
| `gh pr list --repo Meta-Project2026/Metamorph --state open --json number,title,headRefName,files --limit 40` (approved network access) | 0; `[]` |
| `pnpm install --frozen-lockfile` (sandbox) | 1; shared-store EPERM |
| `pnpm install --frozen-lockfile` (approved escalation) | 0; frozen lock unchanged |
| `pnpm exec biome check --write packages/workshop-audit/src/g0 packages/workshop-audit/test/g0.test.mjs` | 0; scoped formatting |
| `pnpm exec biome check --write research/mmp-069/validate.mjs` | 0; scoped formatting |
| `pnpm lint` | 0; existing unrelated warnings/info remain |
| `pnpm typecheck` | 0 |
| `node --test packages/workshop-audit/test/g0.test.mjs` | 0; final 18 pass, 1 Windows POSIX skip, 0 fail |
| `node research/mmp-069/validate.mjs` | 0; inventory VALID, privileged runner NOT_RUN |
| `node --test research/mmp-069/validate.test.mjs` | 0; 45 pass, 0 fail/skip |
| `pnpm test` (sandbox) | 1; existing HTTP/filesystem environment failures |
| `pnpm test` (approved escalation) | 0; 875 pass, 131 platform skips, 0 fail (1,006 total) |
| `pnpm build` | 0; explicit final build (also ran within typecheck/test) |
| `pnpm --filter @metamorph/workshop-audit test` (sandbox) | 1; existing atomic-rename EPERM |
| `pnpm --filter @metamorph/workshop-audit test` (approved escalation) | 0; final 71 pass, 2 platform skips, 0 fail (73 total) |
| `pnpm --filter @metamorph/target-worker test` (sandbox) | 1; existing hardlink admission EPERM |
| `pnpm --filter @metamorph/target-worker test` (approved escalation) | 0; 69 pass, 0 fail/skip |
| `pnpm --filter @metamorph/differential test` | 0; 77 pass, 45 platform skips, 0 fail (122 total) |
| `pnpm exec biome check research/mmp-069/validate.mjs` | 0 |
| `git diff --check` | 0 |
| `docker info --format '{{.OSType}}'` | 1; Linux engine named pipe absent |
| Public/synthetic Linux Docker qualification | DOCKER_NOT_RUN |
| `node packages/workshop-audit/src/g0/cli.mjs synthetic C:\Metamorph\.tmp-mmp183-public` | 1; fixed `G0_LINUX_REQUIRED`; no candidate launched |
| Real candidate qualification | G0_REAL_CANDIDATE=NOT_RUN |
| Hosted Fast CI at final HEAD | PENDING; see Draft PR for exact-HEAD outcome |

The Windows skipped POSIX test is NOT_RUN locally, not success. Docker command
models, AST parsing, receipt checks and challenge observation models never
execute TS, compiled candidate JS or probe programs on the host. Hosted fast CI
does not execute actual G0 Docker qualification. No provider/API POST, model call,
paid/manual workflow dispatch, ciphertext/key/decryption or hidden corpus access
was performed. No owner agreement, independent review, product acceptance or
teammate notification is implied by these checks.

All sandbox failures above remain recorded as environment errors; successful
host-permission reruns do not rewrite them. The full root suite does not include
workshop-audit: its final suite was separately executed after the last G0-only
changes. The coverage validator's tests and actual inventory were also checked.

## PR #184 independent-review remediation — 2026-11-04

Review target was `14836568d8763eaaecde42b38cda31ce023ed1f9`, review
[5774098085](https://github.com/Meta-Project2026/Metamorph/pull/184#pullrequestreview-5774098085).
Fresh `origin/main` was `e0e971bd8d8c3d1a28c8332d42748e78e59a970a`.
Inspectable merge `ab2cbba484e33e7e86555a8a2fe0b490c02809a0` retains both original
parents, PR #185's G4 registry/package inventory and PR #184's G0 POSIX skip and
validator binding. No force push or history rewrite. The exact remediation HEAD,
new PR merge-ref/tree and actual hosted run IDs are recorded in the PR follow-up.

Before source changes, new regressions ran on that merge with tests-only edits:

| Command / observation | Actual result |
| --- | --- |
| `node --test --test-name-pattern='fully supported\|secondary integrity\|cleanup bounds' packages/workshop-audit/test/g0.test.mjs` | Exit 1; 0 pass / 3 fail. Empty unsupported rejected; secondary evidence fault returned FAIL; nonsettling join reached 500 ms HUNG guard |
| `node --experimental-test-module-mocks --test packages/workshop-audit/test/g0-run-controls.mjs` (corrected isolated harness, normal host permissions) | Exit 1; 0 pass / 6 fail. Behavioral/post-seal tamper returned FAIL; invalid live negative control qualification unexpectedly succeeded; finalizer tamper returned FAIL; missing verified-state fields; independent finalization blocked by join |

An earlier sandbox lifecycle attempt failed at atomic evidence rename (`EPERM`),
so did not reproduce the reviewed defects. One initial normal-host harness run
preloaded the unmocked runner via the synthetic import: 1 pass / 5 fail with
`G0_LINUX_REQUIRED`; that harness error was corrected before the baseline above.
Neither result is counted as a product regression. An initial sandbox formatter
attempt exited 1 when pnpm's store symlink was denied. Host-permission reruns
below succeeded; these environment failures are retained, not reclassified PASS.

Initial remediation local checks (committed as `1b39aabd926c39a327e2a952b1a3c78c49e9bba4`)
used Node `v24.21.0`, pinned pnpm `11.25.0`, Windows PowerShell,
the merged 12-package workspace and only original public/synthetic fixtures.
Normal host permissions were used for pnpm and evidence/ownership tests after
the observed sandbox failures. No candidate/probe programs ran on the host.

| Command | Exit / actual result |
| --- | --- |
| `git fetch origin main codex/mmp183-g0` | 0 after normal-permission rerun; initial sandbox exit 1, `.git/FETCH_HEAD` denied |
| `git merge --no-ff origin/main -m 'Merge current main with synthetic G4 inventory into MMP-183'` | 0; merge recorded above |
| `pnpm install --frozen-lockfile` | 0; lockfile unchanged, 12 workspace projects |
| Scoped `pnpm exec biome check --write` | 0; five G0 source/test files only |
| `pnpm lint` | 0; four existing warnings/two infos in unrelated agent-real files |
| `pnpm typecheck` | 0 |
| `pnpm test` | 0; 947 pass / 131 platform skips / 0 fail, including merged synthetic G4 registry tests |
| `pnpm build` | 0 |
| `pnpm --filter @metamorph/workshop-audit test` | 0; 77 pass / 2 Windows skips / 0 fail; includes the isolated seven-case receipt lifecycle suite |
| `node --test packages/workshop-audit/test/g0.test.mjs` | 0; 24 pass / 1 Windows POSIX skip / 0 fail |
| `node --experimental-test-module-mocks --test packages/workshop-audit/test/g0-run-controls.mjs` | 0; 7 pass / 0 fail / 0 skip (inner cases are not added to the parent suite totals) |
| `pnpm --filter @metamorph/target-worker test` | 0; 69 pass / 0 fail / 0 skip |
| `pnpm --filter @metamorph/differential test` | 0; 77 pass / 45 platform skips / 0 fail |
| `node research/mmp-069/validate.mjs` | 0; VALID, 12 packages; privileged runner NOT_RUN |
| `node --test research/mmp-069/validate.test.mjs` | 0; 45 pass / 0 fail / 0 skip |
| `git diff --check` | 0 |
| `docker info --format '{{json .}}'` | 1; Linux engine named pipe absent |
| Public/synthetic actual Docker qualification | DOCKER_NOT_RUN |
| Authentic candidate run / owner attestation | G0_REAL_CANDIDATE=NOT_RUN |

Corrected behavior: all material secondary faults override behavioral FAIL;
verified evidence is required in private live receipt state before qualification;
both catalogs and publication are checked. A nonsettling command/join cannot
prevent independent ledger finalization, produce normal zero counts, start
normal mutations after uncertainty or write sealed evidence on late settlement.
Underlying daemon completion remains unknown after abort failure; ERROR requires
owner/supervisor recovery, not a claim of successful cleanup. Exact known bundle
SHA is only `EXACT_PUBLIC_SHA_MATCHED_ATTESTATION_PENDING`; `realCandidate` cannot
be PASS in this module. Empty unsupported is valid; malformed/sparse/duplicate/
oversized/non-array exclusions and incomplete mandatory coverage still reject.

The isolated lifecycle tests use Node's experimental module mocks in a separate
test process; production `runG0` accepts no injected adapter, platform override or
expected verdict. The existing wildcard reaches that process without CI changes.
POSIX Windows skips remain NOT_RUN locally. Green Fast CI is implementation
evidence only. Independent exact-head ChatGPT re-review, real Linux Docker fault
qualification and owner-local authenticated candidate admission remain pending;
PR #184 stays Draft, #183 stays open and product acceptance is NOT_ESTABLISHED.

### Hosted cleanup race found and corrected before re-review

[Fast CI 41897530820](https://github.com/Meta-Project2026/Metamorph/actions/runs/41897530820)
at initial remediation HEAD `1b39aabd926c39a327e2a952b1a3c78c49e9bba4`, merge-ref
`f52df59984ac9008aca7bf1f9ebe3f576e0f4c6e`, **FAILED** on both Node22 job
`126810957501` and Node24 job `126810957644`. Both passed install/lint/typecheck/
root tests/build and earlier boundary checks, then workshop-audit exited 1:
78 pass / 1 fail / 0 skip. The strict abort-ignoring-cleanup regression observed
two (Node22) or three (Node24) commands where only one was safe. The later
coverage steps were skipped, not PASS. The merge tree matched HEAD tree
`3d5eb02862af48739a863acadd650a5c43df07d4`; this is a real implementation FAIL,
not an environment error or evidence for a real Docker verdict.

Cause: a fractional-duration timer can fire just before the monotonic deadline;
remaining clock time then allowed another cleanup command while the timed-out
operation still ignored abort. The correction adds a sticky cleanup-uncertainty
interlock and requires zero pending underlying commands before another cleanup
operation. It preserves the strict command-count assertion and exact-ID labels.
The independent finalizer uses its own fresh adapter and remains available.

A deterministic local regression gives cleanup one second but its first command
only five milliseconds. Before the interlock it exited 1 (0 pass / 1 fail,
two commands started). After the fix, that case and the existing cleanup-budget
case both passed (exit 0, 2 pass / 0 fail). No test or timeout was weakened.

Final targeted local reruns after this correction:

| Command | Exit / actual result |
| --- | --- |
| Scoped Biome format | 0; Docker adapter and G0 test only |
| `pnpm install --frozen-lockfile` | 0; lockfile unchanged |
| `pnpm lint` | 0; same four existing warnings/two infos |
| `pnpm typecheck` | 0 |
| `pnpm test` | 0; 947 pass / 131 platform skips / 0 fail |
| `pnpm build` | 0 |
| `pnpm --filter @metamorph/workshop-audit test` | 0; 78 pass / 2 Windows skips / 0 fail |
| `node --test packages/workshop-audit/test/g0.test.mjs` | 0; 25 pass / 1 Windows POSIX skip / 0 fail, including the seven inner lifecycle controls |
| `node research/mmp-069/validate.mjs` | 0; VALID, 12 packages; privileged runner NOT_RUN |
| `node --test research/mmp-069/validate.test.mjs` | 0; 45 pass / 0 fail / 0 skip |
| `git diff --check` | 0 |

The final exact HEAD, full check rerun results and replacement hosted Fast CI
run/merge-ref are recorded in the PR follow-up. The failed run above remains
part of the history; it was not rerun or renamed success.
