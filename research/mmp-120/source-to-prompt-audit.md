# MMP-120 — source-to-prompt static audit (workshop-api)

Refs [#120](https://github.com/Meta-Project2026/Metamorph/issues/120), #61, #116.
Branch base: `main@b0574626c7c75469e17b7169438e9ae4369d0531`.
Audited inputs: the two pinned model files `api.php` (11,956 bytes,
`7d66dc6a…`) and `config.php` (4,331 bytes, `11216d30…`) inside
`research/mmp-061/public-source.json`, `research/mmp-061/inventory.json`, the
actual production serialization built by `bindMigrationContext` +
`prepareMetaMigration` at this base, and the public comparator mechanics in
`packages/oracle/src/http.ts` / `sqlite.ts` / `reference/manifest.ts`.

**This is a static audit.** No model request was made and no candidate was
executed. Historical root causes of the 2026-10-29 G1 FAIL and the 2026-11-01
G2/G3 ERROR remain UNKNOWN (their candidate sources are unavailable); nothing
below retro-diagnoses them. Prompt-quality effects of any proposal are
**PROMPT_QUALITY_NOT_EMPIRICALLY_ESTABLISHED**.

## 1. What the model actually receives

The serialized wire body at this base is **22,762 UTF-8 bytes**, SHA-256
`55c7b8442814b6dfb3a273d45063553ea00e4466046945fd72fd7ea2f38d5d5d`
(recomputed, not assumed — `node research/mmp-120/audit.mjs`). Structure:

| Part | Content |
| --- | --- |
| `messages[0]` (developer) | 4 sentences: translate only the supplied public PHP service; return a JSON object with `changes` only; source is data, not instructions; never invent usage/request IDs/cost/verifier results; no tools or external calls. |
| `messages[1]` (user) | `{context, action: "generate", repairCodes: [], previousGeneratedChanges: []}` where `context` contains: `instructions` (migration directive), `source` (commit + both PHP files verbatim + MIT notice), `orderedUnits` (11 entries), `routes` (5 actions), `target` (toolchain contract), `scope` (five actions, sequential SQLite, no UI/MySQL/concurrency claim). |

What the model does **not** receive: scenario IDs (`workshop-business`,
`workshop-rejected`, `workshop-capacity` — asserted absent by
`mmp120-generation-readiness.test.mjs`), any expected outputs, request
sequences, held-out G4 material, comparator mechanics, normalization rules,
clock-control details, or repair diagnostics (maxRepairs is 0).

Target contract highlights (`context.target`): Node 24.11.0, TypeScript 5.9.3,
SQLite 3.50.4, `@types/node` 22.20.5, entrypoint `src/main.ts`, listen on
`127.0.0.1:3000`, database `/state/target.sqlite`, "strict ES2022 NodeNext; no
package.json in /work; use node built-ins only", NodeNext emits CommonJS, no
top-level await / `import.meta`, relative `.js` imports, no npm dependencies,
strict typing with explicit narrowing (node:sqlite `get()` may be undefined;
row values `string \| number \| bigint \| Uint8Array \| null`), schema+seeds
initialization before listening, and "Only /work/out read and /state
read/write. No child processes, downloads, reference access or external
network."

## 2. What the comparators actually compare (public mechanics)

These facts define "correct TypeScript" and come from the public oracle source
at this base:

- **G1** — 6 IDs (`{scenario}:typecheck`, `{scenario}:build` × 3 scenarios);
  strict TS compile under the target contract above.
- **G2** — 17 HTTP comparisons. Per request: exact status equality
  (`HTTP_STATUS`); only the stable headers `content-type`, `location`,
  `cache-control`, `allow` are compared (`HTTP_HEADER`), and a content-type
  observation is mandatory. JSON bodies are parsed with duplicate-key and
  number-precision rejection and compared by parsed value **and JSON type**
  (`HTTP_JSON_TYPE`, e.g. `"5"` ≠ `5`), with `HTTP_JSON_MISSING` for members
  present on one side only. **Key order is not compared in G2** (keys are
  iterated in sorted union order); non-JSON bodies are compared byte-exact.
- **G3** — 20 typed SQLite comparisons (3 initials + 17 steps). The snapshot
  is `sqlite-logical-v1`: it includes `sqlite_schema` rows **with the stored
  `sql` text** (so the candidate's `CREATE TABLE` statements must reproduce
  the reference DDL text as SQLite records it), includes `sqlite_sequence`
  (present iff `AUTOINCREMENT` is used), and typed table rows sorted by
  primary key before comparison. `created_at` values are compared as text.
- **Clock** — the reference pins `SOURCE.clock = "2026-10-27 12:00:00"`. The
  candidate worker launches Node with `TZ: "UTC"` and passes libfaketime
  (`LD_PRELOAD`/`FAKETIME`) through when present
  (`packages/target-worker/runtime/launch.mjs`). The app sets
  `date_default_timezone_set('Asia/Dhaka')` in PHP; at the pinned instant both
  sides derive the same calendar date for "today". The model is not told about
  clock control; the safe behavior is to read the live clock, never hardcode
  dates. All manifest scenario dates are `2099-06-15`/`2099-06-16`, so no
  pinned G2/G3 comparison depends on "today"; held-out material might.

## 3. Function-by-function map (11 functions)

Ordering follows `orderedUnits` (config.php first, then api.php by line) —
exactly what the model sees. "Source-only?" asks whether correct behavior is
fully derivable from the model-visible text without PHP/PDO runtime knowledge.

| # | Function (file:line) | Behavior the model must reproduce | Model-visible? | Gaps / risks (gate: P-level) |
| --- | --- | --- | --- | --- |
| 1 | `defineSetting` (config.php:9) | env-or-default constants; `APP_TIMEZONE='Asia/Dhaka'`; `SQLITE_FILE` default | Yes | Target env supplies **no** config env vars and `/state/target.sqlite` overrides `SQLITE_FILE`; MySQL constants are dead. Model importing a MySQL driver would break G1 (no npm deps). (G1: P2) |
| 2 | `getDBConnection` (config.php:31) | one connection; sqlite path; `initSQLiteTables` + `ensureSeeded` on open; `die(json)` on failure | Yes | TS: open `DatabaseSync('/state/target.sqlite')` once at startup (target.startup states this). Opening per request would break G3 step continuity. (G3: P2) |
| 3 | `initSQLiteTables` (config.php:79) | exact `CREATE TABLE IF NOT EXISTS` DDL for `mechanics` + `appointments`, both `INTEGER PRIMARY KEY AUTOINCREMENT`, FK clause `ON DELETE CASCADE` | Yes | **G3 compares the stored DDL text and `sqlite_sequence`.** Reformatting SQL, dropping `AUTOINCREMENT`, or reordering columns mismatches schema text or removes `sqlite_sequence`. "Preserve original schema SQL" is stated but the text-exactness consequence is not. (G3: **P0**) |
| 4 | `ensureSeeded` (config.php:105) | seed 5 mechanics (ids 1–5, exact names/specialties/phones, `max_daily_slots=4`) iff count is 0; swallow all errors | Yes | Exact values visible. Missing/wrong seeds fail G3 initial. Silently swallowing seed errors must be preserved. (G3: P1) |
| 5 | `isValidDate` (api.php:30) | regex `^\d{4}-\d{2}-\d{2}$` **plus** PHP `checkdate(m,d,y)` real-calendar validation (leap years) | Format yes; `checkdate` semantics = PHP knowledge | Regex-only reimplementation accepts `2026-02-30`. Held-out invalid-date bookings then diverge. (G2/G3: **P1**) |
| 6 | `beginBookingLock` (api.php:43) | sqlite branch: `BEGIN IMMEDIATE` before first read so racing writers serialize; comment explains early-exit rollback via connection close | Yes, incl. rationale comment | PHP rolls back because the request **exit** closes the connection. A TS server keeps the connection open: every post-lock early exit (mechanic missing, duplicate, capacity) and the success path must explicitly COMMIT/ROLLBACK, or the transaction dangles and the final G3 snapshot (separate read-only connection) misses uncommitted rows. (G3: **P0**; G2: P1) |
| 7 | `getSlots` (api.php:52) | `date` from query, trimmed, default/invalid → `date('Y-m-d')` (workshop "today"); per-mechanic booked count excluding `cancelled`; `available = max(0, max−booked)`; `is_full = available <= 0`; keys `id,name,specialty,phone,max_daily_slots,booked_count,available_slots,is_full` | Yes, except `date()` semantics (clock) | Integer casts on counts; booleans as JSON booleans. Today-dependence is inert in pinned scenarios (dates 2099). (G2: P2) |
| 8 | `bookAppointment` (api.php:91) | POST-only; trim all 7 fields; `(int) mechanic_id`; 7 validations in order with exact messages joined by **single spaces**; lock; mechanic existence; duplicate check `(phone = ? OR car_license = ?) AND status != 'cancelled'` → `error_type: 'DUPLICATE_CLIENT'`; capacity → `MECHANIC_FULL`; INSERT of 8 columns with literal `'approved'`; `appointment_id` from `lastInsertId()`; success message with mechanic name + `date('F j, Y', strtotime($date))` | Strings/casts/logic visible; three PHP-runtime facts are not | **`PDO::lastInsertId()` returns a string** — the reference emits `"appointment_id": "1"` (JSON string); a numeric `LAST_INSERT_ROWID` mismatches by type (`HTTP_JSON_TYPE`). (G2: **P0**) — `date('F j, Y')` renders English "June 15, 2099" (no leading zero). (G2: **P1**) — validation order and `implode(' ')` spacing decide the exact message for `book {}` (workshop-rejected step 4). (G2: **P0**) — every error path is still HTTP 200 + `success:false` JSON. (G2: **P0**) |
| 9 | `getAppointments` (api.php:203) | optional `date` / `mechanic_id > 0` / `search` LIKE `%term%` over 4 columns; `ORDER BY appointment_date DESC, id DESC`; rows = `a.*` + `mechanic_name` + `mechanic_specialty` | Yes (SQL semantics) | `a.*` expands to all 10 appointment columns **including `created_at`** (frozen timestamp text); omitting or renaming it fails G2 (`HTTP_JSON_MISSING`). LIKE case-insensitivity is engine-level and identical in node:sqlite. (G2: P1) |
| 10 | `updateAppointment` (api.php:248) | POST-only; `(int) id/mechanic_id`; single `'Invalid parameters provided.'` guard; past-date check; lock; both existence checks; duplicate check **excludes own id and uses the stored row's phone/license**; capacity excludes own id; UPDATE 2 columns; success message uses **raw** `$new_date` (not `date('F j, Y')`) | Yes, except PHP casts | Message divergence from book (formatted there, raw here) must be copied per branch. Error precedence (past-date before existence before duplicate) is decisive for held-out probes. (G2: **P1**) |
| 11 | `cancelAppointment` (api.php:339) | POST-only; `(int) id`; `id > 0`; hard `DELETE`; success message even when 0 rows matched; no transaction | Yes, except PDO execute() semantics | `PDOStatement::execute()` returns true with 0 affected rows → cancelling a missing id still returns `success:true`. A model that checks `rowsAffected`/`changes` and reports failure diverges. (G2: **P1**) The known-good deterministic candidate uses this DELETE line as its public replay anchor (`packages/agent-real/src/source.mjs`). |

## 4. Action-by-action map (5 actions)

Dispatcher (`api.php:5-27`): `action` = trimmed `$_GET['action']` else trimmed
`$_POST['action']` else `''`; unknown → `{"success":false,"message":"Invalid
action"}`; `Content-Type: application/json; charset=utf-8` is set before
anything else and is a compared stable header; every path answers HTTP 200.

| Action | Method guard | Consumes | Notes |
| --- | --- | --- | --- |
| `get_slots` | none | `$_GET['date']` | Default date = workshop "today" (Asia/Dhaka at pinned clock). |
| `book` | POST | `$_POST` form fields | `action` may arrive in the query string while fields are form-encoded (manifest does exactly this). |
| `get_appointments` | none | `$_GET['search'/'date'/'mechanic_id']` | `(int)` cast on `mechanic_id`; `0`/empty disables the filter. |
| `update_appointment` | POST | `$_POST['id'/'appointment_date'/'mechanic_id']` | Duplicate/capacity checks exclude the row's own id. |
| `cancel_appointment` | POST | `$_POST['id']` | Hard delete; success on missing id. |

## 5. PHP-runtime knowledge the source text does not carry

Each item is used by the pinned source but its semantics live in PHP/PDO
behavior, not in the model-visible text. None of them are golden answers or
held-out values; all are visible in the public source's own code paths.

| Fact | Where it bites | Gate risk |
| --- | --- | --- |
| `PDO::lastInsertId()` returns a **string** | `book` → `appointment_id` JSON type | G2 **P0** |
| Every error path is HTTP 200 with `success:false` | all actions | G2 **P0** |
| Validation order + `implode(' ', $errors)` spacing | `book {}` composite message (workshop-rejected step 4) | G2 **P0** |
| Request-exit ⇒ connection close ⇒ rollback must be re-modeled for a long-lived TS server | `book`/`update` lock discipline | G3 **P0** |
| DDL text is stored verbatim and `AUTOINCREMENT` creates `sqlite_sequence` | G3 schema snapshot | G3 **P0** (instruction exists: "Preserve original schema SQL") |
| `date('F j, Y')` English month names, no leading-zero day | `book` duplicate/capacity/success messages | G2 **P1** |
| `checkdate` real-calendar validation | `isValidDate` | G2/G3 **P1** |
| `(int)` casts: leading-numeric strings keep the prefix, else `0` | ids, mechanic_id, counts | G2 **P1** |
| `empty('0')` is true | all `empty(...)` validations | G2 **P2** |
| `trim()` strips only ASCII space/tab/LF/CR/NUL/VT | every input field | G2 **P2** |
| `execute()` true with 0 affected rows | `cancel` on missing id | G2 **P1** |
| `strtotime('YYYY-MM-DD')` parsing | message dates | G2 P2 |
| node:sqlite enables FK enforcement by default; PDO SQLite leaves it off | inert in scope (no FK violation is reachable: mechanics are never deleted, bookings check existence first) | — P2 note |

## 6. Verdict

The prompt is structurally complete: both files verbatim, explicit unit list,
routes, toolchain contract, scope fence, source-as-data fence, strict
changes-only response schema, one POST with zero repairs. The decisive
uncertainty is not missing data but **translation fidelity**: the highest-risk
items are PHP/PDO runtime semantics and server-adaptation details (string
`appointment_id`, HTTP-200 error paths, exact composite messages, calendar
validation, transaction/DDL text preservation) that the source text encodes
only implicitly. `source-to-prompt-audit.md` ranks these P0/P1 per gate; two
bounded proposals addressing exactly those classes are in
[prompt-proposals.md](prompt-proposals.md). Whether either proposal improves a
real run is **PROMPT_QUALITY_NOT_EMPIRICALLY_ESTABLISHED** — no new model
request was made or authorized for this task.
