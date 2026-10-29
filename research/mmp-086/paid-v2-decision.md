# Second paid trial decision

**NO_GO to request fresh paid authorization now.** Phase A prepares a reviewable
diagnostic contract; it does not authorize a POST or workflow dispatch. Review
the actual offline results and make the owner-private data decision below first.
The original MMP-081 authorization/run 40900698372 is consumed permanently.
No rerun of that Actions run or reuse of its approval is proposed.

Code/request identity under review:
`b421465307d4dde3101ccbc4309660b5884d297e`;
request `55c7b8442814b6dfb3a273d45063553ea00e4466046945fd72fd7ea2f38d5d5d`;
context `21415d8b4ea38ad0bfcab92c3632777e30e36a8e3c74b17d95ec9abef8a5c345`.
Evidence-only delivery commits do not silently replace these execution identities.
The final PR comment pins delivery HEAD and any exact-head validation separately.
Current main is `3fb4772ef9c5d2c659530ae75b3076612eb18a3f`; the PR branch is
not main. **Future reviewed main SHA is NOT_ESTABLISHED**: it must be measured
after independent review/merge and authorized explicitly, never guessed from a
PR code commit or approved now by this executor.

## What would make the next run informative

The actual paid validator is exercised offline in fresh processes. Public
`attempts[].pairs[].compilerDiagnostics` binds sourceSha, candidateSha, attemptId,
pairId and g1Verdict. Entries contain only phase, numeric TS code, admitted
relative path and bounded line/column; count/truncation are explicit. G1 failures
keep BUILD_FAILED, G2/G3 stay unexecuted, and cleanup remains independently checked.
This is new candidate-specific evidence unavailable in the first real run.
It is not proof a new model output will be safely diagnosable.

Diagnostics fail closed to DIAGNOSTIC_UNAVAILABLE for unsafe/ambiguous/oversize
messages, unadmitted/absolute/secret-like paths, malformed headers, bounds
violations, non-compiler faults or absent build evidence. A valid compiler FAIL
with unavailable diagnostics remains FAIL; timeout/environment faults remain
ERROR. Successful builds have no failure diagnostic. Recipe/authenticity checks,
20-entry and 8192-byte sidecar limits remain unchanged.

## Owner-private diagnosis gate

Existing private source leases and sealed packs contain exact candidate bytes
and raw build phase receipts while the runner lives. The matrix checks their
existence and candidate hash *after the real paid validator CLI exits*, without
publishing the bytes. That establishes a place for trusted in-run debugging
before cleanup. Existing finalization reaps containers/volumes, not those private
directories; GitHub later destroys the ephemeral VM.

The current paid workflow has no interactive private review, durable private
export, or source-aware diagnostic analysis step. A human cannot retrieve the
candidate after the runner is gone. Codes/positions can distinguish compiler
classes but cannot guarantee an exact fix, identify the missing import's text,
or reconstruct an arbitrary candidate. Current state is insufficient for a
promised source-level investigation of another G1 failure.

Preferred next step is an independently reviewed trusted in-run analyzer if its
strictly allowlisted structural findings can answer the owner's precise
diagnostic question. It must operate without credentials, before ephemeral
cleanup, and publish no source, raw errors, response or private Oracle data.
No model retry or model-driven repair is part of that option. It is a separate
small change with synthetic integration tests, not implemented/assumed here.

If later source inspection is required, seek a **separate explicit owner data
decision** for one encrypted candidate package. Proposed minimal scope:

1. Owner supplies an X25519 age recipient public key; independently verify and
   pin its fingerprint, exact recipient bytes and encryption tool/version/hash.
   No key is assumed to exist. The private key stays with the owner, never in
   Actions, candidate workers, logs or Git.
2. Trusted secret-free validator packages only the admitted candidate and its
   trusted compiler phase receipts, plus head/source/candidate/attempt/pair
   identity and per-file SHA256 manifest. Exclude credentials, provider response,
   reference state and all Oracle/held-out packs. Keep plaintext in owner-only
   ephemeral paths and encrypt before any upload using authenticated encryption.
3. Require independently observed synthetic end-to-end encryption/decryption
   byte/hash equality, wrong-key refusal and ciphertext-tamper rejection with the
   pinned recipient. Publish only ciphertext and minimal allowlisted identities
   if that exact additional egress, access and retention are approved. Decryption
   never imports/runs candidate code; future reproduction uses isolated workers.
4. On missing key, encryption failure or manifest mismatch, fail closed: upload
   no plaintext or raw stderr; report preservation unavailable. Do not run a paid
   trial on the assumption preservation works.

Recipient: **NOT_PROVIDED**. Encryption/decryption tests: **NOT_RUN**. Durable
preservation: **NOT_CONFIGURED**. This proposal is not implemented, a reviewed
key, an access-control claim about public GitHub artifacts, or approval to export.
The proposed recipient/encryption format is documented by the
[age project](https://github.com/FiloSottile/age) and its
[format specification](https://age-encryption.org/v1). AEAD integrity does not
authenticate a sender; after decryption, check the manifest against the trusted
public exact-run head/source/candidate identities. No cryptography is reimplemented.

## Exact later one-shot proposal, conditional on resolving the gates

After review, any needed diagnostic change and fresh tests, pin newly merged main
and re-run the request audit. Owner approval must name that exact main SHA,
request/context identities, one manual protected-main `meta-paid-migration.yml`
dispatch, one muse-spark-1.3 Standard POST, zero retries/repairs/failovers/reruns,
and the private-data option. No action is dispatched in Phase A.

At this request: 22762 serialized UTF-8 bytes; conservative input projection
123816 tokens (4*bytes+32768); output ceiling 16384 including reasoning;
projected worst-case estimate **$0.224402**. Propose allowance **$0.25**.
It is a pre-send engineering estimate, not a provider-guaranteed charge ceiling
or an exact tokenizer bound. $0.10/$0.20 choices block before send. 65536 observed
input tokens is checked after response. 180s request / 240s generation session,
<=2 MiB response; existing 35-minute job and worker budgets stay unchanged.
Timeout/crash after a possible send may be billed; never retry based on absent
artifacts. chargedCostUsd and totalCostUsd stay null without settlement evidence.

Public documentation rechecked 2026-10-29: Standard Spark input/cached/output
$1.25/$0.15/$4.25 per million at
[Meta pricing](https://dev.meta.ai/docs/pricing-rate-limits). Reasoning is included
in billed output and low is supported at
[Meta reasoning](https://dev.meta.ai/docs/reasoning). The provider says spend
alerts do not impose a hard usage cap at
[billing help](https://dev.meta.ai/help/billing/spend-limit-alert).
These were public documentation reads, not API catalog/inference calls. Recheck
tariff immediately before future approval; current policy expires
2026-11-05T00:00:00Z. No account entitlement or settled bill was accessed.

The key remains mapped only in the single trusted POST step; build/install occurs
before mapping, and fresh-process validation runs without it. Workers keep
network off and receive no token/reference mounts. Changes here are limited to
generation context, one toolchain regression test, a descriptive test title and
`research/mmp-086/`. No paid workflow, recipe/pins, corpus, comparator, Oracle,
security policy, cost admission or CI expansion is included.

If the model fails G1 again: consume the authorization, stop paid work, preserve
only the approved evidence, classify actual candidate-specific codes/positions,
and reproduce from the exact privately available bytes if authorized. Otherwise
record SOURCE_UNAVAILABLE/DIAGNOSTIC_UNAVAILABLE and the next discriminating
offline experiment. Never attribute its error to MMP-081, invent TS2322, promote
FAIL/ERROR to PASS, or claim product acceptance.
