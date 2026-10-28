# MMP-010A validation

## 2026-10-28: registered workflow; first real hosted attempt

Current main was refreshed as `de6a679c1b58195f4fc2ea10670504b59441f9dd`.
PR #33 is merged at `84ac71602ddeedba39dde8eafb937ae32751dffa`;
PR #35 is merged and Issue #25 closed. Workflow `398781710` is active on main.
Its blob `3e798197914bd0227dd12ad9fc6ba5bbd5ec5641` is byte-identical to
PR #30's workflow. The manual-only trigger, read-only permissions, exact checkout,
40-minute bound, independent always-finalizer and two-file upload are preserved.

Dispatch exited 0 and created [run 40682636983](https://github.com/Meta-Project2026/Metamorph/actions/runs/40682636983),
[job 122796947020](https://github.com/Meta-Project2026/Metamorph/actions/runs/40682636983/job/122796947020),
on `48932cd32700dc3487c764b0ce66b92420f7b56d`. The exact-checkout log confirms
that SHA. Node 24.22.1 / pnpm 11.25.0: frozen install, lint, typecheck, root tests
85/85, build, reference 56/56, target 69/69, differential 78/78 and agent-real
20/20 passed with no skips. This branch did not inherit main's newer Fast CI YAML;
these are the actual explicitly executed manual-workflow commands.

The real proof step exited 1 with `ENVIRONMENT_ERROR` before runtime preparation:
no images, attempts, HTTP/SQLite comparisons or runtime controls were produced.
The agent-real recipe pin `77f812...` did not match the immutable runtime files'
Git/LF recipe SHA `f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3`.
The manifest pin and workshop profile match. A new regression reproduced the
failure with a temporary Linux-checkout copy: 20/21 passed, 1 failed, exit 1.
The fix changes only the composition's pin and extracts its existing byte-exact
check for a test that also rejects a modified Dockerfile and CRLF bytes. No runtime
normalization, protected worker/Oracle/fixture changes or reduced coverage.

The independent finalizer succeeded: containers=0, volumes=0, emergencyRemoved=0.
Public artifact `12812969324` contains exactly `summary.json` and `finalizer.json`;
downloaded ZIP SHA-256 `a5ca6ad34afcfe3ba2d144da69d0ff1304af330678a65e38a153f6c131e66c28`
matches the GitHub API artifact digest and upload log. A bounded public-log and
artifact scan found no private-pack paths, raw HTTP fields, SQL/DDL or credentials.
This is an environment/preflight ERROR, not a candidate FAIL or scoped PASS.
Good/repair/G0-G4 execution and six runtime controls remain NOT_RUN for this run.
AI_GENERATION_NOT_RUN; EXTERNAL_RETENTION_NOT_RUN; product NOT_ESTABLISHED.

The recipe correction requires a new complete hosted proof on its pushed SHA.
Later evidence is recorded below and in PR #30; no old run verifies a newer HEAD.

Correction checks on Windows / Node 22.23.1 / pnpm 11.25.0 all exited 0:
frozen install (1.51 s), lint (1.87 s), typecheck (67.40 s), root test 86/86 with
no skips (42.63 s), build (28.39 s), focused agent-real 21/21 and diff check.
Only agent-real runtime/test and this spec bundle changed. The protected Oracle,
target-worker, differential, contracts and the manual workflow are identical to
current main. No candidate PHP/TS was compiled or executed on this Windows host.

## 2026-10-28: corrected recipe; partial real execution and deadline regression

[Run 40683761588](https://github.com/Meta-Project2026/Metamorph/actions/runs/40683761588),
[job 122800789791](https://github.com/Meta-Project2026/Metamorph/actions/runs/40683761588/job/122800789791),
checked out `d254711d69a82d56b711253fe075acec9133e146` exactly. Node 24.21.0 /
pnpm 11.25.0: frozen install, lint, typecheck, root 86/86, build, reference 56/56,
target 69/69, differential 78/78, agent-real 21/21, all exit 0, no skips.

Known-good executed one full real attempt: G1/G2/G3 PASS, 17 HTTP / 20 SQLite;
candidate `34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334`;
three fresh pairs and six private-pack hashes. Agent / G0 / G4 INCONCLUSIVE.
The public cancellation mutant
`1fd6c3547691a2593a58932e78946a8338061ec07cc46f9fb5b9422825591121`
observed G2/G3 FAIL in the business pair (`HTTP_JSON_LENGTH`, `DB_STATE`). After
the rejected-input pair completed, a composition ENVIRONMENT_ERROR ended the
attempt at 11 HTTP / 13 SQLite. Aggregate G1-G4 remained ERROR; repair-after was
NOT_RUN. The driver exited 1 / EVIDENCE_ERROR. Actual totals: 28 HTTP / 33 SQLite,
five pairs / ten packs. No complete negative attempt or successful repair claim.

All six original controls actually ran: REAL_DOCKER / PASS. Normal completion
and independent finalizer both verified containers=0, volumes=0, emergencyRemoved=0.
Public artifact `12813588783` contains only the two allowlisted JSON files. Its
ZIP SHA-256 `58d158fa17ccb0caf142d351456b0323a1571ac827c6bb8a7c3b96022a65475c`
matches the GitHub API digest and upload log. Bounded leak-pattern scans were clear.
Offline replay paidCalls=0, spend=0, tokens=null; product NOT_ESTABLISHED.

A deterministic regression proves the deadline assertion can reject correct
fractional monotonic timestamps: `(90000.000003 + 180000) - 90000.000003` equals
`180000.00000000003`. Before correction focused tests were 21/22 PASS, exit 1;
after correction 22/22 PASS, exit 0. The composition now checks finite start time,
the unchanged exact POLICY lifetime, and equality to the same deadline addition
used by TargetWorker. It introduces no tolerance, measured-duration claim or
extra budget. The protected controller and its original deadline stay unchanged.
A fresh complete hosted run on the corrected pushed SHA is still required.
Post-correction local lint and diff check exited 0; root tests passed 87/87 with
no skips in 36.12 s, exit 0. The focused suite passed 22/22, exit 0.

## Historical local validation and pre-registration attempts

Base main: `3de9d5ceef343536a5b56761deb805006fbd4b65`.
Isolated branch: `feat/mmp-010a-real-agent-composition`.
Local platform: Windows, Node22.23.1, pnpm11.25.0. Docker is unavailable locally;
candidate PHP/TS has not been executed on this host.

Local checks: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`,
`pnpm test` and `pnpm build` each exited0. Root test now runs the original65 plus
16 new tests:81/81PASS. New synthetic tests separately16/16, exit0.
Original reference/target/differential suites were executed together using
`node --test packages/oracle/reference/reference.test.mjs packages/oracle/reference/acceptance.test.mjs packages/target-worker/test/*.test.mjs packages/differential/test/*.test.mjs`:
203 total,201 passed,2 existing POSIX-only skips,0 failures, exit0.
Individual required commands also exited0:
`pnpm --filter @metamorph/oracle test:reference`:56 total,55PASS/1POSIX skip;
`pnpm --filter @metamorph/target-worker test`:69/69PASS;
`pnpm --filter @metamorph/differential test`:78 total,77PASS/1POSIX skip.
Implementation was committed/pushed as
`385394673860457a3a0f2f1af59b3eead8cadfe6`; [PR30](https://github.com/Meta-Project2026/Metamorph/pull/30)
is open, Refs #23. Fast CI was queued as
[run40587517919](https://github.com/Meta-Project2026/Metamorph/actions/runs/40587517919).
Its result is independent of Docker/Oracle acceptance. Final PR-head Fast CI is
linked in the PR checks; no code changes are hidden in this reporting update.

## Historical hosted blocker, resolved by the successful dispatch above

Hosted real Agent positive/repair proof: **NOT_RUN**.
Hosted runtime failure controls, final Docker inventory and raw/public artifact
SHA receipts: **NOT_RUN**. No new real Agent candidate execution is claimed.

Both authorized dispatch attempts were rejected before a run was created:

1. `gh workflow run agent-workshop-compose.yml --repo Meta-Project2026/Metamorph --ref feat/mmp-010a-real-agent-composition`
   exited1: HTTP404, workflow not found on the default branch.
2. `gh api --method POST repos/Meta-Project2026/Metamorph/actions/workflows/agent-workshop-compose.yml/dispatches -f ref=feat/mmp-010a-real-agent-composition`
   returned HTTP404 Not Found. A follow-up workflow inventory contained no new
   composition workflow; branch run inventory contained only Fast CI.

Local Docker is absent; installing an alternate runtime is not authorized.
The assignment prohibits changing existing workflows and self-merge. This
checkout therefore has no available authorized entrypoint that can execute the
new proof before independent review/registration. The implementation, tests and
manual workflow are delivered as PARTIAL, not simulated hosted success.

To close the blocker, an owner must make the new dispatch-only workflow available
on the default branch through the agreed review process (or authorize a concrete
existing manual entrypoint change). Then dispatch the exact final PR SHA and
verify summary.json, finalizer.json and the Actions artifact SHA. This is a
remaining acceptance condition, not owner agreement or a merge request from the
implementation agent. No self-merge, old-workflow edits or automatic PR Docker
trigger were used to work around the404.

No external raw retention is configured: EXTERNAL_RETENTION_NOT_RUN.

Required semantics: good G1/G2/G3 PASS with17HTTP/20SQLite, G0/G4 INCONCLUSIVE,
Agent INCONCLUSIVE. Broken public cancellation must produce real FAIL; one repair
requires a changed SHA and distinct packs, with all17/20 operations executed again.
No counts in this paragraph are execution claims.

Unexecuted runtime faults are never promoted from synthetic tests. The published
summary labels original real Docker controls separately. Agent timeout/cancel
returns are joined with pending work before final inventory/sealing. A cleanup
fault stays ERROR even if emergency reaping ultimately reaches zero resources.

No paid requests, guessed prices/model APIs, hidden inputs or held-out evidence.
No G0/G4/product PASS, AI-generation claim, owner agreement, merge or issue closure.

## 2026-10-28: independent review corrections

Starting head: `192a6b330901267845c710ea37f4c627e25ed51e`.
The independent [review](https://github.com/Meta-Project2026/Metamorph/pull/30#pullrequestreview-5674811853)
identified G4 control-ID misattribution when an earlier pair lacks gate receipts.
Before the fix, `pnpm --filter @metamorph/agent-real test` exited1 with15/19
passing: the first-missing and middle-missing G4 cases failed, as did the new
policy-field and duplicate-pair-identity controls. These are synthetic receipts;
they do not establish that a real hidden audit or hosted pair ran.

The aggregator now keeps each gate result attached to its originating pair when
filtering, and rejects duplicate pair IDs as `EVIDENCE_ERROR`. Existing stale SHA,
pack, scenario and coverage checks remain. Public output names the configured
limit `targetLifetimePolicyMs`; it does not publish an invented elapsed time.
Focused synthetic tests now cover both missing-pair positions, provenance,
partial FAIL/ERROR precedence, cleanup failure, full17/20 coverage and unchanged
G0/G4 INCONCLUSIVE semantics.

The composition path, source pinning, abort/join, private packs, and workflow
artifact selection were statically reviewed. A `summary.json` `PASS_SCOPED`
alone does not establish completed hosted proof: the successful Actions job,
matching HEAD, `finalizer.json` with zero inventory and artifact digest must also
exist and be independently inspected. The independent finalizer is a later step;
an absent or failed finalizer leaves the overall proof incomplete.

Issue #32 workflow registration is proposed separately in
[PR33](https://github.com/Meta-Project2026/Metamorph/pull/33), head
`baa621f44e0cfc203b0a97be663e0c24fa8577e6`. It contains exactly the two unchanged
manual workflows from the feature branches; YAML 1.2 parsing, exact source bytes,
read-only permissions, exact-SHA checkout, public artifact path selection and
finalizers were checked statically. This is not workflow execution or owner
approval. At review, neither workflow was present on default main. Independent
review and an owner-approved merge are still required before dispatch. The
registration branch Fast CI [run40591121690](https://github.com/Meta-Project2026/Metamorph/actions/runs/40591121690)
passed Node22/24 on the registration SHA; it did not run either Docker proof.

Local correction checks on Windows, Node22.23.1/pnpm11.25.0:

| Command | Exit | Result | Wall time |
| --- | ---: | --- | ---: |
| `pnpm install --frozen-lockfile` | 0 | PASS | 1.51 s |
| `pnpm lint` | 0 | PASS | 1.79 s |
| `pnpm typecheck` | 0 | PASS | 72.02 s |
| `pnpm test` | 0 | 85/85 PASS, no skips | 46.34 s |
| `pnpm build` | 0 | PASS | 30.64 s |
| `pnpm --filter @metamorph/agent-real test` | 0 | 20/20 PASS, synthetic | 3.42 s |
| `pnpm --filter @metamorph/oracle test:reference` | 0 | 55 PASS, 1 POSIX-only skip | 15.36 s |
| `pnpm --filter @metamorph/target-worker test` | 0 | 69/69 PASS | 1.74 s |
| `pnpm --filter @metamorph/differential test` | 0 | 77 PASS, 1 POSIX-only skip | 14.87 s |

After tightening the malformed-receipt assertions to require `EVIDENCE_ERROR`,
the focused suite again passed20/20 and lint plus the full root suite again
passed85/85 in40.03 s combined. The pushed head's Node22/24 Fast CI is tracked
in the PR; none of these checks executes the real candidate or PHP on this host.

At that review, actual Agent/PHP/TS proof, positive, negative/repair, runtime
controls, final inventory, pair/pack SHA receipts and artifact hashes were NOT_RUN.
AI_GENERATION_NOT_RUN, EXTERNAL_RETENTION_NOT_RUN and product NOT_ESTABLISHED.
