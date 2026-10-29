# MMP-061 next: Meta live transport (review required)

Increment A/B, 2026-10-29. Continues PR70 from reviewed e8f6e739f1a727997c061dc5bafaa37040392489.
Fresh origin/main is 413247f (separate demo/CI work); no foreign commits in this
branch. Previous APPROVED is scoped to admission/replay, not this new diff.

Current shared ModelProvider, RunConfig and runAgent remain untouched. Production
paid generation still denies BILLING_CAP_NOT_ESTABLISHED. Monetary cap is UNSET,
not zero or infinity. A manual finite-call no-cap policy is a proposal requiring
both owners and independent review before implementation of changed admission.

## Read-only v2

New opt-in meta-preflight-v2 leaves legacy #37 interfaces unchanged. It separates
operation=READ_ONLY from status and attemptedRequests from confirmedResponseCount.
A request attempt has networkSend=UNKNOWN until a verified TLS HTTP response;
local flush does not assert peer receipt. Stream/header overflow stays
RESPONSE_LIMIT; raw socket/provider diagnostics never appear in safe output.

Fixed native HTTPS GET, one attempt, 10s total deadline, 64 KiB response, strict
UTF-8/JSON/duplicate-key/catalog admission; no redirect, proxy, retry or POST from
the preflight. Model listing only proves listing/authenticated access at that time,
not generation entitlement or settled billing. Key presence is boolean only.

Separate meta-readonly-preflight.yml: dispatch only, main and exact reviewed_sha,
read-only GitHub guard requires protected main and Environment required reviewers,
prevent self-review, main-only branch policy. Guard runs before the secret-bearing
job. That job references META_API_KEY and maps secrets.META to MODEL_API_KEY only
on the single GET step. No install/build/test/Docker/candidate in that job. Only
meta-preflight.json uploaded. No secret-backed dispatch in this implementation turn.

Observed metadata: Environment META_API_KEY exists, protection_rules=[],
deployment_branch_policy=null. Branch-policy listing returned 404. No key value
was requested or inspected. Thus ENVIRONMENT_PROTECTION_REQUIRED remains a real
activation prerequisite; configure main-only deployments and required reviewers
with prevent-self-review, then review/merge the trusted workflow before dispatch.
GitHub may require plan/repository support for these protections. Do not weaken
the guard to work around unavailable protections; propose an equivalent reviewed
protected execution mechanism instead.

## Official source verification (2026-10-29)

- [API reference](https://dev.meta.ai/docs/api-reference): fixed api.meta.ai/v1,
  model listing GET and chat-completion POST.
- [Authentication](https://dev.meta.ai/docs/authentication): Bearer credential.
- [Chat schemas](https://dev.meta.ai/docs/api-reference/chat-completions/schemas):
  separate message content, finish reason and API usage; output cap includes reasoning.
- [Structured output](https://dev.meta.ai/docs/structured-output): json_schema,
  strict true with required properties and additionalProperties false.
- [Models](https://dev.meta.ai/docs/models): muse-spark-1.3, Standard mode;
  documented context 1,048,576 tokens. Actual account entitlement NOT_VERIFIED.
- [Pricing](https://dev.meta.ai/docs/pricing-rate-limits): Standard per-million
  input/cached/output USD 1.25/0.15/4.25. Contributor IDs/rates are different and
  not selected. Rates are a dated estimate snapshot, never a charge guarantee.
- [Spend alerts](https://dev.meta.ai/help/billing/spend-limit-alert): not hard caps.
- [GitHub environment protection](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments):
  secrets depend on environment protection; availability depends on plan/visibility.

The internal native HTTP primitive includes bounded POST serialization for the
next adapter increment; it has no CLI/automatic paid dispatch. Native tests replace
https.request and use a clearly fake credential. No actual GET or POST executed.

## Increment C: actual wire adapter, production admission still closed

meta-migration.mjs now builds official POST /v1/chat/completions JSON and validates
its external envelope. Only choices[0].message.content supplies changes; all usage,
model identity and request ID come from API metadata. Unknown top-level/model
metadata, refusal, truncation, tool calls, empty/Markdown output, duplicate JSON
keys, unsafe paths, missing src/main.ts and invalid usage fail closed. Candidate
bundle SHA is computed independently before any writer. No generated code executes
on host. The production selector now points at this adapter, retaining billing=paid,
maxRequestCostUsd=null and direct/orchestrated BILLING_CAP_NOT_ESTABLISHED refusal.
The private session contains the real native POST path; the entry gate is closed
in code, with no enable flag or caller-supplied monetary override. The offline
harness exercises the same wire mapping and is marked SYNTHETIC_WIRE_TEST.

Proposed first-call policy mmp061-meta-manual-v1: Standard muse-spark-1.3, no tools,
no streaming/store, reasoning_effort=none, one request, no repair/retry/failover,
128 KiB prompt bytes, 16,384 output tokens, 2 MiB response, 180s request deadline,
240s session TTL. Target file limits remain 64 files / 256 KiB each / 1 MiB total.
These are application proposals, not provider-default assertions. Whole public
PHP fits the prompt, unlike legacy 2048-byte/128-output-token probe limits. Output
cap covers reasoning as documented; none avoids spending this pilot on reasoning.

Input-token caveat: no verified provider tokenizer/preflight token-count API is
implemented. The adapter enforces prompt bytes before sending and validates at
most 65,536 input tokens in returned usage; it does NOT claim this is a guaranteed
pre-dispatch token cap. Before paid admission, agree to this bounded-byte policy
or provide an official tokenizer for a real pre-dispatch input-token guard.

Estimates use dated Standard tariff snapshot meta-standard-2026-10-29 and exact
API input/cache/output counts. Missing usage/cache stays UNKNOWN/null; charged
cost is always null because no billing settlement endpoint is integrated. Unknown
usage prevents candidate writing. Unknown charge prevents any second call. Rates
are never treated as a bound or invoice; they need reconfirmation for live time.
Repair request encoding includes only prior own output and existing public codes;
this pilot session allows only the first generation. A two-call experiment needs
new approval and resolution of charge uncertainty, not an automatic retry.

## Proposed versioned paid policy decision (NOT_IMPLEMENTED)

Both owners plus independent reviewer must explicitly approve a new discriminated
manual-only policy, e.g. RunConfigV2.modelBudget.kind=manual-paid-no-usd-cap-v1,
separate from existing guaranteed-USD reservations. Record USD cap as null with
MONETARY_CAP_UNSET and disclose possible actual charges: finite token/request caps
reduce activity but **do not guarantee a monetary ceiling**. Preserve existing
RunConfig and paid admission unchanged for all current callers.

The new admission must be scoped to an exact reviewed repository SHA, named
provider/model/Standard account, public source/context/manifest SHA, single manual
run and short expiry. It needs explicit Vladimir and Ilia decision references and
independent code-review reference, not a CLI boolean. Keep a finite request ledger
and no-send/pre-send/may-have-sent/response-received states; after uncertainty,
no second dispatch. Preserve usage estimates separately from charged/null and
never label this paid session synthetic. Owner acceptance must also settle the
input-token caveat above. No such capability is issued by this PR.

## Next activation sequence

1. Independent review of this new exact-SHA diff, especially native transport,
   preflight guard and model/API metadata split. Current earlier APPROVED does not
   cover it. Then owner-authorized merge of trusted code; no self-merge here.
2. Configure required reviewers/prevent-self-review and main-only environment;
   authorize one read-only dispatch at the reviewed main SHA. No paid POST in it.
3. Review actual preflight receipt and explicit joint paid-policy decision. Only
   then implement/integrate changed shared admission and complete live E2E receipt
   correlation/run configuration, preserving existing real Docker Oracle.
4. Separately authorize exactly one paid dispatch. Record candidate SHA and actual
   build/HTTP/SQLite outcomes, positive/negative controls and independent cleanup.

runPublicMigration's live execution branch remains dormant pending step 3. No
unreviewed paid activation or new Docker proof is run in this increment. The
acceptable intermediate result is tested actual transport/codec + protected
preflight, not a claim of completed live E2E. Historical hosted receipts stay intact.
