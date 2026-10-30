# MMP-085 executed validation — 2026-10-29

Isolated worktree `C:\Users\user\Documents\Metamorph-mmp-085`, branch
`demo/mmp-085-real-ai-fail`, base freshly fetched main
`3fb4772ef9c5d2c659530ae75b3076612eb18a3f`. Original shared checkout/branch untouched.
Windows, Node v22.23.1, pnpm 11.25.0. Node v24.11.1 also tested via npm's temporary
runtime cache, without repository dependency/lockfile changes. Delivery commit is
recorded in the PR / Git history, distinct from the original evidence heads.

## Executed commands and results

| Command / check | Exit / actual outcome |
| --- | --- |
| git fetch origin main; git rev-parse origin/main | 0; base above, unchanged on final refresh |
| gh issue view 85; gh run view 40900698372; gh api artifact 12909716502 | 0; issue OPEN, run completed/failure, head d21376747c7147043ca618e149fac87c0df80111; artifact not expired at retrieval |
| gh api artifact ZIP, binary stdout to file; Python SHA-256 / ZIP member inspection | 0; original ZIP 4085 bytes, sha256 95121c3291e4478d682dfd3375de86e2df4036f46bcdc81826ee6fdc5fb2a493; all four allowlisted original member hashes/sizes match |
| pnpm install --frozen-lockfile | 0; all 11 projects, 54 packages reused, no new dependencies / lockfile changes |
| pnpm lint | 0; 186 files, no diagnostics/fixes |
| pnpm exec biome check research/demo-readiness | 0; 8 modules, no diagnostics/fixes on final pass |
| pnpm typecheck | 0; workspace build plus all workspace typechecks |
| pnpm test | 0; 438 tests: 336 PASS / 0 FAIL / 102 existing platform SKIP |
| pnpm build | 0; all workspace build scripts |
| node --test research/demo-readiness/demo.test.mjs | 0; original 50 PASS / 0 FAIL / 0 SKIP; test file unchanged |
| node --test research/demo-readiness/demo.test.mjs research/demo-readiness/real-ai.test.mjs (Node 22.23.1) | 0; 83 PASS / 0 FAIL / 0 SKIP |
| npm exec --yes --package=node@24.11.1 -- node --test research/demo-readiness/demo.test.mjs research/demo-readiness/real-ai.test.mjs | 0; Node 24.11.1, 83 PASS / 0 FAIL / 0 SKIP |
| git diff --exit-code for original five evidence JSON, pins.mjs, adapter.mjs, demo.test.mjs | 0; byte-identical originals |
| git diff --check | 0 |

Final demo matrix was rerun on both Node versions after the final adapter/test
edit. The 33 additional tests exercise original C bytes/usage/nulls, distinct
historical/real/synthetic identities, changed bytes/whitespace/UTF-8/duplicate JSON,
missing/duplicate/extra/mixed files, wrong run/head/source/candidate and nested
identities, forged G1/G2/G3/G4/product PASS, invented charges/estimates/tokens,
missing provenance, erased failure, forged coverage, unknown fields/status,
secret-like fields, HTML injection and fixed public HTTP routes. All inputs are
data; no benchmark/candidate is executed. C pins are deeply frozen, digest checked
before parsing, exact producer schema and cross-file provenance checked afterward.

Existing root test SKIPs are not a new model, Docker or full Oracle verification.
No checks, comparator, normalization or expected results were weakened. Root lint
excludes research; the explicit scoped Biome command covers these modules.

## Actual Chrome smoke

- Initial page contains no loaded evidence panels. Explicit bundled load displays
  historical A/B (5 receipts) and PINNED_REAL_AI_SNAPSHOT C (4).
- A remains historical NOT_RUN / 0 requests / null candidate/cost. B remains
  PASS → FAIL → PASS for G2/G3, each 17/17 HTTP and 20/20 SQLite.
- C displays Muse Spark 1.3 generation PASS only, 1 request / 1 response,
  tokens 5818/9239, estimate USD 0.04653825, charged null, G1 FAIL / BUILD_FAILED,
  G2/G3 INCONCLUSIVE, HTTP 0/17, SQLite 0/20, UNKNOWN diagnostics, 0/0/0 cleanup.
- Expanded C identities and raw JSON selector; selected Real AI #81 / trial.json
  and observed its actual run/head/source and producer fields.
- Missing-file failure: temporarily renamed only C generation.json within this
  checkout, clicked load: NOT_VERIFIED / MISSING_OR_OVERSIZED_RECEIPT and all
  three tracks hidden. Restored exact file, rehashed to original b0dbc390…,
  clicked load and all tracks recovered. No altered/missing evidence is delivered.
- Missing-and-restored technical sequence: **12.583 seconds**, Date.now across
  browser/tool actions, including overhead. Not narration duration or load latency.
- Saved/visually inspected [C viewport screenshot](screenshots/real-ai-trial.jpg).
  Full-page capture timed out; viewport capture succeeded. Screenshot is not an
  independent validation receipt and is not served by the allowlist server.

**Browser local-picker selection: NOT_RUN.** Filechooser obtained, multiple
selection supported, setFiles blocked by extension file-URL access. No security
setting was changed. The same byte inputs are covered by adapter tests, and
bundled browser load/missing-file recovery were actually executed.

## Remaining limits

Human timed 90-second / ~4-minute narration: NOT_RUN. Full disconnected-laptop
rehearsal: NOT_RUN (no host network setting changed); all viewer assets/data are
local loopback, no external assets/telemetry/storage. Responsive-device automation:
NOT_RUN. Node 24 whole-workspace checks: NOT_RUN locally (both demo suites ran).
New model calls/spend, Docker trials, workflow dispatch/reruns, private-pack/G4
inspection and repair: NOT_RUN in MMP-085. Original MMP-081 evidence records its
actual model generation and G1 FAIL; it is not a new execution here. Original
compiler diagnostics and settled charge remain UNKNOWN/null. Formal G0/G4 and
product acceptance remain NOT_ESTABLISHED. Historical PR #31 AUDIT_FAIL unchanged.
Independent ChatGPT review is requested in the delivery PR and remains pending;
no owner approval, self-approval or merge is implied by local green checks.
