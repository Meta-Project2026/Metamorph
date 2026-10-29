# MMP-078 shared manual paid migration

Owner implementation request: [#78](https://github.com/Meta-Project2026/Metamorph/issues/78),
refs [#61](https://github.com/Meta-Project2026/Metamorph/issues/61),
[#37](https://github.com/Meta-Project2026/Metamorph/issues/37),
[#76](https://github.com/Meta-Project2026/Metamorph/issues/76).
Original main **0b90ecb353cfabed6465760d311991ef7cd8dab6**; PR70/77 merged.
This version supersedes the reviewer prerequisite in historical MMP-061 readiness
documents. It does not ratify the constitution or change a shared Oracle contract.

## Scope and policy

New `mmp078-manual-paid-estimate-v1`, separate from legacy guaranteed-dollar
`ModelProvider`/`runAgent` admission. Ordinary production defaults still refuse
`BILLING_CAP_NOT_ESTABLISHED`; no arbitrary library flag or synthetic harness can
mint a live authorization. The new orchestrator branch uses ModelResponseSchema,
the original restricted source writer/SHA lease, then the unchanged RealVerifier
and its network-off Docker target/reference lifecycle in a fresh process.
The legacy guaranteed-bound API is not given a fabricated estimate as a guarantee.

The initiating owner confirms one possibly billable attempt in workflow_dispatch.
Only barbalatv (85129726) and l1ncolny (338248494), protected exact main HEAD,
run_attempt=1, GitHub-hosted runner and the exact paid workflow are admitted.
RSA-signed GitHub OIDC/JWKS verification binds actor, repository/owner IDs,
workflow SHA, run ID, event, branch, environment and audience. Current repository
OIDC settings were read: use_default=true, use_immutable_subject=true, prefix
`repo:Meta-Project2026@348421102/Metamorph@1434945189`.
No PAT, account switch or second-account approval is needed.

Runtime-branded authorization also binds the immutable public source, context,
manifest, full serialized request SHA, fixed model/tariff and finite projection
budget. Copies/plain objects fail. An exclusive run-ID ledger is fsync'ed before
any possible send; an in-memory consumed bit closes simultaneous-session races.
Actions reruns are blocked, and a second process for the same run cannot reuse
the ledger. This is per disposable run, not a global account spending ledger.

`muse-spark-1.3` Standard, reasoning_effort=low; one POST to the fixed Meta Chat
Completions URL; zero repairs, retries, failovers or tools. <=128 KiB total message
text, <=160 KiB serialized request, <=16384 completion tokens INCLUDING reasoning,
<=2 MiB response, <=180s request, <=240s generation session. Two owners use
independent per-actor concurrency groups (cancel-in-progress=false). GitHub queue
ordering and unlimited queued runs are not promised. Simultaneous runs add spend
and share Meta account rate limits; there is no shared atomic dollar cap.

## Cost projection, not settlement

Official documents rechecked 2026-10-29:

- [Pricing](https://dev.meta.ai/docs/pricing-rate-limits): Standard input/cached/output
  USD **1.25/0.15/4.25 per million tokens**, no tool fees because tools are disabled.
- [Reasoning](https://dev.meta.ai/docs/reasoning): low supported; none rejected;
  reasoning is already part of completion tokens and is not charged twice.
- [Token counting](https://dev.meta.ai/docs/token-counting): responses/input_tokens
  is Responses-specific; this workflow does NOT call it or claim it counts Chat
  Completions. No token-counting or catalog Meta request is made by the paid path.
- [Spend alert](https://dev.meta.ai/help/billing/spend-limit-alert): alerts do not
  stop account spending; actual charges can exceed an alert.
- [GitHub OIDC](https://docs.github.com/en/actions/reference/security/oidc) and
  [issuer metadata](https://token.actions.githubusercontent.com/.well-known/openid-configuration):
  claim names, signing keys, immutable subjects. No OIDC token is logged/stored.

This text-only, single-turn projection budgets **four tokens per byte of the
entire serialized request plus 32768 protocol tokens**. Counting includes developer
text, JSON escaping, roles and the entire output schema (not just PHP characters).
Byte-level text tokenization can decompose a byte to a token; the factor four adds
normalization headroom, and the large additional reserve covers framing. This is
a deliberately conservative engineering estimate, not an official model tokenizer
identity or a provider-guaranteed token/cost cap. Meta says injected steering
context is unbilled. No cached-token discount is assumed pre-send.

Pinned request: 21957 UTF-8 bytes; projected input <=120596 tokens; projected
worst-case cost **(120596*1.25 + 16384*4.25)/1e6 = $0.220377**.
Default allowance $1.00; choices $0.10/$0.20/$0.25/$0.50/$0.75/$1.00. First two
block this workload before send. The tariff expires **2026-11-05T00:00:00Z**;
later runs fail closed until a reviewed tariff update. Rate changes before expiry
are still possible: the owner must recheck published rates before dispatch.

Returned usage must be valid and within local token/projection limits. Estimates
subtract cached tokens from noncached input and count reasoning only once. Missing
usage/cache, malformed output, model mismatch, refusal/truncation, 429, timeout,
cancel or transport error fail closed; no automatic retry. **chargedCostUsd and
totalCostUsd remain null** because no settled billing receipt is integrated.
A timeout/crash/error after attempted send may have been billed. A durable
pre-send UNKNOWN receipt survives an ordinary process crash; runner loss may lose
local artifacts, so a missing artifact never means zero cost or permission to retry.

## Credential and candidate isolation

The new job installs/builds trusted exact-SHA code BEFORE the one network step;
MODEL_API_KEY is mapped from the same Environment secret META on that step only.
The network step does not install/build/test/import/execute generated code. It
validates the API response and writes only admitted candidate TS files. The next
step is a new Node process without MODEL_API_KEY and runs the original Docker
verifier; candidate code runs exclusively in its original bounded network-off
worker, with no key, GitHub token or reference mounts. No secret was added to
agent-workshop-compose, pushes or PR CI.

Only explicit sanitized policy/generation/trial/finalizer JSON and the durable
per-run attempt ledger are uploaded,
with seven-day retention. Raw prompts/responses, candidate source, provider error
bodies, private raw packs, transfer metadata and auth are not public artifacts.
Candidate sources remain transient in runner private directories. The public
receipt retains candidate SHA and real public gate outcomes; a failed or unexecuted
downstream step leaves validation pending, not PASS. Public G1/G2/G3 and original
positive/negative controls are not independent hidden G4. G0/G4 INCONCLUSIVE,
historical private AUDIT_FAIL unchanged, product NOT_ESTABLISHED.

## Settings and operations

See [settings plan/rollback](settings-plan.md), original and reread metadata files,
[owner commands](MMP-078-HUMAN.md), and [validation](validation.md).
The paid workflow also has validate_only=true: the secret-mapped POST step is
skipped, no provider/session is constructed, and real GitHub OIDC admission is
checked in a process without MODEL_API_KEY. Only a sanitized authorization receipt
is produced. This mode performs no Meta request and no candidate generation.

The read-only GET workflow now accepts the no-reviewer/main-only policy; it remains
a separately authorized GET and does not authorize paid inference. This task
performs **Meta GET=0 / POST=0**; no live entitlement or model trial is established.
