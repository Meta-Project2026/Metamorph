# car-workshop reference behavior contract v1

Scope: immutable public MANIFEST, sequential SQLite profile only. Refs19.
Source inspection and two real full PHP replay passes completed at
`1a4fca019e0a32c98549eccef22b9834d1e5305e` in manual run40563424187.
The structural corpus records that exact historical HEAD. Below, source-only
branches are distinguished from measured scenario observations. No TS parity.

## Normative provenance and requests — source inspected

Upstream MIT car-workshop d272170d0aecbd28eb5b13e272d9dd11d545b66c;
api.php SHA7d66dc6ad489972a00c6b93619c13024ea3f6d577206579bc2e97f58cf74fd77;
config.php SHA11216d306900f8a2e304908cebab52b9375cba83c1ead99a90278ec14b2c21bd.
Full archive/license/base/initial pins are immutable SOURCE; manifest SHA
d800a9a5e874545040438d4dce822da6e0d6b71fb094bcac7f06a6ad05610fd4.

Exact normative requests are the existing immutable
[manifest.ts](../../packages/oracle/src/reference/manifest.ts). No copied or
expanded scenario corpus is authoritative. Each worker receives exactly
MANIFEST.map(s => s.id), once per pass. Each scenario begins with a clean reset
and separate service GET `/api.php?action=get_slots&date=2099-06-15` bootstrap.

POST MIME is exactly `application/x-www-form-urlencoded`; bodies are the exact
UTF8 bytes of URLSearchParams(form).toString(), no trailing newline. Spaces encode
as `+`, literal plus as `%2B`, insertion order stays unchanged. Empty book body is
zero bytes, not `{}`. GET has no body/form MIME. All routes include the literal
`.php`; action stays in the query, with `action` before `date` for get_slots.

Booking form key order: client_name,address,phone,car_license,car_engine,
appointment_date,mechanic_id. Normative input values are the original public
manifest fixture; personal-looking strings are not recopied into this contract.
Update exact bytes: `id=1&appointment_date=2099-06-16&mechanic_id=2`.
Cancel exact bytes: `id=1`. Request SHA per step in the corpus binds every booking
byte, including synthetic values/encoding, without republishing them.

| Scenario | Exact ordered action sequence | Business count |
|---|---|---:|
| workshop-business | POST book(1); GET get_appointments; POST update_appointment; GET get_appointments; POST cancel_appointment; GET get_appointments |6|
| workshop-rejected | POST book(1); identical POST book(1); GET get_appointments; POST book(empty); GET get_appointments |5|
| workshop-capacity | POST book(1)..book(5); GET get_slots&date=2099-06-15 |6|

IDs restart step-01 within each scenario. Two full passes mean6 resets,34 business
HTTP,6 bootstrap HTTP. The final capacity GET has the same bytes as bootstrap but
is a distinct declared business step; do not subtract it from17.

## Business semantics — source inspected

All actions declare JSON UTF8 content-type. API dispatch checks trimmed query
action before POST action. Booking/update/cancel reject non-POST in JSON; actual
statuses/shapes must be taken from the measured corpus, not conventional REST
expectations. The source does not assign special HTTP status codes for business
errors. UI endpoints/static assets/MySQL profile are outside this qualification.

Booking trims inputs; validates required fields, phone/engine formats, valid
non-past date and positive mechanic ID. Under BEGIN IMMEDIATE it checks mechanic
existence, non-cancelled duplicate by date AND (phone OR license), then capacity.
Duplicate takes precedence over capacity. Successful insert sets approved status,
returns lastInsertId and commits; early rejection exits and rolls back on close.
Empty form emits a combined validation message without error_type.

Appointments are an inner join with mechanic name/specialty ordered by date DESC,
then ID DESC. Existing manifest does not exercise filtering/search or multi-row
list ordering; those are source-only, NOT_RUN edge cases. Update validates date,
ID and mechanic, locks, rechecks duplicate/capacity excluding its own ID and only
changes appointment_date/mechanic_id. Cancel physically DELETEs; it does not mark
cancelled status. sqlite_sequence must survive that delete. Slots count only
non-cancelled bookings for requested date, clamp available slots at0 and derive
is_full; the fifth booking for mechanic1 exceeds its configured capacity4.

## State and time — source inspected

Mechanics: id INTEGER AUTOINCREMENT PK; name/specialty/phone TEXT NOT NULL;
max_daily_slots INTEGER NOT NULL DEFAULT4; created_at DATETIME DEFAULT CURRENT_TIMESTAMP.
Appointments: id INTEGER AUTOINCREMENT PK; client_name/address/phone/car_license/
car_engine/appointment_date TEXT NOT NULL; mechanic_id INTEGER NOT NULL; status
TEXT NOT NULL DEFAULT approved; created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
declared mechanic FK with ON DELETE CASCADE. Do not infer foreign_keys pragma
enforcement: that pragma is not enabled by this source. sqlite_sequence is part
of comparison. Full original SQL is private snapshot evidence, not a public dump;
the public config.php source is normative for exact CREATE text/whitespace.

Reset initializes5 seeded mechanics and0 appointments. Names/contact data remain
private in observations; no fictitious empty mechanics table. Exact initial
legacy digest is SOURCE.initialSha256; typed snapshot hashes are a different
representation. Retain DDL/defaults/PK/index metadata and row multiplicity verbatim.

Runtime profile: PHP7.4.33, SQLite3.34.1; fixed wall2026-10-27 12:00:00 UTC,
real advancing monotonic clock. Upstream config explicitly sets APP_TIMEZONE to
Asia/Dhaka: PHP business date uses that timezone, whereas SQLite CURRENT_TIMESTAMP
is UTC. At this frozen instant both have the same calendar date. TZ=UTC alone
does not override that application setting. Advancing clock/DST is NOT_RUN.

## Measurements and limits

Measured on both passes: all17 business responses per pass are valid UTF8 JSON,
HTTP200, with stable `content-type: application/json; charset=utf-8` and no other
captured stable header. A business rejection is not a transport-level4xx/5xx.
No non-JSON body or transport error occurred in these34 requests. Other HTTP
error branches/wrong methods are source-only NOT_RUN, not inferred coverage.

| Action/outcome | Measured JSON shape (values stay private) |
|---|---|
| book accepted | success:boolean, appointment_id:string, message:string |
| duplicate/capacity rejected | success:boolean, error_type:string, message:string |
| empty book rejected | success:boolean, message:string; no error_type |
| update/cancel accepted | success:boolean, message:string |
| get_appointments | success:boolean, appointments:array; each item has all10 appointment columns plus mechanic_name/mechanic_specialty, every item scalar is string, including id/mechanic_id |
| get_slots | success:boolean,date:string,mechanics:array; id/max_daily_slots/booked_count/available_slots are number; is_full:boolean; name/specialty/phone:string |

Success booleans and rejection codes are checked privately against source-derived
invariants: duplicate is DUPLICATE_CLIENT, fifth booking is MECHANIC_FULL; empty
form has no error_type. Do not coerce the string IDs in appointments or stringify
the numeric fields in slots. Empty appointments is `[]`, not null or an object.
Captured Date/Server/Connection-type volatile wire headers stay private and do
not enlarge the unchanged Oracle stable-header normalization policy.

| Scenario / step IDs | Measured appointment rows after each step | Other verified transitions |
|---|---|---|
| business01..06 |1,1,1,1,0,0| Update changes date/mechanic only; joined list matches state; delete retains appointments sequence1 |
| rejected01..05 |1,1,1,1,1| Duplicate and empty form leave full typed DB unchanged; lists have1 row |
| capacity01..06 |1,2,3,4,4,4| Fifth insert rejected without state/sequence change; mechanic1 booked4/available0/full; others booked0/available4/not full |

Each initial state has0 appointments,5 mechanics,1 sqlite_sequence row (mechanics5).
After a successful booking, sequence includes appointments; its value stays1 for
business/rejected and advances1..4 for capacity. Cells actually seen in business
snapshots are integer/text; application JSON string types are a separate wire
property. DDL/schema stay unchanged, and all created_at fields equal frozen UTC.
NULL/real/blob/int64 extrema are NOT exercised by business rows.

Source-derived message construction (not public golden observations): accepted
booking combines mechanic name and date formatted F j,Y; duplicate combines that
formatted date; capacity combines name, booked/max and date. Update combines new
ISO date and mechanic name. Cancel uses a fixed deletion-success message. Empty
form concatenates seven validation errors in source field order. Exact spelling,
punctuation and JSON escaping remain normative upstream API source, while full
raw response bytes are privately compared across passes. No message normalization.

Corpus HTTP digest = SHA256(JSON.stringify({status,headers,bodyBase64})); headers
are the accepted transport's stable observations. Snapshot digest = SHA256 of
JSON.stringify(complete mapped typed snapshot), retaining DDL/sequence/multiplicity.
Request digest = SHA256(JSON.stringify(immutable manifest request)). Pack indexes
independently bind the corresponding raw HTTP/inspector/private observations.
Initial/bootstrap/per-step HTTP and before/after hashes match across both passes.

Replay inspections114 = 6 resets*(reset capture+explicit initial) +34*3
(worker before+after+explicit post-step). One additional original synthetic mapping
inspection is outside this114 and outside business coverage. Bootstrap HTTP6 and
business HTTP34 are disjoint counters. Worker readiness probes/process controls
are not business coverage.

Synthetic mapping fixture covers int64 boundaries, finite real, blob/null,
defaults/index/view/trigger/composite PK and duplicate-row multiplicity. Those
are not automatically properties exercised by car-workshop business data.
No TS candidate, held-out observations, new manifest cases or product acceptance.
