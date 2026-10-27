# Proposed target-worker boundary — independent review pending

This is an owner-scoped proposal, not a shared DTO, owner agreement, registered
benchmark or implementation of `verifyPair()` on PHP/TS. Oracle remains independent.
Concrete local type sketch: `packages/target-worker/src/boundary.ts`. Executable
controller: `src/controller.mjs`; it does not import Agent/Oracle/shared contracts.

`new TargetWorker(imageId, bundle, clock)` accepts a trusted local image identity
and `validateBundle()` result. `provision()` compiles and returns run ID, candidate
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
REAL a number, TEXT a string, BLOB hex, NULL explicitly tagged. Hidden/generated
columns and PK ordinals remain in metadata. `sqlite_sequence` is included.
Rows are observed in SQLite order: this proposal is **not** Oracle's
`sqlite-logical-v1`. Independent Oracle adaptation must preserve PK/full-row
ordering, metadata/defaults and exact scalar semantics; no normalization changes.
Reject missing/corrupt/linked DBs, virtual tables, >128 schema entries/columns or
>10000 rows per table; total command output ≤4 MiB. Candidate-chosen DBs are
untrusted parser input, so parsing itself is isolated and time/memory bounded.

`close()` stops/reaps execution, captures actual docker-exec result/container
state, force-removes all tracked containers and volumes, and reports cleanup.
`kill()` hard-kills runtime then closes. Compilation deadline 35s (each compiler
12s); inspector command 15s / HTTP 1.5s; runtime lifetime 180s, container PID1
expires at 240s; job 20min. CPU1, RAM/swap256MiB, PIDs64, work64MiB/tmp16MiB.
Host deadlines use real timers, outside fixed-wall candidate context.

Errors: ADMISSION_REJECTED, BUILD_FAILED, RUNTIME_FAILED, TIMEOUT, CANCELLED,
OBSERVATION_ERROR, CLEANUP_ERROR, ENVIRONMENT_ERROR. Current failed Docker
inspections use ENVIRONMENT_ERROR with raw trusted receipts distinguishing
startup/refusal/parser failure; a future adapter maps these to ERROR/INCONCLUSIVE,
never fabricated PASS. Cleanup faults override acceptance. A negative control
being correctly rejected is not the negative candidate receiving PASS.

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
