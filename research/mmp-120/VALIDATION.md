# MMP-120 — validation record

Refs [#120](https://github.com/Meta-Project2026/Metamorph/issues/120), #61, #116.
Executor: GLM 5.3 (agent session), 2026-11-02, Windows 10.0.26300 x64, Git Bash,
Node v22.23.1, pnpm 11.25.0. Branch `glm/mmp120-generation-readiness` cut from
`main@b0574626c7c75469e17b7169438e9ae4369d0531` (the exact delegation point; re-fetched
before start). PR #117 (custody, Ilia) was OPEN/draft at
`9f5cbbeeda05d4997a269276cbb77e519af70742` when this work started; none of its files
were touched. Every value below is from an actually executed command; unexecuted
items are marked NOT_RUN.

## Executed checks

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | "Already up to date", 11 workspace projects |
| `pnpm build` | 0 | all packages built (incl. `packages/oracle/dist`) |
| `node --no-warnings research/mmp-120/audit.mjs` | 0 | snapshot completed; `readiness: NO_GO` recorded; all 20 invariants PASS; evidence copy at [evidence/audit-b057462.json](evidence/audit-b057462.json) |
| `node --no-warnings research/mmp-120/audit.mjs variants` | 0 | proposal A: 23,293 bytes, `500b34dc…`, $0.227057; proposal B: 23,096 bytes, `dd28517a…`, $0.226072; baseline 22,762 bytes, `55c7b844…`, $0.224402; evidence copy at [evidence/variants-b057462.json](evidence/variants-b057462.json) |
| `node --test packages/agent-real/test/mmp120-generation-readiness.test.mjs` | 0 | **22/22 pass, 0 fail** (negative controls on the real serialization, network canary active) |
| `pnpm lint` | 0 | biome check . — 293 files, no errors (1 import-order auto-fix applied to the new test file) |
| `pnpm typecheck` | 0 | build + `tsc --noEmit` across all packages |
| `pnpm test` | 0 | **757 tests: 653 pass, 0 fail, 104 skipped** (pre-existing Windows-host skips); includes the 22 new controls |
| `node --check research/mmp-120/audit.mjs` | 0 | syntax PASS (direct check, independent of the validator below) |
| `node --check packages/agent-real/test/mmp120-generation-readiness.test.mjs` | 0 | syntax PASS |
| `node research/mmp-069/validate.mjs` | 1 | `{"status":"INVALID","code":"RESEARCH_INVENTORY_DRIFT"}` — expected, see integration gate |
| `node research/mmp-069/check-syntax.mjs` | 1 | same drift thrown at module load (`check-syntax` imports `validate()` before checking any file) — same single root cause |
| `node --test research/mmp-069/validate.test.mjs` | 1 | 45 tests: 43 pass, 2 fail — only the two "clean copy validates" assertions (`clean actual repository…`, `new demo test…`); all 43 mutation controls still pass because they assert nonzero exit |

## Recomputed baseline (not assumed from prior cards)

At `inspectedHead = b0574626c7c75469e17b7169438e9ae4369d0531`, using the real
production serializers: body **22,762 bytes**, SHA-256
`55c7b8442814b6dfb3a273d45063553ea00e4466046945fd72fd7ea2f38d5d5d`;
`contextSha256 21415d8b4ea38ad0bfcab92c3632777e30e36a8e3c74b17d95ec9abef8a5c345`
(matches the MMP-104 incident receipt's context hash);
manifest `d800a9a5…`; projection 123,816 input + 16,384 output tokens →
worst-case **$0.224402** at the locked `meta-standard-2026-10-29` snapshot
(expires 2026-11-05T00:00:00Z); workflow default **$0.10 blocks**. These equal
the prior MMP-107 values at this main, so no baseline drift occurred between
that card and this branch. Tariff/liveness versus the provider: NOT_RUN (no
Meta GET was made).

## Recomputed proposals (offline, research-only)

| Variant | Bytes | SHA-256 | Projection | Δ vs baseline |
| --- | --- | --- | --- | --- |
| Baseline | 22,762 | `55c7b844…` | $0.224402 | — |
| A `instructions` +531 B | 23,293 | `500b34dcb6ba931f8195789533baa9e3879f9e04dd17e678b2a552d1d0256fd5` | $0.227057 | +$0.002655 |
| B developer +334 B | 23,096 | `dd28517aaec4f1b38b3f5b41bc327de51b663b123340eb67432af48837d3c08a` | $0.226072 | +$0.001670 |

Method: `rebuildWireBody` first asserts byte-identical zero-mutation
reconstruction of the production envelope (and of the nested prompt payload),
then applies exactly one field mutation — so deltas are attributable to the
mutation alone. The negative tests assert the identity, the field isolation,
and that both variants stay within every policy bound. All three remain
blocked by the $0.10 default admission.

## Coverage-matrix integration — independently corrected after GLM delivery

Original GLM branch head `b02ae012817aaa0f21ca4eaaf23c26c4376a91c6` was **NOT mergeable on CI**: `research/mmp-120/audit.mjs` was absent from `research/mmp-069/coverage-matrix.json`; Fast CI Node 22/24 failed at `Active research syntax` (`RESEARCH_INVENTORY_DRIFT`) and skipped seven subsequent steps. The pre-fix CI #41364434851 and the test counts above remain historical evidence and must not be described as green.

Independent ChatGPT review verified the validator's source behavior and added the missing `research/mmp-120` registration directly on this PR branch, rather than waiting for PR #117. **Important correction to the GLM-proposed entry:** `tests: "NOT_VERIFIED"`, not `GATED_HOSTED`. The validator determines research test coverage only from `research/mmp-120/*.test.mjs`; the 22 actual executed controls reside under `packages/agent-real/test/mmp120-generation-readiness.test.mjs` and are **independently covered by root pnpm test**, not counted as research-local suite coverage. Setting `GATED_HOSTED` without a research-local test is rejected as `RESEARCH_TEST_CLAIM`. The syntax check for `audit.mjs` is gated regardless.

The `audit.mjs` informational blocker was updated to avoid falsely claiming the registration remains deferred. `research/mmp-120/evidence/audit-b057462.json` is retained as an **earlier execution snapshot at delegation base**; it includes the original pre-fix informational blocker, and is not a live snapshot of this review commit. Re-run the CLI for current readings. No production prompt or budget was changed.

A concurrently open PR #117 also edits the shared matrix. Before merging #117, rebase it onto the new `main`, preserving **both** its MMP-115 entry and this MMP-120 entry; run exact-head Fast CI again. Changes to PR #117 remain Ilya's responsibility and are not modified by this research PR.

## Not established / uncertainties

- **`PROMPT_QUALITY_NOT_EMPIRICALLY_ESTABLISHED`** — no new model request was
  made, authorized or attempted; proposal mechanisms are arguments, not
  measurements.
- Historical root causes (2026-10-29 G1 FAIL; 2026-11-01 G2/G3 ERROR)
  remain UNKNOWN; this audit makes no retro-diagnosis.
- Live tariff verification, charged-cost settlement, G0, formal held-out G4,
  product acceptance: NOT_RUN / NOT_ESTABLISHED.
- CI on original GLM head: red due solely to missing research inventory; current review head requires its own hosted Node 22/24 result. Do not promote the earlier failure to PASS.
- The 22-test pin `Buffer.byteLength(body) > 18000` plus the snapshot equality
  check will consciously trip on any future legitimate prompt change — that is
  the intended audit tripwire; update together with the body SHA at rebase.
