# MMP-167 validation results

Date: 2026-11-04 (local, Windows 11). Base: `origin/main`
`32d173fc0ddb6cfe8d0addd3061fe5493f6e48f6`. The exact final commit SHA and
hosted Actions links are reported in the Draft PR.

Scope: offline diagnosis and synthetic controls only. No Meta request, no paid
workflow dispatch/rerun, no candidate decryption or export, no new candidate
execution, and no repair POST. The only Docker execution below is the trusted
workshop fixture on a locally cached toolchain.

## Repository and harness checks

| Command | Exit | Actual result |
| --- | --- | --- |
| `pnpm lint` | 0 | 361 files checked; 4 warnings, 2 infos; no fixes applied |
| `pnpm typecheck` | 0 | all workspace projects completed |
| `pnpm test` | 0 | 876 tests: 762 pass, 114 skipped, 0 fail (15,220 ms) |
| `pnpm build` | 0 | all workspace builds completed |
| `pnpm --filter @metamorph/differential test` | 0 | 122 tests: 77 pass, 45 skipped, 0 fail |
| `pnpm --filter @metamorph/oracle test:reference` | 0 | 56 tests: 55 pass, 1 skipped, 0 fail |
| `node --test packages/oracle/probes/qualification.test.mjs` | 0 | 2/2 pass |
| `pnpm --filter @metamorph/workshop-audit test` | 0 | 54 tests: 53 pass, 1 skipped, 0 fail |
| `pnpm --filter @metamorph/target-worker test` | 0 | 69/69 pass |
| `node --test research/demo-readiness/*.test.mjs` | 0 | 187/187 pass |

## MMP-167 controls

| Command | Exit | Actual result |
| --- | --- | --- |
| `node --test packages/agent-real/test/build-phase-diagnostics.test.mjs` | 0 | 12/12 pass |
| `node research/mmp-167/negative-controls.mjs` | 0 | `MMP167_CONTROLS PASS (9 groups)` |
| `pnpm exec biome check research/demo-readiness research/mmp-069 research/mmp-054-connected research/mmp-167` | 0 | 21 files checked; no fixes applied |
| `node research/mmp-069/validate.mjs` | 0 | `VALID`; 11 packages, 60 selected test files, 124 research modules, 123 syntax files, privileged runner `NOT_RUN` |
| `node --test research/mmp-069/validate.test.mjs` | 0 | 45/45 pass |
| `node research/mmp-069/check-syntax.mjs` | 0 | `PASS`; 123 files, 0 failed (syntax only; modules not executed) |
| `node research/mmp-123/prompt-sha.mjs` | 0 | `contextPayloadSha256=1f075c68274f0bfcda5a95b97d7374abb7c99758f0eeb48a07b6790d50baee88`, 22,540 bytes; reconstructed `candidateSha=4ff450d2ec5fdcdfd855b7a3ed02b9f369488cf55f354372e4dc11dfb9511e72`; equality with production `contextSha256` was not established by this tool |
| `git diff --check` | 0 | no whitespace errors |

The new unit test is also included in the `pnpm test` glob through
`packages/agent-real/test/*.test.mjs`. The standalone research controls are not
part of PR CI; they are an explicit offline receipt.

## Local Docker measurement (manual, not CI)

A bounded measurement was run with Docker 29.9.2 (linux/amd64) on Windows 11.
The image was `mmp167-target-worker:measure` (image ID `9cddce45eaee`), derived
from the locally cached `metamorph-target-worker:deed4f13-e071-41a6-9892-f86fe2bb184a`
(`node v24.11.0`, TypeScript 5.9.3). The current `build.mjs` was overlaid as a
readable file with `performance.now()` around the two existing `spawnSync`
calls. Input was only the trusted `packages/target-worker/fixtures/workshop/src`
fixture.

The run used `--network none`, `--read-only`, `--cap-drop ALL`,
`--security-opt no-new-privileges`, `--cpus 1`, `--memory 256m`,
`--memory-swap 256m`, `--pids-limit 64`, `--ulimit nofile=128:128`, the existing
`/work` and `/tmp` tmpfs mounts, and the existing 12,000 ms per-phase timeout.

| Run | typecheck | build | Total (host) | Result |
| --- | --- | --- | --- | --- |
| 1 (cold) | 12,264 ms | not reached | 12,938 ms | typecheck `ETIMEDOUT`/`SIGTERM`; outer exit 2 |
| 2 (warm) | 4,262 ms | 4,491 ms | 9,172 ms | success |
| 3 (warm) | 4,666 ms | 4,460 ms | 9,516 ms | success |

An earlier warm batch measured typecheck/build at 4,330/4,534 ms,
4,526/4,714 ms and 4,503/4,757 ms. The cold run is the material observation:
the existing limit is reachable on a cold local container start. It does **not**
prove that the hosted run timed out, and it says nothing about the real
candidate's build phase.

The exact hosted image could not be rebuilt here: `docker build --network none`
failed with `EAI_AGAIN` against the npm registry. The measurement therefore used
the cached image with the current script overlaid, not the exact hosted CI
image. It is not a hosted-CI result.

## Local `research/mmp-108` status (environmental, not a regression)

`node --test research/mmp-108/harness-wiring.test.mjs research/mmp-108/volume-guard.test.mjs`
exits 1 in this shell: 12 tests, 2 pass, 10 fail, with `null !== 0`/`null !== 1`.
The failing assertions receive `status: null` because the tests spawn `sh` and
this Windows `PATH` contains `C:\Program Files\Git\cmd` but not
`C:\Program Files\Git\bin`; `spawnSync("sh", ...)` returns `ENOENT`. Adding
`C:\Program Files\Git\bin` to `PATH` makes the same command exit 0 with 12/12
pass. This is a local environment limitation of the current shell, not a change
introduced by MMP-167. Hosted Linux research execution was not run here.

## Not run / not established

- No hosted CI result is recorded in this file; the Draft PR reports the actual
  workflow run and its result.
- No paid POST, workflow dispatch, paid rerun, model call or repair run.
- No candidate decryption, unpacking, export or execution.
- No full agent-runtime Docker integration and no real sidecar emission. The
  sidecar path is covered by synthetic unit/control tests only.
- G2/G3/G4 and repair are **NOT_RUN**; none is claimed passed.
- The exact build-phase subtype of paid run `41749479450` remains **UNKNOWN**.
  The local cold timeout is compatible with the timeout hypothesis but is not
  evidence about that run.
- Product acceptance and a successful migration remain **NOT ESTABLISHED**.
