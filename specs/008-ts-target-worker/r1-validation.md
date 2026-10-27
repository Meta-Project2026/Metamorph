# MMP-007-R1 validation - 2026-10-27

Status: implemented; qualified-source Docker replay passed30/30 controls.
Final delivery HEAD is replayed separately; exact final SHA/run/job/artifact
receipts are published in [PR16](https://github.com/Meta-Project2026/Metamorph/pull/16).
This record explicitly identifies its qualified source; do not substitute it
for the final-HEAD replay.
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

Local Node22.23.1 / pnpm11.25.0. Dedicated tests currently33/33 exit0;
these include trusted CLI simulations and actual admission filesystem controls.
They are not Docker replay. Actual local commands and exit statuses are retained in
[r1-local-checks.json](r1-local-checks.json), explicitly marked pre-final-commit
working-tree checks. Every listed command exited0: frozen install, lint,
typecheck, root65/65 tests, build, dedicated33/33 tests, diff check. Final exact-HEAD
Fast CI and Docker receipts are separately linked from PR16.

20 original controls are retained, with expected error-category changes supported
by receipts: launch failures reject during readiness as RUNTIME_FAILED instead of
later ENVIRONMENT_ERROR; malformed HTTP is reported by trusted readiness parser;
DB parser failures become OBSERVATION_ERROR; infinite loop reaches startup TIMEOUT.
The former Docker-wait timeout operation is retained as separate bounded-cli-wait.
New Docker controls: slow startup/immediate request, never listener, wrong port,
wrong response, hung HTTP, eight resets/inventories, real aggregate deadline,
abort pending readiness. The abort uses a trusted wrapper that cancels immediately
after a real readiness probe receipt, while reset is pending; no Docker result is replaced or Date patched.

Trusted simulation coverage includes stale runtime/scenario results, partial
volume provisioning cancellation, early exit, build-vs-infrastructure errors,
stop/rm/volume-rm faults and retries, inspect refusal after creation, empty Sets
with actual simulated inventory residue, exclusive reset and close coordination,
fake monotonic deadline and reset/operation boundary caps. Real daemon fault
injection/hung-daemon behavior is NOT_RUN; simulation receipts are not real faults.

Remaining NOT_RUN: full independent G0; PHP-TS G2/G3; held-out G4; benchmark
registration; advancing-clock/DST; scenario concurrency; live Meta; shared API
agreement. Original clock probe is preserved and passed in the qualified replay below.

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
passed Node22/24 for that source only; that earlier receipt does not qualify final HEAD.

## Qualified replay and downloaded evidence audit

Qualified source: `789068284a491e5f3e417dc1252aea9a4bf2a2cc`.
[Run40432759522](https://github.com/Meta-Project2026/Metamorph/actions/runs/40432759522),
[job121954161764](https://github.com/Meta-Project2026/Metamorph/actions/runs/40432759522/job/121954161764):
checkout matches source; boundary32/32 exit0; actual Docker procedure30/30 exit0;
artifact upload and fallback reap success. [Fast CI40432766774](https://github.com/Meta-Project2026/Metamorph/actions/runs/40432766774)
passed Node22/24 for that exact source. Full job log and individual receipts read.

[Raw artifact12702707691](https://github.com/Meta-Project2026/Metamorph/actions/runs/40432759522/artifacts/12702707691),
ZIP SHA256 `af4eff2e8282180423f5faaa42f3bca55e4be2c63c2815aecf4c76c61036ec7d`
was downloaded as binary via gh API and hashed; matches Actions metadata/log.
[r1-qualified-audit.json](r1-qualified-audit.json) records actual per-case hashes,
exit codes, readiness reasons and zero final Docker inventories. This is an
author audit, not independent owner approval. All30 cases have cleanupVerified;
no raw receipt has cleanupError. Eight reset snapshots each show exactly one
current container and one DB, with zero past generations before final close;
final close inventory has zero of each. No candidate ran on Windows.

Measured: host Node24.21.0; Docker client/server28.0.4; image Node24.11.0,
SQLite3.50.4, TypeScript5.9.3, libfaketime0.9.10-2.1. Actual qualified image
`sha256:3b09a68f7215319bc94d1521e748e284c9154bda46befb947b733f53012059ef`.
RepoDigests is empty for this locally built image, not an invented registry digest.
Pinned base digest, recipe/file hashes and measured provenance are in raw evidence.

All commands were actual: `gh workflow run ts-target-worker.yml --repo
Meta-Project2026/Metamorph --ref fix/mmp-007-r1-worker-lifecycle` exit0;
`gh run view ... --log`, `gh run download ...`, `gh api .../artifacts` and binary
artifact download exit0. Inner typecheck/build receipts and candidate/inspector
exits are retained individually. Local Docker execution remains NOT_RUN because
Docker is absent; hosted Docker execution is a separate executed fact.

| Control | Actual qualified result |
| --- | --- |
| public-write-read-reset | PASS_SCOPED; cleanup verified, final inventory0/0 |
| syntax-error | BUILD_FAILED; cleanup verified, final inventory0/0 |
| type-error | BUILD_FAILED; cleanup verified, final inventory0/0 |
| invalid-import | BUILD_FAILED; cleanup verified, final inventory0/0 |
| bad-startup | RUNTIME_FAILED; cleanup verified, final inventory0/0 |
| crash | RUNTIME_FAILED; cleanup verified, final inventory0/0 |
| oom | RUNTIME_FAILED; cleanup verified, final inventory0/0 |
| blocked-npm-script | RUNTIME_FAILED; cleanup verified, final inventory0/0 |
| blocked-php-process | RUNTIME_FAILED; cleanup verified, final inventory0/0 |
| blocked-reference-file | RUNTIME_FAILED; cleanup verified, final inventory0/0 |
| blocked-external-network | RUNTIME_FAILED; cleanup verified, final inventory0/0 |
| infinite-loop-timeout | TIMEOUT; cleanup verified, final inventory0/0 |
| bounded-cli-wait | PASS_SCOPED; cleanup verified, final inventory0/0 |
| cancel-reap | PASS_SCOPED; cleanup verified, final inventory0/0 |
| malformed-http | RUNTIME_FAILED; cleanup verified, final inventory0/0 |
| corrupt-db | RUNTIME_FAILED; cleanup verified, final inventory0/0 |
| missing-db | OBSERVATION_ERROR; cleanup verified, final inventory0/0 |
| wrong-snapshot-source | OBSERVATION_ERROR; cleanup verified, final inventory0/0 |
| corrupt-db-independent-parser | OBSERVATION_ERROR; cleanup verified, final inventory0/0 |
| ignore-candidate-snapshot-endpoint | PASS_SCOPED; cleanup verified, final inventory0/0 |
| typed-sqlite | PASS_SCOPED; cleanup verified, final inventory0/0 |
| nonfinite-sqlite-rejected | OBSERVATION_ERROR; cleanup verified, final inventory0/0 |
| slow-startup-no-client-sleep | PASS_SCOPED; cleanup verified, final inventory0/0 |
| never-listen | TIMEOUT; cleanup verified, final inventory0/0 |
| wrong-port | TIMEOUT; cleanup verified, final inventory0/0 |
| wrong-response | RUNTIME_FAILED; cleanup verified, final inventory0/0 |
| hung-http | TIMEOUT; cleanup verified, final inventory0/0 |
| eight-resets-resource-inventory | PASS_SCOPED; cleanup verified, final inventory0/0 |
| aggregate-deadline-real-monotonic | TIMEOUT; cleanup verified, final inventory0/0 |
| abort-pending-readiness | CANCELLED; cleanup verified, final inventory0/0 |

Clock raw receipts: real monotonic delta1201.360458ms; fixed1202.343828ms;
wrong-wall1201.328012ms. Fixed Date/Date.now and both SQLite functions remain
2026-10-27 12:00:00 UTC, while performance/hrtime advance; wrong wall12:00:01 is
rejected. No frozen-clock control, business timestamp or Oracle normalizer changed.

After this qualified source, final changes bound Docker State inspect to remaining
startup time, add the inspector-removal fault test (33 total), and strengthen the
real overall-budget proof: exactly two successful resets with equal original
deadline, followed by actual bounded docker-wait until expiry/forced cleanup.
Its trusted reduced lifetime is20s; earlier qualified replay used12s and is
not claimed as that strengthened proof. PR16 contains final exact-source receipts.

Safety diff is limited to target-worker source/runtime/tests/README and this
spec directory. Historical evidence, original public fixture, shared packages,
PHP worker, governance, feature pointer, dependency locks and both workflows are
unchanged. Full G0/G2/G3/G4 acceptance and cross-owner agreement remain pending.
