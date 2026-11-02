# MMP-140 — UI validation, 2 November 2026

Base: fresh `origin/main@d31711f612e14373308fa4f3a220b142567f2004`.
Branch: `codex/mmp140-demo-ui`. Scope: `research/demo-readiness/` only.
Delivery and exact review SHA are recorded in the PR, not predicted here.

## What changed and why

Before: one dense forensic page, with outcomes and source identities at similar
visual weight. After: product/acceptance first, a selectable explanatory pipeline,
six manual story chapters, four outcome cards and focused selected-track details.
The full six-row gate matrix, run/source/candidate identities, usage/nulls and JSON
remain accessible on demand. The 90-second and 3–5-minute narratives are target
pacing; no measured human timing is claimed.

A is admission-only, B scripted Docker replay, C genuine generation with build
FAIL, D genuine generation with first-pair build PASS but aggregate INCONCLUSIVE
and verifier ERROR. A has no candidate/comparisons; B counts 17/17 HTTP + 20/20
SQLite for each attempt, including the failed mutation; C 0/17 + 0/20; D 0/17
completed HTTP + 1/20 SQLite. Product stays NOT_ESTABLISHED. These are historical
receipts through 1 November, not the latest complete project status; newer run
41505679809 is explicitly excluded.

## Executed commands

Environment: Windows, Node 24.21.0, pnpm 11.25.0, Chrome 156.0.8078.74.
Commands ran in the dedicated checkout. Initial formatting failures below were
corrected without changing configuration or tests.

| Command | Actual result |
| --- | --- |
| `git fetch origin main` | Exit 0; main resolved to d31711f… before branch creation |
| `pnpm install --frozen-lockfile` | Exit 0; existing 55 packages reused; no dependency/lockfile changes |
| `node --test research/demo-readiness/demo.test.mjs research/demo-readiness/real-ai.test.mjs research/demo-readiness/incident.test.mjs` | Exit 0; 134 PASS, 0 FAIL, 0 SKIP |
| `pnpm lint` | Final exit 0; 332 files. Earlier exit 1 on new browser-smoke.mjs chain formatting; fixed with existing Biome, then rerun to PASS |
| `pnpm typecheck` | Exit 0 |
| `pnpm test` | Exit 0; 783 total / 673 PASS / 110 environment-dependent SKIP / 0 FAIL on Windows |
| `pnpm build` | Exit 0 |
| `pnpm exec biome check research/demo-readiness research/mmp-069 research/mmp-054-connected` | Exit 0; existing active-research checks |
| `node research/mmp-069/validate.mjs` | Exit 0; VALID, 108 research modules, privilegedRunner NOT_RUN |
| `node research/mmp-069/check-syntax.mjs` | Exit 0; 107 syntax checks, no module execution |
| `node research/demo-readiness/serve.mjs` | Logged loopback listening at 127.0.0.1:4171; manually stopped after startup, not a terminating test command |
| Optional browser smoke command below | Exit 0; 16 check groups PASS, errors [], externalRequests [] |
| `git diff --check` | Exit 0 |

Browser smoke used the already installed local Playwright module and Chrome;
no package/browser download and no new viewer dependency:

```powershell
node research/demo-readiness/browser-smoke.mjs 'C:\Users\skv1d\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright\index.mjs' 'C:\Program Files\Google\Chrome\Application\chrome.exe' 'C:\Metamorph\.oracle-evidence\mmp140-browser\verified'
```

`browser-smoke.mjs` starts the unchanged trusted `makeServer()` on the normal
loopback port, launches headless Chrome, blocks non-loopback page requests, and
closes its server/browser on completion. It is an optional local test tool, not
an auto-run entrypoint or a new CI step. Existing CI checks its lint/syntax only.

Actual browser checks: unloaded state; skip link and keyboard stage activation;
3px visible focus; pinned load/10 JSON options; six gate rows; all four track
buttons and C/D counts; six chapters/Previous/Next limits; JSON inspection;
1440/768/390 widths on each selected track and expanded matrix; picker A/B, C, D;
missing-track chapter clearly labelled narration; synthetic future declaration
stays NOT_VERIFIED and clears trusted overview; incomplete C, forged D PASS,
malformed historical JSON, mixed D/C and unknown filename fail closed; corrupt D
fails the entire bundled load; delayed old success cannot overwrite a newer failed
selection; recovery. Reduced-motion mode was enabled. No JavaScript page exceptions
or external page requests occurred. Browser results are
[recorded here](screenshots/mmp140/browser-results.json).

The synthetic preview control is in-memory test input, never shipped as an
execution receipt. Unsafe paths, invalid UTF-8, duplicate/prototype/secret-like
keys, changed bytes and other hostile inputs also retain the unchanged 134
adapter/server controls. UI controls do not broaden the server allowlist.

## Screenshots and visual inspection

All images are browser captures of public pinned evidence, not generated artwork
or simulated live runs. Before viewport captures use the exact three UI files
from base d31711f… (HTML/CSS/viewer), served by fixed local route overrides; the
same committed adapters and receipts were used. A separate direct baseline run
also loaded A–D and captured full-page screenshots at 1440/768/390. After images
come from the committed optional smoke. Before/after are viewport captures at
1000px height; they illustrate presentation, not acceptance or new execution.

| View | Before | After |
| --- | --- | --- |
| Desktop home, 1440px | [Before](screenshots/mmp140/before-home-1440.png) | [After](screenshots/mmp140/home-1440.png) |
| Desktop evidence, 1440px | [Before](screenshots/mmp140/before-evidence-1440.png) | [After](screenshots/mmp140/evidence-1440.png) |
| Mobile home, 390px | [Before](screenshots/mmp140/before-home-390.png) | [After](screenshots/mmp140/home-390.png) |
| Mobile evidence, 390px | [Before](screenshots/mmp140/before-evidence-390.png) | [After](screenshots/mmp140/evidence-390.png) |
| Tablet, 768px | Direct full-page baseline inspected; not shipped | [Home](screenshots/mmp140/home-768.png), [evidence](screenshots/mmp140/evidence-768.png) |

Visually inspected baseline desktop/mobile, redesigned desktop/mobile full-page,
tablet home and mobile evidence. Typography, spacing, card hierarchy, acceptance
visibility and mobile wrapping were checked. Automated document scrollWidth was
no greater than viewport width at all three widths, across A/B/C/D and the open
gate matrix; wide tables scroll inside their focusable regions.

## Trust boundary and remaining limits

Compared with base: packages/apps/workflows/specs/lockfile, adapters/pins,
`serve.mjs` (including allowlist/CSP), original receipts and
`research/mmp-104/incident.json` are unchanged. Existing negative tests are unchanged.
All newly rendered data uses safe DOM construction/textContent, with no receipt
HTML insertion or data-supplied asset URL. Overview rendering happens only after
the existing full validation barrier. Reset clears new summary/matrix/selection
and old gates/identities/JSON; the generation guard remains intact.

NOT_RUN: human timed 90-second / 3–5-minute rehearsal; a fully disconnected laptop;
screen-reader audit; other browser engines; live model/API, Docker, candidate
execution, private evidence/G4, current new experiments and production acceptance.
Browser keyboard/focus smoke is scoped evidence, not a complete accessibility audit.

The built-in browser tool could not initialize (kernel assets path error); local
headless Chrome provided the actual smoke/screenshots. Early capture setup failed
first on a Windows ESM path, then a proxy connection; using a file URL and direct
loopback Chrome resolved those tooling issues. Port 4171 belonged to our earlier
viewer process; only that session was stopped before the smoke.

Hosted CI is separate from these local results; consult the PR's exact-head run.
Independent ChatGPT exact-SHA review remains pending. No self-approval or merge.
