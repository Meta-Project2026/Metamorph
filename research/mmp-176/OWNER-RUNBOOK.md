# Operator-only retention and G1 replay

Only the owner performs these steps on independently controlled storage/machine.
Never send keys, candidate bytes, decrypted JSON, compiler messages, private paths
or raw logs to an agent/chat/Issue/PR. Do not run the private phase in this agent
checkout, CI, shared runner or a VM connected to an AI agent. These instructions
authorize no provider request, workflow dispatch, rerun or production policy change.

## 1. Retain ciphertext before expiration — no key required

Metadata rechecked through authenticated GitHub API on 2026-11-04:

| Binding                     | Exact value                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| Repository/run/attempt      | `Meta-Project2026/Metamorph` / `41749479450` / `1`                                       |
| Run head                    | `32d173fc0ddb6cfe8d0addd3061fe5493f6e48f6`                                               |
| Source                      | `d272170d0aecbd28eb5b13e272d9dd11d545b66c`                                               |
| Candidate                   | `4e863cb94b444970e237e7cb8eb028ec99f5d960b200b5d1e714c91ee785f448`                       |
| Custody attempt             | `d708096a-f524-4ee2-acb3-1ad5cfbcc30d`                                                   |
| Ciphertext artifact         | `mmp107-candidate-41749479450-1`, ID `13284218898`                                       |
| Original ZIP SHA-256        | `d65a81d79dc2525014bdc3aaac9dfab2593a2de6c13fbd8e8a8cb3eb125dfd88`                       |
| Extracted `candidate.age`   | 27,960 bytes; SHA-256 `2c28f738b93669c9aee6ad771eb4bb3b31734128ad18bb03b1614510667e74b1` |
| Ciphertext expiry           | **2026-11-11 00:49:25 UTC / 02:49:25 Chisinau**                                          |
| Public artifact             | `meta-paid-public-41749479450`, ID `13285336430`                                         |
| Public original ZIP SHA-256 | `44e8acda1b0c543087b7615ab18a81a900cded514f8b62ab487d7f44e2dfce71`                       |
| Public expiry               | `2026-11-11T00:49:54Z`                                                                   |

Select two new absolute owner-private directories outside all checkouts/shared
folders. Replace the placeholders yourself; do not report their paths to an agent.

```powershell
$cipherDir = '<OWNER_PRIVATE_CIPHERTEXT_DIRECTORY>'
$publicDir = '<OWNER_PRIVATE_PUBLIC_RECEIPTS_DIRECTORY>'
gh api repos/Meta-Project2026/Metamorph/actions/artifacts/13284218898
gh api repos/Meta-Project2026/Metamorph/actions/artifacts/13285336430
gh api repos/Meta-Project2026/Metamorph/actions/runs/41749479450
gh run download 41749479450 -R Meta-Project2026/Metamorph -n mmp107-candidate-41749479450-1 -D $cipherDir
if ($LASTEXITCODE -ne 0) { throw 'DOWNLOAD_FAILED' }
$cipher = Join-Path $cipherDir 'candidate.age'
if ((Get-Item -LiteralPath $cipher).Length -ne 27960 -or (Get-FileHash -LiteralPath $cipher -Algorithm SHA256).Hash.ToLowerInvariant() -ne '2c28f738b93669c9aee6ad771eb4bb3b31734128ad18bb03b1614510667e74b1') { throw 'HASH_MISMATCH' }
gh run download 41749479450 -R Meta-Project2026/Metamorph -n meta-paid-public-41749479450 -D $publicDir
if ($LASTEXITCODE -ne 0) { throw 'DOWNLOAD_FAILED' }
$receipt = Join-Path $publicDir 'meta-paid-public/custody-stored.json'
if ((Get-FileHash -LiteralPath $receipt -Algorithm SHA256).Hash.ToLowerInvariant() -ne '559d55af0f197e0ee07479009eaa8e56085342091be2ee93e6a2e3b0273d694e') { throw 'PUBLIC_RECEIPT_UNAVAILABLE' }
```

Check metadata matches the exact name/ID/run/head/digest above and `expired=false`.
Stop on absence or disagreement. `gh run download` **extracts** the archive:
compare its extracted file to the ciphertext hash, never to ZIP SHA. To retain
original ZIP bytes instead, an owner may use the authenticated artifact-ID `/zip`
REST endpoint with a binary-safe downloader and compare those exact bytes to the
ZIP hash. Do not synthesize a ZIP and compare its digest.

The public ZIP was actually inspected and hash-verified during implementation.
Its receipt is **`meta-paid-public/custody-stored.json`**, 660 bytes including LF,
SHA above. There is **no assumed `record.json`**. `custody-capture.json` and
`custody-checkpoint.json` are earlier states, not substitutes. The stored receipt
must have `mmp115-custody-v1`, `STORED_UNVERIFIED`, `ACKNOWLEDGED_RETRIEVED`,
`VERIFIED_ZERO_RESOURCES`, the exact six-field identity, fixed recipient fingerprint
`48218aef33dd17354761805a678f95481ad21131336cc348c23cefe99f714600` and exact ciphertext
hash/length. The helper pins the receipt's exact raw bytes in addition to validating
that schema and bindings. Keep its LF unchanged. Authenticated retrieval + exact
archive/receipt hashes establish provenance; age encryption alone does not.
No receipt means **NO_GO**. None of this means G1 or product VERIFIED.

## 2. Prepare a separate owner machine — private storage detached

Use an independently reviewed exact helper commit, supported Node 22/24, frozen
dependencies already installed/built and qualified trusted Docker/age tools.
Use Linux filesystem storage, not `/mnt/c`, network shares or shared VM mounts.
No Codex/Antigravity/model process in this machine. Remove provider/GitHub
credentials from its environment. All helpers/dependencies must be trusted before
attaching private storage; never install a candidate package or candidate command.

The local native root-owned dockerd must use `/var/run/docker.sock`, have its
root-owned PID at `/run/docker.pid` and share the host network namespace. Configure
the **dedicated** daemon without network bridges (for example its existing owner
configuration can use `"bridge":"none"`). Do not change an unrelated/shared daemon.
Active Docker bridges or any tunnel cause refusal. Docker Desktop/remote daemon
cannot satisfy this helper: use a separate Linux VM/native daemon, or **NO_GO**.

Qualify `age` and `age-keygen` v1.3.2 Linux amd64 from the upstream release in the
nonsecret phase. Retain upstream license/notice. Release archive SHA-256:
`cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10`.
Binary SHA-256 pins are respectively
`eb7dd1b518f0a307c99cd97782623c5321da049154b04acd2d98d21aa7bc9b2c` and
`0a0009db842259d6717f7eeb30acb6b90d2a2eb924c6acd0a0db0ca1f1537899`.
The fixed production age recipient is
`age1yvf40njrznnr7emg5j76azu62579z38gzh2jqss72l2u9308n5essrvy6f`.
The CLI checks binary bytes/ownership, derives the recipient from the identity and
requires that exact value. It has no test-recipient override.

Start from a **human terminal** with the future private mount still detached:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=/nonexistent TZ=UTC \
  node research/mmp-176/replay.mjs --owner-only /absolute/future-private-mount/replay
```

The process prepares the trusted image via existing `docker build --pull`, inspects
toolchain/recipe provenance, cleans the provenance container and prints
`PREPARED_AWAITING_OFFLINE`. This phase is **connected and nonsecret**, not offline.
The in-memory runtime is branded by the unchanged production broker. If it fails,
do not attach private storage. Image/recipe must match
`f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3`.

## 3. Disconnect, attach private inputs, confirm

Within the five-minute barrier: disconnect the VM's adapter **externally** from
the hypervisor/owner host and keep it disconnected. In a separate human terminal,
set every non-loopback interface down (including bridges/tunnels); the helper
requires them down, not merely without an IP. Verify the daemon remains local.
Only then attach the owner-private storage, without guest/agent sharing.

Create the named `replay` directory with mode **0700**, owned by the executing
owner. Place regular single-link, owner-owned copies named exactly `identity`,
`candidate.age`, `custody-stored.json` with mode **0600** and pinned `age`,
`age-keygen` with mode **0700**. No symlinks in directory ancestry or files, no
hardlinked inputs. The helper accepts no archive extraction, path override or
environment-based identity. It bounds key 4 KiB, receipt 16 KiB, ciphertext 3 MiB,
plaintext 2 MiB, age decrypt 30s. Plaintext stays in process memory; candidate
TypeScript is compiled/started only in disposable Docker with network none,
read-only root, no privileges, 1 CPU, 256 MiB, 64 PIDs and bounded tmpfs.
Compiler 12s/phase, outer build 35s, worker lifetime 180s remain unchanged.

In the original waiting terminal type this exact line and Enter:

```text
OWNER_OFFLINE_READY
```

The guard checks the host/daemon before any private read and again before/after
worker execution. Failure returns a fixed safe status; never bypass a guard or
substitute a test hook. During the private phase do not reconnect networking or
attach an AI agent. Only the final JSON enum receipt may leave that machine.
Exit 0 requires successful startup/G1 and verified cleanup; a compiler FAIL or
any missing evidence/failure exits nonzero. An abnormal compiler phase is reported
as `REPLAY_ERROR` plus its fixed `phaseCode`. Outer failures remain UNKNOWN-phase.
Do not upload raw console captures or memory/core dumps. Disable swap/core dumps
under owner VM policy; after execution destroy/retain the VM and private storage
under owner policy. No secure-erasure claim is made for JS strings/OS copies.

## Owner state and next decision

| State                          | Evidence / next action                                                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `CIPHERTEXT_AVAILABLE`         | Owner confirms retained exact ciphertext hash/length; not a restore or VERIFIED claim.                                                  |
| `HASH_MISMATCH`                | Stop; obtain authentic bytes, never change the expected hash.                                                                           |
| `OWNER_IDENTITY_UNAVAILABLE`   | Stop; only the owner can supply the matching private identity outside agent access.                                                     |
| `PUBLIC_RECEIPT_UNAVAILABLE`   | Stop; retain authenticated exact public artifact/receipt. No reconstruction from guesses.                                               |
| `READY_FOR_OWNER_LOCAL_REPLAY` | Human has reviewed helper, retained exact inputs, matching key/tools and externally disconnected dedicated VM. Not an executed verdict. |

A new replay result describes that owner execution, **not proof of the historical
incident's identical root cause**. `BUILD_PHASE_TIMEOUT` → coordinate 12/35/180s
policy and recipe/diagnostic pins for separate review; signal/spawn → reproduce
that concrete failure; overflow → review bounded diagnostics; G1 FAIL → normal
compiler failure, no guessed source correction. No receipt → `UNKNOWN` and
`OWNER_ACTION_REQUIRED`. Do not change production automatically.

The shortest subsequent demo is an authorized real model generation → pinned
original PHP → retained candidate → G1 → G2 17 HTTP → G3 20 SQLite → public verdict.
After G1, #161's `HTTP_JSON_TYPE` remains the known functional blocker. G0/G4 may
remain INCONCLUSIVE and product NOT_ESTABLISHED even with public G1–G3 PASS.
Any new paid trial needs a separate explicit owner decision on reviewed protected
main, current `research/mmp-154/preflight.mjs`, current pricing/tariff (previous
expiry `2026-11-05T00:00:00Z`), exact SHA, maximum POSTs and cost **estimate** with
`NO_PROVIDER_HARD_CAP`. This task provides none of that authorization.
