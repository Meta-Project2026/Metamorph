# MMP-055 real-readiness validation

Docs-only package prepared 2026-11-04 from fresh `origin/main` at
`e0e971bd8d8c3d1a28c8332d42748e78e59a970a` (the task-card handoff SHA
`3cf75ae` was already superseded by PR #185 earlier the same day). Branch:
`Vladimir/mmp-055-real-custody-readiness`. Nine new files under
`research/mmp-055/real-readiness/`; no other path touched.

## Remediation round — review #5774882140 (same day)

The independent audit of this PR returned **HOLD with two P1 findings**;
both are remediated here, docs-only:

- **P1 cross-domain I/O**: verified directly in source that `publish()` and
  `witnessStorage()` operate on **both** `LocalStore` copies in one Node
  process ([engine.mjs:54–123,146–183](../../../packages/evidence-retention/src/engine.mjs)),
  that every root must satisfy `uid === process.getuid()` with exact `0700`/`0600`
  ([secure-fs.mjs:37–44](../../../packages/evidence-retention/src/secure-fs.mjs)),
  and that `LocalStore`/reader refuse `deployment !== "SYNTHETIC_ONLY"`
  ([store.mjs:27](../../../packages/evidence-retention/src/store.mjs),
  [reader.mjs:31](../../../packages/evidence-retention/src/reader.mjs)).
  Documented as the standing gate `BLOCKED_CROSS_DOMAIN_IO_DESIGN` /
  `NOT_EXECUTABLE_FOR_REAL_MEDIA` in [two-domain-deployment.md §1a](two-domain-deployment.md),
  [qualification-plan.md](qualification-plan.md) Phase 0,
  [operator-runbook.md](operator-runbook.md) §0/§1/§2,
  [readiness-worksheet.md](readiness-worksheet.md) §2/§3/§5,
  [risk-matrix.md](risk-matrix.md) §2/§5, [README.md](README.md) and
  [result.json](result.json). The prior text implying a real two-domain
  `publish()` rehearsal was corrected; variants + mandatory acceptance
  controls are described without fixing a new shared API; `0700`/owner-UID
  rules unchanged and no shared-root workaround proposed.
- **P1 candidate-author administration**: the suggestion that two owners (one
  possibly C) could administer the two domains with disclosed overlap is
  removed; C and C-controlled accounts are excluded from administering either
  copy, witness/authority anchors or escrow under every profile
  ([risk-matrix.md §1–2](risk-matrix.md), [roles-and-key-flow.md §1](roles-and-key-flow.md),
  [readiness-worksheet.md D2](readiness-worksheet.md),
  [operator-runbook.md §0](operator-runbook.md),
  [two-domain-deployment.md §7](two-domain-deployment.md)). Disclosure is
  stated as never a waiver; missing non-C administrators ⇒ BLOCKED or added
  participants; no people appointed.

Branch reconciled with `origin/main` at
`3814af2fb8f658d9b50d38789e9daf299b37926e` (PR #184) by ordinary merge commit
(no force-push, no history rewrite); PR #184's `validate.mjs`/`coverage-matrix.json`
changes preserved untouched.

## Sources actually read

Issues #55/#56/#57 (GitHub), PR #64 (body, review thread, review list —
automated Codex review at pre-fix `e538603`, B1/B2 findings by owner review,
remediation at `af7a36d`, no recorded independent approval at final head),
PR #185 metadata + merged content, `AGENTS.md`, `specs/017-formal-g4/*` (all
nine files), `packages/evidence-retention/README.md` + all 13 `src/` modules
(export anchors) + `src/boundary.ts` + `test/fixture.mjs` (existence/API),
`packages/g4-registry/src/{core,state}.mjs` anchors + `research/mmp-056/*`,
`research/mmp-055/v1/*` (spec, format, deployment, security-remediation,
result.json) and `research/mmp-069/{check-syntax,validate}.mjs` enforcement
logic. Only public code/reports; no hidden pack, sampled input, expectation,
seed or diagnostic retrieved.

| Check | Command | Result |
| --- | --- | --- |
| Base fetch + HEAD verification | `git fetch origin --prune`; `git log -1 origin/main` | Exit 0; `e0e971b` confirmed |
| Protected scope | `git status --porcelain` | Only new `research/mmp-055/real-readiness/` (9 files); no tracked path modified; no `.specify/feature.json` change |
| Research syntax (unchanged inventory, no `.mjs` added) | `node research/mmp-069/check-syntax.mjs` | Exit 0 — `PASS, checked:137, failed:0` (count unchanged) |
| Coverage-matrix inventory | `node research/mmp-069/validate.mjs` | Exit 0 — `VALID`, 12 workspace packages, no `RESEARCH_INVENTORY_DRIFT` (Markdown-only addition needs no matrix entry; validator keys on `research/**/*.mjs`) |
| Relative Markdown link check (all new files, anchors stripped) | bash loop, all `*.md` in the new dir | Exit 0 after writing `validation.md` (its README link was the only initially missing target) |
| Trailing whitespace | `grep -rn " $" research/mmp-055/real-readiness/` | Exit 1 (no matches) |
| `git diff --check` | working tree, then staged | Exit 0 both (initial round; re-run after remediation) |
| Remediation-round re-checks: validators, link check, `git diff --check` on merged tree | same commands after merge + edits | Exit 0 all — recorded again in the table below |
| Hosted Fast CI at original HEAD `9066209` (historical, pre-remediation base) | [run 41900139605](https://github.com/Meta-Project2026/Metamorph/actions/runs/41900139605) | SUCCESS Node 22 + 24 — **fact of the old base only** |
| Hosted Fast CI on remediated exact head / merged tree | new run, observed after push | recorded in the PR report; not claimed here before execution |
| lint / typecheck / unit tests / build | — | **NOT_RUN**: Markdown+JSON-only change; no executable source, config, lockfile or dependency touched; hosted Fast CI runs these independently |
| Biome research lint | — | **NOT_RUN** for this dir: the gated lint step covers the three `.mjs` harness dirs only; adding it would be a CI change outside docs scope |
| Docker / formal G4 / private sampling / paid model / workflow dispatch | — | **NOT_RUN**; outside this task and not authorized |
| Independent ChatGPT review; both-owner decisions; merge | — | **PENDING / NOT_RUN**; no self-merge, no #55 closure |

## Honesty notes

- Every claim in this package cites committed code or recorded GitHub state;
  statements about PR #64's review status distinguish the automated pre-fix
  Codex review from the unrecorded post-fix confirmation.
- The owner-reported 180-day/day-90 policy is cited as **reported**, with the
  authenticated second-owner receipt explicitly pending; nothing here signs
  for Vladimir or Ilia.
- Real media, custodians, keys, restore, day-90, deletion: NOT_SELECTED /
  NOT_DEPLOYED / NOT_RUN as itemized in [result.json](result.json).
- Canonical verdicts unchanged: G4 INCONCLUSIVE; product NOT_ESTABLISHED;
  EXTERNAL_RETENTION NOT_RUN; historical PR #31 AUDIT_FAIL unchanged.
