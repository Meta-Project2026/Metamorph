# PREMERGE_PROVISIONAL — NO_GO — not a spending authorization

**Prepared 2026-11-01. OWNER_DECRYPT_NOT_VERIFIED.** This card describes one
hypothetical future attempt. It does not authorize this branch, the audited
base, a dispatch, validate-only, rerun, retry or model POST.

This documentation PR will itself change main. After independent ChatGPT
review and owner-approved merge, rerun the existing read-only audit against
the new exact merged main and publish the final card **as a comment on issue100**.
Do not commit the final card: that would change main again. No final postmerge
card is published by this premerge task.

## Audited comparison identity — must be recomputed after merge

| Field                                      | Current audited value                                              |
| ------------------------------------------ | ------------------------------------------------------------------ |
| Repository                                 | `Meta-Project2026/Metamorph`                                       |
| Audited base main; not future reviewed_sha | `493dcb4b059b63d473a9bfbc3d083ea332ae7af4`                         |
| Production workflow                        | `.github/workflows/meta-paid-migration.yml@refs/heads/main`        |
| Request SHA256                             | `55c7b8442814b6dfb3a273d45063553ea00e4466046945fd72fd7ea2f38d5d5d` |
| Context SHA256                             | `21415d8b4ea38ad0bfcab92c3632777e30e36a8e3c74b17d95ec9abef8a5c345` |
| User message SHA256                        | `60a14a7d0881b3919dd970fdf2f5f976fa1fca20a28ceb0aefccd80f2c0b4b4e` |
| Source commit                              | `d272170d0aecbd28eb5b13e272d9dd11d545b66c`                         |
| Source archive SHA256                      | `32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4` |
| Manifest SHA256                            | `d800a9a5e874545040438d4dce822da6e0d6b71fb094bcac7f06a6ad05610fd4` |
| Canonical Git recipe SHA256                | `f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3` |

Developer-message and response-schema hashes, source-file hashes and byte
counts, actual audit exit and code/evidence hashes are in
[request-audit.json](request-audit.json) and [provenance](evidence/provenance.json).
Raw prompts, PHP/TS content, compiler messages and provider replies are absent.

## Proposed one-attempt limits — no consent granted

| Setting                     | Proposal from the unchanged production policy                                 |
| --------------------------- | ----------------------------------------------------------------------------- |
| Model                       | `muse-spark-1.3`, Standard; no Contributor model                              |
| Action                      | One manual dispatch, one possible POST, one candidate                         |
| Reasoning / response        | `low`; strict JSON changes-only schema; n1; stream=false; store=false         |
| Tools / web / fallback      | None; no alternative model/provider                                           |
| Max output                  | 16,384 tokens, including reasoning                                            |
| Prompt/request bytes        | 21,209/22,762 UTF-8 bytes; message cap131,072                                 |
| Conservative input estimate | 123,816 tokens from serialized bytes×4+32,768 framing allowance               |
| Request / session timeout   | 180,000/240,000ms; job35minutes                                               |
| Repairs / retries / reruns  | Zero; a possibly sent or billed timeout consumes the attempt                  |
| Pre-send selector           | `max_estimated_usd='0.25'` from workflow choices0.10/0.20/0.25/0.50/0.75/1.00 |
| No-cache projected USD      | `$0.224402`; not actual usage, settled charge or provider hard cap            |
| Charged USD                 | UNKNOWN/null until authoritative settlement                                   |

Proposed future workflow inputs, **to be entered only after separate explicit
owner authorization of a new exact merged main SHA**:

```text
reviewed_sha = <new exact independently reviewed merged-main SHA>
confirm_paid = I_ACCEPT_ONE_PAID_ATTEMPT_NO_HARD_CAP
max_estimated_usd = 0.25
model_provider = meta
validate_only = false
```

This is descriptive text, not a dispatch command. The0.25 selector gates a
local estimate before send; it cannot enforce a provider dollar ceiling.
Actual usage/cache/billing can differ, and transport timeout or lost receipts
do not establish that the provider charged nothing. Even schema/usage rejection
after a response can follow a billed request. No repair or repeat is implied.

## Pricing and validity

[Official pricing](https://dev.meta.ai/docs/pricing-rate-limits) checked
2026-11-01 matches the current Standard policy: input$1.25/M, cached$0.15/M,
output$4.25/M. Policy snapshot `meta-standard-2026-10-29` expires
**2026-11-05T00:00:00Z**; the check is strictly before expiry.

Recheck current official rates and actual PAID_POLICY at final-card creation
and actual dispatch. A changed tariff is `TARIFF_CHANGED_NO_GO`; an expired
policy is `TARIFF_EXPIRED_NO_GO`. Do not extend expiry or change guard values in
this task. A tariff-code change requires a separate reviewed merge and a new
exact-main audit. If main or policy changes after a final card, that card is
`STALE_SHA_NO_GO`. Public docs do not prove account entitlement, credit or quota.

## Preservation and possible outcomes

| Actual future outcome                                                   | Expected evidence and limit                                                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Authentic G1 BUILD_FAILED                                               | G1 FAIL, unexecuted G2/G3 INCONCLUSIVE; eligible bound `mmp089-private-diagnostics-v1` source+compiler package if encryption and cleanup succeed |
| G1 PASS, completed parity FAIL                                          | Bound candidate-only `mmp097-candidate-only-v1`; actual failure/coverage retained; HTTP findings can make both G2/G3 FAIL                        |
| All public G1/G2/G3 PASS                                                | Same candidate-only export; product/G0/G4 acceptance is still separate                                                                           |
| G1 ERROR, timeout, cancellation, incomplete/missing/mismatched evidence | No eligible export; NOT_APPLICABLE/REJECTED and original ERROR/INCONCLUSIVE remain                                                               |
| Crypto, normal-cleanup, independent-finalizer or upload failure         | No plaintext fallback and no false PRESERVED; diagnostics may be unavailable                                                                     |
| Generation/transport/runner failure                                     | Candidate or receipt may be unavailable, charge may be UNKNOWN; no automatic rerun                                                               |

Every eligible export requires exact run/head/source/candidate/attempt/pair and
all mandatory pack bindings, admitted source, complete IDs, normal cleanup and
independent finalizer **0containers/0volumes/0emergencyRemoved**. Only admitted
TS/manifest/minimal identity is exported for G1PASS; legacy FAIL adds bounded
trusted compiler receipts. Never export raw reference/Oracle/G4, HTTP/DB data,
provider reply, tokens, environment or unrelated files. Public ciphertext
artifact is conditional; no successful live upload has yet been observed.

Pinned public recipient:
`age1yvf40njrznnr7emg5j76azu62579z38gzh2jqss72l2u9308n5essrvy6f`.
Pinned production age:v1.3.2. GitHub artifact contains only
`candidate-diagnostics.age`, retained seven days in this public repository.
Repository readers can download ciphertext; this is not an owner-only GitHub
ACL. Private-key custody controls plaintext access. Expiry cannot revoke copies;
runner destruction/normal cleanup are not secure-erasure guarantees.

## Blocking checklist

- [ ] Owner personally reports successful harmless challenge using the pinned public recipient, expected public challenge hash and exact age version.
- [ ] This PR receives independent exact-SHA review and an owner-approved merge.
- [ ] Fresh postmerge main, CI, request/context/source/manifest/recipe and policy are rechecked read-only; final issue100 comment identifies them without another commit.
- [ ] Tariff remains matching and unexpired at expected dispatch; current hosted main/environment/signed admission succeeds naturally.
- [ ] Owner separately authorizes exactly one possibly billable POST on that final SHA, accepting the estimate-only limit and no retry/repair/failover.

Until then: **NO_GO**. Historical run40900698372 cannot be reconstructed from
its candidate digest; original source/compiler cause remains UNKNOWN. Product61
NOT_ESTABLISHED; G0/G4 INCONCLUSIVE. No billable action was performed here.
