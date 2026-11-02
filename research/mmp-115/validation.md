# MMP-115 validation and remaining gate

## Main synchronization — 2026-11-02

Current integration base: `8e857654a3aabbb16a2fec44b4fceab8d4209944`,
freshly fetched from canonical origin/main. Its post-merge Fast CI
[41365426071](https://github.com/Meta-Project2026/Metamorph/actions/runs/41365426071)
was independently read: Node22/24 SUCCESS. Previous published PR head:
`be94eeb9eb61d64cdba76ee6a5ec22044260ea45`. Original reviewed production
implementation: `9f5cbbeeda05d4997a269276cbb77e519af70742`.

Clean existing isolated checkout, branch `codex/mmp115-production-candidate-custody`.
Fast-forwarded to the published head, then performed an ordinary non-force merge of
origin/main. Merge commit `b756abed195d2ad6cddc8c174e9c1b27f6a4610c` has exactly
the previous published head and current main above as its two parents. No main,
teammate worktree, active feature pointer, or review decision was modified.

Only conflict: `research/mmp-069/coverage-matrix.json`, at the MMP115 row immediately
before MMP120. Removed conflict markers while retaining both rows. The resolved
matrix is byte-identical to the reviewer's previous PR-head matrix; every main
research row is unchanged, with only MMP115 added relative to main. Paths are sorted
and unique. Demo readiness, MMP107 and MMP108 remain registered. MMP115 remains ACTIVE /
MANUAL_DOCKER / GATED_HOSTED_SYNTAX / NOT_VERIFIED; MMP120 remains ACTIVE / LOCAL_ONLY /
GATED_HOSTED_SYNTAX / NOT_VERIFIED. Package tests are independently gated by pnpm test;
the research-local test inventory does not trace their imports. Validator unchanged.

Scoped `git diff --exit-code` checks exited 0:
- All production agent-real source, custody tests/helper, paid entrypoints, MMP089/097,
  manual age drivers, paid/Fast CI workflows, Oracle/target/differential and lockfile
  are byte-identical to original implementation head 9f5cbbee. This is an integration
  and documentation change, not new custody/runtime/crypto/workflow behavior.
- All Demo Track D files, MMP120 research and its package controls, and the coverage
  validator/negative controls are byte-identical to current main.
- Main is an ancestor of the integrated branch. No private packs, G4/reference
  fixtures, source/model/recipient pins, credentials, selector restrictions, budget
  default $0.10, or G0–G4 semantics were changed by synchronization.

## Integration checks actually executed

Windows Node 24.21.0 / pnpm 11.25.0. Initial full local run on merge commit b756abe:

| Command                                                                     | Exit | Actual result                                                 |
| --------------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                            | 0    | Frozen install                                                |
| `pnpm lint`                                                                 | 0    | PASS                                                          |
| `pnpm typecheck`                                                            | 0    | PASS                                                          |
| `pnpm test`                                                                 | 0    | 782 total / 672 PASS / 110 platform/environment SKIP / 0 FAIL |
| `pnpm build`                                                                | 0    | PASS                                                          |
| `node research/mmp-069/validate.mjs`                                        | 0    | VALID; 95 inventoried research modules                        |
| `node --test research/mmp-069/validate.test.mjs`                            | 0    | 45 PASS / 0 FAIL                                              |
| `node research/mmp-069/check-syntax.mjs`                                    | 0    | 94 files syntax PASS; no module execution                     |
| `node --test packages/agent-real/test/custody.test.mjs`                     | 0    | 25 total / 19 PASS / 6 Linux-only SKIP / 0 FAIL               |
| `node --test packages/agent-real/test/mmp120-generation-readiness.test.mjs` | 0    | 22 PASS / 0 FAIL                                              |
| `node --test research/demo-readiness/*.test.mjs`                            | 0    | 134 PASS / 0 FAIL                                             |
| `git diff --check` and scoped comparisons                                   | 0    | No whitespace errors or protected-content drift               |

Final published-head rerun results, exact SHA, Fast CI Node22/24 run/job links and
independent review request are recorded in the [PR #117 conversation](https://github.com/Meta-Project2026/Metamorph/pull/117).
Historical CI on 9f5cbbee or the matrix-only be94eeb cannot certify a new head.

## Archived real Linux/age evidence — not repeated by this merge

Original implementation baseline:
`d87a7029abf23c3d222bc309741d9185e502313e`.
[Original exact-head Fast CI 41361406599](https://github.com/Meta-Project2026/Metamorph/actions/runs/41361406599)
on 9f5cbbee: Node22 job125012358600 and Node24 job125012358565 each
760 total / 757 PASS / 3 existing SKIP / 0 FAIL; all 25 custody controls PASS.
These are historical counts, not the integrated head's counts.

[Safe machine-generated final age receipt on 9f5cbbee](https://github.com/Meta-Project2026/Metamorph/pull/117#issuecomment-6565667206):
actual Linux Node24.22.2 / Docker, pinned age v1.3.2, command exit 0, **3/3 PASS**.
The earlier receipt on `afe7d594b72180e24095da41630b5f68fc6539b4` is versioned
under `research/mmp-115/evidence`; it does not attest later code.

Commands actually used for that archived acceptance:
`docker build -t mmp115-offline-harness research/mmp-108/harness`, exit 0;
`./research/mmp-115/Invoke-OfflineAge.ps1 -ScratchRoot <private scratch>`, exit 0.
The manual Docker/age exercise was **NOT_RUN during this synchronization**, as
permitted by the task only because the strict comparisons above prove all relevant
runtime, crypto, workflow and manual driver bytes unchanged. No new key or upload.

| Archived actual case                                                            | Observed result                                                                                                                         |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Qualified age/keygen, ephemeral TEST-key encrypt/decrypt and executable restore | Exact original files/manifest/candidate digest MATCH; wrong key/truncation rejected; default fixed-recipient mode refuses TEST identity |
| Actual production admission/lease/collector/spool                               | PASS with locally intercepted HTTPS and pinned public known-good TS fixture, not AI generation; fixed production public recipient       |
| Actual PRE_ORACLE and unchanged original POST_ORACLE finalizers                 | Each 0 containers / 0 volumes / 0 emergency removals                                                                                    |
| Locally simulated transport and later validator setup ERROR                     | Stored record/ciphertext unchanged; Oracle candidate execution NOT_RUN                                                                  |
| Actual encryptor crash/cancel/30-second deadline                                | Rejected; no remaining owned resources                                                                                                  |
| Deliberately created owned resource, emergency removal                          | One removal; checkpoint BLOCKED, then zero resources                                                                                    |

Outer trusted harness container and its three volumes were removed separately using
per-run owner labels. No candidate/reference code executed on the host or harness.
Production-public-recipient capture and TEST-key restore are separate observations;
the owner's actual private identity was never accessed. The function-only testRecipient
seam does not exist in the production restore CLI. Two early restore runs failed strict
tool ownership; creating a fresh owned inode from verified release bytes fixed the
fixture without weakening the guard. The initial draft CI inventory failure was fixed
by adding the actual manual module, without weakening the validator.

## Separate MMP122 transport evidence and remaining decision

[Owner/reviewer record](https://github.com/Meta-Project2026/Metamorph/issues/122#issuecomment-6566123432):
the one authorized synthetic-only upload is **consumed**.
[Run 41366708136](https://github.com/Meta-Project2026/Metamorph/actions/runs/41366708136),
test head `f861be5bb0c33f90e9424064da3bcef528a17d55`, artifact 13107357937.
Its job125028273477 was independently read during this synchronization: actual upload
and artifact-ID-specific download SUCCESS, final metadata/readback verifier FAILURE,
overall workflow FAILURE. The reviewer independently retrieved the existing ZIP and
reported exact hash/bytes and single candidate.age identity PASS.

Archive SHA256: `c600b14edbddb2e871f6dab88aa0d50d1fc9383e61d17ce50b4cf7f7b240c021`,
407 ZIP bytes; sole candidate.age: 267 bytes, SHA256
`e1d7491b1045e8163497d3ec0ed90aceafbc5780c61f26574af6a1208365e022`.
Final test expected an incorrect sha256: prefix on the upload action's bare 64-hex
artifact-digest output; REST artifact.digest does include that prefix. Production
custody-checkpoint.mjs already checks these two representations separately and is
unchanged. No transport test workflow was copied into main or this PR; no rerun,
new upload, dispatch or new authorization was performed.

**Synthetic service transport capability / byte identity: PASS by separate reviewer
evidence. Dedicated MMP122 workflow overall: FAILURE. Full production paid-workflow
custody pipeline: NOT_RUN.** This evidence cannot establish production durability,
owner-key possession/restore, product PASS, G4 PASS or paid readiness.

The [previous independent review](https://github.com/Meta-Project2026/Metamorph/pull/117#pullrequestreview-5730946946)
was OFFLINE_SCOPED_GO / MERGE_HOLD / PAID_NO_GO. Synchronization and fresh exact-head
CI are submitted for a **new independent exact-SHA security review**, not self-approval.
#115 stays OPEN; #116 stays HOLD. Owner decides any further production validation and
merge. No model/Meta request, paid workflow/validate_only/rerun, additional artifact
upload, owner private-key access or new paid authorization proposal occurred here.
End-to-end production/paid readiness remains **NO_GO** pending independent acceptance
and any separately authorized operational proof the owner requires.

Residual boundaries: response-to-ack loss window; publicly downloadable seven-day
ciphertext and irrevocable copies; trusted dedicated host/UID/root/Docker/workflow/
action/service authority; JS strings are not securely erased; unknown/encoded credential
echo is not proven absent. Historical candidate UNAVAILABLE, cause UNKNOWN;
#61 PRODUCT_NOT_ESTABLISHED.
