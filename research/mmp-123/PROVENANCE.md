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
