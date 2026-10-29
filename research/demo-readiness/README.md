# MMP-071 — independent public evidence desk

Read-only presentation for 2026-10-30. Refs [#71](https://github.com/Meta-Project2026/Metamorph/issues/71).
No dependencies for running the viewer beyond Node 22.13+ / 24 and a modern browser.
No API key, Docker, PHP, pnpm install, network access or candidate execution is needed.

From the repository root:

```powershell
node research/demo-readiness/serve.mjs
```

Open [the local viewer](http://127.0.0.1:4171/) and click **Load pinned public receipts**.
Stop the server with Ctrl+C. The server binds only to `127.0.0.1:4171` and serves a
fixed allowlist. A direct `file://` opening is unsupported because the viewer uses ES modules.

- [Operator runbook and narration](RUNBOOK.md): 3–5 minutes and 90 seconds, factual fallbacks.
- [Receipt provenance and future ingestion](PROVENANCE.md): source paths, identities and trust limits.
- [Scope, plan and tasks](plan.md): independent implementation boundaries.
- [Executed validation](VALIDATION.md): local checks and remaining NOT_RUN items.

```powershell
node --test research/demo-readiness/demo.test.mjs
pnpm exec biome check research/demo-readiness
```

The second command uses the repository's existing development dependency; installing
it is unnecessary for the presentation. No workflow or lockfile was changed.

## What the screen establishes

`PINNED_PUBLIC_SNAPSHOT` means exact bytes match the public receipts pinned in
`pins.mjs`. The hosted run was checked through GitHub's API during preparation.
This viewer does not rerun Docker or authenticate arbitrary user-authored JSON.

Track A is `MODEL_GENERATION_NOT_RUN`: producer label `AI_GENERATION_NOT_RUN`, zero
generated requests, null candidate/cost, and model G1/G2/G3/cleanup NOT_RUN.
Track B is `DETERMINISTIC_REPLAY_NOT_AI`: historical real Docker known-good,
deliberate mutation, scripted repair and six runtime controls. G0/G4 stay
INCONCLUSIVE and product stays NOT_ESTABLISHED. Scripted replay provider calls in
Track B are not generated model requests in Track A.

The header architecture is a conceptual flow with admission and deterministic
substitution explicitly marked. There is no current end-to-end AI-generated
path across all five boxes. Original PR #31 AUDIT_FAIL remains unchanged.

All new application code is original MMP-071 work. Public receipts/inventory are
copied unchanged from PR #70 at a pinned commit, with their exact byte identities.
No PHP source, candidate, benchmark test data or raw private evidence is copied.
The upstream MIT notice is retained at `evidence/LICENSE.upstream`; its copyright
remains with Tanjila Afsari Rubina. This is pre-event preparation, not an assertion
that all underlying code was authored during the hackathon.
