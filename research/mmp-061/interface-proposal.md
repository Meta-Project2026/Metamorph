# Narrow compatibility proposal: genuine local inference admission

Status: PROPOSED, NOT_IMPLEMENTED; both-owner interface review required by
AGENTS.md / constitution IV. No shared interfaces were edited by MMP-061.

Observed: ModelProvider.billing is only synthetic | paid, and runAgent rejects
maxModelSpendUsd === 0 before inspecting billing. A genuine nonbillable local
model cannot truthfully use the synthetic label. Declaring it paid or providing
an invented USD1 allowance would obscure provenance and the zero-paid-call policy.
The task explicitly prohibits those workarounds. No local runtime was found on
this Windows host; elevated wsl --list --quiet returned no installed distribution.

Proposed smallest separately reviewed delta:

1. Add a distinct local-inference billing discriminant to the agent port, while
   retaining the strict shared ModelUsage/RunConfig DTOs. Require a trusted adapter
   factory to verify local runtime executable and model-file identity/version,
   local-only operation/no cloud fallback, license/terms and bounded output/runtime.
   Loopback alone is not proof that the service cannot forward to a paid API.
2. Permit a zero dollar config only for that admitted local discriminant with a
   guaranteed zero external charge bound. Keep zero-budget/unknown-bound stops for
   paid providers unchanged. Record provider/model identity, local inference vs
   replay, request/input/output hashes, actual nullable token/cache usage and cost
   semantics. CPU/electricity cost is not silently called a settled provider bill.
3. Keep attempt/repair/time/output limits separate from monetary caps; no fallback
   to spark/wonder model names or paid endpoints. Test rejected fake local handles,
   runtime/model mutation, network/proxy forwarding, cancellation and late output.
4. Only after this and an actual model smoke, connect the new source binding and
   real Docker composition, complete receipt correlation/control schedule, freeze
   the trial budget and execute the one public experiment. Do not add paid-network
   execution to ordinary PR CI.

Alternative paid route: owner-selected provider/model/account + independently
verified enforceable charge cap + exact spend/attempt/time approval + authoritative
usage settlement. A price estimate, credit balance, alert or max_tokens value alone
cannot issue admission. Existing Meta remains BILLING_CAP_NOT_ESTABLISHED; no
caller-entered amount activates it. Unknown usage after dispatch must remain
UNKNOWN_PAID_USAGE and prevent a second call.

The code keeps a fail-closed production selector and a testable normalized codec;
it deliberately provides no production network transport or local-model shim that
could bypass these prerequisites. This proposal does not certify either route.
