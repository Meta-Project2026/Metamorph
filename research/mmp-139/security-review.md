# MMP-139 security review — trust model, exports inventory, residual risks

Scope: `research/mmp-139/owner-export.mjs` as delivered on this branch. This
document makes no claim about the candidate's product correctness or about
the absence of secrets in restored source. The tool has **not** been run
against the owner's real identity or ciphertext; that step is owner-only,
after an independent review of the exact PR head SHA.

## What is trusted, and for what

| Input                                                                   | Trust                  | Enforced by                                                                                                                                                                         |
| ----------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository code at the reviewed SHA                                     | trusted core           | owner's clean checkout; review pins the head SHA                                                                                                                                    |
| `verifyAgeRestore` (unchanged import)                                   | full restore authority | pinned `age`/`age-keygen` content SHAs, fixed production recipient (`testRecipient` never passed), receipt re-validation, ciphertext SHA/length vs receipt, capsule re-validation   |
| `readRecord` / `privateDirectory` / `commitPrivate` (unchanged imports) | bounded private I/O    | owner-only `0700` dirs, `0600` files, no-symlink component walk, uid checks, atomic no-clobber `link(2)` commit with read-back SHA verification                                     |
| The five typed paths                                                    | owner knowledge        | never argv/env/logs; echo suppressed; absolute-normalized only; identity content never read by this wrapper                                                                         |
| Restored capsule                                                        | untrusted until pinned | identity 5-tuple pinned to published run constants; attemptId UUID-checked; files re-validated independently; canonical SHA recomputed and compared; static secret tripwires re-run |
| Output directory                                                        | owner choice           | fresh (no-clobber `mkdir 0700`), outside checkout / `/mnt` / transient / sync-name trees; no symlink components                                                                     |

The `pins`, `restore`, `readRecordFn`, `commitImpl`, `env`, `platform` and
`repoRoot` parameters of `runOwnerExport` are module-only test controls, the
same pattern the review accepted for mmp-135's `expected` and the trusted
core's `testRecipient`: the manual CLI (`main`) never passes any of them, so
no command-line path can loosen the production pins or the fixed recipient.

## Exactly what is written, and where

- `<destination>/manifest.json` — `0600`, deterministic bytes:
  `{format: "mmp139-candidate-only-export-v1", label: "UNVERIFIED_PRODUCT",
  candidateSha, files: [{path, bytes, sha256}...]}`. Nothing else — no run
  id, head SHA, source SHA, attempt id, admission or license envelope.
- `<destination>/src/**/*.ts` — byte-identical restored candidate sources,
  each `0600`, directory components `0700`.
- Nothing else, anywhere: no temp file outside the destination, no log, no
  Git object, no upload. On any failure the entire destination tree is
  removed (it was created empty by that run); a stalled removal leaves a
  `0700` directory with **no** `manifest.json` for manual deletion.
- The single status line prints the manifest digest — a SHA of
  SHA/size/path metadata only, not content.

Plaintext exists only in process memory and in the final private directory
(matches the custody design's `MEMORY_AND_PIPE_ONLY` staging). The trusted
restore zero-fills its spawn buffers; JS string copies are left to the GC,
as in the already-reviewed mmp-115 restore path.

## What the tool refuses (fail closed)

- Platform not `linux` (Windows refuses before any prompt).
- Any of `CI`, `MODEL_API_KEY`, `GH_TOKEN`, `GITHUB_TOKEN`,
  `ACTIONS_RUNTIME_TOKEN`, `ACTIONS_ID_TOKEN_REQUEST_TOKEN`,
  `ACTIONS_CACHE_SERVICE_TOKEN` set non-empty.
- Any empty/non-absolute/non-normalized answer; destination classified
  `CHECKOUT`/`WSL_MOUNT`/`TRANSIENT`/`SYNC_OR_BACKUP`/`NOT_ABSOLUTE`/
  `NOT_NORMALIZED`.
- Receipt missing/broken/pin-mismatched (cipher SHA/length, candidate SHA);
  any `verifyAgeRestore` rejection (wrong tool build, wrong identity, wrong
  recipient, wrong ciphertext); any capsule identity/structure drift;
  pre-existing destination; symlink at or inside the destination; foreign
  or group/other-readable files (trusted helpers); write failures.
- All rejections collapse to the single categorical `EXPORT_REJECTED` line —
  no error text, no paths, no payload ever printed.

## Residual risks (owner-acknowledged)

1. **Static secret scanning is partial.** `rejectSecrets` patterns and the
   capture-time screening bound obvious credential formats only. They prove
   nothing about logical secrets inside the source. Owner review before any
   sharing is mandatory; the card's blockers stand.
2. **Sync/backup detection is a name heuristic.** A sync client configured
   at an innocuous path (e.g. `/home/u/cloud`) is not detected. The control
   is the owner's conscious choice of destination.
3. **The identity path is visible** to the pinned `age-keygen`/`age` child
   processes inside `verifyAgeRestore` (their argv). This is the already
   reviewed mmp-115 behavior; removing it would require new crypto, which
   this task forbids. The path never appears in this wrapper's argv, output
   or any file.
4. **Rejections are opaque by design.** The owner cannot distinguish "wrong
   path typo" from "wrong tool build" from the printed line. This is the
   price of guaranteed non-disclosure; the runbook explains rerun discipline.
5. **Memory plaintext** (restored capsule, file contents) is subject to the
   host's swap/hibernation posture, as in every reviewed custody step. Run
   on a trusted machine.
6. **Cleanup is best-effort.** A process holding an exported file open can
   leave a `0700` directory without `manifest.json`; nothing partial is ever
   presented as a completed export.
7. **`attemptId` is validated, not pinned** (its value is not published), so
   a hypothetically restored _different_ capsule sharing all five published
   identity values would still be caught by the recomputed canonical
   candidate SHA pin — the file-content hash — plus receipt/cipher pins.
8. **The tool trusts the checked-out repo code.** Run only from a clean
   checkout of the reviewed SHA; a tampered checkout could subvert anything.
9. **No deletion guarantee for owner artifacts:** the tool never deletes
   existing encrypted artifacts/receipts (preservation requirement), so
   confidentiality of those remains governed by their own storage hygiene.

## Explicit non-goals (unchanged from the task card)

No Meta GET/POST, paid calls, retry/repair, `workflow_dispatch` (including
`validate_only`), Docker, artifact transfer of private material, reading or
discovering `.age/keys.txt` or environment secrets, scanning Windows/WSL
owner homes, executing/importing candidate TS, uploading candidate code, or
publishing any real candidate source. No change to `packages/**`, Oracle,
policies, workflows or source pins. The exporter is a research helper, not a
production component, and is never a CI step.
