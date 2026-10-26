# MMP-003 implementation plan

Use one small ESM TypeScript package, Node's test runner and existing Zod 4.6.7.
No other runtime dependency or copied implementation. Preserve dependency notices.
Adapt the installed compact Spec Kit templates manually, as in 002; do not change
generated scaffolding or `.specify/feature.json`. Explicit selection uses
`SPECIFY_FEATURE_DIRECTORY=specs/004-agent`, `SPECIFY_FEATURE_NO_PERSIST=1`.

## Structure

- `packages/agent/src/ports.ts`: local host ports and strict model/report parsing.
- `orchestrator.ts`: bounded sequential control loop, deadline, validated journal.
- `writer.ts`: fresh-directory source-only writer; no execution or deletion.
- `scripted.ts`, `demo.ts`: deterministic synthetic adapters and runnable demo.
- `meta.ts`: disabled live seam; no network transport or credentials.
- `packages/agent/test/`: compiled-export synthetic and filesystem tests.

## Trust and behavior

Composition root supplies trusted ports. Only the verifier port can produce gate
results. It supplies explicitly public repairFeedback separately from its reports;
raw findings and mandatory scenario IDs never go to the provider. All five gates
are required conservatively; any future applicability protocol needs owner review.
Each report applies only to the latest candidate snapshot, after all generated
units exist. No reuse of earlier gate PASS across writes. RunResult always labels
synthetic versus externally verified evidence; it does not claim product acceptance.

Paid admission reserves the provider's trusted per-request upper bound before each
call and retains the full reservation; estimatedCostUsd never releases budget.
Record reported estimates separately, preserving null. The
adapter must guarantee the bound independently of model output. Unknown paid
accounting or interrupted calls make total spend unknown and stop further calls.
True billing enforcement still requires provider-side caps and reconciliation.

Use a run-wide AbortController and bounded waits for every asynchronous port.
Built-in filesystem writes are small synchronous operations checking cancellation;
there are no writes on late provider completion. Other injected adapters must honor
abort and must never execute candidate code on the host. Filesystem path checks are
defense in depth, not an OS sandbox against concurrently malicious host processes.

## Validation and delivery

Frozen install, lint, typecheck, unit/contract/server smoke, build, runnable demo,
Spec Kit prerequisite check, diff and unchanged-scope checks. Existing Node 22/24
fast CI stays unchanged. Publish branch/PR, then observe hosted checks separately.
No billable probes, PHP, Docker, real Oracle or benchmark execution. No merge.
