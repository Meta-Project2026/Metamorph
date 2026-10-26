# MMP-002 — independent Oracle foundation

Branch: `feat/mmp-002-oracle`. Owner: Ilia. Acceptance: GitHub issue #2.
Status: foundation implemented and locally tested; PHP qualification NOT_RUN.
No product acceptance or owner ratification.

## Runnable slice

1. Compare raw HTTP status, fixed stable headers, JSON scalar types/null/missing,
   object membership and array order; compare non-JSON bodies byte for byte.
2. Read consistent logical snapshots from real synthetic SQLite databases:
   schema/defaults/indexes/triggers, typed rows, primary keys and sqlite_sequence.
3. Execute equal fixtures and independent HTTP/status/type and DB mutants.
   Exceptions, incomplete coverage and broken controls must never yield PASS.
4. Run a sequential public scenario through two trusted worker adapters, with
   fresh independent state, initial-state comparison and snapshots after each
   response. Save actual raw observations, diffs, executed IDs and GateResults.
5. Qualify pinned PHP candidates only in disposable bounded isolation. If that
   runtime is unavailable, record NOT_RUN and reproducible follow-up steps.

## Acceptance and boundaries

Frozen install, lint, typecheck, unit/contract smoke and build must pass. Fast CI
does not execute PHP, download benchmarks or call models. Existing contracts and
Oracle semantics remain unchanged. No agent, server or provider integration.
Synthetic evidence is not a full G0–G4 verdict. No benchmark selection without
executed repeatability evidence. Held-out vectors remain outside this repository
and outside migration-agent input; public fixtures below are original controls.

## Failure cases

Missing/duplicate/empty scenarios are invalid or INCONCLUSIVE. Invalid observations,
snapshot/worker/cleanup failure and verifier failure are ERROR. Proven diffs are
FAIL. Evidence publication failure throws and cannot return a successful result.
No configurable normalization or candidate-authored verdicts are accepted.
