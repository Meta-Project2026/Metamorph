# Offline execution record

Execution head: `b421465307d4dde3101ccbc4309660b5884d297e` (clean Linux Git
checkout from a local Git bundle). Windows host Node 22.23.1/pnpm 11.25.0;
Linux trusted orchestration Node 22.23.1/pnpm 11.25.0, Docker Desktop engine
29.9.2 amd64. Compiler/runtime workers use the unchanged measured recipe and
their own pinned Node 24.11.0/TS5.9.3/@types22.20.5/SQLite3.50.4.

## Actual paid validator CLI matrix

`node research/mmp-086/offline-matrix.mjs` exited **0**, eight controls PASS.
The driver writes a private synthetic post-response transfer and a clearly
labelled `mmp086-synthetic-transfer-v1` trial, then starts the **unchanged**
`node research/mmp-078/validate-candidate.mjs` in a fresh Linux process per case.
Its required modelGeneration=GENERATED field is a synthetic transfer fixture,
not a claim of inference: aiGeneration=AI_GENERATION_NOT_RUN, generatedRequests=0.
No provider/paid authorization is constructed. The CLI calls the genuine
validateGeneratedMigration → source lease → RealVerifier → Docker G1 →
publicAttempt chain and writes the actual trial.json inspected by assertions.

Only the positive control reuses the existing immutable public workshop fixture.
All failure sources are tiny original synthetic expressions in the test driver,
written outside Git for execution. The driver never imports or runs them on the
host. Their actual compiled output/errors stay private; public JSON has only
gate, coverage, sidecar, identity and cleanup fields. All eight children have an
additional trusted HTTP/fetch guard: only the exact pinned public source archive
fetch is admitted. Each observed one source fetch, zero blocked attempts, no
mapped Meta credential. Docker registry preparation is separate from host fetch;
this is structural isolation evidence, not a packet-capture claim.

| Case | Child exit | G1 / G2 / G3 | Actual diagnostic (`src/main.ts`) | Coverage HTTP / SQLite |
| --- | --- | --- | --- | --- |
| positive-public-replay | 0 | PASS / PASS / PASS | DIAGNOSTIC_UNAVAILABLE: no compiler error on PASS | 17/17 / 20/20 |
| strict-assignment | 1 | FAIL / INCONCLUSIVE / INCONCLUSIVE | AVAILABLE TS2322, 1:14 | 0/17 / 0/20 |
| unresolved-module | 1 | FAIL / INCONCLUSIVE / INCONCLUSIVE | AVAILABLE TS2307, 1:23 | 0/17 / 0/20 |
| implicit-any | 1 | FAIL / INCONCLUSIVE / INCONCLUSIVE | AVAILABLE TS7006, 1:22 | 0/17 / 0/20 |
| malformed-source | 1 | FAIL / INCONCLUSIVE / INCONCLUSIVE | AVAILABLE TS1109, 1:22 | 0/17 / 0/20 |
| commonjs-top-level-await | 1 | FAIL / INCONCLUSIVE / INCONCLUSIVE | AVAILABLE TS1309, 2:1 | 0/17 / 0/20 |
| commonjs-import-meta | 1 | FAIL / INCONCLUSIVE / INCONCLUSIVE | AVAILABLE TS1470, 1:24 | 0/17 / 0/20 |
| sqlite-row-narrowing | 1 | FAIL / INCONCLUSIVE / INCONCLUSIVE | AVAILABLE TS2322, 3:7 | 0/17 / 0/20 |

Every failure executed only workshop-business:typecheck. All seven real compiler
failures retained BUILD_FAILED, errorCount=1, truncated=false, one exact
candidate-bound sidecar and no G2/G3 false PASS. All eight normal finalizations:
0 containers, 0 volumes, 0 emergency removals. The positive executed three fresh
pairs; negative controls stopped after one failed-build pair. G0/G4 remained
INCONCLUSIVE and product NOT_ESTABLISHED throughout. The unchanged formatter
really produced the listed codes/positions; they were not supplied as receipts.

Receipts: [matrix summary](evidence/linux/matrix/matrix.json) and
`evidence/linux/matrix/<case>.json`. Each saves child exit, guard observation,
actual trial.json, sourceSha/candidateSha/attemptId/pairId binding, packs' hashes,
and checked private-workspace availability. Exact admitted source and trusted raw
build receipts were present in private packs after the CLI returned; all negative
cases had genuine private compiler-error headers. Only booleans are published.
The availability checks do not provide durable or post-run human access.

Missing src/main.ts and package.json paths were rejected by the real admission
function before Docker; compiler status NOT_RUN. These are admission controls,
not invented TS codes. Three additional **SYNTHETIC_ENVELOPE_ONLY** controls in
receipt-controls.mjs exercise observeBuild → publicAttempt: outer timeout→G1
ERROR/TIMEOUT; spawn failure→ERROR/ENVIRONMENT_ERROR; compiler-process ETIMEDOUT
envelope→ERROR/ENVIRONMENT_ERROR. All publish DIAGNOSTIC_UNAVAILABLE and zero
coverage, with no PASS. They are not real Docker timeout experiments. The original
Docker proof separately exercises actual timeout/crash/cancellation controls.

## Fast checks and harness correction

Frozen install exited 0 on Windows and Linux; lockfile unchanged. Detailed exits
and TAP counters: [Windows](evidence/windows-checks.json),
[initial Linux](evidence/linux/linux-checks.json),
[corrected Linux](evidence/linux/linux-corrected-umask-checks.json).

| Command | Windows | Linux |
| --- | --- | --- |
| pnpm lint | exit 0 | exit 0 |
| pnpm typecheck | exit 0 | exit 0 |
| pnpm test | exit 0; 337 PASS / 102 SKIP / 0 FAIL | exit 0; 438 PASS / 1 SKIP / 0 FAIL |
| pnpm build | exit 0 | exit 0 |
| pnpm exec biome check research/mmp-086 | exit 0 | exit 0 |
| pnpm --filter @metamorph/oracle test:reference | NOT_RUN | initial exit 1 (55 PASS/1 FAIL); corrected exit 0 (56/56) |
| pnpm --filter @metamorph/target-worker test | NOT_RUN | exit 0; 69/69 |
| pnpm --filter @metamorph/differential test | NOT_RUN | exit 0; 122/122 (also repeated under corrected umask, 122/122) |
| node --test packages/oracle/probes/qualification.test.mjs | NOT_RUN | exit 0; 2/2 |
| pnpm --filter @metamorph/workshop-audit test | NOT_RUN | exit 0; 54/54 |
| pnpm exec biome check research/demo-readiness research/mmp-069 | NOT_RUN | exit 0 |
| node research/mmp-069/validate.mjs | NOT_RUN | exit 0 |

The initial Linux **test harness** set umask 0077 for child commands. That made
reference.test.mjs's deliberately insecure mkdir(mode=0755) become 0700; the
expected permission rejection did not occur ("Missing expected exception" at
line 568). Restoring normal umask 0022 made the unchanged test pass. No test,
production permission check, recipe or fixture was weakened. Both outcomes are
retained. Windows skips are platform-dependent filesystem/admission tests; the
one Linux root-suite skip is a Windows-only fixture. Other tests executed in the
root-owned trusted runner; hosted unprivileged Node22/24 CI is reported separately.

The focused encoder/paid-admission tests also passed 72/72 on Windows, exit 0.
New request audit regenerated identical identities on Windows and Linux. These
checks do not verify Meta acceptance of the changed prompt or a model output.

Ordinary hosted [Fast CI 40937423202](https://github.com/Meta-Project2026/Metamorph/actions/runs/40937423202)
passed on the exact code head on both Node 22 and Node 24. Each root suite:
436 PASS / 3 SKIP / 0 FAIL out of 439 (one Windows-only fixture and two root/chown
fixtures unavailable to the hosted unprivileged user). Reference 56/56, target
69/69, differential 122/122, qualification 2/2 and audit 54/54 on both versions.
The active research lint and coverage-matrix validator also passed. Counts and
job URLs: [fast-ci-code-head.json](evidence/fast-ci-code-head.json).

## Original Docker controls and independent inventory

The unchanged `packages/agent-real/src/proof.mjs` ran separately after the matrix,
with no concurrent worker experiment. Actual command:
`node --import ./research/mmp-086/network-guard.mjs packages/agent-real/src/proof.mjs`,
with AGENT_HEAD_SHA set to the execution head, AGENT_PUBLIC_OUTPUT pointing to an
external public directory, TMPDIR to the private Linux volume, and RUNNER_TEMP to
a separate guard-receipt directory. Exit **0**, **PASS_SCOPED**, errorCode=null.
Its source-fetch guard recorded one pinned archive download and no blocked request.

| Original attempt | G1 | G2/G3 | HTTP / SQLite |
| --- | --- | --- | --- |
| known-good replay | PASS | PASS / PASS | 17 / 20 |
| deliberate cancellation defect | PASS | FAIL / FAIL | 17 / 20 |
| deterministic repair | PASS | PASS / PASS | 17 / 20 |

Totals: **51 HTTP / 60 SQLite**; including the new positive CLI control, this
task executed **68 HTTP / 80 SQLite** comparisons. The repair is unchanged
offline replay, not model repair or repair of the historical paid candidate.
Agent verdicts remain INCONCLUSIVE because G0/G4 are not established.

All six existing real Docker controls passed: candidate-aux-enospc,
candidate-wal-full, corrupt-db-rejected, hung-socket-timeout, process-crash and
cancel-readiness. Each verified normal cleanup. The last three assert actual
TIMEOUT/RUNTIME_FAILED/CANCELLED behavior, separately from the synthetic G1
receipt-envelope tests. Whole-proof completion: VERIFIED_ZERO_RESOURCES, 0/0/0.

Before finalization, daemon inventory contained only the trusted helper runner,
its one named helper volume and a pre-existing unrelated stopped hello-world
container; no worker/worker-state resources remained. Then the unchanged
`node packages/differential/src/workshop-finalizer.mjs` ran with PILOT_HEAD_SHA
and WORKSHOP_PUBLIC_OUTPUT for this proof: exit **0**, status **PASS**, inventory
containers=0/volumes=0, emergencyRemoved=0. It removed nothing.
Receipts: [summary](evidence/linux/original-proof/summary.json),
[guard](evidence/linux/original-proof/network.json),
[finalizer](evidence/linux/original-proof/finalizer.json).
No previous MMP-082 success is substituted for this execution; one local success
does not establish that the intermittent issue #84 is fixed.

## Reproduce on trusted Linux with Docker

Use a clean checkout of the pinned head and a daemon without other Metamorph
worker experiments. No Meta key, GitHub token or OIDC capability is needed.
The orchestrator is trusted; never mount its Docker socket or source/reference
directories into candidate workers. Candidates receive only the existing stdin
transfer and network-off worker isolation. Prepare public source/images using
the unchanged trusted code; retain all dependency notices.

```sh
pnpm install --frozen-lockfile
pnpm build
node research/mmp-086/audit-request.mjs /tmp/request-audit.json
export AGENT_HEAD_SHA="$(git rev-parse HEAD)"
export MMP086_PUBLIC_OUTPUT="$(mktemp -d)"
node research/mmp-086/offline-matrix.mjs
export AGENT_PUBLIC_OUTPUT="$(mktemp -d)"
pnpm --filter @metamorph/agent-real proof
```

Expected matrix driver exit 0 means all *control assertions* passed; negative
validator children must exit 1 and retain G1 FAIL. Inspect the JSON rather than
calling a failed candidate successful. Run fast checks with normal umask 0022;
matrix/private evidence explicitly set owner-only modes independently.

For this Windows-hosted run, a separate trusted Linux orchestration container
used a clean Git bundle checkout and a named Linux volume mounted at its daemon
mountpoint, so the unchanged sibling PHP bind paths resolved correctly. No
Windows line-ending normalization or runtime-recipe repinning was used. Only the
trusted runner held the Docker socket. No host credential/env was forwarded;
candidate workers kept the original nonroot/read-only/cap-drop/network-off,
256 MiB, one CPU and PID/timeout budgets. The helper runner and its private volume
are cleaned after extracting allowlisted public evidence, separately from worker
inventories. Image/build caches are not counted as containers or state volumes.
