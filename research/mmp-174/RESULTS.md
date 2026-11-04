# MMP-174 Hosted G1 Synthetic Stress Qualification: Decision Report

**Date:** 2026-11-04
**Workflow Run:** [#41819253155](https://github.com/Meta-Project2026/Metamorph/actions/runs/41819253155) (Job ID `126537957762`)
**Pushed HEAD SHA:** `c754d0e523a345b87a8b6f74073c4392d5a3a026`
**Runner Environment:** Azure `eastus3` / Ubuntu 24.04.5 LTS / Docker 28.5.1 / Node v24.22.1 / pnpm 10.28.2
**Target Recipe Digest:** `f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3` (matches committed `RECIPE_PIN` exactly)
**Runtime Image ID:** `sha256:a9a96371954f1ad5895934948c816aa0c7400b6b6f1edc55db2db91ea28b7177`
**Artifact ID:** `13315699632` ([`mmp174-hosted-stress-results.zip`](https://github.com/Meta-Project2026/Metamorph/actions/runs/41819253155/artifacts/13315699632))
**Decision Classification:** **`STABLE_WITHIN_TESTED_TIERS`**
**Production Recommendation:** **PRESERVE ALL PRODUCTION TIMEOUT CONSTANTS AND CONTRACT PINS**

---

## 1. Executive Summary & Mission Answers

MMP-174 executed a short, bounded, reproducible, credential-free G1 compiler stress qualification on GitHub Actions `ubuntu-24.04` using graded synthetic public TypeScript workload tiers.

### Core Mission Questions Answered by Evidence

1. **Can the real trusted `TargetWorker` typecheck and build moderately/heavily structured yet valid public TypeScript bundles using the current isolated runtime?**
   **YES.** All 9 trials across all 3 tiers (`baseline`, `moderate`, `heavy`) passed G1 compilation (`9/9 PASS`, 100% success rate). The heaviest tier (26 total files, 24 synthetic TS modules, 54,316 total bytes, ~41 KiB added source) completed both compilation phases serially in a median outer Docker command time of **11,391 ms** (max **11,667 ms**), fully compliant with the 35,000 ms provision timeout (~66% headroom).

2. **When a tier fails, is it an ordinary TS compiler `FAIL`, an abnormal phase `ERROR` (`BUILD_PHASE_TIMEOUT`, signal, overflow, spawn), an outer Docker budget timeout, or missing evidence?**
   **DISTINGUISHED AND VALIDATED.** The fail-closed harness and validator distinguish normal `BUILD_FAILED` compiler diagnostic failures from abnormal phase errors (`BUILD_PHASE_TIMEOUT`, `BUILD_PHASE_SIGNAL`, `BUILD_PHASE_OUTPUT_OVERFLOW`, `BUILD_PHASE_SPAWN_ERROR`), outer Docker timeouts (`TIMEOUT`), and environmental/cleanup faults (`CLEANUP_FAULT`, `RESIDUAL_OWNED_RESOURCES`). This classification logic was comprehensively exercised and confirmed via deterministic unit controls in [`packages/agent-real/test/g1-stress.test.mjs`](../../packages/agent-real/test/g1-stress.test.mjs) and [`research/mmp-174/stress.test.mjs`](stress.test.mjs).

3. **Is a future production timeout or compiler-design change supported by evidence, and what cross-layer decision gate would it require?**
   **NO TIMEOUT CHANGE IS SUPPORTED.** On the official hosted Ubuntu 24.04 runner, synthetic compilations scale gracefully with added source (+444 ms median Docker command time from baseline 13 KiB to heavy 54 KiB). No compiler timeout was reproduced in synthetic testing. Modifying production timeouts or switching to a single-pass emit would be premature and risky, altering cryptographic pins (`RECIPE_PIN`, `DIAGNOSTIC_POLICY.recipeSha`) and public G1 gate contracts (`[scenario:typecheck, scenario:build]`). Any such change requires a joint Vladimir + Ilia ratification gate.

---

## 2. Workload Tier Design & Admission Bounds

All synthetic modules were generated strictly in memory using [`research/mmp-174/workload-generator.mjs`](workload-generator.mjs), forming a strict Directed Acyclic Graph (DAG) with explicit `.js` import specifiers adhering to NodeNext module resolution. No candidate code was derived from, approximate to, or ingested from private candidate text, reference fixtures, or held-out tests.

| Dimension | Baseline | Moderate | Heavy | Real Admission Limit |
|---|:---:|:---:|:---:|:---:|
| Total Files | 2 files (`main.ts`, `schema.ts`) | 8 files (2 base + 6 synthetic) | 26 files (2 base + 24 synthetic) | 1 – 64 files |
| Total Source Bytes | 13,249 bytes (~13 KiB) | 29,447 bytes (~29 KiB) | 54,316 bytes (~53 KiB) | $\le$ 1,048,576 bytes (1 MiB) |
| Added Source Bytes | 0 bytes | 16,198 bytes (~16 KiB) | 41,067 bytes (~40 KiB) | Target: 10–40K (mod), 40–120K (heavy) |
| Max File Size | 10,708 bytes | 10,708 bytes | 10,708 bytes | $\le$ 262,144 bytes (256 KiB) |
| Entrypoint Present | `src/main.ts` | `src/main.ts` | `src/main.ts` | Required (`src/main.ts`) |
| Emitted JS Files | 2 files | 8 files | 26 files | $\le$ 64 files |
| Candidate SHA-256 | `34c8325a...` | `94436784...` | `849e1d9a...` | Bounded hex digest |

### Tier Descriptions

- **`baseline`**: The unchanged, immutable public fixture `packages/target-worker/fixtures/workshop` (`candidateSha = 34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334`).
- **`moderate`**: Baseline plus modules `mod_01.ts` through `mod_06.ts`, introducing generic monads (`Result<T, E>`, `Option<T>`), entity audit trackers (`ChangeTracker<T>`), customer profiles, inventory stock ledgers, appointment state machines, and invoice total calculations.
- **`heavy`**: Baseline plus modules `mod_01.ts` through `mod_24.ts`, extending the dependency DAG with warranty claims, telematics OBD fault codes, fleet scheduling, technician qualification matrices, work order task DAGs, quality control checklists, supplier POs, warehouse bins, notifications, dynamic pricing, KPI aggregators, bay scheduling, NPS surveys, and master regulatory export hubs.

---

## 3. Hosted Qualification Measurements Table

Data from [GitHub Actions run #41819253155](https://github.com/Meta-Project2026/Metamorph/actions/runs/41819253155), artifact [`mmp174-hosted-stress-results.zip`](https://github.com/Meta-Project2026/Metamorph/actions/runs/41819253155/artifacts/13315699632):

| Trial | Tier | Docker Cmd (ms) | Provision (ms) | G1 Verdict | Executed Test IDs | Clean / Zero Res |
|:---:|---|:---:|:---:|:---:|---|:---:|
| 1 | `baseline` | 10,828 | 11,389 | **PASS** | `[workshop-business:typecheck, workshop-business:build]` | true / true |
| 2 | `baseline` | 11,079 | 11,597 | **PASS** | `[workshop-business:typecheck, workshop-business:build]` | true / true |
| 3 | `baseline` | 10,947 | 11,444 | **PASS** | `[workshop-business:typecheck, workshop-business:build]` | true / true |
| 4 | `moderate` | 11,374 | 11,882 | **PASS** | `[workshop-business:typecheck, workshop-business:build]` | true / true |
| 5 | `moderate` | 11,143 | 11,628 | **PASS** | `[workshop-business:typecheck, workshop-business:build]` | true / true |
| 6 | `moderate` | 11,110 | 11,593 | **PASS** | `[workshop-business:typecheck, workshop-business:build]` | true / true |
| 7 | `heavy` | 11,291 | 11,789 | **PASS** | `[workshop-business:typecheck, workshop-business:build]` | true / true |
| 8 | `heavy` | 11,391 | 11,885 | **PASS** | `[workshop-business:typecheck, workshop-business:build]` | true / true |
| 9 | `heavy` | 11,667 | 12,146 | **PASS** | `[workshop-business:typecheck, workshop-business:build]` | true / true |

### Tier Performance Summary

| Tier | Trials Run / Pass | Docker Cmd Min (ms) | Docker Cmd Median (ms) | Docker Cmd Max (ms) | Provision Median (ms) | Outer Headroom (vs 35s) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `baseline` | 3 / 3 (100%) | 10,828 | 10,947 | 11,079 | 11,444 | ~68% (~23.9s) |
| `moderate` | 3 / 3 (100%) | 11,110 | 11,143 | 11,374 | 11,628 | ~67% (~23.6s) |
| `heavy` | 3 / 3 (100%) | 11,291 | 11,391 | 11,667 | 11,885 | ~66% (~23.3s) |

---

## 4. Time Budget Hierarchy & Decision Analysis

| Parameter | Location | Current Pin | Measured Value (Heavy Tier) | Margin | Recommendation |
|---|---|:---:|:---:|:---:|:---:|
| `timeout` (phase) | `runtime/build.mjs` | 12,000 ms | Not emitted individually; full command max 11,667 ms | Positive lower bound | **RETAIN (NO CHANGE)** |
| `timeoutMs` (provision) | `src/controller.mjs` | 35,000 ms | 11,291 – 11,667 ms | ~66% margin (~23.3s) | **RETAIN (NO CHANGE)** |
| `operationTimeoutMs` | `src/controller.mjs` | 15,000 ms | N/A (build phase only) | N/A | **RETAIN (NO CHANGE)** |
| `lifetimeMs` | `src/controller.mjs` | 180,000 ms | ~11.8s (provision) | ~93% margin | **RETAIN (NO CHANGE)** |
| `deadlineMs` | `private-diagnostics.mjs` | 30,000 ms | N/A | N/A | **RETAIN (NO CHANGE)** |

### Per-Phase Durations Note
Per `AGENTS.md` and the canonical production recipe, individual per-phase durations (`typecheckDuration`, `buildDuration`) are **not emitted by the canonical production recipe** (`build.mjs`). They are explicitly recorded as `"NOT_AVAILABLE_FROM_PRODUCTION_RECEIPT"` in the sanitized evidence. Because the two phases execute serially inside Docker and the entire command took at most 11,667 ms, both phases combined executed comfortably within the outer Docker deadline without exceeding the 12,000 ms internal spawn limit.

---

## 5. Future Decision Gate: Single-Pass Emit & Timeout Governance

Should future authentic candidates or larger workloads encounter compiler timeouts, any architectural adjustment must follow this explicit decision gate:

1. **Why Single-Pass Emit is Deferred:**
   - Removing the duplicate `tsc` invocation (running typecheck and emit in a single pass) would theoretically reduce compiler overhead.
   - However, the G1 contract currently expects two distinct test IDs: `[scenario + ":typecheck", scenario + ":build"]`.
   - Merging phases alters error granularity (distinguishing pure type errors from emit errors).
   - Changing `runtime/build.mjs` changes `RECIPE_PIN` (`f09b12fe...`) and `DIAGNOSTIC_POLICY.recipeSha`.
2. **Ratification Requirement:**
   - Per `AGENTS.md`, shared contract changes require explicit joint agreement between Vladimir (migration/orchestration) and Ilia (baseline/comparator/Oracle).
   - No unilateral timeout increases or recipe modifications are authorized.

---

## 6. Explicit Separation of Facts

- **Confirmed Synthetic Finding:** The real `TargetWorker` runtime compiles graded public TypeScript workloads up to 26 files / ~54 KiB stably and deterministically on hosted Ubuntu 24.04 with ~66% outer margin.
- **Historical Run `#41749479450`:** Remains historically G1 `ERROR` with build-phase subtype `UNKNOWN`. The synthetic stress runs do not establish the root cause of the historical paid failure.
- **Parity Gates G2 / G3:** G2 (HTTP contracts) and G3 (SQLite state parity) were **`NOT_RUN`** in this compiler-only experiment.
- **Product Acceptance:** Migration success and product acceptance remain **`NOT_ESTABLISHED`**.
- **Spending & Paid Trials:** No paid model API calls or paid trials were executed or authorized.
- **Issue Status:** Issue #174, parent #167, and downstream #161 remain **OPEN**.
