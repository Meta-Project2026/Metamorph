# MMP-120 — bounded prompt proposals (research-only)

Refs [#120](https://github.com/Meta-Project2026/Metamorph/issues/120), #61, #116.
Base: `main@b0574626c7c75469e17b7169438e9ae4369d0531`. These are **research
proposals**. Nothing in `packages/agent-real/src/migration-context.mjs` or
`packages/agent-real/src/meta-migration.mjs` is changed by this task; a
production prompt change would alter the request-body SHA and admission
economics and requires its own owner decision and PR after #115/#117 settle.
Reproduce every number below with `node research/mmp-120/audit.mjs variants`
(after `pnpm build`); the variant builder asserts byte-identical
reconstruction against the production serializer before mutating one field.

**No benefit claim is empirical.** No new model request was made or authorized;
every expected mechanism below is an argument, not a measurement:
`PROMPT_QUALITY_NOT_EMPIRICALLY_ESTABLISHED`.

## Baseline (recomputed at this base)

| Metric | Value |
| --- | --- |
| Body bytes / SHA-256 | 22,762 / `55c7b8442814b6dfb3a273d45063553ea00e4466046945fd72fd7ea2f38d5d5d` |
| Policy projection | 123,816 input + 16,384 output tokens → worst-case **$0.224402** |
| Admission | workflow default **$0.10 blocks**; choices .10/.20/.25/.50/.75/1.00 |
| Tariff snapshot | `meta-standard-2026-10-29`, expires `2026-11-05T00:00:00Z`; live verification NOT_RUN |

Method note: the projection multiplies all serialized bytes by 4 tokens/byte
plus 32,768 framing tokens — an engineering upper bound, not a tokenizer
result. The byte-based projection deliberately exceeds the response-side
observed-token ceiling (65,536) that `decodeMetaMigration` enforces after a
real response; the two bounds govern different moments (pre-send vs post-parse).

## Proposal A — append PHP value-semantics clause to `instructions`

- **File/anchor:** `packages/agent-real/src/migration-context.mjs`, `instructions` constant, appended after `…not one disconnected function.`
- **Exact added text (531 UTF-8 bytes):**
  > ` Replicate PHP semantics exactly: (int) casts keep the leading integer of a string or yield 0; trim() removes only ASCII space, tab, newline, carriage return, NUL and vertical tab; empty('0') is true; PDO lastInsertId() returns a string; JSON object key order follows the SELECT or table column order; format dates in messages as PHP date('F j, Y') with English month names; every error path responds HTTP 200 with a success:false JSON body; open BEGIN IMMEDIATE only where the source does and COMMIT only after the write succeeds.`
- **Grounding (each clause → public source):** `(int)` casts — `api.php` id/mechanic_id/count casts; `trim()` — every input read; `empty('0')` — all `empty(...)` validations; `lastInsertId()` string — `api.php:91` bookAppointment; key order — `SELECT a.*` + table column order; `date('F j, Y')` — three book messages; HTTP-200 errors — dispatcher/error paths; `BEGIN IMMEDIATE`/`COMMIT` — `api.php:43/91/248`.
- **Expected mechanism:** directly names the PHP-runtime facts ranked P0/P1 in [source-to-prompt-audit.md](source-to-prompt-audit.md) §5 that the source text encodes only implicitly — reducing G2 JSON-type/message mismatches (string `appointment_id`, HTTP-200 error paths, composite message rules) and G3 transaction-discipline mismatches.
- **Side risks:** +2,124 projected input tokens; the clause is bound to THIS source's semantics and would need review at any future source re-pin; over-constraining could make the model defensive (e.g., extra validation) — behavior drift in either direction is possible and unmeasured.
- **Computed:** body **23,293 bytes**, SHA-256 `500b34dcb6ba931f8195789533baa9e3879f9e04dd17e678b2a552d1d0256fd5`, projection 125,940 + 16,384 tokens → **$0.227057** (+$0.002655 vs baseline).
- **Budget:** still blocked by the untouched $0.10 default; unblocking requires an explicit owner budget selection ≥ $0.25 plus the standing #116/#61 authorization gates — this proposal neither grants nor requests that.

## Proposal B — append first-attempt compile clause to the developer message

- **File/anchor:** `packages/agent-real/src/meta-migration.mjs`, developer `content`, appended after `…No tools or external calls.`
- **Exact added text (334 UTF-8 bytes):**
  > ` Compile discipline for the first attempt: strict ES2022 NodeNext emitting CommonJS with no package.json; type all parameters explicitly, narrow unknown and nullable values before use, import only node built-ins and relative .js modules, and emit a complete src/main.ts entrypoint that initializes schema, seeds and the HTTP listener.`
- **Grounding:** mirrors `context.target` (`compiler`, `modules`, `strictTypes`, `startup`) — developer-role reinforcement of constraints already supplied in the user content; no new facts, no verifier answers.
- **Expected mechanism:** compile discipline stated in the developer role (higher instruction priority on most chat models) attacks the G1 category first: untyped parameters, un-narrowed unknowns, `import.meta`/top-level-await accidents, missing `src/main.ts`. The only historical all-known fact about a real candidate is that the 2026-10-29 one failed G1 build/typecheck (root cause UNKNOWN); G1 is the first gate any candidate must clear.
- **Side risks:** redundancy with `context.target` (two places to keep in sync if the target contract changes); +1,336 projected input tokens; developer-role steering strength on `muse-spark-1.3` is unmeasured.
- **Computed:** body **23,096 bytes**, SHA-256 `dd28517aaec4f1b38b3f5b41bc327de51b663b123340eb67432af48837d3c08a`, projection 125,152 + 16,384 tokens → **$0.226072** (+$0.001670 vs baseline).
- **Budget:** same as A — blocked by the $0.10 default; no authorization implied.

## Deliberately rejected alternatives

- **Schema-text steering** ("emit the CREATE TABLE statements byte-identically") — grounded in real G3 mechanics (`sqlite_schema.sql` is compared verbatim), but it steers toward verifier internals rather than source semantics; the existing "Preserve original schema SQL" instruction already covers it. Kept out to keep proposals bounded and non-verifier-shaped.
- **Any golden values, expected outputs, scenario IDs, held-out fixtures or embedded candidate TypeScript** — forbidden by the task card and by the constitution's held-out isolation rules; the audit confirms the current body contains none (asserted by test).

## Recommendation

If a future owner authorizes a new paid experiment (#116 unheld, custody PR
#117 landed, fresh tariff confirmed, explicit budget ≥ projection), apply **A
or A+B** in a separate reviewed PR that regenerates the body SHA and admission
projection at the then-current main; do not dispatch on this research. If the
owners prefer zero prompt churn, **NO_CHANGE** is defensible: the baseline
prompt already contains all facts a careful model needs, and neither proposal
has empirical support. Priority: A (impact: G2/G3 P0/P1 classes; effort: low;
risk: low-moderate), B (impact: G1 first-attempt discipline; effort: low; risk:
low), then re-run `node research/mmp-120/audit.mjs` + `variants` at the target
head before any authorization decision.
