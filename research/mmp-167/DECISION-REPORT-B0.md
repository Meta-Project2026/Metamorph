# MMP-167 Hosted Qualification Decision Report: Decision B0

**Date:** 2026-11-04  
**Workflow Runs:** [#41813835915](https://github.com/Meta-Project2026/Metamorph/actions/runs/41813835915) (initial 10/10) and [#41814496390](https://github.com/Meta-Project2026/Metamorph/actions/runs/41814496390) (hosted rerun at PR head, 10/10)  
**Runner Environment:** Azure `northcentralus` / Ubuntu 24.04.5 LTS / Docker 28.5.1 / Node v24.22.1  
**Target Fixture:** Synthetic known-good `packages/target-worker/fixtures/workshop` (`candidateSha = 34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334`)  
**Target Recipe Digest:** `f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3` (matches committed `RECIPE_PIN` exactly)  
**Status:** **DECISION B0 (NO SUPPORTED ROOT CAUSE ON HOSTED RUNNER — PRESERVE PRODUCTION CONSTANTS)**

---

## 1. Executive Summary & Verdict

1. **Hosted Qualification Verdict: `PASS` (10/10 trials passed on Ubuntu 24.04).**
   - 5 `fresh-container/repeated-image` trials: **5/5 PASS**.
   - 5 `back-to-back-warm-container` trials: **5/5 PASS**.
   - Zero timeouts, zero abnormal exits, zero errors, zero resource leaks.
   - `zeroResourcesVerified = true` across all 10 trials (`VERIFIED_ZERO_RESOURCES`).
2. **Decision: `B0` (No Production Timeout Changes).**
   - The synthetic fixture compiles stably in **10.63s – 11.09s total** for both phases combined.
   - Individual phase durations are **not reported by the canonical build recipe**. Since the phases execute serially inside a Docker command that took at most 11,087 ms in the first hosted run, only a conservative >913 ms (>7.6%) lower bound on phase headroom follows from that run; no 54% phase margin was measured.
   - Outer container execution takes ~11.0s, providing **~68% headroom** against the 35,000 ms outer Docker limit.
   - These synthetic hosted runs do not support a production timeout change on their own; they do not establish the authentic model-generated candidate's build behavior or historical root cause.
3. **Migration & Product Status: `NOT_ESTABLISHED`.**
   - Authentic paid run #41749479450 remains G1 `ERROR` with build-phase subtype `UNKNOWN`.
   - G2/G3 had 0/17 HTTP and 0/20 SQLite executed checks.
   - Issue #167 and downstream #161 remain **OPEN**.

---

## 2. Hosted Qualification Measurements Table

Data from [GitHub Actions run #41813835915](https://github.com/Meta-Project2026/Metamorph/actions/runs/41813835915), artifact [`mmp167-hosted-qualification-results.zip`](https://github.com/Meta-Project2026/Metamorph/actions/runs/41813835915/artifacts/13313697724):

| Trial | Mode | Docker Cmd (ms) | Provision (ms) | G1 Verdict | Executed Test IDs | Clean / Zero Res |
|:---:|---|:---:|:---:|:---:|---|:---:|
| 1 | fresh-container/repeated-image | 11,031 | 11,637 | **PASS** | `[workshop-business:typecheck, workshop-business:build]` | true / true |
| 2 | fresh-container/repeated-image | 10,773 | 11,364 | **PASS** | `[workshop-business:typecheck, workshop-business:build]` | true / true |
| 3 | fresh-container/repeated-image | 10,670 | 11,316 | **PASS** | `[workshop-business:typecheck, workshop-business:build]` | true / true |
| 4 | fresh-container/repeated-image | 10,699 | 11,283 | **PASS** | `[workshop-business:typecheck, workshop-business:build]` | true / true |
| 5 | fresh-container/repeated-image | 10,759 | 11,332 | **PASS** | `[workshop-business:typecheck, workshop-business:build]` | true / true |
| 6 | back-to-back-warm-container | 10,878 | 11,462 | **PASS** | `[workshop-business:typecheck, workshop-business:build]` | true / true |
| 7 | back-to-back-warm-container | 10,630 | 11,225 | **PASS** | `[workshop-business:typecheck, workshop-business:build]` | true / true |
| 8 | back-to-back-warm-container | 10,761 | 11,337 | **PASS** | `[workshop-business:typecheck, workshop-business:build]` | true / true |
| 9 | back-to-back-warm-container | 10,752 | 11,364 | **PASS** | `[workshop-business:typecheck, workshop-business:build]` | true / true |
| 10 | back-to-back-warm-container | 11,087 | 11,688 | **PASS** | `[workshop-business:typecheck, workshop-business:build]` | true / true |

---

## 3. Hosted vs Local WSL2 Comparative Analysis

| Dimension | Local WSL2 (PR #172) | GitHub-Hosted Ubuntu 24.04 (Run #41813835915) |
|---|---|---|
| OS / Kernel | Windows 11 / WSL2 Linux 6.6.x | Ubuntu 24.04.5 LTS / Linux 6.8.0-1017-azure |
| Storage / I/O | VHDX / NTFS 9P translation overhead | Native ext4 Azure ephemeral SSD |
| Recipe Hash | `bd2296...` (CRLF Dockerfile artifact) | `f09b12...` (Exact LF canonical pin) |
| Total Build Cmd Duration | 23.7s – 24.8s | 10.6s – 11.1s |
| Individual phase duration | Not available from canonical production receipts; 5/10 observed timeouts | Not available from canonical production receipts; 0/20 observed timeouts |
| G1 Qualification Outcome | 5 PASS / 5 ERROR (`BUILD_PHASE_TIMEOUT`) | **10 PASS / 0 FAIL (100% PASS)** |
| 12,000 ms margin | 5/10 timed out in local runs | Exact phase margin unknown; >0.9s bound from first hosted full-command maximum, not a measured 54% |
| 35,000 ms Outer Margin | ~29% margin | **~68% margin (~24s headroom)** |

### Conclusion on Timeout Fragility
Local WSL2 runs exhibited 5/10 phase timeouts while two hosted Ubuntu 24.04 runs each passed 10/10. The platforms differ in scheduling, storage and caching, but these observations **do not isolate WSL2, VHDX or 9P as a causal factor**. Recorded full Docker command elapsed times differed materially (~23.7–24.8s locally versus ~10.6–11.1s in the first hosted run); individual compiler-phase timings are not measured by the canonical recipe. No historical paid-run subtype is established.

---

## 4. Time Budget Hierarchy & Decision Gate

| Limit | Location | Current Value | Hosted Measurement | Margin | Status |
|---|---|:---:|:---:|:---:|:---:|
| `timeout` (phase) | `runtime/build.mjs` | 12,000 ms | Not measured; full Docker command max 11,087 ms | >913 ms conservative lower bound in initial hosted batch; exact unknown | **RETAIN (B0)** |
| `timeoutMs` (provision) | `src/controller.mjs` | 35,000 ms | 10,630–11,087 ms | ~68% | **RETAIN (B0)** |
| `operationTimeoutMs` | `src/controller.mjs` | 15,000 ms | N/A (build phase) | N/A | **RETAIN** |
| `lifetimeMs` | `src/controller.mjs` | 180,000 ms | ~11,400 ms (provision) | ~94% | **RETAIN** |
| `deadlineMs` | `private-diagnostics.mjs` | 30,000 ms | N/A | N/A | **RETAIN** |

**Decision:**
Both hosted batches (10/10 each) passed with the canonical recipe, and the observed full Docker command times were within the 35,000 ms outer deadline. Individual per-phase headroom and authentic candidate performance remain unknown. **Decision B0: no production timeout changes on the present evidence.** Production constants and recipe pins remain intact.

---

## 5. Research Option: Single-Pass Emit Analysis

As requested, we evaluated the concept of removing the duplicate `tsc` invocation (`tsc --noEmit` followed by `tsc emit`):

- **Description:** Instead of running `tsc` twice (phase 1: typecheck with `--noEmit`, phase 2: build with emit), run a single `tsc` compilation that produces diagnostic checks and emits artifacts in one pass.
- **Impact:**
  - Theoretical opportunity to avoid a duplicate full TypeScript invocation; **no single-pass benchmark was executed**, so neither speedup magnitude nor resulting G1 semantics are established.
  - Doubles timeout margin without increasing any deadlines.
- **Effort:**
  - Moderate (~1 engineer day). Requires rewriting `build.mjs`, adjusting `observeBuild` and `summarizeBuildPhaseDiagnostics`, updating `TargetWorker` verification logic, and re-pinning `RECIPE_PIN` and `DIAGNOSTIC_POLICY.recipeSha`.
- **Risks & Contractual Blockers:**
  - **HIGH RISK.**
  - G1 public gate contract currently expects two distinct test IDs: `[scenarioId + ":typecheck", scenarioId + ":build"]`.
  - Splitting phase errors (`typecheck` vs `build`) allows differentiating pure type errors from compilation emit errors. Merging them loses this diagnostic granularity.
  - Modifying `build.mjs` alters the cryptographic `RECIPE_PIN` and trusted runtime broker contract.
  - Per `AGENTS.md`, shared contract changes require explicit joint agreement between Vladimir and Ilia.
- **Recommendation:**
  - Do NOT implement at this time. Keep documented as an optimization option if future candidate fixtures exceed hosted compilation thresholds.
