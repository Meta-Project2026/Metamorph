# MMP-089 execution evidence — 2026-10-30

Code execution head: `dc28ac9b94617e95dd7aab2712b6eaf03fe4fc9b`, rebased onto
fresh `main@59a6266801956a3048a4c1ceb915bc1fb0f773a9`. Later evidence-only
commits do not relabel this execution head. Owner selected B, supplied only a
public age X25519 recipient and separately approved recipient/access/seven-day
ciphertext retention/destination in this chat. No paid authorization was given.

## Implemented behavior

After the unchanged validator exits 1 for genuine generated-candidate G1 FAIL,
the trusted selector checks run/head/source/candidate/attempt/pair identity,
sealed selected-record hashes, admitted source, trusted exact recipe and
complete compiler failure receipts. It selects TS source, compiler phase data
and minimal manifest only, not mixed Oracle packs or provider responses.
Decoded source/phase strings are checked for recognized credential markers
before JSON encoding. Bounds, malformed/missing metadata, crypto failure,
process failure and cleanup failures cannot yield upload eligibility.

The selector runs with an explicit minimal child environment. It remains
trusted host code with filesystem and Docker access; it is not a filesystem
sandbox. Only the encryptor is network-off/nonroot/read-only/cap-drop, with no
host roots/home/socket/credentials and only verified tool/code mounts plus
stdin. Production adds no plaintext archive: memory/pipe only. Existing private
validator originals remain under the already-approved ephemeral-runner policy.

The failure-aware workflow keeps the normal finalizer `always()`, requires
successful preservation **and** finalizer producer outcomes and their checked
receipts, and uploads only the fixed `.age` file for seven days. Preservation
stays ENCRYPTED_PENDING_UPLOAD until a successful artifact action. Mock upload
outcomes in private unit tests are not actual GitHub uploads.

## Commands actually executed

Windows executor: Node v22.23.1, pnpm 11.25.0. Linux trusted helper: Node
v22.23.1/pnpm 11.25.0, Docker Desktop Linux engine 29.9.2 amd64. Helper image:
`sha256:d424f9a5ca23af5a4bac57c85481e8ce2e80d6cc068e9f2000ca59f1af36f283`.
Candidate workers retain the unchanged pinned Node24/TS5.9.3 recipe and bounds.

| Command | Observed result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 on Windows and Linux, including fresh main's lockfile; no dependency/lockfile delta from that main |
| `pnpm lint` | exit 0; 196 files, no fixes |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | exit 0; Windows 459 tests: 357 PASS, 102 platform/permission skips, 0 FAIL; skips are not PASS |
| `pnpm build` | exit 0 |
| `node --test packages/agent-real/test/private-diagnostics.test.mjs` | executor agent exit 0; 9/9, including raw-string markers, exact metadata and CLI upload-denial/status/producer-outcome controls |
| `node research/mmp-069/validate.mjs` | exit 0; added truthful active/manual MMP089 inventory entry, no Fast CI workflow expansion |
| `node research/mmp-069/check-syntax.mjs` | exit 0; 63 active research modules parsed, never imported/executed by this check |
| `node --test research/mmp-069/validate.test.mjs` | exit 0; 45/45 validator/discovery negative controls after the new inventory row |
| `node research/mmp-089/install-age.mjs` | exit 0 in a fresh Linux RUNNER_TEMP; real fixed upstream download/hash/executable/version/LICENSE checks and pinned image pull |
| `git diff --exit-code origin/main -- packages/contracts packages/oracle packages/differential packages/target-worker research/mmp-061/public-source.json research/mmp-078 .github/workflows/ci.yml package.json pnpm-lock.yaml` | exit 0; protected implementation/input/fast-workflow paths unchanged |
| `git diff --cached --check` | exit 0 for implementation commits |

Tool archive/executable/LICENSE hashes, Sigsum proof command and independent
download/version agreement are in [binary-provenance.json](binary-provenance.json).
No owner private key was accessed; owner decryptability remains NOT_ESTABLISHED.

## Actual Linux G1 / crypto controls

Command, in a fresh private/output directory for each observation:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin \
  AGENT_HEAD_SHA=dc28ac9b94617e95dd7aab2712b6eaf03fe4fc9b \
  MMP089_PUBLIC_OUTPUT=<fresh-public-output> \
  MMP089_PRIVATE_PARENT=<fresh-private-parent> \
  MMP089_AGE_PATH=<qualified-tools>/age \
  node research/mmp-089/offline-controls.mjs
```

1. First executor observation exited **1**: trusted compiler phase hit its
   existing 12-second timeout (`exitCode:null`, `error:ETIMEDOUT`,
   `signal:SIGTERM`); actual G1/G2/G3 were ERROR, no compiler text. Normal cleanup
   and finalizer passed 0/0/emergencyRemoved=0. Crypto controls were NOT_RUN.
   It overlapped Windows fast checks; cause of timeout is NOT_ESTABLISHED.
   [Original receipt](evidence/executor-initial-timeout.json) and
   [bounded environment observation](evidence/initial-environment-observation.json)
   are retained. No gate, recipe or budget was changed.
2. A separate executor observation after fast checks finished exited **0**,
   **20/20 control assertions PASS**. Actual validator child exit 1 with G1 FAIL
   TS2322, G2/G3 INCONCLUSIVE, source/receipt equality, metadata rejections,
   throwaway-key exact roundtrip, wrong key/tamper/pin/oversize refusal,
   process-crash/abort cleanup, actual production preserve CLI with approved
   owner public recipient, finalizer and upload-eligibility CLI all passed.
   [Executor receipt](evidence/executor-controls.json).
3. Independent `gpt-6-astra` reviewer ran a separate fresh observation on the
   same verified clean Linux code head: exit **0**, **20/20 PASS**.
   [Independent receipt](evidence/independent-controls.json). This is independently
   executed local Linux Docker evidence, not GitHub-hosted Docker evidence.
4. The reviewer separately decrypted its synthetic throwaway-key ciphertext:
   exit **0**, full source/manifest/compiler/digest equality. Wrong-key and
   tampered-ciphertext processes each exited **1**, with no process error.
   [Independent decryption report](evidence/independent-decryption.json).
   Streaming tamper refusal does not guarantee zero partial plaintext in every
   case; see [owner runbook](RUNBOOK.md).

Both successful observations prove actual normal cleanup and independent
finalizers at 0 containers / 0 volumes / emergencyRemoved=0. The production
owner-recipient control produced only ENCRYPTED_PENDING_UPLOAD; its ciphertext
and all test plaintext/keys remain private, never in Git/public artifacts.
Roundtrip tests use throwaway test identities, not the owner's private key.

## Additional unchanged baseline proof — PARTIAL

The independent reviewer additionally executed the unchanged original public
composition proof on the same code head. [Its original summary](evidence/independent-baseline-partial.json)
is **PARTIAL / EVIDENCE_ERROR**, not full proof PASS. Known-good executed full
public G1/G2/G3 PASS with 17 HTTP/20 SQLite comparisons. The deliberate mutation
produced actual G2/G3 FAIL for the business scenario (6/7 comparisons), then
another build/environment ERROR prevented completion of the repair sequence.
All six runtime controls PASS, with normal completion 0/0/emergencyRemoved=0.
Do not infer a new regression or a resolved historical incident from this
observation. [Independent triage](evidence/independent-baseline-triage.json)
identifies the repair `workshop-rejected` typecheck exit 0 followed by build
`exitCode:null / ETIMEDOUT / SIGTERM`, wrapper exit 2, elapsed 23356ms. The
original CLI exit was **NOT_RECOVERED** after its execution handle was lost;
expected exit 1 is an inference from unchanged source, not an observed status.
It was not rerun. The separately invoked [finalizer](evidence/independent-baseline-finalizer.json)
exited **0**, PASS 0/0/emergencyRemoved=0. [Independent execution report](evidence/independent-execution.json)
records commands, observed exits, hashes and that uncertainty.

## Deliberately unexecuted / remaining boundary

Real Meta generation/POST/GET/retry/repair, paid workflow dispatch, live GitHub
ciphertext upload and owner-key decryption are **NOT_RUN**. No original paid run
was rerun. Prior candidate/compiler ROOT_CAUSE_UNKNOWN is unchanged. #61 stays
OPEN; G0/G4 INCONCLUSIVE and product NOT_ESTABLISHED. Current code review and
hosted Node22/24 Fast CI must be assessed at the exact pushed delivery SHA;
existing main CI success is not branch CI evidence.

Public tool downloads in the reviewer's Windows TEMP directory remain because
automatic approval review rejected bounded cleanup with `blocked by policy`.
Those are public binaries/archive/LICENSE only. No bypass or repeated approval
request was made. After independent observations finished, the executor
verified the exact task-owned container ID and volume mountpoint, removed the
helper/container and its private data volume (each command exit 0), and verified
absence. No private test source/keys/ciphertext were exported.

## Receipt digests

| Receipt | SHA-256 |
| --- | --- |
| Executor 20-control PASS | `118678e908760ca4b6a1db1c34e6fb8e8945a44f4bbae346e5264c13d64335da` |
| First executor timeout | `12827e63cedfd76c87751e887e19c91667943e8af7190611114023b653d38bf6` |
| Independent 20-control PASS | `c4489be39716cbc83370885e709ebd88ff01143559e92a330f0188f3165ab676` |
| Independent decryption | `5eddf88e96e360bb179271c0b8cd3af9c04a2071f7bef7b536f98c3f635de71d` |
| Independent baseline PARTIAL | `a27cb239d2584bd754dc6510b7673b88a2fae80276cc2437bc2e021a77199dda` |
| Independent execution report | `764dd5005fd2d625e7a74ec852a3ae92eddf2d7ead6557933c418752b7867037` |
