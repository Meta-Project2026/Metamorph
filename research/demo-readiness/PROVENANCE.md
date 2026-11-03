# Public snapshots and receipt trust

MMP-148 adds E from independently retrieved original PUBLIC metadata of run
41505679809; see the final section below. Earlier A–D preparation records retain
their historical scope and do not establish current custody/owner-restore state.
All A–D receipt bytes, pins, adapters and existing test files are unchanged.

MMP-085 adds C independently of historical A/B below. The five original historical
files, pins.mjs, adapter.mjs and demo.test.mjs are byte-identical to the base.
C is a review candidate; independent ChatGPT review is pending.
MMP-118 adds track D (2026-11-02) from the committed MMP-104 derived summary;
only demo-readiness presentation files change and no existing A/B/C bytes move.

## Historical A/B — MMP-071 / PR #70

Evidence source: [PR #70](https://github.com/Meta-Project2026/Metamorph/pull/70),
documentation commit `e8f6e739f1a727997c061dc5bafaa37040392489`.
Execution: [run 40793819074](https://github.com/Meta-Project2026/Metamorph/actions/runs/40793819074),
head `6ab6e36f813673756af157bc0de2265964c26071`, completed `success`.
Source: public MIT `tanjilaafsarirubina/car-workshop`, commit
`d272170d0aecbd28eb5b13e272d9dd11d545b66c`.
Archive SHA-256 `32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4`.

The evidence commit is a retrieval identity, not the executed head. Neither is the
MMP-071 viewer's own head. These identities are intentionally distinct.

| Local file under `evidence/` | Public source path under `research/mmp-061/` | Metrics used |
| --- | --- | --- |
| trial.json | hosted/40793819074/model/trial.json | generatedRequests=0; candidateSha/totalCostUsd=null; AI_GENERATION_NOT_RUN; model gates and cleanup NOT_RUN |
| summary.json | hosted/40793819074/controls/summary.json | runs[].attempts[].gates/coverage/candidateSha; runtimeControls; completion |
| finalizer.json | hosted/40793819074/controls/finalizer.json | headSha; inventory 0/0; emergencyRemoved=0; status PASS |
| inventory.json | inventory.json | apiActions/API count 5; phpFunctionUnits length 11; phpMetrics sums 831/439; source scope |
| evidence-index.json | evidence-index.json | published file sizes/digests and separation of model/replay evidence |

Every exact source path, byte size and SHA-256 is in `pins.mjs`. Fetch source files
through the GitHub contents API using the **evidence commit**, decode base64 without
reformatting, then compare hashes. The five originals are byte-for-byte copies.
The source index supplies the first four hashes; the index's own hash was computed
from its pinned GitHub bytes. This is public snapshot identity, not a digital
signature from an independent executor. No raw/private packs were downloaded.
Original archive artifact digests in the index were not independently downloaded
or reverified in MMP-071; committed public receipts are the demo input.

## Input and trust policy

The bundled-load button selects a fixed local set. The file picker accepts exactly
the five historical basenames together, the four C basenames together, or a single
`future-model.json` preview. Never mix the folders (trial/finalizer basenames overlap).
Unknown names, duplicate/missing files, malformed JSON/UTF-8, duplicate JSON keys,
prototype keys, secret-like fields, unsafe numbers, excessive nesting, oversized
strings and files over 96 KiB fail closed. Changed known receipts fail their exact
byte pin, including benign reformatting. An incomplete bundle never displays
partial metrics. A new selection clears prior results immediately; an older
in-flight read cannot overwrite a newer selection.

Public usage fields `inputTokens`, `outputTokens`, `cachedInputTokens` and the
enumerated `budgetAuthorization` are allowed in the existing pinned snapshot.
They are not credentials. Other secret-like fields are rejected. Fixed error
codes never echo untrusted receipt content or local paths. JSON is rendered only
through textContent. There is no HTML execution, source execution, URL input,
external asset, telemetry, storage, cookie, arbitrary filesystem serving or upload
to a service. Selected files stay in browser memory; reload clears the view.

## Future real-model receipts

There is no trusted real-model producer/receipt contract in #70. This viewer does
not invent one. `mmp071-model-preview-v1` is a **viewer-only declaration envelope**,
not a replacement for #61 receipts, billing authorization or executor attestation.
Its exact required keys are:

| Field | Rule |
| --- | --- |
| format / kind | `mmp071-model-preview-v1` / `REAL_MODEL_GENERATION` |
| headSha / sourceSha | Exact expected identities in trusted pins.mjs, never supplied as policy by the uploaded file |
| candidateSha | 64 lowercase hex content SHA; required |
| runId | Positive decimal hosted-run ID, no URL |
| provider / modelId | Nonempty bounded identifier strings; declarations only |
| generatedRequests | Positive safe integer |
| totalCostUsd | Nonnegative finite number or null; absence rejected, null preserved |
| outcome | PASS, FAIL, ERROR or INCONCLUSIVE; a declared trial outcome, not product acceptance |
| gates | Exact G0..G4 keys; PASS/FAIL/ERROR/INCONCLUSIVE/NOT_RUN |
| coverage | null, or exact keys httpIds/sqliteIds with unique known public scenario-step IDs; G2/G3 PASS requires the complete corresponding IDs |
| product | Exactly NOT_ESTABLISHED |

Coverage IDs describe the existing frozen 6+5+6 HTTP steps and three additional
initial SQLite snapshots. They do not establish function or route completeness.
Even all claimed gate PASS values **stay NOT_VERIFIED**, never replace a historical
gate or imply product PASS. Structural identity checks do not authenticate a
run/candidate correlation. No fabricated preview receipt is shipped as evidence.
Trials without generated candidates cannot use the REAL_MODEL_GENERATION preview;
show their original failure/NOT_RUN receipt outside this adapter and use the factual
fallback. Do not manufacture a candidate identity just to satisfy a schema.

To ingest a real future receipt: independently inspect its allowlisted public
producer output and actual hosted run/head/source/candidate correlation; retain
provider/model/requests/cost/nulls and natural outcomes. Submit a **separate reviewed
content/adapter update** with exact bytes, trusted expected SHA policy and producer
schema. Until review, use only the declaration preview or original public record.
Changing the snapshot pins is a trust-policy code change, not something a file
upload may perform. A new model receipt must retain REAL_MODEL_GENERATION provenance
and must never borrow the replay's 17/20 coverage or 0/0 cleanup. This track does not
approve model spend, hidden G4, formal qualification, source changes or merging #70.


## C — original MMP-081 real AI generation, G1 build failure

Primary evidence: [Actions run 40900698372](https://github.com/Meta-Project2026/Metamorph/actions/runs/40900698372),
created 2026-10-29T15:21:19Z, completed/failure. Actual execution head
`d21376747c7147043ca618e149fac87c0df80111` (not current main/viewer HEAD).
Source `tanjilaafsarirubina/car-workshop`, frozen commit
`d272170d0aecbd28eb5b13e272d9dd11d545b66c`, source archive SHA-256
`32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4`.
Generated candidate SHA
`afd9f726bcbc2a9dfc2f67128871db307fbd00f2ba4febdc41b5633da98dad8f`.

Original artifact `meta-paid-public-40900698372`, ID `12909716502`, 4085 bytes.
Original ZIP SHA-256:
`95121c3291e4478d682dfd3375de86e2df4036f46bcdc81826ee6fdc5fb2a493`.
On 2026-10-29, retrieved GitHub artifact API metadata and original ZIP with `gh api`;
computed ZIP SHA-256 independently, matched API digest and all four member hashes.
Inspected every original public member and extracted only these members, as data.
No raw model response, candidate source, private Docker pack or workflow rerun.
The ZIP is not shipped/served; original member bytes are committed unchanged.

| Original ZIP member | Bytes | SHA-256 |
| --- | --- | --- |
| meta-paid-public/generation.json | 2146 | `b0dbc3909d2aa258dc81a61f8b65b1091f61a5c3005aa711527beb56e476b086` |
| meta-paid-public/trial.json | 6359 | `3523b12101e851ec60ba5b3906ce8ecc9274cd4249271b90042f49ad30e108b3` |
| meta-paid-public/finalizer.json | 165 | `377255db8805443e7f85a53afded058a4bdb391a49ad65f8e595b65fb53a7678` |
| mmp078-40900698372-attempt.json | 765 | `17ad1b63b6b980d60b15fcca7015692c177ec16f7dcd9dbbccc9adb825896b5a` |

Local directory: `evidence/real-ai-40900698372/`. All four files are required by
this adapter, including the optional-in-task attempt receipt, to retain its
independent run/head/source/context/manifest/body/model/estimate correlation.
The attempt receipt's own status UNKNOWN remains unchanged; generation.json is
the later evidence of the actual response. It is not a charge receipt.

### Producer-aware validation and limitations

`real-ai-pins.mjs` is fixed, deeply frozen policy. `real-ai-adapter.mjs` requires
exact four names, no duplicates, max 96 KiB/file, exact byte size and SHA-256
**before JSON parsing**. Unknown/missing fields are rejected by explicit key sets
for every producer object, including nested authorization, modelReceipts, attempts,
gates, coverage, pairs, pack hashes, cleanup and finalizer. The exact original
public producer fields include authorization metadata (not credentials); the
historical parser's separate secret-field policy is unchanged. Altered bytes,
including duplicate keys, secret-like fields, HTML, invalid UTF-8 or whitespace,
never reach the C JSON parser. No arbitrary self-declared C preview is accepted.

Cross-file checks bind generation.authorization, trial.budgetAuth and the attempt
receipt to run/head/source/context/manifest/body/model/tariff; embedded modelReceipt
must equal original generation.json. Generation/trial/attempt candidate identities,
usage amounts/nulls, five gate verdicts/findings/executed IDs, zero coverage and
cleanup all retain the actual outcome. Finalizer contains only head, not run/source/
candidate: its same-archive exact member pin and matching head bind its provenance;
no nonexistent fields or digital signature are invented. ZIP/run linkage was
verified during preparation; the offline viewer checks members, not the ZIP itself.

Observed: REAL_INFERENCE / generation PASS, muse-spark-1.3, 1 attempted request,
1 confirmed response, tokens 5818/9239, estimate USD 0.04653825, charged/report cost
null. Trial REAL_INFERENCE_GENERATED, G1 FAIL / BUILD_FAILED. G2/G3 INCONCLUSIVE
with MISSING_COVERAGE; only workshop-business:typecheck executed, HTTP 0/17 and
SQLite 0/20. G0/G4 INCONCLUSIVE, product NOT_ESTABLISHED. Normal cleanup
VERIFIED_ZERO_RESOURCES and finalizer PASS, both 0/0/0. Generation PASS does not
mean candidate build PASS. Estimate is not a settled charge. This work incurs no
new Meta calls/spend and establishes no repair, private audit or product PASS.

Original compiler diagnostics UNKNOWN. Four distinct evidence identities after MMP-118:

| Concept | Run / execution head | Candidate SHA |
| --- | --- | --- |
| Historical #70 deterministic known-good / scripted repair | `40793819074` / `6ab6e36f813673756af157bc0de2265964c26071` | `34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334` |
| Historical deliberate mutation | same historical #70 run/head | `1fd6c3547691a2593a58932e78946a8338061ec07cc46f9fb5b9422825591121` |
| Actual MMP-081 model generation / G1 FAIL (track C) | `40900698372` / `d21376747c7147043ca618e149fac87c0df80111` | `afd9f726bcbc2a9dfc2f67128871db307fbd00f2ba4febdc41b5633da98dad8f` |
| Actual MMP-104 paid-v2 run / verifier error (track D) | `41327197036` / `d199510fd802693d4af852bd5ed8498b5461d185` | `1120249ee45c0aa3efe73d57d01e813d522a9c2252fcd3e2d984a4000b9d9d2d` |
| MMP-082 synthetic compiler diagnostic control (not ingested by viewer) | `40926137817` / `c1fc7183d3ea6388c122b1885aed80f1cc0e7bf0` | `47bc850883ded819c2092fac18743e404c85c581b639cf789e4a572db370d4e2` |

Synthetic identity read from `research/mmp-082/evidence/40926137817/compiler-control.json`
at the MMP-085 base. Its real Docker TS2322 diagnostic is for synthetic input and
must never appear as the actual MMP-081 compiler error. No diagnostics are added
to original C receipts. Public pack IDs/hashes are references only; private packs
were not retrieved or independently validated. Historical PR #31 AUDIT_FAIL stays
unchanged. Exact-byte identity, code review, owner approval and product acceptance
remain separate facts.


## D — MMP-104 derived incident summary, verifier error (1 November 2026)

Sole data source: the committed
[`research/mmp-104/incident.json`](../mmp-104/incident.json)
(`format=mmp104-public-incident-v1`, added to main in commit `2dd2da8`),
produced by [`research/mmp-104/inspect-incident.mjs`](../mmp-104/inspect-incident.mjs)
as an allowlisted projection of the two public artifacts of
[run 41327197036](https://github.com/Meta-Project2026/Metamorph/actions/runs/41327197036)
(job 124909546925, workflow_dispatch by barbalatv, run_attempt 1,
completed/failure on 2026-11-01). It is **not** the original ZIPs, not raw
private receipts, not a reconstructed candidate and not a new verification.
This viewer changes nothing in `research/mmp-104/**` and performs no artifact
download, rerun, dispatch, inference or paid request.

Committed summary identity: 4785 bytes, SHA-256
`93729a0e6c2339835247d226ba5067de2c02b0e9b8014a6aa092869b7025392a`
(`incident-pins.mjs`, which also restates the eight pinned member identities
listed inside the summary). Served from one fixed allowlisted route
`/evidence/mmp-104/incident.json` targeting exactly `../mmp-104/incident.json`;
unknown paths, traversal, queries and directory access fail 404.

Adapter policy (`incident-adapter.mjs`): exact byte size and SHA-256 are checked
**before** parsing; the bounded strict parser from `adapter.mjs` then rejects
duplicate keys, prototype keys, unsafe numbers, invalid UTF-8 and secret-like
field names (the producer fact-field name `privateOperationPacks` is allowlisted
for this path only; its value is the status "UNAVAILABLE", not a credential).
After parsing, exact key sets and exact expected values bind every displayed
fact: run/job/head/source/archive/context/manifest/request/candidate identities,
the eight member identities, generation PASS (muse-spark-1.3, one POST, HTTP 200,
1 confirmed response, tokens 5985/9870, estimate USD 0.04942875,
`chargedCostUsd=null`), aggregate G1 INCONCLUSIVE / BUILD_NOT_RUN with only
`workshop-business:typecheck` + `workshop-business:build` executed, G2/G3 ERROR /
VERIFIER_ERROR with executed IDs `[]` and `["workshop-business:initial"]`,
coverage 0/17 + 1/20, first pair workshop-business G1 PASS /
DIAGNOSTIC_UNAVAILABLE, cleanup VERIFIED_ZERO_RESOURCES and finalizer PASS 0/0/0,
preservation NOT_APPLICABLE / upload NOT_RUN, attempt ledger UNKNOWN with
`chargedCostUsd=null`, product NOT_ESTABLISHED, `historicalRootCause=UNKNOWN`,
`historicalCandidateSource=UNAVAILABLE`, `privateOperationPacks=UNAVAILABLE`,
`stageClassification=NOT_RECORDED`.

Trust limits: a matching hash establishes **identity of the derived allowlisted
summary only**. It is not cryptographic verification of the original ZIPs (whose
GitHub artifacts expire 2026-11-08), not authentication of any third-party file,
not independent executor attestation and not new execution of code. The hash of
the generated candidate (`1120249e…`) refers to content whose source files are
UNAVAILABLE — it cannot be inspected and is not equal to available sources. Zero
completed HTTP comparisons does not establish that no HTTP request reached either
service. D's aggregate G1 INCONCLUSIVE / BUILD_NOT_RUN is distinct from C's G1
FAIL / BUILD_FAILED; run, job, head, candidate, cost, receipts and events are
never mixed across B, C and D. Track D claims no production stage telemetry:
`stageClassification=NOT_RECORDED` in this historical run; production telemetry
was added later. No ORACLE_PASS, VERIFIED_REAL_CANDIDATE or product PASS is
displayed for D. A future incident summary (different run) must never reuse
these pins; it requires a separate reviewed content/adapter update.

## E — 2 November 2026 real build PASS, HTTP JSON type FAIL

**GO source decision, 3 November 2026 (Europe/Bucharest).** Read-only GitHub
metadata independently confirmed run 41505679809, attempt 1, workflow Meta paid
migration, event workflow_dispatch, actor barbalatv, head
`a01bb65f8bb58c02c7a59e06ffedc9662576478e`, completed/failure. The explicitly
authorized artifact was **13169804253**, `meta-paid-public-41505679809`, 8733 bytes,
created 2026-11-02T19:02:24Z. Its GitHub digest and independently calculated ZIP
SHA-256 both equal `2aab13dd092d20a864b347fbeb2efea0caae10f22b28a4a24c39e78581862ee8`,
matching the earlier research validation cross-check. Source: [public run](https://github.com/Meta-Project2026/Metamorph/actions/runs/41505679809),
[#137](https://github.com/Meta-Project2026/Metamorph/issues/137).

The GitHub connector verified artifact metadata and retrieved a reusable file
reference. Local `gh api` read-only retrieval materialized the same explicit
public ZIP for hashing, inventory and projection; no other artifact was fetched.
Eight members are under meta-paid-public; the top-level attempt receipt makes
**nine ZIP members**, not eight total. Every member was size/hash checked before
JSON parsing, inspected as metadata only, and reconciled across generation,
trial, attempt and finalizers. No candidate source, raw response/body, private
observations, held-out input, key or sensitive absolute path was found. Original
public authorization metadata and ciphertext hashes are identifiers, not secrets
or ciphertext contents. No private candidate/diagnostics ZIP was retrieved.

The original **PUBLIC metadata only** ZIP is retained unchanged at
[provenance/track-e/public-receipts.zip](provenance/track-e/public-receipts.zip),
outside the HTTP allowlist. It contains categorical public receipts, not
candidate.age or candidate-diagnostics.age. The viewer serves only the narrower
versioned projection. Original recorded custody fields inside the audit source
are historical, **not current custody/restore status** and are excluded from E.

### Original member inventory

The table below records original bytes, not reformatted JSON. Formats absent in
the producer are labelled absent, not invented. All are public metadata scope.

| Member | Bytes | SHA-256 | Format |
| --- | --- | --- | --- |
| meta-paid-public/generation.json | 2151 | c17667ff67b1289884b3beacb11e5d86f4cdab9d31498b48df323469e1411201 | meta-generation-v1 |
| meta-paid-public/trial.json | 20930 | 0250d5d06ab36362434fb20d92f85e355a6d254b33f9fc7cfe785cdb10bae5e0 | mmp078-public-paid-trial-v1 |
| meta-paid-public/finalizer.json | 165 | 348746249e45b15da0972fdf88843807d03619d7795fef067095d54351a6cdb8 | absent |
| meta-paid-public/preservation.json | 1020 | c7a19894f48dccaad484516289124bff3a57764a9666227c20749a03c8de796c | mmp097-preservation-v1 |
| meta-paid-public/custody-capture.json | 655 | ff5a1b5f24b4fe0fda2c2383184ab39c8d1b8a9c257350e101476ce023f2d5a7 | mmp115-custody-v1 |
| meta-paid-public/custody-finalizer.json | 406 | 3679a278825d83e008036d9405b71a4ed723f37d5c98dfe04a2dc223240f22e6 | mmp115-pre-oracle-finalizer-v1 |
| meta-paid-public/custody-checkpoint.json | 663 | 9e3d7bef11eaa7bbb31971fcb447498e3e7fbdce9fec6563d1f4bb0de95408f2 | mmp115-custody-v1 |
| meta-paid-public/custody-stored.json | 660 | d7b4589e2d63ad41a5968a2899c1c9f3b7493b8c8b2be23bff1e49a3512ed8d3 | mmp115-custody-v1 |
| mmp078-41505679809-attempt.json | 765 | 7d02aee55a7501e22aa188796813a728f21903b8035be4d3ee98596f6a532b7a | absent |

### Projection and validation

`prepare-track-e.py` uses only Python's standard library. It requires the exact
8733-byte ZIP hash and the exact nine member names/lengths/digests **before**
parsing; it rejects duplicate/prototype keys, unsafe field/value categories and
cross-file identity discrepancies. No extraction to arbitrary paths, network,
candidate import/execution or private inputs. The output is deterministic:

```powershell
python research/demo-readiness/prepare-track-e.py research/demo-readiness/provenance/track-e/public-receipts.zip '<scratch output JSON>'
```

Reproduction executed: exit 0, output byte-for-byte equal to
`evidence/real-ai-41505679809/mmp148-track-e-v1.json`, **11960 bytes**, SHA-256
`6442e5e8893cf44ae926d66a92d2fc38cd1ae07230b250b48d8ba2e0db1f237b`.
This is `format=mmp148-public-parity-v1`, scope RECORDED_PUBLIC_MANIFEST. It is a
new **public projection** with a new format, not an original producer receipt.
`research/mmp-137/evidence.json` is not the input and its stale owner-restore
fields are not copied.

| Displayed fact | Original source / derivation |
| --- | --- |
| Run/head/source/context/manifest/request/candidate | generation.authorization + generation identities, trial identities and top-level attempt receipt; cross-linked before projection |
| Model/generation/usage | generation.json: real inference PASS, provider HTTP 200, one request and confirmed response, 6060/9554 tokens, estimate 0.0481795, charged null |
| Aggregate G0–G4 and exact executed IDs | trial.attempts[0].gates; G1 PASS (6), G2 FAIL (17), G3 FAIL (20), G0/G4 INCONCLUSIVE, public runtime IDs 27; held-out NOT_RUN |
| Per-scenario scope | trial.attempts[0].pairs: compilerDiagnostics.g1Verdict PASS for each, public gates/findings and scenario cleanup; no diagnostics text or telemetry payload copied |
| Comparison counts | trial.attempts[0].coverage: HTTP 17/17, SQLite 20/20, executed rather than passing coverage |
| Cleanup / finalizer | trial.cleanup VERIFIED_ZERO_RESOURCES and finalizer.json PASS, 0/0/0 |
| SQLite conclusion | Bounded inference: all 20 G3 IDs executed and no DB_SCHEMA/DB_STATE findings, with the unchanged comparator/aggregator semantics described below |
| Root cause / product | UNCONFIRMED is an explicit limit of categorical evidence; product NOT_ESTABLISHED is copied from trial |

G3 aggregates HTTP and database findings (`packages/oracle/src/runner.ts`,
makeGate G2/G3); SQLite mismatches emit DB_SCHEMA/DB_STATE (`sqlite.ts`). Exact
G2/G3 findings are HTTP_JSON_TYPE in each of three scenarios and aggregate, so
the compared initial/step SQLite snapshots match **within the compared manifest**.
This is a source-backed inference, not new execution, universal business parity,
an independently reported DB defect or proof of the exact JSON field. `jsonDiff`
stops descending at kind mismatch (`http.ts`), so unvisited nested differences
cannot be excluded. These source files were read, never changed.

The browser checks the exact E basename, size and digest on a private memory
copy **before** unchanged bounded `parseStrict`, then an independent exact-field
semantic validator. It binds every displayed identity, status, field allowlist,
executed ID/coverage, per-scenario finding, cost-null, cleanup/finalizer and scope.
Altered bytes fail even if they claim PASS. Direct semantic adversarial tests
also ensure a future reviewed pin move cannot silently relabel this historical
run. Existing A–D pins/adapters/tests remain unchanged. D/E are lone picker
selections; bundled A–E load is atomic, with no fallback to four while claiming
five. Reset clears overview, selected details, matrix, identities, JSON and preview;
the async generation guard remains intact.

SHA matching establishes **identity of this reviewed public snapshot and its
retained public source bytes**, not a new Oracle run, digital executor signature,
independent behavior attestation, current owner restore or product acceptance.
No billing settlement, live job, repair, new model authorization or private G4 is
established. The snapshot ends with the 2 November run; later work is separate.


## F — first real repair, historical public FAIL

**GO source decision: 4 November 2026 (Europe/Bucharest).** This lane is #162,
independent of active #161. Fresh main and execution head both equal
`f034d4dfcc30dcc82300e93002b5a55206c7dc04` at preparation; implementation has its
own branch/head. Read-only GitHub metadata confirmed [run 41726833705](https://github.com/Meta-Project2026/Metamorph/actions/runs/41726833705),
workflow attempt 1, workflow_dispatch, started 2026-11-03T22:00:07Z, completed
2026-11-03T22:05:14Z, conclusion success. **Success is workflow completion only.**

Only the expressly authorized PUBLIC artifact was retrieved:
`meta-paid-public-41726833705`, ID **13274647279**, created 2026-11-03T22:05:10Z,
**28147 bytes**, ZIP SHA-256
`c860c609444d1d591d68dde6531e85b5c95e9f4cc33af1956500315d5f0b4e5d`.
GitHub digest and locally computed digest agree. The connector returned a remote
file reference; read-only `gh api` for the same explicit ID materialized local
bytes. No other artifact was fetched. [Issue #162](https://github.com/Meta-Project2026/Metamorph/issues/162)
and [reporting issue #161](https://github.com/Meta-Project2026/Metamorph/issues/161)
were cross-checked, not used as substitutes for the original receipts.

### Privacy review and immutable source

The original ZIP was hashed before parsing; all **24** member names, sizes,
digests and formats were verified. Object field sets were reviewed first, then
all unique string categories and nested objects: public identity hashes/UUIDs,
model request IDs, usage counts/estimates, run/admission metadata, categorical
findings, empty diagnostics, telemetry stage labels, public comparison/control
IDs, ciphertext custody **hashes/statuses only**, and zero-resource finalizers.
Authorization here is public dispatch metadata, not a bearer token. No raw model
body, generated source, reference HTTP/SQLite body, private observation, private
G4 input, credential, owner key, sensitive absolute path or ciphertext content
was present. `prepare-track-f.py` freezes these reviewed object field sets in
PUBLIC_FIELDS and rejects unknown field sets, duplicate/prototype keys, unsafe
strings/numbers and altered ZIP/member pins. This is a single-snapshot privacy
audit, not permission to retain arbitrary artifacts named PUBLIC.

Retained unchanged: [PUBLIC source ZIP](provenance/track-f/public-receipts.zip).
The archive includes historical inconsistent reports; it is **not** HTTP served.
The browser also cannot fetch either preparation/test Python script. Custody
fields are historical UNVERIFIED source records, not a current restore claim,
and are excluded from the displayed projection. No private candidate*.age ZIP,
diagnostics pack, key or held-out data was retrieved or executed.

### All original members

| Original member | Bytes | SHA-256 | Format |
| --- | --- | --- | --- |
| meta-paid-public/generation.json | 2380 | 0296373d787ea1bb95b5db8e81b61c478a22d33d6ea42b2b63cfd7e9eeb3502b | meta-generation-v1 |
| meta-paid-public/scorecard.json | 2469 | d8a0ad3bae8c413a232c3be1016b2d0860769fa026b9dfd7cd2addb076ce9ea1 | mmp154-generation-scorecard-v1 |
| meta-paid-public/preflight.json | 2402 | 4bbf47a7d319208f8863cfb268421a9ba78a758618c474c7d42bd0917762cb8e | mmp154-generation-preflight-v1 |
| meta-paid-public/send-receipts/1.json | 2158 | f4014b263d9d7c4269c31e7026e468adcc70bb759028eb26247a3a1d189c4fce | meta-generation-v1 |
| meta-paid-public/send-receipts/2.json | 2380 | 0296373d787ea1bb95b5db8e81b61c478a22d33d6ea42b2b63cfd7e9eeb3502b | meta-generation-v1 |
| meta-paid-public/trial.json | 21549 | cd79258c0fd5b2d6f0dddd2fedfb2cd7ef6ba53938f330fe10bf7f03300d73aa | mmp078-public-paid-trial-v1 |
| meta-paid-public/finalizer.json | 165 | e0c05f52968ef1c67906c282be0b1d622d8bfe4becdab4b17d6838aa6aab43eb | absent |
| meta-paid-public/preservation.json | 1020 | 6bd1d91917c8a3339eff13647ce0049a596ce9dd200cdd353cc5ad299dec4658 | mmp097-preservation-v1 |
| meta-paid-public/custody-capture.json | 655 | 2cf99eeb39b5025822338849d5f9848d86760e8d9e58002a715f5ae7bf686ddf | mmp115-custody-v1 |
| meta-paid-public/custody-finalizer.json | 406 | 1669a5e311f7eceb2231ba532ede8b300030483c2e0a14a0de26fd5d64170888 | mmp115-pre-oracle-finalizer-v1 |
| meta-paid-public/custody-checkpoint.json | 663 | da46931ce7eaa93b1e56cb60cfe55cd4c3e2d6df21a954b56b270d75d9180b58 | mmp115-custody-v1 |
| meta-paid-public/custody-stored.json | 660 | 2343e41ee2f50b84da13cf6731a3c9d332c3df5fd8f813132a55db6b12351250 | mmp115-custody-v1 |
| meta-paid-public/preflight-repair.json | 2368 | 939ebd5726441e2a698d4d9540a6fbc1c06c4365a1efe5e9f5a6f78d56ee5e09 | mmp154-repair-preflight-v1 |
| meta-paid-public/generation-repair.json | 2480 | 506501c373697b4cf51c365b14cd09f893ea9aecb21eeb0290a0392bb15a7704 | meta-generation-v1 |
| meta-paid-public/trial-repair.json | 21756 | 9149785b34eace5bba5bb03b753f82545aa47a9c588756344583c27d0b998055 | mmp078-public-repair-trial-v1 |
| meta-paid-public/repair-send-receipts/1.json | 2256 | adc51a1d497d6002143e7137c87ecfe2be2c4454c83aede8b9edd1cbd82892b9 | meta-generation-v1 |
| meta-paid-public/scorecard-repair.json | 2513 | d7c9e37f932e670058e2ab10cad1f2ca20fbdce8ae8ab854a81977d52555733c | mmp154-repair-scorecard-v1 |
| meta-paid-public/repair-send-receipts/2.json | 2480 | 506501c373697b4cf51c365b14cd09f893ea9aecb21eeb0290a0392bb15a7704 | meta-generation-v1 |
| meta-paid-public/custody-repair-capture.json | 655 | 468cd72588a435c1749e40e7a2a821310a397ddf57931520d012bbbde5c980fb | mmp115-custody-v1 |
| meta-paid-public/custody-repair-finalizer.json | 406 | 0b3d8a8f21f81ab40040f9caee6d47dd0cd74fd374bebe4dc7084d79adfa4517 | mmp115-pre-oracle-finalizer-v1 |
| meta-paid-public/custody-repair-checkpoint.json | 663 | 0b54f79292013bc9a5f748d0bc61d7ead92c565dcd342cc9902dd7ce789c494c | mmp115-custody-v1 |
| meta-paid-public/custody-repair-stored.json | 660 | 37a3a0cf06990c64f3bf5cd2424712720372a06bdd9bd118c4de7a58a7a9b0f0 | mmp115-custody-v1 |
| mmp078-41726833705-attempt.json | 976 | 35d97fa725dc6d6d8932d0b55209952a1621849c5620ef86e3ee3bce746924a9 | absent |
| mmp078-41726833705-attempt-2.json | 1070 | f6ef99c7a61250997a9fe7bf5ab1204beffcceeb11ab078b2d629e0fb240031b | absent |

### Deterministic public projection / independent adapter

```powershell
python research/demo-readiness/prepare-track-f.py research/demo-readiness/provenance/track-f/public-receipts.zip '<scratch output JSON>'
python research/demo-readiness/prepare-track-f.test.py
```

Both ran exit 0; two preparations and comparison with the committed projection
were byte-for-byte identical. Versioned output `mmp162-public-repair-v1`, scope
RECORDED_PUBLIC_MANIFEST: **27687 bytes**, SHA-256
`d2bf5aaafea0d7431fee00463ec6cf4c926e24004efb3d97133eee4175ee78d3`.
Python stdlib only, exact fixed input, no extraction, network or source execution.
This is a new, smaller allowlisted projection, not an original producer receipt.

| Projected fact | Original evidence / derivation |
| --- | --- |
| Run / start / workflow conclusion | Independently fetched GitHub run metadata; attempt 1, head f034d4d…, start 22:00:07 UTC / 00:00:07 Kishinev; no individual-attempt clock claim |
| Attempt 1 generate | generation.json linked exactly to trial.json.modelReceipts/budgetAuth, first ledger, preflight request/body and final send-receipts/2.json |
| Attempt 2 repair | generation-repair.json linked exactly to trial-repair.json.modelReceipts/budgetAuth, attempt-2 ledger, repair preflight and repair-send-receipts/2.json |
| Candidate / Oracle binding | Candidate SHA agrees across generation, trial, attempt, compiler identity, telemetry binding and custody identity; custodyLink names that verifier attempt |
| Real feedback → repair | preflight-repair.repairFeedbackCodes=HTTP_JSON_TYPE and firstAttemptCandidateSha bind the first candidate; second authorization repeats it; second request/response/candidate hashes all differ |
| G0–G4 / coverage | Each trial.attempts[0].gates and exact IDs; six build IDs, 17 HTTP, 20 SQLite, 27 public runtime control IDs; G0/G4 INCONCLUSIVE, held-out NOT_RUN |
| Scenario outcome | Each trial pair compiler G1 PASS and gates: business FAIL/FAIL, rejected FAIL/FAIL, capacity PASS/PASS; HTTP counts 6/5/6, SQLite 7/6/7 |
| Generation and usage | Each original generation: REAL_INFERENCE, provider meta-model-api, muse-spark-1.3, 1 confirmed response HTTP200, 6188/10556 and 14148/9179; estimates 0.052598 / 0.05669575; charged null |
| Aggregate usage | Decimal sum of original estimates 0.10929375; 2 confirmed responses; no billing settlement claim |
| Cleanup | Both trial cleanups and all scenario cleanups VERIFIED_ZERO_RESOURCES; pre-Oracle custody finalizers zero; independent finalizer PASS zero |
| Limits | Product NOT_ESTABLISHED copied; exact field/type/root cause UNCONFIRMED, individual step improvements UNKNOWN are evidence limits, not a new execution |

The early `send-receipts/1.json` and `repair-send-receipts/1.json` are preliminary
UNKNOWN-send / zero-confirmed-response records for their respective authorization.
Each final `/2.json` equals its generation receipt; these are **not four model
responses**. Final generation/trial pairs each confirm one response. No retry or
third request is inferred from preliminary journal entries.

### Intermediate report inconsistency is preserved, not repaired here

Initial preflight.maximumPosts=2. Intermediate scorecard.json.maximumPosts=1,
repairs=0 and stopReason=PUBLIC_FAIL_SIGNED_REPAIR_NOT_IMPLEMENTED contradict the
subsequent authenticated repair receipts. They remain untouched in the original
ZIP and are **excluded as session authorities**. Projection.reporting explicitly
marks NONFINAL_INCONSISTENT_EXCLUDED and PER_ATTEMPT_GENERATION_TRIAL. The final
scorecard-repair stopReason COMPLETE_PUBLIC_FAIL_AFTER_SIGNED_REPAIR is copied
only after candidate/request/response and first-candidate links are checked.
#161 owns any production fix. F is immutable historical run 41726833705, even if
#161 later completes. New live evidence requires a separately reviewed pin.

Both attempts have the same published aggregate and per-scenario verdict
pattern; this **does not establish identical individual check outcomes**.
The only published parity failure code is HTTP_JSON_TYPE. G3 includes HTTP
findings (unchanged `packages/oracle/src/runner.ts`); no independent DB defect,
exact field, expected/actual value/type or generated source line is established.
No private pack or candidate diff was inspected.

The browser checks new basename, exact size/hash on a private memory copy,
then unchanged bounded strict parse, then a separate exact semantic validator:
identities/order, model/usage/null charge, all five gates, executed IDs/findings,
per-scenario verdicts, feedback link, reporting basis, cleanup, and scope.
A–E original bytes/pins/adapters/tests are unchanged. Bundled A–F validation is
atomic; D/E/F are lone file selections; missing/corrupt F clears all old results.
Stale fetched/file-read F cannot overwrite a newer failed selection.

Snapshot SHA identity is not a digital executor signature, fresh Oracle run,
current custody/restore proof, owner approval or product PASS. Formal G4 remains
INCONCLUSIVE / held-out NOT_RUN. No new model request, paid admission, workflow
dispatch, candidate execution, Docker, production or shared API change occurred.
