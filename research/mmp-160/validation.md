# MMP-160 validation — 2026-11-04

Checkout: dedicated `Vladimir/mmp160-first-pass-ts2769-discipline` worktree,
base `a5bcf5968b05f77da6c8d755e4b99a1614fd1a58`. Local Windows,
Node `v22.23.1`, pnpm `11.25.0`. Final pushed HEAD and hosted Node 22/24 results
belong in the Draft PR so this document needs no self-referential commit pin.

| Command | Exit | Observed result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | Existing lockfile accepted; no dependency/lockfile changes |
| `pnpm lint` | 0 | Four existing warnings and two informational findings in unchanged custody/live-experiment files; no errors |
| `pnpm typecheck` | 0 | Workspace build plus recursive typecheck |
| `pnpm test` | 0 | 924 tests: 811 pass, 113 platform skips, zero fail |
| `pnpm build` | 0 | All workspace packages built |
| `node --test packages/agent-real/test/first-pass-compiler.test.mjs` | 0 | Four new offline tests pass |
| Focused command below | 0 | 132 tests: 131 pass, one platform skip, zero fail |
| `pnpm --filter @metamorph/target-worker test` | 0 | 69 tests pass, zero skip/fail |
| `node research/mmp-120/audit.mjs` | 0 | 20 invariants PASS; current 25,625-byte body and SHA match; deliberately NO_GO, no admission |
| `node research/mmp-123/prompt-sha.mjs` | 0 | Existing read-only prompt/material hash utility completes; not a production-context equality or model acceptance claim |
| `git diff --check` | 0 | No whitespace errors |

Focused command (each file is explicit, no workflow or provider execution):

```powershell
node --test packages/agent-real/test/first-pass-compiler.test.mjs packages/agent-real/test/meta-migration.test.mjs packages/agent-real/test/meta-paid.test.mjs packages/agent-real/test/migration-preflight.test.mjs packages/agent-real/test/mmp120-generation-readiness.test.mjs packages/agent-real/test/g1-qualification.test.mjs packages/agent-real/test/g1-stress.test.mjs packages/agent-real/test/repair-vertical.test.mjs
```

The audit's old informational blocker labels (including MMP-116/117 and an old
expiry in a label) are historical research metadata, not a current governance
assessment. This task uses its production-derived identities/projection and
executed invariants only. The actual imported tariff expires 2026-11-10 UTC;
live billing/tariff verification remains required for any future paid experiment.
No historical audit JSON or paid receipt is rewritten.

Root tests include source/injection boundaries, prompt/JSON contract coverage,
current offline custody preflight pins and existing authorization/repair
controls. Windows skips do not claim Linux execution; hosted Fast CI must pass
on the final pushed HEAD. The inert output used in the new wire test is
hand-authored synthetic data and is never compiled or executed.

**NOT_RUN:** real model generation, provider probe, paid/validate-only workflow
dispatch, candidate Docker G1/G2/G3, private Oracle, age decryption/private
diagnostics upload, formal G4 and product acceptance. No paid request was made.
Status remains **MODEL_NOT_TESTED_AFTER_CHANGE**, product **NOT_ESTABLISHED**.
Independent review/merge and any future owner-authorized experiment remain
separate from this implementation and its local checks.
