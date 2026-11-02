# MMP-139 validation — offline evidence record

Executor: GLM 5.3 via ZCode, 2026-11-02. Branch `glm/mmp139-owner-export`,
based on canonical `main@d31711f612e14373308fa4f3a220b142567f2004`
(`git fetch` at start; `origin/main` confirmed current). All commands were
run by the executor on a Windows 11 x64 host (10.0.26300, Git Bash,
Node v22.23.1) plus its WSL2 environment (kernel
6.18.54.1-microsoft-standard-WSL2, nvm Node v22.23.4). No real owner
identity, ciphertext, or candidate text was searched, opened, read or
transmitted; no secret entered Git, logs or this report. The owner CLI was
never executed with real inputs; no age binary was downloaded.

## Executed checks

- `node --test research/mmp-139/synthetic.test.mjs` (Windows, Node v22.23.1):
  24 tests — 14 PASS / 10 SKIP / 0 FAIL. Exit 0. Skips are the POSIX-gated
  writer/flow controls (8), the root-required foreign-uid control, and the
  Linux closed-stdin CLI control — each with an explicit `TEST_NOT_RUN`
  reason; none is counted as a pass.
- Same suite under WSL2 (Node v22.23.4, real POSIX modes/symlinks): 24 tests
  — 22 PASS / 2 SKIP / 0 FAIL. Exit 0. The two skips are the win32-host CLI
  refusal control and the root-required foreign-uid control. The POSIX set
  exercised here: full owner flow export (byte-identical files, exact tree,
  `0700`/`0600` modes, deterministic `UNVERIFIED_PRODUCT` manifest, single
  `CANDIDATE_ONLY_EXPORT_READY <digest>` line, no path/content leak in
  output); production default pins active in the flow (identity/candidate
  drift rejects); rejected restore never creates the output directory;
  missing/broken/pin-mismatched receipts reject before any restore; existing
  destination and checkout-inside/transient destinations rejected untouched;
  write failure leaves no partial export (fresh directory removed); unexpected
  output file detected and whole fresh directory removed; symlinks at the
  destination and inside its path rejected without following; Linux CLI with
  closed stdin prints exactly one prompt label then `EXPORT_REJECTED`, exit 1.
- Windows-only controls in the same file: static no-dynamic-capability scan
  of the helper (no `child_process`, no dynamic import, no eval/Function,
  no network modules, no spawn/exec) and its trusted-core import pins;
  child-process import inertness (no write into a watched cwd, no prompt, no
  output beyond the sentinel); production pin constants equal the canonical
  published run facts (independent second copy in the test); canonical
  bundle acceptance; path/content/count/entrypoint/duplicate rejection
  matrix; deterministic minimal manifest; identity-pin/attempt-id/secret-
  tripwire enforcement; receipt pin binding matrix; destination
  classification matrix; platform/credential refusals before any prompt
  (including seven refusal env names and empty-string tolerance); abort
  semantics (first empty answer stops); win32 CLI refusal prints exactly
  `EXPORT_REJECTED`, exit 1; prompter echo suppression.
- `node research/mmp-069/check-syntax.mjs`: `PASS`, checked 108, failed 0
  (includes both new mmp-139 modules). Exit 0.
- `node research/mmp-069/validate.mjs`: `VALID` (workspacePackages 11,
  researchModules 109, privilegedRunner NOT_RUN). Exit 0. The new
  `research/mmp-139` matrix entry carries `LOCAL_ONLY` execution, hosted
  syntax checking, and an honest `tests: "NOT_VERIFIED"` (no hosted test
  step was added and no workflow was edited).
- `node --test research/mmp-069/validate.test.mjs`: 45 PASS / 0 FAIL. Exit 0.
- `pnpm exec biome check research/mmp-139`: 5 files, 0 errors. Exit 0
  (formatter applied once; tests re-run green after formatting on both
  platforms).
- `git diff --check`: clean. Exit 0.

## Defects the offline controls caught before delivery

- The first `classifyDestination` used `path.resolve`, whose normalization is
  platform-dependent; replaced with pure string classification so the
  control means the same thing on every host.
- Flow fixtures originally staged output parents under `os.tmpdir()`; on WSL
  the tool correctly refused them as `TRANSIENT`, and several negative tests
  passed for the wrong reason. Fixtures moved to a self-named throwaway
  directory under the invoking user's HOME (the only unprivileged
  non-transient location on a default WSL), cleaned up after each test; the
  positive flow and the no-clobber/symlink/rogue-output controls now
  exercise their intended paths.

## NOT_RUN and boundaries

- **The owner export is NOT_RUN by design**: no real identity, ciphertext or
  receipt was ever provided to, read by, or reachable from this work, and
  `SANITIZED_EXPORT_READY` remains owner-attested only. Real
  `verifyAgeRestore` execution is NOT_RUN here (requires a qualified Linux
  host, pinned age builds, the stored receipt and ciphertext; tool
  qualification itself is enforced inside the unchanged trusted core and
  covered by its package tests).
- Hosted Fast CI (Node 22/24) on this branch: pending the PR; recorded in
  the PR description. No workflow was edited and nothing was dispatched
  (`validate_only` included).
- No Docker, no Meta/model API call, no network call, no artifact
  upload/download, no candidate execution or import, no paid action, no G4,
  no custody/workflow/recipient/pin/contract change. #137 hypotheses stay
  hypotheses; #115 stays open; #61 stays PRODUCT_NOT_ESTABLISHED.

## Independent reviewer correction — test false positive fixed (2026-11-02)

ChatGPT independent exact-head review discovered that the original secret-tripwire
negative control changed `src/main.ts` but kept the old expected candidate SHA,
so it rejected **at the preceding canonical hash check** without exercising
`rejectSecrets`. The updated test constructs valid matching synthetic capsule
and expected pins for a deliberately secret-bearing file; it then proves the
source-content tripwire rejects instead of relying on SHA drift. The companion
safe control demonstrates a matching source passes. The export planner now
normalizes the trusted scanner's internal rejection to fixed `EXPORT_REJECTED`.
The injected write-failure test also now _commits one real synthetic plaintext
file_ via the existing trusted `commitPrivate`, confirms it exists before
second-write failure, then checks it was removed along with the fresh tree.

**Execution of these corrected tests is NOT_RUN by the independent reviewer.**
Original GLM evidence 24 tests (WSL 22 PASS / 2 SKIP; Windows 14 PASS /
10 SKIP) applies only to the earlier PR head; it must not be cited as a test
of the corrected head. Hosted Fast CI validates syntax and matrix but does
not execute `research/mmp-139/synthetic.test.mjs`. Re-execute this suite
under owner's/test executor's Linux/WSL with **synthetic TEST material only**
before exact-head approval or merge. No key, ciphertext, candidate, Docker,
Meta API or workflow dispatch was accessed by this correction.

## Re-executed evidence for the corrected head (2026-11-02)

Executor: GLM 5.3 via ZCode, same day. Local branch fast-forwarded with
`git merge --ff-only origin/glm/mmp139-owner-export` (no unrelated work
touched; working tree was clean). **Every result below was produced at exact
pre-evidence-update head `d1d684e75227bd18a15a082134d0747805f91f79`** (the
reviewer-corrected head, confirmed equal to `origin/glm/mmp139-owner-export`
after `git fetch origin --prune`). Only synthetic TEST material was used:
no real owner key, identity file, ciphertext, decrypted source, owner home
scanning, Docker, Meta/model call, workflow dispatch or artifact transfer.

Independent verification of the corrections (read + probe, before running):

- The secret-tripwire fixture now computes its own canonical candidate SHA
  from its own contents (`selectExportableFiles([secretFile])` then
  `sha256(JSON.stringify(...))`), so the earlier canonical-hash guard passes
  and cannot mask the scanner. A direct probe on the corrected head
  confirmed the chain: `rejectSecrets(<fixture>)` throws
  `DIAGNOSTIC_REJECTED`; the filter accepts the fixture; `planExport` with
  the fixture's own SHA and matching test pins reaches the secret guard and
  throws categorical `EXPORT_REJECTED` (the planner's new normalization).
  A matching safe-bundle control proves `planExport` accepts when no secret
  pattern is present.
- The write-failure case now performs a real trusted `commitPrivate` of
  `src/lib/util.ts` on the first call and asserts `existsSync(...)` true at
  the moment of the injected second failure, so the subsequent removal
  assertions prove genuinely-written source is cleaned up.

Executed commands and results:

- `node --test research/mmp-139/synthetic.test.mjs` — WSL2 Linux
  (kernel 6.18.54.1-microsoft-standard-WSL2, Node v22.23.4): **24 tests —
  22 PASS / 2 SKIP / 0 FAIL**, exit 0. The two skips are explicit
  `TEST_NOT_RUN`s and are not passes: (1) the foreign-uid receipt control
  (requires root), (2) the win32-host CLI platform-refusal control.
  This run includes the corrected secret-tripwire and real-write-failure
  cleanup tests as PASS, superseding their NOT_RUN status from the reviewer
  correction above.
- Same suite on Windows 11 x64 (Git Bash, Node v22.23.1): **24 tests —
  14 PASS / 10 SKIP / 0 FAIL**, exit 0. Skips: the 8 POSIX-gated
  writer/flow controls (incl. the two corrected tests, which are
  POSIX-gated and therefore verified only by the WSL run above), the
  root-required foreign-uid control, and the Linux closed-stdin CLI control.
- `pnpm exec biome check research/mmp-139`: 6 files, 0 errors. Exit 0.
- `node research/mmp-069/check-syntax.mjs`: `PASS`, checked 108, failed 0.
  Exit 0.
- `node research/mmp-069/validate.mjs`: `VALID`. Exit 0.
- `node --test research/mmp-069/validate.test.mjs`: 45 PASS / 0 FAIL. Exit 0.
- `git diff --check`: clean. Exit 0.

Boundaries: still NOT_RUN — the owner export with real identity/ciphertext
(owner-only after independent exact-head approval), real `verifyAgeRestore`,
and any production use. The hosted Fast CI result for the evidence-only
update commit is recorded in PR #142; Fast CI does not execute this research
suite, so the WSL run above is the operative test evidence for the corrected
head.

## MMP-143 confirmed production SHA mismatch (2026-11-03)

A real owner-local export of the restored paid candidate returned
`EXPORT_REJECTED`. Owner-only read-only checks confirmed receipt read,
production pins, full receipt schema, ciphertext bytes, output destination
classification/freshness, age and age-keygen pinned SHA, directory/file
permissions and CI environment all OK. None of these checks decrypted the
candidate or exposed the owner identity.

Independent code review identified a deterministic **canonical object field
ordering** error: the authoritative production `validateBundle()` constructs
`{ path, sha256, content }` and derives
`SHA256(JSON.stringify(canonicalFiles))`, while MMP-139 built
`{ path, content, sha256 }` and compared its different digest with the
real production candidate SHA. The former synthetic fixture oracle was
self-derived using the buggy exporter's ordering, which concealed the error.

The research-only correction makes the exporter emit the exact official
`validateBundle()` field insertion order, switches the synthetic oracle
to the **independent trusted `validateBundle(SYNTHETIC_FILES)`**, and adds a
regression proving old reordering has a different hash while matching
production-format synthetic SHA passes `planExport`. The secret-tripwire
positive/negative fixtures now also source their expected hashes from
trusted admission. The source pins/recipient, production `packages/**`,
paid workflow, and GitHub owner key boundaries remain unchanged.

**All local synthetic tests for this correction are NOT_RUN as of authoring
this note; review the new PR and ask a separate executor to run the corrected
suite on Linux/WSL (and Windows, if available).** Hosted Fast CI covers
syntax/matrix but not this research suite. The owner must **not** retry a
real-key export until exact-head independent approval, merge and fresh
owner-only checkout of the merged SHA. This correction has not seen the
real decrypted candidate; G2/G3 still FAIL, G4 NOT_RUN.
