# MMP-135 validation — offline evidence record

Executor: GLM 5.3 via ZCode, 2026-11-02. Branch based on canonical
`main@7740ebbbc686a22b8e709ccd2163ceeb9aa5753b` (verified current at start;
`git fetch` showed no newer main). All commands were run by the executor on a
Windows 11 x64 host (10.0.26300, Git Bash, Node v22.23.1, pnpm biome 2.6.3).
No real owner identity was searched, opened, read or transmitted; no secret
entered Git, logs or this report.

## Executed checks

- `node --test research/mmp-135/synthetic.test.mjs` (no binary provided):
  7 tests — 6 PASS / 1 SKIP (`TEST_NOT_RUN` with reason; no auto-download) /
  0 FAIL. Exit 0.
- `MMP135_TEST_KEYGEN=<local age-keygen> node --test
  research/mmp-135/synthetic.test.mjs`: 7 tests — 7 PASS / 0 SKIP / 0 FAIL.
  Exit 0. Covered: policy pin consistency and exact result allowlist;
  classification MATCH/MISMATCH by exact equality; tool-side failures stay
  NOT_AVAILABLE and refusals ERROR (synthetic spawn outcomes); agent/CI
  environment refuses closed before prompting; relative/missing/oversized
  inputs map to documented codes; Linux pinned-binary qualification refuses a
  non-pinned tool before spawn; real-binary e2e — positive MATCH control,
  TEST identity against the production recipient stays MISMATCH, second wrong
  TEST key MISMATCH, corrupt identity ERROR, and the helper wrote nothing to
  disk.
- Binary provenance: `age-keygen --version` reported v1.3.2 (Windows build,
  pre-installed on this host via WinGet Links). It was used only to generate
  throwaway TEST identities in temp directories. The pinned `keygenSha256` is
  the linux-amd64 build and cannot qualify a Windows build; the Linux pin
  branch is exercised with an injected platform and a mismatching local
  binary. Nothing was downloaded for this task.
- `pnpm exec biome check research/mmp-135`: 4 files checked, 0 errors. Exit 0.
- `node research/mmp-069/check-syntax.mjs`: `PASS`, checked 105, failed 0
  (includes both new mmp-135 modules). Exit 0.
- `node research/mmp-069/validate.mjs`: `VALID` (workspacePackages 11,
  researchModules 106, privilegedRunner NOT_RUN). Exit 0.
- `node --test research/mmp-069/validate.test.mjs`: 45 PASS / 0 FAIL. Exit 0.
- `git diff --check`: clean. Exit 0.

## NOT_RUN and boundaries

- **Owner step 1 is NOT_RUN by design**: `OWNER_KEY_MATCH=NOT_RUN /
  OWNER_ACTION_REQUIRED`. Only the owner, on their own machine, after the
  independent ChatGPT review of this helper at the exact PR head SHA, can
  produce an attributable `MATCH` / `MISMATCH` / `NOT_AVAILABLE` / `ERROR`.
  A synthetic TEST-identity MATCH proves the tool, never owner possession.
- Production `verifyAgeRestore` / OWNER_RESTORE_PASS: NOT_RUN. Requires a
  qualified Linux host, pinned `age`/`age-keygen`, the stored ciphertext and
  its linked receipt.
- Hosted Fast CI (Node 22/24) on this branch: pending the PR; recorded in the
  PR description. No workflow was edited and nothing was dispatched
  (`validate_only` included).
- No Docker, no Meta/model API call, no artifact upload/download, no paid
  action, no G4, no custody/workflow/recipient/pin/contract change. #116
  stays HOLD, #115 stays open, #61 PRODUCT_NOT_ESTABLISHED.

## Remediation after independent review (P1/P2), 2026-11-02

The review at `5d9cd7ba24fd88b0c69b5e3ec7caec61c53661a6` requested
CHANGES: (P1) the Windows helper path executed an unqualified binary with the
identity path; (P2) terminal echo could display typed paths contrary to the
documented claim. Both are addressed at this new head; the earlier e2e bullet
above is superseded — the Windows helper path no longer exists.

Changes:

- P1 (fail-closed, reviewer-preferred option): `runOwnerCheck` now refuses
  `NOT_AVAILABLE` on every platform except Linux, and on Linux only after a
  content SHA-256 match against the pinned `DIAGNOSTIC_POLICY.keygenSha256`.
  No Windows or other-platform executable is ever spawned with the identity
  path. The real-key route is Linux/WSL with the pinned build; README
  documents this.
- P2: the new `createPrompter` suppresses input echo (readline output is a
  discarded stream, so typed paths never reach the terminal), reads answers
  from an always-attached line queue (a pasted second path is never lost,
  aborted/closed input resolves to `NOT_AVAILABLE` instead of hanging), and
  the README claim is scoped precisely: prompt labels + one final status
  line; typed input is not echoed; run without transcripts or observation.
- The reworked prompter also fixes a real robustness defect found by the new
  CLI test: with two `rl.question` calls, a second line arriving before the
  second registration was dropped (unfinished top-level await, exit 13).

Executed after the fix (Windows host, Node v22.23.1):

- `node --test research/mmp-135/synthetic.test.mjs` (no binary): 10 tests —
  8 PASS / 2 SKIP (`TEST_NOT_RUN`) / 0 FAIL. Exit 0.
- Same with the locally pre-installed age-keygen v1.3.2 Windows build via
  `MMP135_TEST_KEYGEN`: 10 tests — 9 PASS / 1 SKIP / 0 FAIL. Exit 0. The
  skip is the full-flow case, which now requires the pinned linux-amd64
  build on a Linux host (Windows refuses closed by design). New controls:
  injected `win32` and `linux` platforms refuse an unqualified existing
  executable before any spawn (if it were spawned, the verdict would be
  ERROR, not NOT_AVAILABLE); an in-process prompter test proves typed input
  is not echoed even in terminal mode; a child-process CLI test proves the
  exact stdout is two prompt labels plus one status line, that no path
  substring reaches the output, stderr is empty and the exit code is 2.
- Manual CLI spot checks: piped CRLF answers with a real Windows temp
  identity path and a missing tool → labels + `NOT_AVAILABLE`, exit 2;
  truncated input (one answer) → `NOT_AVAILABLE`, exit 2 (no hang);
  `CI=1` → `ERROR` with no prompts, exit 3.
- `pnpm exec biome check research/mmp-135`: 4 files, 0 errors. Exit 0.
- `node research/mmp-069/check-syntax.mjs`: PASS (105 files, 0 failed).
- `node research/mmp-069/validate.mjs`: VALID;
  `node --test research/mmp-069/validate.test.mjs`: 45 PASS / 0 FAIL.
- `git diff --check`: clean.

Still NOT_RUN: any use of the real owner identity (the helper has not been
run with it, by design, until independent approval of this new head and the
owner's own Linux/WSL manual run); the full pinned-binary flow e2e on a
Linux host (requires the pinned linux-amd64 build; honestly skipped
elsewhere); production `verifyAgeRestore`; G4. No Docker, no dispatch, no
Meta/model call, no artifact transfer, no paid action.
