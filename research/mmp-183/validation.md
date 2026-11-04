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
