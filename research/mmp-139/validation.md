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
