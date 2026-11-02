# MMP-137 — Hypothesis matrix: `HTTP_JSON_TYPE` fault localization

**Method.** Only (a) the pinned public PHP source, (b) public PHP 7.4 runtime
documentation/source, (c) the published categorical run receipts, and (d) the
trusted comparator/gate code at head `a01bb65f8bb58c02c7a59e06ffedc9662576478e`
were used. The candidate plaintext was **not** accessed, so every statement
about the candidate is a HYPOTHESIS about its JSON serialization; statements
about the reference and the comparator are CONFIRMED from source. Each
hypothesis is falsifiable as stated.

## 0. The evidence envelope any hypothesis must satisfy

From the published gate results (aggregate and per-scenario, artifact
`meta-paid-public-41505679809` / `trial.json` `mmp078-public-paid-trial-v1`):

- Every one of the 17 HTTP steps executed and each of the three scenarios has
  `HTTP_JSON_TYPE` among its G2 findings; no other finding code exists
  anywhere in the run (G1/G2/G3/G4 clean except `HTTP_JSON_TYPE` /
  `HELD_OUT_NOT_RUN` / `G0_NOT_ESTABLISHED`).
- Per `packages/oracle/src/http.ts` and `runner.ts` this forces: equal status,
  equal `content-type`/`location`/`cache-control`/`allow` headers, valid JSON
  on both sides, equal key sets (`HTTP_JSON_MISSING` absent), equal array
  lengths (`HTTP_JSON_LENGTH` absent), equal values for all same-type leaves
  (`HTTP_JSON_VALUE` absent — every message string, PHP date rendering and
  capacity text matched byte-for-byte at JSON level), and equal SQLite state
  at every snapshot (`DB_SCHEMA`/`DB_STATE` absent from G3, no
  `MISSING_COVERAGE`, all 20 IDs executed).
- Therefore: **on every failing step, the candidate and the reference JSON
  trees were identical in keys, values, shape and status — they differed only
  in the JSON type of one or more nodes.** A hypothesis only needs to identify
  *which* nodes and *which* direction.

Reference type ground truth (PHP 7.4.33, PDO SQLite, `FETCH_ASSOC`):

- `api.php` JSON responses by endpoint (source: pinned `api.php`,
  `config.php`):
  - `get_slots` (business/rejected manifests: absent; capacity step-5): all
    numeric fields explicitly `(int)`-cast (`api.php:67-80`) → JSON numbers;
    `is_full` → JSON boolean; name/specialty/phone/date → strings.
  - `book` success (`api.php:192-196`): `appointment_id` from
    `PDO::lastInsertId()` (`api.php:188`) → JSON **string** (php.net:
    signature `string|false`, "returns a string representing the row ID").
  - `get_appointments` (`api.php:241-244`): raw `fetchAll()` rows encoded
    verbatim → in PHP 7.4 **every non-NULL column is a JSON string** (php-src
    PHP-7.4 `ext/pdo_sqlite/sqlite_statement.c`: `pdo_sqlite_stmt_get_col`
    returns `sqlite3_column_text()` for INTEGER/FLOAT/TEXT via the `default`
    branch; `pdo_sqlite_stmt_describe` maps all storage classes to
    `PDO_PARAM_STR`).
  - `book` validation/duplicate/capacity errors, `update_appointment`,
    `cancel_appointment` responses: only `success` (bool) and string fields —
    no numeric fields at all.
- Seed data (`config.php:105-124`): 5 mechanics, `max_daily_slots=4` → the
  capacity scenario's five bookings against mechanic 1 produce four
  successful inserts (steps 0-3), one `MECHANIC_FULL` (step 4), then
  `get_slots` with `booked_count=4`, `available_slots=0`, `is_full=true`
  (step 5).

Candidate-side ground truth: the target contract is `node:sqlite` under
strict TS (`migration-context.mjs` target block); INTEGER columns surface as
JS `number` (or `bigint` for non-safe values) and `lastInsertRowid` as
`number|bigint`. The context explicitly warns "row values are
string | number | bigint | Uint8Array | null. Validate/narrow values before
typed use; serialize bigint explicitly" — it does **not** state that PHP 7.4
emits them as strings.

## 1. Ranked hypotheses

| # | Rank | Hypothesis (candidate emits…) | Reference emits… | Trigger steps (executedTestIds) | Scenario coverage | Primary source backing |
| --- | --- | --- | --- | --- | --- | --- |
| H1 | **P0** | `appointment_id` as JSON number (or bigint-string mismatch impossible here: bigint would need explicit serialization) | `"appointment_id":"1"` (string) | `workshop-business:step-0`, `workshop-rejected:step-0`, `workshop-capacity:step-0..3` | **all three** | `api.php:188,194`; php.net `PDO::lastInsertId()` → string; `research/mmp-120/source-to-prompt-audit.md:109,137` (pre-registered P0 trap); `research/mmp-123/candidate/src/api.ts:330,351` handled it — but mmp-123's differential never executed |
| H2 | **P0** | `get_appointments` row `id`/`mechanic_id` (any INTEGER column) as JSON number | `"id":"1"`, `"mechanic_id":"1"` (strings) | `workshop-business:step-1`, `:step-3`, `workshop-rejected:step-2`, `:step-4` (business step-5 reads an empty list → no rows, no diff) | business + rejected (not capacity) | `api.php:239-244` raw rows; php-src PHP-7.4 `sqlite_statement.c` stringification; `research/mmp-123/candidate/src/api.ts:409` shows even the in-repo pilot emitted numbers here |
| H3 | P1 | `get_slots` fields as strings (missed `(int)` casts) and/or `is_full` as 0/1 instead of boolean | numbers + boolean (`api.php:67-80`) | `workshop-capacity:step-5` only | capacity only | `api.php:58-88`; casts are highly visible in source, so a model replicating them is likely — hence P1 |
| H4 | P2 | `get_appointments` top-level `appointments` as object keyed by id instead of array (or vice versa) | array of row objects | business/rejected read steps | business + rejected | `api.php:243`; no in-repo signal; natural TS mirrors PHP here |
| H5 | P2 | `success` as 0/1 number instead of boolean on some path | boolean (`json_encode(true/false)`) | any step | all | `api.php` all responses; boolean is natural in TS, so low |

Ruled out **by the published code set** (not by assumption):

- Any status or stable-header difference (`HTTP_STATUS`/`HTTP_HEADER` absent).
- Any body that is not JSON on either side, or non-JSON content-type
  (`HTTP_BODY` absent, no `VERIFIER_ERROR` — both bodies parsed strictly).
- Any missing/extra JSON key (`HTTP_JSON_MISSING` absent) — e.g. a candidate
  dropping `created_at` or adding fields is excluded.
- Any value-level difference in strings/numbers of equal type
  (`HTTP_JSON_VALUE` absent) — this is a strong positive result about the
  candidate: all messages, PHP `date('F j, Y', strtotime(...))` renderings
  ("June 15, 2099"), validation orders and capacity texts were exactly right.
- Any array length difference (`HTTP_JSON_LENGTH` absent).
- Any DB state/schema divergence (`DB_SCHEMA`/`DB_STATE` absent from G3) —
  inserts, updates, deletes, statuses, `created_at` values and seeds were all
  snapshot-identical.
- Verifier/comparator false positive: the comparator is versioned
  (`oracle-exact-v1`), trusted-only, and its own mutant controls
  (`http-type-mutant` family in the acceptance corpus) demonstrate it fires
  `HTTP_JSON_TYPE` exactly on injected type mutants; the pre-scenario
  `runControls()` gate passed.

## 2. Logical relations between the hypotheses

- The scenario-level observation set is: business FAIL, rejected FAIL,
  capacity FAIL, each caused by ≥1 type-diff step.
- **H1 alone is sufficient**: it fires in all three scenarios. It is the
  *unique single-field* explanation.
- **H2 + H3 together are also sufficient** (H2 covers business+rejected, H3
  covers capacity). Under this alternative the candidate *did* handle
  `lastInsertId()` correctly.
- H2 alone or H3 alone is **insufficient** (each leaves one scenario
  unexplained).
- H1 and H2 are independent; both may hold simultaneously, which the evidence
  cannot distinguish from either alone.

## 3. Falsification / discrimination conditions

Each hypothesis is falsifiable without any new paid run:

- **H1 falsified** if the candidate source contains an explicit string
  conversion of the insert id (e.g. `String(lastInsertRowid)`), *and* no other
  capacity-step defect exists. Note: H1-false forces H2∧H3 to hold (or H4/H5)
  for capacity to fail.
- **H2 falsified** if the candidate stringifies all row values (PHP-style)
  before encoding.
- **H3 falsified** if the candidate replicates the `(int)` casts and emits a
  boolean `is_full`.
- **Discriminator available only from gated evidence:** the private per-step
  diff paths (written to the private Oracle evidence packs, e.g.
  `diffs/<step>-http.json` with `Mismatch at /body/appointment_id` style
  messages) would pin the exact fields and steps instantly:
  - type-diff at `/body/appointment_id` on `workshop-capacity:step-0..3`
    confirms H1;
  - type-diff at `/body/appointments/*/id` on `workshop-rejected:step-2`
    confirms H2 (H1 cannot fire there);
  - type-diff at `/body/mechanics/0/is_full` on `workshop-capacity:step-5`
    confirms H3.
  Accessing those files is outside this task's authorization
  (`OWNER_LOCAL_RESTORE_AND_SEPARATE_PERMISSION_REQUIRED` for any candidate
  plaintext; private Oracle evidence is likewise not publishable here).
- A **sanitized candidate-only review** in a separately approved network-off
  sandbox would falsify/confirm H1-H3 by direct source inspection of the
  serialization helpers.

## 4. Prior in-repo art

- `research/mmp-120/source-to-prompt-audit.md:109,137` pre-registered the
  `lastInsertId()` string trap as G2 **P0** with exactly the mechanism and
  emission path described in H1.
- `research/mmp-120/audit.mjs:112` and `research/mmp-120/prompt-proposals.md`
  proposed a prompt clause spelling out the PHP runtime facts
  (`PDO lastInsertId() returns a string`, `(int)` casts, key order, HTTP-200
  errors, `BEGIN IMMEDIATE`); it was **not** merged into the production
  `packages/agent-real/src/migration-context.mjs` used at the paid head.
- `research/mmp-126/03-PHP-TS-FEASIBILITY.md` (independent feasibility review)
  reached the same three runtime facts and noted the offline GLM candidate
  handled `lastInsertId` explicitly.
- `research/mmp-123` — the pilot candidate handled the `appointment_id` trap
  but emitted row values as numbers (`api.ts:409`), and its differential never
  executed (`RESULTS.md:43-44,136-137`: G2 0/17 `MISSING_COVERAGE`, G3 1/20
  `VERIFIER_ERROR`). So no in-repo run has ever validated get_appointments
  row typing against real PHP 7.4 — these traps are validated only by the
  PHP 7.4 runtime semantics cited above.
