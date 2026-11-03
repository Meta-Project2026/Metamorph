# Metamorph — recorded demo & offline evidence desk

[MMP-140](https://github.com/Meta-Project2026/Metamorph/issues/140) improves the
existing vanilla HTML/CSS/ESM viewer. It presents **PHP → TypeScript with independent
behavioral verification**, using five recorded public tracks (A–E). It is not a live
migration application. **PRODUCT NOT_ESTABLISHED** stays visible before loading
and throughout the walkthrough. A–D end at 1 November; E adds the 2 November 2026
run 41505679809 from independently retrieved public receipts. This is a recorded
snapshot, not a live feed or the latest complete project state. Later research,
owner actions and new experiments remain separate.

The first screen explains the product and acceptance gap; five selectable pipeline
stages explain the architecture. **Guided Demo** has seven manually selected chapters
and Previous/Next buttons, with no timer or simulated execution. After loading,
five track cards select focused details; expand the seven-row comparison matrix for all
G0–G4 rows, identities for exact SHAs, and the JSON inspector for original fields.
Chapter narration remains clearly separate from loaded, validated evidence.
An absent track in a picker selection is labelled not loaded.

Design rationale and scope are in [plan.md](plan.md); target narration and fallback
are in [RUNBOOK.md](RUNBOOK.md). Current executed checks and before/after browser
screenshots are in [VALIDATION-148.md](VALIDATION-148.md). Target pacing is not a
measured human rehearsal.

MMP-145 corrects the duplicate desktop baseline evidence image: the home capture
is preserved, and the evidence viewport is genuinely recaptured from baseline
`d31711f…` at 1440×1000, scroll y=887. [Exact provenance and correction](VALIDATION-140.md#mmp-145-correction--3-november-2026-europebucharest)
and [capture metadata](screenshots/mmp140/recapture-145.json) distinguish it from
the original duplicate. The UI, adapters, pins and receipts are unchanged.

Read-only presentation built for the 2026-10-30 event (historical date), extended on 2026-11-02 with track D. Refs [#118](https://github.com/Meta-Project2026/Metamorph/issues/118), [#85](https://github.com/Meta-Project2026/Metamorph/issues/85), [#71](https://github.com/Meta-Project2026/Metamorph/issues/71), [#61](https://github.com/Meta-Project2026/Metamorph/issues/61), [#81](https://github.com/Meta-Project2026/Metamorph/issues/81), [#104](https://github.com/Meta-Project2026/Metamorph/issues/104).

From the repository root, with Node 22.13+ / 24 and a modern browser:

```powershell
node research/demo-readiness/serve.mjs
```

Open [the local viewer](http://127.0.0.1:4171/) and click **Load pinned public receipts**.
Eleven exact local public inputs load all five tracks. Stop with Ctrl+C. Fixed allowlist,
loopback only (`127.0.0.1:4171`). No API key, Docker, PHP, pnpm install, GitHub,
Internet or candidate execution is needed to present. Direct file:// is unsupported.

- **A — historical admission-only:** MODEL_GENERATION_NOT_RUN, run 40793819074;
  zero generated requests, null candidate/cost. Historical, not current project state.
- **B — historical deterministic Docker replay:** DETERMINISTIC_REPLAY_NOT_AI;
  G2/G3 PASS → FAIL → PASS, 17 HTTP / 20 SQLite comparisons on each attempt.
  Scripted repair is not an AI result.
- **C — real AI trial — G1 build failure:** run 40900698372, 29 October 2026.
  Muse Spark 1.3 generated a candidate (generation PASS, one request/response).
  Docker typecheck G1 FAIL / BUILD_FAILED. G2/G3 INCONCLUSIVE: HTTP 0/17,
  SQLite 0/20, downstream comparisons unexecuted. Cleanup/finalizer 0/0/0.
- **D — real AI trial #2 — verifier error:** run 41327197036, 1 November 2026.
  Muse Spark 1.3 generated a candidate (generation PASS, one request/response).
  First per-pair G1 PASS (workshop-business typecheck + build), but aggregate G1
  INCONCLUSIVE / BUILD_NOT_RUN — the other pairs' builds never ran. G2/G3 ERROR /
  VERIFIER_ERROR: HTTP 0/17 completed, SQLite 1/20 (workshop-business:initial).
  Normal cleanup VERIFIED_ZERO_RESOURCES, finalizer PASS 0/0/0. Candidate source
  UNAVAILABLE, historical root cause UNKNOWN, stage classification NOT_RECORDED.

C reports tokens 5818/9239, estimated USD **0.04653825**, charged USD **null**.
D reports tokens 5985/9870, estimated USD **0.04942875**, charged USD **null**
(UNKNOWN, not $0). Estimates are not settled charges. C's original TypeScript
diagnostics UNKNOWN; MMP-082 synthetic TS2322 belongs to another candidate. D's
historical root cause UNKNOWN: zero *completed* HTTP comparisons does not mean
zero HTTP requests reached the services. G0/G4 INCONCLUSIVE, product
NOT_ESTABLISHED for C/D. Historical PR #31 AUDIT_FAIL is unchanged.

**E — full public build PASS, JSON type parity FAIL:** run 41505679809,
2 November 2026, head `a01bb65f8bb58c02c7a59e06ffedc9662576478e`, candidate
`6140dbed4afb0d2068db17facb0e14ff9c2ffb61aaaf2b64207b9a8aa2125d38`.
Genuine Muse Spark 1.3 response, generation PASS, aggregate G1 PASS (3 scenarios,
6 typecheck/build IDs), G2/G3 **FAIL / HTTP_JSON_TYPE**. HTTP **17/17** and SQLite
**20/20** are executed comparisons, not passing coverage. Compared initial/step
SQLite snapshots match within this manifest (G3 includes HTTP findings); this is
a bounded source-backed inference, not universal parity or proof about JSON
subtrees skipped on kind mismatch. Exact offending field/root cause UNCONFIRMED.
G0/G4 INCONCLUSIVE, formal held-out NOT_RUN, PRODUCT NOT_ESTABLISHED. Tokens
6060/9554, estimate USD **0.0481795**, charged USD **null / UNKNOWN**.

E's versioned `mmp148-track-e-v1.json` is a narrow public projection of original
artifact **13169804253**, `meta-paid-public-41505679809`. ZIP and all nine members
(eight under meta-paid-public plus the attempt receipt) were independently
rehashed. [Provenance / preparation](PROVENANCE.md#e--2-november-2026-real-build-pass-http-json-type-fail)
documents source inventory and reproduction with `prepare-track-e.py`. E is
exact-pinned **before** bounded strict parsing and independently semantically
validated by separate modules. A pin establishes public snapshot identity, not a
fresh Oracle run or independent executor attestation. No raw candidate/model body,
private observations, ciphertext, keys or historical custody/restore fields enter
this projection. The adjacent research evidence.json is not its data source.

The original reviewed PUBLIC metadata ZIP is retained in the unserved
`provenance/track-e/` directory so the projection remains reproducible offline
after the GitHub artifact expires. It contains categorical public receipts,
not candidate/diagnostics ciphertext. The browser cannot fetch that ZIP or run
the preparation tool; it loads only the narrow pinned E projection.

| C identity | Exact value |
| --- | --- |
| Run / execution head | `40900698372` / `d21376747c7147043ca618e149fac87c0df80111` |
| Frozen PHP source | `d272170d0aecbd28eb5b13e272d9dd11d545b66c` |
| Generated candidate | `afd9f726bcbc2a9dfc2f67128871db307fbd00f2ba4febdc41b5633da98dad8f` |
| Original ZIP SHA-256 | `95121c3291e4478d682dfd3375de86e2df4036f46bcdc81826ee6fdc5fb2a493` |

| D identity (different run from C) | Exact value |
| --- | --- |
| Run / job / execution head | `41327197036` / `124909546925` / `d199510fd802693d4af852bd5ed8498b5461d185` |
| Frozen PHP source | `d272170d0aecbd28eb5b13e272d9dd11d545b66c` |
| Generated candidate | `1120249ee45c0aa3efe73d57d01e813d522a9c2252fcd3e2d984a4000b9d9d2d` |
| Derived summary | `research/mmp-104/incident.json` · 4785 bytes · SHA-256 `93729a0e6c2339835247d226ba5067de2c02b0e9b8014a6aa092869b7025392a` |

D is served from one fixed allowlisted route (`/evidence/mmp-104/incident.json`)
and validated by `incident-pins.mjs` / `incident-adapter.mjs`: exact byte size and
SHA-256 of the committed derived summary before parsing, a bounded strict parser
afterwards, then exact-value binds of run/head/source/candidate identities, gate
verdicts/finding codes/executed IDs, coverage 0/17 + 1/20, first-pair PASS,
cleanup/finalizer 0/0/0, preservation NOT_APPLICABLE, `chargedCostUsd=null`,
UNKNOWN root cause and NOT_RECORDED stage classification. A matching hash
establishes **identity of the derived allowlisted summary only** — not
cryptographic verification of the original ZIPs, authenticity of a third-party
file, or any new execution of code. The recorded original ZIP expiration date is
2026-11-08; this viewer makes no current artifact availability claim.

Original GitHub-hosted public ZIP and four member sizes/digests independently
verified on 2026-10-29; byte-identical members under evidence/real-ai-40900698372/.
Original five historical receipts, pins.mjs, adapter.mjs and demo.test.mjs unchanged.
C pins/adapter were merged through reviewed [PR #87](https://github.com/Meta-Project2026/Metamorph/pull/87)
(2026-10-31; owner review comments — GitHub disallows native self-approval).

Picker: one complete set of five historical files, four C files, the single
`incident.json` D summary, the lone `mmp148-track-e-v1.json` E projection, or one future-model.json declaration preview (always
NOT_VERIFIED). `incident.json` is accepted only as a lone selection (exact pin);
E is also accepted only alone. Names overlap across A/B/C — select from one folder at a time. Bundled A–E tracks
validate atomically; new selection or error clears prior results. Byte identity
is not independent executor attestation.

- [Russian runbook](RUNBOOK.md): 90-second / ~4-minute target pacing and fallbacks.
- [Provenance / trust policy](PROVENANCE.md): exact original identities and hashes.
- [Current E validation](VALIDATION-148.md); [MMP-140 UI validation](VALIDATION-140.md);
  [separate screenshot correction #145 / PR #149](https://github.com/Meta-Project2026/Metamorph/pull/149); [MMP-085 validation](VALIDATION-085.md);
  [historical validation](VALIDATION.md).
- [Compact scope / plan / tasks](plan.md).

```powershell
node --test research/demo-readiness/demo.test.mjs
node --test research/demo-readiness/real-ai.test.mjs
node --test research/demo-readiness/incident.test.mjs
node --test research/demo-readiness/track-e.test.mjs
pnpm exec biome check research/demo-readiness
```

The viewer launch above needs no install. Developer checks use the repository's
existing pinned dependencies:

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Optional reproducible browser smoke: supply an **already installed** Playwright ESM
module and local Chromium/Chrome. No download is performed. The script temporarily
binds loopback port 4171, blocks non-loopback page requests, checks UI/picker/
atomic/race/responsive behavior, saves screenshots/results, then closes its own
resources. Stop your own viewer first; do not stop someone else's process.

```powershell
node research/demo-readiness/browser-smoke.mjs '<absolute local playwright/index.mjs>' '<absolute chrome.exe>' '<absolute output directory>'
```

This optional local smoke is syntax/lint checked by existing Fast CI; browser
automation is not added to PR CI. Native buttons, a skip link, labelled controls,
focus-visible styles, keyboard-scrollable tables and reduced-motion support are
included. Full assistive-technology testing and human timed rehearsal remain
separate checks; see the validation record for what actually ran.

Biome is an existing dev dependency, unnecessary for presentation. No dependency,
lockfile, workflow or Oracle changes. No external assets, telemetry, storage or
unsafe HTML. Original pre-event MMP-085 additions reuse MMP-071. Public receipts
retain provenance. No raw model response, candidate/PHP source or private Docker
packs were fetched. MIT notice remains at evidence/LICENSE.upstream, copyright
Tanjila Afsari Rubina. This does not claim hackathon-only authorship.
