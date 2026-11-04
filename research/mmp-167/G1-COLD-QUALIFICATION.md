# MMP-167: G1 Cold Docker Qualification Report

**Document Date:** 2026-11-04
**Base Commit:** `origin/main` @ `6694e102561b76dea9712989c68aa53e8e62bfca`
**PR Tracking Branch:** `fix/mmp-167-g1-cold-docker` (Draft PR #172)
**Scope:** Offline, fail-closed qualification of G1 build/typecheck isolation on trusted Docker runtime using public synthetic fixture only.
**Strict Safety Bounds:** Zero Meta API calls, zero paid workflows, zero candidate decryption or execution, zero tampering with Oracle/governance/comparator boundaries.

---

## 1. Executive Verdict

- **Synthetic G1 Qualification Verdict:** **`PARTIAL / MARGINAL`** (5/10 PASS, 5/10 `BUILD_PHASE_TIMEOUT`).
- **Fail-Closed Harness Verdict:** **`FAIL_CLOSED_VERIFIED`**. When executed against the committed canonical production recipe, [`research/mmp-167/measure-live.mjs`](measure-live.mjs) detected all 5 abnormal timeout trials, recorded sanitized failure reasons, and exited with status code **`1`**.
- **Zero Resources Guarantee:** **`VERIFIED_ZERO_RESOURCES`** (0 containers, 0 volumes surviving across all 10 trials).
- **Migration & Product Status:** **`PRODUCT NOT_ESTABLISHED`**. Authentic paid run #41749479450 remains G1 `ERROR` with build-phase subtype `UNKNOWN`. Synthetic known-good pass does NOT establish a successful PHP→TS migration, candidate buildability, G2/G3 parity, or G4 controls. Issue #167 and downstream #161 remain **OPEN**.

---

## 2. Environment & Toolchain Identity

| Parameter | Value |
|---|---|
| Host OS | Windows 11 / WSL2 (Linux kernel 6.18.54.1-microsoft-standard-WSL2, x86_64) |
| Docker Engine | 29.9.2 (desktop-linux, containerd b7a2526, runc v1.5.2) |
| Host Node.js | v22.23.1 |
| Host pnpm | 11.25.0 |
| Pinned Target Container | `node:24.11.0-bookworm-slim@sha256:76d0ed0ed93bed4f4376211e9d8fddac4d8b3fbdb54cc45955696001a3c91152` |
| Container Toolchain | Node v24.11.0, TypeScript 5.9.3, SQLite 3.50.4, libfaketime 0.9.10-2.1 |
| Trusted Runtime Image | `sha256:993b24b03bdfe3a657b65bb9e744732f8296d52be1390c118f62c0a97280644b` |
| Production Recipe SHA | `bd2296fcbb502f1788bc4eaee6de5c3adc49ec30b712d9caaf5bfc93a52680c3` (matches `RECIPE_PIN`) |
| Synthetic Fixture | `packages/target-worker/fixtures/workshop` |
| Admitted Candidate SHA | `34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334` |
| Isolation Policy | `--network none`, `--read-only`, `--cap-drop ALL`, `--security-opt no-new-privileges`, `--cpus 1`, `--memory 256m`, `--memory-swap 256m`, `--pids-limit 64`, `--ulimit nofile=128:128`, tmpfs `/work:64m` & `/tmp:16m` |

---

## 3. Provenance Clarification on Metrics

### Canonical Production Metrics vs Historical Derived Instrumentation

1. **Committed Canonical Production Recipe (`packages/target-worker/runtime/build.mjs`):**
   - Emits check records containing only: `{ phase, exitCode, signal, error, stdout, stderr }`.
   - Does **NOT** contain or serialize an `elapsedMs` field.
   - Therefore, running the canonical production recipe yields `typecheckDuration: "NOT_AVAILABLE_FROM_PRODUCTION_RECEIPT"` and `buildDuration: "NOT_AVAILABLE_FROM_PRODUCTION_RECEIPT"`.
   - Canonical observable timing is the trusted host-side measurement of the outer Docker command duration (`worker.evidence.build.elapsedMs`) and the whole `worker.provision()` wall-clock duration.
2. **Prior Reported Sub-Phase Numbers (5,300–6,386 ms):**
   - Marked: **`HISTORICAL_DERIVED_INSTRUMENTATION`**.
   - These numbers were captured during preliminary research when `build.mjs` was temporarily instrumented in an uncommitted image and subsequently reverted to preserve the canonical cryptographic `RECIPE_PIN`.
   - They must not be claimed as canonical production outputs.
3. **Machine-Readable Versioned Record:**
   - Saved at [`research/mmp-167/qualification-results.json`](qualification-results.json).

---

## 4. Time Budget Hierarchy & Decision Gate Analysis

| Budget / Limit | Location | Configured Value | Behavior on Expiry |
|---|---|---|---|
| Internal Phase Timeout | `runtime/build.mjs` | 12,000 ms per phase (`typecheck`, `build`) | `spawnSync` sends SIGTERM (`ETIMEDOUT`), outputs JSON receipt with abnormal check, exits 2 |
| Outer Docker Build Timeout | `src/controller.mjs` (`provision`) | 35,000 ms | Kills container with SIGKILL (`timedOut = true`), throws `WorkerError("TIMEOUT")` |
| Default Operation Timeout | `src/controller.mjs` (`POLICY.operationTimeoutMs`) | 15,000 ms | Default for general worker operations (overridden by 35,000 ms in `provision`) |
| Worker Lifetime Deadline | `src/controller.mjs` (`POLICY.lifetimeMs`) | 180,000 ms (3 min) | Aborts active operation, triggers automatic `close()` / reaping |
| Cleanup Grace Budget | `src/controller.mjs` (`POLICY.cleanupGraceMs`) | 10,000 ms | Bounds container and volume removal operations |

### Scenario Timeout Precedence

1. **Phase 1 (`typecheck`) hangs:** Internal 12,000 ms timeout triggers first. Outer 35s has ~23s remaining. Outer exit is 2; sidecar records `BUILD_PHASE_TIMEOUT` (phase: `typecheck`).
2. **Phase 1 completes in ~11.8s, Phase 2 (`build`) hangs:** Phase 2 internal 12,000 ms timeout triggers at t ≈ 23.8s. Outer 35s has ~11s remaining. Outer exit is 2; `executedTestIds` contains `["workshop-business:typecheck"]`; sidecar records `BUILD_PHASE_TIMEOUT` (phase: `build`).
3. **Both phases exceed 17.5s (if phase timeouts were uncapped):** Outer 35,000 ms cap triggers first, terminating container with `TIMEOUT`. No inner phase sidecar is emitted.
4. **Lifecycle accumulation:** At 180,000 ms from first operation start, lifetime deadline aborts operations and reaps resources.

---

## 5. Live Qualification Battery (10 Trials against Canonical Production Recipe)

**Harness Command:** `node research/mmp-167/measure-live.mjs`
**Execution Timestamp:** 2026-11-04T09:40:27Z
**Result:** Exit code `1` (`FAIL_CLOSED`, 5 passed, 5 failed).

### Operational Definitions
- **`fresh-container/repeated-image`:** Fresh ephemeral container launched via `TargetWorker.provision()`, allocating tmpfs `/work:64m` and `/tmp:16m`, new Node process, un-JITed compiler invocation, separated by a 3s settling pause, reusing the local Docker image.
- **`back-to-back-warm-container`:** Immediate sequential runs where the host/WSL2 page-cache retains `tsc.js` and type definitions in memory.
- **Note on Host Cache:** Neither mode drops host OS page caches or rebuilds image layers, as doing so would require privileged host manipulation and violate project safety boundaries.

### Exact Trial Results

| Trial | Mode | Docker Cmd (ms) | Provision (ms) | G1 Verdict | Executed Test IDs | Sidecar Code | Clean / Zero Res |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | fresh-container/repeated-image | 24,783 | 0 (failed) | **ERROR** | `[typecheck]` | `BUILD_PHASE_TIMEOUT` | true / true |
| 2 | fresh-container/repeated-image | 24,654 | 0 (failed) | **ERROR** | `[typecheck]` | `BUILD_PHASE_TIMEOUT` | true / true |
| 3 | fresh-container/repeated-image | 12,904 | 0 (failed) | **ERROR** | `[]` | `BUILD_PHASE_TIMEOUT` | true / true |
| 4 | fresh-container/repeated-image | 24,306 | 28,342 | **PASS** | `[typecheck, build]` | null | true / true |
| 5 | fresh-container/repeated-image | 24,298 | 28,392 | **PASS** | `[typecheck, build]` | null | true / true |
| 6 | back-to-back-warm-container | 23,691 | 27,617 | **PASS** | `[typecheck, build]` | null | true / true |
| 7 | back-to-back-warm-container | 23,879 | 27,962 | **PASS** | `[typecheck, build]` | null | true / true |
| 8 | back-to-back-warm-container | 24,629 | 28,542 | **ERROR** | `[typecheck]` | `BUILD_PHASE_TIMEOUT` | true / true |
| 9 | back-to-back-warm-container | 24,528 | 0 (failed) | **ERROR** | `[typecheck]` | `BUILD_PHASE_TIMEOUT` | true / true |
| 10 | back-to-back-warm-container | 24,059 | 28,070 | **PASS** | `[typecheck, build]` | null | true / true |

### Key Observations from Live Execution

1. **Replication of Historic Incident Shape:**
   - In 4 of the 5 failed trials (Trials 1, 2, 8, 9), `typecheck` succeeded normally with code 0 (`executedTestIds=["workshop-business:typecheck"]`), and `build` hit `ETIMEDOUT` (12,000 ms cap).
   - Total Docker command duration for those runs was ~24.5–24.8 s (approx. 12s typecheck + 12s build timeout).
   - This **identically replicates the visible symptom** of paid run [#41749479450](https://github.com/Meta-Project2026/Metamorph/actions/runs/41749479450) (`executedTestIds=["workshop-business:typecheck"]`, G1 `ERROR`, `ENVIRONMENT_ERROR`, `BUILD_FAILED`).
2. **Insufficiency of 12,000 ms Cap:**
   - Under `--cpus 1` and `--memory 256m`, single-threaded compilation of the workshop fixture takes ~11.8–12.5 s per phase.
   - A 12,000 ms limit places compilation right on the razor's edge: minor scheduler jitter or cache misses cause an `ETIMEDOUT`.
   - Meanwhile, the outer Docker timeout (35,000 ms) has plenty of room (>10 seconds headroom).
3. **Fail-Closed Verification:**
   - The harness detected all 5 failures, validated `zeroResourcesVerified === true`, preserved full error logs in `qualification-results.json`, and terminated with exit code `1`.

---

## 6. Confirmed Facts vs Unproven Hypotheses for Historic Run #41749479450

1. **Confirmed:** In run #41749479450, `executedTestIds=["workshop-business:typecheck"]` proves that the `typecheck` phase completed normally with integer exit code 0.
2. **Confirmed:** The failure occurred after typecheck: either during the `build` phase (`tsc` compilation) or during outer container management/orchestration.
3. **Confirmed:** The exact failure subtype in run #41749479450 remains **`UNKNOWN`** because the historical public receipt did not include phase error/signal records and retained ciphertext was not decrypted.
4. **Reproduced Failure Mechanism:** While the local cold timeout of 12,264 ms in earlier `RESULTS.md` occurred in `typecheck`, our canonical qualification demonstrated that **`build` phase timeouts after successful `typecheck` are readily reproducible** under the 12,000 ms per-phase limit.
5. **No Blind Extrapolation:** Local WSL2 results do NOT prove that 12s is safe on hosted Ubuntu 24.04 Actions runners. A dedicated, credential-free hosted runner qualification workflow is required.

---

## 7. Execution Accounting

### ACTUALLY_RUN Commands

| Command | Exit Code | Outcome |
|---|:---:|---|
| `pnpm install --frozen-lockfile` | 0 | All 11 workspace packages up to date |
| `pnpm lint` | 0 | Biome check passed across 366 files |
| `pnpm typecheck` | 0 | Workspace builds and tsc typecheck passed across 10 packages |
| `pnpm test` | 0 | 902 tests total (788 passed, 114 skipped, 0 failed) |
| `pnpm build` | 0 | All workspace builds completed |
| `pnpm --filter @metamorph/target-worker test` | 0 | 69/69 passed |
| `node --test packages/agent-real/test/build-phase-diagnostics.test.mjs` | 0 | 12/12 passed |
| `node --test packages/agent-real/test/g1-qualification.test.mjs` | 0 | 9/9 passed (including positive and negative validator controls and CLI mock test) |
| `node research/mmp-167/negative-controls.mjs` | 0 | 9 control groups passed |
| `node packages/target-worker/src/smoke.mjs` | 0 | 30/30 scenarios passed in Docker |
| `node research/mmp-167/measure-live.mjs` | 1 | 10 trials executed; fail-closed exited 1 on 5/10 `ETIMEDOUT` detection |

### NOT_RUN

- NO Meta API calls, billable probes, or provider requests.
- NO workflow dispatches (`meta-paid-migration.yml` or `workflow_dispatch`).
- NO re-runs of historical jobs or actions.
- NO decryption, unpacking, or execution of retained candidate ciphertext.
- G2 / G3 differential verification on candidate code: **NOT_RUN**.
- G0 / G4 independent controls on candidate: **NOT_RUN**.
- Product acceptance: **NOT ESTABLISHED**.

---

## 8. Residual Risks & Recommended Actions

1. **Production Recipe Adjustment Decision Gate:** Adjusting `timeout: 12000` to a coordinated higher value (e.g. 15,000–16,000 ms per phase with outer 35,000 ms unchanged) requires a cross-team decision gate because modifying `build.mjs` changes `RECIPE_PIN` and `DIAGNOSTIC_POLICY.recipeSha`.
2. **Dedicated Hosted Qualification:** A credential-free GitHub Actions workflow running `measure-live.mjs` on an Ubuntu 24.04 runner is needed to observe phase jitter under hosted runner virtualization.
3. **Issue Status:** Issue #167 and downstream #161 must remain **OPEN**. Draft PR #172 delivers the fail-closed harness and reproducible qualification evidence for independent ChatGPT review.
