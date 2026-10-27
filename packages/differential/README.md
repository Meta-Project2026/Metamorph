# Real PHP / TypeScript differential bridge — MMP-008A

Oracle-owned trusted orchestration, without a migration model or new comparator.
Uses the real PHP `PhpReferenceWorker`/`DockerReferenceTransport` and the real
`TargetWorker`/`buildTrustedRuntime()` from accepted source. Neither is modified.
The current TS source is the original public `/items` mini-API, **not** car-workshop.
The expected initial schema mismatch must produce actual G3 FAIL and zero HTTP
comparisons (G2 INCONCLUSIVE), never a successful migration claim.

From repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @metamorph/differential test
# Authorized dedicated disposable Linux x86_64 Docker host only:
PILOT_HEAD_SHA=$(git rev-parse HEAD) node packages/differential/src/pilot.mjs
```

No untrusted PHP/TS/SQLite is executed, compiled or opened on host. Tests open only
this package's original synthetic SQLite fixture. MJS/JSDoc implements the bridge;
TypeScript checks a local boundary declaration, not candidate source. Trust-owned
imports of current controller APIs and unexported Oracle validators are pinned to
the repository revision; no shared DTO changes or both-owner agreement are implied.

Runtime builds precede candidate admission. PHP pins/source/license/clock come
from `SOURCE`; target broker verifies Node24.11.0 / SQLite3.50.4 / TS5.9.3 /
libfaketime0.9.10-2.1 and measured recipe/image identity. The exact original TS
bundle is pinned in `policy.mjs`, independently of PHP. Target Date/Date.now/SQLite
wall clocks and performance/hrtime real timers are measured in the actual image
before admission and in the active target container after provision. The fixed
profile is 2026-10-27 12:00:00 UTC. Failure is CLOCK_PARITY_BLOCKED.

`provision()` already resets target to public-initial. The bridge captures that
clean state; subsequent Oracle reset consumes a copied immutable scenario schedule,
creates independent state, and rejects dirty reset against that baseline. One
workshop-business scenario intentionally fits the aggregate180s target lifetime,
including in-container compilation, readiness and inspections. Target limits
(128 operations, 16 resets including provision, 15s operation, 10s startup) remain
unchanged. Oracle operations are bounded30s. Requests admit only exact manifest
method/path/body/step and trusted inspector identities. Snapshots use the existing
independent inspector, not an app `/snapshot` endpoint. Raw inspector JSON is also
checked before lossy duplicate-key parsing; `x-request-id` is service identity,
while the existing stable business header comparison remains unchanged.
Current target path admission also excludes `.` in `/api.php`, and its HTTP client
forces application/json instead of workshop form-urlencoded. Initial mismatch
skips those requests in this pilot; future HTTP parity needs a two-owner transport
proposal. This bridge forwards exact inputs and must fail instead of rewriting them.

Target sqlite wire is validated before a proven `mapPhpSnapshot` conversion:
`tbl`→`tbl_name`→`table`, null adds then removes its wire value, all other scalar
types stay exact. Schema/table/column order and metadata are checked; DDL bytes
are never rewritten. Core row canonicalization follows existing PK numeric order
and full-row multiset semantics, retaining duplicates/sequence/defaults. Full
PRAGMA metadata remains in private raw evidence; declared type/nullability/default
are represented in core comparison by unchanged DDL. Hidden/generated/virtual
features, unknown/partial shapes, nonfinite scalars or invalid UTF8 fail closed.

Separate images, containers, loopback namespaces and DB volumes prevent candidate
access to PHP source/state/Oracle packs, Docker socket or credentials. App roots
are readonly, UID unprivileged, cap-drop ALL/no-new-privileges, CPU/RAM/PIDs/tmpfs
and deadlines bounded by existing owners. **Limitation:** accepted target uses a
regular Docker DB volume with a16MiB inspector admission limit, not a hard write
quota. The pinned original fixture and this no-business-HTTP pilot have bounded
observed state; no adversarial write-quota guarantee or general candidate isolation
certification is claimed. A hard target state quota needs an owner-approved API.

Private POSIX workspace is0700 outside checkout; pilot uses umask077. Existing
PrivateEvidence packs retain actual worker stdout/stderr, source/clock/identity,
full HTTP/SQLite and actual Oracle publication. Oracle raw artifacts remain under
a separate private parent; a bounded catalog copies their bytes into an atomic
hash-indexed private pack. Hashes are verified **after** cleanup. Raw errors, paths,
DDL, bodies, gate-results/report.html never enter public upload or LLM feedback.
Only `summary.json`/`error.json` are regenerated for public artifact upload.

Cleanup joins active work, closes both owners, checks actual Docker inventory and
records original operation error separately from sticky cleanup error. An emergency
ledger finalizer removes only owned names/prefixes on this dedicated host and
does not turn a cleanup error into success. Same-UID/root/daemon compromise is
outside owner-only filesystem protection. Raw survives worker teardown, then is
destroyed with the ephemeral runner: **EVIDENCE_RETENTION_NOT_CONFIGURED /
EXTERNAL_RETENTION_NOT_RUN**. No encryption/upload recipient is configured.

Own workflow uses manual dispatch plus a temporary same-repo exact-feature-branch
PR bootstrap (no fork execution, secrets or pull_request_target). It checks out
the exact PR head SHA and keeps Fast CI unchanged. Remove the bootstrap trigger
after registration on main as a separately reviewed workflow change.
See `specs/009-real-differential/` for executed results and the target-owner handoff.
