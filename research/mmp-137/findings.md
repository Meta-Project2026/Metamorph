# MMP-137 — Offline post-mortem findings: run 41505679809 `HTTP_JSON_TYPE`

**Scope:** research-only, offline, public evidence + public source code only.
No Meta API call, no workflow dispatch, no rerun, no Docker, no age-identity or
candidate-plaintext access. Executor: GLM 5.3 (ZCode), independent review:
ChatGPT. Status of the paid authorization: **consumed; NO RE-RUN of any kind.**

## 1. Exact categorization (acceptance criterion 1)

All items below are CONFIRMED from the published public receipts
(`meta-paid-public` artifact `13169804253`, run metadata API) and from the
current repository code at the exact paid-run head.

- Paid run `41505679809`, attempt 1, workflow `Meta paid migration`
  (`workflow_dispatch`, actor `barbalatv`), conclusion `failure`, head
  `a01bb65f8bb58c02c7a59e06ffedc9662576478e`. As of 2026-11-02 the latest
  `origin/main` equals that same SHA — the paid-run base is still current.
- Exactly one REAL_INFERENCE generation: provider HTTP 200,
  `attemptedRequests=1`, `confirmedResponseCount=1`, model
  `muse-spark-1.3`, input 6060 / output 9554 / cached 0 tokens, request body
  SHA-256 `d0e5c872a735ca5a039820147177f9eb2d2a2da4f9d0b6f5a93180f66dd7da46`,
  admitted candidate SHA-256
  `6140dbed4afb0d2068db17facb0e14ff9c2ffb61aaaf2b64207b9a8aa2125d38`.
  Rate-based estimate $0.0481795 (tariff `meta-standard-2026-10-29`);
  `chargedCostUsd=null`; actual billing settlement UNKNOWN.
- **G1 PASS** — 6 typecheck/build test IDs (typecheck+build × 3 scenarios).
- **G2 FAIL** — all 17 public HTTP steps executed
  (`workshop-business` 6, `workshop-rejected` 5, `workshop-capacity` 6),
  `findingCodes` exactly `["HTTP_JSON_TYPE"]`.
- **G3 FAIL** — all 20 public combined IDs executed (3 × `initial` + 17
  steps), `findingCodes` exactly `["HTTP_JSON_TYPE"]` in each of the three
  per-scenario pair gates as well as the aggregate.
- **G0 INCONCLUSIVE, G4 INCONCLUSIVE** (`HELD_OUT_NOT_RUN`),
  `product: NOT_ESTABLISHED`. No held-out G4 ran.
- Failure occurred at the `Independent Docker Oracle` step only; generation,
  trusted build, pre-Oracle crypto, upload and both finalizers succeeded
  (post-Oracle finalizer PASS, 0 containers / 0 volumes / 0 emergency removed).

## 2. Where `HTTP_JSON_TYPE` is emitted, and what the published codes prove

The production Oracle HTTP comparator is
`packages/oracle/src/http.ts`. `compareHttp()` first compares status and the
four `STABLE_HEADERS` (content-type, location, cache-control, allow), then —
only when **both** content-types are JSON — parses both bodies with a strict
parser (rejects duplicate keys and precision-losing numbers, `http.ts:65-101`)
and runs a structural `jsonDiff` (`http.ts:137-172`). `HTTP_JSON_TYPE` is
pushed at exactly one place (`http.ts:143-144`): when two JSON nodes at the
same path have **different kinds** under `kind()` (`http.ts:118-121`): one of
`null`, `array`, `object`, `string`, `number`, `boolean`. When kinds differ the
walk does not descend into that node, but sibling keys are still compared.

The published evidence is categorical, but it is highly constraining **only on visited comparison paths**. Because
`G2 findingCodes == ["HTTP_JSON_TYPE"]` and nothing else appears anywhere in
the run's public gate results:

| Absent code | Forced conclusion (per `http.ts`/`runner.ts` code) |
| --- | --- |
| `HTTP_STATUS`, `HTTP_HEADER` | status and all 4 stable headers matched on every step, on both sides |
| `HTTP_BODY` | no unequal non-JSON bodies. Steps that emit `HTTP_JSON_TYPE` necessarily have parseable JSON on both sides; other steps may be JSON or equal non-JSON bodies |
| `HTTP_JSON_MISSING` | identical keys at **object nodes visited** by the comparator; no conclusion for descendants of a node where kinds differ (`http.ts:143-144` short-circuits) |
| `HTTP_JSON_VALUE` | same-kind scalar leaves **visited** by the comparator have equal values; a message or date string hidden under a mismatched-type parent is not checked |
| `HTTP_JSON_LENGTH` | equal lengths at **array nodes visited** on both sides; array descendants under a type mismatch are not inspected |
| (verdict FAIL, not ERROR) | no `VERIFIER_ERROR`; JSON bodies reached by parsing were accepted by the strict parser |

For G3, `runner.ts:467-473` builds the gate from
`[...httpFindings, ...dbFindings]`. DB-side comparison can only emit
`DB_SCHEMA` (`sqlite.ts:221`) or `DB_STATE` (`sqlite.ts:223`). Neither appears
in the published G3 codes, and `MISSING_COVERAGE` is absent while all 20 IDs
executed (`runner.ts:281` would skip steps after a mismatched initial
snapshot). Therefore:

> **CONFIRMED within the published manifest:** all compared initial and
> post-step SQLite snapshots matched the reference exactly in all three
> scenarios, and the only **emitted** HTTP mismatch class was JSON *type*.
> This is strong tested-state parity, not proof of all possible business behavior
> or of equality within JSON subtrees the comparator skipped after a type
> mismatch.**

This also refines issue #137's caution: the shared G3 failure code is not
merely "the same HTTP classification" — the published code set establishes
equality of all **compared** initial/step SQLite snapshots for this manifest
(DB findings would have added `DB_*` codes).

## 3. Where the type divergence must live (source-backed)

The candidate was generated from the exact pinned public source
(`api.php` + `config.php` @ `tanjilaafsarirubina/car-workshop`
`d272170d0aecbd28eb5b13e272d9dd11d545b66c`, both files independently
re-fetched and SHA-256-verified against `research/mmp-061/inventory.json`:
`7d66dc6a…` and `11216d30…`). The reference runtime is PHP 7.4.33 with PDO
SQLite (`config.php:50-53`, `PDO::ATTR_DEFAULT_FETCH_MODE => FETCH_ASSOC`).

Two PHP 7.4 runtime facts (verified against public php-src/php.net, see
[hypothesis-matrix.md](hypothesis-matrix.md) for citations) determine the
reference JSON types:

1. **PDO SQLite returns every non-NULL column value as a PHP string** in 7.4 —
   `pdo_sqlite_stmt_get_col` converts INTEGER/FLOAT/TEXT columns via
   `sqlite3_column_text()` and `pdo_sqlite_stmt_describe` maps every type to
   `PDO_PARAM_STR` (ext/pdo_sqlite/sqlite_statement.c, PHP-7.4 branch).
2. **`PDO::lastInsertId()` returns a string** (php.net signature
   `string|false`).

Consequently the reference emits, among others:

- `book` success: `"appointment_id":"1"` — a JSON **string**
  (`api.php:188,194`).
- `get_appointments` rows: raw `fetchAll()` rows JSON-encoded verbatim
  (`api.php:239-244`) → every column value is a JSON **string**, including
  `"id":"1"`, `"mechanic_id":"1"`.
- `get_slots`: explicit `(int)` casts and boolean `is_full` (`api.php:67-80`)
  → JSON **numbers and booleans** (casts override the string fetch).

A natural `node:sqlite` TypeScript service gets INTEGER columns as JS numbers
and `lastInsertRowid` as number/bigint, so the two first bullets are exactly
where a faithful-looking TS implementation type-diverges while remaining
state-correct — matching the confirmed evidence envelope in §2.

Notable negative result: status and stable headers matched for every
tested response, and compared SQLite snapshots matched. No non-type HTTP
findings were emitted, so *visited* JSON object keys, array lengths and
same-kind leaf values also matched. But `jsonDiff` does **not** traverse
descendants after a kind mismatch: unvisited nested keys, messages, dates or
values may still differ. The specific type mismatch (number/string, boolean/
number, object/string, etc.) cannot be recovered from the categorical code
alone. Numeric/boolean-vs-string typing is a source-backed **hypothesis**, not
a confirmed exclusive defect surface.

## 4. Ranked falsifiable hypotheses (summary)

Full matrix with per-step trigger maps and falsification conditions:
[hypothesis-matrix.md](hypothesis-matrix.md). Summary:

- **H1 (P0, parsimonious single-field explanation):** candidate emitted
  `appointment_id` as a JSON number instead of the PHP string. Fires at least
  once in **every** scenario (`workshop-business:step-0`,
  `workshop-rejected:step-0`, `workshop-capacity:step-0..3`; the capacity
  step-4 booking is `MECHANIC_FULL` and carries no `appointment_id`). Already
  identified as the top G2 trap by in-repo research
  (`research/mmp-120/source-to-prompt-audit.md:109,137`).
- **H2 (P0, broad but not capacity-covering):** candidate emitted
  `get_appointments` row `id`/`mechanic_id` (and any other row values) as JSON
  numbers instead of PHP strings. Fires in business steps-1/3 (step-5 reads an
  empty list after the cancel) and rejected steps-2/4; cannot explain capacity
  on its own.
- **H3 (P1):** candidate emitted `get_slots` fields as strings (missed
  `(int)` casts) or `is_full` as 0/1 instead of boolean. Fires only at
  `workshop-capacity:step-5` (the manifest's only `get_slots` call).
- H1 is **one minimal** hypothesis: a single field defect that could explain
  all three scenario failures. It is **not unique**: a `success` boolean-vs-number
  type defect across all three booking paths (H5) is another possible
  single-field explanation. H2+H3 jointly also explain the observation set.
  Both are consistent with every published code; discriminating between them
  requires the per-step diff paths (private Oracle evidence, access gated) or
  a separately authorized sanitized candidate review. No hypothesis is
  confirmed against the actual candidate bytes, and none is claimed to be.

The production prompt context at the paid head
(`packages/agent-real/src/migration-context.mjs:47-48`) says "Preserve … PHP
value/date semantics" but does **not** state the two PHP 7.4 runtime facts
above; the clause that states them exists only in a research driver
(`research/mmp-120/audit.mjs:112`) and was never merged into production. The
offline mmp-123 pilot candidate knew the `lastInsertId` trap
(`research/mmp-123/candidate/src/api.ts:330,351`) but emitted row values as
numbers (`api.ts:409`) — and its differential scenarios never actually
executed (`research/mmp-123/RESULTS.md:43-44,136-137`), so nothing in-repo
ever validated these typings against real PHP 7.4. The traps are
model-knowledge-dependent, not contract violations.

## 5. Status distinctions (acceptance criterion 3)

- **Custody (pre-Oracle):** `custody-stored.json`:
  `state=STORED_UNVERIFIED`, `verification=UNVERIFIED`,
  `storage=ACKNOWLEDGED_RETRIEVED`; artifact `13169609004`, ciphertext
  SHA-256 `1afcc2a0…c997cb`, 31094 bytes; independently rehashed by the
  reviewer against the receipt — exact match. This proves stored ciphertext
  integrity, **not** decryptability or correctness of the plaintext.
- **Product validation:** G1 PASS, G2 FAIL, G3 FAIL, G4 NOT_RUN/INCONCLUSIVE,
  **PRODUCT_NOT_ESTABLISHED** (issue #61 stays open). The candidate is a
  failed product attempt with matching tested SQLite snapshots; the
  number and location of HTTP defects remain unknown until private per-step
  diff paths or separately authorized candidate source review are available.
  Do not claim it is exactly one fix away from parity.
- **Owner restore:** `OWNER_RESTORE_PASS` is **NOT_RUN**. The owner-reported
  recipient MATCH (#136) proves key possession, not restore. See
  [owner-restore-gate.md](owner-restore-gate.md).
- **Preservation (post-Oracle diagnostics):** `preservation.json`:
  `PRESERVED`, case `G1_PASS_COMPLETED`, upload `SUCCEEDED`, artifact
  `13171510338`, ciphertext SHA-256 `32f2d53f…eb9ff8`, 30571 bytes, pinned
  age v1.3.2 (`eb7dd1b5…`). Independently rehashed — exact match.
- Both artifacts are GitHub-public-downloadable and expire around
  **2026-11-09 19:00 UTC**. Owner should retain ciphertext + public receipts
  locally before expiry; downloading is not decrypting.
- Issues: #116 closed as a consumed one-POST authorization (failed product
  outcome); #115 open pending owner restore/operational acceptance; #61 open.

## 6. What would advance this work — all behind separate gates

1. **Owner restore gate (no agent involvement):** run the reviewed owner-local
   `packages/agent-real/src/custody-restore.mjs` on a trusted Linux/WSL
   machine against artifact `13169609004` + public `custody-stored.json`,
   pinned age v1.3.2; report categorical PASS/FAIL only.
2. **Sanitized candidate-only review:** a separately authorized,
   network-off sandbox review of the decrypted candidate as untrusted data
   would immediately confirm or falsify H1/H2/H3. This task explicitly stops
   at `OWNER_LOCAL_RESTORE_AND_SEPARATE_PERMISSION_REQUIRED`.
3. **Any fix path is a separate decision gate:** the production repair
   mechanism (attempt-2 `repair` with `repairCodes`,
   `migration-context.mjs:114-140`) requires another paid provider POST — not
   authorized. A prompt-context amendment (adding the PHP runtime facts) or a
   manual candidate patch are production changes requiring fresh owner
   decisions. No synthetic replay may be reported as real parity.
