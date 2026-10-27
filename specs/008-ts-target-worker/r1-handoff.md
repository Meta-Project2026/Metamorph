# MMP-007-R1 owner-scoped handoff

Issue #15; Vladimir-owned target worker only. Both-owner shared API agreement
remains pending. No PHP/Oracle/Agent/contracts/integration changes.

Use `buildTrustedRuntime()` then `new TargetWorker(runtime, admittedBundle, clock,
{ limits? })`. Limits are trusted-only conservative reductions; a provider must
never receive the broker, controller, command seam or policy configuration.
The issued capability cannot be recreated by supplying a digest-shaped object.
The broker hashes the pinned Dockerfile, npm lock, runtime files, checks Docker
image inspect ID/config and reads actual Node/SQLite/TypeScript/libfaketime versions
and installed file hashes in a restricted container. This is local trusted-host
provenance, not cryptographic or remote attestation. Image preparation is bounded
separately and precedes candidate admission. Candidate build and all useful worker
operations share one deadline from the first operation.

`provision(signal?)` / `reset(scenarioId, signal?)` return only after an independent
inspector's GET /items succeeds with HTTP200, request identity and JSON items array,
and launch/container remain live. Inspector uses immutable runtime ID network;
scenario/runtime/request IDs bind each probe and reject stale results. It does not
load candidate code. Readiness does not establish route coverage or parity.

Failure is terminal for useful operations. Concurrent useful work rejects BUSY;
close/kill abort and join it before deleting state. Cleanup stop/kill fallback,
state and exec receipts, rm retries, volume removal and actual Docker inventory
are recorded privately. Successfully absent names leave tracking Sets immediately.
Sticky cleanup errors remain acceptance blockers even after subsequent removal.
Explicit close retries get a bounded cleanup attempt; useful work never resumes.
Hostile/unresponsive Docker daemons can prevent proven absence: CLEANUP_ERROR,
retained resource names and diagnostics, never fabricated cleanup success.

WorkerError has an allowlisted `code`; detailed trusted receipts are not LLM
feedback. Map compiler exit2 to BUILD_FAILED; candidate exit/invalid readiness to
RUNTIME_FAILED; inspector parser exit1 to OBSERVATION_ERROR; CLI timeout/abort to
TIMEOUT/CANCELLED; Docker/host errors to ENVIRONMENT_ERROR. Cleanup failure has
priority. Future shared Oracle mapping needs joint agreement; do not change DTOs.

Only this original public smoke may publish raw receipts. Private HTTP/DB,
compiler diagnostics, held-out inputs and stderr need a separate trusted evidence
channel and allowlisted feedback. No product G0-G4 PASS is claimed. Complete G0,
PHP-TS G2/G3, held-out G4, registration, advancing clock/DST, concurrent scenarios,
live Meta and both-owner API agreement remain NOT_RUN/pending.
