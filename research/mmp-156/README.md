# MMP-156 — first real Meta candidate initial `DB_SCHEMA` diagnosis

Refs [#156](https://github.com/Meta-Project2026/Metamorph/issues/156),
[#154](https://github.com/Meta-Project2026/Metamorph/issues/154). Offline work
only: no Meta/model call, no workflow dispatch, no Docker run and no paid
action during this task. All real-run facts below are quoted from public,
sanitized receipts; the candidate plaintext was never accessed.

## What the public receipts already establish

Source receipts: GitHub artifact `meta-paid-public-41696312924`
(ID `13261066520`), inspected locally from a downloaded copy. Run
[41696312924](https://github.com/Meta-Project2026/Metamorph/actions/runs/41696312924)
executed on protected `main@de881e7d91abd43c9ef5898b2335a05bfae93174`;
candidate SHA `1063fc5b63eaaae00c7b4577e3813886f6c376ca1e0386f45b1ad98778337b10`;
G1 PASS 6/6, G3 FAIL with finding codes `DB_SCHEMA` + `MISSING_COVERAGE`
executing only `workshop-{business,rejected,capacity}:initial` (3/20), G2
INCONCLUSIVE 0/17, 27 public G4 controls, cleanup `VERIFIED_ZERO_RESOURCES`.

**Deduction (mechanical, from trusted comparator semantics):** every scenario's
initial diff set contained `DB_SCHEMA` and **no** `DB_STATE`.

- `packages/oracle/src/sqlite.ts` `compareSqlite` pushes `DB_SCHEMA` when the
  serialized `schema` arrays differ and, independently, `DB_STATE` when the
  serialized `tables` arrays differ.
- `packages/oracle/src/runner.ts` forwards every comparator difference
  verbatim (`checkedDifferences` validates only shape); G3 findings are the
  deduplicated code set (packages/agent-real/src/report.mjs `checkedGate`).
  Nothing filters `DB_STATE`.

Therefore the candidate's **initial `tables` JSON matched the reference
byte-for-byte**: same table set (including the AUTOINCREMENT-created
`sqlite_sequence` entry — it lives in `tables` too), same column names and
order, same primary-key indices, and identical initial rows (the five seeded
mechanics under the pinned clock). The mismatch is confined to the
`sqlite_schema` DDL-text layer: altered `sql` text of the three schema
entries, and/or extra non-table schema objects (indexes/triggers/views) on
exactly one side. Missing tables, wrong column layout, missing seeds or a
missing `sqlite_sequence` row are **refuted** by the public receipt.

## Mismatch-class matrix (verified by `comparator-mechanics.test.mjs`)

`comparator-mechanics.test.mjs` runs the trusted built `snapshotSqlite` +
`compareSqlite` against real `node:sqlite` databases built from (a) the exact
`initSQLiteTables` exec string extracted from the pinned public source
(`research/mmp-061/public-source.json`), (b) the trusted known-good fixture
string (`packages/target-worker/fixtures/workshop/src/schema.ts`), and (c)
synthetic reformatting variants. Local run on Node v24.21.0 / Windows:
`node --test research/mmp-156/comparator-mechanics.test.mjs` → 12/12 pass.

| Class | Comparator outcome | Status for run 41696312924 |
| --- | --- | --- |
| Byte-verbatim source DDL (fixture string = source string) | no diff | required target state |
| Same statements split across separate `exec` calls, characters unchanged | no diff | — |
| Statement order swapped | no diff (snapshot sorts `type,name`) | — |
| `IF NOT EXISTS` omitted | no diff (SQLite strips the clause from stored text) | refuted as driver |
| Whitespace/indentation/newline reformatting (e.g. single-line) | `DB_SCHEMA` only; `tables` JSON equal | **consistent** |
| Non-PK column type spelling (`INT` vs `INTEGER`) | `DB_SCHEMA` only; `tables` JSON equal | **consistent** |
| Extra index/trigger/view on one side | `DB_SCHEMA` only | **consistent** |
| PK type spelling with `AUTOINCREMENT` (`INT PRIMARY KEY AUTOINCREMENT`) | statement rejected: AUTOINCREMENT requires exactly `INTEGER PRIMARY KEY` | would be startup failure, not `DB_SCHEMA` |
| Dropping `AUTOINCREMENT` (no `sqlite_sequence`) | `DB_SCHEMA` **and** `DB_STATE` | refuted (no `DB_STATE` in receipt) |

The known-good fixture additionally proves cross-version mechanics: it embeds
the source SQL byte-for-byte and its historical candidate passed G3 20/20
(`candidateSha 34c8325a…`, `PASS_SCOPED` in
`research/demo-readiness/evidence/summary.json`), so Node SQLite 3.50.4 and
the PHP-side SQLite produce identical stored DDL text for identical statement
text.

## Access blocker — exact textual delta UNKNOWN

The exact candidate DDL text is **not established**. Candidate ciphertext
artifact `mmp107-candidate-41696312924-1` (ID `13262211067`) is age-encrypted
to recipient fingerprint `48218aef33dd17354761805a678f95481ad21131336cc348c23cefe99f714600`;
the private key is owner-controlled and unavailable to this offline task.
`preservation.json` records `NOT_APPLICABLE` — the mmp089 private-diagnostics
policy only admits G1 `BUILD_FAILED` cases, so no class-level G3 diagnostics
were collected either. Per the task contract this blocker is documented
instead of guessing a root cause; no candidate text, private SQL, reference
snapshot or key material was exported.

## Smallest candidate-side change implemented

`packages/agent-real/src/migration-context.mjs` adds a `target.schemaContract`
paragraph to the generation prompt: it states that the verifier compares
stored `sqlite_schema` DDL text per object, and requires copying the source's
table-creation SQL byte-for-byte (whitespace, indentation, `IF NOT EXISTS`,
spelling, statement order) and executing it verbatim, keeping `AUTOINCREMENT`
(and thus `sqlite_sequence`) exactly. This mirrors the proven known-good
pattern. `research/mmp-123/prompt-sha.mjs` reconstruction and the
`mmp120-generation-readiness` target-contract pins are updated in step.

Effects: the request body and `contextSha256` change for **future** runs only
(past receipts stay bound to their recorded hashes; nothing in-repo hardcodes
the old hash). The one-POST/no-retry policy, admission chain and preflight
flow are unchanged. A next preflight card must be regenerated on exact merged
main per [LAUNCH.md](../mmp-154/LAUNCH.md).

Not done here, deliberately: no Oracle/comparator/reference change, no
normalization weakening, no `publicRepairDecision` eligibility change and no
early-failure feedback path — those cross trust boundaries that need
independent validation and owner/Ilia agreement first.

## Next experiment (proposal only — requires independent review, merge and explicit operator launch)

- **Falsifiable hypothesis:** with the `schemaContract` paragraph, a fresh
  one-POST generation reproduces the initial schema DDL text byte-for-byte,
  clearing `workshop-*:initial` (G3 20/20) and unblocking the 17 G2 HTTP
  steps; failure mode would be a new `DB_SCHEMA` (or `DB_STATE`) finding.
- **Expected gain:** G3 3/20 → 20/20 and G2 0/17 → up to 17/17 if no other
  mismatch class appears; measured, not assumed.
- **Estimated one-call charge:** projected input-token ceiling rises from
  125,360 to 127,908 (body 23,148 → 23,785 bytes under the same
  `serialized-utf8-bytes-times-4-plus-32768-v1` projection), worst-case
  $0.229517 at the locked 2026-11-03 tariff; observed usage on the identical
  policy was $0.04974775 (6,060 in / 9,923 out). Settled charge stays UNKNOWN.
- **Launch gate:** ChatGPT independent review of the exact HEAD → reviewed
  merge to main → updated exact-main preflight card → authentic operator
  dispatch with explicit one-attempt/no-hard-cap confirmation. No blind
  rerun, no self-approval, no automatic dispatch.

G0/G4 remain INCONCLUSIVE; product NOT_ESTABLISHED; nothing here is a PASS.
