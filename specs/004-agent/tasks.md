# MMP-003 tasks

Checkmarks mean completed implementation or executed validation, not owner review
or product acceptance. See [spec](spec.md) and [plan](plan.md).

- [x] T001 Read current issue/contracts/governance and create isolated worktree.
- [x] T002 Write compact 004 spec/plan/tasks without changing feature pointers.
- [x] T003 Implement ports, bounded orchestration and validated event journal.
- [x] T004 Implement fresh candidate source writer and disabled Meta seam.
- [x] T005 Add deterministic doubles, runnable demo and adversarial tests.
- [x] T006 Add package to fast checks; document bounds and integration blockers.
- [x] T007 Run local fast checks, demo, prerequisites and scope verification.
- T008 Delivery: commit, push, open unmerged PR and observe hosted fast CI. The PR
  description/checks and final delivery message record these external actions;
  this local checklist does not assert their result before publication.

Live Meta probe, actual Oracle/PHP/benchmark execution and owner review: NOT_RUN.

## Local validation — 2026-10-27 (Europe/Chisinau)

Windows PowerShell; Node v22.23.1; pnpm 11.25.0. All checks below actually ran.

| Command | Exit | Observed result |
| --- | --- | --- |
| `pnpm install --lockfile-only` | 0 | Added only agent importer; no new package versions |
| `pnpm install --frozen-lockfile` | 0 | Four workspace projects installed |
| `pnpm lint` | 0 | 26 files checked; no remaining lint/format issues |
| `pnpm typecheck` | 0 | Contracts, public type consumer, server and agent |
| `pnpm test` | 0 | 36 passed; 0 failed/skipped/cancelled, including real HTTP health smoke |
| `pnpm build` (executed by test and demo scripts) | 0 | Contracts then agent/server compiled |
| `pnpm demo:agent` | 0 | Executed synthetic lifecycle; 3 model-script calls, 1 repair, 1 escalation |
| `check-prerequisites.ps1 -Json -RequireSpec -RequireTasks -IncludeTasks` | 0 | Explicit 004 feature, with `SPECIFY_FEATURE_NO_PERSIST=1` |
| `git diff --check` | 0 | No whitespace errors |
| `git diff --exit-code origin/main -- packages/contracts apps/server .github .agents .specify metamorph-architecture-v0.1 specs/003-oracle` | 0 | Shared contracts, health, CI, governance, scaffold and Oracle scope unchanged |
| `git -C 'C:\Users\user\Documents\1. Metamorph' status --short` | 0 | Original checkout still clean |

The demo emitted 28 schema-validated events: 10 lifecycle states, 3 synthetic
usage receipts and 15 scripted gate results. It reached synthetic PASS, retained
inert candidate text in its new temporary directory, reported null total usage
cost and explicit liveMeta/realOracle NOT_RUN. No candidate text was executed.

Paid-budget tests prove zero/unknown-bound admission blocking, conservative full
request reservations even with lower cost estimates, stop on unknown paid usage,
and rejection of bound violations before writes. Deadline tests exercise ignored
abort/late responses; filesystem tests exercise traversal, reserved names,
directory junctions and hardlinks without changing external reference bytes.

Hosted Linux / Node 24 status belongs to the PR checks, independently of these
Windows results. Live Meta/real Oracle/PHP/isolation execution: NOT_RUN. Credentials,
model IDs, API host/auth/prices, entitlements and billable probe authorization are
unverified integration blockers. No benchmark selected or owner agreement inferred.
