# MMP-034: independent items-smoke / Docker cleanup incident review

Investigation date: 2026-10-28. Issue: [#34](https://github.com/Meta-Project2026/Metamorph/issues/34).
Scope: forensic research and an additive, manual, original-public-fixture-only
diagnostic. Root cause: **NOT_ESTABLISHED**. Historical regressions: **ERROR**.
No production fix, G4 run, product acceptance or reinterpretation of PR #31's
**AUDIT_FAIL** is supplied by this report.

## 1. Evidence inventory and boundaries

Fetched `origin/main` before investigation; exact base:
`1aa36b8f4ab7a6f1d8f291d8751856ed51274685`. Work is on the separate
`Vladimir/mmp-034-items-smoke-cleanup` branch/worktree. The shared checkout and
#26/#54 branches are outside write scope. Root AGENTS, README, constitution,
008 worker spec/plan/tasks and 017 G4 protocol/local-first decision were read.
The approved local-first policy does not establish an installed local Docker
daemon, custody or formal run authorization.

Evidence classes:

- **Observed historical public evidence:** GitHub REST run/job/artifact metadata,
  downloaded public JSON receipts and strictly reduced public job-log facts.
  These are observations of old attempts, not new reproductions.
- **Static source evidence:** exact Git objects, byte hashes and control-flow
  inspection. This establishes code identity/possible transitions, not the
  transition actually taken by a failed historical worker.
- **New local evidence:** dependency installation, Docker-free checks and
  sanitizer tests. These cannot establish Docker reliability.
- **Missing:** historical private child logs/per-case receipts, smoke-job Docker
  versions/image IDs, first failed case/stage, CLI failure receipts and pre-removal
  resource identities. No private log was requested, downloaded or given to a
  model. Raw public job logs were reduced inside a short-lived trusted process;
  only enumerated facts and version strings entered the research output.

The retained [historical-evidence.json](historical-evidence.json) contains exact
run/job timestamps, step metadata, artifact API URLs, original public-file byte
lengths/SHA-256 and allowlisted projections. No ZIP or raw job log is retained.
[source-identities.json](source-identities.json) contains exact Git object IDs,
runtime file SHA-256 and the runtime broker's sorted-hash-map recipe digest.
[public-summary.json](public-summary.json) separates historical observations from
this execution. [new-execution.json](new-execution.json) records the new controlled
run, jobs, artifact URLs and validated receipts. [checksums.json](checksums.json) hashes retained evidence files;
the Git commit identifies the report and diagnostic sources without self-hashes.

### Historical run/job/receipt links

All timestamps below are UTC; all jobs selected `ubuntu-24.04`.

| Attempt | Executed source SHA | Regression job | Regression interval | Items / negative / finalizer |
| --- | --- | --- | --- | --- |
| [40572153508/1](https://github.com/Meta-Project2026/Metamorph/actions/runs/40572153508/attempts/1) | `d15daefdcde0c2678ee72f8ccc707f15cdfa7ae6` | [122428907657](https://github.com/Meta-Project2026/Metamorph/actions/runs/40572153508/job/122428907657) | Oct 27 19:46:47–19:53:58 | PASS (30) / PASS / PASS, 0 emergency |
| [40573606009/1](https://github.com/Meta-Project2026/Metamorph/actions/runs/40573606009/attempts/1) | `d133e65be24d939d86b9e43a83e4ba8770ecffd9` | [122434032771](https://github.com/Meta-Project2026/Metamorph/actions/runs/40573606009/job/122434032771) | Oct 27 19:56:41–20:04:02 | PASS (30) / PASS / PASS, 0 emergency |
| [40588295315/1](https://github.com/Meta-Project2026/Metamorph/actions/runs/40588295315/attempts/1) | `a14429ca9d5ac565dbb618e9f9c26297c9ead30b` | [122486167588](https://github.com/Meta-Project2026/Metamorph/actions/runs/40588295315/job/122486167588) | Oct 27 21:38:40–21:43:28 | ERROR / PASS / ERROR, 1 emergency |
| [40588295315/2](https://github.com/Meta-Project2026/Metamorph/actions/runs/40588295315/attempts/2) | `a14429ca9d5ac565dbb618e9f9c26297c9ead30b` | [122489125401](https://github.com/Meta-Project2026/Metamorph/actions/runs/40588295315/job/122489125401) | Oct 27 21:44:51–21:46:55 | ERROR / PASS / ERROR, 1 emergency |

Proof jobs: [122428907476](https://github.com/Meta-Project2026/Metamorph/actions/runs/40572153508/job/122428907476),
[122434032210](https://github.com/Meta-Project2026/Metamorph/actions/runs/40573606009/job/122434032210),
[122486167150](https://github.com/Meta-Project2026/Metamorph/actions/runs/40588295315/job/122486167150).
The attempt-2 jobs API also lists carried-forward successful proof metadata under
job ID `122489128400`; its original timestamps are unchanged. Do not count that as
a new proof execution. All three proof summaries have 34 HTTP / 40 DB public
comparisons and proof finalizers 0/0/emergencyRemoved=0. These ran on separate VMs
from their regression jobs and cannot attest regression-worker image identity.

| Run/attempt and artifact | Public artifact URL |
| --- | --- |
| 40572153508/1 regressions | [12765733186](https://github.com/Meta-Project2026/Metamorph/actions/runs/40572153508/artifacts/12765733186) |
| 40572153508/1 proof | [12765538339](https://github.com/Meta-Project2026/Metamorph/actions/runs/40572153508/artifacts/12765538339) |
| 40573606009/1 regressions | [12765664928](https://github.com/Meta-Project2026/Metamorph/actions/runs/40573606009/artifacts/12765664928) |
| 40573606009/1 proof | [12766646351](https://github.com/Meta-Project2026/Metamorph/actions/runs/40573606009/artifacts/12766646351) |
| 40588295315/1 regressions | [12771614054](https://github.com/Meta-Project2026/Metamorph/actions/runs/40588295315/artifacts/12771614054) |
| 40588295315/1 proof | [12773920415](https://github.com/Meta-Project2026/Metamorph/actions/runs/40588295315/artifacts/12773920415) |
| 40588295315/2 regressions | [12773531413](https://github.com/Meta-Project2026/Metamorph/actions/runs/40588295315/artifacts/12773531413) |

The two failed attempts' `regressions.json` bytes have the same SHA-256
`b3cb3112b58d2bf125cad698d66183ac21086bf07141fba7b388d90219a2d09c`.
Their `finalizer.json` bytes also agree:
`b372215e1af3ba1d6302f715fc358e72df3e98be6e96d8379adedf49540a1f99`.
Identical coarse receipts do not establish identical underlying failures.

## 2. Read-only triangulation

`d133e65…`, `a14429…` and current base have identical smoke, controller, admission,
runtime broker, original public fixture tree, runtime tree, regressions launcher
and original workflow/finalizer objects. See `source-identities.json` for the
complete inventory. In particular:

| Object | Git blob/tree identity |
| --- | --- |
| Original workflow | `e22e2e1aaca95b094f4515ad705d1a50d652a15b` |
| Smoke | `58b099b149d53b3e647e57a46e9007038cb212a6` |
| Controller | `ea04011db96649a0216a9f282222f3f129a47e63` |
| Launcher | `73ad6c0b35c6790762c5c77dbacc129bda8f6321` |
| Finalizer | `5986a3ee7e20ed3912bd1426d3763eee9c586497` |
| Runtime tree | `0028ac37ff9a8c2b097cd9daf8cf9b2d2f3a9cf4` |

Recipe SHA-256 for these three commits:
`f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3`.
The older `d15daef…` runtime tree differs in `quota.mjs` (dirty-state marker added
before `d133e65…`); its recipe is
`77f812f131f04073d0292b83e2d9ac2f8465e1c3eb82bff5cd5cf2aaf498a36c`.
That change is not a failure-introducing difference between the later green
baseline and suspect SHA. The PR #31 delta adds the independent audit package,
workflow, docs and lockfile importer; no original smoke/controller/workflow edits.
Indirect setup interactions remain untested; this is not proof that every
possible effect of PR #31 is excluded.

Public log allowlists observed runner `2.338.0` and host Node `v24.21.0` in all
four regression jobs. The workflow requests Node major 24 and the package manager
is pinned `pnpm@11.25.0`; exact pnpm execution/Docker daemon/OS image build versions
were not recovered by the allowlist. Action major tags, host Node major and apt
build inputs are not complete immutable environment pins. The Dockerfile pins
the base digest, while the broker builds anew with `--pull`; recipe equality is
not measured regression image equality. Differing proof image IDs are retained
as observations only, not evidence of the regression cause.

Failed job steps took 264 s (21:39:00–21:43:24) and 94 s
(21:45:17–21:46:51) for **both** children combined. Both then ran the always-finalizer
and artifact upload. These durations are below the launcher's 840 s child timeout
and job's 30 min cap. The allowlisted logs contain no explicit job-timeout or
cancellation notice. This weighs against reaching those outer caps; it does not
exclude a worker's 15 s operation, 10 s startup, 20 s deadline-control or 10 s
cleanup deadline, nor establish the smoke child's individual elapsed time/signal.

## 3. Lifecycle transitions and evidence loss

Line references below are to the unchanged exact-base production files.

1. `workshop-regressions.mjs:15–47` creates a mode-0700 temporary parent, mode-0600
   child log and launches items-smoke, then the old mismatch pilot. Each child is
   given 14 min, SIGTERM on supervisor timeout, and separate evidence paths.
2. `:51–68` requires exit 0, exact SHA, procedure PASS, exactly 30 cases and every
   cleanup flag true. `:93–95` collapses **every** exception to `{id,status:ERROR}`.
   Exit, signal, timeout, case, validation code and resource identity are lost.
3. `smoke.mjs:52–107` provisions, runs the operation, captures primary error, always
   closes, then writes its numbered private case receipt. Cleanup failure is
   thrown before runtime assertions and before appending to successful cases.
   A failed assertion can also prevent the append. Therefore a future first
   uncompleted index is evidence of coverage, not by itself the failing stage.
4. `controller.mjs:288–325` catches useful-operation failure, records its code,
   attempts cleanup and can replace the outward error with CLEANUP_ERROR. Primary
   and secondary faults require the private receipt to distinguish.
5. `:327–388` verifies image, builds inside isolation and cleans the build
   container before reset. `:393–499` cleans old state, creates/tracks fresh volume
   and runtime, launches candidate only inside Docker, then polls readiness.
6. `:598–664` uses a separate inspector and always attempts inspector cleanup
   before propagating observation errors. `:742–769` has two bounded removal
   attempts plus inventory; even transient command failure remains sticky.
7. `:781–849` shares a 10 s cleanup grace across stop/kill/inspect, all container
   removals, execution join, volume removals and final inventory. Each removal
   also inventories containers/volumes. Grace exhaustion or Docker command error
   can leave resources, but no historical receipt identifies this path.
8. `:851–870` close aborts useful work, joins an active operation, then reaps;
   failed close can be retried. Static inspection alone does not prove a race.
9. `workshop-finalizer.mjs:25–53` observes owned names, removes leftovers, records
   counts after removal and the total removed. Any removal forces ERROR. It
   publishes neither the before-count split nor resource kind/identity. A single
   removed resource could be a build/runtime/inspector/helper container **or** a
   volume. It cannot be assigned to a particular case or child from this receipt.

The original mismatch pilot's expected G3 FAIL (`DB_SCHEMA`, `DB_STATE`) is a
successful negative **procedure**, with G2/G4 INCONCLUSIVE, 0 HTTP and 1 initial DB
comparison. It neither converts the smoke ERROR to an expected negative nor
proves that a survivor originated in smoke rather than a later child.

## 4. Hypothesis matrix / attribution

| Hypothesis | Distinguishing observation / bounded test | Observed evidence | Conclusion and confidence / alternatives |
| --- | --- | --- | --- |
| Original smoke/controller edit in PR #31 | Compare exact blobs and original fixture/runtime tree | Identical to later green baseline | Excluded as a **direct file-change** explanation; high confidence. Indirect setup effects remain open. |
| Shared cleanup grace exhausts during normal teardown | Failed case, stage, command durations and remaining budget plus before-finalizer inventory | Static shared 10 s budget; no failed command receipt | Plausible, NOT_ESTABLISHED. A daemon error, inspector race or unrelated helper leak can produce the same receipt. |
| Docker CLI/daemon removal error | Nonzero exit/timeout for stop/rm/volume/inspect plus survivor role | Only emergencyRemoved=1 | NOT_ESTABLISHED. Cannot distinguish refused removal from a resource never entering normal cleanup. |
| Readiness, cancellation or aggregate-deadline race | First case and primary code before secondary close, bounded exact-SHA repetitions | Suite includes these controls; no first-case receipt | NOT_ESTABLISHED. Expected negative cases can emit nonzero subprocess exits without being suite failures. |
| Supervisor/job deadline or workflow cancellation | Actual child signal/timeout receipt, outer-cap timestamps, cancellation notice | Both children finished well below outer caps; no matching notice | Outer-cap explanation disfavored, with limits. Worker-local deadlines remain unexcluded. |
| Runner/image drift or scheduling pressure | Actual regression Docker/runtime versions, image IDs, per-command latency; dedicated baseline/suspect runs | Same runner/host Node; recipe identity, not regression image identity | Environment cause NOT_ESTABLISHED; do not label generic Docker glitch or flakiness. |
| Summary/SHA/count validation failure independent of worker | Child exit 0 and exact summary fields versus validator | Validator merges all such errors | Unfalsified. Alone it does not explain the survivor; two faults or a helper leak remain possible. |
| Old negative pilot/helper rather than smoke owns survivor | Inventory between children and precise opaque ownership mapping | Pilot reports verified cleanup; finalizer is after both children | Pilot cleanup is evidence in its scope, not proof of global ownership. Resource origin unknown. |

First cause, case, stage, command exit/signal and resource role are all
**unknown**. Cleanup failure is established at job scope: normal handoff was not
resource-free and emergency removal was necessary. Primary versus secondary
failure is **NOT_ESTABLISHED**. Incident classification remains **ERROR**;
the causal conclusion is **INCONCLUSIVE / NOT_ESTABLISHED**. Neither a proven
implementation bug nor a proven environment problem is claimed.

## 5. Preregistered isolated reproduction plan

Fixed before any new Docker outcome: **two repetitions each**, at exact
`d133e65…` and `a14429…`, four total, with `fail-fast:false`, no outcome-driven
retries. Attempt identity is `<run-id>-<run-attempt>-<revision-index>-<repetition>`.
Every matrix job gets a fresh GitHub-hosted Ubuntu 24.04 VM/daemon and the original
UUID worker names. Only the unmodified original public 30-case items smoke runs;
no PHP workshop proof, audit generator, private sample or G4 executes.

The additive `.github/workflows/mmp034-docker-forensics.yml` is dispatch-only,
contents-read, no secret forwarding, no persisted checkout credentials, 22 min
per job, max parallelism 2, 14 min child cap, bounded independent finalizer and
two explicit artifact paths. Historical `pnpm install --frozen-lockfile` / build
setup is retained. Current Node major 24 is used as in the historical recipe;
matching the old hosted image/daemon byte-for-byte is not promised.

The trusted driver passes only PATH and public evidence/SHA variables to smoke.
Original public source is compiled/executed only by the historical sandbox.
Raw stdout/stderr, case receipts and child log stay in mode-0700/0600 temporary
runner storage; no whole-directory upload, cache or raw-log output is present.
Only schema-checked enums, opaque case index, command verb/exit/signal/flags/time,
counts, runtime/recipe identities and attempt identity can be serialized.
Unknown diagnostic text maps to UNCLASSIFIED; unknown public fields are rejected.
A process-kill supervisor cap differs from the old wrapper's SIGTERM only at the
14 min safety boundary; any result there must carry that limitation.

`firstUncompletedCase` is deliberately a coverage marker, not a falsely asserted
first causal failure. Failures before a numbered receipt or after all 30 cases
(e.g. clock helper/summary handling) require further trusted diagnostics. There
is no inference from public receipt absence to successful cleanup. The finalizer
separately emits before/after counts and never turns emergency removal into PASS.

Current machine has no `docker` executable. The hosted branch workflow was
nevertheless dispatchable without merging or editing an existing workflow.
The first definition at `a42e9ce5a44b895ab85584db24d85f88412b9af5` had an invalid
job-level `runner.temp` expression: [validation run 40753383891](https://github.com/Meta-Project2026/Metamorph/actions/runs/40753383891)
failed and the dispatch API returned HTTP 422 before any Docker job ran.
This pre-execution configuration **ERROR** is retained; it is not a smoke result
or a consumed Docker repetition. Commit
`c86bce6e5d70f264d2b236d6654582e5b553a7fc` moved that directory setup into a
shell step and the **single** successful dispatch created
[run 40753497017](https://github.com/Meta-Project2026/Metamorph/actions/runs/40753497017).
That immutable driver/workflow commit checks out each separate historical SHA;
the current PR head can subsequently contain evidence-only documentation updates.
No merge, private G4 execution or post-outcome retry was used to obtain the run.

## 5.1 Completed controlled replay (new evidence)

Final outcome: **ROOT_CAUSE_NOT_ESTABLISHED**. The fixed four-attempt experiment
completed successfully on 2026-10-28. No extra Docker repetition or rerun followed
these observations. This is **FAILURE_NOT_REPRODUCED_IN_FOUR_STANDALONE_RUNS**,
not a root-cause finding, fix verification or proof of flakiness.

| Immutable attempt | Exact source | Cases / exit | Smoke duration | Normal before / after inventory | Emergency removed | Public artifact |
| --- | --- | --- | --- | --- | --- | --- |
| `40753497017-1-0-1` | `d133e65be24d939d86b9e43a83e4ba8770ecffd9` | 30 / 0 | 407.263 s | 0 containers / 0 volumes, both | 0 | [12845491820](https://github.com/Meta-Project2026/Metamorph/actions/runs/40753497017/artifacts/12845491820) |
| `40753497017-1-0-2` | `d133e65be24d939d86b9e43a83e4ba8770ecffd9` | 30 / 0 | 387.820 s | 0 containers / 0 volumes, both | 0 | [12844782605](https://github.com/Meta-Project2026/Metamorph/actions/runs/40753497017/artifacts/12844782605) |
| `40753497017-1-1-1` | `a14429ca9d5ac565dbb618e9f9c26297c9ead30b` | 30 / 0 | 391.270 s | 0 containers / 0 volumes, both | 0 | [12846575028](https://github.com/Meta-Project2026/Metamorph/actions/runs/40753497017/artifacts/12846575028) |
| `40753497017-1-1-2` | `a14429ca9d5ac565dbb618e9f9c26297c9ead30b` | 30 / 0 | 288.501 s | 0 containers / 0 volumes, both | 0 | [12846085649](https://github.com/Meta-Project2026/Metamorph/actions/runs/40753497017/artifacts/12846085649) |

All eight public receipt files were independently revalidated against the strict
schema before local retention; exact received bytes and SHA-256 are preserved
under `receipts/` and in the evidence index. No raw child log, HTTP body, SQLite,
input, stderr/stdout or uncontrolled exception was retrieved from these workers.
The diagnostic tests also passed in each hosted job. Exact job intervals,
step metadata and runtime image IDs are in `new-execution.json`.

| Revision / repetition | Dedicated hosted job |
| --- | --- |
| Green / 1 | [123046128517](https://github.com/Meta-Project2026/Metamorph/actions/runs/40753497017/job/123046128517) |
| Green / 2 | [123046127685](https://github.com/Meta-Project2026/Metamorph/actions/runs/40753497017/job/123046127685) |
| Suspect / 1 | [123046128746](https://github.com/Meta-Project2026/Metamorph/actions/runs/40753497017/job/123046128746) |
| Suspect / 2 | [123046128425](https://github.com/Meta-Project2026/Metamorph/actions/runs/40753497017/job/123046128425) |

All measured recipe digests equal the preregistered
`f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3`.
The runtime broker verifies actual Node 24.11.0 / SQLite 3.50.4 /
TypeScript 5.9.3 / libfaketime 0.9.10-2.1 provenance before the suite.
Actual historical regression-daemon/image identities remain unavailable; matching
recipe and passing broker admission do not reconstruct that environment.

The implementation/environment/race alternatives in the hypothesis matrix are
still unfalsified. A deterministic defect that necessarily breaks these four
standalone executions was not observed. The historical dual-child wrapper and
later mismatch pilot were intentionally not re-executed in this public-items-only
experiment; their interactions and coarse-summary validation branch remain
outside its coverage. The absence of a new failed case leaves historical first
cause, stage, command and survivor identity unknown. No worker remediation is
justified by these green results. The original two ERROR attempts are unchanged.

## 6. Changes, verification and owner choices

No changes to protected worker/controller/smoke, original workflows, Oracle,
private-run, comparator, policies, fixtures, candidate bundles, corpus, original
receipts or Fast CI defaults. No behavioral fix has a causal basis. There is no
baseline-versus-patched Docker result; that comparison is **NOT_RUN**. The new
tests verify leak rejection, incomplete-smoke rejection, missing-inventory
handling and sticky emergency-cleanup ERROR. They are diagnostic boundary tests,
not a regression test proving the incident fixed.

All seven requested standard commands exited 0 locally, as did the four new
diagnostic tests and `git diff --check`. The target-worker suite passed 69/69;
differential passed 77, failed 0, with 1 existing POSIX-permission catalog test
skipped on Windows. Root lint's configured include list excludes research files;
the two new diagnostic JavaScript files were additionally checked/formatted with
an isolated Biome configuration, without changing the repository's CI/config.
Hosted [Fast CI 40753507299](https://github.com/Meta-Project2026/Metamorph/actions/runs/40753507299)
passed on the exact diagnostic SHA `c86bce6e5d70f264d2b236d6654582e5b553a7fc`,
Node 22 and 24. Green Fast CI or the sanitizer tests cannot resolve this incident.

Explicit next owner/reviewer choices:

1. Independently review this report, sanitizer, bounded workflow and public
   artifact boundary. Independent ChatGPT review is requested on the PR; no
   review completion, assignment or notification is implied by that request.
2. Decide whether to retain the additive manual workflow on main after review;
   the branch dispatch itself did not require a bootstrap merge. Preserve the
   recorded four-attempt matrix and all observations. A different diagnostic
   experiment needs a separately fixed question/budget; do not retry until green.
   Never merge this PR automatically.
3. Inspect only sanitized new receipts in public/model context. An authorized
   human may inspect raw original-public diagnostics inside the trusted ephemeral
   runner if needed; never import hidden logs or use an AI to inspect them.
4. Only a causal case/stage/command/resource chain can justify a minimal worker
   fix. Protected worker/workflow/API remediation requires owner-interface review
   and a distinct narrow patch with baseline-failing/patched-passing evidence.

Residual risks: historical raw diagnostics may be gone; a later green public run
cannot reconstruct them. Coarse receipts cannot determine whether two failures
share a cause. New environment drift and diagnostic supervisor differences limit
equivalence. Independent finalization can itself fail or be interrupted; missing
receipts remain missing evidence. No hidden formal qualification is authorized.
