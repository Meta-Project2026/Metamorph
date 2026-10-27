# MMP-008B target handoff

Owner delegation in Issue #21 permits Ilia's target implementation and this PR;
it does not record Vladimir's agreement or authorize self-merge.

`TargetWorker(runtime, admittedBundle, clock, {profile: WORKSHOP_PROFILE})`
selects trusted `car-workshop-v1`. Only module-issued frozen singleton profiles
are accepted; the default remains `public-items-v1`. The candidate supplies only
admitted TS source bytes. Runtime capabilities, source hash, policy, resource
limits, scenario schedule and inspector actions stay in trusted orchestration.
No shared DTO or Oracle comparison policy changes are required.

Workshop paths are exact ASCII `/api.php` action/query templates. GET has no
body or form MIME; POST preserves canonical URLSearchParams bytes including the
empty string with `application/x-www-form-urlencoded`. Duplicate/unknown keys,
encoding aliases, invalid UTF-8, control characters, traversal, extra query keys
and rewritten paths fail closed. The adapter additionally binds byte-for-byte
requests to immutable MANIFEST order. Independent inspector receipts bind request
ID, runtime generation, scenario and source identity as before.

`loopback-connect-v1` readiness uses a bounded independent inspector TCP connect
and controller Docker process-state check. It sends no business HTTP request and
does not inspect a candidate-supplied health JSON verdict. It proves socket/process
availability only; the Oracle still compares full initial DB before any business
step. Crash/stale/cancel/deadline checks remain controller-owned.

Workshop `/state` is a fresh Docker local tmpfs volume, size 16 MiB, uid10001,
gid10002, mode0750, noexec/nosuid/nodev, with volume-nocopy. Candidate gets RW;
inspector UID10002 gets a separate readonly mount. DB, rollback journal, WAL and
auxiliary files share one write-time quota. `/work` and `/tmp` remain separately
bounded tmpfs, root readonly, network none, nonroot, cap-drop, no-new-privileges,
1CPU/256MiB/64PIDs. Aggregate real monotonic lifetime remains180s across resets;
cleanup does not renew useful work. A trusted Docker daemon/kernel and disposable
Ubuntu amd64 runner are assumed; this is not protection against daemon/root or
kernel compromise. Original items storage behavior is retained.

`workshop-pilot.mjs` is additive. It uses real verifyPair per scenario on fresh
PHP/TS workers, twice, checks exact coverage union, and retains per-run gates.
No aggregate Oracle gate is invented. G0/general source completeness, held-out G4,
registration and product acceptance remain unestablished. `pilot.mjs`, original
items fixture and Oracle runner/comparators/controls are unchanged.

Raw command/HTTP/SQL/DB/diagnostic receipts stay outside Git and public artifact
paths on owner-only POSIX storage. Atomic receipts are0600; packs are sealed and
verified after teardown. Public summaries rebuild only explicit structural fields;
hashes establish integrity, not durable retention. External retention is NOT_RUN.
Only summary/completion/error/finalizer/regression JSON files are uploaded.

The real candidate adapts verified MIT `tanjilaafsarirubina/car-workshop` at
`d272170d0aecbd28eb5b13e272d9dd11d545b66c`; full original copyright/license is in
`fixtures/workshop/src/schema.ts`, alongside verbatim source DDL and mechanic seed
values. New TS implementation/orchestration is original task work, not an AI
migration-engine result. Node/TypeScript/runtime dependencies retain their existing
upstream notices and pinned runtime recipe. Independent review remains required.
