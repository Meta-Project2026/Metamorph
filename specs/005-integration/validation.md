# MMP-004 local validation — 2026-10-27

Windows PowerShell, Node v22.23.1, pnpm 11.25.0. These commands actually ran:

| Command | Exit | Observed result |
| --- | --- | --- |
| `pnpm install --lockfile-only` | 0 | New workspace importer only; no dependency versions added |
| `pnpm install --frozen-lockfile` | 0 | Six workspace projects |
| `pnpm lint` | 0 | 47 source/config/test files checked |
| `pnpm typecheck` | 0 | Dependency builds and all workspace type checks |
| `pnpm test` | 0 | 65/65 passed, zero failed/skipped/cancelled; all original 51 retained |
| `pnpm build` | 0 | All packages in dependency order |
| `pnpm demo:agent` | 0 | Existing scripted lifecycle, one repair and one escalation |
| `pnpm demo:integration` | 0 | Actual Oracle FAIL -> one repair -> G2/G3 PASS -> agent INCONCLUSIVE |
| Spec Kit prerequisites: `-Json -RequireSpec -RequireTasks -IncludeTasks` | 0 | Explicit 005 selection with NO_PERSIST=1 |
| `git diff --check` | 0 | No whitespace errors |
| Protected-scope diff against `origin/main` | 0 | Agent, Oracle, Contracts, server, CI, governance/scaffolding and specs 002–004 unchanged |

The 14 added tests include independent real HTTP/SQLite comparison, fresh pairs,
current source hashes, actual private evidence files, exact colon-containing
coverage IDs, missing/duplicate steps/scenarios, malformed reports, missing/indexed
and tampered evidence, public feedback allowlisting, zero budget, repair/escalation
exhaustion, worker exception/timeout/failed close, failed evidence publication,
pre-abort, cancellation, deadline, stale candidate and protected write paths.
Fault-only unit cases do not replace real Oracle execution in successful runs.

The [sanitized observed demo summary](public-results.json) derives from the actual
retained temporary manifest; every referenced evidence file was checked on disk.
Each attempt retains its own real Oracle manifest, gate-results, event journal,
controls, HTTP/DB observations and diffs, with a separate integration-attempt
record binding the agent runId, attempt number and candidate hash. Raw evidence
and absolute paths are deliberately excluded from committed artifacts.

Changed files: root `README.md`, `package.json`, `pnpm-lock.yaml`; integration
`README.md`, `package.json`, `tsconfig.json`, `src/{demo,fixtures,index,report,run,verifier}.ts`,
`test/integration.test.mjs`; feature `spec.md`, `plan.md`, `tasks.md`,
`validation.md`, `public-results.json`.

Hosted Node 22/24 results are recorded separately in the PR checks after
publication; this local record does not establish hosted success or owner review.
PHP 7.4 qualification/baseline, real Meta model, G0, G1 and held-out G4: NOT_RUN.
PRODUCT_PASS=NOT_ESTABLISHED; independent review and merge remain pending.
Issue #2 was already CLOSED when read; no state change was made or qualification
inferred. Oracle cancellation lacks a process-termination boundary; see package
README for bounded async cleanup and the next isolated-worker gate.
