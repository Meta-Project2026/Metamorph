# MMP-123 — Recorded results

Every claim below distinguishes `PASS` / `FAIL` / `ERROR` / `INCONCLUSIVE` /
`NOT_RUN` exactly as the unchanged production verifier uses those words.
"Recorded" means a disposable-harness run with published receipts under
`research/mmp-123/evidence/`. Nothing in this file establishes a Meta-migration
product PASS, formal G4, or any benchmark registration.

## Recorded evidence run — GLM 5.3 first draft (driver mode `candidate`)

- Run id: `mmp123-20261102T013108Z-bc21b08702a2`
- Driver head: `a8cf79ddef1329b882c3277ff11c890047c64560`
  (fresh clone of `origin/glm/mmp123-independent-candidate`; the driver
  asserts `AGENT_HEAD_SHA` equality with `git rev-parse HEAD` before any
  effect).
- Engine: Docker `29.9.2`, linux/amd64 (Windows host, Docker Desktop).
  Harness image `node:24-bookworm@sha256:e7add2a490bb17d97b485b8641bd88455fff7839ade0f5eba493c3508124d413`
  built per run under a run-scoped tag; docker CLI `28.5.2` (sha256-verified
  download inside the image); harness Node `v24.22.2`.
- Pins recorded in the receipts: MANIFEST
  `d800a9a5e874545040438d4dce822da6e0d6b71fb094bcac7f06a6ad05610fd4`, RECIPE
  `f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3`, source
  `tanjilaafsarirubina/car-workshop@d272170d0aecbd28eb5b13e272d9dd11d545b66c`
  (archive sha256
  `32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4`),
  candidate `4ff450d2ec5fdcdfd855b7a3ed02b9f369488cf55f354372e4dc11dfb9511e72`.
- Network: `sourceFetches=1`, `blockedRequests=0`; the only admitted host
  fetch is the pinned public source archive. `modelRequests=0`,
  `aiGeneration AI_GENERATION_NOT_RUN`.

### Case execution status: `PASS` — execution integrity only

`summary.json` records `status: PASS` with `cases=1/1`. That records that the
unchanged verifier executed this boundary validation cleanly end-to-end. The
candidate's real gate verdicts inside the receipts are the reported verdicts;
**this is not an AI-migration PASS.**

### Candidate gate verdicts (unchanged verifier output, via receipts)

| Gate | Verdict | Executed | Finding codes |
| --- | --- | --- | --- |
| G1 | `FAIL` | 1 of 6 (`workshop-business:typecheck` only; executor stops at first G1 FAIL) | `BUILD_FAILED` |
| G2 | `INCONCLUSIVE` (`MISSING_COVERAGE`) | 0 of 17 | — |
| G3 | `INCONCLUSIVE` (`MISSING_COVERAGE`) | 0 of 20 | — |
| G4 | `INCONCLUSIVE` (`HELD_OUT_NOT_RUN`) | 0 | — |

- Bounded public compiler diagnostic (`mmp082-g1-diagnostics-v1`): code
  `TS2345` at `src/config.ts:100:41`, `errorCount=1`, `truncated=false`
  (attempt `3d144f5e-c9d2-42a8-8b3b-52fde004757f`, pair
  `198559c4-e50a-4d02-b0c2-4268c142747d`).
- Blockers: `BUILD_FAILED`, `MISSING_COVERAGE`.
- Per-pair and whole-run cleanup `VERIFIED_ZERO_RESOURCES` (containers 0,
  volumes 0, emergencyRemoved 0); independent finalizer `PASS` 0/0/0.
- Product: `NOT_ESTABLISHED`.

### Run recipe (as executed)

1. Fresh disposable source: `git clone --branch glm/mmp123-independent-candidate
   --no-hardlinks https://github.com/Meta-Project2026/Metamorph.git <temp dir>`
   on the Windows host — **outside** the repository checkout (a linked
   worktree cannot be used: its `/repo/.git` is a link-file holding a
   Windows-absolute gitdir that Linux git cannot resolve inside the image).
2. From that clone, via Git Bash:
   `AGENT_HEAD_SHA=$(git rev-parse HEAD) sh research/mmp-123/harness/run-host.sh`
   (the script builds the run-scoped image, creates run-owned labeled volumes,
   runs the inner harness, refuses fail-closed on any mismatch, and copies
   receipts only after a fully successful run).
3. Receipts were copied into the real worktree and re-verified byte-identical
   against the run clone on 2026-11-02 (`equal=True` for both files, listed
   below).

### Receipt integrity

- `research/mmp-123/evidence/local-a8cf79dd-mmp123-20261102T013108Z-bc21b08702a2/summary.json`
  — sha256 `2f428dad528c610f06948e24dd05bb702d11c3cbbcc1fb53f49b397d8d7a914d`
- `research/mmp-123/evidence/local-a8cf79dd-mmp123-20261102T013108Z-bc21b08702a2/glm-first-draft-real-docker-validation.json`
  — sha256 `e20407d87e3d9ce2fb9b4491209721c0e204c7f83102881bee739f93f0fed4ae`

## Pre-evidence harness correction cycles (NOT recorded evidence)

Five harness iterations with RUN_ID timestamp prefixes
`20261102T011934Z`, `20261102T012251Z`, `20261102T012319Z`, `20261102T012641Z`,
`20261102T012909Z` failed closed during host-side harness correction (MSYS
mount-argument rewriting; linked-worktree `/repo` link-file; CRLF shebang
inside the image; an over-strict copied known-good assumption moved to
executor-prefix semantics with independent record). They published no receipts
and are not evidence; no run inside these cycles evaluated the candidate. Only
`mmp123-20261102T013108Z-bc21b08702a2` counts as recorded evidence. Harness
correction commits, in order: `a00b185`, `7d9b8ef`, `0fe37ae`, `a381bf2`,
`a8cf79d` (after `47849b9` introduced the harness and `3e156ee` the provenance
record; `c482e19` is the sealed first-draft freeze).

## Repair unit (single authorized post-freeze candidate)

- Prepared at `research/mmp-123/repair-candidate/` (copy of the frozen
  first-draft directory; admission re-verified the copy byte-identical,
  reproducing `candidateSha 4ff450d2...`, before any edit).
- Single edit: `phpCastInt` widened to accept `Uint8Array` and cast those
  bytes through their UTF-8 decoding into the leading-numeric `phpInt` rule.
- Repair admission pin
  (**REPAIR_CANDIDATE_SHA**):
  `0cf5ba0bb22fd1d335b3d061b0a9b258d7ac660f3038e1e651ddaad1262d03c1`
  (`phpcompat.ts`: 4813 bytes, sha256
  `b86de870c3bbb52dba0b595a53eba62fde37d8ffc333dbebacb43084ae4d30f3`; the
  other four files reproduce the first-draft hashes exactly).
- Provenance label: **"GLM 5.3 first draft + Sol 6.1 repair"** (the repair is
  committed separately from the first draft and is never labeled GLM-only;
  continuation session model `glm-5.3-flash-free`).
- Docker repair-mode verifier run: **NOT_RUN** as of this writing — if
  executed it will be recorded as its own run with its own RUN_ID and receipts
  under `research/mmp-123/evidence/`, and no second repair is authorized.

## Local pre-flight checks (NOT gates; not recorded evidence)

- `node --check research/mmp-123/verifier-proof.mjs` → exit 0.
- Driver exports after the repair-mode extension: `MODES=candidate,repair`,
  `expectedCaseCount` candidate=1, repair=1, unknown=0.
- `pnpm build` → exit 0.
- `pnpm lint` (`biome check .`) → exit 0, 293 files, no fixes.
- `node research/mmp-069/check-syntax.mjs` → `PASS`, checked 94, failed 0.
- `node research/mmp-069/validate.mjs` → `VALID`.
- Admission reruns (unchanged `packages/target-worker/src/admission.mjs`,
  executed locally outside the repo): first-draft copy →
  `candidateSha 4ff450d2...` reproduced with all five per-file hashes; repair
  copy → `candidateSha 0cf5ba0b...` as pinned above.
- Local strict/NodeNext TypeScript 5.9.3 probe of the repair candidate in a
  temp directory (`strict`, ES2022, NodeNext, types node) → exit 0, zero
  diagnostics. This approximates the verifier's pinned compile; the
  **authoritative G1 verdict comes only from the unchanged verifier inside the
  repair-mode Docker run**.

## What is NOT established

- First-draft compilation: **proven FAIL** (G1 above). Parity verdicts:
  never executed (0/17, 0/20) → INCONCLUSIVE, not FAIL.
- Oracle PASS, formal G4, product acceptance, repairs beyond the one unit.
- The reconstruction's equality with the production `contextSha256`
  (**NOT_VERIFIED**; see `PROVENANCE.md`).
- Any benchmark registration (none; definition proposed elsewhere).
