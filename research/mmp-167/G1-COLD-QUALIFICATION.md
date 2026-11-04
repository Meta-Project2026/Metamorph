# MMP-167: G1 Cold Docker Qualification Report

**Document Date:** 2026-11-04
**Base Commit:** `origin/main` @ `6694e102561b76dea9712989c68aa53e8e62bfca`
**Scope:** Offline, deterministic qualification of G1 build/typecheck isolation on trusted Docker runtime using public synthetic fixture only.
**Strict Safety Bounds:** Zero Meta API calls, zero paid workflows, zero candidate decryption or execution, zero tampering with Oracle/governance/comparator boundaries.

---

## 1. Executive Verdict

- **Synthetic G1 Qualification Verdict:** **`PASS`** (10/10 trials: 5 cold + 5 warm on trusted Docker runtime).
- **Zero Resources Guarantee:** **`VERIFIED_ZERO_RESOURCES`** (0 containers, 0 volumes surviving across all trials).
- **Migration & Product Status:** **`PRODUCT NOT_ESTABLISHED`**. Authentic paid run #41749479450 remains G1 `ERROR` with build-phase subtype `UNKNOWN`. Synthetic known-good pass does NOT establish a successful PHP→TS migration, candidate buildability, G2/G3 parity, or G4 controls.

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
| Trusted Runtime Image | `sha256:cb6352191823887c847287783ff9881887e2c183583ae133e8afe80bda34d08b` |
| Synthetic Fixture | `packages/target-worker/fixtures/workshop` |
| Admitted Candidate SHA | `34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334` |
| Isolation Policy | `--network none`, `--read-only`, `--cap-drop ALL`, `--security-opt no-new-privileges`, `--cpus 1`, `--memory 256m`, `--memory-swap 256m`, `--pids-limit 64`, `--ulimit nofile=128:128`, tmpfs `/work:64m` & `/tmp:16m` |

---

## 3. Time Budget Hierarchy & Decision Gate Analysis

| Budget / Limit | Location | Configured Value | Behavior on Expiry |
|---|---|---|---|
| Internal Phase Timeout | `runtime/build.mjs` | 12,000 ms per phase (`typecheck`, `build`) | `spawnSync` sends SIGTERM (`ETIMEDOUT`), outputs JSON receipt with abnormal check, exits 2 |
| Outer Docker Build Timeout | `src/controller.mjs` (`provision`) | 35,000 ms | Kills container with SIGKILL (`timedOut = true`), throws `WorkerError("TIMEOUT")` |
| Default Operation Timeout | `src/controller.mjs` (`POLICY.operationTimeoutMs`) | 15,000 ms | Default for general worker operations (overridden by 35,000 ms in `provision`) |
| Worker Lifetime Deadline | `src/controller.mjs` (`POLICY.lifetimeMs`) | 180,000 ms (3 min) | Aborts active operation, triggers automatic `close()` / reaping |
| Cleanup Grace Budget | `src/controller.mjs` (`POLICY.cleanupGraceMs`) | 10,000 ms | Bounds container and volume removal operations |

### Scenario Timeout Precedence

1. **Phase 1 (`typecheck`) hangs:** Internal 12,000 ms timeout triggers first. Outer 35s has ~23s remaining. Outer exit is 2; sidecar records `BUILD_PHASE_TIMEOUT` (phase: `typecheck`).
2. **Phase 1 completes in 6s, Phase 2 (`build`) hangs:** Phase 2 internal 12,000 ms timeout triggers at t ≈ 18s. Outer 35s has ~17s remaining. Outer exit is 2; executedTestIds contains `["workshop-business:typecheck"]`; sidecar records `BUILD_PHASE_TIMEOUT` (phase: `build`).
3. **Both phases exceed 17.5s (if phase timeouts were uncapped):** Outer 35,000 ms cap triggers first, terminating container with `TIMEOUT`. No inner phase sidecar is emitted.
4. **Lifecycle accumulation:** At 180,000 ms from first operation start, lifetime deadline aborts operations and reaps resources.

### Decision Gate Verdict

- On this Docker environment, the synthetic known-good workshop fixture completes each phase in 5.3s – 6.4s (well below the 12.0s limit, with ~47% to 55% headroom).
- No deadline failure occurred during the 10 live qualification trials.
- `packages/target-worker/runtime/build.mjs` is cryptographically pinned by `RECIPE_PIN` (`packages/agent-real/src/runtime.mjs`) and `DIAGNOSTIC_POLICY.recipeSha` (`packages/agent-real/src/private-diagnostics.mjs`). Changing internal constants without a cross-team governance ratification would break recipe verification.
- Per project instruction: *“Если synthetic G1 стабилен с разумным запасом и проблема не воспроизводится, НЕ увеличивай таймауты наугад. Добавь воспроизводимый безопасный offline qualification/harness и честный отчёт; обозначь, что для фактического hosted поведения нужен отдельный runner qualification. Не закрывай #167 досрочно.”*
- Therefore, production timeout constants remain unchanged. A repeatable harness (`research/mmp-167/measure-live.mjs`) and regression tests (`packages/agent-real/test/g1-qualification.test.mjs`) are established.

---

## 4. Live Qualification Battery (10 Trials: 5 Cold + 5 Warm)

**Harness Command:** `node research/mmp-167/measure-live.mjs`

### Operational Definitions
- **`cold`:** Fresh ephemeral container launched via `TargetWorker.provision()`, freshly allocating tmpfs `/work` (64m) and `/tmp` (16m), preceded by settling pauses between trials.
- **`warm`:** Successive back-to-back runs executed sequentially where the host/WSL2 page-cache retains `node_modules/typescript` and definitions in memory.

### Results

| Trial | Mode | Typecheck (ms) | Build (ms) | Docker Cmd (ms) | Provision (ms) | G1 Verdict | Executed Test IDs | Clean / Zero Res |
|---|---|---|---|---|---|---|---|---|
| 1 | cold | 5,300 | 5,517 | 11,292 | 13,547 | **PASS** | `typecheck`, `build` | true / true |
| 2 | cold | 5,725 | 5,400 | 11,623 | 13,879 | **PASS** | `typecheck`, `build` | true / true |
| 3 | cold | 5,723 | 5,726 | 11,980 | 14,194 | **PASS** | `typecheck`, `build` | true / true |
| 4 | cold | 5,506 | 5,413 | 11,379 | 13,567 | **PASS** | `typecheck`, `build` | true / true |
| 5 | cold | 6,386 | 5,800 | 12,627 | 14,788 | **PASS** | `typecheck`, `build` | true / true |
| 6 | warm | 5,695 | 5,663 | 11,819 | 14,031 | **PASS** | `typecheck`, `build` | true / true |
| 7 | warm | 5,296 | 5,394 | 11,141 | 13,339 | **PASS** | `typecheck`, `build` | true / true |
| 8 | warm | 5,760 | 5,455 | 11,671 | 13,831 | **PASS** | `typecheck`, `build` | true / true |
| 9 | warm | 5,393 | 5,776 | 11,616 | 13,827 | **PASS** | `typecheck`, `build` | true / true |
| 10 | warm | 5,587 | 5,424 | 11,433 | 13,579 | **PASS** | `typecheck`, `build` | true / true |

### Summary Statistics
- **Cold Typecheck Elapsed:** min 5,300 ms, max 6,386 ms, mean 5,728 ms (headroom: 5,614 ms to 12s cap)
- **Cold Build Elapsed:** min 5,400 ms, max 5,800 ms, mean 5,571 ms (headroom: 6,200 ms to 12s cap)
- **Warm Typecheck Elapsed:** min 5,296 ms, max 5,760 ms, mean 5,546 ms (headroom: 6,240 ms to 12s cap)
- **Warm Build Elapsed:** min 5,394 ms, max 5,776 ms, mean 5,542 ms (headroom: 6,224 ms to 12s cap)
- **Whole Provision Elapsed:** min 13,339 ms, max 14,788 ms
- **Leftover Containers / Volumes:** 0 / 0 across all runs.

---

## 5. Confirmed Facts vs Unproven Hypotheses for Historic Run #41749479450

1. **Confirmed:** In run #41749479450, `executedTestIds=["workshop-business:typecheck"]` proves that the `typecheck` phase completed normally with integer exit code 0.
2. **Confirmed:** The failure occurred after typecheck: either during the `build` phase (`tsc` compilation) or during outer container management/orchestration.
3. **Confirmed:** The exact failure subtype in run #41749479450 remains **`UNKNOWN`** because the historical public receipt did not include phase error/signal records and retained ciphertext was not decrypted.
4. **Distinction:** The local cold start measurement of 12,264 ms in previous research (`RESULTS.md`) occurred in `typecheck` on a heavily cold disk state, proving that 12,000 ms can be exceeded under extreme cold starts, but it is **not** evidence of what caused run #41749479450 to fail in `build`.
5. **Stability of Known-Good:** The known-good synthetic workshop fixture compiles cleanly in ~11.5–12.6s total (both phases combined) under project CPU/RAM limits.

---

## 6. Execution Accounting

### ACTUALLY_RUN Commands

| Command | Exit Code | Outcome |
|---|---|---|
| `pnpm install --frozen-lockfile` | 0 | All 11 workspace packages up to date |
| `pnpm lint` | 0 | Biome check passed across 366 files |
| `pnpm typecheck` | 0 | Workspace builds and tsc typecheck passed across 10 packages |
| `pnpm test` | 0 | 902 tests total (788 passed, 114 skipped, 0 failed) |
| `pnpm build` | 0 | All workspace builds completed |
| `pnpm --filter @metamorph/target-worker test` | 0 | 69/69 passed |
| `node --test packages/agent-real/test/build-phase-diagnostics.test.mjs` | 0 | 12/12 passed |
| `node --test packages/agent-real/test/g1-qualification.test.mjs` | 0 | 5/5 passed |
| `node research/mmp-167/negative-controls.mjs` | 0 | 9 control groups passed |
| `node packages/target-worker/src/smoke.mjs` | 0 | 30/30 scenarios passed in Docker |
| `node research/mmp-167/measure-live.mjs` | 0 | 10/10 live Docker qualification trials passed |

### NOT_RUN

- NO Meta API calls, billable probes, or provider requests.
- NO workflow dispatches (`meta-paid-migration.yml` or `workflow_dispatch`).
- NO re-runs of historical jobs or actions.
- NO decryption, unpacking, or execution of retained candidate ciphertext.
- G2 / G3 differential verification on candidate code: **NOT_RUN**.
- G0 / G4 independent controls on candidate: **NOT_RUN**.
- Product acceptance: **NOT ESTABLISHED**.

---

## 7. Residual Risks & Recommended Actions

1. **Hosted CI Execution Speed:** Hosted GitHub Actions runners (Ubuntu 24.04 VMs) may have different I/O and CPU scheduling jitter than local WSL2. A dedicated credential-free hosted runner qualification workflow is needed to observe phase timing under GitHub runner virtualization.
2. **Issue Closure Policy:** Issue #167 must remain **OPEN** until an authorized hosted run demonstrates diagnostic classification in production or a dedicated hosted qualification confirms baseline timing. Issue #161 (downstream) must remain open.
3. **No Paid Rerun:** Do not trigger or authorize a paid run until all downstream prerequisites and independent audit reviews are completed.
