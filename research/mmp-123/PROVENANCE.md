# MMP-123 — Provenance of the independent GLM 5.3 first draft

Executor: **GLM 5.3** (ZCode coding-agent session, `high` reasoning), 2026-11-02.
This file records exactly what the first draft was authored from, its sealed
bytes, and what it does **not** establish. It is a research provenance record,
not a production receipt: no Meta request was sent and no paid authorization
exists for this task.

## Phase 1 protocol observed

- Worktree: fresh clone of canonical `main` at
  `8e857654a3aabbb16a2fec44b4fceab8d4209944` (Fast CI `41365426071` SUCCESS),
  branch `glm/mmp123-independent-candidate`.
- Before the first draft was locked, the author read **only**:
  - this task card (copied verbatim as `task-card.md`);
  - `AGENTS.md` (workspace instructions);
  - `research/mmp-061/public-source.json` and `research/mmp-061/inventory.json`
    (the pinned MIT-licensed upstream `api.php` / `config.php` at
    `d272170d0aecbd28eb5b13e272d9dd11d545b66c`);
  - `packages/agent-real/src/migration-context.mjs` and
    `packages/agent-real/src/meta-migration.mjs` (the model-visible target
    environment: Node 24.11.0, TypeScript 5.9.3 strict ES2022 NodeNext emitting
    CommonJS, `node:sqlite`, entrypoint `src/main.ts`, `127.0.0.1:3000`,
    `/state/target.sqlite`, no configuration environment variables);
  - `packages/target-worker/src/admission.mjs` (the trusted structural
    admission API the card explicitly authorizes for the freeze step).
- `packages/target-worker/fixtures/**`, `packages/oracle/**`, the upstream
  `tests/api_test.php` answers, `research/mmp-108` (its harness pattern or its
  candidate), `research/mmp-107`, and any other generated target code were
  **not read before (or during) first-draft authoring**. G4 was not inspected.
  Declaration: no reference fixtures, expected values, or prior candidate code
  were present in the author's context when the first draft was written.
- The first draft was authored directly as TypeScript by the model from the
  PHP source; no other model or tool generated the implementation. The only
  mechanical step before sealing was a repository `biome` formatting check
  (see `pnpm lint`), which reported **no fixes** for the candidate files —
  bytes below are the authored bytes.

## Prompt / context material actually used

The GLM task is an offline coding-agent session, **not** a native Meta
`ModelProvider` call and **not an A/B comparison of identical provider
prompts**: the Meta wire request would wrap the context payload in a developer
message and a chat-completions body (`prepareMetaMigration`), which this task
never produced. The reconstruction below hashes the closest model-eligible
equivalent of the production context payload:

- `contextPayloadSha256` (20916 bytes payload, reconstructed with the exact
  `instructions`, `target`, `scope` literals verified verbatim against
  `packages/agent-real/src/migration-context.mjs`, the pinned source files,
  the 11 ordered function units, and the 5 routes):
  `21415d8b4ea38ad0bfcab92c3632777e30e36a8e3c74b17d95ec9abef8a5c345`
  Equality with the production `contextSha256` is NOT established because the
  `SOURCE`/`MANIFEST` constants live in `@metamorph/oracle`, which was not
  inspected. Recompute with `node research/mmp-123/prompt-sha.mjs`.
- Material file hashes (path, bytes, SHA-256):

| path | bytes | sha256 |
| --- | --- | --- |
| research/mmp-061/public-source.json | 18323 | `5e47f717e505da575b0515a06a1946a3307e04f9657f599545f4ab990ae166d6` |
| research/mmp-061/inventory.json | 5378 | `3243da24babc68fda1da3e422d350efaeff2f57f4a5e9db07243d06f28213ff4` |
| packages/agent-real/src/migration-context.mjs | 6074 | `f8b0a47ea36ecb3b14df9ac9a3124034f171658002448338b91b6c365ce468f6` |
| packages/agent-real/src/meta-migration.mjs | 16558 | `2f78b6c271694ff7195f86663ddde454c6ae651e0c2d92052a47d05748acdeb2` |
| packages/target-worker/src/admission.mjs | 4143 | `710971b5e5109f4424e5ad7d4ae32d074e280d73de35e0db0e18d27e2d009a5f` |
| AGENTS.md | 4535 | `36f6d50c893f44aad1424e81d4732162995414c33487fcca0ada5fa8c95d21ef` |
| research/mmp-123/task-card.md | 12379 | `9dc7890d6fb6d3ae128aabe32c97064e4293e818b7cbe5b838f17c883558a861` |

## Sealed first draft (immutable)

Structural admission via the unchanged
`packages/target-worker/src/admission.mjs` `admitDirectory()` **PASSED**
(bundle shape, path policy, entrypoint, byte limits). Canonical:

- **candidateSha**: `4ff450d2ec5fdcdfd855b7a3ed02b9f369488cf55f354372e4dc11dfb9511e72`
- Files (path, bytes, SHA-256):
  - `src/api.ts` — 17243 — `938fe78a8d3ccbb31f8a1d4464ddc00b417f6215047b5e1d79163d13bc2282c9`
  - `src/config.ts` — 4946 — `a79b0a63283a1b3e9eb9a45f1580ee09b86210c1ba73892a345bbbabeddf90ec`
  - `src/json.ts` — 3311 — `872682f4b6d9816f1815090f9bb2fe2916e59b00b46f3af88c9b60c0a4d50a5e`
  - `src/main.ts` — 6956 — `afe8cf29bfe313315b2917b61c3fa0fb87a89841297e7c24b25c37af7e4dbd73`
  - `src/phpcompat.ts` — 4480 — `4317bc4cf3fd1140fd12c272c787facf36ae3ca8461f3d22aac939d12a9611c3`

The first draft is sealed by the separate commit that introduced
`candidate/` (recorded by SHA in `RESULTS.md` and the PR body; a commit
cannot contain its own SHA). Any later change would produce a different
`candidateSha` and is reported as a distinct revision, never as the first
draft.

## Scope of the implementation

Covers the five upstream API actions (`get_slots`, `book`,
`get_appointments`, `update_appointment`, `cancel_appointment`) and all 11
named PHP functions (`defineSetting`, `getDBConnection`, `initSQLiteTables`,
`ensureSeeded`, `isValidDate`, `beginBookingLock`, `getSlots`,
`bookAppointment`, `getAppointments`, `updateAppointment`,
`cancelAppointment`) plus supporting PHP-semantics helpers. The upstream MIT
notice (Copyright (c) 2026 Tanjila Afsari Rubina) is retained verbatim at the
top of every generated file. Excluded by the declared scope: UI/HTML/JS,
MySQL, whole-app migration.

## Model identity and honesty notes

- Authoring model: GLM 5.3 (session model of the executing ZCode agent).
  Platform-level inference attestations beyond this are not claimed.
- Not established by this file: compilation success, HTTP/SQLite parity,
  G1/G2/G3 verdicts, Oracle PASS, G4. See `RESULTS.md` for what was actually
  executed, with `PASS` / `FAIL` / `ERROR` / `INCONCLUSIVE` / `NOT_RUN`
  distinctions.

---

# Continuation record — OpenCode session after ZCode context exhaustion

This section was appended (not amended) after the section above: the original
first-draft record is frozen and every fact above is unchanged.

## Identity and who performed what

- First-draft authoring: **GLM 5.3 (ZCode)** per that prior agent's own
  PROVENANCE statement and task-card history. The model-internal logs of that
  session are **NOT_VERIFIED**; the statement that no fixtures, expected
  values or prior candidate code were read while authoring remains
  **self-reported, not independently provable**.
- Continuation, independent re-verification, harness authoring, the single
  repair unit (committed separately, see below) and this record: the OpenCode
  continuation
  session. The MMP-123 task card requested **sol 6.1**, but the actual OpenCode session reported **GLM 5.3 Flash Free** (`glm-5.3-flash-free`, provider `opencode`). No attested Sol 6.1 execution was observed; the task-card assignment must not be treated as actual model identity. Same-family
  continuation is explicitly permitted by the card as long as the
  **first-draft origin GLM 5.3 (ZCode) is preserved** and later work is never
  labeled GLM-only. Platform-level model independence beyond these labels is
  **NOT_VERIFIED**.
- Exactly one post-freeze repair has been committed, in a separate directory
  and separate commit, labeled **"GLM 5.3 (ZCode) first draft + OpenCode-reported glm-5.3-flash-free repair"**
  (see the post-freeze single repair record below); no second or attempted
  repair exists. The first-draft commit, its bytes and its
  `candidateSha 4ff450d2...` are immutable and independently re-verified
  (see below).

## Independent identity re-verification (2026-11-02, OpenCode)

- `git ls-remote origin` confirmed the freeze commit
  `c482e19f8242850f1cc04f79a79add79e68658ee` was already pushed to
  `refs/heads/glm/mmp123-independent-candidate` **before** the continuation
  session started (the prior agent's "about to commit/log" narrative was
  stale; the freeze exists).
- The freeze commit contains exactly the five `research/mmp-123/candidate/src/*.ts`
  files (A entries only), on merge base `8e85765` (PR #121 merge), with no
  hook-modified bytes.
- `node research/mmp-123/prompt-sha.mjs` (unchanged trusted
  `packages/target-worker/src/admission.mjs` `admitDirectory()`) reproduced
  **candidateSha `4ff450d2ec5fdcdfd855b7a3ed02b9f369488cf55f354372e4dc11dfb9511e72`**
  with all five per-file bytes and SHA-256s matching the table above, plus all
  seven prompt-material hashes matching this file's table.
- An independent Node hash pass over the same material files reproduced every
  listed path/bytes/sha256 value.

## First-draft isolated verifier result (real Docker, unchanged verifier)

Executed in one disposable Linux Docker environment (Windows host, Docker
Desktop engine `29.9.2`, linux/amd64; harness image pinned
`node:24-bookworm@sha256:e7add2a490bb17d97b485b8641bd88455fff7839ade0f5eba493c3508124d413`,
docker CLI `28.5.2`) using the MMP-108-approved disposable-harness pattern
copied research-locally to `research/mmp-123/harness/`:

- Run id `mmp123-20261102T013108Z-bc21b08702a2`, driver head
  `a8cf79ddef1329b882c3277ff11c890047c64560` (the push that contains the
  harness, driver and inventory registration), source freshly cloned from
  `origin/glm/mmp123-independent-candidate`, Node `v24.22.2`.
- Driver: `research/mmp-123/verifier-proof.mjs` mode `candidate` — no model
  provider, no repair loop; fetch guard admits only the pinned public source
  archive (`sourceFetches=1`, `blockedRequests=0`); candidate TS and reference
  PHP runnable only inside verifier-provisioned network-off workers; every
  scenario answer compared by the unchanged production `verifyPair`.
- Outcome recorded in `research/mmp-123/evidence/local-a8cf79dd-*/`:
  **G1 FAIL** (`BUILD_FAILED`; executed 1/6 — first pair typecheck only;
  bounded compiler diagnostic: `TS2345` at `src/config.ts:100:41`,
  errorCount 1), **G2 INCONCLUSIVE 0/17** and **G3 INCONCLUSIVE 0/20**
  (`MISSING_COVERAGE`; never executed), **G4 INCONCLUSIVE
  (`HELD_OUT_NOT_RUN`)**; per-pair and whole-run cleanup
  `VERIFIED_ZERO_RESOURCES` with an independent finalizer PASS 0/0/0;
  product **NOT_ESTABLISHED**; `aiGeneration AI_GENERATION_NOT_RUN`.
  Case status `PASS` records that this validation executed cleanly — the
  candidate's own gate verdicts inside the receipt are the reported verdicts;
  this is not an AI-migration PASS.
- Before the recorded run, five pre-evidence harness/driver iterations were
  used to make this Windows-host execution possible and to correct driver
  defects (MSYS2 mount rewriting; linked-worktree `/repo` link-file; CRLF
  shebang inside the image; an over-strict copied known-good assumption moved
  to executor prefix semantics). They are listed with commands and codes in
  `RESULTS.md`; the recorded run's receipts reflect the corrected driver.

## Post-freeze single repair record (OpenCode continuation)

One repair unit is authorized by the task card. It was produced by the
OpenCode continuation session (model `glm-5.3-flash-free`; harness-level
designation **Sol 6.1**), located in `research/mmp-123/repair-candidate/`,
committed separately (`79440b8`), and labeled **"GLM 5.3 first draft +
Sol 6.1 repair"** — never ZCode-first-draft-only:

- **REPAIR_CANDIDATE_SHA**
  `0cf5ba0bb22fd1d335b3d061b0a9b258d7ac660f3038e1e651ddaad1262d03c1`,
  computed and pinned by the unchanged `admitDirectory()` admission module.
  The directory is a byte-copy of the frozen first draft verified to
  reproduce `candidateSha 4ff450d2...` **before** the single widening edit to
  `phpCastInt` (accept `Uint8Array`, cast bytes via UTF-8 decoding through the
  leading-numeric `phpInt` rule). Only `phpcompat.ts` differs
  (4813 bytes, sha256 `b86de870c3bbb52dba0b595a53eba62fde37d8ffc333dbebacb43084ae4d30f3`).
- Recorded isolated verifier result, mode `repair`, real Docker, unchanged
  verifier (same pins and isolation as the first-draft run): run id
  `mmp123-20261102T014652Z-cac1410a17b1`, driver head `79440b8dd85b28936e1818c8ce79b35ddbd38fcf`,
  receipts in `research/mmp-123/evidence/local-79440b8d-mmp123-20261102T014652Z-cac1410a17b1/`
  (byte-identity re-verified against the run-source clone).
- Verdicts: **G1 INCONCLUSIVE (`BUILD_NOT_RUN`)** — typecheck and build both
  executed, compiler diagnostic projection `g1Verdict PASS`, `errorCount
  null` (the first draft's `TS2345` no longer occurs), 2 of 6 G1 gate tests
  executed; **G2 ERROR (`VERIFIER_ERROR`, 0/17)**; **G3 ERROR
  (`VERIFIER_ERROR`, 1/20)**; **G4 INCONCLUSIVE (`HELD_OUT_NOT_RUN`)**;
  cleanup `VERIFIED_ZERO_RESOURCES` with finalizer PASS 0/0/0; product
  **NOT_ESTABLISHED**. Case execution status `PASS` records validation
  integrity only. `VERIFIER_ERROR` is a categorical projection; its cause is
  not interpretable from the published receipts, so no claim about the
  candidate is drawn from it.
- No second repair is authorized or attempted, regardless of these verdicts.

## Boundaries

- Held-out G4 inputs/expectations, target-worker fixtures, answer candidates,
  reference packs and any preexisting migration target code remained unread
  by the continuation executor at every stage (the driver reads only the
  frozen candidate dir, public mmp-061 source/context pins and production
  harness wiring).
- No Meta GET/POST, paid workflow, `workflow_dispatch`, artifact upload,
  owner key operation or benchmark registration. `#116` remains HOLD.
- The GLM contextPayload reconstruction (`21415d8b...`, 20916 bytes) equality
  with the production `contextSha256` remains **NOT_VERIFIED**.

## Independent reviewer attribution correction (2026-11-02)

The original task card **requested** Sol 6.1 for the continuation, but the continuation's reported runtime model was **`glm-5.3-flash-free` via OpenCode**, not an attested Sol 6.1 session. Any prior label `Sol 6.1 repair` must be read as a **historical misattribution**. The defensible label is **GLM 5.3 (ZCode) first draft + OpenCode-reported `glm-5.3-flash-free` repair**. Provider-platform independent model attestation remains NOT_VERIFIED. The recorded case execution discriminator `REAL_DOCKER_UNCHANGED_VERIFIER_GLM_FIRST_DRAFT_WITH_SOL_REPAIR` is preserved verbatim in committed run receipts and driver for historical integrity, **not as evidence Sol executed**. Frozen candidate bytes, repaired candidate bytes, original run-head evidence and gate outcomes are unchanged; no new inference or Docker rerun is implied.
