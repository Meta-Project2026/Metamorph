# Public snapshot and receipt trust

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
the five allowlisted basenames together, or a single `future-model.json` preview.
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
