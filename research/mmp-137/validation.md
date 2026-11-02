# MMP-137 — Validation record (what was actually executed)

Executor environment: Windows host, ZCode (GLM 5.3), Git Bash, `gh` CLI.
All checks offline and read-only except the explicitly listed local build and
test commands. No Docker, no PHP execution, no Meta/provider call, no
workflow dispatch, no candidate decrypt, no age-identity access at any point.

## Executed commands and results (2026-11-02)

| # | Command (abridged) | Result | Exit |
| --- | --- | --- | --- |
| 1 | `git fetch origin --prune` + `git log -1 origin/main` | `origin/main = a01bb65f8bb58c02c7a59e06ffedc9662576478e` — identical to the paid-run head (verified against run metadata) | 0 |
| 2 | `git checkout -b glm/mmp137-offline-postmortem origin/main` | branch created at the paid-run head | 0 |
| 3 | `gh api repos/tanjilaafsarirubina/car-workshop/contents/{api.php,config.php}?ref=d272170d0aecbd28eb5b13e272d9dd11d545b66c` → base64-decode → `sha256sum` | both files exactly match the pinned inventory (`research/mmp-061/inventory.json`): api.php `7d66dc6a…74fd77` (11956 bytes), config.php `11216d30…c21bd` (4331 bytes) | 0 |
| 4 | `gh api …/actions/runs/41505679809` + `/jobs` + `/artifacts` (read-only metadata) | workflow `Meta paid migration`, `workflow_dispatch`, attempt 1, head `a01bb65…`, conclusion `failure`; 4 artifacts listed, none expired; job steps match the #137 receipt (failure at `Independent Docker Oracle…`) | 0 |
| 5 | `gh api …/actions/artifacts/13169804253/zip` (the allowlisted **public** summary artifact) → unzip | ZIP SHA-256 `2aab13dd092d20a864b347fbeb2efea0caae10f22b28a4a24c39e78581862ee8`; contains 8 public receipt JSONs; `trial.json` (`mmp078-public-paid-trial-v1`) read for aggregate **and per-scenario** gate verdicts/finding codes | 0 |
| 6 | `pnpm --filter @metamorph/oracle build` (`tsc`) | build OK (needed only to run the offline test locally) | 0 |
| 7 | `node --test research/mmp-137/comparator-mechanics.test.mjs` | **9/9 pass** (H1/H2/H3 mechanics produce exactly `HTTP_JSON_TYPE` at the predicted paths; invariance, value, missing-key, length, status and non-JSON controls pin every other code as absent) | 0 |
| 8 | `node research/mmp-069/validate.mjs` | `{"status":"VALID",…,"researchModules":107}` — coverage matrix with the new `research/mmp-137` entry validates; CI-steps/gates/skips invariants unchanged | 0 |
| 9 | `node research/mmp-069/check-syntax.mjs` | `{"status":"PASS","checked":106,"failed":0}` — includes `research/mmp-137/comparator-mechanics.test.mjs` (syntax only; never executed by CI) | 0 |

## Deliberately NOT_RUN (and why)

- **Hosted Fast CI on this PR** (frozen install, lint, typecheck, unit/contract
  smoke, build): runs automatically on the opened PR; run ID recorded in the
  PR/issue comment when available. Local reruns of `pnpm lint`/`pnpm typecheck`
  were skipped because this PR changes only files under `research/mmp-137/**`,
  `research/mmp-069/coverage-matrix.json` (validated by check #8) and no
  `packages/**`/`apps/**` source.
- **PHP execution / any Docker run**: not authorized here (shared-host Docker
  blocked by #134) and not needed — PHP 7.4 semantics verified against public
  php-src/php.net sources instead.
- **Meta API**: zero calls, by hard constraint (authorization consumed).
- **Candidate decrypt / sanitized review**: gated
  (`OWNER_LOCAL_RESTORE_AND_SEPARATE_PERMISSION_REQUIRED`); see
  [owner-restore-gate.md](owner-restore-gate.md).
- **Private per-step diff paths** (which would discriminate H1 vs H2 vs H3
  immediately): private Oracle evidence, not accessed, not publishable.
- One attempted convenience read (`gh api …/jobs/<id>/logs`) was refused by the
  `gh` escape-sequence guard; the public artifact's `trial.json` was used
  instead — it is the more precise, allowlisted source.

## Claim discipline

- `CONFIRMED`: everything in [findings.md](findings.md) §1–§3 (published
  receipts, comparator/gate code, pinned source, PHP 7.4 runtime semantics).
- `HYPOTHESIS`: any statement about what the candidate actually emitted
  (H1/H2/H3 ranking); none is claimed confirmed.
- `INCONCLUSIVE` / `NOT_RUN`: G0, held-out G4, owner restore, billing
  settlement, per-step private diff paths.
