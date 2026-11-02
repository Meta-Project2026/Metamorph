# MMP-129 — owner-approved public request identity disclosure

Refs [#129](https://github.com/Meta-Project2026/Metamorph/issues/129), #61,
#115, #116, #120, #125, #126, and [Arena research PR #128](https://github.com/Meta-Project2026/Metamorph/pull/128).

**Owner decision:** 2026-11-02, Vladimir: `В 129 принимаю вариант А`.
This authorizes the narrow disclosure of an existing HTTP-service interface obligation,
**not a change to PHP source semantics, the Oracle, corpus, production verifier, scoring, custody,
GitHub workflow or paid budget**.

## Contract delta

`packages/agent-real/src/migration-context.mjs` now carries one
`target.httpRequestIdentity` description requiring the generated HTTP service
to echo an incoming `x-request-id` header in its response without creating a new
identity. This addresses a statically verified previously undisclosed
transport protocol, not hidden G4 data or expected test answers. The known-good
fixture and the original GLM candidate/repair remain immutable.

## Verification and honest limits

The existing hosted test file `packages/agent-real/test/mmp120-generation-readiness.test.mjs`
contains a new no-network/no-Docker regression verifying the wrapper requirement,
its placement only in `context.target`, its single occurrence, absence from the
original source/function inventory and preservation of existing safe
request-format/denial checks.

Run on the exact implementation commit:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
node research/mmp-120/audit.mjs
node research/mmp-120/audit.mjs variants
node research/mmp-069/validate.mjs
node research/mmp-069/check-syntax.mjs
```

Only the CI and independently observed command results count as execution.
The existing `audit.mjs` derives exact serialized production request
`sha256`, UTF-8 byte length, conservative input-token projection, and cost
estimate; the new hosted test prints **only these safe numeric/digest fields**
with prefix `MMP129_SAFE_REQUEST_METRICS` (never the request, PHP source,
model payload, credentials or private evidence).
These values are valid only at the exact inspected commit. **No request or
Docker execution is performed by this change.**

Historical `55c7b844…` body SHA and old #100 owner authorization are invalid for
a future changed prompt. Update #116 only with a **fresh exact-main immutable
authorization card** after the implementation is independently reviewed and
merged; separately verify tariff expiry 2026-11-05T00:00:00Z and explicit
estimated-budget selection. An estimate is not a provider-side spending cap.

**HOLD:** no Meta GET/POST, `workflow_dispatch` (even `validate_only`),
additional candidate repair, Docker diagnostic attempt, new GitHub artifact,
owner key use or G4 ingestion is authorized here. #125 remains separate;
#115 retains operational custody acceptance; #116 stays HOLD;
#61 PRODUCT_NOT_ESTABLISHED.
