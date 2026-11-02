# Supported first-request interval and missing evidence

All citations below use immutable source heads. No private contents are quoted.

## Oracle ordering

[Current runner on baseline 074af75](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/runner.ts#L232)
resets both workers, obtains both initial snapshots, records and compares the
initial state, increments the initial SQLite ID, and writes the initial diff.
For step0 it then runs, in order:

1. Reference request, request clone, observation clone, serialization and reference
   HTTP evidence write (lines284–309).
2. Candidate request, request clone, observation clone, both observations'
   serialization and pair HTTP evidence write (lines311–345).
3. Trusted HTTP comparator, then executedHttp.push (lines347–350).
4. HTTP diff write, post-step reference/candidate snapshots and SQLite comparison.

[Catch at lines415–419](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/runner.ts#L415)
maps any earlier thrown operation to generic VERIFIER_ERROR. Returned ERROR gates
do not cause the outer runtime to receive the original exception. After-step DB
or HTTP-diff-write faults occur after the HTTP ID is counted, unlike 0/17.

[Historical Meta runner](https://github.com/Meta-Project2026/Metamorph/blob/d199510fd802693d4af852bd5ed8498b5461d185/packages/oracle/src/runner.ts)
has the same count boundary/order, without later categorical telemetry wrappers.
The public MMP104 publication contract separately admits the initial evidence;
counts alone must not be substituted for that integrity check.

## Request includes more than application HTTP

[Reference requestStep](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/reference/worker.ts#L134)
checks manifest/step identity, captures and compares pre-state, calls PHP HTTP
transport, validates the response, captures post-state, writes private evidence
and clones state before advancing its cursor. A reference request-boundary error
can therefore be a DB observation, transport, response, invariant or I/O error.

[Target requestStep](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/differential/src/target-adapter.mjs#L248)
checks step identity, invokes worker HTTP, verifies its independent command/response
identity, maps/admit the observation and records evidence before advancing its
cursor. Its boundary is not proof of a TypeScript application defect either.
The controller also performs bounded client/inspector protocol operations.

Read-only historical comparison used:

```sh
git diff --name-status d199510fd802693d4af852bd5ed8498b5461d185 79440b8dd85b28936e1818c8ce79b35ddbd38fcf -- packages/oracle/src/runner.ts packages/agent-real/src/runtime.mjs packages/oracle/src/reference packages/differential/src/target-adapter.mjs packages/target-worker/runtime packages/target-worker/src/controller.mjs
```

Within that scope only runtime.mjs and runner.ts differ. This supports shared
protocol/recipe constraints, not an identical whole-run environment or a causal
link between candidates from different model/runtime provenance.

## Why retained public MMP123 data cannot settle the side

[verifier-proof.mjs lines312–324](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/research/mmp-123/verifier-proof.mjs#L312)
projects gates/coverage/cleanup/compiler diagnostics but omits failureTelemetry
and private operation diagnostics. Its case status PASS means driver integrity,
not G1/G2/G3 acceptance.

[Runtime lines198–206](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/agent-real/src/runtime.mjs#L198)
supplies a telemetry runId only if GITHUB_SHA equals the real head, using
GITHUB_RUN_ID. The local harness passes AGENT_HEAD_SHA and its own MMP123_* values,
not those GitHub metadata fields. createFailureTelemetry rejects missing/invalid
binding. Thus the reviewed local wiring supplies no valid CI telemetry binding;
do not fabricate a GitHub run ID to change that. Even an omitted private telemetry
record would not be a recoverable public stage observation.

[run-host.sh lines42–44 and123–130](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/research/mmp-123/harness/run-host.sh#L42)
remove the created work/private/output volumes after copying only public output.
The owner confirmed to this agent that no local private evidence copy was retained.
No Docker volume inventory or private search/inspection was run under this HOLD.
The report records that evidence availability limitation explicitly, without
claiming recovery or a universal absence proof.

Conclusion: failed side UNKNOWN; operation error class UNKNOWN; historical root
cause UNKNOWN. A new GLM diagnostic could establish only that execution's failure
boundary; it could not recover or prove the absent historical Meta candidate's cause.
