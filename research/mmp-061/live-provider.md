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
