# MMP-071 executed validation — 2026-10-29

Historical record at MMP-071 delivery, not current whole-project status.
See [MMP-085 validation](VALIDATION-085.md) for the added real AI evidence track.
Its statements about unexecuted generation/archive verification apply to MMP-071
at the time; they are not claims that MMP-081 generation never occurred.

Environment: Windows, Node v22.23.1, pnpm 11.25.0. Isolated branch
`demo/mmp-071-hackathon`, base `2a6eef6a583cf981e604d697bc1cb287174a823c`.
The delivered implementation head is recorded by the PR/Git history; the commands
below validate this directory's implementation, not the model trial or replay.

| Executed command / check | Exit / outcome |
| --- | --- |
| git fetch origin main; git rev-parse origin/main | 0; base above |
| gh issue view 71 / 61; gh pr view 70 | 0; #71/#61 OPEN, #70 OPEN at e8f6e739f1a727997c061dc5bafaa37040392489 during inspection |
| gh run view 40793819074 (headSha/conclusion/status/url) | 0; completed/success, head 6ab6e36f813673756af157bc0de2265964c26071 |
| gh api contents at pinned evidence commit, base64 decode and indexed hash/size assertions | 0; exact public files copied; no branch merge/cherry-pick |
| pnpm install --frozen-lockfile | 0; existing lockfile unchanged, 54 packages reused, zero new runtime dependencies |
| pnpm lint | 0; 167 files, no fixes or diagnostics on final pass |
| pnpm exec biome check research/demo-readiness | 0; 5 JavaScript modules, no fixes/diagnostics on final pass |
| pnpm typecheck | 0; includes successful pnpm build and workspace typechecks |
| pnpm test | 0; includes successful build; 153 PASS / 0 FAIL / 102 existing platform SKIP, 255 tests |
| node --test --test-reporter=spec research/demo-readiness/demo.test.mjs | 0; 50 PASS / 0 FAIL / 0 SKIP |
| node --check for each of the five .mjs files | 0 each |
| git diff --check | 0 |
| node research/demo-readiness/serve.mjs | Started at http://127.0.0.1:4171; browser and HTTP tests below |

Initial scoped Biome invocation failed on a missing `root:false` in the new local
configuration (exit 1). Corrected within this directory; final checks above pass.
Initial 49-case matrix passed; a stricter inconsistent-PASS guard added one case,
and the final 50-case matrix passed. No comparator/test expectation was weakened.

## Adversarial coverage

Executed parser/adapter tests reject malformed JSON, trailing input/commas, array
or null roots, duplicate/escaped duplicate keys, prototype keys, secret-like nested
fields, private-path fields, invalid UTF-8, unsafe/nonfinite numbers, oversized
files/strings and deep structures. Missing/duplicate/unknown/path-like selections,
changed head/source SHA, invented 15 API actions, forged model/negative-control
PASS, invented comparison counts, unknown statuses and missing fields fail closed.

Future declarations require exact expected head/source, candidate/run/provider/model
identities, positive requests, typed cost/nulls, known gate statuses, consistent
PASS, exact unique public comparison IDs and NOT_ESTABLISHED product. Even a
structurally complete declared PASS remains NOT_VERIFIED. Missing/null values are
not converted to zero. Synthetic future inputs exist only inside tests and are
never published as execution receipts.

Loopback HTTP tests execute real requests against an ephemeral local server and
verify exact receipt bytes, HEAD, CSP/nosniff/no CORS/no cookies and 404 on traversal,
encoded traversal, missing files, queries, arbitrary URLs, unlisted paths and POST.
Static checks cover no HTML injection/eval, external assets or automatic receipt
load. These are viewer checks, not Oracle acceptance.

## Browser observations (actual Chrome)

- Initial page: no receipt panels loaded.
- Explicit bundled load: PINNED_PUBLIC_SNAPSHOT, model requests 0 and candidate/cost
  null; G1/G2/G3 model NOT_RUN, replay G2/G3 PASS → FAIL → PASS; source 5/11 and
  831/439; exact source/execution/evidence identities; cleanup/finalizer 0/0/0.
- JSON inspection expands trial.json and switches to summary.json correctly.
- Missing-file recovery: temporarily renamed only this demo's trial.json within
  its evidence directory; another bundled load displayed
  NOT_VERIFIED / MISSING_OR_OVERSIZED_RECEIPT and removed both result panels.
  Restored exact file, independently checked its SHA-256 against the pin, reloaded
  successfully. No missing-file simulation is included in delivered evidence.
- Technical rehearsal (bundled load → missing-file failure → restored load),
  measured with Date.now across browser/tool actions: **47.089 seconds**. This
  includes automation/inspection overhead; it is not narration duration or load
  latency, and does not prove the 90-second talk was rehearsed aloud.
- Final reload/load and full-page screenshot inspected after code changes. Layout
  visually separates both tracks; the one-screen architecture is visible above.

**Browser local file-picker automation: NOT_RUN.** A filechooser was obtained and
multiple selection confirmed, but setFiles was blocked by Chrome extension's
disabled file-URL access. No extension/security settings were changed. Adapter
tests exercise the same local bytes; bundled browser loading is verified. Manual
steps are in RUNBOOK.md. Future preview UI via file picker is also NOT_RUN.

## Explicit remaining limits

Human timed 3–5-minute and 90-second narration: NOT_RUN. Full disconnected-laptop
rehearsal: NOT_RUN (the app uses only loopback, with no external assets; host
network was not disconnected). Mobile/responsive device automation: NOT_RUN.
New Docker/Oracle execution: NOT_RUN. Real model inference/spend/provider access:
NOT_RUN. Independent artifact-archive download/raw-pack verification: NOT_RUN.
Formal G0/G4 and product acceptance: NOT_ESTABLISHED. Independent ChatGPT review:
requested in PR, pending; no self-approval or merge.

The existing historical receipts are evidence for their original executed head.
They are not fresh observations of MMP-071, an AI-generated candidate or formal
G4. PR #31 AUDIT_FAIL and #61's unfinished generation remain unchanged.
