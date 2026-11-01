# Safe failure-stage telemetry — design gate, not production wiring

Status: PROPOSED; [stage-prototype.mjs](stage-prototype.mjs) is research/test code.
No production module imports it. Under AGENTS.md, a shared/schema/runtime change
requires explicit agreement by both owners and a focused implementation PR with
independent review. Issue104 authorizes this offline design and regression work;
it does not supply that shared API agreement or permit a new model run.

## Minimal trusted observation

A future sidecar should identify the trusted boundary where work failed, without
claiming which application or component caused it. Reuse verified run/head/source/
candidate/attempt/pair identity, public MANIFEST scenario ordinal and step ordinal
from trusted orchestration. Never accept identity or stage from worker output.
Proposed stage vocabulary covers reference/candidate reset, initial/step snapshot,
request, close; observation clone/serialization, HTTP/SQLite compare, evidence
write and trusted publication. All are fixed enums. No request URL, form/SQL,
sample, raw error/code/message/stack, source, provider payload, environment or path.

Proposed bounded record: version, bound identity, public ordinal, first failure
stage/category, last completed work stage and at most two secondary cleanup stages.
No arbitrary text, variable event arrays or timing-derived claims. Publish only a
fresh exact-key projector after validation, never spread an error/worker object.
Public-scenario telemetry must not be extended to hidden G4 without another review.

Categories: OPERATION_REJECTED; SIGNAL_ABORTED; UNKNOWN. Only a trusted timer's own
firing flag could justify a future DEADLINE_EXCEEDED distinction. A worker-provided
error.code=TIMEOUT or AbortError is not evidence. SIGNAL_ABORTED does not identify
timeout versus parent cancellation. A reference-side marker can still mean broker,
transport, runtime, admission, IO or app behavior; no root-cause attribution follows.

Primary failure is first-write-only. Cleanup failures remain separate, sorted fixed
enums and still dominate the existing gate outcome. No cleanup success overwrites
the primary stage. Finalization seals a detached immutable summary; late promise
completion cannot modify it. Successful operation signals are aborted by the
existing bounded() finally; instrumentation must remove its listener first so a
normal completion is not misclassified as a timeout.

## Prototype and limitations

The prototype forwards the same arguments, signals, return values and thrown
objects to unchanged verifyPair. It never reads exception properties, observations
or body data. Fixed trusted call sites choose stages; candidate claims are ignored.
No new timers, retries, verdicts, coverage increments or source export are added.
Its fixed summary is under512 UTF-8 bytes in the adversarial regression.

Adapter wrappers distinguish reference/candidate operation rejection or actual
signal abort. They **cannot** isolate internal clone/comparator/evidence faults;
those remain UNCLASSIFIED_TRUSTED_PIPELINE. The internal HTTP_COMPARE checkpoint
test demonstrates explicit trusted attribution separately; it is not wired into
production verifyPair and does not retroactively classify run41327197036.
Create one prototype per pair; snapshot ordinals belong to that pair only.

Integration would need trusted checkpoints inside Oracle around clone/serialize,
comparison and each evidence write, then a reviewed minimal projection through
runtime/report/upload allowlists. A public telemetry-write failure must be fixed
TELEMETRY_UNAVAILABLE, preserve the original error/exit and never produce PASS.
Actual signed identity/resource cleanup proof remains in existing trusted layers.
The prototype is not an authorization capability, hostile-host defense or a
substitute for authenticated execution identity. Host/same-UID trust is unchanged.

## Required future integration controls

- Each reference/candidate operation and each internal compare/write checkpoint;
  successful path, simultaneous cleanup failure, abort/deadline and late completion.
- Candidate exceptions with spoofed stage/code and throwing getters; large/sensitive
  outputs; exact-key/size enforcement; wrong run/pair/scenario binding.
- Telemetry persistence failure and publication failure keep the original gate and
  cleanup precedence; no source/provider/Oracle/G4 content in any public output.
- Independent security/privacy review plus both owners' explicit agreement before
  production wiring. Offline integration tests first; no model/dispatch implied.
