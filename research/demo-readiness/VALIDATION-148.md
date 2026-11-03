# MMP-148 — verified public Track E, 3 November 2026

Scope: `research/demo-readiness/` only. Fresh base
`f68b75ec0005cb76059f41218452ff57f47d50d6`, branch `demo/mmp148-track-e`.
Separate screenshot fix #145 is PR #149; its unmerged commit is **not** this base.
Final exact publication SHA and hosted CI are recorded in the PR, not predicted.

## Source decision: GO_PUBLIC_SNAPSHOT

Run 41505679809 / attempt 1 / head a01bb65f8bb58c02c7a59e06ffedc9662576478e
was independently checked through read-only GitHub metadata. Only explicitly
allowlisted PUBLIC artifact **13169804253** was retrieved. ZIP length **8733**,
SHA-256 **2aab13dd092d20a864b347fbeb2efea0caae10f22b28a4a24c39e78581862ee8**
matches GitHub digest and the historical #137 cross-check. All nine original
members were independently sized/hashed, inspected for public-safe fields and
reconciled. The first inventory count assertion exposed the top-level attempt
receipt: eight JSON under meta-paid-public plus that receipt make nine total.
The corrected complete inventory preceded UI implementation.

[PROVENANCE.md](PROVENANCE.md#e--2-november-2026-real-build-pass-http-json-type-fail)
contains every original member identity, format, scope and safe projection map.
The retained [original PUBLIC metadata ZIP](provenance/track-e/public-receipts.zip)
is unserved and contains no candidate/ciphertext/private observations/keys. The
E browser input is a narrow, separately versioned projection, not a claimed
original producer receipt. Adjacent derived research evidence.json was not its
input. Historical custody and owner-restore fields are not surfaced as current.

Offline reproduction with `prepare-track-e.py` exited 0 and matched **all 11960
output bytes**, SHA-256 **6442e5e8893cf44ae926d66a92d2fc38cd1ae07230b250b48d8ba2e0db1f237b**.
SHA proves identity of reviewed public bytes, not a new Oracle run or independent
cryptographic executor attestation. Public-source provenance is separate from
the pending independent exact-SHA code review.

## Natural outcome and presentation

E: genuine Muse Spark 1.3 generation PASS, one request/response, HTTP 200; aggregate
G1 PASS across 3 scenarios / 6 typecheck/build IDs. G2 FAIL with 17 HTTP IDs,
G3 FAIL with 20 combined IDs: HTTP_JSON_TYPE in aggregate and each scenario.
All compared initial/step SQLite snapshots match **within the recorded manifest**:
an explicitly bounded source-backed inference from complete G3 coverage, no DB_*
findings and unchanged comparator/aggregator code, not universal parity. jsonDiff
does not descend under kind mismatch; exact offending field and skipped subtree
contents remain UNCONFIRMED. G0/G4 INCONCLUSIVE, held-out NOT_RUN, PRODUCT
NOT_ESTABLISHED. Tokens 6060/9554; estimate USD 0.0481795, charged USD null/UNKNOWN.

A–D retain frozen bytes, pins, adapters, original tests and historical outcomes.
C G1 FAIL → D per-pair G1 PASS / aggregate INCONCLUSIVE / verifier ERROR → E
aggregate G1 PASS / public parity FAIL is shown without relabelling a failure.
Five cards, seven manual chapters and seven matrix rows are present; no fixed
ABCD chapter offset remains. NOT_LOADED narration is separate from loaded gate
statuses. The new E route and two ES modules are fixed allowlist additions;
CSP/origin isolation and all existing routes remain unchanged.

## Actually executed checks

Windows, Node 24.21.0, pnpm 11.25.0, local Chrome 156.0.8078.74 with already
installed Playwright. No downloads/new dependencies for the browser or viewer.

| Command / check | Exit / actual result |
| --- | --- |
| `git fetch origin --prune`, `git status --short`, `git rev-parse origin/main`, `git log -5 --oneline origin/main` | 0; clean isolated branch created from fresh f68b75e… |
| Read-only GitHub run/artifact metadata + `gh api` exact public ZIP | 0; run/head/attempt and ZIP identity confirmed; no other artifact fetched |
| `python research/demo-readiness/prepare-track-e.py research/demo-readiness/provenance/track-e/public-receipts.zip '<scratch output>'` | 0; exact ZIP/nine-member hashes and safe schema categories; byte-for-byte deterministic output equality |
| `pnpm install --frozen-lockfile` | 0; already up to date, dependencies/lockfile unchanged |
| `pnpm lint` | 0; final local result; formatting applied with existing config only |
| `pnpm typecheck` | 0 |
| `pnpm test` | 0; 783 total, 673 PASS / 110 Windows/environment SKIP / 0 FAIL |
| `pnpm build` | 0 |
| `node --test research/demo-readiness/demo.test.mjs research/demo-readiness/real-ai.test.mjs research/demo-readiness/incident.test.mjs research/demo-readiness/track-e.test.mjs` | 0; 187 PASS / 0 FAIL / 0 SKIP (134 existing + 53 E) |
| `node research/mmp-069/validate.mjs` | 0; VALID, 113 research modules, privilegedRunner NOT_RUN |
| `node research/mmp-069/check-syntax.mjs` | 0; 112 files PASS, syntax only |
| Optional browser smoke below | 0; 22 groups PASS, errors [], externalRequests [] |
| Documentation link / source and screenshot hash checks | 0; actual final totals in PR |
| Protected-layer diff / `git diff --check` | 0; protected paths unchanged; no whitespace errors |

The early E positive test failed because parseStrict returns null-prototype
objects while the presentation coverage API expected an ordinary record. Returning
a coverage copy, consistent with D, fixed it; no validation rule or test was
removed/loosened. Final full E/legacy suite passes. Formatting suggestions were
resolved with the unchanged Biome configuration.

```powershell
node research/demo-readiness/browser-smoke.mjs 'C:\Users\skv1d\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright\index.mjs' 'C:\Program Files\Google\Chrome\Application\chrome.exe' 'C:\Metamorph\.oracle-evidence\mmp148-browser\after'
```

This starts the unchanged server implementation with its small fixed E route
additions on **127.0.0.1:4171**, blocks non-loopback page requests, loads all eleven
inputs, tests, captures and closes its own resources. Viewer launch remains
`node research/demo-readiness/serve.mjs`, no install/key/network service needed.
Optional browser automation is not added to CI execution; root CI scope is unchanged.

Negative controls: edited/short/oversized/reformatted/invalid/duplicate E bytes;
unknown/path/URL file names; exact field schema; false G0/G1/G2/G3/G4/product
claims; missing/inflated/duplicated IDs and counts; changed run/attempt/head/
source/context/manifest/request/candidate/model/member/ZIP; invented charge or
charge zero; candidate/raw-body/old-restore fields; URL/path/HTML payloads;
per-scenario findings, bounded SQLite conclusion, cleanup/finalizer; immutable
source pins and async memory copy; strict HTTP route boundaries including denial
of the retained original ZIP/preparation script.

Actual browser checks: all A–E/card/details/11 JSON options/7 matrix rows; seven
manual chapters and boundaries; C/D/E distinctions and counts; E JSON inspector;
keyboard skip link/Enter/Space/visible focus; 1440/768/390 widths across all tracks
and expanded matrix; historical/C/D/E picker sets; E_NOT_LOADED vs FAIL;
NOT_VERIFIED declaration; clearing previous preview and derived DOM on failure;
incomplete C, forged D, malformed JSON, mixed D/C and D/E, modified E, unknown name;
corrupt D and missing/corrupt E make the whole combined load fail, no fallback;
stale successful fetch and stale successful E file read cannot overwrite newer
failed selection; recovery. Reduced-motion mode enabled; no page overflow,
JavaScript exceptions or external page requests observed.

## Actual screenshots / provenance

Before: the existing A–D browser smoke actually ran on fresh base f68b75e… before
editing, 16 groups PASS. Before images below are its home captures at scroll zero.
After: current A–E smoke, same browser, viewport height 1000, scale 1; all public
inputs loaded and E selected. No mock receipts or image manipulation. The
[browser result/capture record](screenshots/mmp148/browser-results.json) records
UTC capture time, each filename, requested region, viewport and actual scroll.
Screenshots are UI illustrations, not new candidate/Oracle execution proof.

| View | Before | After |
| --- | --- | --- |
| Home desktop | [1440](screenshots/mmp148/before-home-1440.png) | [1440](screenshots/mmp148/home-1440.png) |
| Home mobile | [390](screenshots/mmp148/before-home-390.png) | [390](screenshots/mmp148/home-390.png) |
| Evidence desk | Four tracks in merged MMP-140; no fabricated E | [1440](screenshots/mmp148/evidence-1440.png), [768](screenshots/mmp148/evidence-768.png), [390](screenshots/mmp148/evidence-390.png) |
| Track E details | NOT_APPLICABLE, E did not exist | [1440](screenshots/mmp148/track-e-1440.png), [390](screenshots/mmp148/track-e-390.png) |
| Tablet home | Baseline smoke executed, not shipped | [768](screenshots/mmp148/home-768.png) |

Visually inspected A–E desktop evidence and mobile E details; final captures
also checked for wrapping and explicit red FAIL alongside green scoped build PASS.
Source hashes/viewport metadata allow review of the exact saved result. #145's
baseline screenshot correction stays in its separate PR and is not bundled here.

## NOT_RUN and review boundary

NOT_RUN: human timed rehearsal, fully disconnected laptop, screen-reader/full
assistive-technology audit, other engines; real Meta/model/API requests, dispatch/
rerun, Docker, candidate patch/import/execution, decryption, private artifacts,
owner identity/key/restore, private G4 and production acceptance. Local units,
browser smoke, hosted CI and owner/reviewer acceptance remain separate facts.

Packages/apps/workflows/shared API/dependencies/source pins, the comparator,
G0–G4 semantics and other research files were read-only/unchanged. Independent
ChatGPT review of the published exact SHA is requested in the PR; no self-approval
or merge. No successful end-to-end migration is claimed.
