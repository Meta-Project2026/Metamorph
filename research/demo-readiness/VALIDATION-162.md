# MMP-162 validation — real two-attempt Track F

4 November 2026 (Europe/Bucharest). Fresh base main
`f034d4dfcc30dcc82300e93002b5a55206c7dc04`; isolated branch
`codex/mmp162-demo-track-f`. Scope: `research/demo-readiness/**` only.
This validates the offline presentation and snapshot trust boundary, **not** a
new Oracle execution or successful migration. Constitution remains a pending
working draft. Independent exact-SHA review/owner acceptance remain separate.

## Source decision: GO

Only PUBLIC artifact 13274647279 of run 41726833705 was downloaded. Original
ZIP: 28147 bytes, SHA-256
`c860c609444d1d591d68dde6531e85b5c95e9f4cc33af1956500315d5f0b4e5d`.
All 24 members were rehashed, formats/public field sets audited, identities
reconciled across generation/trial, request/send journals, ledgers, preflights,
compiler/telemetry/custody bindings and finalizers. Public-safe original retained
unserved; [complete inventory/reproduction](PROVENANCE.md#f--first-real-repair-historical-public-fail).
No private artifact or candidate code was fetched, decrypted or executed.

Projection: `mmp162-public-repair-v1`, 27687 bytes, SHA-256
`d2bf5aaafea0d7431fee00463ec6cf4c926e24004efb3d97133eee4175ee78d3`.
Two stdlib preparations and the committed bytes compare exactly. Every source
member hash is checked by preparation; negative controls alter each of 24 pins.

Attempt 1 candidate 329cdcca…; attempt 2 candidate 572c6db9…. Both genuine
responses, both G1 PASS6, G2 FAIL17/17, G3 FAIL20/20. Per scenario business/rejected
FAIL/FAIL and capacity PASS/PASS in both. Aggregate pattern unchanged;
per-step improvements UNKNOWN. Both charged costs null, total estimate
USD0.10929375. G0/G4 INCONCLUSIVE, held-out NOT_RUN, product NOT_ESTABLISHED.
Intermediate scorecard values are explicitly nonfinal/excluded; original ZIP
is unchanged. #161 is a separate production lane.

## Actual local commands

Windows PowerShell, Node v24.21.0, pnpm11.25.0, Python3.14 (stdlib). Final results:

| Command | Exit | Actual result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | Frozen existing dependency graph; no dependency/lockfile change |
| `pnpm lint` | 0 | 359 files, no findings |
| `pnpm typecheck` | 0 | Workspace package typechecks |
| `pnpm test` | 0 | 850 tests: 737 PASS, 113 Windows/environment SKIP, 0 FAIL |
| `pnpm build` | 0 | Workspace build |
| `node --test research/demo-readiness/demo.test.mjs research/demo-readiness/real-ai.test.mjs research/demo-readiness/incident.test.mjs research/demo-readiness/track-e.test.mjs research/demo-readiness/track-f.test.mjs` | 0 | 283 PASS, 0 FAIL/SKIP; legacy187 + new F96 |
| `python research/demo-readiness/prepare-track-f.test.py` | 0 | 7 groups including all24 member-pin mutations, deterministic bytes, ZIP substitution, field privacy, duplicates/prototype, broken links |
| `python research/demo-readiness/prepare-track-f.py research/demo-readiness/provenance/track-f/public-receipts.zip <scratch output JSON>` | 0 | 27687 bytes, expected SHA; Node Buffer.equals against committed file true |
| `node research/demo-readiness/browser-smoke.mjs <existing Playwright module> <existing Chrome exe> research/demo-readiness/screenshots/mmp162` | 0 | 31 groups PASS; no downloads |
| `git diff --check` | 0 | No whitespace errors |

F semantic/byte negative controls cover false repair PASS, wrong run/head/source,
request/response/candidate/Oracle identity/order, a third/missing attempt,
invented feedback, erased/duplicated IDs, incorrect coverage, scenario verdicts,
scripted response, usage/count/cost/null tampering, private fields, malformed or
duplicate/unsafe JSON, wrong basename, oversized/invalid UTF8 bytes, async caller
memory mutation, cleanup/finalizer failures and invented exact root/deltas/G4.
Fixed HTTP routes enforce CSP/no CORS and deny ZIP/tools/tests/query/traversal.
No legacy A–E receipt, pin, adapter or test file changed (git diff against base).

## Actual browser and screenshots

Existing local Chrome, headless Playwright module already on disk; no browser
installation. All page traffic restricted to 127.0.0.1:4171. Reduced-motion mode,
scale1, viewport heights1000. Browser version **157.0.8103.38**.
Final smoke completed **2026-11-03T22:50:00.793Z** (4 November local).

Checks: six cards, nine matrix rows, eight chapters, initial product status,
keyboard skip link/Enter/Space/focus, JSON drill-down, 1440/768/390 across all
tracks and expanded matrix, complete A/B/C/D/E/F picker sets, E/F_NOT_LOADED,
future NOT_VERIFIED, malformed/forged/mixed/duplicate inputs, corrupt D/E/F,
missing E/F fail the complete atomic load, reset clears previous details/JSON,
D and F stale successful fetches plus E and F stale successful file reads cannot
overwrite a newer failed selection, recovery, exact F scenario verdicts/costs.
No page overflow, JS exception or external page request observed.

[Machine result/viewport/scroll/UTC record](screenshots/mmp162/results.json).
Every image below is a real local browser screenshot, unedited. Actual capture
UTC is in the linked machine record; requested region and actual scroll differ
where viewport geometry requires it. Screenshots illustrate UI, not execution.

| Capture | Viewport | Actual scroll x/y | UTC | PNG SHA-256 |
| --- | --- | --- | --- | --- |
| [track-e-1440.png](screenshots/mmp162/track-e-1440.png) | 1440×1000 | 0/2148 | 2026-11-03T22:49:55.912Z | 67f29587a735de88ab94bd9f3bdd68329db516a58a645b7860e15350f41fb838 |
| [track-f-1440.png](screenshots/mmp162/track-f-1440.png) | 1440×1000 | 0/2324 | 2026-11-03T22:49:56.031Z | 5a7dd61af5857306132fb075309980ea3ad477dcacbc5bdd2c634ae0a7862fc6 |
| [track-f-attempts-1440.png](screenshots/mmp162/track-f-attempts-1440.png) | 1440×1000 | 0/2796 | 2026-11-03T22:49:56.095Z | c4ae658f98c0ed66bf9f452ec6f98f7582148a33dbdf842ecb74970a562e8ce1 |
| [evidence-1440.png](screenshots/mmp162/evidence-1440.png) | 1440×1000 | 0/1357 | 2026-11-03T22:49:56.178Z | c0133bdc178982ff213894cdf761446093740b91d22228dff75435b793d4892c |
| [home-1440.png](screenshots/mmp162/home-1440.png) | 1440×1000 | 0/0 | 2026-11-03T22:49:56.247Z | 3a3c236c0f2fcfb4f56db2152a05f2c0a8585dba8e2d8810ad7d95c24fcca1ca |
| [track-f-768.png](screenshots/mmp162/track-f-768.png) | 768×1000 | 0/3211 | 2026-11-03T22:49:56.664Z | 2e3316bd9be6e67a4bda614b7ca5dd63ccf87859ebadfdda6b39f45be0c4f47b |
| [track-f-attempts-768.png](screenshots/mmp162/track-f-attempts-768.png) | 768×1000 | 0/3892 | 2026-11-03T22:49:56.717Z | 788902ce0d582d876553a53c5a1a9c0d05b00649a676c55282caa4f77e0c94be |
| [evidence-768.png](screenshots/mmp162/evidence-768.png) | 768×1000 | 0/2081 | 2026-11-03T22:49:56.796Z | 5b89b91525f5c1d675ad3e1bd684301ef6f527dfb40e6d168d4cca69dfa0813c |
| [home-768.png](screenshots/mmp162/home-768.png) | 768×1000 | 0/0 | 2026-11-03T22:49:56.846Z | d96c1cb2195c74bf88d3cacc0f99e62b48106159278e6e27747310e149cc3bac |
| [track-e-390.png](screenshots/mmp162/track-e-390.png) | 390×1000 | 0/3935 | 2026-11-03T22:49:57.244Z | bdcaa95e031529e7d34f51b1a9bf6bd12f17733c24e92184b226487cb0653664 |
| [track-f-390.png](screenshots/mmp162/track-f-390.png) | 390×1000 | 0/3949 | 2026-11-03T22:49:57.346Z | bb47a2feae81c1f9b162e8165ed81209d78e1b19ce25a069b0e575deab5e76d3 |
| [track-f-attempts-390.png](screenshots/mmp162/track-f-attempts-390.png) | 390×1000 | 0/5133 | 2026-11-03T22:49:57.385Z | 7e6fd30115e76956722493d4460edefb3c1b4a64a610fcf5b432f5fa434291c3 |
| [track-f-second-390.png](screenshots/mmp162/track-f-second-390.png) | 390×1000 | 0/6162 | 2026-11-03T22:49:57.418Z | 3f5930cf38cb971ca4d5692f166b45b405bd97ccf70d44daf87906c7c1cd438e |
| [evidence-390.png](screenshots/mmp162/evidence-390.png) | 390×1000 | 0/2537 | 2026-11-03T22:49:57.493Z | e472b6285ec322d4754de987b05f7e6cc510711f1f07066f1f951f1399d73013 |
| [home-390.png](screenshots/mmp162/home-390.png) | 390×1000 | 0/0 | 2026-11-03T22:49:57.539Z | 0598a8fc01cb193937af068e370ca232fbc5b45d61a6076528aeeb26ad697cf4 |

Visually inspected desktop side-by-side attempts and mobile second-attempt
wrapping; all five gate badges remain explicit alongside per-scenario capacity
PASS and business/rejected FAIL. Desktop cards show both candidates and scenario
rows together. Prior A–E screenshots and #145 correction remain historical.

## NOT_RUN / acceptance boundaries

Human timed90s and3–5min rehearsal, physically disconnected laptop, screen-reader
/full assistive-technology audit and other browser engines: NOT_RUN. Meta/model
API requests, workflow_dispatch/rerun, Docker, candidate execution/decryption,
private artifacts, owner keys/restore and hidden G4: NOT_RUN in this task.
Production, shared APIs, workflows, packages/apps and #161 were unchanged.

Hosted exact-SHA Fast CI and independent ChatGPT review are recorded in the PR;
local tests, hosted CI, owner agreement and product acceptance are distinct.
Do not merge or self-approve. **PRODUCT NOT_ESTABLISHED**.
