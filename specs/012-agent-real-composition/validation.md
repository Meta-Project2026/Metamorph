# MMP-010A validation

Base main: `3de9d5ceef343536a5b56761deb805006fbd4b65`.
Isolated branch: `feat/mmp-010a-real-agent-composition`.
Local platform: Windows, Node22.23.1, pnpm11.25.0. Docker is unavailable locally;
candidate PHP/TS has not been executed on this host.

Local checks: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`,
`pnpm test` and `pnpm build` each exited0. Root test now runs the original65 plus
16 new tests:81/81PASS. New synthetic tests separately16/16, exit0.
Original reference/target/differential suites were executed together using
`node --test packages/oracle/reference/reference.test.mjs packages/oracle/reference/acceptance.test.mjs packages/target-worker/test/*.test.mjs packages/differential/test/*.test.mjs`:
203 total,201 passed,2 existing POSIX-only skips,0 failures, exit0.
Individual required commands also exited0:
`pnpm --filter @metamorph/oracle test:reference`:56 total,55PASS/1POSIX skip;
`pnpm --filter @metamorph/target-worker test`:69/69PASS;
`pnpm --filter @metamorph/differential test`:78 total,77PASS/1POSIX skip.
Exact-head hosted evidence will be linked in the PR. This implementation record
does not claim hosted success before the run finishes.

Hosted real Agent positive/repair proof: NOT_RUN at initial implementation.
Hosted runtime failure controls and final inventory: NOT_RUN at initial
implementation. They require dispatch of the new manual-only workflow.
No external raw retention is configured: EXTERNAL_RETENTION_NOT_RUN.

Required semantics: good G1/G2/G3 PASS with17HTTP/20SQLite, G0/G4 INCONCLUSIVE,
Agent INCONCLUSIVE. Broken public cancellation must produce real FAIL; one repair
requires a changed SHA and distinct packs, with all17/20 operations executed again.
No counts in this paragraph are execution claims.

Unexecuted runtime faults are never promoted from synthetic tests. The published
summary labels original real Docker controls separately. Agent timeout/cancel
returns are joined with pending work before final inventory/sealing. A cleanup
fault stays ERROR even if emergency reaping ultimately reaches zero resources.

No paid requests, guessed prices/model APIs, hidden inputs or held-out evidence.
No G0/G4/product PASS, AI-generation claim, owner agreement, merge or issue closure.
