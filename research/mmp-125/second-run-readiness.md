# MMP-125 — second-run readiness / authorization package

**STATUS: `BLOCKED`** — not `READY_FOR_INDEPENDENT_REVIEW` until the P0 finalizer
decision gate and the outer-harness image identity are resolved. Docker diagnostic
is **NOT_RUN** in this task. No Docker invocation, model request, repair, paid
dispatch, artifact upload or owner-key use occurred.

Refs #125 #116 #61. Base (historical pin): `074af751e9012abad1be2749c360c5d8b86218e0`.
Reviewed head for this package: `bb8f548bae35f9add0402c855da0cd247a124cf6`
(post-merge PR #131). Candidate under test is unchanged:
`0cf5ba0bb22fd1d335b3d061b0a9b258d7ac660f3038e1e651ddaad1262d03c1`.

## 1. Scope and no-side-effect statement

- Work performed only under `research/mmp-125/**` plus the documented read-only
  rehydration of four tracked text files from exact Git blobs (no content change,
  not committed).
- No edits to #115 custody files, `packages/agent-real/src/custody-*`,
  `.github/workflows/meta-paid-migration.yml`, keys, production verifier/source/
  comparator/scoring, or historical receipts.
- Verified: `newDockerInvocations=0`, `modelRequests=0`, `paidDispatches=0`,
  `newArtifactUploads=0`, `repairs=0`, `ownerPrivateKeysUsed=0`. Historical
  receipts and G0–G4 meaning preserved.

## 2. Evidence ledger

| Item                             | Value                                                                                                                     | Source                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Historical base                  | `074af751e9012abad1be2749c360c5d8b86218e0`                                                                                | `pins.json` `baseSha`                       |
| Reviewed head                    | `bb8f548bae35f9add0402c855da0cd247a124cf6`                                                                                | `origin/main`                               |
| Frozen GLM draft                 | `4ff450d2ec5fdcdfd855b7a3ed02b9f369488cf55f354372e4dc11dfb9511e72`                                                        | audit `EXPECTED.draft`                      |
| Frozen GLM repair                | `0cf5ba0bb22fd1d335b3d061b0a9b258d7ac660f3038e1e651ddaad1262d03c1`                                                        | audit `EXPECTED.repair`                     |
| Source commit                    | `d272170d0aecbd28eb5b13e272d9dd11d545b66c`                                                                                | `public-source.json`                        |
| Source archive SHA-256           | `32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4`                                                        | `public-source.json`                        |
| Manifest pin                     | `d800a9a5e874545040438d4dce822da6e0d6b71fb094bcac7f06a6ad05610fd4`                                                        | receipts                                    |
| Target runtime recipe            | `f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3`                                                        | audit                                       |
| Outer harness image (hard-coded) | `sha256:45e21e7c564b016c68662f87e558840fb86844e9221f6ed1b1c4c298f0bd1a6f`                                                 | `launcher-core.psm1:212`                    |
| Post-base delta                  | `packages/agent-real/src/migration-context.mjs` only (PR #131, +2 lines, prompt-only)                                     | `pins.json` v2 `deltas`                     |
| Historical attempt (consumed)    | driver `1c3581acadbc14382b4a9007d4701904639480de`, diagnostic `a173d103-3da4-4697-9baa-87e612625e28`, `ERROR_ENVIRONMENT` | `evidence/diagnostic-outcome-a173d103.json` |
| Formal G4                        | `NOT_RUN`                                                                                                                 | receipts                                    |
| #61 product                      | `PRODUCT_NOT_ESTABLISHED`                                                                                                 | receipts                                    |
| #116                             | `HOLD`                                                                                                                    | receipts                                    |

Static, already-established facts (not re-proven here):

- Frozen GLM repair does **not** echo the incoming `x-request-id` on its HTTP
  responses. `packages/target-worker/runtime/inspect.mjs:60-90` sends
  `x-request-id: action.requestId` and requires
  `res.headers["x-request-id"] === action.requestId`; `packages/target-worker/src/controller.mjs:686-690`
  requires `capture.headers["x-request-id"] === requestId` else throws
  `OBSERVATION_ERROR`; `packages/differential/src/mapping.mjs:18-24` requires the
  same under code `HTTP_IDENTITY`.
- If reproduced, the trusted observer would record boundary
  `TARGET_WORKER_REQUEST` / side `TARGET` / class `UNKNOWN`. This is a **boundary**
  observation for GLM only, not an application root-cause proof and not evidence
  about Meta.
- PR #131's prompt disclosure is a **future-generator** mitigation. It does not
  change the frozen repair and does not retroactively explain the historical
  `VERIFIER_ERROR`.

## 3. Executable path (trusted chain)

`AuthorizedHead` acceptance → source/audit admission → atomic consumed guard →
Docker CLI resolution → Linux platform/image/inventory preflight → owned
volume/container preparation → original unchanged verifier CLI (`repair`) →
trusted observer → categorical receipt → bounded owned cleanup → independent
finalizer/inventory.

| Step                     | Location                                               | Invariants / notes                                                                                                      |
| ------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Source head + clean tree | `launcher-core.psm1:55-63` (`Assert-Source`)           | git HEAD == `AuthorizedHead`; `git status --porcelain` empty; `node research/mmp-125/audit.mjs` exit 0                  |
| Frozen audit             | `audit.mjs:171-357`                                    | 47 pinned inputs; no candidate execution                                                                                |
| Atomic no-retry marker   | `launcher-core.psm1:73-83` (`Consume-Consent`)         | `CreateNew` + `FileShare.None` + `Flush(true)` **before** any Docker resolution; existing/partial/failed marker refuses |
| Docker CLI resolution    | `launcher-core.psm1:21-25` (`Get-DockerInvocation`)    | application object only; no env substitution                                                                            |
| Linux platform           | `launcher-core.psm1:110-112`                           | `engine.Os === "linux"`, `Arch === "amd64"`                                                                             |
| Image identity           | `launcher-core.psm1:113-114`                           | exactly one image, `Id === Context.Image`, linux/amd64                                                                  |
| Foreign-worker refusal   | `launcher-core.psm1:115`                               | `(Get-Inventory).Workers.Count === 0`                                                                                   |
| Owned volume prep        | `launcher-core.psm1:116-125`                           | pre-existing same-named volume refuses; owner label checked                                                             |
| Verifier invocation      | `diagnostic.mjs:284-300`                               | one `node research/mmp-123/verifier-proof.mjs repair` child, 900s cap, SIGKILL                                          |
| Trusted observer         | `trace-hooks.mjs`, `observer.mjs`                      | wraps adapters/transport/checkpoints; returns original values; no raw payload                                           |
| Categorical receipt      | `diagnostic.mjs:115-233` (`projectDiagnostic`)         | safe fields only; incomplete → `UNKNOWN`/`INCONCLUSIVE`                                                                 |
| Cleanup budget           | `launcher-core.psm1:9-10,26-37`                        | 1200s overall; 60s cleanup; 15s/5s per call; 64KiB combined output; child-tree kill                                     |
| Independent finalizer    | `diagnostic.mjs:308-322` → `workshop-finalizer.mjs`    | 45s cap; writes `finalizer.json`                                                                                        |
| Final inventory          | `launcher-core.psm1:161-207` (`Remove-OwnedResources`) | owner labels + private ledger; null counts when unavailable                                                             |

Crash/timeout semantics: a timeout or crash still receives a fresh independent
finalizer; refusal on marker never calls Docker, including final inventory;
unavailable inventory leaves counts `null`, never verified zero.

## 4. Host environment (HOST_OBSERVED, no Docker invocation)

| Fact                 | Method                                                                                       | Result                                                               |
| -------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Node                 | `node --version`                                                                             | `v22.23.1` (task host)                                               |
| pnpm                 | `pnpm --version`                                                                             | `11.25.0`                                                            |
| PowerShell 7         | `Get-Command pwsh`                                                                           | **absent** (only Windows PowerShell 5.1)                             |
| Docker CLI           | `Get-Command docker`                                                                         | present at `C:\Program Files\Docker\Docker\resources\bin\docker.exe` |
| Docker named pipes   | `Test-Path \\.\pipe\docker_engine`, `dockerDesktopLinuxEngine`, `dockerDesktopWindowsEngine` | all present                                                          |
| Docker daemon health | **not probed** (prohibited)                                                                  | `UNKNOWN`                                                            |

CLI presence ≠ working Linux Engine. No `docker version/info/ps/build/run` was
executed.

## 5. Blockers (why STATUS is BLOCKED)

### B1 — P0: broad foreign-resource cleanup (decision gate)

`packages/differential/src/workshop-finalizer.mjs:9-12,25-29` removes **all**
resources matching `mmp007-*`, `mmp-reference-*`, `mmp-reference-state-*`,
`mmp-inspector-*`, `mmp008a-clock-*` based solely on a name regex, with **no
run-owner verification**. It is invoked by `research/mmp-125/diagnostic.mjs:308-321`
and `research/mmp-123/verifier-proof.mjs:196-227` against the host Docker socket.

Outer launcher cleanup (`launcher-core.psm1:161-207`) _does_ check owner labels
and the private ledger, but the **nested unchanged finalizer does not**. Any
matching foreign resource would be deleted. On a shared daemon a second run is
therefore **BLOCKED** until Vladimir + Ilia jointly approve either a separately
reviewed ownership-scoped finalizer remediation or verifiably exclusive
dedicated-daemon isolation for the entire run. This is a decision gate only; no
shared finalizer edit is made in this research-only PR. The compensating control
(dedicated empty daemon) is only as strong as the daemon exclusivity guarantee,
which is **not** established on this shared Docker Desktop host.

### B2 — outer harness image identity not reproducible

`launcher-core.psm1:212` pins
`sha256:45e21e7c564b016c68662f87e558840fb86844e9221f6ed1b1c4c298f0bd1a6f`
as the **derived** harness image. `research/mmp-123/harness/Dockerfile` builds a
new image _from_ `node:24-bookworm` and installs/copies scripts, so the derived
digest is expected to differ from the base manifest/config IDs; comparing them
does not prove an error. The legitimate unresolved gate is **independent
verification/reproducibility of the derived harness image ID** on the proposed
host: owner must prebuild or confirm that exact image is available (and
reproducible from the reviewed recipe) before consent.

### B3 — PowerShell 7 absent on this host

`research/mmp-125/launcher.test.ps1` requires `pwsh`. Only Windows PowerShell
5.1 is installed, so the launcher controls are `NOT_RUN` here. Prior merged PR
#127 evidence (`6da549b`) exists but cannot be re-executed on this host.

### B4 — Docker Linux engine health UNKNOWN

Pipes are present, but no daemon probe was permitted. A failed preflight would
consume the one-shot marker. This is an environment gate, not a code defect.

### B5 — missing test file

`research/mmp-125/diagnostic.test.mjs` does not exist; that exact command is
`NOT_RUN`. Coverage is partly provided by `observer.test.mjs` (20 controls).

## 6. Local/synthetic checks actually run

| Command                                            | Exit | Result                                     |
| -------------------------------------------------- | ---- | ------------------------------------------ |
| `pnpm install --frozen-lockfile`                   | 0    | frozen install                             |
| `pnpm lint`                                        | 0    | PASS                                       |
| `pnpm typecheck`                                   | 0    | PASS                                       |
| `pnpm test`                                        | 0    | 783 tests / 673 PASS / 110 SKIP / 0 FAIL   |
| `pnpm build`                                       | 0    | PASS                                       |
| `node research/mmp-069/validate.mjs`               | 0    | VALID, 104 modules                         |
| `node research/mmp-069/check-syntax.mjs`           | 0    | 103 files PASS                             |
| `node --test research/mmp-069/validate.test.mjs`   | 0    | 45 PASS                                    |
| `node research/mmp-125/audit.mjs`                  | 0    | 47 pins, `AUDIT_COMPLETE_CAUSE_UNRESOLVED` |
| `node --test research/mmp-125/audit.test.mjs`      | 0    | 25 PASS / 0 FAIL                           |
| `node --test research/mmp-125/observer.test.mjs`   | 0    | 20 PASS / 0 FAIL                           |
| `pwsh ... launcher.test.ps1`                       | N/A  | NOT_RUN (pwsh absent)                      |
| `node --test research/mmp-125/diagnostic.test.mjs` | N/A  | NOT_RUN (file absent)                      |

Biome check on `research/mmp-125`: PASS.

## 7. One bounded future attempt (text only — do not execute here)

- **New** unique scratch root in a trusted location (not the consumed
  `C:/Metamorph/.oracle-evidence/mmp125/authorized-once-20261102`).
- **New** host UUID; `AuthorizedHead` = `<POST_MERGE_IMPLEMENTATION_SHA>` (non-executable
  template placeholder). `bb8f548bae35f9add0402c855da0cd247a124cf6` is retained only as
  the **historical evidence snapshot** (pre-PR #132 main); it must **not** be used as an
  execution SHA because it predates the v2 audit/pins and would fail `Assert-Source`
  before Docker.
- Exact prepared command (non-executable template only; requires an independently
  verified clean checkout, a fresh audit and a brand-new explicitly approved owner card):

  ```
  pwsh -NoProfile -File research/mmp-125/Invoke-Diagnostic.ps1 `
    -ScratchRoot <NEW_TRUSTED_SCRATCH> `
    -AuthorizedHead <POST_MERGE_IMPLEMENTATION_SHA>
  ```

  No pre-approved runnable command exists before that gate.
- 20-minute outer wall clock + 60-second cleanup; 4GiB/512-PID outer envelope;
  unchanged worker limits.
- Preflight: OS/arch, image identity, empty foreign-worker inventory, owned-volume
  absence, frozen audit.
- Source freeze via `git bundle` at `HEAD`; candidate bytes pinned and verified.
- Cleanup: owned labels + private ledger; final inventory must be `0/0/0` with
  `VERIFIED_ZERO_RESOURCES`, else `ERROR_CLEANUP_OR_DRIVER`.
- Consumption semantics: marker created **before** any Docker call; a preflight or
  mid-run failure consumes the one attempt; **NO RETRY** without a new signed
  authorization card. Old marker and receipt are never deleted or renamed to
  bypass.

## 8. Unsigned owner authorization card (requires NEW consent after independent review)

```
MMP-125 SECOND-RUN AUTHORIZATION CARD (UNSIGNED — NOT YET AUTHORIZED)
- Git SHA (reviewed head): <POST_MERGE_IMPLEMENTATION_SHA> (non-executable template;
  bb8f548bae35f9add0402c855da0cd247a124cf6 is historical evidence only)
- Plan SHA: <fill after PR merge / exact reviewed commit>
- Candidate SHA-256: 0cf5ba0bb22fd1d335b3d061b0a9b258d7ac660f3038e1e651ddaad1262d03c1
- Source SHA-256 (archive): 32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4
- Recipe SHA-256: f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3
- Outer image ID: sha256:45e21e7c564b016c68662f87e558840fb86844e9221f6ed1b1c4c298f0bd1a6f
  (must be resolved/reproduced or replaced by a new reviewed pin before consent)
- Environment: Linux/amd64 Docker daemon, dedicated empty for the whole run
- Model requests: 0 ; model spend: $0
- Docker commands allowed after consent: only those in Invoke-Diagnostic.ps1 for
  one attempt (preflight, owned volume/container create/run/poll/copy, cleanup,
  final inventory). No image pull, no second attempt, no daemon restart by agent.
- Attempt limit: exactly 1
- Private data/cleanup boundary: outer launcher uses owned labels + private
  ledger only; the nested workshop finalizer (packages/differential/src/
  workshop-finalizer.mjs) still deletes by broad name prefix WITHOUT owner-label
  verification. On a shared daemon this makes a second run BLOCKED until Vladimir
  + Ilia jointly approve a separately reviewed ownership-scoped finalizer fix or
  prove exclusive dedicated-daemon isolation for the entire run. Null (not zero)
  when inventory unavailable.
- Stop on: Docker unavailable, foreign resources, head/pin drift, wrong arch,
  mismatched image, incomplete trace, unverified cleanup
- Required: NEW owner consent AFTER independent review. Generic approval or
  template substitution is NOT valid authorization.
```

## 9. Possible outcomes and what each refutes

| Outcome                                | Meaning                                                                                                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CANDIDATE_REQUEST` (trusted boundary) | GLM repair fails at the candidate HTTP boundary (`TARGET_WORKER_REQUEST` / `UNKNOWN`). Refutes "no HTTP request reached" for GLM; does **not** prove Meta cause or application root cause. |
| `REFERENCE_REQUEST`                    | Failure on the reference side.                                                                                                                                                             |
| `OTHER_TRUSTED_BOUNDARY`               | Trusted boundary failure not attributable to either side.                                                                                                                                  |
| `NOT_REPRODUCED`                       | Historical error not reproduced; does not clear the candidate.                                                                                                                             |
| `UNAVAILABLE` / `INCONCLUSIVE`         | Observer incomplete/truncated; no attribution.                                                                                                                                             |
| `ERROR_ENVIRONMENT`                    | Host/Docker failure; no candidate evidence (as happened before).                                                                                                                           |

Meta root cause must not be inferred from GLM alone.

## 10. STOP conditions (do not proceed / do not improvise)

- Docker daemon unavailable or foreign resources present.
- Source/head/pin drift from the reviewed commit.
- Outer image ID not reproduced/confirmed.
- Missing independent reviewer evidence on the exact SHA.
- Wrong architecture or incomplete trace/verified cleanup.
- **Do not** try another image, broaden scope, auto-retry, or substitute a new
  generated candidate using PR #131. Do not touch #115 custody or paid dispatch.

## 11. Cross-owner decision gate (not resolved here)

Changing shared Oracle/API/schema, comparator, G0–G4 or isolation semantics
requires explicit Vladimir + Ilia agreement. The P0 finalizer remediation and
any image-pin change are therefore listed as blockers, not fixed in this PR.
