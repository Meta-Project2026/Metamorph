# MMP-061: source-bound model composition, live admission blocked

Refs #61. Base `2a6eef6a583cf981e604d697bc1cb287174a823c` (fresh origin/main,
2026-10-29 Europe/Bucharest). This slice adds an actual pinned-PHP context binding,
strict normalized response codec, source-aware synthetic transport tests and a
production admission CLI. **It does not demonstrate genuine AI migration.**

`MODEL_GENERATION=NOT_RUN`; generated candidate/public G1/G2/G3 NOT_RUN;
G0/G4 INCONCLUSIVE; PRODUCT NOT_ESTABLISHED. The five-route API slice is below the
suggested 10-15 route size. A broader benchmark needs separate versioned selection,
registration and owner review; no frozen original scenario is silently expanded.

## Commands

After the trusted workspace build:

```sh
node --test packages/agent-real/test/migration.test.mjs
node research/mmp-061/demo.mjs none
node research/mmp-061/demo.mjs meta
node research/mmp-061/demo.mjs local
python research/mmp-061/freeze-source.py /path/to/pinned-source.tgz /new/private/output
```

The CLI is an admission diagnostic, exits **2**, sends no requests and creates
no candidate/Docker resources. It has no credential argument, transport injection,
price estimate, force flag or hidden replay fallback. The Python command reads
only the exact admitted archive and emits measured inventory, public source data
and the original MIT notice. It never extracts/executes PHP and refuses a different
archive. It writes to a new output directory; do not commit the downloaded archive.
`public-source.json` is **untouched public PHP source data**, not a model prompt,
response or target fixture; api.php/config.php bytes and the full LICENSE are
verified against inventory. Upstream tests/UI/TS/replay/private records are excluded.

## Scope measured from upstream

- Repository: tanjilaafsarirubina/car-workshop; commit
  `d272170d0aecbd28eb5b13e272d9dd11d545b66c`.
- Archive SHA-256 `32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4`;
  MIT LICENSE SHA-256 `46ef5fb6b330816e097c9e7e16e5a4e6ba8f03c2113a4d97fe8c358f64d629a9`.
- Five own .php files excluding tests/vendor: 831 physical file lines; 439
  nonblank PHP-region lines **including comments**, not a tokenized logical-SLOC
  claim. The two API/model files have 484 physical lines / 424 nonblank PHP-region
  lines. admin.php/index.php are mostly HTML. Eleven named PHP functions, zero
  class declarations; exact file hashes and function line locations in inventory.json.
- Only five action routes: GET get_slots and get_appointments; POST book,
  update_appointment and cancel_appointment at /api.php?action=... .
- Existing MANIFEST is frozen at
  `d800a9a5e874545040438d4dce822da6e0d6b71fb094bcac7f06a6ad05610fd4`:
  workshop-business 6, workshop-rejected 5, workshop-capacity 6 HTTP steps.
  Planned verification is 17 HTTP / 20 initial-plus-post-step full typed SQLite
  states per complete attempt. These are **planned counts**, not new execution.
- Source dependency map: api.php -> config.php -> PDO/PDO_SQLite, date/calendar,
  PCRE, JSON; no composer.json/vendor dependency. SQLite creates mechanics and
  appointments (AUTOINCREMENT/foreign key); sqlite_sequence is part of observed
  state. Exact DDL and five-mechanic seeding come from original config.php, not
  copied target schema or expected snapshots. MySQL fallback exists upstream but
  is excluded from this SQLite slice. Optional config.local.php is not admitted.
- Date/timezone, PHP integer casts/empty/trim/PCRE, PDO result types, transaction
  locking, schema SQL and sequence state are migration risks for the model to
  solve from source. No corrected TypeScript or prior operator answers are fed in.
- Target contract: Node 24.11.0 / TypeScript 5.9.3 / SQLite 3.50.4, strict ES2022
  NodeNext, src/main.ts -> /work/out/main.js, loopback 127.0.0.1:3000, database
  /state/target.sqlite. Only Node built-ins; unchanged trusted Docker recipe,
  256 MiB / 1 CPU / 64 PIDs, 180s worker lifetime, network none.
- UI, static assets, MySQL, concurrent requests, arbitrary actions/query variants
  and unregistered GET filters are unsupported/unmeasured. One agent unit
  `workshop-api` contains all 11 ordered functions; function list is migration
  inventory, not evidence of translated-function coverage.

## Implementation and boundaries

Source context is bound in a trusted closure; ModelRequest is unchanged. It includes
only hash-checked public PHP, MIT notice, ordered source units, route names and the
supported output/runtime contract. Repairs contain the existing fixed public code
allowlist and the previous **same-harness generated** source. No Oracle values,
expected answers, source filesystem path or old TS candidate enters this binding.
The source order and context SHA are reproducible before a trial.

The normalized transport codec validates strict JSON, identity, ModelResponseSchema,
64-file/256-KiB-per-file/1-MiB candidate admission and src/main.ts before writing.
Raw normalized replies are <=1 MiB + 64 KiB and prompts <=128 KiB. Unknown usage
or bound violations stop; malformed/429/5xx/redirect/timeout/abort stop without retry.
The test harness has <=2 calls / <=5s per call, records hashes/IDs/duration/nullable
usage and labels every receipt SYNTHETIC_TRANSPORT_ONLY. It cannot be selected by
the production CLI. Its transport is a normalized **test** seam, not an implemented
Meta HTTP adapter. Transport input/output strings are not written to public logs.

The production selector preserves Meta's unknown bound and explicit refusal. No
new POST transport is activated. Local inference needs the narrow compatibility
proposal below; it cannot be represented as synthetic or by a nominal USD budget.
The public composition contains the existing source-session/RealVerifier lifecycle,
including waitForIdle and finish; its execution branch is deliberately unreachable
until reviewed provider admission and correlated live-receipt handling exist. This
is an integration handoff, not a ready-to-run live backend. Synthetic integration
uses the real runAgent/writer/SHA lease plus an explicitly synthetic verifier.
Partial writes invalidate source admission and never proceed to verification.

Preserve all original controls and known-good/known-bad fixtures. **They were not
rerun as a new model trial.** Do not run the dormant execution branch by modifying
an admission boolean: complete the provider, financial/identity/receipt admission,
predeclared control driver and independent review first. Existing MMP-049 and PR62
receipts are historical only. No old 42/110/152 or 6/34/40 totals are republished as
new measurements. Historical PR31 AUDIT_FAIL, open #34 and #38/#55/#56/#57 remain
separate. No encrypted storage, private G4 or ownership ratification is claimed.

## Proposed next trial (not authorized or executed)

Version mmp061-workshop-api-v1, exact public source/manifest above; one whole-service
unit, spark-only policy label, no escalation/failover, initial generation plus at
most one public-code repair, no automatic retry on ERROR/unknown spend. Proposed
model per-call timeout <=120s and total <=600s require runtime feasibility and
owner confirmation; amount/account/model remain UNSET. Before admission freeze
agent SHA, runtime/model identity, provider-side bound, exact owner budget,
source/context hashes and control schedule. Save every attempt including failures.
Only generated candidates may reach RealVerifier; build/execution only in Docker.
Acceptance requires actual normal cleanup 0 containers/0 volumes/emergencyRemoved=0
and independent source/control/receipt review; emergency cleanup stays ERROR.

See [interface-proposal.md](interface-proposal.md), [validation.md](validation.md)
and the public [evidence-index.json](evidence-index.json). No merge or Issue61
closure is requested; independent ChatGPT review is requested for this bounded,
explicitly incomplete live-adapter handoff.
