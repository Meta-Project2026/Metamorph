# Source-derived hypotheses and public preregistration

All outcomes below are **predictions / STATIC_ONLY**, made before any real
PHP/TS comparison. No such comparison ran. Exact request bytes and per-step
success, appointment-row count and appointments sequence predictions are in
[cases.public.json](cases.public.json). Initial appointments sequence `null`
means no row named `appointments` in `sqlite_sequence`, not SQL NULL in a row.

## Rules from public code

PHP references below are to pinned upstream `api.php` unless marked config.php.
TS references are to `packages/target-worker/fixtures/workshop/src/main.ts`.
All source identities are locked in [pins.json](pins.json).

| Rule | Public PHP location | Public TS location | Prediction / state effect |
| --- | --- | --- | --- |
| H1: lifecycle and JSON types | API 183-195, 237-244, 320-355; config 79-102 | 120-130, 171-185, 210-215 | Booking ID is a JSON string; success is boolean; read result is an array; appointment read fields are strings or null. Delete removes the row, preserves sequence, next insert uses id 2. |
| H2: missing fields and zero | API 97-136 | 29-30, 70-94 | Missing fields trim to empty; literal `0` is empty for required text. Validation joins all messages with ASCII spaces in fixed field order. No transaction/insert/sequence advance. |
| H3: trimming and ASCII spaces | API 97-102, 119; config 28-29 | 19-28, 70-88 | ASCII padding trims; interior ASCII engine space is admitted by both. NBSP must not be assumed equivalent to ASCII trim. |
| H4: ordinary phone rejection | API 113-115 | 81-84 | Forbidden ASCII letter rejects with the same message; status remains 200; no inserted row. |
| H5: regex whitespace semantics | API 113, 119 (no UTF/UCP modifier) | 81, 86 (ECMAScript `\s`) | Interior U+00A0 may reject in PHP and pass in TS, causing HTTP then DB divergence. Independent runtime check of PCRE options/locale and raw response is required. |
| H6: integer coercion | API 103, 254-256, 345 | 29, 77, 134-136, 179 | PHP integer conversion of `1e1` is predicted 10; TS parseInt is predicted 1. This affects mechanic existence and the addressed appointment. This is a language-semantics hypothesis, not a measured PHP 7.4 receipt. |
| H7: calendar and past dates | API 30-35, 122-128; config 28-29 | 31-35, 36-46, 88-91 | Invalid calendar dates reject; comparison with fixed-clock Dhaka today rejects 2020 date. No DB write. |
| H8: missing mechanic / lock exit | API 43-49, 139-146 | 58-68, 95-98 | Missing positive mechanic id rejects. PHP request-end rollback and TS no-write commit should preserve identical logical state. |
| H9: rejection and sequence | API 134-139, 183-189 | 94-95, 120-126 | Refusal before INSERT must not consume an appointment id; valid request afterwards returns string id 1. |
| H10: status/header/comparison contract | API 2, 134-135; config 63-74 | 245-285; Oracle http.ts 13-19, 174-210 | Normal business failures are JSON under HTTP 200 and exact content-type `application/json; charset=utf-8`. Stable header comparison is unchanged; JSON object key order and escape spelling are not body-value differences. Transport/parse faults are ERROR. |

No input was selected from a private test identifier or error-code combination.
Values `Public Cedar 044`, the OPEN license strings, future August dates, id 77,
NBSP and `1e1` were constructed from the public field grammar, seed inventory and
the literal conversion/regex branches above. This is a fixed small pilot, not
a search for the audit's unknown sample.

## Fixed case table

Each case starts from independent clean PHP/TS state, after normal PHP bootstrap
and before business requests. The policy accepts every exact encoded request.
GET requests have no body; POST uses canonical form-urlencoded bytes with only
allowed keys. U+00A0 is explicitly `%C2%A0`, never an invisible copied private value.

| Public case id (prefix `public-`) | Steps | Predicted parity | First possible difference | Real reproduction |
| --- | ---: | --- | --- | --- |
| good-lifecycle | 8 | MATCH | None; book/read/update/read/delete/read/book/read; sequence 1 then 2 | NOT_RUN |
| empty-form | 2 | MATCH | None; seven required-field messages, then empty read | NOT_RUN |
| zero-name | 2 | MATCH | None; `Client Name is required.` | NOT_RUN |
| ascii-padding | 2 | MATCH | None; stored name `Public Cedar 044`, engine `ENG 044 A` | NOT_RUN |
| phone-letter | 2 | MATCH | None; phone validation rejection | NOT_RUN |
| engine-nbsp | 2 | DIVERGE | Step 1 HTTP rejection vs success, then row/sequence 0/absent vs 1/1 | NOT_RUN |
| phone-nbsp | 2 | DIVERGE | Step 1 HTTP rejection vs success, then row/sequence 0/absent vs 1/1 | NOT_RUN |
| exponent-mechanic | 2 | DIVERGE | Step 1 missing mechanic 10 vs insert using mechanic 1 | NOT_RUN |
| invalid-calendar | 2 | MATCH | None; February 29, 2099 rejected | NOT_RUN |
| past-date | 2 | MATCH | None; May 17, 2020 rejected against fixed clock | NOT_RUN |
| missing-mechanic | 2 | MATCH | None; mechanic 77 missing, transaction does not alter DB | NOT_RUN |
| reject-before-insert | 4 | MATCH | None; invalid phone/read/valid book/read, first id still 1 | NOT_RUN |
| exponent-cancel | 3 | DIVERGE | Step 2 HTTP may match, but PHP retains id 1 while TS deletes it; step 3 read differs | NOT_RUN |
| exponent-update | 3 | DIVERGE | Step 2 PHP not-found vs TS update; same row count/sequence but different date/mechanic | NOT_RUN |

For exponent-update step 2, the predicted PHP row keeps date `2099-08-18`,
mechanic `1`; TS row changes to `2099-08-19`, mechanic `2`. Both retain id 1 and
sequence 1, so row-count-only checking would be inadequate. Always compare the
entire original logical snapshot and full typed JSON using trusted comparators.

Predicted JSON shapes: booking success has `success`, string `appointment_id`,
and `message`; ordinary validation failure has `success:false` and `message`,
without `appointment_id` or `error_type`; updates/cancellations have success and
message; reads have `success:true` and `appointments` array. No case deliberately
triggers capacity or duplicate error_type. Empty form's exact message order is
client, address, phone, license, engine, date, mechanic, as both source branches
show. Schema/seed rows should remain unchanged throughout every case.

## Controls and alternative explanations

- **Real positive control planned:** good-lifecycle must actually match HTTP
  and complete DB state at every step, including the initial state.
- **Real negative control planned:** corrupt only status in a copy of one known
  public positive observation, then compare with unchanged compareHttp; it must
  detect HTTP_STATUS. Never mutate the candidate or reference response.
- **Executed synthetic controls:** equal independent HTTP copies, deliberately
  corrupted HTTP status, equal independent logical DB copies, corrupted sequence.
  Four controls pass; these validate comparator response to original synthetic
  values only, not real transport or always-PASS/always-FAIL behavior on PHP/TS.
- For a reproduced divergence, compare raw public form bytes, raw response bytes,
  parsed JSON types/keys, and independent inspector receipts before mapping.
  A tiny trusted in-container PHP conversion/PCRE diagnostic and a JS-language
  diagnostic may isolate semantics, but must also remain inside Docker.
- PCRE options/locale/version, form decoding, wrong runtime identity, clock,
  stale state, snapshot/mapping errors and malformed observations remain possible
  alternatives until independently checked. Existing mapping and comparison code
  contains no demonstrated defect in this work. Green synthetic tests cannot
  settle those alternatives or identify the cause of the private audit failure.

The two rules suggest a possible future fix principle: preserve PHP's supported
numeric-string coercion and validation character classes explicitly in TS.
Do not blanket-replace conversion or broaden normalization. Establish the pinned
PHP behavior first, and review compatibility/regressions with both owners in a
separate candidate-fix PR. No fix is applied here.
