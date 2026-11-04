# MMP-183 — exact-candidate standalone G0

Refs [#183](https://github.com/Meta-Project2026/Metamorph/issues/183),
[#57](https://github.com/Meta-Project2026/Metamorph/issues/57),
[#56](https://github.com/Meta-Project2026/Metamorph/issues/56).
Actual fetched base: `3cf75ae4124bd1ef3c61a6f20c7f0510369fec3d`.
The initial checkout was an older feature branch with unrelated untracked
directories; implementation uses the separate `codex/mmp183-g0` worktree.
No open PRs were returned by the authenticated collision check on 2026-11-04.

This is an implemented **public/synthetic engineering slice**, pending independent
review and real Linux/Docker qualification. It does not register a benchmark,
ratify governance, change shared APIs, certify a PHP migration or execute G4.
The exact implementation HEAD and hosted check links belong to the Draft PR.

| Status | Evidence / remaining dependency |
| --- | --- |
| IMPLEMENTED | Separate `packages/workshop-audit/src/g0/` adapter, scope admission, probes, dynamic challenge, receipts and finalizer |
| TESTED_SYNTHETIC | Trusted host boundary/observation models; no candidate execution on the host; see [validation](validation.md) |
| G0_IMPLEMENTATION_READY | PENDING independent code/security review and actual Docker proof |
| REAL_DOCKER_NOT_RUN | Windows host; `docker info` could not open the Linux engine pipe |
| G0_REAL_CANDIDATE_NOT_RUN | No private candidate/key/ciphertext accessed; no owner-local attestation supplied |
| Product acceptance | NOT_ESTABLISHED; existing Oracle G0/G4 results unchanged |

Later execution: [Linux Docker validation](linux-docker-validation.md) records
the source-bound 2026-11-04 public/synthetic qualification and preserved failed
attempts. The implementation-stage table above is historical; real fault controls,
authentic candidate admission and formal acceptance remain separate.

## Scope and implementation decisions

`policy.mjs` registers a trusted local `g0-standalone-v1` declaration before
candidate execution. It fixes benchmark/version, source and manifest hashes,
exact admitted bundle SHA, candidate provenance commit, evaluator commit, worker
image/recipe, every migration unit/file/route, unsupported IDs and exact mandatory
test/control IDs. The candidate cannot supply this declaration or a verdict.
Every admitted file must occur in the unit map and every mandatory route must
have coverage. Copies of a registration are not trusted registrations.

Two deliberately bounded challenge profiles exist:

- `items-v1`: complete declared read/write items service; empty independent
  initial state and two fresh 256-bit values written/read sequentially.
- `workshop-v1`: slots, appointments, book, update and cancel; two fresh 128-bit
  identity values, dates, subsequent reads and deletion observations. This is
  not every PHP route, error, header, data type or possible state transition.

The owner must explicitly exclude unsupported behavior. A scope with no
exclusions uses `unsupported: []`; identifiers remain bounded and
unique. Source/manifest/provenance hashes in a local declaration are claims,
not independently authenticated owner custody. A unit-to-route map and
finite challenges establish **declared coverage**, not code/branch coverage or
proof about arbitrary PHP behavior. Additions need a new version and reviewed
challenge policy; a smaller scope cannot inherit a broader completeness claim.

The new adapter uses the **unchanged** target-worker Dockerfile, pinned base image,
toolchain, `build.mjs`, `launch.mjs` and HTTP inspector. It does not modify
TargetWorker, runtime trust tokens, `verifyPair`, GateResult, normalization,
MANIFEST, original fixtures, historical receipts or any existing finalizer.
Unlike the existing differential worker, this G0-only adapter uses fresh bounded
tmpfs state and creates **no Docker volumes**. It collects no differential parity
or DB-comparison verdict. Shared integration changes remain a Vladimir + Ilia
decision gate; no agreement is implied here.

Build/runtime containers have no source bind mount, network, Docker socket,
reference state, PHP, corpus or secrets. All admitted TS bytes enter the
compiler over stdin; compiled artifacts enter a separate runtime over stdin.
The immutable image is built by trusted setup in the current process, inspected
by exact ID, and measured against every worker/toolchain file hash and pinned
versions. An arbitrary image ID or simulated command cannot issue a trusted
production receipt through `runG0`.

Actual Docker inspection must match nonroot identity, exact image, command,
environment and ownership labels, private network/IPC/PID/cgroup namespaces,
read-only root, dropped capabilities, no-new-privileges, mounts/tmpfs and resource
bounds. Runtime probes inspect `/proc`, network interfaces/routes, candidate
permission flags/environment and absence of forbidden material. They also require
actual cgroup-v2 CPU/memory/swap/PID limits, tmpfs sizes/mount flags, read-only root,
UID, zero effective capabilities, no-new-privileges and active seccomp. A host
without those observable controls fails closed; requested Docker flags alone
cannot establish enforcement. A separate
probe process uses the same candidate Node permission flags and deliberately
attempts filesystem/reference/corpus/socket access, PHP/child spawning, native
loading, external TCP, reference TCP and Unix-socket access. Permission denial
and absent transport are distinct observations retained in private command
receipts. Structural source/import checks alone never prove Docker isolation.

The trusted HTTP inspector runs as UID 10002 inside this G0 runtime namespace;
it never imports candidate JS and has no permission to read the UID 10001
source/state tmpfs. It receives only the current request. This is a new isolated
G0 composition, not a change to the differential worker's separate inspector.
Neither hidden inputs nor expected-output files enter any G0 container.

Each candidate invocation is bounded to 180 seconds, 1 CPU, 256 MiB RAM/swap,
64 PIDs, 64 MiB work, 16 MiB state and 16 MiB temporary storage. Commands have
15-second limits (isolated compilation up to 35 seconds within the same lifetime).
Cleanup and independent finalization each have a separate 10-second budget.
Normal cleanup first bounds its cancelled-work join inside that budget. Command
waits also have host-side deadlines even if a command wrapper ignores abort.
An unresolved operation yields `G0_CLEANUP`, unknown normal cleanup (`null`) and
an independent ledger finalizer attempt; it cannot yield normal zero counts.
The adapter starts no further normal mutations when the join is uncertain, and
no new commands after its cleanup deadline. Late command settlement cannot write
sealed evidence. A stuck external daemon operation may still complete later;
the finalizer's inventory is an observation, not proof that operation stopped.
Such a run stays ERROR and may require later owner/supervisor recovery.
Private capture is bounded to 512 events, 4 MiB per command and 32 MiB per trace.
Trusted image setup is separately bounded to 240 seconds; only setup may use the
host's network. Setup does not run candidate material.

## Qualification and cleanup

The manual synthetic entrypoint runs eleven fixed fixture observations: original
items/workshop positives; static, golden replay, missing route, reference,
corpus, Docker socket, proxy, prohibited process import and static-cancel mutants.
All must produce the intended observed outcome/code with normal zero cleanup.
The process-import case is structural; the other mutants execute in Docker.
The fixed positives initially remain `INCONCLUSIVE / G0_QUALIFICATION_REQUIRED`.
Only live complete fixture observations can qualify that exact image/recipe/
evaluator, after which a twelfth invocation rechecks a positive and may issue
`G0_PASS`. A single candidate run cannot bypass this procedure. No serialized
past PASS or caller-selected expected result can qualify an adapter.
Qualification additionally requires the private live observation's verified
evidence condition. Every material secondary fault participates in assessment:
a challenge FAIL plus evidence/capture/finalizer integrity error is ERROR while
retaining the original challenge finding. Both normal and finalizer catalogs
are independently verified, and a failed receipt write gets no live authority.

The host persists a private exact-name/ID/run/owner/role ledger **before creation**.
Normal cleanup validates labels and deletes only exact full container IDs.
An independently reopened ledger and a fresh adapter/trace perform finalization,
including after timeout, cancellation, evidence exhaustion or normal teardown
failure. Neither path deletes by name prefix, prunes resources or removes a
foreign volume. Unknown ownership/inventory is ERROR; zero after emergency
removal remains ERROR. PASS requires normal and independent final counts
containers=0, volumes=0, emergencyRemoved=0, complete control/test IDs and verified
exact-byte private evidence. Primary and cleanup/evidence faults are retained.

Ledger, finalizer and trace files use exclusive creation/atomic replacement,
owner-only permissions, link/owner/inode checks and a post-teardown hash catalog.
The separate finalizer trace remains available when normal capture fails.
Process/host hard kill cannot issue a final receipt; an external supervisor or
owner must run the independent `finalize` entrypoint against the retained ledger.
An absent finalizer is never assumed successful. This implementation does not
provide an OS service that survives loss of the whole host.

## Explicit Linux/Docker commands

Fast CI runs only trusted unit/contract models, including `test/g0.test.mjs`,
through its existing workshop-audit test wildcard. Workflow steps, budget and
Node 22/24 matrix are unchanged. The coverage inventory records new manual
entrypoints and the Windows POSIX skip. It does not claim Docker execution.

On a reviewed clean Linux/amd64 checkout, use a fresh owner-only directory
**outside the checkout**, then run the original public qualification:

```sh
mkdir -m 700 /private/g0-public-controls
pnpm --filter @metamorph/workshop-audit g0:synthetic /private/g0-public-controls
```

This performs at most twelve bounded candidate invocations plus one image build;
there are no models, paid calls, workflow dispatches or reference/PHP execution.
Allow a worst-case aggregate budget of 45 minutes for all sequential work,
teardown and capture. Failures stop qualification and retain partial packs; no
automatic retry or best-run selection exists. Independent Docker timeout,
cancellation and foreign-resource fault qualification remains required before
readiness; command-model tests do not replace those observations.

To recover a specific interrupted run, use a **new** evidence output directory:

```sh
pnpm --filter @metamorph/workshop-audit g0:finalize /private/run /private/recovery g0-EXACT-RUN-UUID
```

The run ID must match the private ledger. It rechecks IDs and owner labels. A
recovery receipt records any emergency removal and cannot certify normal PASS.

## Owner-local authentic-candidate bridge

This procedure is for an authorized human on an approved private-controlled host.
The agent has not decrypted, downloaded or inspected the genuine candidate.
Do not give a model age keys, ciphertext, restored TS, private logs or raw packs.

1. Independently restore/admit the previously retained source through the already
   approved private owner process. Use a fresh owner-controlled directory with
   only complete `src/**/*.ts`, private directory/file permissions, no links and
   no concurrently writable source. The trusted admission must reproduce exactly
   `4207053ada23f8e94ecf6301452ee4ea8228a3717c0a478d3e550443cec130e6`.
   A mismatch stops; do not repair/rename another target to inherit that receipt.
2. Pin a reviewed clean evaluator commit. Run
   `node packages/workshop-audit/src/g0/cli.mjs prepare /private/g0-setup` to build
   the unchanged recipe and obtain exact image/recipe/evaluator pins. Keep setup
   evidence private. No private source is an image build input.
3. The trusted owner supplies a private declaration with exactly the fields in
   `registerScope`: actual authenticated source/manifest hashes, benchmark and
   version, original candidate-producing provenance commit (`candidateGitSha`),
   candidate SHA above, measured image/recipe/evaluator pins, `workshop-v1`, every
   admitted file in the migration-unit map, all five route IDs, corresponding
   `route-*` test IDs, all `CONTROLS`, and explicit unsupported IDs. Derive source,
   license and provenance from approved records; do not invent registration or
   use the synthetic helper to label the genuine candidate. This declaration is
   local G0 scope only and does not preempt #56's registration interface.
4. Execute (owner only):

   ```sh
   node packages/workshop-audit/src/g0/cli.mjs run /private/scope.json /private/restored-source /private/g0-run
   ```

   The CLI rejects Windows, dirty/mismatched evaluator, scope/SHA drift and unsafe
   staging. It first executes the full independent public suite, then admits the
   exact private source to the isolated build/runtime. It checks evaluator HEAD
   and clean status again before returning a safe result. Preserve every attempt.
5. An independent authorized human reviews private setup/control/run/finalizer
   catalogs, scope, authentic source binding, commands, bounds, observed denials
   and zero normal cleanup. Publish only a safe authenticated attestation naming
   evaluator/candidate/scope/image/recipe/run identities, mandatory IDs, outcome,
   cleanup counts and opaque evidence references. Public stdout is allowlisted;
   never upload the adjacent private trace directories.

Until that owner operation and safe independent attestation exist,
**G0_REAL_CANDIDATE=NOT_RUN**. Passing synthetic controls alone cannot change it.
This module has no authenticated owner-attestation input: `realCandidate` remains
`NOT_RUN`, including after a scoped PASS and exact known bundle SHA match.
`candidateProvenance: EXACT_PUBLIC_SHA_MATCHED_ATTESTATION_PENDING` records only
that exact byte identity; other bundles report `OWNER_ATTESTATION_PENDING`.
An owner attestation remains a separate independently reviewed record.

## G0 → #57 boundary and residual attacks

`runG0` returns a frozen versioned outer receipt, separate from GateResult.
`consumePass(receipt, expectedIdentity)` checks a live issued receipt, exact
run/scope/candidate/source/manifest/evaluator/image/recipe identities, completed
same-runtime qualification and single consumption. JSON, copies, wrong-run or
historical receipts have no in-process authority. Persisted receipts need an
independent authenticated owner attestation; matching hashes alone authenticate
neither the operator nor custody. #57 must retain mandatory G1–G4 and owner
admission separately. No serializer/importer makes an arbitrary JSON PASS trusted.

Remaining risks: actual adapter/CLI behavior is not Docker-qualified here; finite
challenges cannot exclude all generalized hardcoding, selective behavior or
covert timing channels; declared unit coverage is not branch coverage. Node's
permission model supplements container isolation, not a mathematical security
boundary. Kernel/runtime escape, malicious privileged host/daemon, dependency
compromise, interrupted creation with missing inventory, power loss and lost
evidence remain in the trust/failure model. No encrypted physical custody,
independent human custody or formal G4 is established by this slice.

Provenance: new host adapter/control/challenge code is original work for #183.
The items fixture is original upstream Metamorph synthetic code. The unchanged
workshop fixture is the repository's existing adapted MIT car-workshop target;
its complete source/license notice in `schema.ts` is retained and admitted with
the TS bundle. No benchmark/private corpus or new OSS dependency is imported.

Completed engineering tasks: isolated branch/reconnaissance; versioned trusted
scope; same-recipe sandbox; actual-inspection/probe path; bounded challenges and
fixed mutants; fail-closed receipt qualification; independent exact-owner cleanup;
unit/adversarial tests and existing coverage inventory. Remaining acceptance:
real Linux Docker qualification, independent code/security review, authentic
owner run/attestation and later separately authorized #57 composition.
