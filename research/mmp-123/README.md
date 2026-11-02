# MMP-123 — Independent GLM 5.3 first-draft candidate: verification bundle

This directory holds the independent continuation record of MMP-123: the
sealed **GLM 5.3 (ZCode) first-draft** migration candidate, its provenance, a
real-Docker disposable verification of the unchanged verifier against it, and
the single authorized post-freeze repair unit.

## Layout

| path | contents | mutable? |
| --- | --- | --- |
| `candidate/` | The sealed first draft (`candidateSha 4ff450d2ec5fdcdfd855b7a3ed02b9f369488cf55f354372e4dc11dfb9511e72`). Bytes are frozen at commit `c482e19f8242850f1cc04f79a79add79e68658ee`. | **never** |
| `repair-candidate/` | The single authorized post-freeze repair unit ("GLM 5.3 first draft + Sol 6.1 repair"), admission-pinned `0cf5ba0bb22fd1d335b3d061b0a9b258d7ac660f3038e1e651ddaad1262d03c1`. | frozen once committed |
| `harness/` | Disposable Linux Docker verification harness (manual only; never dispatched). | driver edits only |
| `verifier-proof.mjs` | The driver; admits a candidate read-only and records whatever the unchanged verifier produces. Modes: `candidate`, `repair`. | driver edits only |
| `prompt-sha.mjs` | Context-payload reconstruction hash recheck (also the independent first-draft SHA reproduction entry point). | read-only in practice |
| `PROVENANCE.md` | What the first draft was authored from; its sealed bytes; continuation and re-verification record. | append-only conventions |
| `RESULTS.md` | What was actually recorded, with PASS/FAIL/ERROR/INCONCLUSIVE/NOT_RUN distinctions. | appended |
| `INSIGHTS.md` | Bounded research observations. Not gate outputs. | appended |
| `task-card.md` | The original MMP-123 task card, verbatim. | never |
| `evidence/` | Run-scoped receipt directories (`local-<head>-<RUN_ID>/`). One directory per run; never overwritten or mixed. | append-only |

## Status (one paragraph)

The frozen first draft failed G1 build/type checking (`TS2345` at
`src/config.ts:100:41`) inside the real unchanged verifier, so G2/G3 were
never executed (INCONCLUSIVE, MISSING_COVERAGE 0/17, 0/20) and G4 was not run
(INCONCLUSIVE, HELD_OUT_NOT_RUN); product **NOT_ESTABLISHED**. A single
post-freeze repair unit was prepared in a separate location and only becomes
recorded evidence after its own repair-mode Docker run. See `RESULTS.md`.

## Integrity

- **First draft**: preserved byte-for-byte; its `candidateSha` is
  independently reproducible with the unchanged
  `packages/target-worker/src/admission.mjs` `admitDirectory()` (rerun during
  this continuation; reproduction passes against `research/mmp-123/candidate`
  identical to `research/mmp-123/repair-candidate`'s four untouched files).
- **Repair**: separate directory + separate commit; admission-pinned;
  never labeled GLM-only (label: "GLM 5.3 first draft + Sol 6.1 repair").
- **Receipts**: hash-pinned in `RESULTS.md`; byte-identity re-verified against
  the run-source clone at commit `a8cf79dd…`.

## How to re-run (manual, on a host with a linux/amd64 Docker engine)

From a **fresh full clone** of the branch (not a linked worktree):

```sh
AGENT_HEAD_SHA=$(git rev-parse HEAD) sh research/mmp-123/harness/run-host.sh
# driver mode is selected through the environment:
#   MMP123_MODE=candidate  (default) — verifies the frozen first draft
#   MMP123_MODE=repair     (once)    — verifies the single authorized repair unit
```

Every step refuses to overwrite prior receipts, and cleanup receipts must
verify zero remaining containers/volumes.

## Hard restrictions honored here

No Meta GET/POST, no paid workflow or `workflow_dispatch`, no artifact upload,
no owner-key operations, no benchmark registration (`#116` HOLD); no reading
of target-worker fixtures, Oracle reference data, held-out G4 packs or any
existing migration target code; candidate bytes never modified after freeze;
the verifier and CI files never weakened.
