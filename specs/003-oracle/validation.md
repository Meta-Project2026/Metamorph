# Local validation — MMP-002

2026-10-27, Windows PowerShell, Node **v24.21.0**, pnpm **11.25.0**, built-in
SQLite **3.53.4**. Base fetched from origin/main:
`081e1b999e2573d3897b2b0b00d444ecb799e140`. Branch `feat/mmp-002-oracle`.

## Executed commands

| Command | Final exit | Actual outcome |
| --- | --- | --- |
| `git fetch origin main` / `git switch --create feat/mmp-002-oracle origin/main` | 0 | Current main fetched, separate branch created |
| `gh issue view 2 --repo Meta-Project2026/Metamorph --json title,body,state,url` | 0 | Live acceptance contract read |
| `pnpm install --lockfile-only` | 0 | Only Oracle workspace link added; no upstream version/integrity changes |
| `pnpm install --frozen-lockfile` | 0 | Four workspace projects, pinned dependencies installed |
| `pnpm lint` | 0 | 25 source/config/test files checked |
| `pnpm typecheck` | 0 | Contracts/public consumer, Oracle and server checked |
| `pnpm test` | 0 | 25 passed, 0 failed/skipped, including real HTTP and separate SQLite files |
| `pnpm build` | 0 | All three packages compiled |
| `pnpm --filter @metamorph/oracle controls -- ../../.oracle-evidence` | 0 | Six independent pairs produced raw evidence and expected outcomes |
| `check-prerequisites.ps1 -Json -RequireSpec -RequireTasks -IncludeTasks` with explicit 003/non-persisting environment | 0 | Resolves specs/003-oracle; feature pointer unchanged |
| `git diff --check` | 0 | No whitespace errors |
| `git diff --exit-code -- packages/contracts apps/server .github .specify .agents metamorph-architecture-v0.1` | 0 | Shared contracts, health, CI, scaffold and proposals unchanged |

The initial sandboxed install was stopped after registry EACCES (exit 1), then
rerun with authorized network access (0). Initial typecheck/test build failed on
an implicit-any validation callback; corrected. The first executable test suite
had 21/23 passing because two Windows cleanup hooks removed still-open SQLite
files; fixed by closing connections before removing temporary directories. No
assertions or comparison requirements were weakened. Final suite is 25/25.

## Observed fixture outcomes

| Executed pair | G2 (public fixture scope) | G3 (public fixture scope) | Meaning |
| --- | --- | --- | --- |
| none | PASS | PASS | Equal POST/write → GET/read, then a fresh-state scenario |
| http-status | FAIL | FAIL | Changed status rejected |
| http-type | FAIL | FAIL | Number/string mutation rejected |
| db-row | PASS | FAIL | Internal logical row differs while HTTP remains identical |
| db-sequence | PASS | FAIL | sqlite_sequence differs while HTTP remains identical |
| snapshot-error | ERROR | ERROR | Broken snapshot never produces PASS; completed reference observation retained |

Nine independent comparator controls passed in each pair. Injected always-equal
HTTP/DB comparators are rejected (control FAIL); throwing/malformed comparators
are control ERROR. Unit tests also execute initial-state mismatch, missing/empty
scenarios, invalid/aliased adapters, timeout, cleanup failure and evidence
publication failure. G4 remains **INCONCLUSIVE** in every pair because held-out
isolation was not executed; the independent synthetic controls themselves PASS.

[local-results.json](local-results.json) records actual reviewed public outcomes,
IDs and runtime metadata from the controls command. Full generated packs live in
ignored `.oracle-evidence/`; each gate evidence reference was checked to resolve to
a real file. Re-run the controls command to regenerate raw HTTP/DB/diffs, events,
manifest, model-usage and HTML report. No real benchmark answers or held-out cases
are committed. Local results are distinct from hosted CI and owner acceptance.

## Remaining limitations

Real PHP 7.4 startup/extensions/stateful repeatability and the manual Docker assets
are **NOT_RUN**: no Docker/Podman executable or installed WSL distribution.
[Qualification report](benchmark-qualification.md) gives pinned source findings,
MIT provenance, nondeterminism and bounded reproduction instructions. No benchmark
selected; no runtime/image digest invented. This PR must use **Refs #2**.

G0 target independence, G1 real candidate build, held-out isolation, full benchmark
parity and model integration are NOT_RUN. The package's Promise timeouts and typed
broker interface are not OS isolation. Only original trusted synthetic fixtures
executed on the host. Candidate provisioning and external enforcement remain
future work. Both-owner agreement and governance ratification remain pending.

## Delivery

Implementation commit: `c281b24c6309d30f290c02225209d14a46a24b7f`.
`git commit`, `git push --set-upstream origin feat/mmp-002-oracle` and
`gh pr create --base main --head feat/mmp-002-oracle --body-file ...` exited 0.
[PR #5](https://github.com/Meta-Project2026/Metamorph/pull/5) uses `Refs #2` and
records the current head SHA, local results and remaining blockers. It has not
been merged. A documentation-only follow-up records this delivery.
