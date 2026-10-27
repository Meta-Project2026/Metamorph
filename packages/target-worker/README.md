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
not owner approval. `TargetWorker` only accepts a trusted image ID; untrusted callers
must not choose runtime images or override policy. Evidence output contains raw
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
