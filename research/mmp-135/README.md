# MMP-135 — owner-local age recipient possession check (step 1 only)

Refs #135, #115, #116. Helper base: this directory at the reviewed PR head SHA.

Status: **OWNER_KEY_MATCH=NOT_RUN / OWNER_ACTION_REQUIRED.** Only the owner's
attributable manual result (`MATCH` / `MISMATCH` / `NOT_AVAILABLE` / `ERROR`)
can change it. This is step 1 only: the #116 exact-main preflight and the
immutable launch-permission map stay deferred, #116 stays HOLD, #115 stays
open, #61 stays PRODUCT_NOT_ESTABLISHED and G4 stays NOT_RUN. The owner's
chosen future #116 budget (USD 1.00 as the maximum pre-send _estimate_) is
recorded in #135; it is not a billing hard cap and authorizes no POST.

## What the helper does and never does

[check-owner-key.mjs](check-owner-key.mjs) is a compact owner-executed Node
script. It asks interactively for (1) the identity file path and (2) the
`age-keygen` path, then runs `age-keygen -y <identity>` without a shell, at
the absolute owner-provided path, with a 10 s timeout and a 4096-byte output
bound, and compares the derived public recipient for exact equality with the
production `DIAGNOSTIC_POLICY.recipient` from
`packages/agent-real/src/private-diagnostics.mjs` (whose pinned
`recipientSha256` is re-verified first). It prints exactly one result line.

It **never**: reads the identity content (only size ≤ 4096 bytes is checked),
accepts paths as arguments (so nothing lands in shell history), resolves the
tool through `PATH`, prints the derived key, the paths, stderr or any detail,
makes a network call, writes any file, or runs on import, in tests, in CI or
on install.

## Before you run it

1. **Wait for the independent ChatGPT review of the helper at the exact PR
   head SHA.** Do not run the helper before that review is recorded.
2. Run it only on your own trusted machine, in a normal interactive terminal,
   from a clean checkout of the reviewed SHA. The helper refuses closed when
   `CI`, `GH_TOKEN`, `MODEL_API_KEY` or `ACTIONS_RUNTIME_TOKEN` is set.
3. Provide your own local `age-keygen` **v1.3.2**. No tool is downloaded.
   - Linux/WSL: the helper accepts only a binary whose SHA-256 equals the
     pinned `keygenSha256` (`DIAGNOSTIC_POLICY`, linux-amd64 build); anything
     else reports `NOT_AVAILABLE`.
   - Windows: no pinned hash exists for a Windows build, so the helper cannot
     qualify it for you; you are responsible for using an official unmodified
     age v1.3.2 `age-keygen.exe`. This documented qualification gap is an
     obstacle to note, never a fake PASS.

## How to run (from the repository root)

Windows PowerShell:

```powershell
node research\mmp-135\check-owner-key.mjs
```

Linux or WSL:

```sh
node research/mmp-135/check-owner-key.mjs
```

Then answer the two prompts with absolute paths. Press Ctrl+C twice to abort
(an abort prints `ERROR`; do not report an abort as a check result).

| Exit code         | Meaning                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| 0 `MATCH`         | The identity derives exactly the production recipient                                          |
| 1 `MISMATCH`      | A clean derivation produced a different recipient                                              |
| 2 `NOT_AVAILABLE` | Tool missing, unusable, unqualified, timed out, or unusable output; or a prompt was left empty |
| 3 `ERROR`         | Invalid identity input, unexpected failure, agent/CI context, or policy pin inconsistency      |

Report back exactly one of: `MATCH`, `MISMATCH`, `NOT_AVAILABLE`, `ERROR`.

## What a result means — and what it does not

`MATCH` establishes possession of an identity matching the existing
production recipient (KEY_MATCH). It does **not** establish a real production
decrypt/restore: `verifyAgeRestore` still requires a qualified Linux host,
pinned `age`/`age-keygen`, the stored ciphertext and its linked receipt, and
remains the only path to OWNER_RESTORE_PASS. Do not upgrade a MATCH into a
restore claim. No new production identity is generated and the recipient is
never changed for convenience.

If you do not know where your identity file is, stop: do not let any agent or
tool search for it. Locate it yourself first, then run the helper.

## Validation

Synthetic offline controls (throwaway TEST identities only, no real key) are
in [synthetic.test.mjs](synthetic.test.mjs); executed evidence and NOT_RUN
boundaries are recorded in [validation.md](validation.md).
