# MMP-006: isolated PHP reference worker

Status: reference-only implementation and isolated replay validated; external
retention unconfigured; benchmark proposal only. Refs #11.
Base: `07f37fc24f37971aa2254cfcd0024e1b33b53192`. Owner: Ilia.
The root constitution remains PROPOSED / PENDING OWNER RATIFICATION.

Implement the existing WorkerAdapter with a trusted host broker, disposable PHP
application, independent disposable SQLite inspector, and private raw evidence.
Use the exact workshop source/archive/license and workshop-clock profile from
MMP-005: PHP 7.4.33, SQLite 3.34.1, frozen 2026-10-27 12:00:00 UTC wall clock,
real monotonic timers. No upstream answers or expected test fixtures are inputs.

Acceptance:

- Each reset starts a new source copy/DB, bootstraps upstream seeded mechanics,
  and verifies the complete qualified initial logical hash before any step.
- Every declared step executes real loopback HTTP, retains raw headers/body,
  and independently captures full typed before/after state, including DDL and
  sqlite_sequence. Return the existing HttpObservation/SqliteSnapshot types.
- Freeze application writes while copying state into a distinct inspector.
  The application has no Oracle, evidence, candidate, workspace or socket mount.
- Preserve int64 strings, NULL, blobs, PK order and all schema/default/index
  semantics represented by the existing comparator. Unsupported features error.
- Run three public sequential scenarios twice (6 resets, 34 steps), retaining
  subsequent reads after writes/rejections and checking side-effect-free rejects.
- Bounded unprivileged offline containers; abort/crash/hang/cleanup error fail
  closed. Evidence is atomic, bounded, owner-only, integrity-verifiable after close.
- Publish allowlisted hashes/counts/status only; raw remains private. Without
  external storage report EVIDENCE_RETENTION_NOT_CONFIGURED and
  EXTERNAL_RETENTION_NOT_RUN, regardless of successful local retention.

Non-goals: TypeScript/cross-language parity, concurrent transactions, advancing
clock/DST, application crash recovery, hidden tests, model calls, benchmark
registration, G0–G4 product acceptance, owner ratification or PR merge.
Protected comparator/runner/contracts/target/integration/agent modules are unchanged.
