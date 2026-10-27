# Validation

Base main: `49859eab33d5979336f19dbbf75519f0dc1dcfd2`. Refs17.
Real initial-state differential executed successfully as an incompatibility pilot.
This is separate from successful migration or complete acceptance of every
isolation property. Hard target write quota remains BLOCKED_TARGET_OWNER_API.

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

Latest bridge controls:56 tests,55 pass and1 POSIX-only skip on Windows, exit0.

Hosted diagnostic attempts (not successful differential proof):

- [40439547218](https://github.com/Meta-Project2026/Metamorph/actions/runs/40439547218),
  SHA367c2a8c7ce538458684e432a09b6aac8895abb0: workflow rejected before job;
  runner context was invalid in job.env. Set private/public paths inside a step.
- [40439677119](https://github.com/Meta-Project2026/Metamorph/actions/runs/40439677119),
  SHAa4a55bba36f52c863d5669f2b326670768838282: root checks, Linux bridge/worker
  tests pass. Both runtime preparations/clock proof run; publication retain
  failed after actual Oracle error/no initial comparison. Cleanup verified0/0.
- [40440031797](https://github.com/Meta-Project2026/Metamorph/actions/runs/40440031797),
  SHA32444a94e802c3ec3a0ffc45b243428d2fb09893: G2 ERROR/G3 ERROR, both0 executed;
  G4 INCONCLUSIVE with9 controls. Target operation/cleanup errors NONE. Runtime
  ERROR was traced to private umask077 removing public archive group/other read
  permissions required by PHP UID65534. Explicit0444 on the hash-verified public
  archive only; raw private files remain0600. Cleanup verified0/0 in failed run.

Original/root CI at a4a55bb and32444a9 passes Node22/24 separately. Actual initial
comparison is evidenced by the successful run below (not by these earlier runs).

- [40440401838](https://github.com/Meta-Project2026/Metamorph/actions/runs/40440401838),
  SHAbdee3c1738ab100da897a7349e9835943eedbb15: trusted CLI import error before
  provisioning (chmodSync imported from wrong module); no summary artifact. Fixed
  import and added actual offline CLI import-graph smoke before Docker execution.

Successful actual pilot:

- [Run40440717331](https://github.com/Meta-Project2026/Metamorph/actions/runs/40440717331)
  / [job121980141611](https://github.com/Meta-Project2026/Metamorph/actions/runs/40440717331/job/121980141611).
  Exact checked-out source `0ff7d640ca2aeb0c2b5301d13ab93d1103cedf16` verified by
  git rev-parse and the CLI; Ubuntu24.04, host Node24.21.0. Pilot exit0.
- Frozen install/lint/typecheck/original65 core tests/build, all56 Linux bridge
  tests (zero skips), all38 PHP broker tests, all33 target tests: exit0 each.
- [Fast CI40440717394](https://github.com/Meta-Project2026/Metamorph/actions/runs/40440717394)
  separately passes Node22/24 at the same source SHA.
- PHP pinned archive/license/base digest and fixed clock validated by real PHP
  inspector. Target trusted build before admission verifies measured Node24.11.0,
  SQLite3.50.4, TS5.9.3, libfaketime0.9.10-2.1, recipe/file hashes and actual image.
  Actual target Date/Date.now/SQLite wall time and real performance/hrtime proof
  pass both before admission and inside active target runtime. No timestamp patch.
- PHP actual image `sha256:43e3941b158687f10cd1232f081811a502ce417432a9aba2a0e0a9343571aa2e`.
  Target actual image `sha256:8023ddc2ba4d9432749f438b3bd6f7d9ed7a713a85d80b2353a7196bb9b0f994`.
  Target recipe SHA256 `a6279ec83d3bab925ec21daa08b401ab22409286d3f1995d85458d64249197c1`.
  Source pins are in plan/public-summary.json; no reproducible derived image claim.
- Actual `verifyPair()` initial-state comparison EXECUTED once. Initial difference
  codes DB_SCHEMA and DB_STATE. Only G3 ID `workshop-business:initial` executed.
  All6 declared business HTTP comparisons skipped by unchanged runner because
  initial states differ; not a crash or empty-coverage PASS.
- Service observations are separate: PHP bootstrap1; target readiness2 attempts,
  2 successes, 2 resets including provision/public-initial; target5 operations,
  Oracle snapshot1, business HTTP requests0. Adapter's provision/reset baseline
  captures are service state checks, not additional Oracle differential comparisons.
- G4 executes9 original synthetic controls: http-positive, http-key-order,
  http-status-mutant, http-type-mutant, http-missing-mutant, http-order-mutant,
  db-positive, db-row-mutant, db-sequence-mutant. Held-out isolation remains NOT_RUN.
- Both owner close paths, independent ledger inventory and finalizer establish
  zero containers/volumes. Both private pack indexes verify after worker teardown;
  bounded Oracle publication copied/verified privately. Raw never uploaded/read
  into model context. Runner teardown destroys these local packs.
- Sanitized artifact `real-differential-public` ID12705433875, SHA256
  `bc33311a2e51ed7c057f25f5afdfb9d1256adc874acddb76c52fff3a57eb037f`.
  Downloaded summary is revalidated against complete trusted public allowlist
  before copying to `public-summary.json` (no raw fields/paths).
- Private PHP index receipt `0bb71b2be582a0a42d3ccaf38f640f69c5b259f560937323fc523679b7b21ea3`;
  bridge/Oracle receipt `df07e3783cf19198bcdcf9cb4a32bb64247b9583b5c0aacc4b6bd49498948f9a`.
  Receipts are not durable recoverable raw storage.

| Gate / coverage | Actual outcome |
|---|---|
| G0 complete independent migrated app | NOT_RUN |
| G1 migrated target build/smoke | NOT_RUN (original mini-API compilation did execute) |
| G2 HTTP parity | INCONCLUSIVE,0 executed IDs, MISSING_COVERAGE |
| G3 stateful parity | FAIL,1 initial executed ID, DB_SCHEMA/DB_STATE/MISSING_COVERAGE |
| G4 independent controls + held-out | INCONCLUSIVE,9 public controls, HELD_OUT_NOT_RUN |
| Full product PASS | NOT_ESTABLISHED |
| Infrastructure pilot initial mismatch detection | EXECUTED_SUCCESSFULLY |
| General hard target state write quota | BLOCKED_TARGET_OWNER_API |

HTTP transport incompatibility is explicitly handed off: accepted target forbids
`.` paths and forces JSON content-type; no fake /items readiness, route/body rewrite
or target code changes. Future compatible workshop candidate needs owner agreement.

Final documentation/receipt commit will trigger another exact-head pilot and CI.
Their actual final SHA/URLs/results are recorded in the PR, without pretending an
older run executed a newer commit. PR18 stays open for independent review.

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
