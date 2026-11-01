# MMP-108 — offline real Docker first-step proof on a known-good public candidate

Status: **EXECUTED — known-good full path PASS on one disposable local Linux Docker
environment; historical paid-run root cause remains UNKNOWN.**

Issue: <https://github.com/Meta-Project2026/Metamorph/issues/108>.
Base: fresh `origin/main@9cbe1ef7bbbf59b0756bae937a7519adf3a4d447` (rebased
onto `114973cbcde2debc699ff0b578c146c34b6c636e` after review).
Branch: `codex/mmp108-offline-docker-firststep`. **Real-Docker execution
head: `f9a7b4458a083e3df721bb94d8b4370e3e0fdb4c`** — the receipts below were
produced by the driver at that exact source state; the current PR head adds
only review corrections (failure projection, volume ownership, mode
validation), negative tests, documentation and receipts, with driver case
logic unchanged and no Docker rerun (per review). Receipts:
[evidence/local-f9a7b44](evidence/local-f9a7b44/summary.json). Driver:
[first-step-proof.mjs](first-step-proof.mjs). Harness:
[harness/](harness/run-host.sh).

No Meta GET/POST, no model spend, no workflow dispatch or rerun, no age
identity, no held-out data, no production Oracle/agent/worker/policy change.
`#100` stays consumed; `#61` remains NOT_ESTABLISHED; product remains
NOT_ESTABLISHED.

## What executed

One authorized disposable Linux Docker environment on a local Windows host
(Docker Desktop engine `29.9.2`, linux/amd64). The trusted harness (Node
v24.22.2, pnpm frozen install, tsc build) ran inside a throwaway Linux
container with the engine socket; the work/private/output areas are named
Docker volumes mounted at their daemon-visible `_data` paths so verifier bind
mounts and build contexts resolve on one shared filesystem. Hosted-runner
replay was NOT authorized and was not attempted; no workflow was created or
dispatched. Private evidence packs and candidate staging lived only inside the
disposable volumes and were removed after projection (plain `rm`, not a secure
erase). The historical lost candidate was never emulated.

All candidate TypeScript and reference PHP executed exclusively inside the
unchanged verifier-provisioned workers (`--network none`, nonroot, read-only
rootfs, `--cap-drop ALL`, 1 CPU / 256 MiB / 64 pids, tmpfs state, pinned image
and recipe). Driver: `research/mmp-108/first-step-proof.mjs` — unchanged
production code, fresh Linux process, no credentials, fetch guard admitting
only the pinned public source archive (`sourceFetches` receipts below).

### 1. Known-good real Docker replay — PASS

Pinned public known-good fixture
`packages/target-worker/fixtures/workshop` admitted at
`WORKSHOP_CANDIDATE_SHA 34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334`
(MIT notice verified in `src/schema.ts`), driven through the unchanged
`validateGeneratedMigration` path — the same composition the paid verifier
used.

- Aggregate **G1 PASS** — all 6 per-pair `typecheck`/`build` IDs executed
  (the historical run only reached 2 and stayed `INCONCLUSIVE/BUILD_NOT_RUN`).
- Aggregate **G2 PASS 17/17** HTTP, first executed ID `workshop-business:step-0`.
- Aggregate **G3 PASS 20/20** SQLite; stage ordinals prove the core success
  case: `workshop-business:initial` (index 0) → first HTTP
  `workshop-business:step-0` (G2 index 0, G3 index 1) — reference+candidate
  reset, initial SQLite comparison, first HTTP request/response comparison and
  post-request SQLite observation all executed and compared, in order.
- G4 `INCONCLUSIVE / HELD_OUT_NOT_RUN` (27 synthetic control IDs only);
  product NOT_ESTABLISHED.
- Per-case cleanup `VERIFIED_ZERO_RESOURCES` plus an independent finalizer
  run: containers=0, volumes=0, emergencyRemoved=0.

### 2. Real first-step fault detection — PASS

The mmp-097-style synthetic mutation (`res.statusCode = 503` before the first
response; new candidate SHA `43eb3aeb…`) still compiles (**G1 PASS**) and the
unchanged verifier scores the first HTTP response mismatch as **G2 FAIL +
G3 FAIL with `HTTP_STATUS` and no `DB_*` findings at full 17/20 coverage**,
cleanup verified, finalizer 0/0/0. The runtime path does not silently pass a
first-step response mismatch.

### 3. Offline synthetic first-step controls — PASS

Five deterministic controls over the unchanged real `verifyPair` (synthetic
adapters, no Docker, sealed evidence in every case):

| Control                         | G2                                 | G3                    | Shape                           |
| ------------------------------- | ---------------------------------- | --------------------- | ------------------------------- |
| candidate first-request failure | ERROR `VERIFIER_ERROR`, 0 executed | ERROR, 1 (`:initial`) | historical aggregate shape      |
| reference first-request failure | ERROR, 0 executed                  | ERROR, 1 (`:initial`) | same shape                      |
| malformed observation           | ERROR, 0 executed                  | ERROR, 1 (`:initial`) | same shape                      |
| comparator status mismatch      | FAIL `HTTP_STATUS`, 17 executed    | FAIL, 20 executed     | scored FAIL, full coverage      |
| worker teardown fault           | ERROR after 17/20 executed         | ERROR after 20/20     | cleanup fault surfaces as ERROR |

## Findings and their limits

1. The tested fresh disposable Linux Docker environment executes the full
   known-good runtime path — build, reset, initial SQLite, first HTTP,
   post-request SQLite, evidence seal, cleanup — end to end. This **narrows**
   the "environment/infrastructure path is broadly broken" hypothesis for the
   historical failure but does **not** establish it: the historical hosted
   runner environment is unavailable, and a PASS elsewhere cannot prove what
   happened in run #41327197036.
2. The historical public receipt shape (per-pair G1 PASS; G2/G3
   `VERIFIER_ERROR`; 0/17 HTTP; 1/20 SQLite) is reproduced **only after the
   initial SQLite observation** by a first-HTTP-request fault from _either_
   side or a malformed observation — the public shape alone cannot attribute
   candidate vs reference vs harness, consistent with MMP-104/PR #106.
3. Diagnostic observation from this task's development (pre-evidence local
   attempt, retained as a finding, not as acceptance evidence): a stale bind
   source in the _research harness_ (`inspector.php` path invisible to the
   daemon, a pure environment/plumbing defect with the known-good candidate
   untouched) produced per-pair G1 PASS and G2/G3 `VERIFIER_ERROR` with **zero
   executed observations** — the same categorical fail-closed shape, at the
   just-before-initial stage. A pure host/harness defect can therefore produce
   this receipt class without any candidate defect. Production code was never
   modified; the defect was in my disposable harness and fixed before the
   recorded run.
4. The historical root cause remains **UNKNOWN**. The unpreserved candidate
   and private packs are UNAVAILABLE. No candidate is blamed and no
   environment verdict for the historical run is claimed.

## Review corrections (PR #112 independent review, B1–B3)

The independent review requested three research-only corrections and negative
tests; all are implemented in this PR head with no Docker rerun and no
production change:

1. **B1 — public error-content leak removed.** The public `summary.json`
   failure projection is now a fixed allowlisted code (`CASE_FAILED`) via
   exported `projectFailure()`; the thrown error is deliberately unread — no
   `error.message`/`error.code` ever reaches a public receipt. Negative
   controls ([first-step-proof.test.mjs](first-step-proof.test.mjs)) throw
   hostile canary-laden errors (private paths, tokens, daemon text) with
   throwing getters and assert the serialized public run leaks nothing.
2. **B2 — non-destructive volume ownership.** `harness/volume-guard.sh`
   refuses any preexisting volume name (`require-free`), verifies a
   run-scoped `metamorph.mmp108.run` owner label before touching anything
   (`verify-owner`), and removes only owned volumes with the removal result
   re-verified and no error swallowed (`remove-owned`). `run-host.sh` creates
   fresh labelled volumes per run and copies public receipts out before
   cleanup; `run-inner.sh` verifies ownership before clearing contents.
   Negative controls ([volume-guard.test.mjs](volume-guard.test.mjs)) run the
   real guard against a stateful stub `docker` on PATH and assert collision
   refusal, foreign-volume refusal and exactly-one-owned removal — no
   destructive call against real state.
3. **B3 — false zero-case PASS removed.** Unknown CLI modes are rejected with
   exit 2 before any filesystem side effect, environment assertion or receipt
   creation, and `finalizeRun()` only allows `PASS` when the mode's expected
   nonzero number of case results completed and every case PASSed; truncated,
   zero-case, over-full and unknown-mode runs are `ERROR` with fixed codes.
   Negative controls cover the invalid-mode child process (no receipt
   created) and the truncated/no-case finalize flow.

The tests run in Fast CI (`node --test research/mmp-108/*.test.mjs`, one new
CI step registered in `research/mmp-069/coverage-matrix.json` and the pinned
CI step list).

## Review round 2 corrections (B4–B6)

After the first re-review confirmed B1/B3 fixed and B2 improved, three
further research-harness blockers were corrected:

1. **B4 — fresh image build and correct entrypoint restored.** The Dockerfile
   again explicitly names the entrypoint
   (`COPY run-inner.sh /usr/local/bin/mmp108-run` plus the guard), and
   `run-host.sh` builds the exact image first under a run-scoped tag
   (`metamorph-mmp108-harness:<RUN_ID>`) and executes that tag — a stale
   cached image can never run, and fresh hosts always build. A build-only
   local smoke verified the fixed image builds and both entrypoints exist
   (recorded in validation.md; no migration replay). Static wiring tests
   assert the COPY/chmod lines, build-before-provision ordering and that the
   primary run executes the built tag with Git-Bash path conversion intact.
2. **B5 — guaranteed owned-volume cleanup on every exit path.** An EXIT trap
   removes only the volumes this run created (owner label re-verified by
   volume-guard.sh) — including failures before any receipt exists, partial
   volume-create failures and build failures. Removal errors are reported
   (`MMP108_CLEANUP_FAILURE`) and turn a successful run nonzero without
   masking an already-failing status. Receipt copying is conditional on a
   successful harness run and uses `docker create/cp` (no host-path bind
   conversion).
3. **B6 — no overwriting or mixing of runs' evidence.** Receipts land in a
   run-scoped directory `evidence/local-<shorthash>-<RUN_ID>` that is
   refused if it already exists; the historical `local-f9a7b44` receipts are
   untouched. The reworked host script itself has NOT been exercised
   end-to-end against a real engine and no such claim is made — its
   lifecycle is covered by mocked-docker controls (successful run, driver
   failure with no receipt copy, partial create, foreign volume, build
   failure).

The negative-control suite now counts 16 tests (driver receipt-integrity,
CLI-mode integrity, volume ownership, harness wiring and run-host lifecycle
scenarios), all CI-gated via the existing
`node --test research/mmp-108/*.test.mjs` step.

## NOT_RUN

- Hosted-runner (GitHub) real Docker replay and any `workflow_dispatch` —
  not authorized; manual-only local harness used instead.
- Meta generation, paid or validate_only runs, reruns of run #41327197036.
- Held-out G4 isolation, PHP benchmark qualification, G0, product acceptance.
- Host root `pnpm lint/typecheck/test/build` locally — no production paths
  changed; frozen install/build ran inside the harness, and PR CI covers the
  frozen checks (linked in the PR).
- Encrypted candidate retention (MMP-097 scope) — untouched.

## Reproduction

```sh
git checkout <reviewed head>
AGENT_HEAD_SHA=$(git rev-parse HEAD) sh research/mmp-108/harness/run-host.sh
# refuses any preexisting mmp108 volume; copies public receipts into
# research/mmp-108/evidence/local-<shorthash>/ then removes only the
# volumes this run created (owner label verified)
```

Requires a Linux-container Docker engine; the harness image pins
`node:24-bookworm@sha256:e7add2a490bb17d97b485b8641bd88455fff7839ade0f5eba493c3508124d413`
and docker CLI `28.5.2`
(`ea90cfd12e1eeb12aa1c971741adb8bd4ed88e2a574eaac13f5029a1dbc6300d`). See
[validation.md](validation.md) for the actual command log and resource
accounting.

## Changed files

`research/mmp-108/**` (driver, harness incl. `volume-guard.sh`, negative
tests, biome config, receipts, documentation), `research/mmp-069/**`
(coverage matrix + pinned CI step list) and one new step in
`.github/workflows/ci.yml` running the new negative controls. No production
package, recipe, fixture, policy or paid-workflow change.
