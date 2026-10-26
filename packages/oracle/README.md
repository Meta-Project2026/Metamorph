# Independent Oracle foundation

This is an executable public/synthetic verification slice, not a product Oracle
PASS. Run from the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @metamorph/oracle controls -- ../../.oracle-evidence
```

The controls command drives real loopback HTTP servers and separate real SQLite
files containing original deterministic fixtures. It prints paths to evidence
packs and checks positive PASS, HTTP status/type FAIL, independent DB row/sequence
FAIL and snapshot failure ERROR. Generated evidence is ignored by Git. No PHP,
model, provider or third-party candidate executes in these commands.

## Comparison policy

`oracle-exact-v1` compares status and fixed stable headers: content-type, location,
cache-control, allow (header names case insensitive; values exact). Date, server,
connection and other headers are not compared. Other business headers require
Oracle-owner review and a policy version change before a benchmark can use them.
There are no runtime ignore lists, field stripping or timestamp/UUID rewriting.
JSON object key order is ignored; scalar types, null versus missing, values and
array order remain exact. Other bodies are compared as bytes. Invalid UTF-8/JSON,
duplicate JSON members, nonfinite/unsafe integer values or decimal precision loss
produce ERROR instead of falsely equating rounded values. Body limit: 1 MiB;
nesting limit: 100. JSON numeric spellings such as `1` and `1.0` are equivalent.

`snapshotSqlite` reads a consistent read-only transaction, disables extensions and
trusted schema, and preserves SQL schema text, defaults, indexes, views, triggers,
column order, typed cells and sqlite_sequence. Rows sort by composite primary key;
ties/no-PK tables compare as a full sorted multiset including duplicates. Integers
remain decimal strings (full SQLite int64 range), blobs are hex. Schema SQL is
conservative/exact: semantically equivalent differently written DDL can FAIL.
Virtual tables and nonfinite reals are unsupported (ERROR), rather than skipped.
Limits: 10,000 rows/table, 8 MiB serialized snapshot, 250 ms SQLite lock wait.
Node's built-in SQLite is experimental on supported Node versions; no native
dependency or third-party implementation is copied.

## Trusted adapter contract

Import `verifyPair`, `WorkerAdapter` and existing types from `@metamorph/contracts`.
The adapter has `reset`, `request`, `snapshot`, `close`; each receives an AbortSignal.
It is an **Oracle-owned broker** to a separately provisioned disposable worker,
never candidate code loaded in the verifier process. `snapshot` must be produced
by trusted inspection, not an application endpoint reporting its own state.

The caller supplies trusted public scenario definitions, a private existing
artifact parent and an explicit 1..30,000 ms operation timeout. At most 100
scenarios/100 requests each. Definitions are cloned once; workers receive only a
copy of the current request. Reset both workers per scenario, compare initial DBs,
then issue each request and compare HTTP plus post-state before the next request.
A different initial DB fails G3 and leaves G2 incomplete. No steps are omitted
after an ordinary response mismatch. Worker/comparator/cleanup errors produce
ERROR; incomplete mandatory coverage is INCONCLUSIVE. Configuration validation
errors reject before ownership of adapters is accepted; callers must close them.
After validated input, the runner attempts bounded cleanup even on evidence errors.

The broker must independently enforce CPU, memory, process, disk and wall-time
limits; terminate the worker when aborted/closed; verify fresh separate state;
collect trusted observations; and keep baseline unreachable from the candidate.
The Promise deadline here cannot interrupt synchronous code or prove OS isolation.
Only the original synthetic fixtures run in-process/on-host. Do not pass hostile
candidate DB files to on-host `snapshotSqlite`; inspect them inside a separate
Oracle worker. This foundation does not implement worker provisioning or G0/G1.

## Evidence and authority

Each new private evidence directory contains `manifest.json`, `events.jsonl`,
`gate-results.json`, `controls.json`, `model-usage.json` (empty: no calls), raw
HTTP bodies in base64, logical DB snapshots, diffs and `report.html`. Results use
the existing GateResult schema; RunEvent is consumed without schema changes.
BenchmarkDefinition remains an externally reviewed declaration; no manifest is
invented for an unqualified benchmark. A completed `gate-results.json` is written
last; publication errors reject. Runtime versions, elapsed time, expected coverage
and actual executed IDs are recorded, not inferred from a configured scenario.

G2/G3 results describe only supplied public/synthetic scenarios. Independent
controls have their own PASS/FAIL/ERROR results. **G4 remains INCONCLUSIVE** when
synthetic controls pass, because held-out isolation has not been executed. G0/G1,
PHP qualification and product verdict are NOT_RUN in these evidence packs.

Raw evidence is private and may include expected results. There is no repair
feedback export and no held-out input API. Do not mount Oracle source, controls,
evidence, reference DBs or held-out storage into candidate workers; give migration
workers only candidate-source write access and reviewed public inputs. Separate
OS/container permissions must enforce this: a TypeScript interface is not a
security boundary. Real held-out cases/answers belong in external Oracle-controlled
storage; none are included here. Only reviewed original public control outcomes
are suitable for a public PR. No teammate approval is implied.

See [benchmark qualification](../../specs/003-oracle/benchmark-qualification.md)
for pinned source provenance, NOT_RUN findings and the manual isolation recipe.
