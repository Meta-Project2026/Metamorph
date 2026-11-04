# MMP-194 validation — 5 November 2026

Branch `Vladimir/mmp-194-offline-mvp-demo`, isolated worktree from freshly fetched
`main@14a54665a94394ca9fdb68a7c27f0c596428cbea`. Main was re-fetched after the
submission addendum and unchanged; open-PR inventory was empty. Original checkout
and `.specify/feature.json` were not modified. No self-merge or issue closure.

`CODE_READY` locally; `DEMO_SCRIPT_READY`; `VIDEO_URL_PENDING_USER_UPLOAD`;
`FORM_FIELDS_PENDING`; `NOT_SUBMITTED`. Independent exact-head ChatGPT review is
pending. Final delivery SHA, PR/merge tree and exact-head CI links are recorded
below after publication; a commit cannot include its own hash.

## Scope and source

Source audit: [provenance.md](provenance.md). Original PUBLIC archive 13338052015
for [run 41856569137](https://github.com/Meta-Project2026/Metamorph/actions/runs/41856569137):
14,807 bytes, SHA-256 `38fd34d24eca33630c79c9f4120194f623d7cfec4be5826355150a31089e4b1e`.
All 13 members independently hashed; run/job/evaluator/source/candidate identities,
explicit G1/G2/G3 PASS and exact ID sets reconciled. Actual workflow Git blob hash
matched its public receipt. Source/candidate/prompt/response bodies were not
downloaded or executed. Original public metadata ZIP retained unserved.

One genuine candidate: G1 6 checks PASS, G2 17 HTTP comparisons PASS, G3 20 state
comparisons PASS. Genuine G0 NOT_RUN / aggregate INCONCLUSIVE, G4 INCONCLUSIVE,
held-out NOT_RUN, PRODUCT NOT_ESTABLISHED. Synthetic G0 11+1 belongs to different
candidates, based only on committed owner-recorded public summary; no independent
raw engine-log attestation. Private custody and settled billing unverified.

New UI uses fixed allowlisted local routes, unchanged CSP, loopback-only binding,
no browser external fetch, no picker/general admission, pin-before-parse and exact
field/value semantics. A–F receipt bytes, pins, adapters and tests are unchanged.
No shared DTO, Oracle, worker, CI, dependency, lockfile or generated skill change.

## Actual local commands and outcomes

Node `v22.23.1`, pnpm `11.25.0`, Python `3.11`, existing local Chrome/Playwright.
The viewer itself needs only Node; Python/Playwright are development checks.
Command outputs were captured locally; counts below are executed results.

| Command | Exit | Observed result / skips |
| --- | --- | --- |
| `git fetch origin main` (initial and after addendum) | 0 | main unchanged at exact base above |
| `git worktree add -b Vladimir/mmp-194-offline-mvp-demo ... origin/main` | 0 | isolated checkout created |
| `git status --short`, `git branch --show-current`, `git worktree list`, policy/spec/source reads | 0 | original checkout clean; no feature pointer write |
| `gh api .../actions/runs/41856569137`, artifacts, jobs, selected public artifact ZIP; issue #194/comment reads; `gh pr list` | 0 | public original metadata available, only public ZIP downloaded |
| workflow Git blob SHA-256 and ZIP/member/API/synthetic hashing scripts | 0 | identities and hashes matched; no candidate execution |
| `node --version`, `pnpm --version`, `gh --version` | 0 | Node 22.23.1 / pnpm 11.25.0 / gh 2.101.0 |
| `pnpm install --frozen-lockfile` | 0 | frozen install; no lockfile changes |
| `pnpm lint` | 0 | root lint passed; 4 existing warnings / 2 infos left unchanged |
| `pnpm typecheck` | 0 | dependency builds + workspace typechecks passed |
| `pnpm test` | 0 | 1,078 tests: **947 pass, 131 skip, 0 fail** |
| `pnpm build` | 0 | workspace builds passed |
| `node --test research/demo-readiness/demo.test.mjs` | 0 | original 50 pass, 0 skip |
| `node --test research/demo-readiness/track-g.test.mjs` first | **1** | 48 pass, 2 fail, 0 skip; failures described below |
| same G test after correction | 0 | 50 pass, 0 skip; includes four Python source-test groups / 12 mutation subcases |
| `node --test research/demo-readiness/*.test.mjs` (initial/final) | 0 / 0 | **333 pass, 0 skip**, A–F plus G |
| `pnpm exec biome check --write` for new/changed .mjs | 0 | formatting/imports only |
| `pnpm exec biome check research/demo-readiness research/mmp-069 research/mmp-054-connected` (initial/final) | 0 / 0 | active research lint passed |
| `node research/mmp-069/validate.mjs` | 0 | VALID; dynamic inventory includes new G tests/modules; privileged runner NOT_RUN |
| `node research/mmp-069/check-syntax.mjs` | 0 | initial 141 / final 142 syntax files PASS |
| actual `node research/demo-readiness/serve.mjs` child + HTTP smoke | 0 | startup message observed; `/`, `/latest.html`, exact G projection HTTP 200; child stopped |
| existing `browser-smoke.mjs` with installed Playwright/Chrome | 0 | 31 groups, A–F picker/atomic/race/negative/recovery controls, no browser errors or external requests |
| new `latest-browser-smoke.mjs` first / second / third / final | **1 / 1 / 0 / 0** | readiness race, then mobile overflow corrected; final 7 groups PASS, 4 screenshots |
| `git diff --check` | 0 | clean; repeated before publication |

Additional publication checks: 47 local Markdown links valid (0 broken),
storyboard narration 317 words with target slots totaling 180 seconds; script
exit 0, human timed rehearsal NOT_RUN. `git add`, commit and push exited 0;
`gh pr create --draft` exited 0, producing [Draft PR #195](https://github.com/Meta-Project2026/Metamorph/pull/195).

## Published implementation / first hosted check

Implementation HEAD `578912190652a3ee23df6271fad4ce05b8ec3e3a`, base
`14a54665a94394ca9fdb68a7c27f0c596428cbea`. First automatic
[Fast CI 41933324309](https://github.com/Meta-Project2026/Metamorph/actions/runs/41933324309),
**attempt 1 SUCCESS**, both
[Node 22](https://github.com/Meta-Project2026/Metamorph/actions/runs/41933324309/job/126935449158)
and [Node 24](https://github.com/Meta-Project2026/Metamorph/actions/runs/41933324309/job/126935449687).
Actual PR merge checkout `02c63064c85ac04eda007a67fed39b74409c4f6e`, tree
`04ed99eec096b727da88acfd176547f511658f2d`, parents base + implementation HEAD.
Checkout logs were checked against the actual merge ref; this is hosted fast CI,
not a differential/model run or product acceptance.

This follow-up adds only publication/validation documentation. Its exact final
HEAD, automatic replacement CI and final merge checkout are recorded in the
PR body and live checks after they complete. That record is authoritative for
independent review; this document does not self-certify its own commit hash or
silently inherit green checks from an earlier head. No manual dispatch/rerun.

Original failures are retained, not rewritten as green: first G suite invoked
Python unittest with a dotted filename incorrectly, and the shared strict parser
rejected two public categorical fact names (`maxOutputTokens`, `privateCustody`).
The invocation now executes the actual unittest script; only those exact public
names are allowlisted, with exact semantic values. No general parser relaxation.
First browser keyboard activation occurred before module readiness; the load
button now stays disabled until its handler exists. Second browser run found
mobile overflow from long public identities; proof-sheet-only wrapping corrected
it. Visual QA then caught a Windows cp1251/UTF-8 round-trip error in HTML and one
CSS arrow; explicit UTF-8 correction and recapture restored the original A–F CSS
arrow. An initial inline browser diagnostic exited 1 for a Windows ESM path before
launching the browser; corrected file URL diagnostic exited 0. Two failed patch
context matches made no file changes and were corrected. None is Oracle failure
or evidence of a second provider invocation.

New negative cases reject wrong run/epoch/source/candidate, incomplete/duplicated
IDs, executed-only G2/G3, pair FAIL beneath aggregate PASS, synthetic/real fusion,
forged G0/G4/product/held-out/custody/usage/repair, sensitive/unreviewed fields,
wrong ZIP and missing local source. Browser failures clear every result field;
A–F remain loadable when G is unavailable. Server denies original ZIP, source API
metadata, preparation scripts, private artifact names, queries and POST.

Captured and visually inspected actual screenshots:
[desktop](../demo-readiness/screenshots/mmp194/latest-1440.png),
[mobile](../demo-readiness/screenshots/mmp194/latest-390.png),
[desktop result](../demo-readiness/screenshots/mmp194/public-result-1440.png),
[mobile result](../demo-readiness/screenshots/mmp194/public-result-390.png).
Capture times/viewports/checks are in
`research/demo-readiness/screenshots/mmp194/results.json`. These are screenshots,
not a video or measured three-minute rehearsal.

## Demo and submission boundaries

One command: `node research/demo-readiness/serve.mjs`; open
`http://127.0.0.1:4171/` and follow the latest-proof link. The browser opens
manually. [Operator runbook](RUNBOOK.md), [3:00 storyboard](../demo-readiness/SUBMISSION.md),
[answer pack](../demo-readiness/submission-answers.md),
[checklist](../demo-readiness/SUBMISSION-CHECKLIST.md).

Unauthenticated web read confirmed the repository is public. Official event
overview was read for the tentative track/theme recommendation; final team
eligibility, form choices, special-track requirements and all subjective feedback
remain OWNER_CONFIRMATION_REQUIRED. No video exists as an outcome of this task.

NOT_RUN: paid/model/provider invocations, manual workflow dispatch/rerun, VM,
Docker/fault injection, private archive/source restoration, hidden G4, independent
custody attestation, human timed rehearsal, physical disconnected-laptop test,
screen-reader audit, video recording/upload/incognito video access, social post,
team approval, consent and form submission. No skip implies a pass. Local fast
checks, hosted CI, owner agreement and product acceptance remain separate facts.
