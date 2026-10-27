# MMP-007-R1 validation — 2026-10-27

Status: implementation and local validation in progress; hosted proof pending.
No product G0-G4 acceptance. Historical MMP-007 receipts are unchanged.

Base freshly fetched origin/main: 4ad59f99cee1a77eb84f7b2dce41b163e7ca3bea.
Clean checkout; no open PRs or pre-existing R1 fixes observed. Branch:
fix/mmp-007-r1-worker-lifecycle. Issue #15 and PR #13 review read through gh.
Local Docker absent (Get-Command docker returned no executable); no installation
or host execution of candidate TS/JS. Authorized hosted manual workflow is used.

| Area | Before | R1 |
| --- | --- | --- |
| Startup | Detached launch, caller sleeps | Bounded independent GET /items, launch/State checks, generation identity |
| Reset resources | Old stopped container/DB retained | Remove + actual inventory verification before next generation |
| Budget | 180s renewed per reset | Monotonic deadline from first operation; reset16/operation128 caps |
| Errors | Candidate often ENVIRONMENT_ERROR | Receipt-based WorkerError.code; sticky cleanup failure priority |
| Image trust | Arbitrary digest accepted | Host broker build/inspect/hash/toolchain capability; no crypto attestation |

Local Node22.23.1 / pnpm11.25.0. Dedicated tests currently32/32 exit0;
these include trusted CLI simulations and actual admission filesystem controls.
They are not Docker replay. Final commands, exit statuses, source SHA, hosted
run/job/artifact links, measured image/runtime versions and individual controls
will be recorded after actual execution.

20 original controls are retained, with expected error-category changes supported
by receipts: launch failures reject during readiness as RUNTIME_FAILED instead of
later ENVIRONMENT_ERROR; malformed HTTP is reported by trusted readiness parser;
DB parser failures become OBSERVATION_ERROR; infinite loop reaches startup TIMEOUT.
The former Docker-wait timeout operation is retained as separate bounded-cli-wait.
New Docker controls: slow startup/immediate request, never listener, wrong port,
wrong response, hung HTTP, eight resets/inventories, real aggregate deadline,
abort pending readiness. The abort uses a trusted scheduling wrapper around actual
Docker commands, without replacing isolation or patching candidate Date.

Trusted simulation coverage includes stale runtime/scenario results, partial
volume provisioning cancellation, early exit, build-vs-infrastructure errors,
stop/rm/volume-rm faults and retries, inspect refusal after creation, empty Sets
with actual simulated inventory residue, exclusive reset and close coordination,
fake monotonic deadline and reset/operation boundary caps. Real daemon fault
injection/hung-daemon behavior is NOT_RUN; simulation receipts are not real faults.

Remaining NOT_RUN: full independent G0; PHP-TS G2/G3; held-out G4; benchmark
registration; advancing-clock/DST; scenario concurrency; live Meta; shared API
agreement. Original clock probe is preserved; new replay status pending.

## First hosted replay (superseded, failure retained)

[Run40432293154](https://github.com/Meta-Project2026/Metamorph/actions/runs/40432293154),
[job121952638738](https://github.com/Meta-Project2026/Metamorph/actions/runs/40432293154/job/121952638738),
checkout516f6e3642e039efcdfbcc290466e1eca4fd844e: boundary31/31, smoke exit1.
15 completed controls and failing corrupt-db receipt were downloaded and read.
Actual corrupt-db launch exits1 with ERR_SQLITE_ERROR ('file is not a database')
during independent readiness GET /items; cleanupVerified=true. Former expectation
of later OBSERVATION_ERROR was wrong for this earlier executed read. R1 now
requires RUNTIME_FAILED plus exit1/ERR_SQLITE_ERROR for this original control,
and adds corrupt-db-independent-parser: corrupt after readiness, require separate
inspector exit1/ERR_SQLITE_ERROR and OBSERVATION_ERROR. No acceptance weakened.
Malformed HTTP is independently reported as MALFORMED_HTTP in inspector receipt;
raw parser stderr is no longer the decision source. Clocks/later controls were
NOT_RUN in this failed attempt. Node24.11.0, SQLite3.50.4, TypeScript5.9.3,
libfaketime0.9.10-2.1 measured; Docker28.0.4, host Node24.21.0. Actual image
sha256:96ad221b47d9121ef5c8d915889c192431ec76ca4f4062c0630812a898ade2a6.
[Fast CI40432293472](https://github.com/Meta-Project2026/Metamorph/actions/runs/40432293472)
passed Node22/24 for that source only; final HEAD replay remains pending.
