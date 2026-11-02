# Proposed one-run local diagnostic — NOT_AUTHORIZED / NOT_RUN

The issue explicitly says: **"Request owner consent before running it."**
No executable Docker driver is activated by this PR. This is the concrete scope
for the next owner decision, including preparing/testing the trusted scratch
instrumentation before the single run. Approval must not be inferred from this
plan, the research PR, its CI, #116 intent, or the consumed #122 upload permission.

## Immutable subject and execution envelope

- Exactly one unchanged repaired candidate: canonical SHA
  `0cf5ba0bb22fd1d335b3d061b0a9b258d7ac660f3038e1e651ddaad1262d03c1`,
  directory research/mmp-123/repair-candidate. Recompute all five files and MIT
  notice before and after; preserve first draft 4ff450d2 and every old receipt.
- Use the reviewed MMP125 source head's unchanged production verifier/runtime,
  pinned public workshop source, original manifest and f09b12fe recipe. Record
  the exact driver/source head and a fresh host-issued diagnostic UUID before
  execution. No candidate-provided identity or verdict is authoritative.
- One validateGeneratedMigration/RealVerifier invocation with no ModelProvider,
  model calls, repair loop, retry, second candidate or extra known-good Docker
  replay. The existing verifier may stop after the failing first pair or execute
  its normal remaining public pairs if no error occurs; no scenario/scoring edit.
- Disposable local Linux/amd64 Docker environment using the existing pinned
  trusted harness image pattern: node:24-bookworm digest
  e7add2a490bb17d97b485b8641bd88455fff7839ade0f5eba493c3508124d413;
  Docker CLI28.5.2 qualified by the existing SHA. Outer harness max4GiB /512 PIDs;
  total diagnostic deadline20minutes, independent bounded cleanup. Preserve target
  POLICY256MiB /1CPU /64PIDs /180second lifetime /15second operations, reference
  limits, fixed clock and verifier's existing30second operation bound.
- Fresh run-labeled volumes/container names; refuse existing/foreign resources;
  source mounted read-only, private evidence outside Git with0700/0600 access.
  Candidate/reference run only inside the existing nonroot, network-none,
  bounded verifier workers, never on the host or outer orchestration container.
- Outer trusted setup admits only frozen dependency installation and the pinned
  public source archive as required by the existing pattern. No Meta/API/model
  host, credentials, GitHub workflow, upload or owner age identity. Do not pass
  NODE_OPTIONS or instrumentation capabilities into candidate/reference workers.

## Trusted observation, without changing verdicts

Before executing, prepare and unit-test a separate scratch adapter around the
trusted reference/candidate request and snapshot/transport boundaries. It must
call original methods exactly once, preserve their original result/exception,
cancellation and cleanup, and leave production files/comparators/gates unchanged.
No request/response/SQL/stdout/stderr/stack/source/G4 value is copied into public
state. Never classify cause by error.message, error.code, candidate claims or a
worker-provided side string; getters/proxies can be hostile.

Record trusted entry/settlement markers, with side fixed by the wrapping host
adapter, phase fixed by its method, host-minted identity, monotone bounded ordinal,
and explicit completeness. If available, classify timeout/cancel/no response/
malformed response/transport only from a reviewed trusted timer/process/admission
checkpoint. Otherwise use UNKNOWN. A failed request boundary is not itself proof
of an application or network root cause; its before/after DB work is separate.
Evidence-writing/comparator faults without an adapter marker must remain UNKNOWN,
not automatically attributed to the last active side.

At most128 categorical events /64KiB. Overflow, missing entry/exit, interrupted
writer, identity mismatch, late settlement, missing observations or unknown enums
make the diagnostic unavailable/inconclusive. Seal before projecting. Derive only
an explicit fresh allowlist: format, diagnostic/head/source/candidate binding,
public scenario/step ordinal if proven, failing boundary/phase, categorical class,
completeness, normal cleanup and independent finalizer counts, original verdicts.
Keep all raw evidence private. No public stack, local path, payload, source or
arbitrary error string; no artifact upload. Categorical local output only.

Required synthetic controls before launch (no Docker/model): inject the same
first-step failure separately into reference, target and a host observation/write
boundary; ensure labels never swap or infer a side from identical aggregate gates.
Also test malformed response vs timeout/cancel, unknown/forged worker claims,
hostile error getters, canaries, overflow/truncation/late result and identity
substitution. Verify byte-identical original results/exceptions/gate scoring and
cleanup remains invoked. These instrumentation controls are **PROPOSED**, not
the already executed read-only audit tests in this PR.

## Decision and stopping conditions

Require actual independent normal teardown plus the unchanged finalizer0/0/0.
Emergency removal or cleanup error is a diagnostic failure, not readiness. Clean
up only this run's labeled resources, with an independently bounded final check.
Never issue an automatic retry if a run/observer/setup fails.

Possible outcomes: an observed trusted failing boundary for this GLM repair;
NOT_REPRODUCED if the error disappears; or INCONCLUSIVE/ERROR if evidence is
incomplete. Preserve original candidate verdicts. Even a trusted GLM finding does
not prove the historical Meta root cause, historical billing or product parity.

After the single authorized run, publish only the safe categorical record and
actual command/exit/cleanup evidence in the research PR. Independent exact-SHA
security review remains required; no self-merge. Any code repair, second run,
model request, paid trial or artifact upload needs separate authorization.
