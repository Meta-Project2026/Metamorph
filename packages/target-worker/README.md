# Disposable TypeScript target worker (MMP-007)

Original public mini-API demonstration with trusted host admission and isolated
TypeScript compilation, Node execution, HTTP capture and SQLite inspection.
No shared Oracle/Agent API integration or real PHP migration is implemented.

From repository root:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
node --test packages/target-worker/test/*.test.mjs
# Authorized Linux x86_64 Docker runtime ONLY:
TARGET_WORKER_HEAD_SHA="$(git rev-parse HEAD)" node packages/target-worker/src/smoke.mjs
```

The trusted smoke builds a pinned image **before** source admission. It uses only
the original public fixture and deliberate controls. TS is never executed or
typechecked on the host; root tsc checks only the trusted boundary type sketch.
Candidate source can contain imports, but cannot supply package/build files or
install commands. Only trusted pinned compiler/type packages are available;
invalid imports fail. Build and runtime run offline with nonroot UID10001,
readonly root, no capabilities/new privileges, bounded CPU/RAM/PIDs/tmpfs and
host-enforced deadlines. Node permissions additionally deny subprocesses and
access outside emitted JS and its own state. No host directory/socket/secrets mount.

Runtime and compiler are separate containers. HTTP inspector runs in a separate
PID namespace, UID10002, sharing only candidate loopback. DB inspector is offline,
mounts only candidate state readonly, and opens a fixed independently selected
SQLite path. Candidate snapshot/verdict endpoints are ignored. Candidate can
damage its own DB; missing/corrupt/linked state fails inspection. Containers are
disposable isolation, not a proof against kernel/container-engine vulnerabilities.

Host stages must be exclusively trusted-owned; source admission snapshots bytes
once, bounds reads and rejects symlinks/junctions/hardlinks. Concurrent hostile
host writers are outside this boundary. Hashes bind source/build provenance,
not owner approval. `buildTrustedRuntime()` builds the pinned recipe, verifies
image/toolchain/file identities and issues an in-process runtime capability.
`new TargetWorker(runtime, bundle)` rejects arbitrary digest strings and copied
objects. This trusts the host adapter, recipe, Docker daemon and dependency
sources; it is not cryptographic attestation. The explicit `trustedTest.command`
seam is for trusted fault simulations/instrumentation only. Untrusted callers
must not choose images, commands or policy. Evidence output contains raw
**public** bodies/state/diagnostics; do not use this public driver for held-out data.

Fixture provenance: original task-time code authored by the coding assistant;
no migration-agent/provider output, PHP source or upstream fixtures were used.
This does not establish a human-only/non-AI authorship claim. There are no live
model calls. Node/dependencies and Debian retain licenses in the image; image
build uses the official pinned Node digest, npm integrity lock (TypeScript
Apache-2.0, Node types/undici-types MIT), libfaketime0.9.10-2.1 (GPL notice retained;
[Debian package](https://packages.debian.org/bookworm/libfaketime)).
The smoke records installed notices, exact image/runtime identities and versions.

Clock experiment samples Date, Date.now, SQLite datetime/CURRENT_TIMESTAMP and
two monotonic APIs before/after 1.2s. Fixed mode uses libfaketime without modifying
business timestamps. A disagreement is `CLOCK_PARITY_BLOCKED`; never normalize
it away. Full G0, PHP↔TS G2/G3/G4, private/held-out, concurrent bookings,
midnight/DST, registration and product acceptance remain NOT_RUN.

See [proposed handoff](../../specs/008-ts-target-worker/interface-handoff.md) and
[validation](../../specs/008-ts-target-worker/validation.md). Dedicated workflow
is manual-only. It does not expand ordinary Fast CI.

## R1 lifecycle

Build the trusted runtime before source admission, admit bytes, construct the
worker, then `await provision(signal?)`. Provision and every
`reset(scenarioId, signal?)` wait for an independent inspector's bounded GET
`/items` handshake (HTTP 200, request identity, JSON items array), a live launch
and running Docker container. The probe joins only that generation's network by
immutable container ID; readiness is transport evidence, not parity. Call
`request()` immediately after reset; client sleeps are unnecessary.

The first operation starts one monotonic 180s work deadline, including candidate
build, probes, inspection and resets. Startup cap 10s, operation cap 15s (candidate
build 35s), total resets 16 including initial provision, operations 128 including
provision/reset/request/snapshot. Only the trusted adapter can lower these limits
via `{ limits }`; it cannot raise them. Image preparation before candidate
admission has a separate 240s bound. CPU/RAM/PID limits are unchanged. Cleanup has
a separate 10s grace per attempt; it never renews useful work. Expiry cancels CLI
work and automatically reaps resources; successful work cannot escape after expiry.

Operations are exclusive: a concurrent operation rejects with
`RUNTIME_FAILED: BUSY`. `close()`/`kill()` cancel and join the active operation,
stop then force-remove runtime/inspectors, join docker-exec receipts, remove DB
volumes and verify actual Docker inventory. Reset deletes the old pair before
creating the next. Successful close/kill is idempotent; failed close can retry
removal, but cleanup faults stay sticky and block acceptance. A failed operation
terminally ends useful work: create a new worker afterwards. Always await
`close()` in `finally`; inspect trusted cleanup receipts on error. Feedback
adapters must expose only allowlisted codes, counts, hashes and known test IDs.

See [R1 validation](../../specs/008-ts-target-worker/r1-validation.md) for new
controls and exact-source receipts. Historical evidence is preserved.
