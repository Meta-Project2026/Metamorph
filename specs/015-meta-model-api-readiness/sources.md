# Primary-source verification - 2026-10-28

Checked public documentation on this date, not either owner's dashboard. High
confidence means the claim was directly present on the linked page; it does not
prove account-specific entitlement, credits, availability or a settled bill.
Prices may change; no publisher pricing-update date was shown (UNVERIFIED).

| Claim | Primary source | Confidence / boundary |
| --- | --- | --- |
| Meta Model API, distinct from self-hosted Llama/third-party services | [Overview](https://dev.meta.ai/docs/overview) | HIGH; actual account access not tested |
| HTTPS api.meta.ai/v1; Bearer MODEL_API_KEY; models, Responses, Chat routes | [API reference](https://dev.meta.ai/docs/api-reference) | HIGH; no authenticated call performed |
| Host environment/secret-store key; keep it out of browser/Git | [Authentication](https://dev.meta.ai/docs/authentication) | HIGH; no key value read into reports |
| GET /v1/models; response catalog object/data with model id/object/created/owned_by | [List models](https://dev.meta.ai/docs/api-reference/models/list-models), [catalog schema](https://dev.meta.ai/docs/api-reference/models/schemas) | HIGH; catalog cannot establish billing/credits |
| Standard content is not used for model training; Contributor permits training | [Pricing/modes](https://dev.meta.ai/docs/pricing-rate-limits) | HIGH; Standard does not mean zero retention |
| Standard Spark1.3/1.2/1.1 and Wonder1.0 documented; only Spark1.3 enabled here | [Pricing/models](https://dev.meta.ai/docs/pricing-rate-limits) | HIGH docs; actual entitlements UNVERIFIED |
| Spark Standard USD per million: input1.25, cached0.15, output4.25; Wonder4.00/0.20/20.00 respectively | [Pricing](https://dev.meta.ai/docs/pricing-rate-limits) | HIGH snapshot; estimates, not account bills |
| Team-scoped rate limits and x-ratelimit token/request headers | [Rate limits](https://dev.meta.ai/docs/pricing-rate-limits) | HIGH; publish presence only, no account quota numbers |
| Chat max_completion_tokens includes reasoning; n=1, nonstreaming, JSON schema output | [Chat schemas](https://dev.meta.ai/docs/api-reference/chat-completions/schemas) | HIGH; model/account structured-output behavior remains mock-only |
| Responses max_output_tokens includes reasoning, minimum16; response usage/cache/reasoning breakdown | [Responses schemas](https://dev.meta.ai/docs/api-reference/responses/schemas) | HIGH; Responses researched, codec selects simpler Chat protocol |
| Error envelope, 401/402/403/429/5xx; retry guidance exists | [Error handling](https://dev.meta.ai/docs/error-handling) | HIGH; pilot deliberately makes no retries and copies no error message |
| SDK compatibility with OpenAI/Anthropic clients | [SDKs](https://dev.meta.ai/docs/sdks) | HIGH; no SDK added/default retries relied upon |
| Spend Limits emails do not cap usage or liability | [Spend limit alert](https://dev.meta.ai/help/billing/spend-limit-alert) | HIGH; BILLING_CAP_NOT_ESTABLISHED, not fixed by local budget |
| Threshold/monthly automatic payment may apply | [API billing](https://dev.meta.ai/help/billing/api-bill) | HIGH; no owner-specific payment/charge-through check |
| Promotional credits can expire under account/offer terms | [Terms, section13](https://dev.meta.ai/legal/terms-of-service) | HIGH general terms, updated2026-10-09; these owners' credit type/expiry UNVERIFIED |
| Team usage tracks tokens/requests by model/date, including Playground | [Usage](https://dev.meta.ai/help/usage-and-limits/api-usage) | HIGH; no billing dashboard inspected |

The reviewed docs do not establish reliable idempotent billing after timeout or
an authenticated financial settlement endpoint for this implementation. Mark
these NOT_ESTABLISHED. No auto retry, SDK, fallback account or unknown hosted tool
cost is accepted as a substitute. Official Responses schemas cap reasoning within
output tokens, but this fact alone does not establish a provider hard USD cap.

Only canonical links without team/project query IDs are recorded. No dashboard,
full invoice, credential prefix/length, raw header/body or private source was saved.
