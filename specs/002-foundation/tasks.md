# Tasks: MMP-001 foundation

**Input**: [spec.md](spec.md), [plan.md](plan.md). Vladimir implements foundation;
Ilia owns the next independent Oracle stream. Checkmarks mean implementation/local
validation, without hosted CI or teammate approval.

## Setup

- [x] T001 Inspect clean baseline, proposals, Spec Kit and tools; create task branch
  without changing local feature state.
- [x] T002 Add root workspace/configuration and exact `pnpm-lock.yaml`.

## US2 — Shared boundaries (blocks server)

- [x] T003 Implement strict typed schemas in `packages/contracts/src/index.ts`.
- [x] T004 Add schema tests and public consumer in `packages/contracts/test/`;
  independently compile contracts.
- [x] T005 Document refinements/unchanged G0–G4 meaning in `interface-note.md`.

## US1 — Runnable foundation

- [x] T006 Implement health/loopback CLI in `apps/server/src/`.
- [x] T007 Add injection and built CLI HTTP smoke in `apps/server/test/` without
  credentials or PHP on PATH.
- [x] T008 After scripts/lockfile exist, add required fast CI in
  `.github/workflows/ci.yml` for PR/main with eight-minute timeout.
- [x] T009 Add Windows/parallel-work instructions in root `README.md`; preserve
  architecture documents and generated scaffold.

## Local verification and delivery

- [x] T010 Execute frozen install, lint, typecheck, tests, build, 002 prerequisites
  and Git diff checks; report true outcomes and remaining NOT_RUN.
- [x] T011 Review and create local implementation commit; report branch/SHA/status.
  No remote writes, push, PR, merge or deploy.

## Separate next tasks

**MMP-002 Oracle foundation — Ilia**: independent runner/comparator/controls and
isolated PHP 7.4 qualification before selecting a benchmark.

**MMP-003 Agent foundation — Vladimir**: bounded orchestration/adapter foundation;
actual API entitlement/model probe requires separate authorization.

Both-owner shared interface review remains pending; no approval is inferred.

## Local validation — 2026-10-26

Windows PowerShell, Node 22.23.1, pnpm 11.25.0:

| Command | Exit | Outcome |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | Three workspace projects; lockfile unchanged |
| `pnpm lint` | 0 | 14 source/config/test files checked |
| `pnpm typecheck` | 0 | Contracts, public declarations consumer and server checked |
| `pnpm test` | 0 | 10 passed, 0 failed/skipped; includes built CLI HTTP with no credentials/PATH |
| `pnpm build` | 0 | Contracts and server compiled in dependency order |
| `pnpm --filter @metamorph/contracts build` (also run by typecheck) | 0 | Standalone contracts declarations/JS emitted |
| `check-prerequisites.ps1 -Json -RequireSpec -RequireTasks -IncludeTasks` | 0 | Explicit 002 feature resolves with no pointer persisted |
| `git diff --cached --check` | 0 | No whitespace errors in staged implementation |
| `git diff --cached --exit-code -- .agents .specify metamorph-architecture-v0.1` | 0 | Generated scaffold and imported proposals unchanged |

Initial lint exited 1 for smoke-test formatting; it was corrected and the final
lint command above exited 0. No check was made optional or bypassed.

Hosted Linux CI and Node 24 execution: NOT_RUN. Full Oracle/PHP parity and model
integration: NOT_RUN, not implemented. Both-owner approval: pending. No source
benchmark selected; schema tests use synthetic fixtures only.
