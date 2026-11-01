# MMP-108 validation — actual commands and results

Host: Windows 11 (10.0.26300 x64), Git Bash. Docker Desktop engine `29.9.2`,
linux/amd64. All execution used the disposable Linux harness container
(node `v24.22.2`, pnpm `11.25.0` frozen install, tsc build) — the host Node
v22.23.1 never executed candidate or reference code.

| Command (host unless noted)                                                                                | Result                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx biome check research/mmp-108`                                                                         | exit 0, 2 files, 0 problems                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `node --check research/mmp-108/first-step-proof.mjs`                                                       | exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `docker build -f research/mmp-108/harness/Dockerfile -t metamorph-mmp108-harness research/mmp-108/harness` | exit 0 (digest-pinned base; docker CLI 28.5.2 verified against pinned sha256)                                                                                                                                                                                                                                                                                                                                                                     |
| `docker run … metamorph-mmp108-harness mmp108-run` (attempt 1)                                             | ERROR before driver: image `WORKDIR /tmp/work` collided with the clone destination; harness defect, fixed                                                                                                                                                                                                                                                                                                                                         |
| attempt 2                                                                                                  | ERROR before driver: VM `/tmp` tmpfs is `noexec`; `tsc` permission denied (exit 126); harness defect, led to the volume design                                                                                                                                                                                                                                                                                                                    |
| attempt 3                                                                                                  | ERROR inside driver: stale harness image ran the pre-volume script; known-good case returned per-pair G1 PASS + G2/G3 `VERIFIER_ERROR` with zero executed observations; daemon receipt: `bind source path does not exist: …/inspector.php`. Harness defect (stale image, daemon-invisible bind source), fixed; recorded in README as a diagnostic finding                                                                                         |
| attempt 4                                                                                                  | ERROR before driver: `rm -rf` on the volume mount root (`Device or resource busy`); fixed to contents-only cleanup                                                                                                                                                                                                                                                                                                                                |
| attempt 5                                                                                                  | ERROR inside driver after all known-good assertions and finalizer PASS: receipt projection read `findings` on `publicGate` output (`findingCodes` shape); fixed                                                                                                                                                                                                                                                                                   |
| attempt 6 (recorded run, head `f9a7b4458a083e3df721bb94d8b4370e3e0fdb4c`)                                  | **`MMP108 PASS cases=3/3 blockedRequests=0 modelRequests=0 product=NOT_ESTABLISHED`**, container exit 0                                                                                                                                                                                                                                                                                                                                           |
| `docker volume rm mmp108-work mmp108-private mmp108-output`                                                | removed; `docker volume ls` shows 0 `mmp108-*` volumes; private plaintext removed by ordinary `rm` (not a secure erase)                                                                                                                                                                                                                                                                                                                           |
| image accounting                                                                                           | removed all images created by this task: worker image `68680c4fd268` (4 ephemeral `metamorph-target-worker:<uuid>` tags), pulled base `node:24.11.0-bookworm-slim`, dangling probes image `612bef9af477`, superseded harness image `8469f272298a`. Pre-existing images (including Oct-29 worker images from earlier sessions) untouched. Retained: current `metamorph-mmp108-harness` image + its pinned base, as documented reproducible tooling |
| leftover tracked containers/volumes (`mmp007-`, `mmp-reference*`, `mmp-inspector*`)                        | none; per-case finalizer receipts: containers=0, volumes=0, emergencyRemoved=0                                                                                                                                                                                                                                                                                                                                                                    |

## Network receipts (driver guard, in-process)

- Known-good + fault runs together: `sourceFetches=2` (one pinned public
  source archive download per `validateGeneratedMigration` run),
  `blockedRequests=0`. Docker pulls/builds (php pinned digest, worker base,
  probes/worker images) are engine-side preparation, not model calls.
- Model requests: 0. Paid workflow dispatches: 0. Workflow files: unchanged.

## Gate receipts (public projections, verbatim in evidence/)

- Known-good: G1 PASS (6 IDs), G2 PASS (17, first `workshop-business:step-0`),
  G3 PASS (20, first `workshop-business:initial`, post-request `step-0` at
  index 1), G4 INCONCLUSIVE `HELD_OUT_NOT_RUN`, coverage 17/20, cleanup
  `VERIFIED_ZERO_RESOURCES`, finalizer PASS 0/0/0.
- First-step fault: G1 PASS, G2 FAIL + G3 FAIL `HTTP_STATUS` (no `DB_*`),
  coverage 17/20, cleanup verified, finalizer PASS 0/0/0.
- Synthetic controls: 5/5 PASS with sealed evidence directories.

## Review-correction checks (post-review head, no Docker rerun)

Per the independent PR #112 review (B1 public error leak, B2 destructive
volume behavior, B3 false zero-case PASS): driver case logic is unchanged and
the recorded real-Docker evidence stays pinned to execution head
`f9a7b4458a083e3df721bb94d8b4370e3e0fdb4c`; the corrections touch failure
projection, CLI mode/count integrity, harness volume ownership and tests only.

| Command (post-review head)                                          | Result                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node --test research/mmp-108/*.test.mjs`                           | exit 0 — 9/9 PASS: canary failure projection (throwing getters, tokens, private paths), zero-case/truncated/over-full finalize rejection, invalid-mode child process (exit 2, no receipt dir created), volume-guard collision/ownership/removal against a stateful stub `docker` (no destructive real call) |
| `node research/mmp-069/validate.mjs`                                | `VALID` — matrix gates include the new CI step; `research/mmp-108` tests claim GATED_HOSTED                                                                                                                                                                                                                 |
| `node research/mmp-069/check-syntax.mjs`                            | PASS, 84 modules syntax-checked                                                                                                                                                                                                                                                                             |
| `pnpm lint` (root `biome check .`)                                  | exit 0                                                                                                                                                                                                                                                                                                      |
| `node --check research/mmp-108/first-step-proof.mjs`                | exit 0                                                                                                                                                                                                                                                                                                      |
| `sh -n` on all three harness scripts                                | exit 0                                                                                                                                                                                                                                                                                                      |
| `git rebase origin/main` (114973cbcde2debc699ff0b578c146c34b6c636e) | clean, 4 commits replayed                                                                                                                                                                                                                                                                                   |

One test-design defect was caught locally before push and fixed: the
volume-guard stub initially ignored its `existing`/`labels` parameters
(hardcoded behavior); it is now genuinely parameterized, and the tests still
pass with the real guard logic.

## Re-review round 3 check (receipt-container lifecycle)

Residual B5 blocker: the fixed-name `mmp108-receipts` container could leak on
a `docker cp` failure and hold the output volume against owner-verified
volume removal. Fix: run-scoped unique container name
(`mmp108-receipts-<RUN_ID>`), tracked only after successful `docker create`,
removed by the EXIT trap on every path BEFORE owned-volume removal (it holds
the output volume), never touching foreign containers; a failed create leaves
nothing to clean. Two new stateful-stub controls (18 total in the suite):

| Scenario (mocked docker, no real daemon)           | Observed                                                                                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker cp` fails after successful `docker create` | exit nonzero; the uniquely named container removed exactly once, BEFORE `volume rm` of the output volume; all three owned volumes still removed |
| `docker create` itself fails                       | exit nonzero; no container created/removed, no `cp` attempted; all three owned volumes still removed                                            |
| successful run (regression)                        | unique `--name mmp108-receipts-mmp108-*` used (fixed name never appears); container removed; volumes removed                                    |

`pnpm lint` exit 0; `sh -n` clean; `validate.mjs` VALID; `check-syntax.mjs`
PASS 85 modules. The host script remains not executed end-to-end against a
real engine; recorded real-Docker evidence stays pinned to execution head
`f9a7b4458a083e3df721bb94d8b4370e3e0fdb4c`.

## Re-review round 2 checks (B4–B6, post-review head)

| Command (post-review head)                                                                                                          | Result                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node --test research/mmp-108/*.test.mjs` (after `pnpm build`)                                                                      | exit 0 — 16/16 PASS: 9 receipt/mode/ownership controls + 7 new harness wiring and lifecycle controls                                                                                                                                                                                                                                      |
| `docker build -f research/mmp-108/harness/Dockerfile -t metamorph-mmp108-harness:smoke research/mmp-108/harness` (build-only smoke) | exit 0; `docker run --rm --entrypoint sh … -c 'test -x /usr/local/bin/mmp108-run && test -x /usr/local/bin/volume-guard.sh'` printed `ENTRYPOINTS-OK`; smoke image removed. No migration replay                                                                                                                                           |
| harness wiring static assertions                                                                                                    | entrypoint COPY lines, chmod coverage, build-before-provision ordering, primary run uses the built run-scoped tag, Git-Bash conversion preserved on the primary run                                                                                                                                                                       |
| mocked-docker run-host lifecycle scenarios (stateful stub, no real daemon)                                                          | successful run → receipts copied to the unique `local-<sha>-<RUN_ID>` dir, all three owned volumes removed; driver failure → no receipt copy, no evidence dir, volumes still removed; partial create → only the created volume removed; foreign preexisting volume → run refused, nothing removed; build failure → no provisioning at all |
| `pnpm lint` (root `biome check .`)                                                                                                  | exit 0                                                                                                                                                                                                                                                                                                                                    |
| `node research/mmp-069/validate.mjs` / `check-syntax.mjs`                                                                           | VALID / PASS 85 modules                                                                                                                                                                                                                                                                                                                   |
| `sh -n` on all three harness scripts                                                                                                | exit 0                                                                                                                                                                                                                                                                                                                                    |

Two test-side defects were caught locally and fixed before push: the harness
wiring tests initially never invoked their docker stub (the real engine was
contacted for one build attempt — no harness state was created or harmed) and
one receipt-copy assertion used a wrong path pattern. The reworked
`run-host.sh` has NOT been executed end-to-end against a real engine; its
lifecycle evidence comes from the mocked-docker controls above, and the
recorded real-Docker evidence stays pinned to execution head
`f9a7b4458a083e3df721bb94d8b4370e3e0fdb4c`.

## NOT_RUN

Root `pnpm lint/typecheck/test/build` were not executed on the host for this
task (no production paths changed; the harness ran `pnpm install
--frozen-lockfile` and `pnpm build` on the exact reviewed head inside the
container, recorded above). Frozen hosted CI on the PR head covers the frozen
checks; results are linked from the PR. Hosted Docker replay, Meta calls, G4
held-out, benchmark qualification: NOT_RUN (unauthorized / out of scope).
