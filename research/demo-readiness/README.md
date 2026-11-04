# Metamorph — recorded demo & offline evidence desk

MMP-194: run `node research/demo-readiness/serve.mjs`, open
`http://127.0.0.1:4171/` and follow **Open the latest recorded PHP → TypeScript
proof**. The separate proof sheet validates original public run 41856569137;
A–F below retain their original identities and outcomes. G0_REAL_CANDIDATE
NOT_RUN · G4 INCONCLUSIVE · PRODUCT NOT_ESTABLISHED.
See [3-minute English storyboard](SUBMISSION.md), [form answer pack](submission-answers.md),
[submission checklist](SUBMISSION-CHECKLIST.md), [operator flow](../mmp-194/RUNBOOK.md)
and [source audit](../mmp-194/provenance.md). Video URL is pending human upload;
the form is NOT_SUBMITTED.

[MMP-140](https://github.com/Meta-Project2026/Metamorph/issues/140) improves the
existing vanilla HTML/CSS/ESM viewer. It presents **PHP → TypeScript with independent
behavioral verification**, using six recorded public tracks (A–F). It is not a live
migration application. **PRODUCT NOT_ESTABLISHED** stays visible before loading
and throughout the walkthrough. A–D end at 1 November; E adds 2 November run 41505679809, F adds the real
generate → Oracle → repair → Oracle run 41726833705 (3 November UTC / 4 November
Kishinev). Both are independently retrieved public snapshots. This is a recorded
snapshot, not a live feed or the latest complete project state. Later research,
owner actions and new experiments remain separate.

The first screen explains the product and acceptance gap; five selectable pipeline
stages explain the architecture. **Guided Demo** has eight manually selected chapters
and Previous/Next buttons, with no timer or simulated execution. After loading,
six track cards select focused details; expand the nine-row comparison matrix for all
G0–G4 rows, identities for exact SHAs, and the JSON inspector for original fields.
Chapter narration remains clearly separate from loaded, validated evidence.
An absent track in a picker selection is labelled not loaded.

Design rationale and scope are in [plan.md](plan.md); target narration and fallback
are in [RUNBOOK.md](RUNBOOK.md). Current executed checks and before/after browser
screenshots are in [VALIDATION-162.md](VALIDATION-162.md). Target pacing is not a
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
Twelve exact local public inputs load all six tracks. Stop with Ctrl+C. Fixed allowlist,
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

**F — first genuine model repair, still public FAIL:** run 41726833705 started
2026-11-03T22:00:07Z (4 November 00:00:07 Kishinev), workflow attempt 1,
execution head `f034d4dfcc30dcc82300e93002b5a55206c7dc04`. Two real Muse Spark 1.3
responses produced different candidates:

| Attempt | Candidate SHA-256 | Input / output tokens | Estimated USD |
| --- | --- | --- | --- |
| 1 / REAL generation | 329cdcca096461c2357b157f162daec3a4bf2eaaf5b1036a8d62026545b76fa3 | 6188 / 10556 | 0.052598 |
| 2 / REAL repair | 572c6db97f279ac34224e847e8790516fb20bbf50fd6d131aa8ee44b9c68cd03 | 14148 / 9179 | 0.05669575 |

Both: G1 PASS six build/typecheck IDs, G2 FAIL HTTP_JSON_TYPE with 17/17 executed,
G3 FAIL HTTP_JSON_TYPE with 20/20 executed. Business/rejected G2/G3 FAIL/FAIL,
capacity PASS/PASS in both attempts. G3 includes HTTP findings; a separate DB
defect and exact mismatched field/type are not established. **Published aggregate
outcome pattern unchanged; per-step improvements unknown.** Sum estimated USD
**0.10929375**; charged USD **null / UNKNOWN**, never zero. G0/G4 INCONCLUSIVE,
held-out NOT_RUN, PRODUCT NOT_ESTABLISHED. Workflow success is process completion,
not migration PASS.

F's new `mmp162-public-repair-v1` projection is **27687 bytes**, SHA-256
`d2bf5aaafea0d7431fee00463ec6cf4c926e24004efb3d97133eee4175ee78d3`.
The original PUBLIC ZIP artifact 13274647279 (28147 bytes, 24 metadata members)
was verified by exact size/hash and allowlist-first field/privacy audit, then
retained unchanged and **unserved** in `provenance/track-f/`. No private artifact,
candidate source, raw response or decryption was used. [Full inventory and
reproduction](PROVENANCE.md#f--first-real-repair-historical-public-fail) use only
Python stdlib, without network or candidate execution. `track-f-adapter.mjs`
checks the new size/hash **before** the unchanged bounded strict parser, then
independently validates exact identities, attempt order, gates, executed IDs,
per-scenario verdicts, usage and limits. A–E pins/adapters/tests remain unchanged.

The intermediate source scorecard incorrectly says maximumPosts=1 and
PUBLIC_FAIL_SIGNED_REPAIR_NOT_IMPLEMENTED. F derives truth from the linked
per-attempt generation/trial receipts, excludes these nonfinal fields, and records
the final repair stop reason COMPLETE_PUBLIC_FAIL_AFTER_SIGNED_REPAIR. The ZIP
is never rewritten. #161 owns production reporting fixes; any later run needs
separate evidence/pins. Per-attempt wall-clock timestamps are unavailable; the
UI labels the run start explicitly. Snapshot identity is not a fresh Oracle run.

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
`incident.json` D summary, the lone `mmp148-track-e-v1.json` E projection, the lone
`mmp162-track-f-v1.json` F projection, or one future-model.json declaration preview (always
NOT_VERIFIED). `incident.json` is accepted only as a lone selection (exact pin);
E/F are also accepted only alone. Names overlap across A/B/C — select from one folder at a time. Bundled A–F tracks
validate atomically; new selection or error clears prior results. Byte identity
is not independent executor attestation.

- [Russian runbook](RUNBOOK.md): 90-second / ~4-minute target pacing and fallbacks.
- [Provenance / trust policy](PROVENANCE.md): exact original identities and hashes.
- [Current F validation](VALIDATION-162.md); [historical E validation](VALIDATION-148.md); [MMP-140 UI validation](VALIDATION-140.md);
  [separate screenshot correction #145 / PR #149](https://github.com/Meta-Project2026/Metamorph/pull/149); [MMP-085 validation](VALIDATION-085.md);
  [historical validation](VALIDATION.md).
- [Compact scope / plan / tasks](plan.md).

```powershell
node --test research/demo-readiness/demo.test.mjs
node --test research/demo-readiness/real-ai.test.mjs
node --test research/demo-readiness/incident.test.mjs
node --test research/demo-readiness/track-e.test.mjs
node --test research/demo-readiness/track-f.test.mjs
python research/demo-readiness/prepare-track-f.test.py
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
