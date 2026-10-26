# Validation — MMP-005

2026-10-27, Windows PowerShell, Node v24.21.0, pnpm 11.25.0. Started from
`4dbd38e4d9853afd3f81115a9fd8a18308f16f98`; incorporated updated main
`0a4eaf46d56a934a4a82ff04a0ef72284bb074dd` with the parallel MMP-004 work.
Only README prose conflicted; both integration context and the new qualification
link were retained. Protected code has no diff against that main.

| Final command | Exit | Actual result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | Six workspace projects; committed lockfile unchanged by this task |
| `pnpm lint` | 0 | 50 source/config/test files |
| `pnpm typecheck` | 0 | All five packages, including integration and public contract consumer |
| `pnpm test` | 0 | **65/65** passed, no failures/skips; retains all original 51 tests |
| `pnpm build` | 0 | All five packages compiled |
| `node --test packages/oracle/probes/qualification.test.mjs` | 0 | **2/2** sanitizer/recipe tests |
| Existing `BenchmarkDefinitionSchema.parse` on benchmark-proposal.json | 0 | Valid declaration only; no registration or approval |
| Explicit 006/non-persisting Spec Kit prerequisites | 0 | Feature resolves without shared pointer writes |
| `git diff --check` | 0 | No whitespace errors |
| Protected-path diff against current main | 0 | Agent/integration/contracts/core Oracle/Fast CI/specs 005/scaffold unchanged |

Before incorporating parallel main, the prior 51-test suite also passed. Its
subsequent two-tree protected comparison reported expected older-branch differences
against updated main; the branch was brought forward and all 65 tests were then
executed. This was not a test failure or removal of protected files.

Initial sandboxed pnpm execution hit a store-symlink permission error; authorized
frozen install succeeded. The first new probe test had a wrong repository-relative
workflow path and then a whitespace-sensitive source check; both were corrected
before the real job. Final assertions retain resource/isolation checks. No tests
or expected business results were weakened for green output.

The real PHP commands execute only through the dedicated Docker job. Final
[run 40420872942](https://github.com/Meta-Project2026/Metamorph/actions/runs/40420872942)
uses exact HEAD `43287bb38280b4bf9b9fc93185c52ab1aaad809e`: checkout, two probe
tests, qualification and sanitized artifact upload all succeed. Docker version/
info/pull/build/inspect and three PHP containers exit 0. Lint (26 and 6 files),
version/modules commands, twelve ExamSuite init/seed commands, verified PHP/SQLite
frozen-clock check, all 94 HTTP-step assertions and lock probes succeed.
GO applies only to the 34-step controlled workshop profile with two exact clean
replays. Its ordinary profile and ExamSuite remain NO-GO for exact replay.

Hosted Fast CI Node 22/24 passed at initial runtime infrastructure HEAD
`bc9a172d0436286140e56d8b050239529d6c9f71`
([run 40419976692](https://github.com/Meta-Project2026/Metamorph/actions/runs/40419976692)).
Final follow-up PR checks are reported from GitHub after publication; prior hosted
checks and local 65-test execution are distinct facts. The actual qualification
scripts remain byte-for-byte the tested scripts at the final PHP run SHA; later
changes add reports/links and incorporate existing main integration code.

Raw PHP evidence was ephemeral and is not retained for later inspection; only
sanitized structural metadata/hashes and a repeatable recipe remain. Production
PHP/TS adapters, target G0/G1, concurrency, clock boundaries, held-out G4, provider
calls and product acceptance: NOT_RUN. Both-owner benchmark registration and
governance ratification remain pending. No model usage/spend was incurred here.
