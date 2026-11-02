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
script. It prints two prompt labels and asks interactively for (1) the
identity file path and (2) the `age-keygen` path, then runs
`age-keygen -y <identity>` without a shell, at the absolute owner-provided
path, with a 10 s timeout and a 4096-byte output bound, and compares the
derived public recipient for exact equality with the production
`DIAGNOSTIC_POLICY.recipient` from
`packages/agent-real/src/private-diagnostics.mjs` (whose pinned
`recipientSha256` is re-verified first). It emits one allowlisted **final
status line**, plus the two prompt labels and a line break after each answer.

- **Input echo is suppressed.** Typed characters and the entered paths are
  not displayed and never reach the helper's output, argv, shell history or
  any file. Input is blind: paste the path and press Enter; a mistyped path
  ends in `ERROR` or `NOT_AVAILABLE` — rerun. Run only in a normal local
  terminal without transcript recording, screen sharing or agent observation.
- The Node wrapper itself makes **no network calls** and writes **no files**;
  it never reads the identity content (only its size ≤ 4096 bytes is checked)
  and never prints the derived key, the paths, stderr or any other detail.
  The spawned child is accepted only after a binary content SHA-256 pin
  check (below), so the executed tool is exactly the qualified build.
- It never runs on import, in tests, in CI or on install, and refuses closed
  when `CI`, `GH_TOKEN`, `MODEL_API_KEY` or `ACTIONS_RUNTIME_TOKEN` is set.

## Platform qualification (fail closed)

- **Linux/WSL — the only real-key route:** the helper accepts only an
  `age-keygen` whose content SHA-256 equals the pinned
  `DIAGNOSTIC_POLICY.keygenSha256` (official age v1.3.2 linux-amd64 build).
  Any other binary — including one that merely self-reports v1.3.2 — reports
  `NOT_AVAILABLE` before any spawn.
- **Windows: refuses closed (`NOT_AVAILABLE`).** No qualified pinned Windows
  build exists, so no Windows executable is ever run with the identity path
  (PR review P1). Perform the real check under Linux or WSL.
- Any other platform: `NOT_AVAILABLE`.

## Before you run it

1. **Wait for the independent review approval of the helper at the exact PR
   head SHA.** Do not run the helper before that review is recorded.
2. Run it only on your own trusted machine, in a normal interactive terminal,
   from a clean checkout of the reviewed SHA.
3. Under Linux or WSL, provide your own copy of the pinned official
   `age-keygen` v1.3.2 linux-amd64 build (for example extracted yourself from
   the official `age-v1.3.2-linux-amd64.tar.gz` release asset into an
   owner-only directory). Nothing is downloaded by the helper; if your
   binary's hash does not match the pin, the check reports `NOT_AVAILABLE`.
   Under WSL the repository checkout and Node must be reachable from the WSL
   environment; the identity path you enter must be absolute in that
   environment.

## How to run (from the repository root)

Linux or WSL:

```sh
node research/mmp-135/check-owner-key.mjs
```

Windows PowerShell: not available — the helper refuses closed by design; use
WSL or another Linux host.

Answer the two prompts with absolute paths (input is not echoed). Press
Ctrl+C to abort (an abort or closed input prints `NOT_AVAILABLE` or `ERROR`;
do not report an abort as a check result).

| Exit code         | Meaning                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| 0 `MATCH`         | The identity derives exactly the production recipient                                                            |
| 1 `MISMATCH`      | A clean derivation produced a different recipient                                                                |
| 2 `NOT_AVAILABLE` | Tool missing, unqualified, non-Linux platform, timed out, or unusable output; or a prompt was left empty/aborted |
| 3 `ERROR`         | Invalid identity input, unexpected failure, agent/CI context, or policy pin inconsistency                        |

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
