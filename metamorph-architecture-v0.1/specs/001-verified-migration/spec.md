# Feature 001 — First independently verified migration

**Status: PROPOSED initial Spec Kit seed; refine with `$speckit-specify`.**

## User story

As a hackathon evaluator, I can choose a pinned publicly licensed PHP benchmark, watch an AI-powered migration to TypeScript, observe a real behavioral mismatch detected independently, and see a bounded repair validated by the same unchanged tests with an exportable report.

## Scope

**In**: one validated source fixture, Meta Spark generate/repair, independent TS startup, one stateful HTTP+SQLite scenario, structural diff, actual model usage, Oracle verdict, basic run UI/API and downloadable evidence.

**Out**: arbitrary repository uploads/remote execution, SQL engine migration, Go/C/Rust, production auth, cloud orchestration, general AST transpiler, full Casper reuse, theme polish and automatic merge of generated code.

## Functional requirements

- FR-01: Select a pinned `BenchmarkDefinition` with source revision/license and reproducible clean SQLite fixture.
- FR-02: Acquire original PHP baseline (status/headers/JSON and state snapshot) in disposable isolated runtime.
- FR-03: Invoke `muse-spark-1.3` using configured Meta API and a bounded plan; generated candidate must be an independent TS service.
- FR-04: Run G0 independence check with PHP unavailable and no access to golden outputs; missing routes fail or stay inconclusive, never pass.
- FR-05: Run G1–G3 on mandatory public scenario IDs and record exact mismatches in HTTP and logical SQLite state.
- FR-06: Run at least one independent negative Oracle control (G4) that detects a deliberately altered response or DB state.
- FR-07: Allow at most configured repair iterations; invoke `muse-wonder-1.0` only when policy requires/escalates. Every model request and usage receipt is logged.
- FR-08: Display actual run state and verdicts. Export raw evidence and a concise HTML summary.
- FR-09: Every terminal run is `PASS`, `FAIL`, `INCONCLUSIVE` or `ERROR` for documented reasons; no report asserts a test ran unless it did.

## Acceptance scenarios

- AC-01 (baseline): A pinned unmodified PHP reference runs, returns a valid response, updates isolated SQLite, and resets without changing host files.
- AC-02 (independence): With PHP process stopped/unreachable, target still handles mandatory requests and cannot read reference fixture/output.
- AC-03 (differential): With clean equivalent initial state, a request sequence compares both responses and post-state, reporting mismatch field/scenario when unequal.
- AC-04 (negative control): A known-bad candidate with changed scalar type, missing field or wrong DB row returns `FAIL` in the expected gate.
- AC-05 (repair): A deterministic public failure drives at least one Meta-generated corrective patch and the same unchanged verifier transitions FAIL→PASS.
- AC-06 (evidence): Run report contains real source revision, environment, executed scenario IDs, model IDs/usage, elapsed times, gate results and reproducibility instructions.
- AC-07 (no escape): The agent cannot modify benchmark, Oracle, held-out, policy or CI files through its patch tool.

## Nonfunctional requirements

- NFR-01: Fast PR CI target 2–4 min, no network model call or full benchmark by default.
- NFR-02: Configured hard runtime/model budget limits, safe worker filesystem boundaries and separate databases.
- NFR-03: Small TypeScript module boundaries suitable for separate Vladimir/Ilia branches and quick integration.

## Open gates

1. Choose actual tested source repository and exact accepted mandatory scenario corpus after PHP 7.4 baseline.
2. Select TS SQLite driver after real parity test, not from convenience alone.
3. Verify Meta API entitlements and model availability via successful live calls before asserting strategy scores.
