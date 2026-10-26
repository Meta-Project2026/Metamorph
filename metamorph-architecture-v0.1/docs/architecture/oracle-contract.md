# Oracle contract v0.1

**Status: PROPOSED.** Verification is an independently coded deterministic component, not a second LLM reviewing the first LLM.

## Gates

| Gate | Minimum acceptance | Typical fail/inconclusive |
|---|---|---|
| G0 — target independence & completeness | Target starts and responds while PHP stopped/unreachable; all mandatory routes implemented; no PHP subprocess/FFI/proxy, golden-output lookup, baseline access or hardcoded scenario-only replay | Target calls legacy, empty scaffold, or cannot test isolation |
| G1 — build and type safety | TS build/typecheck and known unit smoke actually executed | compiler/type failures, missing tooling |
| G2 — HTTP contracts | mandatory method/path, status, content-type, errors, JSON scalar types, array ordering, meaningful HTML/text bytes | changed error shape, array sorting, HTTP 200↔4xx mismatch |
| G3 — stateful differential | same logical initial SQLite state for both, step-wise requests, response + post-state parity, lock handling, deterministic subset / justified metamorphic invariants for nondeterminism | extra rows, transaction leaks, wrong `sqlite_sequence`, unbounded randomness |
| G4 — controls | independent positive and deliberately mutated negative controls correctly accepted/rejected; held-out run stays outside agent feedback | comparator accepts mutant or rejects valid fixture; missing controls |

A run is `PASS` only when all applicable mandatory gates PASS and all mandatory scenario IDs actually executed. `FAIL` is proven mismatch; `INCONCLUSIVE` is missing evidence; `ERROR` is environment failure. Mandatory tests may not be silently disabled, marked optional or removed for green reports.

## Differential details

- Freeze manifest, scenario IDs, normalization version and initial logical fixture **at run start** (not on each CI check).
- Compare HTTP status, stable business headers, parsed JSON preserving scalar types/null/missing and array ordering. Object key order may differ.
- Compare logical DB table rows sorted by primary key, relevant schema/defaults, autoincrement/`sqlite_sequence`, and response to subsequent read after a write.
- Every public scenario uses a clean pair of databases. Multiple requests within a stateful scenario run sequentially against each corresponding DB.
- Timestamp/random/UUID nondeterminism needs predeclared controls or specifically scoped metamorphic checks. Never normalize away unpredictable business results and call them exact parity.
- Verify no lingering lock or partial state after rejected transactions; test capacity/duplicate concurrency invariants separately from sequential diff.
- Keep raw outputs/snapshots and a human-readable mismatch taxonomy. Repair agents see only allowed summaries and public tests.

## Independent controls

1. Positive: known equal pair passes.
2. Negative: known changed HTTP status, scalar type, array order, omitted field, state mutation, or proxy/replay attempt fails the relevant gate.
3. Broken verifier causes `INCONCLUSIVE`/`ERROR`, never `PASS`.

## Evidence pack

`manifest.json`, `events.jsonl`, `gate-results.json`, `model-usage.json`, `diffs/`, `http/`, `db/`, `report.html`. Each includes actual runtime versions, commands/test IDs where relevant, elapsed time and reproducibility instructions. SHA256 may be recorded once per final evidence pack/fixture, **not as a repeated contributor approval protocol**.
