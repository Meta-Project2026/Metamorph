# Stepwise PHP reference worker (MMP-006)

Trusted host code: `src/reference/`. Original trusted isolated inspector:
`reference/inspector.php`. Source: car-workshop at
`d272170d0aecbd28eb5b13e272d9dd11d545b66c`, MIT, Copyright (c) 2026 Tanjila
Afsari Rubina. Archive/license hashes and base image digest are in `SOURCE`.
The source archive and all upstream license notices stay intact inside each
source copy. PHP/Debian/libfaketime notices remain in the runtime image; the
clock notice hash is verified independently by the inspector.

Run from repository root on an **authorized disposable Linux Docker host**:

```sh
pnpm install --frozen-lockfile
pnpm --filter @metamorph/oracle test:reference
REFERENCE_HEAD_SHA=$(git rev-parse HEAD) node packages/oracle/reference/proof.mjs
```

No upstream PHP/SQLite runs on the host. The host opens only an original trusted
synthetic fixture using Node SQLite to test conversion against the independent
PHP inspector. Each reset gets a unique Docker-managed local tmpfs volume
(8MiB, uid/gid65534, mode0700, noexec/nosuid/nodev). While the entire app cgroup
is paused, inspector sees that volume read-only, rejects links/unexpected files,
and copies DB/journal/WAL into its own tmpfs before a consistent transaction.
PHP server and inspector are distinct containers; neither has
private evidence, credentials, Docker socket, workspace or candidate mounts.
The archive bind is the app's only host file. Inspector binds its own code only.
All execution is UID65534, read-only root, offline loopback, cap-drop ALL,
no-new-privileges, 1 CPU/256MiB/64 PIDs, 32MiB work + 8MiB temp + 8MiB DB,
no Docker logs. Cleanup removes and verifies absence of both containers and DB volume.
App has a 600s wall watchdog; inspector 12s; broker commands default15s, cleanup5s.
Pull/build bounds are180/300s; driver budget12min; manual job20min.

The driver produces only `reference-public/reference-summary.json` for upload.
MMP-009A adds a strictly structural, versioned `acceptanceCorpus` field to that
summary. `acceptance-proof.mjs` uses two independent workers, each scheduled
exactly as `MANIFEST.map(s => s.id)`, preserving the registered manual entrypoint.
Each pass runs all three scenarios. `acceptance.mjs` excludes response values,
DDL, raw paths and diagnostics; `acceptance-controls.mjs` labels original synthetic
faults separately from three actual isolated process controls. The independent
resource ledger verifies zero containers/volumes before all three evidence packs
are sealed/verified. SIGINT/SIGTERM cancel active operations and enter cleanup.
Hard job/host termination cannot produce verified completion; ephemeral runner
destruction is not durable evidence. See specs/010-workshop-acceptance.
It runs the three immutable public scenarios twice and verifies exact raw HTTP
repeatability plus unchanged core comparator results. Full HTTP headers/base64,
before/after SQLite, legacy wire bytes, runtime/provenance/manifest, monotonic
timings and command stdout/stderr go into a host-private evidence pack. An
integrity index is verified after every worker has been removed.

Default raw parent is a private OS temp directory outside Git. For a trusted
local retained volume set `ORACLE_PRIVATE_PARENT` to an existing owned 0700 POSIX
directory outside the checkout. Files are0600 with unique run/attempt/step IDs,
atomic writes, size limits, no symlink traversal, hardlink rejection and hashes.
Limit: same-UID/root compromise is outside POSIX owner-only protection. Windows
ACL-backed retention is unsupported and fails closed. Evidence may include
synthetic personal-looking booking data; never attach it to public issues/PRs.

**EVIDENCE_RETENTION_NOT_CONFIGURED / EXTERNAL_RETENTION_NOT_RUN.** Local files
survive container teardown; Actions files do not survive runner destruction.
There is no configured durable external service, encryption recipient or upload.
The public hash alone cannot recover raw observations.

Docker `cp` cannot read container tmpfs; the DB transport uses Docker's local
tmpfs volume option instead. See [Docker copy corner cases](https://docs.docker.com/reference/cli/docker/container/cp/)
and [local tmpfs volume options](https://docs.docker.com/reference/cli/docker/volume/create/).

Use existing manual `php74-qualification.yml` with `proof=reference` and the exact
feature ref. `proof=qualification` preserves the MMP-005 entrypoint. Ordinary Fast
CI is unchanged. See `specs/007-php-reference-worker/interface-handoff.md` for
WorkerAdapter integration, mapping and supported feature limits. This is a
reference-only proposal; no benchmark registration, candidate parity, held-out
testing or full G0–G4 PASS follows from it.
