# Metamorph — three-track offline evidence desk (MMP-071 / MMP-085)

Read-only presentation for 2026-10-30. Refs [#85](https://github.com/Meta-Project2026/Metamorph/issues/85), [#71](https://github.com/Meta-Project2026/Metamorph/issues/71), [#61](https://github.com/Meta-Project2026/Metamorph/issues/61), [#81](https://github.com/Meta-Project2026/Metamorph/issues/81).

From the repository root, with Node 22.13+ / 24 and a modern browser:

```powershell
node research/demo-readiness/serve.mjs
```

Open [the local viewer](http://127.0.0.1:4171/) and click **Load pinned public receipts**.
Nine exact local receipts load all three tracks. Stop with Ctrl+C. Fixed allowlist,
loopback only (`127.0.0.1:4171`). No API key, Docker, PHP, pnpm install, GitHub,
Internet or candidate execution is needed to present. Direct file:// is unsupported.

- **A — historical admission-only:** MODEL_GENERATION_NOT_RUN, run 40793819074;
  zero generated requests, null candidate/cost. Historical, not current project state.
- **B — historical deterministic Docker replay:** DETERMINISTIC_REPLAY_NOT_AI;
  G2/G3 PASS → FAIL → PASS, 17 HTTP / 20 SQLite comparisons on each attempt.
  Scripted repair is not an AI result.
- **C — real AI trial — G1 build failure:** run 40900698372, 29 October 2026.
  Muse Spark 1.3 generated a candidate (generation PASS, one request/response).
  Docker typecheck G1 FAIL / BUILD_FAILED. G2/G3 INCONCLUSIVE: HTTP 0/17,
  SQLite 0/20, downstream comparisons unexecuted. Cleanup/finalizer 0/0/0.

C reports tokens 5818/9239, estimated USD **0.04653825**, charged USD **null**.
An estimate is not a settled charge. Original TypeScript diagnostics UNKNOWN;
MMP-082 synthetic TS2322 belongs to another candidate. G0/G4 INCONCLUSIVE,
product NOT_ESTABLISHED. Historical PR #31 AUDIT_FAIL is unchanged.

| C identity (different from viewer Git HEAD) | Exact value |
| --- | --- |
| Run / execution head | `40900698372` / `d21376747c7147043ca618e149fac87c0df80111` |
| Frozen PHP source | `d272170d0aecbd28eb5b13e272d9dd11d545b66c` |
| Generated candidate | `afd9f726bcbc2a9dfc2f67128871db307fbd00f2ba4febdc41b5633da98dad8f` |
| Original ZIP SHA-256 | `95121c3291e4478d682dfd3375de86e2df4036f46bcdc81826ee6fdc5fb2a493` |

Original GitHub-hosted public ZIP and four member sizes/digests independently
verified on 2026-10-29; byte-identical members under evidence/real-ai-40900698372/.
Original five historical receipts, pins.mjs, adapter.mjs and demo.test.mjs unchanged.
C pins/adapter remain a review candidate pending independent review.

Picker: one complete set of five historical files, four C files, or one
future-model.json declaration preview (always NOT_VERIFIED). Names overlap:
select from one folder at a time. Bundled tracks validate atomically; new selection
or error clears prior results. Byte identity is not independent executor attestation.

- [Russian runbook](RUNBOOK.md): 90-second / ~4-minute target pacing and fallbacks.
- [Provenance / trust policy](PROVENANCE.md): exact original identities and hashes.
- [Current validation](VALIDATION-085.md); [historical validation](VALIDATION.md).
- [Compact scope / plan / tasks](plan.md).

```powershell
node --test research/demo-readiness/demo.test.mjs
node --test research/demo-readiness/real-ai.test.mjs
pnpm exec biome check research/demo-readiness
```

Biome is an existing dev dependency, unnecessary for presentation. No dependency,
lockfile, workflow or Oracle changes. No external assets, telemetry, storage or
unsafe HTML. Original pre-event MMP-085 additions reuse MMP-071. Public receipts
retain provenance. No raw model response, candidate/PHP source or private Docker
packs were fetched. MIT notice remains at evidence/LICENSE.upstream, copyright
Tanjila Afsari Rubina. This does not claim hackathon-only authorship.
