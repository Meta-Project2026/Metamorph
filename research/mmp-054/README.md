# MMP-054 — explicit offline public execution

Refs [#54](https://github.com/Meta-Project2026/Metamorph/issues/54).
Base: `bcf8275cb2673abbda7a340e25f8c8d5b01198bb` (fetched main on 2026-10-28;
issuance baseline was `1aa36b8f4ab7a6f1d8f291d8751856ed51274685`).
Only `research/mmp-054/` changes. No shared API or protected implementation changes.

**Current delivery: implementation + host unit/receipt validation only.**
`OFFLINE_PROOF_NOT_RUN`, `OFFLINE_NETWORK_ISOLATION_NOT_PROVEN` for the observed
Windows/Docker Desktop environment. Linux amd64 preparation, real disconnected
execution, network controls and resource accounting below are **NOT_RUN** in this
delivery. The attached task requires the real Docker experiment as a **separate
manually authorized milestone**. No runtime receipt or offline PASS is supplied.
See [validation.md](validation.md) for actual checks and limitations.

## Scope and design

The manual CLI composes the **unchanged** MMP-049 operator probe, 3 MANIFEST,
14 MMP-044 and 25 MMP-049 cases, original real positive/negative controls, and
deterministic FAIL → repair Agent replay. HTTP and initial/post-step typed SQLite
comparison stays in the original Oracle. PHP 7.4 and candidate TypeScript execute
only in disposable Docker workers, including candidate typecheck/build.

Preparation is online and produces a local toolchain/image/source bundle.
Execution uses the already prepared toolchain images; it does **not** rebuild
their apt/npm layers offline. Every candidate build remains a real isolated
build through `TargetWorker.provision()`. This distinction is part of the claim.
The wrapper has two narrow, opt-in provisioning adapters:

| Existing online path | Explicit offline replacement |
| --- | --- |
| Pinned GitHub source `fetch` | Exact URL → locally hashed original OSS archive; any other fetch throws before network |
| `docker pull` | Only the two known pinned base images → inspect prepared config ID |
| Two exact toolchain `docker build` recipes | Prepared PHP iidfile or prepared TS image tag; unknown arguments/context reject |
| Application/inspector `docker run` | Known image IDs, `--pull=never`, `none` network or inspector sharing a verified `none` parent |

`offline-preload.mjs` is loaded explicitly into each MMP-049 stage.
`docker-gateway.mjs` is on PATH only in that invocation. No package patch,
comparator replacement, mocked observation, altered request schedule or remote
provider adapter is installed. Archived base-image references are mapped to the
exact prepared IDs because `docker save/load` need not retain RepoDigests.
The online preparation record binds digest → ID; it is a trusted operator record,
not independent cryptographic image attestation.

The frozen workshop baseline and separate `workshop-compat-v1` bundle retain their
different SHA-256 identities. The baseline is admitted for identity and its
original operators are measured; the full parity/repair schedule targets only
the compatibility bundle. Historical NBSP/exponent divergences, original Docker
classifications and private audit receipts are untouched.

## Operating envelope and network boundary

Required target: **Linux amd64**, native rootful Docker Engine, one dedicated
daemon/containerd, local Unix socket `/var/run/docker.sock`, real Node 22.13+
(22 LTS) or 24 LTS and **installed pnpm 11.25.0**, Git, tar, `which`, procps,
iproute2 and util-linux. Do not use a Corepack bootstrap shim. Keep the same
checkout, tool installation and absolute paths between prepare and run; transfer
of the cache directory alone is insufficient. Preserve the installed workspace,
all dependency notices and the complete pnpm store. No local model is required.

The host execution context includes **both the orchestrator and its Docker
daemon/containerd**. Either use a disposable VM with its external NIC detached,
or a fresh Linux network/mount/PID namespace containing a **new native daemon**.
The CLI checks native processes, matching network namespace identities, no
default route, and only actual virtual loopback/bridge interfaces. Physical,
peer/veth and unknown interfaces reject, even if administratively down. A
namespace containing just the client with an online daemon outside rejects.
Docker Desktop integration or a forwarded Docker socket rejects.

Before useful work: real host IPv4/IPv6 TCP, explicit external DNS, npm registry
and GitHub request denial; direct native-daemon registry denial; unknown image
and remote-provider fallback rejection. Separate predeclared PHP/Node probes
attempt IPv4/IPv6/DNS in each of eight worker/build/inspector/provenance roles.
Every actual worker uses the same unchanged sandbox policy, with gateway checks
on each launch and shared inspector network. Host topology and host probes are
checked again after finalization. No billable API endpoint is contacted.

This assumes a clean dedicated context and a trusted local operator. A malicious
root administrator, a hostile kernel, host Unix proxies or another process
reattaching networking are outside this public infrastructure claim. Snapshot
receipts alone do not prove the absence of privileged tampering or formal G4
independence. Admit no other workloads and keep the boundary unchanged until
`offline.json` is terminal. A hardware/OS shutdown or SIGKILL cannot promise
normal cleanup; missing receipts or any emergency removal preclude PASS.

## Prepare (online, NOT offline evidence)

The commands below are a documented, **unexecuted** Linux recipe. Use a dedicated
Linux VM/context with filesystem-backed workspace paths, not Windows-mounted
source. Obtain Node/pnpm/Docker and distro tools through your normal verified
installation process before disconnecting. Preserve release signatures/notices.

```sh
cd /srv/metamorph
git fetch origin feat/mmp-054-offline-local-proof
git switch --detach origin/feat/mmp-054-offline-local-proof
CODE_SHA=$(git rev-parse HEAD)
node --version
pnpm --version
docker version
node research/mmp-054/prepare.mjs /srv/mmp054-prepared "$CODE_SHA"
sha256sum /srv/mmp054-prepared/prepared.json
du -sh /srv/mmp054-prepared /srv/metamorph/node_modules
```

Preparation refuses dirty/wrong SHA checkouts and existing output bundles. It
performs frozen install into a **dedicated** store, an explicit offline install
against that prepared workspace, workspace build, pinned amd64 base pulls and the two existing
toolchain recipes. It downloads only the pinned public source, checks its archive
and exact license SHA, saves all four image IDs, and records image architectures,
registry digests, sizes, tool versions/binary hashes, lockfile, compiled output,
workspace dependencies/link targets and package-store contents. `images.tar` is
hashed with bounded-memory streaming. Keep the whole prepared environment or
snapshot it; never silently reprepare during execution.

`prepared.json` is an integrity index, not a signature. Verify its hash against the
online preparation record before restoring. For an already disconnected VM with
images present, no import is needed. For a **new offline dedicated daemon**, load
the verified archive before invoking the runner:

```sh
sha256sum /srv/mmp054-prepared/images.tar /srv/mmp054-prepared/source.tgz
# Compare with artifacts in the already verified prepared.json.
docker load --input /srv/mmp054-prepared/images.tar
```

The CLI never loads or pulls missing images. It inspects IDs before useful work.
Any missing byte, toolchain drift, unexpected image ID, dependency/store drift or
unavailable offline installation stops the attempt. Packages required on a new
architecture must be prepared on that architecture; this v1 admits amd64 only.

Licenses/notices: original workshop MIT license is retained as `SOURCE-LICENSE`
and verified again in the existing PHP sandbox. Keep npm dependency LICENSE/
NOTICE files, Node/Docker distribution notices and the image filesystem notices
(including PHP and libfaketime). No model weights are downloaded or licensed by
this task. Image bytes and store footprint are measured per preparation; no
successful preparation size has been observed here. Do not publish an installed
home directory, Docker credentials, `.env`, package-manager auth configuration
or a private corpus with a cache bundle.

## Execute and audit (separately authorized, strictly offline)

On a disconnected native Linux VM with no external interface, run the final two
commands below directly. An alternative that isolates **all** Docker execution,
including daemon registry access, is this root-only disposable namespace recipe.
Install/preload prerequisites online first. These commands are **documented only**:

```sh
sudo unshare --mount --net --pid --fork --mount-proc /bin/bash
# In this new namespace shell (never on a shared production daemon):
mount --make-rprivate /
mount -t tmpfs -o size=64m,mode=0755 tmpfs /run
ip link set lo up
mkdir -p /srv/mmp054-daemon
dockerd --host unix:///var/run/docker.sock --pidfile /run/docker.pid \
  --data-root /srv/mmp054-daemon/data --exec-root /run/mmp054-docker \
  --bridge=none --iptables=false --ip6tables=false \
  > /srv/mmp054-daemon/daemon.log 2>&1 &
DAEMON_PID=$!
for ATTEMPT in $(seq 1 60); do
  docker --host unix:///var/run/docker.sock info >/dev/null 2>&1 && break
  sleep 1
done
docker --host unix:///var/run/docker.sock info >/dev/null
docker --host unix:///var/run/docker.sock load --input /srv/mmp054-prepared/images.tar
cd /srv/metamorph
CODE_SHA=$(git rev-parse HEAD)
node research/mmp-054/run-offline.mjs --run /srv/mmp054-prepared /srv/mmp054-run-1 "$CODE_SHA"
node research/mmp-054/verify.mjs /srv/mmp054-run-1 "$CODE_SHA"
# Preserve failed/partial output too. Shut down the disposable daemon normally:
kill -TERM "$DAEMON_PID"
wait "$DAEMON_PID"
exit
```

Use an unused dedicated data-root, an externally enforced disk quota/virtual disk,
and no other workloads. Recommended preparation envelope: 2 vCPU, 4 GiB RAM,
8 GiB disposable storage, increasing storage **before admission** if the measured
images/store plus raw receipts do not fit. Disk quota is an operator prerequisite;
the CLI does not configure it or claim to have tested it. Keep at least the
measured archive + image sizes + package store + 2 GiB for evidence/build overhead.
There are no published ports: PHP `127.0.0.1:8080` and TS `127.0.0.1:3000` are
within their isolated workers. Each worker retains 1 CPU / 256 MiB / 64 PIDs;
reference state 8 MiB, compatibility state 16 MiB, target work 64 MiB, tmp
8/16 MiB. Original target useful lifetime stays 180000 ms, original PHP watchdog
600 s; no cleanup grace extends useful work. Stage deadlines: probe 3 min,
proof 28 min, Agent 13 min; outer cancellation at 58 min, joined child grace 20 s
and independent finalizer 120 s. The terminal receipt rejects elapsed >60 min.

The runtime does frozen `pnpm install --offline` from the prepared store, then
executes the existing probe/proof/Agent in sequence, joining cancellation before
running the unchanged independent finalizer in a fresh process. Initial and
post-step SQLite coverage, original mutations, repaired source identity, all
fresh pairs, cleanup history and exact output digests are validated. Normal
cleanup failures stay ERROR even if the final inventory becomes empty.

Expected full schedule **only if actually completed**: main 42 pairs / 110 HTTP /
152 SQLite, plus Agent 6 fresh pairs / 34 HTTP / 40 SQLite. The wrapper derives
counts from actual receipts and rejects missing coverage; it never substitutes
target counts for observations. In this delivery those counts are **NOT_RUN**.

The public checker calls unchanged `mmp-049/verifyPublic`, validates the new
versioned envelope, network controls, cleanup, exact image binding and receipt
byte hashes. It verifies recorded evidence, not an independent physical witness.
Retain `raw-local-only/` locally for review; it is not an allowlisted publication
artifact. After terminal audit, reconnect only the ordinary development context,
then copy/push **only** these public receipts and a hash index:

```sh
mkdir /srv/mmp054-public
for FILE in offline.json summary.json semantics.json agent.json finalizer.json; do
  cp "/srv/mmp054-run-1/$FILE" /srv/mmp054-public/
done
cd /srv/mmp054-public
sha256sum offline.json summary.json semantics.json agent.json finalizer.json
```

Never upload the whole run directory. Publication after the run is a separate
online phase. Keep failed receipts; neither a retry nor later push rewrites them.

## Windows + WSL2 (documented only)

Current host observation: Windows, Node 22.23.1/pnpm 11.25.0, Docker Desktop
29.9.2 with Linux amd64 daemon, only `docker-desktop` WSL distribution. Host
tests below ran here. No disconnected Linux execution was performed.

For the documented Windows route, prerequisites are WSL2 enabled, a separate
Ubuntu 24.04 amd64 distribution, native Docker Engine + containerd **inside that
distribution**, working privileged Linux namespaces, and all tools listed above.
An administrator may install the distro online with
`wsl --install -d Ubuntu-24.04`, then use `wsl -d Ubuntu-24.04`. Keep the repository
and prepared bundle on its Linux filesystem, use its native Docker daemon during
prepare, then the whole-daemon namespace recipe above. Docker Desktop integration
is insufficient and must not be the daemon used by that recipe. No Windows
firewall rule, host networking or existing Desktop installation is changed by
the CLI. A disconnected Hyper-V Linux VM with local Engine is another documented
option. WSL2, Linux Engine, VM and namespace recipes all remain **NOT_RUN** here;
documentation does not establish cross-platform operation.

## Focused checks and completion boundary

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
node --test research/mmp-049/driver.test.mjs
node research/mmp-054/check.mjs
node --test research/mmp-054/driver.test.mjs
```

Research checks are explicit because root Biome intentionally excludes research;
there is no expensive workflow or Fast CI expansion. Tests exercise missing
prefetch, wrong SHA/digest, network topology and fallback rejection, incomplete/
corrupt receipts, missing/wrong negative controls, counts, emergency cleanup and
false local-LLM claims. Historical public MMP-049 receipts are **read-only unit
fixtures** for validator tests. Synthetic envelopes in those tests are never
saved as runtime proof or reclassified historical execution.

Implementation tasks completed: preparation/index, closed provisioning adapters,
whole-context network admission/controls, existing-driver composition, strict
receipt verification, host rejection tests and documented recipes. Real offline
preparation/execution, interruption/recovery on real Docker, Linux/WSL2 operating
envelope and independent ChatGPT review remain pending separate validation.
G0/formal private G4 stay INCONCLUSIVE; product NOT_ESTABLISHED;
LOCAL_LLM_GENERATION_NOT_RUN; remote AI NOT_RUN; paid calls 0. This task adds no
hidden registry, encrypted evidence retention, day-90 restore or formal G4 run.
