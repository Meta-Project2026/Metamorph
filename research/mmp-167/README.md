# MMP-167 — offline diagnosis of the real G1 build-phase ERROR

Refs [#167](https://github.com/Meta-Project2026/Metamorph/issues/167). Strictly
offline: no Meta request, no paid workflow dispatch/rerun, no candidate
decryption or export, no new Docker execution of candidate code. The only
Docker execution recorded here is a trusted synthetic fixture on a pinned local
toolchain.

## Confirmed public-run facts

Run [41749479450](https://github.com/Meta-Project2026/Metamorph/actions/runs/41749479450),
`workflow_dispatch`, actor `barbalatv`, attempt 1, protected
`main@32d173fc0ddb6cfe8d0addd3061fe5493f6e48f6`.

| Fact | Value |
| --- | --- |
| Public artifact | `meta-paid-public-41749479450`, ID `13285336430`, SHA-256 `44e8acda1b0c543087b7615ab18a81a900cded514f8b62ab487d7f44e2dfce71` |
| Encrypted candidate artifact | `mmp107-candidate-41749479450-1`, ID `13284218898`, archive SHA-256 `d65a81d79dc2525014bdc3aaac9dfab2593a2de6c13fbd8e8a8cb3eb125dfd88`, ciphertext SHA-256 `2c28f738b93669c9aee6ad771eb4bb3b31734128ad18bb03b1614510667e74b1`, 27,960 bytes |
| Paid POSTs | 1; HTTP 200, TLS verified, `RESPONSE_RECEIVED`; 6,392 input / 9,073 output tokens; estimated `$0.04655025`; charged **UNKNOWN**; `NO_PROVIDER_HARD_CAP` |
| Candidate SHA-256 | `4e863cb94b444970e237e7cb8eb028ec99f5d960b200b5d1e714c91ee785f448` |
| Custody | PASS (`CAPTURED_UNVERIFIED` → `STORED_UNVERIFIED`); authenticated readback; both cleanups `VERIFIED_ZERO_RESOURCES` |
| G1 | `ERROR`, executed ids `["workshop-business:typecheck"]`, finding codes `["ENVIRONMENT_ERROR", "BUILD_FAILED"]` |
| Compiler diagnostics | `status=DIAGNOSTIC_UNAVAILABLE`, `errorCount=null` |
| G2 / G3 | `ERROR`; 0/17 HTTP and 0/20 SQLite coverage; no gate was run |
| G4 | No control ran. The attempt-gate projection is `ERROR` because a fatal code is propagated; the trial-level field remains `INCONCLUSIVE`. Neither is a G4 result. |
| Repair | 0 POSTs; workflow step SKIPPED; `PUBLIC_VERIFICATION_ERROR`, `complete=false`, `NOT_AUTHORIZED_BY_THIS_REPORT` |

The public artifact was downloaded and inspected locally. Its bytes were not
modified. The encrypted archive was downloaded only to confirm its recorded
size/hash; it was **not** decrypted, unpacked or inspected.

## Source-grounded answer: why `typecheck` is executed while G1 is ERROR

This is a deterministic path through current `main`; it does not identify the
subtype of the build-phase fault.

1. `packages/target-worker/runtime/build.mjs` runs two separate `spawnSync`
   compiler phases, `typecheck` and `build`, each with `timeout: 12000` and
   `maxBuffer: 512 * 1024`. For every phase it records `exitCode=result.status`,
   `signal=result.signal`, `error=result.error?.code`, plus stdout/stderr. If
   `result.status !== 0` it prints `{checks, artifacts: []}` and exits 2.
2. A normal `typecheck` success has integer `exitCode=0`, no signal and no
   error. A timeout, external kill, spawn failure or output overflow has a
   non-integer/`null` status with an error code and/or signal; `null !== 0`, so
   the trusted script still prints the phase receipt and exits 2. The normal
   compiler-error case is different: it also exits 2, but with an integer
   non-zero phase `exitCode` and no error/signal.
3. `packages/target-worker/src/controller.mjs` (`provision`) calls the outer
   `docker run`. It classifies **any** outer exit 2 as
   `BUILD_FAILED` (`built.exitCode === 2 ? "BUILD_FAILED" : ...`) before the
   phase detail is used. Later validation of the parsed checks also throws
   `BUILD_FAILED` for a non-zero/abnormal build phase.
4. In `packages/agent-real/src/runtime.mjs` (`runPair`) the operation failure is
   stored as `failure = "BUILD_FAILED"`.
5. `observeBuild` → `buildReceipt` independently parses the trusted phase
   receipt. The valid `typecheck` check is appended to `executedTestIds`. The
   next phase has `error || signal || !Number.isInteger(exitCode)`, so
   `buildReceipt` returns `ERROR` with `["ENVIRONMENT_ERROR"]` immediately. It
   never appends `workshop-business:build`.
6. `runPair` only clears `BUILD_FAILED` when the build verdict is `FAIL`
   (`failure === "BUILD_FAILED" && build?.verdict === "FAIL"`). Here the build
   verdict is `ERROR`, so the operation code survives.
7. `aggregateAttempt` (`packages/agent-real/src/report.mjs`) sees a G1 `ERROR`
   entry and a fatal `BUILD_FAILED`. It emits `G1=ERROR` with
   `["ENVIRONMENT_ERROR", "BUILD_FAILED"]`. G2/G3 have no entries, but the fatal
   code still forces `ERROR`; coverage stays 0/17 and 0/20.
8. `packages/agent-real/src/live-experiment.mjs` treats a public G1/G2/G3
   `ERROR` as `PUBLIC_VERIFICATION_ERROR`, `complete=false`; the repair gate
   requires a complete eligible `FAIL` with allowlisted feedback, so no repair
   is authorized. The observed 0 repair POSTs are consistent.

The two visible G1 finding codes therefore mean different things:
`ENVIRONMENT_ERROR` comes from the trusted phase envelope (abnormal
termination), while `BUILD_FAILED` is the outer controller/operation label.
The latter does **not** establish a TypeScript compiler verdict.

## Input-to-outcome matrix

`result` below is one `spawnSync` phase. `outer` is the Docker receipt returned
by `build.mjs`.

| Synthetic input | `buildReceipt` | New sidecar (G1 ERROR only) | G1 | G2/G3 | Repair |
| --- | --- | --- | --- | --- | --- |
| typecheck 0, build 0 | PASS | absent | PASS | proceed | not applicable |
| typecheck 0, build integer 2 (normal TS error) | FAIL `BUILD_FAILED` | absent | FAIL | not run; missing coverage | not a complete eligible FAIL |
| typecheck integer 2, build not reached | FAIL `BUILD_FAILED` | absent | FAIL | not run; missing coverage | not a complete eligible FAIL |
| typecheck 0, build timeout (`ETIMEDOUT`, `SIGTERM`, status null) | ERROR `ENVIRONMENT_ERROR` | `BUILD_PHASE_TIMEOUT` (phase `build`) | ERROR `ENVIRONMENT_ERROR` + `BUILD_FAILED` | ERROR, 0 coverage | no |
| typecheck 0, build external signal (status null) | ERROR `ENVIRONMENT_ERROR` | `BUILD_PHASE_SIGNAL` | same | ERROR, 0 coverage | no |
| typecheck 0, build spawn error (status null) | ERROR `ENVIRONMENT_ERROR` | `BUILD_PHASE_SPAWN_ERROR` | same | ERROR, 0 coverage | no |
| typecheck 0, build `ENOBUFS` | ERROR `ENVIRONMENT_ERROR` | `BUILD_PHASE_OUTPUT_OVERFLOW` | same | ERROR, 0 coverage | no |
| typecheck 0, build non-integer/no error/no signal | ERROR `ENVIRONMENT_ERROR` | `BUILD_PHASE_UNKNOWN` | same | ERROR, 0 coverage | no |
| outer Docker timeout | ERROR `TIMEOUT` | absent (outer code is already specific) | ERROR `TIMEOUT` | ERROR, 0 coverage | no |
| outer Docker spawn error / stdout overflow / exit 125 | ERROR `ENVIRONMENT_ERROR` | absent | ERROR `ENVIRONMENT_ERROR` | ERROR, 0 coverage | no |
| malformed trusted envelope | `EVIDENCE_ERROR` (fail closed) | unavailable, never fabricated | ERROR/invalid evidence | no | no |

## Confirmed vs hypotheses for the real run

**Confirmed by source and public receipt**

- `typecheck` completed with a normal integer exit verdict and was appended.
- The following `build` phase did not produce a normal compiler verdict: it had
  an error, a signal, or a non-integer exit code.
- The outer `build.mjs` exited 2 and the controller labelled the operation
  `BUILD_FAILED`; `buildReceipt` independently labelled G1 `ERROR`.
- No compiler diagnostics were published, so no TypeScript error code, path or
  line is established.

**Consistent hypotheses, not distinguished by the old public receipt**

- `spawnSync` timeout (`ETIMEDOUT` + `SIGTERM`).
- External termination such as OOM `SIGKILL`.
- `spawnSync` failure (`EAGAIN`, `ENOMEM`, ...).
- `maxBuffer` overflow (`ENOBUFS`).
- Some other abnormal `spawnSync` result.

**Not supported**

- A normal TypeScript build/type error (would be an integer non-zero exit and a
  `FAIL` receipt with `BUILD_FAILED`, not `ENVIRONMENT_ERROR`).
- A typecheck failure (it would not have produced the executed typecheck id).
- "Timeout is proven" — the timing is compatible and one local cold start hit
  the limit, but there is no observation of the phase fields in the old public
  receipt and no measurement on the hosted runner.
- Any claim about G2/G3 parity, a product PASS, or a successful repair.

## Timeout measurement (bounded, synthetic, pinned toolchain)

A local check was run on Windows 11 / Docker 29.9.2 (linux/amd64) with a locally
cached `metamorph-target-worker` image (`node v24.11.0`, `typescript 5.9.3`).
The current HEAD `build.mjs` was overlaid read-only into a derived image
(network `none`, `--cpus 1`, `--memory 256m`, `--memory-swap 256m`,
`--pids-limit 64`, the same tmpfs and read-only sandbox flags). Input was the
trusted `packages/target-worker/fixtures/workshop/src` fixture; no candidate
bytes were used. The only instrumentation was `performance.now()` around the
two existing `spawnSync` calls.

A later confirmation batch produced:

| Run | typecheck | build | Total (host) | Result |
| --- | --- | --- | --- | --- |
| 1 (cold) | 12,264 ms | not reached | 12,938 ms | typecheck `ETIMEDOUT`/`SIGTERM`, outer exit 2 |
| 2 (warm) | 4,262 ms | 4,491 ms | 9,172 ms | success |
| 3 (warm) | 4,666 ms | 4,460 ms | 9,516 ms | success |

Warm runs across both local batches measured about 4.2–4.8 s per phase, but the
first cold run **hit the existing 12,000 ms per-phase timeout**. This establishes
that the limit is reachable on a cold local container start; it is still **not**
a claim that the hosted run timed out, nor a claim about the real candidate.
The exact hosted image could not be rebuilt in this environment: `docker build
--network none` failed with `EAI_AGAIN` against the npm registry, so the
measurement used a locally cached image with the current script overlaid. The
real Oracle step wall time (about 26.4 s) is compatible with several
explanations and does not prove a timeout. The timeout and sandbox are unchanged
by this PR.

## Implemented diagnostic (without changing gate/scorecard contracts)

`packages/agent-real/src/build-phase-diagnostics.mjs` adds a fixed, public-safe
classification:

- `BUILD_PHASE_TIMEOUT`
- `BUILD_PHASE_SIGNAL`
- `BUILD_PHASE_SPAWN_ERROR`
- `BUILD_PHASE_OUTPUT_OVERFLOW`
- `BUILD_PHASE_UNKNOWN`

The summary reads only the already-trusted build-recipe envelope and the first
abnormal phase. It publishes a versioned pair sidecar
`mmp167-build-phase-diagnostics-v1` with identity (`sourceSha`, `candidateSha`,
`attemptId`, `pairId`, `g1Verdict`), `status`, `phase` and the fixed `code`.
Publication is bound in-process to the exact candidate; foreign/reloaded
summaries are `DIAGNOSTIC_UNAVAILABLE`. It is emitted only for G1 `ERROR` with
an available inner-phase classification. No raw stdout/stderr, compiler
message, exit number, signal, path, source, key or private evidence crosses.

Existing G1/G2/G3/G4 finding codes, `VerificationReport`/gate schemas, the
scorecard, repair eligibility and the timeout/sandbox are unchanged. In
particular, the legacy aggregate still contains `BUILD_FAILED` for the old
abnormal-build shape; changing that code would be a separate public-contract
decision. The new sidecar disambiguates it for the next authorized run.

## Regression / negative controls

`packages/agent-real/test/build-phase-diagnostics.test.mjs` covers the full
matrix above with the production `buildReceipt`, `observeBuild`, `publicAttempt`
and classifier. It also feeds real local `spawnSync` results (success, normal
exit 2, timeout/`ETIMEDOUT`, `ENOBUFS`, missing executable) into the isolated
classifier, so the test is not only a hand-shaped mock.

`research/mmp-167/negative-controls.mjs` is the same offline matrix as a
standalone, assertion-based receipt. Both execute only trusted synthetic
inputs. Docker measurement is manual and is not part of PR CI.

## Accounting and remaining unknowns

- 1 real Meta POST, estimated `$0.04655025`, charged **UNKNOWN**.
- Custody PASS; both cleanups `VERIFIED_ZERO_RESOURCES`.
- G1 `ERROR`; G2/G3 not executed (0/17, 0/20); G4 not executed.
- 0 repair POSTs; repair not authorized.
- The exact build-phase subtype for run 41749479450 remains **UNKNOWN** because
  the old public receipt does not contain it and the ciphertext was not
  decrypted. The new sidecar would classify a future authorized run; it cannot
  retroactively classify this one.
- Owner-only decryption of the retained candidate, if ever authorized, is a
  separate decision gate and was not performed.

## Reproduction

```sh
node --test packages/agent-real/test/build-phase-diagnostics.test.mjs
node research/mmp-167/negative-controls.mjs
```

The local timing procedure (manual, network `none`, no candidate) is described
in `RESULTS.md`; it is not run by PR CI. Docker integration is otherwise
**NOT_RUN** unless `RESULTS.md` records a successful command.
