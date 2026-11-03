# PR #153 independent review fixes

Reviewed base: `9921318504cd7734034352846ba8f55f325dd4af`.
[Requested changes](https://github.com/Meta-Project2026/Metamorph/pull/153#pullrequestreview-5746392617).
Scope: the three reported P0/P1 defects; no paid calls or workflow dispatches.

## Root causes and changes

- **P0 cleanup ownership:** the old launcher exposed the shared host Docker
  socket. Both `finalizeCustody(null)` and the existing resource ledger's global
  provenance prefix could delete another run's resources. The launcher now
  creates one pinned disposable Docker-in-Docker daemon, exposing only its
  private Unix socket and data volumes to the harness. No host socket/bind path,
  published TCP port, host network or PID namespace is passed. Both ordinary and
  credential-scrubbed Docker routes must prove the same daemon ID and run label.
  Initial/final inventory allows only the three exact run-owned scratch volumes;
  unexpected resources cause non-destructive audit refusal. Outer cleanup checks
  exact labels/names, removes inspected container IDs, and attempts every owned
  cleanup even if an earlier step fails. Existing shared resource APIs remain.
- **P1 operation lifetime:** each bounded operation propagates abort, stops all
  registered resources and joins the operation plus resource closure before
  source release/cleanup. A finite termination grace never converts uncertainty
  into a zero-resource claim. Unsettled operations quarantine the source lease,
  skip cleanup and report `OPERATION_UNSETTLED` /
  `UNVERIFIED_OPERATION_ACTIVE`; the run cannot restart or repair. The Linux
  Oracle adapter joins its entire process group, with TERM/KILL escalation and
  an init reaper. Interrupted daemon-side operations remain unverified even after
  client termination; the outer launcher destroys the dedicated daemon/data.
- **P1 receipt consistency:** the unchanged public projection intentionally omits
  raw pair build/identity/error fields. The consumer now requires its existing
  exact G1 diagnostics envelope to bind source, candidate, attempt and pair to
  G1 PASS, with the known unavailable-diagnostics shape. Supplied raw build,
  candidate/attempt identity and error fields must agree; malformed/unknown or
  contradictory fields fail closed. Valid serialized public receipts and the
  27 public controls with G4 INCONCLUSIVE remain supported. No raw HTTP/SQL,
  diagnostics or hidden G4 enter feedback.

## Executed reproductions and regression checks

| Check | Before | After |
| --- | --- | --- |
| Actual launcher + real finalizers with injected Docker process I/O; foreign resource appears after preflight | Exit 1: foreign resource deleted | Exit 0: foreign container/volume survives both finalizers; dedicated socket selected |
| Custody and verifier ignore abort while delayed | Cleanup precedes operation completion | Operation settles before cleanup; timeout remains ERROR |
| Non-cooperative child scheduled to write later | Child alive during cleanup | Child terminated and closure joined; no late write |
| Unjoinable operation | Claimed verified cleanup | Lease quarantined; cleanup skipped; no verified claim |
| Contradictory pair build/identity/error and missing/foreign G1 binding | Accepted; second send possible | Rejected for both PASS/FAIL baselines; one send, no repair |

Initial review regression command
`node --test packages/agent-real/test/autonomous-review.test.mjs` exited **1**:
13 failures reproduced the two P1 defects; one valid receipt control passed.
The separate P0 launcher regression exited **1** before its implementation fix.
After fixes, focused Windows controls pass, including both daemon routes, identity
mixups and foreign inventory without destructive operations. Linux process-group
coverage is a Windows platform skip and must run on Linux before claiming it.

Required root commands `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
were executed outside the Windows filesystem sandbox and each exited **0** on the
completed code (822 tests: 711 passed, 111 platform skips). Focused controls exited
**0**: 38 passed, one Linux process-group platform skip. Research syntax check
exited **0** (114 modules); unchanged shared-scope comparison and diff whitespace
check exited **0**. Linux coverage, dedicated Docker outcome and CI are recorded
below after execution. Until recorded, the new dedicated Docker acceptance is
**NOT_RUN**, and old shared-daemon smoke evidence cannot establish it.
No host execution of candidate or reference source is authorized or performed.

## Remaining boundaries and decisions

Docker-in-Docker uses a resource-bounded privileged trusted daemon sidecar. It
receives no host Docker socket, host filesystem binds or provider credentials. Candidate
source stays in the disposable nested state and restricted workers. This is
daemon isolation, not a VM/kernel isolation claim. The immutable official image
is `docker:29.9.2-dind@sha256:9e79b879b177fbd72c34376a3dd3d91747da5db49e1f560f76aea59561471977`
(qualified against [official Docker metadata](https://raw.githubusercontent.com/docker-library/repo-info/master/repos/docker/remote/29.9.2-dind.md)). All generated source runs
only inside the unchanged network-off PHP/TS workers.

Historical synthetic receipts remain historical and do not certify these fixes.
The mock tariff reservation USD 0.828444 remains a projection, never a guaranteed
charge cap. Production `autonomous_repair` stays `BLOCKED_BUDGET_GUARANTEE`;
second signed admission/custody, financial risk resolution, G0/G4 and product
acceptance remain unestablished. Frozen reference, comparators, schemas, shared
resource APIs and historical paid candidates were not changed.

**Scaffold merge: NO_GO pending independent ChatGPT re-review of the exact new head.**

**Paid experiment: NO_GO; no paid calls, Meta GET/POST or workflow_dispatch permitted.**
