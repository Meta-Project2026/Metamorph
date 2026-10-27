# Proposed target-worker boundary — independent review pending

This is an owner-scoped proposal, not a shared DTO, owner agreement, registered
benchmark or implementation of `verifyPair()` on PHP/TS. Oracle remains independent.
Concrete local type sketch: `packages/target-worker/src/boundary.ts`. Executable
controller: `src/controller.mjs`; it does not import Agent/Oracle/shared contracts.

`new TargetWorker(runtime, bundle, clock)` requires an in-process capability from
`buildTrustedRuntime()` and a `validateBundle()` result. Broker verification binds
the actual image ID, pinned recipe/lockfile/runtime bytes and measured toolchain.
This trusts the host and Docker daemon; it is not cryptographic attestation. `provision()` compiles and returns run ID, candidate
SHA, runtime container ID, policy and initial scenario identity. `reset(scenarioId)`
destroys the prior runtime and provisions a fresh uniquely named DB volume and
runtime from the same built bytes. It never requests candidate reset semantics.
Proposed external `provision(runId,candidateSha,runtimePolicy)` would validate the
caller identity/limits and delegate to this controller; current IDs and limits are
trusted-generated/fixed, not candidate-selectable.

`request(stepId, method, path, body?, signal?)` returns real status, raw headers,
base64 body, inspector-generated UUID request ID and step ID. Path is relative;
methods GET/POST; body ≤4096 bytes; response ≤256 KiB. Only candidate loopback
3000 is reachable. The original fixture echoes the request ID; mismatch fails.
Stable header selection is left to Oracle; raw headers remain retained.

`snapshot(stepId, signal?)` independently opens `/state/target.sqlite` readonly
in a separate container and returns format `target-worker-sqlite-v1-proposed`,
runtime/volume identity, SQLite version, complete schema SQL, table_xinfo metadata
and typed rows. SQLite INTEGER is a decimal string (BigInt, including sequence),
REAL a finite number (nonfinite values reject rather than silently becoming
JSON null), TEXT a string, BLOB hex, NULL explicitly tagged. Hidden/generated
columns and PK ordinals remain in metadata. `sqlite_sequence` is included.
Rows are observed in SQLite order: this proposal is **not** Oracle's
`sqlite-logical-v1`. Independent Oracle adaptation must preserve PK/full-row
ordering, metadata/defaults and exact scalar semantics; no normalization changes.
Reject missing/corrupt/linked DBs, virtual tables, >128 schema entries/columns or
>10000 rows per table; total command output ≤4 MiB. Candidate-chosen DBs are
untrusted parser input, so parsing itself is isolated and time/memory bounded.

R1 lifecycle/error policy supersedes the original implementation. See
[R1 handoff](r1-handoff.md) and [R1 validation](r1-validation.md). The first operation
starts a single monotonic 180s work deadline. Startup 10s, build 35s, operation
15s; total resets 16 including initial provision, operations 128. Trusted limits
may only lower these values. Cleanup gets 10s per attempt, without renewing work.
Reset waits for independent HTTP readiness tied to runtime/scenario/request IDs.
Previous resources are removed and Docker inventory verified before new creation.

Concurrent operations reject as `RUNTIME_FAILED: BUSY`. `close()`/`kill()` cancel
and join active work, stop/force-remove resources, retain exec/state receipts,
remove volumes and check Docker inventory. Repeated successful close is safe;
failed cleanup can retry removal, but the fault stays sticky. Failed workers
cannot reset. CPU1, RAM/swap256MiB, PIDs64, work64MiB/tmp16MiB remain unchanged.

Errors retain the same owner-scoped taxonomy: ADMISSION_REJECTED, BUILD_FAILED,
RUNTIME_FAILED, TIMEOUT, CANCELLED, OBSERVATION_ERROR, CLEANUP_ERROR,
ENVIRONMENT_ERROR. Compiler exit2 confirms BUILD_FAILED; confirmed launch exit
or invalid readiness means RUNTIME_FAILED; independent parser exit1 means
OBSERVATION_ERROR; Docker/host failures mean ENVIRONMENT_ERROR. Receipts determine
the category, without stderr guessing. Cleanup failure overrides acceptance.
No shared DTO or Oracle adapter was changed or approved.

Clock modes: real; experimental stopped wall `2026-10-27 12:00:00 UTC` through
libfaketime with real monotonic timers. Actual Date/Date.now/SQLite/performance/hrtime
measurements decide compatibility. No PHP-clock compatibility inference from
loading a library alone. Joint end-to-end parity remains NOT_RUN even if this
Node/SQLite probe agrees with the recorded PHP reference clock.

Trust boundary: controller/recipes/inspector/tests are trusted; source and DB are
untrusted. Candidate sees no reference source/state, credentials, Docker socket,
host bind mounts, Oracle code/evidence or held-out. Compiler receives TS bytes only;
runtime receives hashed JS and its own DB volume. Inspector UID10002, candidate
UID10001, separate PID namespace; only inspector HTTP joins candidate network.
No reference exists in that network. Published raw evidence is limited to these
original public inputs. Do not point this public smoke at private benchmark data.
Future private evidence storage and declassification require independent design.
