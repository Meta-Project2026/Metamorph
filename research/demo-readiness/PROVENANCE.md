# Public snapshots and receipt trust

MMP-085 adds C independently of historical A/B below. The five original historical
files, pins.mjs, adapter.mjs and demo.test.mjs are byte-identical to the base.
C is a review candidate; independent ChatGPT review is pending.

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

Original compiler diagnostics UNKNOWN. Three distinct evidence identities:

| Concept | Run / execution head | Candidate SHA |
| --- | --- | --- |
| Historical #70 deterministic known-good / scripted repair | `40793819074` / `6ab6e36f813673756af157bc0de2265964c26071` | `34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334` |
| Historical deliberate mutation | same historical #70 run/head | `1fd6c3547691a2593a58932e78946a8338061ec07cc46f9fb5b9422825591121` |
| Actual MMP-081 model generation / G1 FAIL | `40900698372` / `d21376747c7147043ca618e149fac87c0df80111` | `afd9f726bcbc2a9dfc2f67128871db307fbd00f2ba4febdc41b5633da98dad8f` |
| MMP-082 synthetic compiler diagnostic control (not ingested by viewer) | `40926137817` / `c1fc7183d3ea6388c122b1885aed80f1cc0e7bf0` | `47bc850883ded819c2092fac18743e404c85c581b639cf789e4a572db370d4e2` |

Synthetic identity read from `research/mmp-082/evidence/40926137817/compiler-control.json`
at the MMP-085 base. Its real Docker TS2322 diagnostic is for synthetic input and
must never appear as the actual MMP-081 compiler error. No diagnostics are added
to original C receipts. Public pack IDs/hashes are references only; private packs
were not retrieved or independently validated. Historical PR #31 AUDIT_FAIL stays
unchanged. Exact-byte identity, code review, owner approval and product acceptance
remain separate facts.
