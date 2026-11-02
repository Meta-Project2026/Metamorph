# MMP-120 — independent generation-readiness audit (offline)

Refs [#120](https://github.com/Meta-Project2026/Metamorph/issues/120), #61, #116, #104.
Base: `main@b0574626c7c75469e17b7169438e9ae4369d0531`. Everything here is
offline research: no Meta request, no `workflow_dispatch`, no credential, no
Docker, no candidate execution, no production runtime change.

| Artifact | Content |
| --- | --- |
| [audit.mjs](audit.mjs) | CLI importing the pure production serializers (`bindMigrationContext`, `prepareMetaMigration`, `paidProjection`); emits the public-safe snapshot (20 invariants, projection, budget, blockers) or the prompt-variant report. Exit 0 = audit completed (`readiness` is deliberately NO_GO, never a dispatch permission); exit 1 = broken check; exit 2 = misuse. |
| [source-to-prompt-audit.md](source-to-prompt-audit.md) | Full map of the 11 functions / 5 actions the model receives, the public G1/G2/G3 comparison mechanics, and the PHP-runtime knowledge gaps ranked P0/P1 per gate. |
| [prompt-proposals.md](prompt-proposals.md) | At most two bounded, source-grounded prompt proposals with offline-computed bytes/SHA/projection and the budget comparison; research-only. |
| [TRIAGE.md](TRIAGE.md) | Post-run triage runbook for the next authorized paid experiment: observation → allowed/owner-gated/forbidden actions, allowlisted receipt fields only. |
| [VALIDATION.md](VALIDATION.md) | Exact executed commands, exit codes, test counts, hashes and remaining uncertainties. |

Run (after `pnpm install --frozen-lockfile && pnpm build`):

```sh
node research/mmp-120/audit.mjs            # baseline snapshot (readiness NO_GO)
node research/mmp-120/audit.mjs variants   # proposal A/B byte/SHA/projection report
node --test packages/agent-real/test/mmp120-generation-readiness.test.mjs
```

Fast CI reach: the negative controls run through the agent-real test glob in
`pnpm test` (Node 22/24); the research scripts get syntax-only coverage from
`node research/mmp-069/check-syntax.mjs`. Registering `research/mmp-120` in
`research/mmp-069/coverage-matrix.json` is deliberately **deferred to the
post-#117 rebase** (that file is part of the open custody PR's diff); until
then the unregistered directory trips `RESEARCH_INVENTORY_DRIFT`, which fails
the `Active research syntax` step and skips the seven downstream research
steps in each Node leg — one documented root cause, details and the completing
one-entry fix in [VALIDATION.md](VALIDATION.md).
