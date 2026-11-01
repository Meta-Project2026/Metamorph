# MMP-108 — offline real Docker first-step proof on a known-good public candidate

Status: **EXECUTED — known-good full path PASS on one disposable local Linux Docker
environment; historical paid-run root cause remains UNKNOWN.**

Issue: <https://github.com/Meta-Project2026/Metamorph/issues/108>.
Base: fresh `origin/main@9cbe1ef7bbbf59b0756bae937a7519adf3a4d447`.
Branch: `codex/mmp108-offline-docker-firststep`. Run-validated driver head:
`f9a7b4458a083e3df721bb94d8b4370e3e0fdb4c` (evidence receipts carry this SHA;
the PR head adds only this documentation and the receipts).
Receipts: [evidence/local-f9a7b44](evidence/local-f9a7b44/summary.json).
Driver: [first-step-proof.mjs](first-step-proof.mjs). Harness:
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

| Control | G2 | G3 | Shape |
| --- | --- | --- | --- |
| candidate first-request failure | ERROR `VERIFIER_ERROR`, 0 executed | ERROR, 1 (`:initial`) | historical aggregate shape |
| reference first-request failure | ERROR, 0 executed | ERROR, 1 (`:initial`) | same shape |
| malformed observation | ERROR, 0 executed | ERROR, 1 (`:initial`) | same shape |
| comparator status mismatch | FAIL `HTTP_STATUS`, 17 executed | FAIL, 20 executed | scored FAIL, full coverage |
| worker teardown fault | ERROR after 17/20 executed | ERROR after 20/20 | cleanup fault surfaces as ERROR |

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
   initial SQLite observation** by a first-HTTP-request fault from *either*
   side or a malformed observation — the public shape alone cannot attribute
   candidate vs reference vs harness, consistent with MMP-104/PR #106.
3. Diagnostic observation from this task's development (pre-evidence local
   attempt, retained as a finding, not as acceptance evidence): a stale bind
   source in the *research harness* (`inspector.php` path invisible to the
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
# public receipts land in the mmp108-output volume; private volume is disposable
```

Requires a Linux-container Docker engine; the harness image pins
`node:24-bookworm@sha256:e7add2a490bb17d97b485b8641bd88455fff7839ade0f5eba493c3508124d413`
and docker CLI `28.5.2`
(`ea90cfd12e1eeb12aa1c971741adb8bd4ed88e2a574eaac13f5029a1dbc6300d`). See
[validation.md](validation.md) for the actual command log and resource
accounting.

## Changed files

`research/mmp-108/**` only: driver, harness (Dockerfile + two shell scripts),
biome config, receipts, this documentation. No production package, workflow,
recipe, fixture, policy or CI change.
