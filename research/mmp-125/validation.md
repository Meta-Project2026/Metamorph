# MMP-125 validation — read-only phase

Base: `074af751e9012abad1be2749c360c5d8b86218e0`, fetched canonical main.
Post-merge [CI41375878083](https://github.com/Meta-Project2026/Metamorph/actions/runs/41375878083)
was independently read SUCCESS on Node22/24. Dedicated branch
`codex/mmp125-first-http-forensics`, existing clean isolated checkout reused after
the completed/merged PR117. No teammate checkout or active feature pointer edited.

## Actually executed locally

Windows Node24.21.0 / pnpm11.25.0. Commands executed against the MMP125 source
working tree before delivery commit; only this validation document was added
after that full cycle. Exact final source SHA and hosted run/job evidence are
recorded in the PR conversation after commit. Old CI is not reused.

| Command                                                                              | Exit | Result                                                       |
| ------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------ |
| pnpm install --frozen-lockfile                                                       | 0    | Frozen install                                               |
| pnpm lint                                                                            | 0    | PASS                                                         |
| pnpm exec biome check research/mmp-125                                               | 0    | New audit/tests/docs/config lint/format PASS                 |
| pnpm typecheck                                                                       | 0    | PASS                                                         |
| pnpm test                                                                            | 0    | 782 total / 672 PASS / 110 Windows/environment SKIP / 0 FAIL |
| pnpm build                                                                           | 0    | PASS                                                         |
| node research/mmp-069/validate.mjs                                                   | 0    | VALID; 99 research modules                                   |
| node --test research/mmp-069/validate.test.mjs                                       | 0    | 45 PASS / 0 FAIL                                             |
| node research/mmp-069/check-syntax.mjs                                               | 0    | 98 files syntax PASS; modules not executed                   |
| node research/mmp-125/audit.mjs                                                      | 0    | 47 pinned public inputs; AUDIT_COMPLETE_CAUSE_UNRESOLVED     |
| node --test research/mmp-125/audit.test.mjs                                          | 0    | 21 PASS / 0 FAIL / 0 SKIP                                    |
| node --test packages/agent-real/test/verifier-forensics.test.mjs                     | 0    | 20 total / 19 PASS / 1 Linux-only preserver SKIP / 0 FAIL    |
| node --test research/mmp-108/*.test.mjs, with available Git sh on process-local PATH | 0    | 18 PASS / 0 FAIL; stateful Docker stub only                  |
| git diff --check; scoped protected-content comparisons                               | 0    | No scoring/source/candidate/receipt/workflow changes         |

The first additional MMP108 shell-suite invocation exited1: 18 total / 8 PASS /
10 FAIL because sh was not resolvable from this Windows PATH (spawn status null).
A shell-only probe confirmed ENOENT. After adding the existing
C:/Program Files/Git/bin to only that command's PATH, a shell-only exit0 probe and
the unchanged suite passed18/18, exit0. Its docker is a private stateful stub,
not the real daemon; no real Docker invocation/container/volume was made.
The initial nested Biome config used a string instead of the required path array;
corrected to the repository's existing root:false/extends-array convention.

Initial strict pinning also detected Windows autocrlf drift in four clean tracked
Dockerfile/shell files. They were rehydrated from exact HEAD Git blobs; scoped
git diff/cached comparisons exit0. Auditor/source/recipe normalization was not
added. The dedicated newline-drift negative control passes. No candidate TS or
historical JSON bytes changed.

## Scope and evidence limits

Only research/mmp-125/** and one accurate LOCAL_ONLY / GATED_HOSTED_SYNTAX /
NOT_VERIFIED coverage row are changed. All existing matrix rows are retained.
New21 behavior controls are **local-only, not hosted-gated**; existing CI only
syntax-checks these new modules. No package test bridge or CI expansion is used
to disguise that distinction. The existing root/forensic/MMP108 suites are
independent trusted synthetic controls, never candidate execution on the host.

The audit independently recomputes original/repaired candidate hashes and target
runtime recipe from exact byte-pinned data. Its negative controls reject false
semantic-FAIL/error equivalence, wrong stage/counts, discarded findings, side/error
claims, changed/foreign receipts and run heads, mutated/extra/linked source or
recipe files, namespace aliases, newline drift and invalid CLI arguments.
The report contains fixed categorical fields, hashes and counts only.

Historical MMP104/MMP108/MMP123 Docker execution remains agent-reported prior
evidence, not rerun here. The owner explicitly reported no retained local MMP123
private evidence copy; private inspection, Docker volume inventory and hidden G4
are NOT_RUN. Same public shape cannot identify a side or establish identical
causes. Root cause / failed side / error class remain UNKNOWN.

The separate diagnostic-plan.md is PROPOSED / NOT_AUTHORIZED / NOT_RUN. Its
instrumentation controls are proposals, not executed tests. No provider/model
call, paid workflow/validate_only/rerun, second repair, new Docker run, private
key, artifact upload or product/G4 acceptance. #116 HOLD; #61
PRODUCT_NOT_ESTABLISHED. Keep #125 OPEN for its separate owner decision and
independent exact-SHA review; no self-merge.

## Consent-stage preparation (2026-11-02)

The earlier NOT_AUTHORIZED/NOT_RUN statements above describe the completed
read-only audit phase. The user subsequently authorized preparation and one
Docker run under the f3895d1 plan: «Разрешаю подготовку и один прогон по плану».
This is explicit user consent, not inferred teammate/owner governance approval.

New trusted observer/launcher code lives only under research/mmp-125. The original
MMP123 verifier CLI is invoked as one child with an isolated environment. Hooks
wrap the existing trusted adapters/transport/command checkpoints, call originals
once and retain exact returned values/rejected objects. No production code or
candidate is edited; no fabricated GITHUB_RUN_ID is introduced. The private trace
is strictly validated, sealed and projected to categorical output (maximum
128 events /64KiB). Unknown or incomplete cases cannot acquire an attribution.

Executed before launch: node --test research/mmp-125/*.test.mjs exit0, 41 PASS
(21 read-only audit controls +20 observer/projection controls); the latter compare
observed versus original verifyPair scoring/cleanup for inert original synthetic
reference/target request, malformed, timeout and host-write faults. Exception
getters, worker claims, recovered failures, process metadata, foreign identity,
truncation/overflow/late settlement, public canaries and cleanup failures are
covered. No candidate/reference code or real Docker is executed by those tests.

pwsh -NoProfile -File research/mmp-125/launcher.test.ps1 exit0: three stateful
in-process Docker/Git/Node stub controls (single launch/argument binding/owned
cleanup/no-retry marker; foreign worker refusal; wrong volume-owner refusal).
An initial stub invocation exited1 due to its own variable scope; corrected to
isolated-process globals and unchanged launcher controls then passed. A review
also corrected the Docker wrapper name/array binding before any real launch.
PowerShell parser exit0; nested Biome check exit0. Coverage matrix VALID103 modules;
new behavior tests remain LOCAL_ONLY/NOT_VERIFIED by hosted CI. The only matrix
execution change is MMP125 LOCAL_ONLY to MANUAL_DOCKER. CI/workflows are unchanged.

Single real Docker diagnostic: NOT_RUN at this preparation commit. The next
receipt will record its actual driver SHA and result. No automatic retry.

## Actual consented attempt: ERROR_ENVIRONMENT (2026-11-02)

Command actually run (once):

```powershell
pwsh -NoProfile -File research/mmp-125/Invoke-Diagnostic.ps1 -ScratchRoot C:/Metamorph/.oracle-evidence/mmp125/authorized-once-20261102 -AuthorizedHead 1c3581acadbc14382b4a9007d4701904639480de
```

Exit1, diagnostic ID a173d103-3da4-4697-9baa-87e612625e28. The daemon was
unavailable before the consent marker/resource-creation/outer-run stages. Read-only
follow-up: docker version --format '{{json .Server}}' exit1 (null server; Docker
Desktop Linux Engine pipe missing), docker container ls --all --format '{{.Names}}'
exit1, docker volume ls --format '{{.Name}}' exit1. These were availability reads,
not second diagnostic invocations. No real container, volume, candidate/reference,
verifier, model, repair, Actions dispatch or artifact upload was started.

The host-execution receipt preserves every original JSON field; repository Biome
formatting uses LF. The original local byte SHA256 is recorded in the outcome. Its ERROR_CLEANUP records
that the independent final inventory was also unavailable; launchAttempts0 and
elapsedSeconds0 refer to the unopened Docker execution interval, not a measured
zero wall-clock duration for the PowerShell preflight. This does not prove global
zero Docker resources or a resource leak. No resource was created by this attempt.
The separate categorical outcome distinguishes the current environment error
from the historical candidate VERIFIER_ERROR. There is no new candidate gate or
coverage result, no first-HTTP boundary evidence and no product acceptance.
Candidate side/class/cause and historical Meta cause remain UNKNOWN.

No retry or Docker startup was attempted. A local CLOSED_AFTER_FAILED_PREFLIGHT
no-retry marker now closes this authorization attempt; raw receipts are preserved.
Any future attempt requires explicit consent. Existing candidate/receipt/scoring
files remain untouched; the read-only auditor still passes all47 pins.

## Final delivery checks after the failed environment preflight

All exit0: pnpm lint; pnpm typecheck; pnpm test (782 total /672 PASS /110
Windows/environment SKIP /0 FAIL); pnpm build; new research tests (41 PASS);
PowerShell stateful launcher controls (three PASS, stubs only); coverage-validator
negative controls (45 PASS); active research syntax (102 files PASS); nested
Biome check and47-pin read-only audit. The final doc/evidence-only commit follows
these checks; exact final SHA and hosted Node22/24 evidence belong in the PR
conversation. Hosted syntax does not execute the new MMP125 behavior controls.
JSON deep equality confirms the versioned host receipt retains every original
field; its local byte hash is retained separately because Git formatting uses LF.
Protected packages/workflows/source/candidates/historical receipts compare equal
to main074af751; only research/mmp-125 and its single coverage row differ.

## #130 — two P1 review corrections (NO_REAL_DOCKER_RUN)

Reviewed starting head: f77b8b127ee5c4a9405f316ad910b610d730d377. GitHub/local
branch codex/mmp125-first-http-forensics matched with a clean worktree; independent
review5737171364 requested changes. Review base/merge-base074af751e9012abad1be2749c360c5d8b86218e0.
origin/main additionally contained d016a9aa1782d96410e1855c6381da597942ccae (MMP126
documents); those were not overwritten or merged into this research patch.

P1-A: atomic CreateNew / FileShare.None / synchronous Flush(true) now runs after
exact-head/clean-tree/47-pin audit admission and before any Docker resolution or
invocation. Existing/partial/inaccessible/failed-write markers never grant a retry
and are never rewritten. The guard loser skips Docker even in finally. A prior
marker and both historical evidence files remain unchanged.

P1-B: every host Docker operation now uses one native bounded process wrapper,
including preflight, volume creation/inspection/removal, run, polling, copy, outer
ownership/removal, ledger fallback and both inventory halves. ArgumentList avoids
shell parsing. The monotonic1200-second budget starts at core entry and covers
source admission/bundle and all host CLI blocking. Each command is capped at15s
or the remaining execution budget. Cleanup has an independent60s total/5s per-call
cap. Bounded async stdout/stderr draining caps combined bytes to64KiB; stderr is
never projected. Timeout/cancellation/output-limit stops the child process tree
where supported; no indefinite WaitForExit/ReadToEnd/post-kill pipe wait exists.
Receipt v2 separates execution/main error, cleanup error and unknown inventory.
No complete inventory means null counts, never verified0. Ownership labels and
private exact-name/run-prefix ledger checks still gate removal; no broad pruning.

Environment: Windows, PowerShell7.6.5/.NET, Node24.21.0, pnpm11.25.0. Commands
actually executed after the code patch:

| Command                                                                      | Exit | Actual result                                                     |
| ---------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| pwsh -NoProfile -File research/mmp-125/launcher.test.ps1                     | 0    | 20 PASS /0 FAIL; isolated real fake CLI subprocesses only         |
| node --test research/mmp-125/*.test.mjs                                      | 0    | 41 PASS /0 FAIL /0 SKIP                                           |
| node research/mmp-125/audit.mjs                                              | 0    | 47 public pins, original/repaired candidates and recipe unchanged |
| node research/mmp-069/validate.mjs                                           | 0    | VALID104 research modules                                         |
| node --test research/mmp-069/validate.test.mjs                               | 0    | 45 PASS /0 FAIL /0 SKIP                                           |
| node research/mmp-069/check-syntax.mjs                                       | 0    | 103 files PASS; syntax only                                       |
| pnpm install --frozen-lockfile                                               | 0    | No dependency/lockfile changes                                    |
| pnpm lint                                                                    | 0    | PASS                                                              |
| pnpm typecheck                                                               | 0    | PASS                                                              |
| pnpm test                                                                    | 0    | 782 total /672 PASS /110 Windows/environment SKIP /0 FAIL         |
| pnpm build                                                                   | 0    | PASS                                                              |
| pnpm exec biome check research/mmp-125 research/mmp-069/coverage-matrix.json | 0    | PASS                                                              |
| PowerShell parser on entrypoint/core/test                                    | 0    | Three files PASS                                                  |
| git diff --check; protected-path diff versus f77b8b1                         | 0    | No protected/evidence/candidate/workflow/dependency changes       |

The20 launcher controls supersede the original three function-stub controls:
real separate controller/fake CLI processes test success/owned cleanup; unavailable
then recovered daemon with zero second-attempt calls; complete/partial/directory
markers; actual partial marker-write failure and later refusal; two concurrent
marker writers; hung version/image/poll/removal/final inventory; foreign worker,
foreign volume/outer owner, stale ledger, unknown worker/inventory and oversized
output; literal argv and cancellation. A hung fake CLI also starts a descendant;
its recorded processes are verified terminated. Short budgets are injected only
through private module substitution in the isolated test entrypoint, never a
production CLI/env option. The fake fixture never resolves or imports Docker.
An initial Biome check found only the new fixture's formatting; it was formatted
and the final check passed. No failed behavioral control was hidden or skipped.

These PowerShell/C# and41 MMP125 behavior controls remain LOCAL_ONLY. Existing
hosted CI checks MJS syntax, not C#/PowerShell behavior; CI/dependencies were not
expanded. Linux/macOS process supervision and real Docker behavior are NOT_RUN.
The final doc-only additions follow the above full cycle; exact final SHA and
fresh hosted Node22/24 results are recorded in the PR conversation after push.

No real Docker CLI/daemon/container/volume operation, retry, model/API call,
workflow dispatch, artifact upload, source migration, repair, private evidence,
key or hidden G4 access occurred in #130. The previous attempt remains
ERROR_ENVIRONMENT/candidate NOT_RUN; historical Meta/GLM cause UNKNOWN.
#130 and #125 OPEN pending independent exact-SHA re-review through barbalatv;
#116 HOLD; #61 PRODUCT_NOT_ESTABLISHED; formal G4 NOT_RUN. No self-approve/merge.
