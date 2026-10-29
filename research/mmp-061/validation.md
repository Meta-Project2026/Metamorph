# MMP-061 validation record

Base: `2a6eef6a583cf981e604d697bc1cb287174a823c` (fresh origin/main).
Branch: `codex/mmp061-real-model`. Implementation HEAD/hosted CI will be added after
commit; this record does not invent a model execution SHA or trial URL.

## Actual source verification

Downloaded only the pinned public codeload archive, then checked exact SHA-256
before parsing any member. Python tarfile read bytes as data; PHP/candidate code
was never executed. Original MIT notice is retained. Re-running freeze-source's
inspect function reproduced inventory.json/public-source.json/LICENSE.upstream
exactly; appending a byte to the archive raised SOURCE_DIGEST. Exit 0.

Initial download/print command verified and saved the archive, then exited 1
because Windows stdout cp1252 could not print a Unicode README character. Re-read
with UTF-8 and repeated the verification. No source execution or bypass occurred.
A missing runner.mjs/supervisor.mjs lookup was corrected by reading actual trusted
build.mjs/launch.mjs. These exploratory lookup errors are not validation PASS.

Measured source: 5 own PHP-extension files, 831 physical lines, 439 nonblank
PHP-region lines including comments; admitted API/config 484/424 respectively;
11 functions, 0 classes, 5 API actions, no composer manifest. Excludes vendor/tests.
This is smaller than a 10-15 route benchmark and only supports a limited API MVP.
The frozen public MANIFEST is 3 scenarios / 17 requests / 20 full SQLite comparisons
per complete attempt; no new execution counts are claimed.

## Host checks

Windows, Node v24.21.0, pnpm 11.25.0; trusted host source/build tests only.
No model endpoint, API key, private corpus or Docker was used.

| Actual command | Exit | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | 11 workspace projects; unchanged lockfile |
| `pnpm lint` | 0 | 166 files, final revision |
| `pnpm typecheck` | 0 | dependency build and workspace typechecks |
| `pnpm test` | 0 | 188 PASS / 0 FAIL / 102 SKIP; final pure-codec settlement control added afterward |
| `pnpm build` | 0 | all workspace packages |
| `pnpm --filter @metamorph/agent test` | 0 | 87 PASS / 0 FAIL / 0 SKIP |
| `pnpm --filter @metamorph/agent-real test` | 0 | 58 PASS / 0 FAIL / 0 SKIP |
| `pnpm --filter @metamorph/oracle test:reference` | 0 | 55 PASS / 0 FAIL / 1 POSIX SKIP |
| `pnpm --filter @metamorph/target-worker test` | 0 | 69 PASS / 0 FAIL / 0 SKIP |
| `node --test packages/agent-real/test/migration.test.mjs` | 0 | final 36 PASS / 0 FAIL / 0 SKIP |
| `node research/mmp-061/demo.mjs none` | 2 | expected NOT_RUN/MISSING_PROVIDER, 0 requests |
| `node research/mmp-061/demo.mjs meta` | 2 | expected NOT_RUN/BILLING_CAP_NOT_ESTABLISHED, 0 requests |
| `node research/mmp-061/demo.mjs local` | 2 | expected NOT_RUN/LOCAL_RUNTIME_AND_BILLING_CONTRACT_REQUIRED, 0 requests |

Windows POSIX skips are explicit in existing evidence-retention/reference tests;
no test was skipped or weakened for MMP-061. New tests all execute on Windows.
MJS is checked by lint/unit execution; existing TypeScript build/typecheck covers
the package's TS declaration boundary, not an invented full MJS static proof.

36 new tests: exact source/license/allowlist and prompt exclusion; wrong PHP/hash,
extra/duplicate/test source rejection; all three production selectors; runAgent
unknown-bound refusal; two-attempt real writer/SHA lease with synthetic verifier;
repair code rejection; 429/5xx/redirect/content-type/malformed/duplicate/oversize/
path/missing-entrypoint/model/unknown-spend/cost-bound rejection; timeout/late result;
abort; quota/sequence; partial-write invalidation; unknown paid usage simulated
port; nullable metadata preservation; redacted transport failure/concurrent call; unknown settled paid-cost rejection.
Every synthetic receipt is labeled SYNTHETIC_TRANSPORT_ONLY. No TS output from
these tests is represented as a migrated application.

CLI Node syntax and Python AST checks also exited 0. The archive freeze reproduction
command exited 0; the separate negative mutation assertion passed.

## Actual environment/admission diagnosis

Get-Command found node/pnpm/wsl, but no docker, ollama or llama-server on PATH.
Sandboxed wsl --list --quiet initially returned E_ACCESSDENIED; elevated repeat
exited 0 with no installed distributions. No Linux model/Docker runtime has been
established. The user was asked for any existing approved runtime/access details;
no provider identity or cost authorization is inferred from silence.

Production Meta's maxRequestCostUsd remains null, direct generation refuses and
unchanged runAgent stops at UNKNOWN_REQUEST_COST_BOUND before dispatch. Production
local is also not admitted: existing billing only supports synthetic | paid and
zero monetary budget stops all calls. The attached interface proposal gives the
smallest genuine local route for owner review; it is not implemented or approved.

## Delivery boundary

MODEL_GENERATION NOT_RUN; PUBLIC_G1/G2/G3 NOT_RUN; candidate SHA/trial URL null;
G0/G4 INCONCLUSIVE; PRODUCT NOT_ESTABLISHED. TOTAL_COST null (no live receipt),
generatedRequests 0. CLEANUP NOT_RUN with null inventory/emergency counts because
no trial resources were created; this is not an observed Docker 0/0 finalizer proof.
Original known-good/known-bad Docker controls were untouched and NOT_RUN here.

Delivered: public source freeze, source-bound normalized codec, negative tests,
real writer/orchestrator synthetic integration, fail-closed production selection,
public diagnostic CLI and a concrete interface/production-adapter handoff. The
real execution branch remains dormant and live receipt/control-driver admission
still needs implementation after the provider route is agreed. No generic paid
POST or local-as-synthetic bypass is included. All raw prompt/response snapshots
from tests stay ephemeral; only pinned public PHP source data is committed.

Protected Oracle/differential/contracts/worker files, source baseline, comparator,
normalization, MANIFEST, controls, fixtures, historical receipts and CI are unchanged.
Issue61 remains open. PR31 AUDIT_FAIL, unresolved34, G4 governance and55/56/57 work
remain separate. Independent ChatGPT review requested; no reviewer approval or
self-merge. This is not acceptance of the genuine-inference MVP mission.
