# MMP-104 production failure telemetry v1

Baseline: `main@114973cbcde2debc699ff0b578c146c34b6c636e`, freshly fetched2026-11-01.
This focused production slice follows merged research PR110. Both bounded-contract
approvals are recorded: [Ilia](https://github.com/Meta-Project2026/Metamorph/issues/104#issuecomment-6561627815)
and [Vladimir](https://github.com/Meta-Project2026/Metamorph/issues/104#issuecomment-6562299299).
The [independent research review](https://github.com/Meta-Project2026/Metamorph/pull/110#pullrequestreview-5729607081)
does not constitute production acceptance. This PR needs its own independent
exact-SHA code/security review and must not be self-merged.

## Before and after

Before, verifyPair's broad catch yielded VERIFIER_ERROR without identifying the
observed boundary. After, a trusted host can opt into the approved optional
`failureTelemetry` field on VerificationResult and the corresponding public pair.
The exact v1 public schema remains the [approved research contract](../t2/README.md):
format/scope/status/unavailableReason, trusted six-ID binding, public scenario/step
ordinals, immutable firstFailureStage/category, lastCompletedStage, max two sorted
cleanup markers and truncated, within2048UTF-8bytes. No GateResult or
VerificationReport schema changes. A stage names an observed boundary, never a
component/root cause. A pair can have AVAILABLE telemetry and ERROR gates.

Production code has no imports from research. The new Oracle-local typed module
owns context/record provenance in private WeakMaps. createFailureTelemetry accepts
only exact-key bounded host binding and a pinned public manifest ordinal; invalid
or missing binding returns null without changing execution/admission. Recorder
activation additionally requires the exact one pinned public scenario. Ad-hoc or
held-out scenarios cannot publish stage observations through a public context.

Trusted literal checkpoints cover29stages: both adapters' reset, initial snapshot,
request, step snapshot and close; request/observation cloning, HTTP serialization,
HTTP/initial-DB/step-DB comparison, each evidence-write class and final publication.
Per-step boundaries require an actual bounded request ordinal. Reset, initial,
close, controls/publication and initial DB writes/compare require null. Observation
cloning supports null for initial DB and a request ordinal for HTTP/step DB; the
literal call sites and tests enforce the matching phase. Global public ordinal
remains correct when verifyPair's local scenario array contains one later scenario.

The first observed failure captures its category and step once. Last completed work
freezes at that failure; later cleanup/publication cannot hide the useful preceding
stage. Close success never overwrites last work. Cleanup failures remain separate,
unique per side and sorted. Sealing detaches/freezes the record; late completions
cannot rewrite it. SIGNAL_ABORTED is only the observed supplied Oracle signal;
parent cancellation through the existing broker may instead be OPERATION_REJECTED.
No cause is inferred from AbortError/code/message or elapsed time.

The same return value, thrown object and native signal cross each observed operation.
No timer, retry, extra worker/cleanup call or reordered comparison/write/count was
added. The listener is removed before bounded()'s successful-finally abort. An
unclassified verifier failure becomes UNAVAILABLE/INTERNAL_ERROR; setup/final
publication rejection becomes UNAVAILABLE/PUBLICATION_FAILED and still rejects
with the original value. Cleanup and gate precedence remain authoritative.

## Oracle → runtime → report provenance

createEnvironment snapshots the trusted host GITHUB_RUN_ID only when GITHUB_SHA
matches its headSha argument. No credential is read. runPair combines that captured
identity with pinned source, admitted candidate hash and host-created attempt/pair
UUIDs, mints one context per pair and passes it to Oracle. Without that exact CI
identity the sidecar is explicitly UNAVAILABLE/MISSING_BINDING; environment
admission/gates/cleanup continue unchanged. No IDs are invented to fill a gap.

The original issued record stays in memory through private pack retention/sealing.
The trusted runtime registers the returned pair/context in report's private WeakMap.
publicAttempt additionally rechecks source/candidate/attempt/pair/head/scenario
against this association and existing aggregation identity checks. It reads only
an own data descriptor for the optional field; accessor/absent/copied/foreign
records become fixed UNAVAILABLE states. The projector requires both issuance and
the original context, then reconstructs a fresh exact-key bounded immutable record.
Shape validation alone is never accepted as provenance. A JSON copy cannot recreate
either issuance or a registered pair. Unregistered legacy/test pairs keep their
existing optional-field shape; worker fields do not grant publication rights.

If retaining/validating an Oracle publication fails after verifyPair returns, runtime
chooses an issued UNAVAILABLE/PUBLICATION_FAILED sidecar. Existing error handling,
independent second cleanup, build/lease observations, finish() and private sealing
remain unchanged. Failures before Oracle invocation are UNAVAILABLE/ABSENT.
The telemetry scope ends at Oracle's boundaries; it is not a new diagnosis of
provisioning, independent runtime teardown, pack sealing or later host failures.

The trust assumption remains a trusted evaluator process. These WeakMaps are not
cryptographic authentication or protection against malicious same-process host
code. Workers never execute in this process or receive a context/record capability.
No error property, URL, SQL/HTTP sample, path/command, source, provider output,
secret or private G4 input enters the new telemetry path.

## Publication/export boundary and acceptance

No new output file, raw Oracle file/index change or export package member is added.
The approved field stays inside the existing reviewed public trial pair projection.
aggregateAttempt and its fixed repair feedback do not read telemetry. Preservation
identity/selector bindings exclude it; tests prove identical identity with a hostile
telemetry getter and unchanged refusal of partial G1 before source access. The
preserve/prepare-upload/retention code and eligibility policy are untouched.
Telemetry failure cannot grant export, improve ERROR or reduce mandatory coverage.

Tests exercise actual production stages using inert original adapters and scoped
test-only built-in mocks, with opt-in/opt-out exact gates/IDs/findings/evidence-path
and write-order comparisons. No production fault-injection interface was added.
Known-good controls cover all three public manifest ordinals. Tests also cover
hostile getters/claims, clone/serialize/compare/writes, setup/publication rejection,
both cleanup failures, real bounded timeout/parent abort, late completion, malformed/
foreign/oversized/truncated/absent records, provenance handoff, G1 incompleteness,
public/repair/export and G4 firewalls. They execute no benchmark or candidate code.

See [validation.md](validation.md) for commands actually run and remaining limits.
CI/test success is not product PASS or live PHP/TS acceptance. Historical
run41327197036 root cause remains UNKNOWN; candidate/private operation packs remain
UNAVAILABLE. #61 product NOT_ESTABLISHED; #100's single paid attempt is consumed.
Paid calls=0. No model/provider GET/POST, dispatch/validate_only, rerun, Docker
benchmark, age/key operation, actual candidate or plaintext export. #105/#107/#108
remain separate. Original code/tests reuse repository manifest/Oracle/report;
no dependency, source fixture, pin or license notice changed.
