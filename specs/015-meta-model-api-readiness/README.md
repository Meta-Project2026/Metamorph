# MMP-037 Stage A: delivered readiness, live admission BLOCKED

**BILLING_CAP_NOT_ESTABLISHED.** Official Meta documentation says spend limits
are alerts, not hard financial caps. `createMetaModelApiProvider()` is opt-in,
paid and maxRequestCostUsd=null. The unchanged Agent rejects it before generate.
Direct generate also refuses. No runtime flag or caller-supplied dollar number
can activate paid transport. This is not a production-ready live provider.

[Verified sources/date](sources.md), [scope](spec.md), [plan](plan.md),
[validation](validation.md) and [safe status](status.json). Refs #37; conservative
settled-cost work stays separately in #40. No source from Issue44 is used.

## Delivered interfaces and security

- Existing createUnconfiguredMetaProvider remains unchanged/no-IO.
- preflightMetaModels explicitly lists models from one trusted host environment
  key. Only fixed HTTPS GET api.meta.ai/v1/models is implemented in production,
  native TLS with agent:false, no environment proxy/global fetch/redirect/retry.
  Factory rejects baseURL, endpoint, proxy, Contributor/off-list model or unknown
  settings before credential access. Only muse-spark-1.3 is enabled; Wonder is a
  documented later option, not fallback. owner-a is default; no second-account
  request occurs automatically.
- Only the trusted host reads MODEL_API_KEY. No browser, worker, candidate,
  credential file discovery or dashboard scraping. Catalog identities and raw
  responses/headers stay out of reports; reports use aliases, selected model,
  fixed codes, counts, HTTP status, latency and rate-limit-header presence.
- prepareMetaCodeRequest/decodeMetaCompletion are pure codecs for explicitly
  public synthetic input, never filesystem/Oracle data. Max input2048UTF8 bytes,
  output128tokens, response64KiB,8files/4KiB each/8KiB total and5s per operation.
  One nonstreaming Chat completion, strict JSON output, n=1/store=false, no tools,
  files or URLs fetched. Decoding also enforces existing ModelResponse/ModelUsage,
  protected src/**/*.ts paths, duplicates, JSON duplicate keys and token arithmetic.
- createOfflineMetaModelApiProvider requires an injected mock transport, declares
  billing:synthetic, reads no key and has no production POST fallback. It must
  never be described as real Meta usage or real migration. No generated source
  is compiled/imported/executed on the host; codecs return inert source text.
- Missing usage/cache counts remain null in the pure decoder. The synthetic
  exchange refuses UNKNOWN_PAID_USAGE. Missing/incompatible response identity is
  rejected, never fabricated. Snapshot token estimates are not settled charges;
  missing authoritative billing remains null. Neither estimate nor this mock
  cap changes conservative runAgent reservations. No Issue40 policy is changed.
- Timeout/abort/disconnect/429/5xx/bad JSON allow at most one operation and no
  retries/failover. A sent operation with unavailable receipts is classified as
  UNKNOWN_PAID_USAGE. Pure decoding never prints errors/source/raw diagnostics.

## Local commands (after trusted workspace build)

```
pnpm --filter @metamorph/agent test
pnpm --filter @metamorph/agent meta:preflight
pnpm --filter @metamorph/agent live:probe
```

Preflight defaults to owner-a. The key must already be set by that owner in the
trusted local process environment, never sent in chat or command-line arguments.
Missing key returns NOT_RUN/MISSING_LOCAL_CREDENTIAL with0requests and exit2.
A supplied key enables only this explicitly requested read-only GET. Offline CI
never calls it. Owner-b may perform their own local preflight with
`pnpm --filter @metamorph/agent meta:preflight owner-b` using only their own locally
provided key, after deciding it is necessary; no cross-account failover or pool.

live:probe sends0requests and exits2 with
LIVE_PROBE_NOT_RUN_PENDING_OWNER_APPROVAL/BILLING_CAP_NOT_ESTABLISHED. It is a
reviewable stop command, not a working billable POST transport. Even a correctly
spelled approval string cannot bypass the missing hard cap. A future bounded
public text-only probe would cap output32tokens/one call/no retries, and requires
separate reviewed financial admission and production transport before use.

## Owner-only account verification (repeat independently for each alias)

1. Sign into the official Model API dashboard yourself. Confirm intended team
   scope and selected Standard model access; do not publish team/account/key IDs.
   Different keys may share team quotas. Keep the two reported accesses separate.
2. Open Billing and inspect the credit/offer terms displayed for that account.
   Record locally whether the reported150USD is promotional or paid balance,
   exact expiration/timezone, eligible Standard models/regions and remaining
   applicability. If absent/ambiguous, request clarification from official support
   yourself; do not infer from a usage badge. Public status is only
   OWNER_CONFIRMATION_REQUIRED until verified.
3. Inspect attached payment method, automatic top-up/charge-through, payment
   threshold, taxes and monthly collection behavior. Check whether credit expiry
   or exhaustion can create a payable balance. An email Spend Limits alert is
   not a hard cap. Do not disable controls or treat the two reports as300USD.
4. Check Usage by model/date locally, then Payment activity/receipts as applicable.
   Usage-token estimates are not an invoice. Keep invoices, screenshots, balances
   and personal identifiers private; provide only a sanitized decision/status to
   the trusted owner-side review process.
5. A future Stage B needs explicit responsibility for cost/credits, proof of an
   enforceable per-account financial stop and separate exact consent. Without it:
   BILLING_CAP_NOT_ESTABLISHED and no generation, even if credits are available.

Proposed future consent formula (not a current request or financial guarantee):

```
I AUTHORIZE MMP-037 STAGE B: owner-a; one text-only request; standard model muse-spark-1.3; hard max $0.25; no retry
```

The owner must also verify credit validity/expiry, spending responsibility and no
charge-through beyond the cap. Today's official API does not offer the required
hard spend cap; consent alone is insufficient. No paid approval is inferred from
reported150USD credits. No Stage B approval is requested during Stage A.

AI_GENERATION for migration benchmark NOT_RUN; G0/G4 INCONCLUSIVE;
product NOT_ESTABLISHED. A one-text probe cannot establish benchmark parity,
formal held-out isolation or authorize a live migration. Those require a separate
owner-approved stage and independent review. No merge/Issue37 closure here.
