# MMP-069 — Test/CI Coverage Matrix & Workshop-Audit Inclusion

**Contract:** MMP-069  
**Issue:** [Meta-Project2026/Metamorph#69](https://github.com/Meta-Project2026/Metamorph/issues/69)  
**Base SHA:** `4cdfcf6de8bfd411a7c0c7c18953abb1bb0aa299`  
**Related Issues:** #61 (parallel model admission, Ilia), #63 (historical Git objects on shallow checkout), #68 (sandbox invariants and action SHA pinning)

---

## 1. Summary of Changes

MMP-069 closes key blind spots in Metamorph Fast CI without expanding to expensive full Docker runs or changing Oracle/comparator/product behavior:

1. **54 Docker-free workshop-audit tests enabled in Fast CI:**
   - Package: `@metamorph/workshop-audit` (`packages/workshop-audit/test/*.test.mjs`).
   - Execution command in `.github/workflows/ci.yml`: `pnpm --filter @metamorph/workshop-audit test`.
   - Tests: 30 in `audit.test.mjs`, 24 in `lifecycle.test.mjs` (total 54).
   - Speed: ~3.9 seconds total; zero Docker dependencies (in-process SQLite + mock worker adapters).
   - Node matrix: runs on both Node 22 and Node 24 on `ubuntu-latest`.

2. **Machine-readable coverage matrix:**
   - `research/mmp-069/coverage-matrix.json` records all 11 workspace packages, research harnesses, execution commands, Fast CI status, and test counts.
   - Fail-closed validator: `research/mmp-069/validate.mjs` executed in Fast CI to ensure schema and counts remain consistent.

3. **Scoped active research linting:**
   - Active research code in `research/demo-readiness/` is checked in CI via `npx @biomejs/biome check research/demo-readiness` (~34ms runtime) using its scoped configuration.
   - Global `biome.json` is preserved untouched; archived harnesses with historical receipts are protected from mass format churn.

4. **Negative control verified:**
   - Injected intentional mutation (`assert.equal(1, 2)`) in `packages/workshop-audit/test/audit.test.mjs` in a temporary worktree.
   - Result: `pnpm --filter @metamorph/workshop-audit test` exited with status `1` (`ERR_TEST_FAILURE`), proving the gate is active and fail-closed.
   - Mutation was completely rolled back.

---

## 2. Workspace Packages Inventory (11 Packages)

| Package | Path | Fast CI Test Command | Build / Typecheck | Fast CI Status |
| :--- | :--- | :--- | :--- | :--- |
| `metamorph` (root) | `.` | `pnpm test` (root composite suite) | `pnpm build && pnpm -r typecheck` | PASS |
| `@metamorph/server` | `apps/server` | `node --test test/health.test.mjs` (via root) | `tsc -p tsconfig.json` | PASS |
| `@metamorph/contracts` | `packages/contracts` | `node --test test/contracts.test.mjs` (via root) | `tsc -p tsconfig.json` | PASS |
| `@metamorph/agent` | `packages/agent` | `node --test test/*.test.mjs` (via root) | `tsc -p tsconfig.json` | PASS |
| `@metamorph/agent-real` | `packages/agent-real` | `node --test test/*.test.mjs` (via root) | `tsc -p tsconfig.json` | PASS |
| `@metamorph/differential` | `packages/differential` | Dedicated: `pnpm --filter @metamorph/differential test` | `tsc -p tsconfig.json` | PASS |
| `@metamorph/evidence-retention` | `packages/evidence-retention` | `pnpm --filter ... test` (via root) | `tsc -p tsconfig.json` | PASS (3 privileged skips) |
| `@metamorph/integration` | `packages/integration` | `node --test test/*.test.mjs` (via root) | `tsc -p tsconfig.json` | PASS |
| `@metamorph/oracle` | `packages/oracle` | Dedicated: `test:reference` & `probes/qualification.test.mjs` | `tsc -p tsconfig.json` | PASS |
| `@metamorph/target-worker` | `packages/target-worker` | Dedicated: `pnpm --filter @metamorph/target-worker test` | `tsc -p tsconfig.json` | PASS |
| `@metamorph/workshop-audit` | `packages/workshop-audit` | **NEW Dedicated:** `pnpm --filter @metamorph/workshop-audit test` | N/A (MJS runtime, Biome static) | **PASS (54 tests)** |

---

## 3. Special Categories & Blind Spot Analysis

### A. 54 Workshop-Audit Tests
- **Files:** `packages/workshop-audit/test/audit.test.mjs` (30 tests), `packages/workshop-audit/test/lifecycle.test.mjs` (24 tests).
- **Environment:** Pure Node.js, uses in-memory / temporary SQLite and mock adapters (`AuditReference`, `AuditTarget`). Docker is NOT required.
- **Hosted Linux CI Result:** 54 PASS / 0 FAIL / 0 SKIP.
- **Windows Local Result:** 53 PASS / 0 FAIL / 1 SKIP (one POSIX permission test `test/lifecycle.test.mjs:363` safely skips on `win32`).

### B. 21 #63 Connected Adversarial Tests
- **File:** `research/mmp-054-connected/verify.test.mjs` (21 tests).
- **Status:** **NOT_RUN in Fast CI**.
- **Reason:** Requires historical Git objects (`git show 7cf6e678...:specs/014-public-validation-triage/pins.json` and `git show 8779dfe^:packages/oracle/src/runner.ts`). Under default GitHub Actions `actions/checkout@v4` shallow clone (`fetch-depth: 1`), these commits are not present.
- **Resolution:** Tracked separately by issue **#63** (assigned to sol 6.1) to avoid breaking shallow CI checkouts.

### C. 3 Privileged SKIPs in Root Tests
On hosted unprivileged Ubuntu CI runners (`ubuntu-latest`), exactly 3 tests in `packages/evidence-retention/test/retention.test.mjs` are skipped:
1. `line 104` ("Windows support fails closed instead of treating POSIX mode bits as ACL proof"): skipped because runner is Linux (`process.platform !== "win32"`).
2. `line 311` ("real foreign-owner file is rejected"): skipped because `process.getuid?.() !== 0` (chown to foreign UID 65534 requires root).
3. `line 612` ("actual unprivileged child cannot read source or private key; receives no keys/env"): skipped because `process.getuid?.() !== 0` (spawning child with foreign UID 65534 requires root).
- **Policy:** These remain explicitly documented as `SKIPPED` on unprivileged CI; they are not faked as PASS.

### D. 50 Demo #71 Local Focused Tests
- **File:** `research/demo-readiness/demo.test.mjs` (50 tests, MMP-071).
- **Status:** Tested locally (50 PASS in ~525ms). Scoped lint step `npx @biomejs/biome check research/demo-readiness` is enabled in Fast CI.

---

## 4. Active vs Archived Research Harnesses

| Directory | Role | Lifecycle | Fast CI Gating |
| :--- | :--- | :--- | :--- |
| `research/demo-readiness` | Public evidence viewer & rehearsal runbook | ACTIVE | Scoped Biome check enabled |
| `research/mmp-069` | Test/CI coverage matrix & validator | ACTIVE | Machine-readable validator in CI |
| `research/mmp-054-connected` | Adversarial verifier tests (21 tests) | ACTIVE | Shallow checkout gap tracked in #63 |
| `research/mmp-054` | Offline local proof / Docker gateway | ARCHIVE | Dispatch-only / manual Docker |
| `research/mmp-044` | Public validation triage | ARCHIVE | Dispatch-only / manual Docker |
| `research/mmp-049` | Workshop candidate compatibility | ARCHIVE | Dispatch-only / manual Docker |
| `research/mmp-034` | Items smoke diagnosis & incident review | ARCHIVE | Local diagnostic |
| `research/mmp-055` | Privileged encrypted evidence | ARCHIVE | Privileged container mount |
| `research/mmp-061` | Real model admission & Oracle controls | SEPARATE TRACK | PR #70 (Ilia Botnariuc) |

---

## 5. Non-Interference Boundaries

- **Zero modifications** to:
  - `packages/agent*/`
  - `packages/oracle/`
  - `packages/differential/`
  - `packages/target-worker/`
  - `packages/contracts/`
  - `research/mmp-061/`
  - Corpus, manifests, benchmarks, historical evidence.
- No changes to action pinning (`@v4` preserved; SHA pinning is owned by #68).
- No new billable API calls or Docker container requirements on Fast CI.
