# MMP-139 — owner-local candidate-only export (no agent access to the key)

Refs #139, #137, #115, #61; paid run
[#41505679809](https://github.com/Meta-Project2026/Metamorph/actions/runs/41505679809).
Helper base: this directory at the reviewed PR head SHA.

Status: **SANITIZED_EXPORT_READY=NOT_RUN / OWNER_ACTION_REQUIRED.** Only the
owner, running the tool personally on their own trusted Linux/WSL machine
after an independent review of the exact PR head SHA, can produce an
attributable `CANDIDATE_ONLY_EXPORT_READY`. Until then #137's H1/H2/H3/H5
remain hypotheses, #115 stays open and #61 stays PRODUCT_NOT_ESTABLISHED.

## What the tool does — and never does

[owner-export.mjs](owner-export.mjs) is a compact owner-executed Node script.
It prints five prompt labels and asks interactively for (1) the `age` binary
path, (2) the identity file path, (3) the ciphertext file path, (4) the
custody receipt file path and (5) a fresh output directory path. It then
delegates the entire restore to the already-reviewed trusted core —
`verifyAgeRestore` from `packages/agent-real/src/custody-restore.mjs` and
`readRecord` from `custody-files.mjs` — which enforces the qualified pinned
`age`/`age-keygen` builds, the fixed production recipient, the receipt
binding and the ciphertext SHA/length. This wrapper implements no crypto and
can never override the recipient. Before anything is written it pins the
restored capsule to the canonical published run: run `41505679809`, attempt
`1`, workflow head `a01bb65f…`, source `d272170d…`, candidate
`6140dbed4afb0d2068db17facb0e14ff9c2ffb61aaaf2b64207b9a8aa2125d38`, and the
published ciphertext SHA `1afcc2a0…` / length `31094`. It re-validates every
file independently (strict `src/**/*.ts` paths, per-file SHA/size, count,
`src/main.ts` entrypoint), recomputes the canonical candidate SHA, and only
then writes.

On success the tool creates the fresh output directory `0700`, writes each
restored `src/**/*.ts` file byte-identical with mode `0600`, and a minimal
`manifest.json` (`0600`) containing only the candidate SHA, per-file
path/size/SHA and the label `UNVERIFIED_PRODUCT`. It prints exactly one final
line: `CANDIDATE_ONLY_EXPORT_READY <manifest-digest>` (exit 0) or
`EXPORT_REJECTED` (exit 1). Nothing else is ever printed — no key path,
private output path, candidate text, decrypted payload or error detail.

- **No export of anything but `src/**/*.ts`:** never the full capsule JSON,
  `capsule.identity` beyond the pinned constants, admission/license envelopes,
  provider response, private logs, diagnostics, raw Oracle packs, reference
  PHP or held-out data. The MIT license text already embedded in admitted TS
  files is preserved verbatim inside those files.
- **Input echo is suppressed.** Typed characters and the entered paths never
  reach the output, argv or shell history (no arguments are accepted at all).
  Paste the path and press Enter; a mistyped path ends in `EXPORT_REJECTED` —
  rerun. Run only in a normal local terminal without transcript recording,
  screen sharing or agent observation.
- **It never runs on import, in tests, in CI or on install**, refuses closed
  outside Linux/WSL, and refuses when `CI`, `MODEL_API_KEY`, `GH_TOKEN`,
  `GITHUB_TOKEN`, `ACTIONS_RUNTIME_TOKEN`,
  `ACTIONS_ID_TOKEN_REQUEST_TOKEN` or `ACTIONS_CACHE_SERVICE_TOKEN` is set.
  It starts no process of its own, makes no network call, touches no Git
  command, and never executes or imports candidate TS (files are opaque bytes
  written to disk).
- **Your existing identity file is only read**, by the pinned `age-keygen -y`
  inside the trusted core; the tool never modifies, moves or re-permissions
  it, and never searches for it. If you made a protected copy for MMP-137,
  enter that path only if you choose to.
- Static secret-pattern screening is re-run per exported file, but that
  remains a **partial** check — it does not prove the source is free of
  secrets. Owner review before sharing stays mandatory; blockers stand.

## Before you run it

1. **Wait for the independent review approval of this tool at the exact PR
   head SHA.** Do not run it before that review is recorded.
2. Run it only on your own trusted Linux/WSL machine, in a normal interactive
   terminal, from a clean checkout of the reviewed SHA, with Node 22+.
3. Have your own copies of the qualified official `age` v1.3.2 linux-amd64
   `age` and `age-keygen` binaries (hash-pinned by the trusted core; nothing
   is downloaded). Under WSL, Node and the repository must be reachable from
   the WSL environment and every path you enter must be absolute in that
   environment.
4. Have the stored custody receipt and `candidate.age` from the paid run kept
   in owner-only (`0700`) directories with `0600` files, as the custody
   collector produced them; the tool refuses otherwise. The GitHub artifact
   (ID 13169609004) expires around 2026-11-09 — the tool needs your already
   downloaded local copy.

## Choosing the output directory

The destination must be a **new** directory (the tool never overwrites), an
absolute normalized POSIX path that you consciously choose outside:

- the Git checkout (the tool derives the checkout root from its own
  location),
- WSL mounts (`/mnt/...`),
- transient/public system trees (`/tmp`, `/var/tmp`, `/dev/shm`, `/run`,
  `/srv`, `/var/www`, `/boot`, `/proc`, `/sys`, `/dev`),
- directories whose names suggest sync or backup services (Dropbox, OneDrive,
  Google Drive, iCloud, "backup", "sync" — a partial name heuristic, not a
  guarantee; the real control is your own choice of a plain private
  location).

The parent directory must already exist and be free of symlink components.
If a run is rejected mid-write, the tool removes its own incomplete output
directory; if files are held by another process it leaves a `0700` directory
with no `manifest.json` — delete it yourself and rerun.

## How to run (from the repository root)

Linux or WSL:

```sh
node research/mmp-139/owner-export.mjs
```

Windows PowerShell: not available — the tool refuses closed by design; use
WSL or another Linux host. No arguments are accepted, ever: answer the five
prompts with absolute paths (input is not echoed). Ctrl+C aborts to
`EXPORT_REJECTED`; do not report an abort as a result.

| Exit code | Status line                                            | Meaning                                                                                                               |
| --------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 0         | `CANDIDATE_ONLY_EXPORT_READY <64-hex manifest digest>` | Candidate-only tree + manifest written to your chosen directory                                                       |
| 1         | `EXPORT_REJECTED`                                      | Any refusal, pin mismatch, malformed receipt/capsule, unsafe destination or write failure — the tool never says which |

`EXPORT_REJECTED` is deliberately categorical. Rerun only after you
understand what changed; never repeat runs hoping for a different answer.

## After a READY — and what it does not mean

- `CANDIDATE_ONLY_EXPORT_READY` means the pinned run's candidate files were
  restored and written. It does **not** establish anything about product
  correctness: the candidate stays `UNVERIFIED_PRODUCT`, G2/G3 remain FAIL
  (`HTTP_JSON_TYPE`), G4 remains NOT_RUN and #61 remains
  PRODUCT_NOT_ESTABLISHED.
- Inspect the exported files **alone**. You then decide whether to hand only
  chosen `src/**/*.ts` files to the independent reviewer in the existing
  conversation. Never share the identity, the receipt, the ciphertext, the
  full output directory or the capsule. There is no upload, commit or
  transfer built into the tool — sharing happens only by your explicit
  manual action.
- Keep the existing encrypted artifacts and receipts in place; the tool
  deletes nothing outside its own fresh output directory.

If you do not know where your identity file or artifacts are, stop: do not
let any agent or tool search for them. Locate them yourself first.

## Validation

Synthetic offline controls (synthetic TEST capsules/receipts only, no real
key or ciphertext) are in [synthetic.test.mjs](synthetic.test.mjs); executed
evidence and NOT_RUN boundaries are recorded in
[validation.md](validation.md). The trust model and residual risks are in
[security-review.md](security-review.md).
