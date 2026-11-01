# MMP-100 — exact-main offline paid-v2 preflight

**2026-11-01 · NO_GO · OWNER_DECRYPT_NOT_VERIFIED.** This is an offline
decision package for one hypothetical later owner-authorized migration POST,
not permission to dispatch. Tracking: [#100](https://github.com/Meta-Project2026/Metamorph/issues/100).

Audited main: `493dcb4b059b63d473a9bfbc3d083ea332ae7af4`. New branch:
`codex/mmp-100-offline-readiness`. This package changes documentation and safe
JSON only. Runtime, prompt, admission, tariff, workflow, benchmark, Oracle and
worker recipe remain unchanged. Root overview documents contain historical
claims; the code and observed evidence below establish this snapshot.

## Decision and outstanding gates

| Gate                                   | Observed state                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Current-main Fast CI                   | Node22/24 SUCCESS, run41263638430                                                                             |
| PR98 merge ancestry and code           | Accepted head195c529 is an ancestor; its entire tree equals main493dcb4, both checks exit0                    |
| Real Docker/age evidence               | Accepted exact PR98 head195c529, run41254318570 SUCCESS; not a new execution on merge SHA493dcb4              |
| Real production request reconstruction | Existing audit entrypoint exit0; repeated under network-deny with zero attempts, no MODEL_API_KEY in child    |
| Public tariff and policy expiry        | Rates match on1November; expires2026-11-05T00:00:00Z; must recheck before any future dispatch                 |
| Owner-local decryption                 | **OWNER_DECRYPT_NOT_VERIFIED**; no successful owner attestation supplied                                      |
| This PR / final merged-main card       | **PREMERGE_PROVISIONAL**; independent review, owner-approved merge and new read-only exact-main audit pending |
| One-POST owner authorization           | **NOT_GRANTED**; old historical authorization is consumed                                                     |

The owner challenge alone cannot authorize a POST. All gates, including current
tariff, fresh protected-main policy, exact postmerge identity and a separate
explicit one-attempt authorization, must be satisfied before readiness can be
`READY_FOR_OWNER_AUTHORIZATION`. Main/policy drift invalidates a final card as
`STALE_SHA_NO_GO`; expired or changed pricing gives `TARIFF_EXPIRED_NO_GO` or
`TARIFF_CHANGED_NO_GO`. Do not modify policy to bypass a refusal.

## Request and cost, recomputed from production

[request-audit.json](request-audit.json) is an allowlisted projection of the
actual `research/mmp-086/audit-request.mjs` execution, not a mock encoder.
`prepareMetaMigration` and `bindMigrationContext` produced these identities:

| Item                                   | Actual value                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Request SHA256                         | `55c7b8442814b6dfb3a273d45063553ea00e4466046945fd72fd7ea2f38d5d5d`                                |
| Context SHA256                         | `21415d8b4ea38ad0bfcab92c3632777e30e36a8e3c74b17d95ec9abef8a5c345`                                |
| Source commit                          | `d272170d0aecbd28eb5b13e272d9dd11d545b66c`                                                        |
| Source archive SHA256                  | `32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4`                                |
| Recomputed manifest SHA256             | `d800a9a5e874545040438d4dce822da6e0d6b71fb094bcac7f06a6ad05610fd4`                                |
| Recomputed canonical Git recipe SHA256 | `f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3`                                |
| Serialized request / message bytes     | 22,762 /21,209 UTF-8 bytes                                                                        |
| Model and mode                         | `muse-spark-1.3`, Standard, `reasoning_effort=low`, n1, non-streaming, no tools/search/fallback   |
| Conservative input estimate            | 22,762×4+32,768 =123,816 tokens; not an exact tokenizer count                                     |
| Output ceiling                         | 16,384 tokens, including reasoning usage                                                          |
| Input-plus-output projection           | 140,200 tokens, below the1,048,576 context bound                                                  |
| No-cache projected cost                | (123,816×1.25+16,384×4.25)/1,000,000 = **$0.224402**                                              |
| Proposed future pre-send selector      | `max_estimated_usd='0.25'`, one allowed workflow choice; not owner consent or a provider hard cap |
| Request / session deadline             | 180,000 /240,000ms; workflow job35minutes                                                         |

Historical hashes and estimate happen to match after actual recomputation;
[comparison evidence](evidence/historical-comparison.json) records this rather
than assuming it. The observed-input receipt ceiling65,536 is a post-response
validation constraint, distinct from the123,816-token pre-send projection; a
rejected response can still have incurred a charge. Actual tokenizer usage,
cache hits, available credits and settlement are unknown.

[Official pricing](https://dev.meta.ai/docs/pricing-rate-limits), checked
1November2026, lists Standard rates of$1.25/M input, $0.15/M cached input and
$4.25/M output. [Models](https://dev.meta.ai/docs/models) identifies the
non-Contributor model; [reasoning](https://dev.meta.ai/docs/reasoning) supports
low and bills reasoning within output usage. The
[Chat Completions parameters](https://dev.meta.ai/docs/protocols/chat-completions)
support `max_completion_tokens` and n1. These are public documentation checks,
not authenticated model-catalog, entitlement, balance or API probes.

## Production path and security review

1. `guard.mjs` verifies event/ref/actor/exact SHA and current GitHub main/environment
   metadata. The paid job additionally requires the protected main, owner actor,
   Environment `META_API_KEY`, signed GitHub-hosted OIDC identity, first run
   attempt and exact workflow SHA. This preflight read only GitHub policy
   metadata; it issued no OIDC capability and did not run either entrypoint.
2. Trusted install/build and pinned age preparation precede mapping the Meta
   secret. Only the generation step maps `MODEL_API_KEY`. Production native HTTPS
   uses the fixed Chat Completions destination. An opaque single-use admission
   and exclusive local attempt ledger are consumed before a possible send.
   Generation has one attempt, zero repairs, no retry or provider fallback.
3. Output is strict bounded JSON, then canonical source admission and restricted
   candidate writing. Only `src/**/*.ts`,64files,256KiB/file,1MiB total and the
   required `src/main.ts` are admitted. Candidate text never runs on the host.
4. A fresh validation process rejects a mapped model credential. The unchanged
   target is Node24.11.0/TS5.9.3/SQLite3.50.4, strict ES2022/NodeNext; compiler
   phases each12s, outer build35s. Docker is nonroot, network-off, read-only,
   capped at1CPU/256MiB/64PIDs, with separate state. Reference and target state
   stay separate; public HTTP/SQLite comparators are unchanged.
5. The new selector exports only source/manifest/minimal identities for complete
   G1PASS plus finished G2/G3 PASS/FAIL in every mandatory pair. Legacy authentic
   BUILD_FAILED retains source and bounded trusted compiler diagnostics. ERROR,
   timeout, cancellation, incomplete IDs or mismatched head/source/candidate/
   attempt/pair/pack do not open export. Raw Oracle/reference/G4, HTTP/DB,
   provider response, environment and credentials are excluded.
6. Collection/encryption use clean child environments and bounded fixed reads;
   the dedicated pinned age encryptor has no host roots, key, Docker socket or
   network. Gate admission independently rederives bindings, producer outcomes,
   ciphertext SHA/size, normal cleanup and independent finalizer0/0/0. Only
   successful uploader completion can yield `PRESERVED`.

[Current GitHub policy](evidence/github-policy.json) is VERIFIED for audited
main: protected branch, main-only environment, no required reviewers/wait timer.
This is an observation of the current explicit policy, not a new approval or
claim that code hashes supply cryptographic receipt signatures.

## Evidence and limits

[Accepted Docker evidence](evidence/accepted-docker.json) is bound to actual
PR98 head195c529:5positive/regression,28receipt/file,4crypto,6validator and
8process/finalizer controls PASS. Normal preparation/cases/global finalizer
were0containers/0volumes/0emergency removals. Deliberate fault recoveries are
separate; pre-entry Node crash/timeout harnesses prove process boundaries, not
inner tool timers. The owner/project-brain's
[independent final review](https://github.com/Meta-Project2026/Metamorph/pull/98#pullrequestreview-5725969979)
cross-checked those live receipts and accepted the offline slice before merge.
No fresh Docker execution on493dcb4 or this documentation branch is claimed.

HTTP failures also enter G3 in the unchanged Oracle. G2FAIL/G3PASS is
unreachable; the owner accepted HTTP-only coupling with actual G1PASS/G2FAIL/
G3FAIL, complete17HTTP/20SQLite and no DB finding. Other reachable cases passed.

The Windows local recipe hash check initially returned ENVIRONMENT_ERROR:
Git converted only Dockerfile's LF to CRLF. Canonical exact-main Git bytes
recompute the pinned Linux recipe; [both hashes](evidence/recipe-platform.json)
are retained. No trusted file, pin or test was changed to conceal this result.

Production live uploader and owner-recipient decrypt remain NOT_RUN/NOT_VERIFIED.
Ciphertext in this public repository's Actions artifacts is downloadable by
repository readers for seven days, not protected by an owner-only GitHub ACL.
Expiry cannot revoke downloaded copies. Secret-marker filters are incomplete;
host/daemon and no concurrent hostile same-UID/root writer remain trusted.
Runner loss, cancellation, crypto/refusal or upload failure can lose diagnostics;
normal Docker cleanup does not establish secure filesystem erasure.

A timeout may be billed even if no response or receipt survives. Local projected
allowance is not a guaranteed provider-side spending cap; `chargedCostUsd` stays
unknown until authoritative settlement. Original historical candidate and
compiler messages are unavailable; the first BUILD_FAILED root cause remains
UNKNOWN, not reconstructed from its hash.

See [owner instructions](owner-key-checklist.md),
[provisional card](owner-authorization-card-PREMERGE.md),
[validation](validation.md) and [provenance](evidence/provenance.json).
No Meta API GET/POST, workflow/validate-only dispatch, live ciphertext upload,
repair, owner-key access or hidden-G4 access occurred. Product61 remains
NOT_ESTABLISHED; G0/G4 INCONCLUSIVE. Existing notices are retained; no dependency
or external code was added.
