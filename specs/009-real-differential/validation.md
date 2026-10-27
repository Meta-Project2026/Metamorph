# Validation

Base main: `49859eab33d5979336f19dbbf75519f0dc1dcfd2`. Refs17.
Implementation under validation; DOCKER_PILOT=NOT_RUN until real execution.

Executed locally so far:

| Command | Exit | Evidence |
|---|---:|---|
| `pnpm install --frozen-lockfile` | 0 |8 workspace projects; only new importer links |
| `pnpm --filter @metamorph/differential test` | 0 |52 original synthetic/boundary controls |
| `pnpm lint` | 0 |Trusted workspace lint/format |
| `pnpm typecheck` | 0 |All8 workspace projects, local boundary declaration only |
| `pnpm test` | 0 |All65 original core tests, no skips |
| `pnpm build` | 0 |All workspace packages, no candidate execution |
| `node --test packages/target-worker/test/*.test.mjs` (sandbox) | 1 |EPERM hardlink environment restriction |
| same target tests (authorized host) | 0 |All33 pass, unchanged tests |
| `pnpm --filter @metamorph/oracle test:reference` | 0 |37 pass,1 POSIX-only skip on Windows |
| latest `pnpm --filter @metamorph/differential test` | 0 |52 pass,1 POSIX catalog test skipped on Windows |
| `git diff --check` | 0 |Scoped changes only |

No synthetic adapter PASS is represented as PHP↔TS parity. Real expected matrix
has not yet been measured. Await actual G2/G3/G4 and executed IDs before reporting.
Remaining checks/hosted CI/pilot/artifact URL/SHA will be recorded after execution.

Known boundary: target regular state volume lacks enforced hard byte quota;
16MiB inspector admission is only a parser limit. Any DoD interpretation requiring
a generic adversarial write-quota guarantee remains BLOCKED pending the target
owner's API proposal. Protected code is unchanged. No false isolation certification.

External retention: EVIDENCE_RETENTION_NOT_CONFIGURED / EXTERNAL_RETENTION_NOT_RUN.
Product PASS NOT_ESTABLISHED; G0/G1 complete migrated target, held-out G4,
concurrency, clock advance/DST, registration, owner sign-off and model calls NOT_RUN.
