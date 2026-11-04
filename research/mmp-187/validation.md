# MMP-187 — G0 lifecycle fixture cleanup deadline

Refs #187. [PR #189](https://github.com/Meta-Project2026/Metamorph/pull/189).
Local and implementation-head hosted checks passed. Final delivery SHA and CI
are recorded in the PR/Issue #187 handoff; independent review remains pending.

## Scope and provenance

- Baseline: `origin/main@b41d55322ce37df5ad13d7fd1960f3d5c78dccc9`, fetched before
  work; no open PRs at reconnaissance. Isolated branch
  `Vladimir/mmp-187-g0-ci-flake`; the original worktree was clean and untouched.
- All lifecycle executions here use trusted Docker CLI observations and module
  mocks. No Docker daemon, candidate, reference, probe program or benchmark was
  executed. Production G0 code, policy, limits and CI are unchanged.
- Local Windows: Node `v22.23.1`, Node `v24.22.1`, pnpm `11.25.0`.
  Node 24 came from the official `v24.22.1/win-x64/node.exe`; SHA-256 matches
  official SHASUMS256:
  `d702daa815eabbff763c7d3808e235cf031cf2ca70211b56847bc72f51e240e5`.
- Executable change commit: `0dab9dfa9c57d38004d95f4deb69fe62a5a2a8e8`.
  The only changed executable file is
  `packages/workshop-audit/test/g0-run-controls.mjs`, SHA-256
  `451c03d25e49ed506e30645cf4f95946acb92a5b6c8325436e17ead2ab4f4929`.
  Subsequent evidence commits change Markdown only. Exact final delivery HEAD
  and final merge-ref CI are recorded in the PR and linked Issue #187 handoff,
  outside this self-referential commit.

## Historical failure retained

Direct job logs were read, rather than inferring the failure from Issue #187.
Historical PR head: `a39f0e0876ee0d466ab0b8ed3bf1bfb6d11ae4fc`; its G0 files
and Fast CI workflow are byte-identical to the baseline.

- [Attempt 1](https://github.com/Meta-Project2026/Metamorph/actions/runs/41908826869/attempts/1):
  Node 22 succeeded; [Node 24 job 126850612290](https://github.com/Meta-Project2026/Metamorph/actions/runs/41908826869/job/126850612290)
  failed in Workshop-audit tests on `v24.22.1`. Inner test
  `g0-run-controls.mjs:154`, through `g0.test.mjs:177`: expected
  `['G0_CHALLENGE','G0_EVIDENCE']`, actual
  `['G0_CHALLENGE','G0_CLEANUP','G0_EVIDENCE']`; 6 passed / 1 failed.
- [Attempt 2, same head](https://github.com/Meta-Project2026/Metamorph/actions/runs/41908826869/attempts/2):
  [Node 22](https://github.com/Meta-Project2026/Metamorph/actions/runs/41908826869/job/126853189574)
  and [Node 24](https://github.com/Meta-Project2026/Metamorph/actions/runs/41908826869/job/126853186457)
  succeeded. This rerun does not erase attempt 1 or prove stability.

## Demonstrated mechanism

The fixture applies a 25 ms cleanup budget even to non-timeout integrity tests.
`G0Docker.close()` starts a monotonic deadline, then `inventory()` records its
first command through the real synchronous, fsync-backed evidence writer. Time
spent recording is included in that deadline. The next `call()` checks the
remaining budget and can throw `G0_CLEANUP`; `close()` retains failed inventory
and rejects. `runG0()` preserves that secondary fault, then independently
finalizes and detects the deliberate post-seal evidence tamper.

A disposable copy of the historical child test advanced the mocked monotonic
clock by exactly 50 ms immediately after the first normal cleanup inventory
capture. All production functions remained unchanged. On both Node majors:

| Fixture budget | Test exit | Faults | Normal cleanup | Verdict / verified |
| --- | --- | --- | --- | --- |
| 25 ms | 1 (expected experimental failure) | CHALLENGE, CLEANUP, EVIDENCE | null | ERROR / false |
| 1000 ms | 0 | CHALLENGE, EVIDENCE | zero containers/volumes | ERROR / false |

Fault names in the table have the `G0_` prefix. Both variants attempted the
independent finalizer and observed zero resources. The same strict historical
assertion fails in the first variant and passes in the second. Temporary
diagnostic source was removed; it is not an executable research addition.

This establishes a deterministic deadline-exhaustion mechanism consistent with
the historical fault array. The historical logs do not identify the individual
filesystem/scheduler pause; that precise historical cause remains unobservable.

## Fix and strict controls

Normal integrity fixtures now use the existing bounded `LIMITS.cleanupMs`
(10000 ms) instead of a shared 25 ms override. This does not introduce a wait:
completed cleanup still returns immediately. Both the abort-ignoring fixture
and the deliberately delayed-capture negative explicitly select 25 ms. Fixture
state resets between tests. No production deadline or verdict rule changes.

- The same historical tamper test advances monotonic time by 50 ms after the
  first real cleanup capture and asserts exactly CHALLENGE + EVIDENCE, normal
  zero cleanup, cleanup-control completion, independent finalization, ERROR and
  unverified evidence.
- The separate 25 ms delayed-capture control asserts exactly CHALLENGE + CLEANUP
  + EVIDENCE, null normal cleanup, ERROR, unverified evidence, successful separate
  finalizer and rejected PASS consumption.
- Abort-ignoring work keeps its explicit 25 ms cleanup budget, 10 ms operation
  budget and existing 500 ms outer guard. It asserts exactly CHALLENGE + CLEANUP,
  null cleanup even with verified evidence, no late sealed-evidence mutation,
  cancelled later calls, independent finalization and rejected qualification of
  a complete live control set containing the uncertain receipt.
- Positive live controls still qualify; incomplete/copy controls, wrong-identity
  PASS consumption and a second consumption are rejected. Existing parent tests
  retain 30 ms cleanup joins/commands, 5 ms uncertainty controls and foreign
  container/volume preservation. Those parent tests are unchanged.

As an additional mutation check, a disposable copy of the **new** suite changed
only its normal default back to 25 ms and selected the historical tamper and new
tight-deadline tests. On each Node major: exit 1, 1 pass / 1 fail; the historical
test failed with the extra CLEANUP while the intentional cleanup negative passed.
This proves the new regression detects the removed fixture defect. No mutation
source remains in the checkout.

## Repeat method and baseline results

[Per-invocation results and timing distributions](repeats.md) retain all bounded
samples, including failures. The driver outside the checkout started a fresh
Node process for every invocation, with at most one child sweep per major
running concurrently and a 60-second per-process guard. Separate parent/package
sweeps and local builds/checks overlapped parts of the sweeps; this is scheduling
load, not an attempt to model a Docker runtime. No failed invocation was retried
or replaced. The before series finished before the test source changed.

Executed command forms under each exact Node executable:

```text
node --experimental-test-module-mocks --test --test-reporter=tap packages/workshop-audit/test/g0-run-controls.mjs
node --test --test-reporter=tap packages/workshop-audit/test/g0.test.mjs
pnpm --filter @metamorph/workshop-audit test
```

The package command used that major's Node to start the installed Corepack pnpm
entrypoint, with that Node directory first in PATH. Uninstrumented child TAP
logs do not emit every passing receipt's fault array: passing arrays are
assertion-verified, not separately observed telemetry. Failure arrays are
reported only when actually emitted. JSONL records contain command, attempt,
exit/signal, elapsed time, test names/status, emitted fault codes and raw-log
location; local capture root is `%TEMP%/mmp-187-evidence/`.

- Before: Node 22, 49/50 processes passed; attempt 24 failed the historical
  post-seal tamper assertion with exactly CHALLENGE + CLEANUP + EVIDENCE.
- Before: Node 24, 49/50 processes passed; attempt 4 failed
  `verified live controls still qualify; copies have no authority and real
  provenance stays NOT_RUN` at `qualifyAdapter()` with `G0_CONTROL_FAILED`.
  That sample did not emit the underlying receipt arrays; its precise secondary
  cause is unknown and is not promoted to a diagnosed cleanup failure.
- Before parent sweeps: 3/3 successful processes per major, each 25 pass / 0 fail
  / 1 Windows POSIX-only skip. Before package sweep: 1/1 successful process per
  major, each 78 pass / 0 fail / 2 existing POSIX-only skips.
- Initial focused post-change commands: both majors exit 0, 8 pass / 0 fail /
  0 skip. A focused Biome check initially found one line-wrap formatting error
  (exit 1); `pnpm exec biome check --write` corrected it (exit 0) before repeats,
  source commit and CI.
- After: 50/50 fresh child processes passed on each major, each 8 pass / 0 fail /
  0 skip (800 executed child test cases across 100 processes).
  Parent sweeps: 3/3 successful processes per major. Package sweeps: 2/2 successful
  processes per major. Neither the intentional timeout nor evidence-integrity
  negative was skipped. This is finite scoped evidence, not a proof that every
  possible scheduling stall is tolerable or that the adapter is qualified.

## Required local checks (after the executable change)

All commands ran under local Node 22.23.1 / pnpm 11.25.0. Exit codes were
captured individually, including when later commands succeeded.

| Command | Exit | Actual result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | Lockfile unchanged; all 12 workspace projects |
| `pnpm lint` | 0 | Root Biome check |
| `pnpm typecheck` | 0 | Build and recursive workspace typecheck |
| `pnpm test` | 0 | 1078 tests: 947 pass, 0 fail, 131 existing platform skips |
| `pnpm build` | 0 | Recursive workspace build |
| `pnpm --filter @metamorph/workshop-audit test` | 0 | 80 tests: 78 pass, 0 fail, 2 existing POSIX skips |
| `node research/mmp-069/check-syntax.mjs` | 0 | 137 syntax files, 0 failures; no module execution |
| `node research/mmp-069/validate.mjs` | 0 | VALID; workspacePackages=12; privilegedRunner=NOT_RUN |
| `node --test research/mmp-069/validate.test.mjs` | 0 | 45 pass, 0 fail, 0 skip |
| `git diff --check` | 0 | No whitespace errors |

The root Windows skips include Linux process groups and POSIX owner/mode,
atomic ciphertext, lease and secure-storage tests. Workshop skips are the
existing POSIX audit-evidence test and POSIX G0 link/permission-tamper test.
No skip/timeout guard was introduced or removed. PR #184's G0 skip declaration,
coverage validator and 12-package inventory are unchanged. The local whole
package check is additional to the repeated package sweeps in repeats.md.

Setup also ran `pnpm install --frozen-lockfile` and `pnpm build` on the unchanged
baseline (both exit 0). The temporary diagnostic/mutation commands deliberately
returned exit 1 for the 25 ms historical assertion and exit 0 for the sufficient
budget counterpart, as described above. No other failed checks are omitted.

## Hosted evidence

The implementation commit's [Fast CI run 41914418833](https://github.com/Meta-Project2026/Metamorph/actions/runs/41914418833)
completed successfully on **attempt 1**, with head
`0dab9dfa9c57d38004d95f4deb69fe62a5a2a8e8` and actual checked-out PR merge tree
`c4f4579ce043f3b1f8a6614e7b27ec11dc5627fc` (verified in both checkout logs).

- [Node 22 job 126870185513](https://github.com/Meta-Project2026/Metamorph/actions/runs/41914418833/job/126870185513):
  Node v22.23.4, SUCCESS; root 1075 pass / 0 fail / 3 existing skips;
  workshop 80 pass / 0 fail / 0 skip; coverage negatives 45/45, 0 skips.
- [Node 24 job 126870184896](https://github.com/Meta-Project2026/Metamorph/actions/runs/41914418833/job/126870184896):
  Node v24.22.2, SUCCESS; root 1075 pass / 0 fail / 3 existing skips;
  workshop 80 pass / 0 fail / 0 skip; coverage negatives 45/45, 0 skips.

GitHub's floating major selectors resolved to these newer patch versions;
the local 50-process matrix uses the exact historical Node 24.22.1 instead.
The final Markdown-only delivery push requires a fresh first-attempt Fast CI
run; its exact final head, checkout merge tree and job links are recorded in
the PR description and Issue #187 handoff after completion. No CI rerun was
requested. Independent exact-head review remains pending; no merge or issue
closure is performed here.

The three hosted root skips are existing platform controls: the Windows-only
fail-closed test, a foreign-owner fixture requiring root/chown, and an
unprivileged-child fixture requiring root to choose UID 65534. The workshop
POSIX evidence and G0 permission/link controls executed on Linux (zero skips).

## Remaining limits

The demonstrated defect is test-only deadline coupling; the original CI pause
itself was not profiled. The additional baseline Node 24 qualification failure
is preserved without inventing its receipt details. The full post-change matrix
and hosted controls show no recurrence within the recorded budget. These are
mocked lifecycle observations; real Docker scheduling, real cleanup failure
qualification, genuine candidate behavior, custody, hidden G4 and product gates
are NOT_RUN or unestablished. No production race was demonstrated or suppressed.

## Acceptance boundaries

`G0_REAL_CANDIDATE=NOT_RUN`; no formal G0 PASS; G4 `INCONCLUSIVE`;
product `NOT_ESTABLISHED`. No paid API, private ciphertext, hidden G4,
owner-custody operation or real Docker execution occurred.
