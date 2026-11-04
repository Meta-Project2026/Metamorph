# MMP-183 public Linux Docker validation — 2026-11-04

Refs [#183](https://github.com/Meta-Project2026/Metamorph/issues/183),
[#57](https://github.com/Meta-Project2026/Metamorph/issues/57),
[defect #190](https://github.com/Meta-Project2026/Metamorph/issues/190),
[Draft PR #191](https://github.com/Meta-Project2026/Metamorph/pull/191).

**PUBLIC_SYNTHETIC_DOCKER_QUALIFIED**, strictly for the fixed public 11+1
qualification session at clean evaluator `48f182374b260cc3bcaaeeed0569a1eeb50979ad`.
Fetched base: `297919d3e1476eb7f17b59e7e671787e0af94` (merged #189).
The following report commit adds documentation; it does not inherit or rewrite
the evaluator identity. Final delivery HEAD/base, CI merge checkout and checks
on that final HEAD are recorded in PR #191. This report cannot contain its own
commit hash. Safe machine-readable identities, per-run hashes and observations
are in [linux-docker-result.json](linux-docker-result.json).

## Environment and preflight

Executed on the owner's local Docker Desktop Linux engine through Ubuntu WSL2,
Linux/amd64, kernel `6.18.54.1-microsoft-standard-WSL2`, Docker Engine `29.9.2`,
Docker Desktop `4.97.0`, rootful daemon, cgroup v2, built-in seccomp. Host Node
`v22.22.1`, pnpm `11.25.0`; worker Node `v24.11.0`, SQLite `3.50.4`,
TypeScript `5.9.3`, libfaketime `0.9.10-2.1`, as measured in the actual image.
The current session does not expose its actual model ID or thinking effort;
the requested sol 6.1/ultra configuration is not independently asserted.

`git fetch origin --prune` exited 0; main matched the prompt's base. The original
Windows feature checkout was clean and was preserved. Authenticated open-PR
inventory returned none before this branch. A separate Linux clone, fresh
`Vladimir/mmp-183-linux-docker-qualification` branch and clean full-untracked
Git status were used for each CLI session. No feature pointer was changed.

Read-only preflight commands included `uname -srm`, `uname -m`,
`cat /sys/fs/cgroup/cgroup.controllers`, `docker version`, `docker info`,
container/volume inventory, Node/pnpm/Git versions and actual immutable-image
build/inspect. All successful-path commands exited 0. The initial PowerShell to
WSL inline wrapper failed with exit 1 before any clone/container because quotes
were preserved incorrectly; a literal bash script corrected the operator wrapper.
This was not a Docker qualification attempt.

The daemon had one stopped, unprivileged foreign container with no Docker socket
mount and zero volumes. No competing workload or resource mutation was observed.
This is an owner-workstation engine, not a newly provisioned exclusive chaos
sandbox or independently attested daemon exclusivity. No destructive fault
injection, daemon configuration change or unrelated resource deletion occurred.
Exact before/after container IDs and configuration/state matched; inventory
remained one stopped foreign container and zero volumes. All G0 resources were
removed by their exact IDs with matching run/owner/role labels. No global/prefix
prune, foreign removal, privileged helper or host Docker socket mount was used.

Actual per-container inspections, before candidate compilation/runtime and after
creation, checked image/user/environment/command, read-only root, cap-drop ALL,
no-new-privileges, network none, private IPC/PID/cgroup namespaces, no bind/volume/
socket/reference mounts, bounded tmpfs, 1 CPU, 256 MiB RAM/no swap and 64 PIDs.
In-container observers verified process/UID/capabilities/seccomp/environment,
loopback-only/no routes, read-only root and actual cgroup/tmpfs limits. Permission
and transport denials were observed, rather than inferred from launch flags.
Resource-limit enforcement observations do not prove resource-exhaustion faults.

Image: `sha256:816fa45d27e76735487dbc9db5d848eef2f90530c9d9e93c584da0db664a7e02`. Recipe SHA-256:
`f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3`. The unchanged trusted worker Dockerfile uses a digest-pinned
Node base; fixture provenance/license notices remain intact. Only trusted image
setup/dependency installation used host networking. Candidate material ran only
inside the restricted Docker containers, with independent tmpfs state.

## Preserved failures and correction

| Attempt | Evaluator | Actual finding | Outcome / cleanup |
| --- | --- | --- | --- |
| 01 | `297919d` | ENVIRONMENT: clone under umask 077 gave checked-in recipe scripts mode 0600; Docker COPY retained root-only access; trusted provenance.mjs failed EACCES before any candidate | CLI exit 1, positive ERROR/G0_ENVIRONMENT; evidence verified; normal and finalizer 0/0/0 |
| 02 | `297919d` | IMPLEMENTATION_BUG: native probe expected ERR_ACCESS_DENIED, actual pinned Node denial is ERR_DLOPEN_DISABLED | CLI exit 1, positive ERROR/G0_CONTROL_FAILED; evidence verified; normal and finalizer 0/0/0 |
| Native diagnostic | `297919d` | Same immutable image/public artifacts and policy; actual nativeLoaded=false, ERR_DLOPEN_DISABLED | Exit 0; normal and reopened independent ledger finalizer 0/0/0 |
| 03 | `48f1823` | Fresh fixed suite after the narrow correction; new output root/run IDs; no inherited qualification | CLI exit 0; all 12 observations below verified |

Attempt 01 was corrected by setting only public checked-in recipe inputs to 0644
inside a private 0700 ancestor. Raw evidence stayed 0600/0700. There was no source,
Docker policy or worker recipe change. Both failed original packs are retained.
The implementation defect is independently tracked in #190. Node's
[pinned --allow-addons documentation](https://nodejs.org/download/release/v24.11.0/docs/api/cli.html#--allow-addons)
also names ERR_DLOPEN_DISABLED. The fix requires that exact denial for native
loading and retains ERR_ACCESS_DENIED for other synchronous permission probes;
ERR_DLOPEN_FAILED, unrelated ERR_ACCESS_DENIED and successful native loading
remain rejected. No --allow-addons or broad error acceptance was introduced.

A hermetic classification regression was added **before** the fix: exit 1,
0 pass/1 fail. After the source fix: exit 0, 1 pass/0 fail. Its APIs are fake;
no host filesystem/process/network/native isolation probe or candidate executes.
The separate real-Docker diagnostic above supplies actual runtime evidence.

## Fixed fixture observations

The order, public bundle hashes and expectations came from `syntheticCases()`
on the exact evaluator. Initial positives must be INCONCLUSIVE with
G0_QUALIFICATION_REQUIRED until all controls qualify; that is not G0_PASS.
Counters are containers/volumes/emergencyRemoved for normal and independent
finalizer separately. All rows have verified exact-byte evidence catalogs.

| Fixed case | Expected | Actual | Safe code/status | Evidence verified | Normal | Finalizer |
| --- | --- | --- | --- | --- | --- | --- |
| positive | INCONCLUSIVE | INCONCLUSIVE | G0_QUALIFICATION_REQUIRED | yes | 0/0/0 | 0/0/0 |
| static | FAIL | FAIL | G0_CHALLENGE | yes | 0/0/0 | 0/0/0 |
| golden-replay | FAIL | FAIL | G0_CHALLENGE | yes | 0/0/0 | 0/0/0 |
| missing-route | FAIL | FAIL | G0_CHALLENGE | yes | 0/0/0 | 0/0/0 |
| reference | FAIL | FAIL | G0_DEFECT_REFERENCE | yes | 0/0/0 | 0/0/0 |
| corpus | FAIL | FAIL | G0_DEFECT_CORPUS | yes | 0/0/0 | 0/0/0 |
| docker-socket | FAIL | FAIL | G0_DEFECT_DOCKER | yes | 0/0/0 | 0/0/0 |
| proxy | FAIL | FAIL | G0_DEFECT_NETWORK | yes | 0/0/0 | 0/0/0 |
| spawn-import | FAIL | FAIL | G0_FORBIDDEN_IMPORT | yes | 0/0/0 | 0/0/0 |
| workshop-positive | INCONCLUSIVE | INCONCLUSIVE | G0_QUALIFICATION_REQUIRED | yes | 0/0/0 | 0/0/0 |
| workshop-static-cancel | FAIL | FAIL | G0_CHALLENGE | yes | 0/0/0 | 0/0/0 |
| qualified-positive | PASS | PASS | G0_PASS | yes | 0/0/0 | 0/0/0 |

The spawn-import mutant is structural rejection and launches no candidate.
The other ten fixed cases and the fresh twelfth positive executed the actual
Docker build/runtime path. Expected FAILs establish negative-control rejection,
not a G0_PASS for those mutants. Positive item writes/readback and workshop
slots/book/read/update/cancel ran against real independent SQLite state, with
fresh challenge values kept in restricted evidence. Each successful positive
has both pre/post process and denial observations. No HTTP/DB values are published.

Only after eleven verified live observations did `qualifyAdapter` qualify this
exact evaluator/image/recipe; a new twelfth invocation returned G0_PASS.
Reopened source/ledger/catalog verification checked all 12 exact candidate,
manifest/scope/evaluator/runtime identities, fixture outcomes, no extra faults,
actual inspect and probe observations, full positive mandatory IDs, qualification
membership and every deletion against its full-ID owner ledger. All normal and
independent finalizers were 0/0/0; evidenceVerified=true throughout attempt 03.
The CLI's final clean-HEAD check also passed. The native defect is corrected in
this evaluator; neither earlier failed attempt is relabelled success.

## Evidence custody and residual acceptance

Raw stdout/stderr, Docker info/inspect, provenance, traces, ledgers, receipts,
normal/finalizer catalogs, private operator scripts and inventory snapshots are
retained outside Git in an owner-controlled WSL directory, directories 0700 and
files 0600. Public output is explicitly selected hashes/identities/coarse codes;
no private paths, container names, daemon endpoints, sources, challenge entropy,
HTTP/DB observations, keys, ciphertext or raw archive is committed/uploaded.
Private catalog commitment: `c09a75dc5a525e915841e5110b33a60c16662be2d7f47341196e2b40f4c40df5`.
This is integrity evidence, not authenticated owner custody, independent human
attestation, durable two-domain restoration or formal G4. The executor's recheck
is not the separate ChatGPT review requested after push.

The legacy workshop finalizer described by #134 was not invoked or modified.
G0 used only `g0/finalizer.mjs` and its reopened exact-run/owner ledger; no prefix
path was used. #134 remains OPEN for its own separate pathway.

All following real fault controls are **NOT_RUN**: abort/cancel; memory/CPU/PID
exhaustion; abort-ignoring process; partial create; unknown inventory; unavailable
Docker socket; mismatched IDs/labels; same-prefix foreign container/volume;
loss of finalizer; late writer. The existing `execute` seam supports command
models, not a shipped safe engine-backed fault suite. Ordinary fixed runs did
observe actual cancellation/join during normal teardown and resource limits,
but do not qualify those negative faults. Mock/unit coverage is separate.

Narrow next decision proposal: both owners choose a dedicated disposable daemon
and review an injector using existing exact-run ledgers, immutable public
fixtures, retained originals and bounded supervisor recovery. Establish exact
owned resource IDs and synthetic same-prefix sentinels; assert refusal on unknown
ownership and preserve incident ERROR even after recovery. New external injection,
CLI/schema/trust-boundary/finalizer/CI changes require the stated joint decision;
none was introduced here. Fault readiness and authentic owner candidate admission
remain outstanding, so #183/#57 are not complete and this PR stays Draft.

## Commands and final delivery

Executed install/build before Docker: `pnpm install --frozen-lockfile` exit 0,
`pnpm build` exit 0. Synthetic attempts 01/02 exited 1; attempt 03 exited 0.
The new regression before/after exited 1/0. Source `git diff --check` exited 0.
Initial source-head Fast CI [41919683741](https://github.com/Meta-Project2026/Metamorph/actions/runs/41919683741)
succeeded attempt 1 on Node22 and Node24. It is mock/contract CI, not Docker proof.

After this documentation commit, execute frozen install, lint, typecheck, root
test, build, workshop-audit/target-worker tests, MMP-069 syntax/validator/negative
controls and diff-check at the exact final HEAD. Actual exit codes/test skips,
final HEAD/base/merge checkout/tree and replacement Fast CI run/attempt are
recorded in PR #191's final validation record; those checks are not claimed
complete by this pre-commit document. No new research .mjs entrypoint is added,
so the coverage inventory requires no new entry. Existing generated scaffolding,
shared DTOs, Oracle/G1-G3, fixtures, runtime recipe, finalizers and CI are unchanged.

`G0_REAL_CANDIDATE=NOT_RUN`, `G4=INCONCLUSIVE`, `PRODUCT=NOT_ESTABLISHED`.
No private restoration, owner attestation, hidden run, Meta/model/paid request,
workflow dispatch, self-review approval, self-merge or issue closure occurred.
