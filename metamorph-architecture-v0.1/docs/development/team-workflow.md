# Team workflow — Vladimir + Ilia

**Status: PROPOSED.** Two authors, one repo, short timebox. Use GitHub issues/PRs and Spec Kit but avoid Casper-style delivery gates.

## Ownership

| Stream | Primary owner | Concrete output |
|---|---|---|
| Migration + Meta | Vladimir | Meta API adapter, analyze→plan→generate→repair, budgeted strategies, orchestrator, server API integration |
| Independent verification | Ilia | PHP reference fixture/runtime, isolation, HTTP+SQLite comparator, G0–G4 controls, held-out scenarios |
| Web demo | Vladimir, after core slice | Minimal real run/evidence UI with real data, no mocked PASS |
| Integration and adversarial review | Both | Shared DTO review, negative controls, clean end-to-end demo, model strategy comparison |

Codify the smallest shared contracts before parallel work: `RunConfig`, `BenchmarkDefinition`, `GateResult`, `RunEvent`, `ModelUsage`. Put them in `packages/contracts`, avoid modifying on both branches simultaneously.

## Branch / PR policy

- `main` always runnable with at least the current baseline functionality.
- Branches `feat/agent-slice`, `feat/oracle-slice`, `feat/demo-ui` (or short task equivalents). Work in separate clones/worktrees; worktree usage is a convenience, not a mandatory task manager.
- Small PRs; one reviewer when practical. If a teammate is unavailable and merge is time-critical, self-merge is allowed after fast CI + explicit note on risk; never claim that implies Oracle PASS.
- Each PR states: feature, changed behavior, expected verification, real checks, follow-ups. No manual digest approval, required checklist of dozens of files, or repeated confirmation for each commit.
- Shared type/interface changes first as a tiny PR and rebased into both streams. Avoid direct changes to other's files without coordination.
- For 1-file low-risk corrections use issue/PR only; for new cross-cutting features use Spec Kit `specify → plan → tasks → implement → converge` (optional extra checks only if warranted).

## CI

**On every PR**: dependency install from lockfile, lint (when configured), typecheck, unit/contract smoke, build. **Target** 2–4 minutes; review if p95 exceeds 5 minutes. No model API calls, Docker builds, full PHP differential, concurrency, giant artifacts, repeated hashes on every PR.

**Before milestone/release**: explicit manually invoked integration workflow or local reproducible script that runs the pinned benchmark and mandatory Oracle scenarios. Failures must be recorded, not concealed. Keep any costly model tests on-demand with spending caps.

CI green = static/basic technical integration is healthy. It does **not** equal migration PASS. Product PASS requires Oracle evidence pack for the exact submitted candidate.

## Spec Kit concurrent use

Spec Kit chooses the active feature via `.specify/feature.json`, not merely Git branch. Prefer separate worktrees for each owner, or explicitly set `SPECIFY_FEATURE_DIRECTORY` for command runs with `SPECIFY_FEATURE_NO_PERSIST=1` when sharing one checkout. Do not edit one `tasks.md` from two concurrent agents. Authoritative spec/ADR lives in Git; local active feature pointer must not be committed.
