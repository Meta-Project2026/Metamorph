# MMP-120 — post-run triage runbook (offline, no dispatch)

Refs [#120](https://github.com/Meta-Project2026/Metamorph/issues/120), #104, #116.
Purpose: when the **next authorized** paid experiment eventually runs (e.g.
#116 after it is unheld by its owner), this table maps each observable public
outcome to the actions that are allowed **without** new authorization, the
actions that require an explicit owner decision, and the claims that may never
be made. Nothing here authorizes a Meta GET/POST, a `workflow_dispatch`, a
retry, or host execution of candidate TypeScript.

Standing rules, before any row:

- Use only **allowlisted public receipt fields** — the member shapes pinned in
  `research/mmp-104/incident.json` (generation, gates, coverage, cleanup,
  preservation, attemptLedger) and the public/policy artifact ZIPs. Raw model
  responses, private packs and G4 material are out of bounds.
- Safe analysis is offline only: `node research/mmp-104/inspect-incident.mjs
  <artifact-dir>` (original ZIPs, read-only GitHub download, no member
  execution), `node research/mmp-120/audit.mjs`, `node
  research/mmp-120/audit.mjs variants`, `node research/mmp-107/preflight.mjs`,
  `node research/mmp-069/check-syntax.mjs`,
  `node --test packages/agent-real/test/verifier-forensics.test.mjs`,
  `node --test packages/agent-real/test/mmp120-generation-readiness.test.mjs`.
  Encrypted evidence inspection goes through the `research/demo-readiness/`
  offline viewer only.
- **Never** execute or import generated candidate TS on the host; candidates
  run only inside the disposable target-worker isolation by the authorized
  workflow.
- An attempt ledger with `status: UNKNOWN, attemptedRequests: 1` means the
  attempt is **consumed**: no offline card, research result or failed run
  grants a retry. A new POST needs a fresh owner authorization with exact main
  SHA, model/body hash, budget, timeout and zero-retry terms (#61/#116 gates).
- Distinguish the three failure categories in every claim: proven **FAIL**
  (evidence recorded), missing-evidence **INCONCLUSIVE**, environment
  **ERROR**. Unexecuted checks are NOT_RUN.

| # | Observation (public receipt) | What it does / does not establish | Allowed without new authorization | Requires owner decision | Never claim |
| --- | --- | --- | --- | --- | --- |
| 1 | G1 verdict FAIL with finding `BUILD_FAILED` and compiler-failure entries on executed IDs | Genuine compile/type failure of that candidate on those pairs; nothing about other pairs or runtime | Map diagnostics to the function/action rows in [source-to-prompt-audit.md](source-to-prompt-audit.md); classify error categories (strict narrowing, NodeNext/CommonJS, node:sqlite API); feed prompt-proposal review | A prompt change PR (changes body SHA + admission economics); any re-run | That a different prompt would have passed; root cause beyond recorded diagnostics |
| 2 | G1 INCONCLUSIVE (`BUILD_NOT_RUN`, `DIAGNOSTIC_UNAVAILABLE`) or aggregate < 6/6 IDs while one pair shows PASS | Evidence completeness problem, NOT a proven compile failure | Verify which of the 6 G1 IDs executed; run `verifier-forensics` regression scope; record the gap | Whether incomplete-G1 evidence justifies any retry authorization | "Candidate failed to compile" from INCONCLUSIVE evidence |
| 3 | G2/G3 verdict FAIL with counted diffs (`HTTP_*` / `DB_*` finding codes, coverage < 17/20) | Real behavioral mismatches for the executed steps; per-step diff codes identify the involved comparisons | Translate diff codes to functions via the §3/§4 maps (e.g. `HTTP_JSON_TYPE` on `appointment_id` → string-vs-number; `HTTP_JSON_VALUE` on message fields → message text; `DB_SCHEMA` → DDL text/`sqlite_sequence`) | Prompt/contract changes; candidate retention decisions | Root cause from one diff code; that unexecuted steps would fail |
| 4 | G2/G3 verdict ERROR (`VERIFIER_ERROR`), 0/17 HTTP or 1/20 SQLite | **0 completed comparisons ≠ 0 HTTP requests** (mmp-104 interval analysis): either side may have completed requests before the failure; transport/adapter/snapshot/evidence-write causes are unresolved | Re-apply the mmp-104 five-hypothesis interval table; confirm cleanup/finalizer receipts; do NOT attribute to candidate semantics | Stage-level telemetry/custody instrumentation decisions (separate task) | That the TS candidate was wrong, that PHP reference failed, or any app-level conclusion from ERROR |
| 5 | `preservation.ciphertextSha256` present and matching | Retention of ciphertext bytes only | Record hash/bytes; inspect via demo-readiness viewer | Owner-side `age` restore on a trusted host proves recoverability (mmp-115 custody gates) | "Candidate is preserved/restored" from ciphertext existence alone |
| 6 | Receipt contains `candidateSha` but no retained candidate source is available | Custody gap: identity without recoverability | Record the mismatch; run `audit.mjs` at the exact head to confirm pins; keep historical root cause UNKNOWN | Custody capture/restore gate work (#115/#117 scope — do not edit in parallel) | Any reconstruction of the missing candidate or of its failure reason |
| 7 | Cross-receipt identity mismatch (context/manifest/body SHA ≠ `audit.mjs` values at that head, or generation custody UUID ≠ verifier link) | The run cannot be interpreted against this base | Freeze the receipts; re-run `node research/mmp-120/audit.mjs` and compare; document which pin moved | Decide whether a re-run authorization can even be specified (exact SHA required) | Treating mismatched evidence as a PASS/FAIL of any baseline |
| 8 | Product field ≠ PASS, or G0/G4 INCONCLUSIVE | Normal: product acceptance was never established by a single public run | Keep `PRODUCT_NOT_ESTABLISHED` wording in all summaries | Formal held-out G4 execution decision | Product PASS from G1–G3 parity, green CI or model confidence |
| 9 | No new paid run, or proposal adopted/rejected offline | Zero model evidence about prompt quality | Keep `PROMPT_QUALITY_NOT_EMPIRICALLY_ESTABLISHED` everywhere; proposals remain research-only | Unholding #116 with fresh tariff + exact-main authorization | Implying any prompt proposal improved or would improve a real run |

Escalation conditions (owner action required before anything further): any new
billable request idea; any host exposure to candidate bytes; any custody
restore attempt; any change to Oracle/comparator/controls; any divergence
between recorded evidence and this runbook's assumptions.
