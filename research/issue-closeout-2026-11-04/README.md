# Issue closeout decision ledger — #115 / #125 / #167 (2026-11-04)

**Status: PROPOSED / PENDING INDEPENDENT REVIEW.** Nothing here closes an issue or
merges itself. The independent reviewer (ChatGPT, NOT the executor) decides the
final GitHub closure actions at the exact reviewed HEAD. Draft PR references
**#115, #125, #167** and preserved open **#55, #57, #134, #160, #161, #176**.

## Provenance of this ledger

- Written on branch `audit/mmp-115-125-167-closeout-20261104` from exact protected
  `origin/main` = `95397bbff94f3e0121ebdc9fa375880762bcbac7` (merge of PR #181).
  Working tree was clean before branching; `git status` re-verified.
- Docs-only change. No source, workflow, custody, Oracle, comparator, normalization,
  pins, sandbox, tariff or G0–G4 file is touched. No new executable entrypoint is
  added, so `research/mmp-069/coverage-matrix.json` is intentionally unchanged.
- No paid Meta call, `workflow_dispatch` (including `validate_only`), run rerun,
  model generation, candidate repair, artifact upload, private/candidate Docker
  execution, daemon start, owner private-key use, ciphertext decryption, G4 hidden
  access or secret retrieval was performed for this ledger.
- Read-only GitHub checks actually executed by the executor: `git fetch origin
  --prune`; `gh issue view`/`--comments` on #115, #125, #167, #134, #176, #154;
  `gh api` for the artifacts of runs 41505679809 and 41856569137; `gh pr list
  --state open` (empty at check time, 2026-11-04). Local source inspection of
  `packages/differential/src/workshop-finalizer.mjs` and the mmp-115/125/167/176
  research directories at the exact main SHA above.

## Evidence categories used in this ledger

- `reviewer-confirmed` — independently re-read by the prior independent reviewer in
  a recorded GitHub review/comment (cited per item).
- `owner-reported` — attested by owner Vladimir on GitHub, not independently rerun
  by any agent or reviewer (private-domain proof).
- `source-inspected` — read by this executor in the exact main SHA above.
- `hosted synthetic` — GitHub-hosted public synthetic fixture runs, not real model
  candidates.
- `actual paid run` — authentic protected-main `workflow_dispatch` runs with real
  provider POSTs.
- `NOT_RUN` — not executed here or anywhere recorded; never inferred.

## Exact facts (all independently re-verified at closeout time)

### First production custody run — #41505679809 (2026-11-02)

`workflow_dispatch`, exact protected `main@a01bb65f8bb58c02c7a59e06ffedc9662576478e`
(recorded in #115). One real Meta HTTP 200 POST; original candidate SHA-256
`6140dbed4afb0d2068db17facb0e14ff9c2ffb61aaaf2b64207b9a8aa2125d38`. Production
custody chain executed: `CAPTURED_UNVERIFIED` → `CHECKPOINT_READY_UNVERIFIED` →
`STORED_UNVERIFIED` with authenticated GitHub artifact upload **and** ID-based
readback before Oracle: artifact `mmp107-candidate-41505679809-1`, ID **13169609004**,
ciphertext SHA-256 `1afcc2a061a72f322f4a888bd03a93686babaf5a3e268a5d45dcc7c17bc997cb`,
31094 bytes, verified locally from independently downloaded ciphertext against the
public receipt (recorded in #115). Pre-Oracle finalizer 0/0/0. Oracle then
`G1=PASS G2=FAIL G3=FAIL` (HTTP_JSON_TYPE); post-Oracle finalizer 0/0/0; separate
MMP089 preservation artifact 13171510338. Artifact metadata re-checked via
authenticated API on 2026-11-04: present, expires 2026-11-09T19:00:39Z.
`OWNER_RESTORE_PASS` was subsequently **owner-reported** (2026-11-02, #115) for this
exact artifact/ciphertext binding using the owner's private age identity offline.

### Latest genuine public success — run #41856569137 (2026-11-04)

`workflow_dispatch` attempt 1, actor `barbalatv`, exact protected
`main@95397bbff94f3e0121ebdc9fa375880762bcbac7`, workflow conclusion `success`
(re-checked via authenticated API). One real Meta Muse Spark 1.3 Standard POST;
candidate SHA-256
`4207053ada23f8e94ecf6301452ee4ea8228a3717c0a478d3e550443cec130e6`;
**G1 PASS 6/6; G2 PASS 17/17 HTTP; G3 PASS 20/20 SQLite** over 3 registered public
scenarios; `COMPLETE_PUBLIC_PASS`; zero repair POSTs (first candidate passed).
Custody artifact `mmp107-candidate-41856569137-1` ID **13338306385** and public ZIP
`meta-paid-public-41856569137` ID **13338052015** both present (API-checked), expire
2026-11-11. This is the first authentic model-generated public Oracle PASS; source:
#154 closure evidence. It does **not** establish G0/G4, repair efficacy (#160,
#161), formal held-out G4 (#55/#56/#57) or product acceptance (#61).

### Preserved historical facts (immutable)

- #125: the GLM repaired candidate `0cf5ba0bb22fd1d335b3d061b0a9b258d7ac660f3038e1e651ddaad1262d03c1`
  and draft `4ff450d2ec5fdcdfd855b7a3ed02b9f369488cf55f354372e4dc11dfb9511e72` remain
  frozen; the historical first-HTTP `0/17, 1/20` VERIFIER_ERROR shape and the
  consumed `ERROR_ENVIRONMENT` diagnostic attempt stand unchanged. **Root cause,
  failed side and error class remain UNKNOWN.** A second diagnostic was never
  performed.
- #167: paid run #41749479450 (exact `main@32d173fc0ddb6cfe8d0addd3061fe5493f6e48f6`)
  reached independent stored custody, then G1 `ENVIRONMENT_ERROR`/`BUILD_FAILED`
  after one executed typecheck id `workshop-business:typecheck`; HTTP 0/17, SQLite
  0/20, zero repair POST. **The actual build-phase subtype remains UNKNOWN.** Later
  synthetic hosted G1 PASS runs (#173: 10/10; #175: 27/27) and the new candidate's
  authentic G1 PASS do **not** prove the original failure's cause.
- #134: `packages/differential/src/workshop-finalizer.mjs` at exact main
  `95397bbff94f3e0121ebdc9fa375880762bcbac7` (source-inspected, lines 9–29) still
  force-removes every container/volume whose name matches the
  `mmp007-|mmp-reference-|mmp-reference-state-|mmp-inspector-|mmp008a-clock-` prefix
  regex, with no per-run owner-label verification; safety rests on the in-file
  "Dedicated disposable Actions daemon only" assumption. The P0 foreign-resource
  deletion hazard is unchanged and remains owned by open #134.

## Aggregate closeout conclusions (proposals)

| Issue | Proposal | One-line basis |
| --- | --- | --- |
| #115 | `completed` (scoped: production candidate-only custody mechanism) | Implementation merged + reviewed (PR #117), operational ledger merged (PR #133), live capture/upload/readback proven in run #41505679809, owner-reported exact restore recorded — each inside its stated evidence boundary. |
| #125 | `not_planned` (superseded) | The present goal (a genuine public HTTP+SQLite PASS) is met by run #41856569137; the frozen GLM second-run diagnostic is no longer needed; historical cause stays UNKNOWN; #134 stays OPEN and visible. |
| #167 | `not_planned` (superseded by #176) | Diagnostics (PR #168) and hosted synthetic G1 qualification (PR #172/#173/#175) plus the owner-only replay helper (PR #177) are merged and accounted; the unresolved owner-private replay is explicitly retained by open #176. |

Per-issue reasoning, matrices and ready-to-post comments:
[115-custody-acceptance.md](115-custody-acceptance.md),
[125-obsolete-diagnostic.md](125-obsolete-diagnostic.md),
[167-incident-handoff.md](167-incident-handoff.md),
[github-closure-proposals.md](github-closure-proposals.md).

## Dated addenda to historical docs

Consistent with the preservation rule (append, never rewrite history): dated
current-status sections were appended to `research/mmp-115/README.md`,
`research/mmp-125/second-run-readiness.md` and `research/mmp-167/README.md`,
each linking back to this ledger. No Nov-02 snapshot sentence was altered.

## Owner-only action (urgent, not executable by agents)

Two artifact sets expire soon; **only Vladimir** can preserve them:

- Run #41749479450: encrypted `candidate.age` artifact **13284218898** and public
  `meta-paid-public/custody-stored.json` artifact **13285336430** — recorded expiry
  **2026-11-11 00:49 UTC**. Required before any owner-local G1 replay under #176.
- Run #41505679809 custody artifacts (13169609004 / 13171510338) expire
  **2026-11-09 ~19:00 UTC**; run #41856569137 artifacts expire 2026-11-11 ~15:20 UTC.

Retention must follow `research/mmp-176/OWNER-RUNBOOK.md` on an owner-controlled
dedicated Linux VM; no agent, CI or reviewer may download/decrypt the private
candidate or use the owner's age identity.
