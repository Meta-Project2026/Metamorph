# MMP-176 — owner-only G1 replay

Refs #176, #167; subsequent functional parity #161. Base:
`6c5a5337e7b4841a11805f99fe84ee398230b555`. Implementation is for independent
review, not merge approval. Real candidate G1 subtype **UNKNOWN**;
owner ciphertext retention **OWNER_ACTION_REQUIRED**; product **NOT_ESTABLISHED**.

This helper reuses `verifyAgeRestore` → `parseCapsule`/`validateCapsule` →
`validateBundle` → the existing `TargetWorker` → trusted `observeBuild` receipts.
Production custody, runtime broker, recipe, budgets, Oracle and CI are unchanged.
Plan: authenticate public custody binding; qualify the nonsecret toolchain;
disconnect before key access; restore only in owner memory; sandbox G1; clean up;
publish only fixed enums and public identities. Tests use generated TEST keys and
original public fixtures. No real owner key or candidate is accepted in an agent
environment. See [operator runbook](OWNER-RUNBOOK.md) and [validation](VALIDATION.md).

The implementation deliberately retains the **same in-process broker-issued
runtime** across an interactive disconnection barrier. It never serializes or
forges a runtime token, uses `trustedTest` for real work, or admits a cached image
from a user-supplied JSON receipt. `buildTrustedRuntime()` still runs
`docker build --pull` during nonsecret preparation. After the barrier, only local
image inspection and unchanged network-none worker operations occur. A restarted
process must repeat nonsecret preparation with the private storage detached.

The owner must provide a dedicated externally disconnected Linux VM/native Docker
daemon. The guard additionally checks root-owned local Docker socket/PID, daemon
name, identical host/init/daemon network namespaces and no UP non-loopback
interface. Docker Desktop, remote daemon, network namespace-only isolation, active
bridge/tunnel or unreadable evidence means **NO_GO / NETWORK_NOT_BLOCKED** before
any private read. Do not disable the guard. Physical/virtual NIC disconnection
must persist throughout the private phase; these checks cannot defend against
root/same-UID code, an agent already in the VM, or the owner reconnecting it.

`TargetWorker.provision()` includes compile plus target startup/readiness in its
disposable sandbox. This is not a compile-only invocation: no PHP, Oracle corpus,
HTTP parity or SQLite comparisons run. A compile PASS with failed startup remains
`REPLAY_ERROR`, with the actual compile verdict reported separately. On every
constructed-worker path `close()` and a further exact-owner inventory run.
Cleanup failure takes precedence over successful G1. SIGINT/SIGTERM cancel/join
the worker; SIGKILL/power loss require owner inspection and cannot prove cleanup.
The nonsecret prepared image is retained; zero-resource claims cover owned
workload/provenance **containers and volumes**, not toolchain images.

CLI stdout contains JSON records with exactly `{status, runId, headSha,
candidateSha, recipeSha, g1Verdict, executedTestIds, phase, phaseCode, cleanup,
zeroOwnedResources, provisionElapsedMs?}`. Strings use fixed enums or explicit
hash/ID regexes. `provisionElapsedMs` is the **whole Docker build command elapsed
time**, not a compiler-phase measurement. Outer Docker failure has phase `NONE`
and `BUILD_PHASE_UNKNOWN`; it is never misattributed to a compiler timeout.
Compiler nonzero normal exit remains G1 FAIL. Raw errors, stdout/stderr, source,
paths and observations are never projected. Node runtime warnings are suppressed
by the CLI to keep its JSON-only output. No new private logs/plaintext files are
written. Source strings/GC copies cannot be promised securely erased; destroy
the private VM according to owner policy.
`headSha` identifies the original paid run; the helper's reviewed commit is
separate provenance in its PR. `zeroOwnedResources=false` means cleanup is not
established, including when an inventory command failed; it is not a resource count.

Synthetic acceptance (manual, Linux, qualified TEST tools only):

```sh
pnpm install --frozen-lockfile
pnpm build
node --test packages/agent-real/test/owner-local-g1.test.mjs
MMP176_TEST_TOOLS=/absolute/test-tools node --test research/mmp-176/synthetic-acceptance.mjs
```

The real-age/Docker acceptance script has a module-only synthetic network-guard
override: its machine stays connected and it never accepts owner paths/keys.
The real CLI has no recipient, identity, receipt, runtime, network or test override.
The connected test explicitly requires the real owner guard to refuse execution.
This is **not** an executed owner-private offline replay.
