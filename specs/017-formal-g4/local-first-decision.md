# MMP-038 — Local-first architecture direction and ratified retention term

Date: 2026-10-28. Related: #38, #52, PR #51, #26, #34.
Status: **LOCAL_FIRST_DIRECTION_ADOPTED; 180_DAY_RETENTION_AND_DAY_90_RESTORE_APPROVED_BY_BOTH_OWNERS_AS_REPORTED_BY_REQUESTER; AUTHENTICATED_JOINT_RECORD_PENDING; FORMAL_G4_NOT_AUTHORIZED**.

The requester explicitly confirmed on 2026-10-28 that **both Vladimir and Ilia agreed to the local-first direction** and **definitively approved a minimum 180-day evidence-retention term and a mandatory day-90 restore test**. This records a reported unanimous owner policy decision, **not** an independently authenticated GitHub sign-off by Ilia: as checked at this revision, no separate review/comment from him on PR #53 is recorded. Do not impersonate or sign on his behalf. The exact storage media, custodian, key holders, concrete run admission and formal G4 acceptance remain separate decisions.

## Architectural direction

1. **Fully local capable by default.** The PHP-to-TypeScript engine, candidate build, real PHP 7.4 reference, TypeScript worker, trusted HTTP/typed-SQLite Oracle, public differential tests, Docker isolation, G0–G4 infrastructure and local sealed evidence must not require a cloud provider, hosted runner, external storage or remote model call. All necessary pinned local runtime dependencies must be preinstalled for offline use. Actual independent G4 may use a separate, independently administered physical/local machine; a single developer's local root privileges do not prove independence.
2. **Model-provider choice.** Local inference through a separately installed backend (e.g. Ollama or llama.cpp) supports offline use, with hardware/quality limitations. Meta Model API and other remote providers are optional opt-in transports with explicit network and cost admission. Existing fail-closed paid-generation controls stay intact; no implicit paid calls.
3. **GitHub optional for execution.** Git history and local work are usable offline. GitHub sync, push, PRs and independent review are online collaboration steps, not runtime prerequisites. Never push hidden test cases, expected results, raw private receipts or secrets.
4. **Local-first private evidence.** Seal complete *and partial* exact-byte raw evidence and independently verifiable SHA-256 indices outside candidate/model workspaces, with frozen identity, attempt history, teardown receipts, prior witnessed/blinded commitments and restricted review. The storage interface can later expose cloud/S3-compatible adapters but they are not mandatory and cannot weaken required acceptance evidence.
5. **Two independent encrypted durable copies for formal G4.** Default deployment target: custodian-controlled encrypted primary local disk/NAS plus physically separate encrypted offline removable medium under independently controlled custody. At least one copy is off the disposable runner; separate failure domains and recoverable key escrow are mandatory for the formal profile. Two folders, two mounted disks under the same administrator, or two drives in the same location are not sufficient on their own.
6. **Real immutability and restore.** Local permissions/snapshots/filesystem immutable flags are not WORM against a privileged administrator. Require a separately witnessed append-only identity/journal, immutable versions or protected media, checks of owner/admin access, anti-tamper cases, and independent exact-byte restore in a clean environment *after* worker teardown. If required assurance is unavailable, formal G4 is BLOCKED, not PASS.
7. **Approved retention parameters (binding architecture policy):** keep complete **and partial/failed** sealed G4 evidence at least **180 calendar days after the terminal run/attempt receipt**; maintain an extension while an active hold/incident/dispute applies; perform an **independent exact-byte restore and full index verification by day 90** of that retention period, recording the dated pass/failure and reviewer identity. A missing/delayed/failed restore is not a verified recovery and cannot qualify for G4_PASS; do not silently replace it with hash-only or upload-only evidence. Qualified custodian, concrete media, encryption/keys, quotas, recovery delegation, hold/expiry and deletion procedures must be selected and verified before formal admission. No media/storage/restore has been configured or run by this policy decision.

## Three modes and claims

| Mode | Can run offline? | Evidence requirement | Claim boundary |
| --- | --- | --- | --- |
| Development/migration | Yes, with installed local toolchain; local LLM optional | Local work and receipts; backup configurable | No automatic G4 or product PASS |
| Public PHP↔TS differential | Yes on locally available pinned images/inputs | Local exact comparisons and sealed receipts | Public behavior only |
| Formal held-out G4 | Yes **if** independent physical custody, keys, controls and restored evidence can be proved | Dual independent encrypted copies; witnessed registration/freeze; full G0–G4; independently tested restoration | Only the explicitly accepted independence profile and registered scope |

No private corpus may enter the candidate author/model context. **LIMITED_TWO_PERSON vs INDEPENDENT_CUSTODIAN remains an undecided, explicit owner choice**, not a consequence of choosing local storage. A third human's nominal presence cannot replace tested access separation. A candidate owner who administers every host/storage/key cannot assert independent custody.

## Implementation order (not yet authorized)

1. Demonstrate the complete **offline** local public PHP→TS/Oracle path, optional model/provider interfaces and network-denial controls.
2. Fix #26 full-manifest retention (117-file/umask-022 failure modes) with strict private permissions, exact-byte complete/partial catalog and negative tests.
3. Implement a pluggable **local encrypted evidence** backend first, dual genuinely separate copies, independent commitments, custody/key recovery, exact-index/byte restore and deletion/hold tests; remote storage connectors only as optional later work.
4. Complete registered benchmark/one-draw freeze, real anti-proxy/replay G0, full G1–G3, positive/negative controls, #34 reliability disposition and normal resource-free finalizers.
5. Obtain authenticated both-owner acceptance of exact profile, media/custodian/key/recovery rules, candidate/epoch/budget and a **separate exact-run authorization** before any hidden formal qualification.

## Owner and evidence boundaries

- **Vladimir and Ilia:** the requester reports explicit agreement by **both owners** to the local-first architecture and the final **180-day/day-90** policy on 2026-10-28. This records the owners' *reported decision*, not an independently authenticated approval for the second owner's account.
- **GitHub confirmation:** PR #53 requests Ilia's review; his authenticated acknowledgment of this exact version remains to be attached to the append-only decision record. The absence of a GitHub comment does **not** reverse the reported decision, but prevents claiming an authenticated two-person receipt.
- **Approved D4 policy subset:** offline/local-first as default, **180-day minimum**, **independent day-90 restore verification**; these durations are no longer proposals. Specific physical devices, distinct administrators/custodian, custody/access controls, key escrow, expiry/deletion and independence profile remain implementation/admission choices.
- **Still OPEN:** D1–D7 where not satisfied by this narrow policy decision, selected independence profile, concrete local media/key custody, IMPLEMENTATION_READY and formal first-run admission. No new G4 receipt, no paid deployment and no hidden sample execution.
- **Historical results:** PR #31 AUDIT_FAIL is immutable; public MMP-044/MMP-049 parity does not convert canonical G4 from INCONCLUSIVE or product from NOT_ESTABLISHED.

Future implementation executor, only after a separate approved task: **sol 6.1, effort xhigh**. Implementation must commit/push to a separate GitHub PR for independent ChatGPT review; no silently authorized formal run or automatic acceptance.
