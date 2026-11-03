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
check exited **0**. New Linux, dedicated Docker and hosted CI results are recorded
below. Old shared-daemon smoke evidence remains historical.
No host execution of candidate or reference source is authorized or performed.

## Exact review-fix execution

Implementation commit: `aa54f91`; source used for the dedicated daemon run:
`7a11a0b8966d8ca885d1dd846608e6f9dce9aaca` (fixture whitespace follow-up only).
Windows Node 24.21.0 / pnpm 11.25.0; Docker host 29.9.2.

| Command / boundary | Exit | Observed result |
| --- | ---: | --- |
| `pnpm lint` | 0 | 345 package/config/test files |
| `pnpm typecheck` | 0 | Existing workspace command |
| `pnpm test` | 0 | 822 total; 711 passed; 111 platform skips; 0 failed |
| `pnpm build` | 0 | Existing workspace command |
| Focused `autonomous-repair`, `autonomous-review`, `mmp151-daemon` test files | 0 | 38 passed; one Linux-only skip on Windows |
| `node --test packages/agent-real/test/autonomous-review.test.mjs` in disposable Linux harness | 0 | 16/16; no skips; non-cooperative child/grandchild and lease/receipt controls executed |
| `node research/mmp-069/check-syntax.mjs` | 0 | 114 modules; parse only |
| `git diff --cached --check` after fixture newline correction | 0 | No whitespace errors |
| `Invoke-DockerSmoke.ps1 -ScratchRoot <outside-repository-temp>` | 0 | Dedicated daemon; 2 simulated requests / 1 repair / 2 full Oracle verifications; first HTTP_JSON_TYPE FAIL, second G1/G2/G3 PASS; each 6 build checks, 17 HTTP, 20 SQLite, 27 public controls |
| Host resources created after preflight, inspected after the complete smoke | 0 | Both inert foreign container and empty volume survived; only their exact labeled test resources were subsequently removed |
| Independent outer owned-resource inventory | 0 | Dedicated daemon/harness and their exact two outer volumes gone; no foreign resources deleted |
| [Fast CI 41570956623](https://github.com/Meta-Project2026/Metamorph/actions/runs/41570956623) on `7a11a0b` | 0 | Node 22 and 24 SUCCESS; no workflow_dispatch |

The source for the fresh proof is exactly
`7a11a0b8966d8ca885d1dd846608e6f9dce9aaca`; follow-up commits only publish this
report and the [allowlisted proof](evidence/review-fixes-docker-7a11a0b.json).
Both candidates retained their independent hashes from the public synthetic
fixture/mutant. Each age TEST-key readback preceded its separate Oracle process.
All normal and independent cleanup checks reported zero owned resources and no
emergency removals; the controller released its source lease only after joined
operation completion. No private source, ciphertext, raw observations or TEST
identity was exported. The stopped foreign container/empty volume were created
on the host daemon after the harness started, with the old global cleanup
prefixes, and survived both Oracle attempts plus finalization. This actual
isolation check supplements the reproducible before/after injected-process test.

The successful path and all requested negative regressions are locally verified.
This remains a synthetic transport/repair demonstration, not paid model output.

The additional internal read-only candidate review identified the nested Docker
client termination gap; the process-group adapter and fail-closed daemon-operation
state address it. That engineering check is not the owner's independent GitHub
review or merge approval. Shared Oracle, worker, differential, contracts, workflow
and `.specify` files remain unchanged by these review fixes.

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
