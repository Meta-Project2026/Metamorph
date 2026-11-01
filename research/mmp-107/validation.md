# MMP-107 validation

Research baseline: main `c3f697b4fcbd5ca9162ff47e0659659e07a1defc`.
Baseline push Fast CI [41352743651](https://github.com/Meta-Project2026/Metamorph/actions/runs/41352743651)
independently read as completed/success at that exact head. Research PR/head CI is
reported in the PR conversation, avoiding a self-referential commit hash in this file.

Local environment: Windows, Node v24.21.0, pnpm 11.25.0, dedicated
`codex/mmp107-candidate-custody-design` worktree. No shared feature pointer changed.

| Executed command                                                                                                                          | Observed result                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| pnpm install --frozen-lockfile                                                                                                            | exit 0                                                                              |
| pnpm lint                                                                                                                                 | exit 0                                                                              |
| pnpm typecheck                                                                                                                            | exit 0                                                                              |
| pnpm test                                                                                                                                 | exit 0: 735 tests, 631 PASS, 104 existing Windows/environment skips, 0 FAIL         |
| pnpm build                                                                                                                                | exit 0                                                                              |
| node --test packages/agent-real/test/candidate-custody-research.test.mjs                                                                  | exit 0: 31 PASS, 0 FAIL, 0 SKIP                                                     |
| pnpm exec biome check research/mmp-107 packages/agent-real/test/candidate-custody-research.test.mjs research/mmp-069/coverage-matrix.json | exit 0 after formatting                                                             |
| node research/mmp-107/preflight.mjs                                                                                                       | exit 0: NO_GO, current .224402 estimate, recorded 6/17/20 controls checked          |
| node research/mmp-069/validate.mjs                                                                                                        | exit 0 VALID; new research directory inventoried; existing fast test bridge reached |

Additional executed checks: `node --test research/mmp-069/validate.test.mjs` exit 0
(45 PASS, 0 FAIL/SKIP); `node research/mmp-069/check-syntax.mjs` exit 0 (88 active
modules checked, syntax only); `git diff --check` and exact-base production/workflow/
existing-retention-test comparisons exit 0. Dedicated test directories are checked
against their resolved temporary parent/name before recursive removal.

Earlier preflight smoke invocation failed module resolution for a root-level workspace
alias (ERR_MODULE_NOT_FOUND). Corrected the research-only import to the built Oracle
module; the same CLI then passed. No production dependency/export change was needed.

The 31 controls cover test-key X25519/HKDF/AES-GCM round trip and exact file digests;
missing/mismatched six-field identities; altered bytes; path/scope/license/duplicates;
per-file/aggregate/envelope/cipher limits; hostile accessors/proxies; actual hard links,
directory junctions/symlinks and linked root; read-time mutation; immutable snapshot;
missing/swapped recipient; encryption failure and buffer clearing; truncation/tampering/
wrong private key; bogus finalizer and cleanup/emergency failures; upload failure;
cancellation/deadline/crash-seal and ignored late result; exact public allowlist/canaries;
offline no-fetch preflight and nine receipt corruption cases. No candidate TS is executed.

Only an isolated package test bridge and research inventory are outside research/mmp-107.
The bridge imports original inert test code, not production code. The offline preflight
separately imports existing pure production serializers; production imports no research.
Existing candidate-retention/private-diagnostics/source/admission/Oracle/report/workflow
files and existing tests remain unchanged. Their applicable existing controls run in pnpm test;
Linux-only preservation paths are unexecuted locally and require hosted Node22/24 evidence.
Static research inventory does not trace bridge imports, so its tests field conservatively
says NOT_VERIFIED; execution counts here and in CI are the separate behavioral evidence.

NOT_RUN: model/Meta GET/POST, dispatch/rerun/validate_only, real candidate, owner private
identity, real age interoperability/restore, new Docker, real capture disk commit or
crash recovery, live upload/checkpoint, formal held-out G4, human 90s/4min rehearsal.
Mock finalizer/upload do not establish real cleanup/durability. JS strings are not
securely erased. The inert crypto format is not production age or a security certification.

Production implementation: NOT_RUN, DECISION_PENDING. Independent exact-SHA research PR
review: pending handoff; production security review: NOT_RUN. Current result is a reviewable
research slice and NO_GO preflight, not production readiness. PRODUCT_NOT_ESTABLISHED.
