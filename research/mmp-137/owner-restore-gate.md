# MMP-137 — Owner restore gate (owner-only; no agent execution)

## What this gate is

The paid run stored the admitted candidate encrypted to the immutable
production age recipient **before** the Oracle ran
(`custody-stored.json`: `state=STORED_UNVERIFIED`,
`verification=UNVERIFIED`, `storage=ACKNOWLEDGED_RETRIEVED`). The independent
reviewer re-downloaded and re-hashed the ciphertext against that public
receipt — exact match — but **nobody has demonstrated decryption**: 
`OWNER_RESTORE_PASS` is `NOT_RUN`. The owner-reported recipient MATCH
delivered in MMP-135/PR #136 is key-possession evidence only and does not
satisfy this gate.

Restoring is an **owner-only, trusted-machine** operation. No agent, CI job,
model or GitHub runner may perform, assist or observe it beyond the
categorical result, and no private age identity may ever be read, requested,
transferred or displayed to any AI system.

## Binding being validated

- Receipt: `custody-stored.json` (public, in artifact
  `meta-paid-public-41505679809`, artifact ID `13169804253`), fields:
  `runId=41505679809`, `runAttempt=1`,
  `headSha=a01bb65f8bb58c02c7a59e06ffedc9662576478e`,
  `sourceSha=d272170d0aecbd28eb5b13e272d9dd11d545b66c`,
  `candidateSha256=6140dbed4afb0d2068db17facb0e14ff9c2ffb61aaaf2b64207b9a8aa2125d38`,
  `ciphertextSha256=1afcc2a061a72f322f4a888bd03a93686babaf5a3e268a5d45dcc7c17bc997cb`,
  `ciphertextBytes=31094`,
  `recipientFingerprint=48218aef33dd17354761805a678f95481ad21131336cc348c23cefe99f714600`.
- Ciphertext artifact: **`13169609004`**
  (`mmp107-candidate-41505679809-1`,
  https://github.com/Meta-Project2026/Metamorph/actions/runs/41505679809/artifacts/13169609004 ).
- Diagnostics preservation (separate, `preservation.json`,
  case `G1_PASS_COMPLETED`): artifact **`13171510338`**, ciphertext
  SHA-256 `32f2d53f66d9e3ca97a368f5cc9c3e951f561425d0c186a3ab4da0ae20eb9ff8`,
  30571 bytes.
- **Expiry:** GitHub deletes both artifacts around **2026-11-09 19:00 UTC**.
  The owner should download the ciphertext ZIP(s) and the public receipt files
  to trusted local storage **before** expiry. Downloading is not decrypting
  and is safe to do from any machine.

## How the owner runs it (owner's machine, owner's hands only)

1. Trusted local **Linux or WSL** machine only. The reviewed helper
   `packages/agent-real/src/custody-restore.mjs` fails closed off Linux and
   refuses to run with `MODEL_API_KEY`/`GH_TOKEN`/`ACTIONS_RUNTIME_TOKEN`
   present, verifies the pinned age binary and `age-keygen` SHA-256s
   (`DIAGNOSTIC_POLICY`), reads the identity only transiently and validates
   the six-field receipt binding before any decryption.
2. Use the **pinned official age v1.3.2** tooling (SHA-256
   `eb7dd1b518f0a307c99cd97782623c5321da049154b04acd2d98d21aa7bc9b2c` for the
   binary per `preservation.json`) and the locally held private identity that
   matches the production recipient fingerprint above. Never paste, upload or
   transmit the identity, its path, or any decrypted byte.
3. Validate the binding (runId/attempt/head/source/candidate/ciphertext
   SHA/size) against the public receipt, then decrypt the capsule. Expected:
   the restored archive's candidate content hashes to the recorded
   `candidateSha256`.
4. Report **categorical** results only: `OWNER_RESTORE_PASS` or
   `OWNER_RESTORE_FAIL` (plus which artifact/receipt). No raw stdout, no
   paths, no decrypted content, no screenshots in issues/PRs/AI contexts.

## Explicit non-goals and constraints

- No agent-controlled encryption/decryption with the real key; no agent reads
  the identity, the plaintext, or decrypted output. If a later task needs the
  candidate source, that is a **separate authorization**
  (`OWNER_LOCAL_RESTORE_AND_SEPARATE_PERMISSION_REQUIRED`), with a sanitized
  candidate-only review in a network-off trusted sandbox, treating candidate
  code as untrusted data — never executed or imported on a host.
- No Docker on the shared host while the #134 foreign-resource cleanup issue
  is unresolved; no manual Docker diagnostics.
- Restore success does **not** change product status: G2/G3 FAIL and
  `PRODUCT_NOT_ESTABLISHED` stand regardless. It only converts custody from
  `STORED_UNVERIFIED` to demonstrated-recoverable and preserves the evidence
  past artifact expiry.
- No rerun, no new POST, no workflow dispatch, no artifact upload of decrypted
  content, ever, without fresh explicit owner authorization.
