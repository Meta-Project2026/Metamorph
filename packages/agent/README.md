# Bounded agent foundation (MMP-003)

Run `pnpm demo:agent` from the repository root. It writes inert TypeScript text
into a new OS temporary candidate directory and prints the actual synthetic event
journal, attempts, limits, accounting and terminal outcome. The demo retains that
directory for inspection. It executes no generated code, model, PHP or Oracle.
The script FAIL → repair → FAIL → wonder escalation → PASS demonstrates control
flow only. Simulated evidence references do not identify real Oracle artifacts.

Import `runAgent` and inject `ModelProvider`, `CandidateWriter`, `Verifier` in a
trusted host composition root. These are local agent ports, not changes to shared
DTOs or a new public server API. The server health response remains unchanged.
`spark` / `wonder` are policy labels, without any real model mapping.

## Limits and trust

Validate RunConfig and BenchmarkDefinition before effects. Generate all manifest
units, then verify the whole candidate. Every subsequent write invalidates prior
verification: verify again. On proven FAIL, repair units in manifest order up to
their total per-unit repair count; then cascade may escalate each spark unit once,
subject to a global escalation cap. Repairs do not reset after escalation. Thus
provider calls are bounded by units × (1 + repairs) + min(escalations, units).
Single-tier strategies never escalate; ERROR/INCONCLUSIVE never trigger retries.

PASS requires exactly one current result for each G0–G4, all PASS, and all manifest
scenario IDs in the trusted verifier's completed coverage. Duplicate gates are an
ERROR; missing coverage/gates is INCONCLUSIVE. This only coordinates a trusted
verifier's claims; it does not implement independent comparison, inspect evidence
files or establish product acceptance. The verifier must implement those checks.
`evidenceKind: synthetic` always marks fake verdicts. Even `external` is only the
host adapter's declared provenance, not independent Oracle/owner acceptance.

Provider responses are strict `{changes, usage}`: no gate/verdict field. The
provider never sees the workspace path, scenario IDs, raw findings, or verifier
report. Only the verifier's separately declassified `repairFeedback` is forwarded.
The trusted verifier must return public-safe findings/evidence references and
feedback; held-out data and expected outputs must stay inside its boundary.
Exceptions are reduced to stable reason codes to avoid leaking adapter secrets.

Zero budget blocks every model call, even synthetic. Paid adapters require an
independently guaranteed finite `maxRequestCostUsd` per call, fitting remaining
budget. Each call permanently reserves its full bound for this run; a lower
reported estimate never releases it. `reservedModelSpendUsd` exposes this cap
consumption separately from known reported estimates. Unknown bound blocks the
call. Reported estimated usage is journaled;
unknown paid cost, errors or interrupted paid calls stop continuation and make
total spend unknown. Known cost is separately summed; unavailable fields stay
null. Bound violation/overspend returns ERROR before writing. Synthetic adapters
are nonbillable; their unknown usage stays null, with no invented token counts or
real price. Paid transport/provider-side caps and actual billing reconciliation
are future integration requirements; an estimate alone cannot guarantee billing.

The run-wide timeout and optional caller signal cover all asynchronous ports;
adapters receive AbortSignal, late results cannot change the returned journal or
cause subsequent writes/verification. Adapters must honor cancellation for their
own ongoing work; a JavaScript promise timeout cannot kill a remote request or a
malicious synchronous host adapter. There is no hidden retry.

`createCandidateWriter(trustedParent)` allocates a new directory, with only
`src/**/*.ts` writes. It rejects traversal, Windows/absolute/encoded paths, hidden
files, protected component names, duplicate/case-alias paths, nonregular files,
symlinks/junctions and hardlinks. Proposals are parsed before writes. Failed disk
operations may leave partial candidate data; no success is reported afterward.
It never executes, renames or deletes code. This is a restricted patch boundary,
not a sandbox against a concurrent malicious local process. Before any real
candidate execution, supply an authorized disposable isolation runner with
separate reference/candidate state, no credentials, and bounded resources.

## Official Meta adapter seam / integration probe

`createUnconfiguredMetaProvider()` performs no I/O, reads no credentials and
declares unknown paid request bounds; orchestration blocks it before invocation.
No endpoint, model ID, auth method or price is guessed. A real trusted host
adapter can implement ModelProvider after these blockers are resolved:

1. Verify the official API documentation/host, auth mechanism, actual model IDs,
   account entitlements, context/output limits and supported usage receipts.
2. Obtain explicit owner authorization for a specific dollar cap, timeout, call
   count/output cap, repair count and escalation count. This PR supplies none.
3. Confirm enforceable request cost bounds and provider-side spending controls;
   keep credentials in a trusted host secret source, outside Git and workers.
4. With authorization, issue one minimal nonbenchmark text request from the host
   adapter, with no candidate execution or held-out inputs. Disable retries and
   bound time/output/spend. Capture sanitized request ID, actual model returned,
   status, latency, token/cache usage and billing receipt; preserve unknowns.
5. Test abort/error/accounting behavior, reconcile actual cost and review evidence
   before wiring policy labels to verified live model IDs. If any prerequisite is
   missing, leave the adapter unconfigured and report the probe NOT_RUN.

Live Meta API, PHP/benchmark execution and actual Oracle G0–G4: **NOT_RUN**.
No new OSS source was copied; existing exact Zod dependency retains its MIT notice.
