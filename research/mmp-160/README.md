# MMP-160 — first-pass compiler discipline

Refs [#160](https://github.com/Meta-Project2026/Metamorph/issues/160),
[#154](https://github.com/Meta-Project2026/Metamorph/issues/154),
[#161](https://github.com/Meta-Project2026/Metamorph/issues/161).
Base fetched 2026-11-04: `a5bcf5968b05f77da6c8d755e4b99a1614fd1a58`.

Status: **MODEL_NOT_TESTED_AFTER_CHANGE**. This is a prompt intervention with
offline regression coverage, not a demonstrated TS2769 fix or migration PASS.
G0/G4 and product acceptance remain unestablished. No paid request, probe,
workflow dispatch, private candidate access or decryption is part of this task.

## Source reconnaissance and selected change

The actual `migration-context.mjs` already tells Meta:

| Area | Existing model-visible constraint |
| --- | --- |
| Toolchain | Node 24.11.0, TypeScript 5.9.3, SQLite 3.50.4, Node types 22.20.5; strict ES2022 NodeNext |
| Modules | CommonJS output without package.json; no top-level await/import.meta; local `.js` imports; built-ins only; no npm or generated package/tsconfig |
| Types | Parameters without contextual types need annotations; narrow caught unknowns/nullables; SQLite `get()` may be undefined; narrow row values and serialize bigint explicitly |
| Service | Complete `src/main.ts`, schema/seeds before listening, five original API actions, fixed target address/database, request-ID echo |
| Semantics | Preserve original PHP behavior, exact source DDL, seeds and endpoint-specific JSON/PDO types, including boolean `success`, string insert ID and SQL NULL |
| Boundaries | Public source as data, MIT notice retained, changes-only output, no canned/proxy responses or external calls |

`runtime/build.mjs` actually invokes strict NodeNext typecheck followed by emit,
with `--noEmitOnError`, `--skipLibCheck false`, and the trusted toolchain's Node
types. `runtime/package.json` pins TypeScript 5.9.3 / Node types 22.20.5; the
Dockerfile pins Node 24.11.0. Installed pinned `@types/node/sqlite.d.ts` declares
overloaded positional and named-record arguments for `get`, `all` and `run`.
This is API grounding, **not evidence that SQLite caused either real TS2769**.
No PHP/TS candidate or benchmark code was executed on the host.

What was missing: the developer message had no compiler discipline; there was
no explicit instruction to check every overload's argument shape against the
pinned declarations or to avoid hiding incompatibilities with type escapes.
These are general first-attempt requirements. The actual failing expression
and overload in the genuine candidate remain UNKNOWN. Issue #160's public
review reports TS2769 at `src/main.ts:118:22` in run 41834779734 and an earlier
TS2769 at a different file/location; these do not establish the same root cause.
Historical run/artifact claims here are attributed to that issue review, not a
new artifact download or independent reproduction by this executor.

Chosen intervention: append 845 UTF-8 bytes to the existing developer message
in `meta-migration.mjs`. Reinforce the existing compiler/module contract, require
shape-correct overloaded arguments and narrowing, forbid type-safety escapes,
and explicitly preserve PHP/JSON/PDO/schema functionality. This follows the
bounded developer-role direction of MMP-120 proposal B. It does not promise an
internal compiler/tool call by the model, change the target contract, or send
the historical location as repair feedback. Expected benefit is unmeasured;
redundant instructions and added input cost are the main prompt-level risks.

## Recomputed identities and estimate implications

| Value | Before | After |
| --- | --- | --- |
| Serialized generation body bytes | 24,780 | 25,625 |
| Body SHA-256 | `9b0a41c80b37ce7931c56c8455708edad178801ff2f3a390c37ecdcc341671f1` | `01cb64b4aef8206f7e7299dec4487cab6638718fb771f3e1a7c1d8fd5593121a` |
| Projected input tokens | 131,888 | 135,268 |
| One-send upper estimate, USD | 0.234492 | 0.238717 |
| Two-send aggregate upper estimate, USD | 0.836604 | 0.840829 |

The context SHA remains
`9935a8e71ee05267fc60c2b0aa03a9174c0cb50b7f9e5c2f58ad3f6f83824065`:
only the outer developer message changed. Source, license, manifest, target,
action and response/admission schemas remain byte-identical. A regression
replaces the developer message with its previous exact text and recovers the
old full-body SHA, checking all other serialized fields simultaneously.
The inert synthetic reply's admitted candidate SHA is pinned in the transport
test; it is a test control only, never model evidence.

These figures use the unchanged committed `meta-standard-2026-11-03` snapshot
and bytes-times-four-plus-32,768 projection, with 16,384 output tokens. They are
engineering estimates, not actual token counts, settled charges, or a provider
hard cap. Increase per generation: USD 0.004225 by this formula. The repair
wire reservation stays 98,304 bytes / USD 0.602112; the exact repair wire body
also acquires the developer clause but must fit the same unchanged bound.
Existing 0.25 single / 1.00 two-send allowance choices still cover the respective
projections under this snapshot; no allowance is selected for a real run here.
Tariff freshness, OIDC, durable reservation, retry limits and no-hard-cap
semantics are unchanged. Historical evidence/receipts are not rewritten.

## Validation and review

See [validation.md](validation.md) for executed checks and their exit codes.
The new fast tests cover the actual serialized request, pinned toolchain text,
unchanged context/output schema, body SHA/size and preflight economics, plus
actual in-memory transport bytes and synthetic output identity. Existing G1,
paid authorization, repair, JSON parity and source/injection controls remain
the validation oracle. This task introduces no synthetic TypeScript compilation
claim and performs no real model or Docker candidate verification.

The separate [G1 repair decision card](g1-repair-decision.md) is design-only,
pending attributable Vladimir **and** Ilia agreement before production changes.
The executor must not merge this PR; independent review is still required.

## Operator handoff after independent review and merge

1. Verify the reviewed PR is merged and fetch the actual current protected
   `main`. Use a clean checkout, build dependencies, inspect the new body/context
   SHA with `node research/mmp-120/audit.mjs`, and reverify live provider tariff,
   billing readiness and expiry. The committed snapshot expires 2026-11-10 UTC;
   all numbers above must be recomputed if it changes.
2. Obtain explicit owner authorization for **one new single_generation**
   experiment, including allowance, timeout, zero retries/repairs and acceptance
   of `NO_PROVIDER_HARD_CAP`. Old run consent and this PR grant no paid admission.
3. Run the offline preview from clean merged main, substituting the actual owner,
   explicit allowance and a new absolute file outside the checkout:
   `node research/mmp-154/preflight.mjs <owner> <allowance> <absolute-new-card-path> single_generation`.
   Check exact main/workflow/body/context pins, one POST, no repair/retry and
   recomputed estimate. A preview card is not signed admission.
4. The authenticated owner manually dispatches the existing paid workflow on
   that exact main SHA with `execution_mode=single_generation`,
   `model_provider=meta`, `validate_only=false`, the reviewed SHA/allowance and
   `I_ACCEPT_ONE_PAID_ATTEMPT_NO_HARD_CAP`. Never rerun an already billed workflow.
   This document does not dispatch or authorize that action.
5. Independently review real receipt/usage, custody/readback and cleanup, then
   actual G1 and (only if reached) 17 HTTP G2 / 20 SQLite G3 comparisons. Report
   G1 FAIL versus environment ERROR precisely; keep #160/#154/#161 open pending
   real acceptance. Even green G1 alone does not establish JSON parity or product
   acceptance. Record the new experiment separately from immutable old receipts.
