# MMP-151 — Real-model autonomous PHP→TypeScript repair via public Oracle

**Executor model:** **sol 6.1**, **effort: xhigh** (Codex/Antigravity equivalent supporting this model).  
**Repository:** `Meta-Project2026/Metamorph`. **Tracking:** [Issue #151](https://github.com/Meta-Project2026/Metamorph/issues/151), product [#61](https://github.com/Meta-Project2026/Metamorph/issues/61), derivative [#146](https://github.com/Meta-Project2026/Metamorph/issues/146).  
**Reviewed base:** `main@f68b75ec0005cb76059f41218452ff57f47d50d6`; check remote `main` again before creating an implementation branch.  
**Priority:** P0 — implement minimal end-to-end vertical slice and self-contained tests; do not redesign the project.

## User mandate and exact authorization boundary

Owner explicitly authorized **one next paid Metamorph experiment with a total USD $1 limit** (2026-11-03). This authorization is **not** a standing token for repeated calls, provider exploration, HTTP GET, speculative retries, G4, or overriding safety checks. A single workflow run may require *up to two model requests* (generation and one repair), but **total monetary liability** must respect the owner's $1 condition. The existing production policy explicitly says `NO_PROVIDER_HARD_CAP`; `max_estimated_usd=1.00` is a **pre-send projection, not an enforceable dollar cap**. **Do not dispatch a paid call on the mere assumption that an estimate is a hard cap.** If a real provider-enforced cap cannot be established, implement offline and mark dispatch **BLOCKED_BUDGET_GUARANTEE**, then request an exact owner decision on estimated-only exposure after review.

**During your execution: NO Meta GET/POST, no live model inference using credentials, no GitHub workflow dispatch (including `validate_only`), no paid charges, no hidden G4, no staging private candidates on GitHub.** Implementation and synthetic tests only. Keep current public verifier unchanged.

## Ground truth; read actual code first

Read `AGENTS.md`, root draft constitution, `README.md`, issue #151 and these exact files in current main:

- `packages/agent-real/src/migration-trial.mjs`: `runPublicMigration` performs one Meta generation; `validateGeneratedMigration` independently validates in a credential-free process. There is no production repair loop.
- `packages/agent-real/src/meta-migration.mjs`: `META_MIGRATION_POLICY.maxRequests=1`, `maxRepairs=0`, strict Meta wire, signed provider, source-only structured output.
- `packages/agent-real/src/meta-paid-authorization.mjs`: OIDC identity, one-use attempt ledger, body hash, tariff snapshot, `paidProjection`, `NO_PROVIDER_HARD_CAP`.
- `packages/agent-real/src/migration-context.mjs`: already supports `{action:'repair',attempt:2,repairFeedback:'ALLOWLISTED_CODES'}` and the previous model's own changes; permits only safe code tokens, not raw Oracle diffs.
- `packages/agent-real/src/runtime.mjs`, `report.mjs`, `source.mjs`, `candidate-retention.mjs`; `packages/target-worker/src/admission.mjs`; `packages/oracle/src/reference/manifest.ts`.
- `.github/workflows/meta-paid-migration.yml`, `research/mmp-078/paid-run.mjs`, `research/mmp-078/validate-candidate.mjs`, `packages/agent-real/src/custody-steps.mjs`; tests for paid admission, real agent, model transport, custody and cancellation.

As of reviewed code, the frozen public benchmark includes **3 scenarios, G1 6 build checks, G2 17 HTTP steps, G3 20 SQLite states**. The `G4.executed=27` metadata refers to **public positive/mutant controls**, not hidden G4. Formal G4 stays `INCONCLUSIVE`.

Historical paid original candidate `6140dbed4afb0d2068db17facb0e14ff9c2ffb61aaaf2b64207b9a8aa2125d38` failed G2/G3 (`HTTP_JSON_TYPE`). Owner-local derivative `b5322f21b1cc3b2df34ecffada8a599f6537f2417136a548207e2b08eb620a67` passed G1/G2/G3 **after two manual code edits**. Neither candidate is a permitted repair template, training hint, fixture substitution, or guarantee of autonomously passing. Do not alter old provenance.

## Target implementation — shortest trustworthy path

1. **Plan the trust-boundary sequence first**, in `research/mmp-151/design.md` (concise): signed admission -> paid generation (one POST) -> full candidate-only age custody/verified artifact readback -> **separate credential-free Docker Oracle** -> allowlisted public feedback -> *conditional* signed paid repair (at most one POST, no retry) -> independent custody of new SHA -> credential-free second Oracle -> independent cleanup -> sanitized outcome. Stop on any incomplete custody, unverified response, missing feedback, unknown liability, timeout or cleanup failure. Preserve current single-call workflow path unless new opt-in mode is chosen.
2. **Reuse production components**. Do not fake `runAgent` budget support: current paid provider has `maxRequestCostUsd=null` and Agent's guaranteed-bound path intentionally refuses it. Either implement a tightly scoped paid workflow driver with explicit local state transitions or introduce a separately reviewed production-safe adapter, without weakening the shared contracts or changing Oracle results.
3. **Exactly at most 2 paid POSTs total across process restarts.** Each step requires a unique durable, single-use nonce/capability, request-body SHA, immutable source/prompt SHA and signed hosted `main` identity. Never silently resend after timeout, transport ambiguity, HTTP error, malformed usage, cancelled step, late result, or crash. Concurrency/re-run with same runId must refuse dispatch. Do not loosen OIDC, protected branch, actor authorization, exact main SHA, credential isolation or secret handling.
4. **Budget policy: aggregate <= $1, not $1 per request.** Implement monotonic reservation of worst-case cost for **both** sends using pre-serialized bounded request sizes and output token ceilings; no releasing reservations merely because provider estimated smaller usage; no automatic escalation. Keep explicit `estimatedCostUsd` vs `chargedCostUsd=null` vs pending exposure separate. Current `PAID_POLICY.tariffExpires=2026-11-05T00:00:00Z`; if expired, STOP and demand independent tariff update, no hand-waved price renewal. Critically, a conservative tariff projection is not necessarily a provider hard cap. If no enforceable financial cap, `BLOCKED_BUDGET_GUARANTEE` before any billable dispatch. Implement offline tests proving no bypass from YAML choice/env/CLI arguments.
5. **Preserve original generated candidate.** Real model output written only via restricted `CandidateWriter`, SHA-verified. No host execution of generated source. Each independent Oracle attempt must run in the existing restricted network-off Docker workers, outside the secret-bearing process; all private candidate/HTTP/SQLite evidence outside repository and artifacts; only approved ciphertext + safe allowlisted metadata can be published, with independent acknowledgement before Oracle. A candidate must never be replaced in place by a manual patch.
6. **Feedback**: derive only from the existing full public verifier's fixed finding codes after a genuine fail; no extra detail from private diffs, route expected outputs, SQL, G4, raw traces or hand-authored hints. First candidate is model-generated; second request uses `action=repair,attempt=2`, the *first model's own full changes* and an allowlisted string of failure codes <=512 bytes. This is an actual model POST, not a deterministic postprocessor, scripted repair, replay, or the MMP-146 fix.
7. **Second Oracle**: independent fresh workers/DBs and sealed evidence, same frozen PHP runtime, manifest, strict HTTP JSON types, and exact DB snapshots. Preserve original candidate hash and separate repaired candidate hash; report 0/1/2 model requests and 0/1/2 completed Oracle verifications faithfully; never report PASS with missing coverage. Preserve `G0/G4` and `product=NOT_ESTABLISHED`, even when public G1/G2/G3 PASS.
8. **Robust synthetic controls**: a credential-free realistic FAIL `HTTP_JSON_TYPE` -> allowlisted feedback -> model-like synthetic repair -> PASS over real public Docker Oracle, plus missing-feedback, G1 fail, unknown usage, unknown or exhausted cost, first attempt success (no second POST), late response, crash-after-send, double dispatch/rerun, strict failure cleanup, wrong SHA, corrupted ciphertext and failed custody acknowledgment. Avoid relying on a fixture designed to match the manual paid derivative; use isolated synthetic source and clearly label `SYNTHETIC` outcome.
9. **Mode/default**: current one-POST workflow stays default/fail-closed; optional `autonomous_repair` selection requires explicit exact-SHA owner approval and independent security review. No gradual rollout, no provider/model fallback, no hidden tests, no arbitrary price source.

## Acceptance criteria / tests

- Main existing `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` still pass, with actual exits captured. Run focused tests and a credentials-free Docker smoke test if available, using only safe public/synthetic material.
- Full mock transport trace proves **maximum 2 requests, maximum one repair, no third send**, protected identity, cost reservations, and exact pass/fail transitions with no trial conflation.
- Positive case: genuine public verification of generated TS after repair, 17/17 HTTP + 20/20 DB, cleanup `VERIFIED_ZERO_RESOURCES`; no public result fabricated.
- Negative cases do not claim successful migration and consume/retain send liability conservatively on ambiguity.
- Dedicated privacy tests: no provider secrets, source text, path-sensitive diagnostics, raw HTTP/DB or decrypted candidate in public logs/GitHub/cost ledger.
- Pin actual model: Meta `muse-spark-1.3` Standard, no alternative billed endpoint without new authorization. Implementation executor is **sol 6.1 / effort xhigh**; this is not the provider being billed.
- Every receipt distinguishes *new model generation*, *new model repair*, *historical paid original*, and *manual derivative*. Do **not** relabel the original paid failure as PASS.
- No production dispatch until the code is independently reviewed, branch merged deliberately to protected main, current tariff/pricing and exact request body checked, signed custody chain complete, and the $1 financial cap ambiguity resolved explicitly.

## Output and GitHub handoff (mandatory)

1. Create a **fresh implementation branch** from current `main`, not the protected historical owner-only WSL checkout. Do not edit a shared local worktree or rewrite `main`.
2. Implement the **smallest vertical slice**. Avoid redesigning shared Oracle/contract/schema. If touching cross-team owned Oracle/schema/API is unavoidable, mark `DECISION_GATE_ILIA` and stop before merging.
3. Write `research/mmp-151/RESULTS.md` including: new exact commit, changed files, state machine diagram, all tests and exit codes, simulated paid-request counts, budget invariant, custody/evidence boundaries, limitations, and one-line `GO/NO_GO` for live paid run.
4. **Commit and push immediately to GitHub**, open a **draft PR** linking #151. Give independent reviewer ChatGPT PR URL, commit SHA, focused files, tests. No self-approval; no auto-merge before my independent review. Public push includes only code, tests, docs and sanitized metadata — never paid generated TS, private pack, secrets or G4.
5. Report honestly if this cannot be completed without invalidating current signing/custody architecture. In that case publish minimal reversible code and a precise blocking design decision, not a fictitious green result.

**Execution boundary now: build and push implementation; ZERO paid calls during agent work.** The owner-approved next paid trial is reserved for the reviewed implementation, not for exploratory debugging.
