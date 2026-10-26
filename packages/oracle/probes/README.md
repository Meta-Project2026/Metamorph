# PHP 7.4 reference qualification

Run the trusted host driver on an authorized disposable **Linux Docker host**:

```sh
node --test packages/oracle/probes/qualification.test.mjs
node packages/oracle/probes/qualification.mjs
```

The driver checks Docker version/info, pulls `php:7.4.33-cli-bullseye`, resolves
its actual RepoDigest and builds the trusted runtime from that digest with PDO
SQLite, mbstring and Debian libfaketime before any source archive enters a worker.
Dependencies are installed only when missing; existing PDO SQLite is used rather
than unnecessarily upgrading it. Installed copyright notices remain in the image.
It downloads the
exact pinned source archive (10 MiB maximum/45-second deadline), reads its pinned
MIT LICENSE, records hashes and mounts that archive plus `replay.php` readonly.
No archive extraction, PHP lint or third-party execution occurs on the host.

Worker invocation (the driver resolves the actual image ID/archive path):

```text
docker run --rm --name <unique> --network none --read-only --cap-drop ALL
  --security-opt no-new-privileges --cpus 1 --memory 256m --memory-swap 256m
  --pids-limit 64 --user 65534:65534
  --tmpfs /work:rw,noexec,nosuid,nodev,size=96m,uid=65534,gid=65534
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=16m
  --mount type=bind,source=<archive>,target=/input/source.tgz,readonly
  --mount type=bind,source=<trusted-script>,target=/probe/replay.php,readonly
  --entrypoint timeout <actual-image-id> --signal=KILL 180
  php /probe/replay.php examsuite
```

No environment/credentials, host-writable bind, workspace, socket, published port,
host networking or elevated privilege enters the container. The driver also
enforces a 195-second command deadline and force-removes a lingering container.
The overall dedicated workflow has a 20-minute limit. Image pull and trusted
extension build have separate 180/300-second deadlines. Image preparation is
networked and separate from offline PHP execution. Its failure diagnostics are
public-safe because this phase precedes all third-party source downloads.

`replay.php` is original Oracle-owned inspection code. Each scenario starts a
fresh source copy and SQLite DB, init/seed and PHP server. Before/after snapshots
preserve relevant schema, column/PK metadata, SQLite storage types, int64 strings,
blobs, row order and sequences. Raw body/header/request bytes, full snapshots,
bootstrap/lint/error logs remain in private container tmpfs. Only declared safe
public probe inputs are sent (grading submits no question answers). Snapshot
inspection does not modify source/application state. No upstream tests or
expected-answer fixtures are reused.

The host publishes `qualification-public/qualification-summary.json` containing
only known scenario/step IDs, actual statuses, counts, checks, hashes and runtime
metadata. That directory should be outside version control; review the summary
before copying it to `specs/006-php74-qualification/`. Raw evidence is **destroyed**
when the container exits. No private external storage is configured; hashes and
this reproduction recipe remain, not an independently retained raw evidence pack.
Sanitized reference observations are not candidate parity or product acceptance.

Each of three scenarios runs twice from clean state. A two-second gap deliberately
exposes wall-clock instability; no business value is stripped. Exact hashes include
UUIDs, generated IDs, timestamps, random selections and HTML bytes. Equal HTTP
object order is not inferred here: this is reference repeatability, separate from
the unchanged production comparator. Failing critical assertions or unequal exact
replay hashes produce NO-GO for exact-replay benchmark selection. An observed
operational application can still require independently agreed metamorphic checks.
Infrastructure preventing execution is BLOCKED, never a compatibility verdict.

Primary: ExamSuite commit `444a2f71491b755ab3f84dbaa3e4ebf5f2227805` (MIT,
copyright 2026 MarionForm). Only after a measured primary NO-GO/blocker does the
driver attempt car-workshop commit `d272170d0aecbd28eb5b13e272d9dd11d545b66c`
(MIT, copyright 2026 Tanjila Afsari Rubina). The archive retains LICENSE, and the
license hash is verified again inside the container. No upstream source is vendored.

After both ordinary profiles return measured NO-GO, a predeclared third profile
`workshop-clock` runs the same source with the PHP server's wall clock fixed at
`2026-10-27 12:00:00 UTC`. The parent inspector/deadlines use real time. The library
is loaded only inside that PHP child, with real monotonic time; before admitting
source, a trusted child confirms actual PHP UTC and SQLite `datetime('now')` both
equal the requested value. Its Debian library version and retained copyright hash
are recorded. No system-wide clock, RNG, source, fields or normalizer changes.
All timestamp values remain present and must match exactly. This profile covers
sequential scenarios only: real-clock behavior, clock advances, midnight boundaries
and concurrent booking semantics remain NOT_RUN. See the pre-execution plan for
the declared control and [upstream usage documentation](https://github.com/wolfcw/libfaketime#readme)
for absolute stopped clocks and real-monotonic caveats.

The dedicated workflow's initial PR trigger is temporary, exact branch and
same-repo guarded; final delivery keeps manual dispatch only. After it is merged
by independent review, run manually with:

```sh
gh workflow run php74-qualification.yml --repo Meta-Project2026/Metamorph --ref <reviewed-ref>
```

No workflow_dispatch execution is claimed before the workflow exists on default
branch. See the qualification report for actual job URLs, SHAs and outcomes.
