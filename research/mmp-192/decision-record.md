# MMP-192 D0 decision record — unsigned proposal

| Field | Proposed value / required owner choice |
| --- | --- |
| `decision_id` | `MMP-192-D0` |
| `version` | `0.1.0-proposed` |
| `proposal_commit_sha` | `UNBOUND_PENDING_EXACT_PR_HEAD`; bind externally as described below |
| `timestamp` | Draft created `2026-11-05T00:30:42+02:00`; decision timestamps `PENDING` |
| `status` | `PENDING_BOTH_OWNERS` |
| `base_sha` | `14a54665a94394ca9fdb68a7c27f0c596428cbea` |
| `independent_exact_head_review` | `PENDING`; reviewer identity, scope, findings, link and reviewed SHA required |

This is a proposal, not permission. A commit cannot contain its own final Git object SHA without changing that SHA: after publication bind `proposal_commit_sha` to the PR's exact current head in the two owners' authenticated decisions and in the review record. If the proposal changes, its new SHA requires a new review and both new decisions. A base SHA, branch name, PR URL or decision template is not a substitute.

## Principals and authority

| Role | Required identity and duties | Status |
| --- | --- | --- |
| Vladimir, migration/orchestration owner | Independently authenticates and explicitly accepts or rejects the exact SHA and full operating envelope | `PENDING` |
| Ilia, Oracle/comparator owner | Independently authenticates and explicitly accepts or rejects the same exact SHA and full envelope | `PENDING` |
| Operator | Named trusted person and **distinct GitHub account** from the other approving owner; operates only within a separately authorized execution window | `PENDING` |
| Supervisor/recovery principal | Named principal outside guest, access to only the specified VM lifecycle and controlled evidence destination; no candidate access to its authority | `PENDING` |
| Independent design/implementation reviewer | ChatGPT independent exact-HEAD review, with findings/disposition recorded; authorized local reviewer independently examines raw public/synthetic evidence | `PENDING` |
| Provisioner / infrastructure administrator / evidence custodian | Named principals and management-plane capabilities, including any privileged provider administrators and their residual trust | `PENDING` |

Record Vladimir and Ilia's **separate GitHub account IDs**, authenticated public decision links, exact matching SHA, UTC timestamps, expiry, and clear accept/reject text. The same account cannot sign for both, one owner cannot approve for the other, and a kickoff statement cannot constitute either approval. The operator may be an owner only if the roles and independent checks are separately agreed.

## Boundary fields — all concrete identities pending

| Field | Proposed constraint / required exact binding |
| --- | --- |
| `daemon_kind` | `dedicated-rootful-linux-amd64-vm` proposed; version and daemon instance identity `PENDING`. Rootless or another design needs a fresh reviewed equivalence decision. |
| `provider_vm_identity` | Provisioning source, provider/hypervisor account, exact one-shot VM ID, guest image/kernel/boot ID, region/host and administrator list `PENDING`. A service with an unknown charge is not authorized. |
| `socket_endpoint_identity` | Guest-only Unix socket path, filesystem/device/inode and daemon binding, access principal/ACL, pinned CLI executable/config and supervisor observation `PENDING`. Deny workstation and fallback endpoints. |
| `exclusive_host_volume_network` | Exact guest virtual disks and containerd/Docker roots, quotas, isolated network interfaces and host/hypervisor storage boundaries, VM lease and all authorized principals `PENDING`. No Docker Desktop mounts, devices, daemon or secrets. |
| `quarantine_and_recovery` | Outside-guest watchdog, independent operator identity and narrowly scoped stop/quarantine method, recovery deadline, exact evidence export destination and safety demonstration `PENDING`. Inability to establish these is `BLOCKED`. |
| `source_and_expiry` | Pinned provisioning recipe and verified image; lease start/end, maximum lifetime, evidence hold, exact authorized disposal action and owner/custodian `PENDING`. Teardown is not proof of successful normal cleanup. |
| `immutable_pins` | Guest image, kernel, daemon/containerd/runc and CLI, cgroup/seccomp policy, VM/controller/supervisor/actuator/evaluator SHAs, worker image digest, runtime recipe, fixture and dependency hashes `PENDING`. No mutable tag as identity. |

The current WSL2 Docker Desktop instance is **not** this environment. No exclusivity claim is made for it.

## Proposed scope and limits — ceilings, not authorization

The owners must accept or tighten every ceiling and validate that the selected provider can enforce it. If a workload cannot fit, stop and request a revised decision; never silently raise a limit.

| Bound | Proposed maximum |
| --- | --- |
| Total execution, including provision, preflight, cases, evidence export and terminal stop | `60 minutes` from first provisioning action; external watchdog enforces the deadline. An incomplete evidence-preserving stop is an incident, not a license to discard evidence. |
| Concurrency | `1` test case / active mutation; no automatic retry, resampling or best-run selection. Keep every started attempt. |
| Guest envelope | `2 vCPU`, `4 GiB` RAM, `16 GiB` dedicated virtual disk; separate bounded evidence destination `2 GiB`. Actual allocatable capacity and provider cost require approval and preflight. |
| Each candidate or fault workload | At most `180 s` work, plus separately bounded `10 s` normal cleanup and `10 s` finalizer; `1 CPU`, `256 MiB` memory, no swap, `64` PIDs; current tmpfs ceilings `64 + 16 + 16 MiB`. An outside watchdog and management reserve must remain responsive. |
| Each case's evidence/storage | At most `128 MiB` total additional retained public/synthetic case material, including normal and finalizer captures, ledgers, receipts and temporary duplication; current command combined output limit `4 MiB`, trace limit `32 MiB` per evidence sink. Fail closed before exhausted capacity; do not truncate evidence to claim completeness. |
| Stop-loss | Supervisor heartbeat or identity gap; lost exclusivity; unknown owner/ID/volume; out-of-ledger operation; unsolicited client/admin intervention; resource/host pressure; inaccessible recovery or evidence destination; raw-data leak; any breach of bounds or deadline. Stop useful work and classify `ERROR/BLOCKED`. |

Existing per-adapter limits are in [policy.mjs](../../packages/workshop-audit/src/g0/policy.mjs#L10); the larger total, VM and storage ceilings above are new proposals, not currently enforced controls. The total ceiling does not authorize interrupting or deleting an evidentiary hold; where the out-of-band stop cannot preserve evidence the run is blocked in preflight.

## Allowed and forbidden operations

**Allowed only after D0, implementation review and a separate bounded execution authorization:** fixed, original public/synthetic fixtures with pinned identities; the 12 individually approved classes in [fault-matrix.md](fault-matrix.md); predeclared trusted observation, a differently owned synthetic sentinel, exact-ledger/verified-ID normal or separately recorded emergency cleanup, and the identified VM's approved stop. Every class needs an injection method, independent failing control, private evidence, expected safe outcome and exact scope before admission.

**Forbidden:** global prune; same-prefix or wildcard cleanup; touching real foreign containers/volumes; deleting an unknown object; changing the workstation's Docker Desktop or invoking [#134](https://github.com/Meta-Project2026/Metamorph/issues/134)'s legacy workshop finalizer; exposing Docker socket, host mounts, keys, secrets, network, Oracle, reference, private/hidden corpus or evidence to candidate code; candidate JS/TS execution on the host; paid/provider calls; best-run selection; automatic retries; shared Oracle/worker/DTO/cleanup trust changes without explicit joint agreement.

## Evidence and approvals

Before starting, privately record full read-only inventory, socket/VM/daemon identity, exact ownership labels and IDs, resource/cgroup/seccomp capabilities, pins, credentials/ACL boundary, supervisor continuity and a tested recovery route. Record daemon identity and complete inventory again after every relevant transition and at terminal state. Raw logs, inspect, ledger, stdout, HTTP/DB traces, paths and all complete/partial attempts stay in an owner-controlled, access-restricted location; publish only allowlisted coarse statuses and commitments after review. Normal and finalizer evidence catalogs are separate; receipt integrity and incident retention need independent commitments. A hash alone is not authenticated custody. See [safety-runbook.md](safety-runbook.md).

| Approval state | Meaning |
| --- | --- |
| `PENDING` | Default; one or both decisions or independent review absent. Current D0 status is `PENDING_BOTH_OWNERS`. |
| `APPROVED_BY_BOTH` | Both distinct authenticated owners explicitly accept the **same exact reviewed SHA**, full boundaries and expiry; all required identity/limits fields resolved. Does not itself authorize a real fault run. |
| `REJECTED` | Either owner rejects, or an explicitly required review rejects; no implementation under that proposal. |
| `EXPIRED` | Agreed deadline elapsed, SHA/boundary changed, authority revoked, or required continuity no longer holds. A new decision is needed. |

No owner signature, provider identity, execution authorization, real evidence or approval has been supplied by this document.
