# MMP-160 offline spike — executed validation

2026-11-04, Windows PowerShell, Node v22.23.1, pnpm 11.25.0.
Fetched remote main/base: `eee4c75fd6a2900c540561593f86c430b74b62b3`.
Branch `Vladimir/mmp160-g1-offline-spike` in a separate worktree.
Final exact HEAD and hosted CI belong in the Draft PR, avoiding a self-referential
commit in this report. Older [validation.md](validation.md) is PR #178 history.

## Commands actually executed

| Command | Exit | Observed result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | All 11 projects, existing lockfile, no new dependencies |
| `pnpm lint` | 0 | 374 files; four existing warnings and two infos in unchanged custody/live-experiment files, no errors |
| `pnpm typecheck` | 0 | Workspace build and recursive typechecks; research JS checked by lint/syntax/tests, not TypeScript |
| `pnpm test` | 0 | 924 tests: 811 passed, 113 platform skips, 0 failures |
| `pnpm build` | 0 | All workspace packages built |
| `pnpm exec biome check research/mmp-160` | 0 | Research-local non-root config extends root; five JS/JSON files checked |
| `node --check research/mmp-160/offline-spike.mjs` | 0 | Prototype syntax valid |
| `node --test --test-reporter=spec research/mmp-160/offline-spike.test.mjs` | 0 | 84 passed, 0 failed/skipped |
| Focused command below | 0 | 175 tests: 173 passed, 2 Linux-only skips, 0 failed |
| `node research/mmp-120/audit.mjs` | 0 | 20 invariants PASS; unchanged generation body 25,625 bytes, SHA `01cb64b4…`; audit remains NO_GO, not paid authority |
| `node research/mmp-069/validate.mjs` | 0 | VALID; 11 workspace packages, 138 research modules; new folder explicitly LOCAL_ONLY, tests NOT_VERIFIED for hosted discovery |
| `node research/mmp-069/check-syntax.mjs` | 0 | 137 active modules parse successfully; no module executed |
| `node --test --test-reporter=spec research/mmp-069/validate.test.mjs` | 0 | 45 inventory/CI validator controls passed, 0 failed/skipped |
| `git diff --exit-code origin/main -- packages apps .github .specify .agents pnpm-lock.yaml package.json biome.json` | 0 | No production/workflow/scaffold/root config/dependency changes |
| `git diff --cached --check` | 0 | Staged whitespace check |

Focused command (offline synthetic tests only):

```powershell
node --test --test-reporter=spec research/mmp-160/offline-spike.test.mjs packages/agent-real/test/compiler-diagnostics.test.mjs packages/agent-real/test/build-phase-diagnostics.test.mjs packages/agent-real/test/autonomous-repair.test.mjs packages/agent-real/test/repair-entrypoint.test.mjs packages/agent-real/test/repair-vertical.test.mjs
```

The two focused skips are the full production-entrypoint two-attempt simulation
and the credential-free repair-gate test; both require Linux. The 113 root-suite
skips remain platform skips, not passes. Existing hosted Fast CI tests Node 22/24;
it does **not** discover this new research test file. Its result must not be
reported as hosted execution of this spike. Hosted execution of the spike,
Docker/age integration and production G1 routing are **NOT_RUN** by this task.

Initial local tooling failures were resolved: an unsupported Biome
`--files-includes` CLI option, then nested-config root/config-path mistakes each
exited 1. The final non-root research config works through ordinary directory
discovery. An initial combined lint/typecheck shell exited 1 due to that config;
the actual typecheck invocation exited 0. No lint/test checks were disabled.

Initial hosted [Fast CI 41844241342](https://github.com/Meta-Project2026/Metamorph/actions/runs/41844241342)
on `77831f41e9b78899155e3c558f23f891188de183` failed both Node 22/24 jobs at
Active research syntax with RESEARCH_INVENTORY_DRIFT. The executor had omitted
the mandatory static inventory registration for this newly executable research
folder. Adding its LOCAL_ONLY / hosted tests NOT_VERIFIED record to
`research/mmp-069/coverage-matrix.json` restores the existing inventory invariant;
no validator, tests, workflow or safeguard was weakened. This follow-up was
checked with the real syntax sweep and all 45 validator controls above. The
final-head hosted result is recorded separately in the Draft PR.

## Executed acceptance matrix

| Cases | Observed offline outcome |
| --- | --- |
| TS2339 and TS2769, one trusted-shape first typecheck error, canonical same-candidate location | G1_BUILD_RECOVERABLE, private exact previous changes available once |
| Normal positive nonzero compiler exit vs timeout/signal/spawn/overflow/missing exit | Production pure buildReceipt returns FAIL vs ERROR; spike refuses every abnormal case |
| Wrong stage/test, extra test/phase, zero/negative exit, ERROR/PASS verdict, ENVIRONMENT_ERROR | NO_GO |
| Multiple/duplicate-count/missing/truncated/unavailable diagnostics; wrong code/phase; message/stderr or unknown fields | NO_GO with fixed public reason, null feedback |
| Missing/traversal/absolute path, foreign diagnostic/bundle SHA, source mutation, out-of-range/zero/fractional position | NO_GO |
| Run/head/workflow/source/context/manifest/request/response/model/pair/attempt mismatch, broken custody link, wrong run attempt/type | NO_GO |
| Single generation, legacy two-POST contract, absent explicit v2 G1 opt-in, late signature or wrong reservations | NO_GO; no retroactive upgrade |
| First or second SEND_UNKNOWN, reserved/sent/ambiguous attempt 2, duplicate use or cloned context handle | NO_GO / replay rejected; fake sink stays at two total simulated sends |
| Missing custody/readback/lease, normal/independent cleanup failure, emergency removal or pending operation | NO_GO |
| Claimed G2/G3 observations/PASS | NO_GO; every public report keeps 0/17 HTTP, 0/20 SQLite and INCONCLUSIVE |
| Baseline complete G1-PASS G2/G3 FAIL and all-public PASS | Unchanged publicRepairDecision returns HTTP_JSON_TYPE FAIL / PASS; G1 FAIL still throws G1_FAILED |
| Public output/feedback and thrown injected-port error | No synthetic source/message/raw stderr/stack/private context leakage |
| Evaluate + consume with file/network/subprocess APIs replaced by throwing sentinels | Zero external accesses; no candidate execution; injected test snapshot only |

The synthetic strings and diagnostic headers are original controls, not actual
compiler executions or private candidate replays. Recognition of a diagnostic
shape does not demonstrate repair success. The third-send check is an in-memory
TEST driver check; durable cross-process production ledger behavior remains a
future acceptance gate. The injected authenticator is explicitly a TEST snapshot
comparison, not genuine signed receipt/response/custody authentication.

## Evidence boundaries

Read public run metadata, issue comments and the specifically selected public
artifact only. Candidate/private diagnostic artifacts were not downloaded or
decrypted. The extracted public receipts match the brief; GitHub's reported ZIP
digest is distinguished from independently hashing ZIP bytes in [offline-design.md](offline-design.md).
The historical single-generation run remains ineligible and immutable.

Provider requests this task: **0**. Workflow dispatches: **0**. Production G1
repair: **NOT_IMPLEMENTED**. Actual TS2339/TS2769 repair efficacy: **NOT_RUN**.
G0/G4/product: **NOT_ESTABLISHED**. Both-owner approval and independent exact-HEAD
review: **PENDING**. No PR merge or teammate approval is implied.
