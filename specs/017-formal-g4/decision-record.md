# MMP-038 owner decision record (pending)

Status: **PROPOSED / PENDING VLADIMIR AND ILIA**.
Date prepared: 2026-10-28. Reviewed base:
`00c913243ba7a4c05259dd1da25bdcfa7cf9e127`.
Scope: this directory only. No approval, appointment, benchmark registration,
implementation permission, first-run authorization or G4 receipt exists in this
record. Publishing/merging this PR does not silently ratify root governance.

## Owner-reported joint local-first decision and fixed retention policy

The requester explicitly stated on 2026-10-28 that **both Vladimir and Ilia agreed**
to the [local-first architecture direction](local-first-decision.md) and **finally
approved 180 days of evidence retention plus an independently verified day-90
restore**. Record this as **JOINT_OWNER_AGREEMENT_REPORTED**, rather than
PENDING_POLICY_DECISION. It does **not** fabricate Ilia's independently authenticated
GitHub signature or an approved concrete media/keys/custody implementation; PR #53
still requests that signed confirmation. D1 and the remaining D4 service/admin/
key/recovery choices are not automatically complete, and no hidden run is admitted.

## Required decision gate

Choose exactly one path by explicit statements from both owners:

1. **ACCEPT LIMITED_TWO_PERSON**: accept the precise technical/data separation
   and limited human-independence claim in [threat-model.md](threat-model.md).
   Disclose historical candidate/auditor overlap; appoint E/R and record any
   reviewer overlap. Require fresh unexposed private version and deny every
   candidate author access to its hidden cases/answers. Future results carry the
   profile, never an unqualified assertion of full independence.
2. **REQUIRE INDEPENDENT_CUSTODIAN**: appoint eligible independent custody and
   review roles for the required claim. Until appointments and access boundaries
   exist, formal implementation/run admission is **BLOCKED**. A third name or an
   LLM review alone does not establish eligibility.

If either owner rejects the limited model, or the minimum same-corpus nonexposure
cannot be demonstrated, there is no default acceptance. Remain BLOCKED until
eligible independent custody and fresh registration can satisfy the required
profile. Neither option retroactively qualifies MMP-010B.

## Decision register

Both owners approve the versioned documents once at protocol acceptance and
concrete per-epoch admission at the first formal run. These are acceptance
boundaries, not per-PR checksum recertification or new Fast CI rituals.

| ID | Decision and reviewable proposal | Required explicit record | Current state |
| --- | --- | --- | --- |
| D1 | Accept protocol, threat model, storage, checklist and five-slice plan | Both owners identify document version/PR commit and accept scope/limits | PENDING |
| D2 | Choose one independence path above | Both owners name profile, exposure/conflict statements, C/E/R/principals and administrator trust; reviewer eligibility attested | PENDING; no appointments |
| D3 | Register benchmark and G0 completeness | Both owners accept source/license, version, unseen private pool, mandatory public/hidden scenarios/units, unsupported boundaries and selection policy | NOT_RUN; no benchmark chosen here |
| D4 | **APPROVED:** local-first default, two independently custodied encrypted physical copies; **180-day minimum** for complete/partial evidence and mandatory independent **day-90 exact-byte restore check**. Hold extension/verified deletion remain controls, not bypasses | Both-owner agreement **reported by requester** 2026-10-28; authenticated Ilia acknowledgment and concrete media/key/service principals, quotas, expiry and recovery workflow still need a separately verified record | **POLICY_SUBSET_RATIFIED_BY_OWNER_REPORT; AUTHENTICATED_SECOND_OWNER_RECEIPT_PENDING; IMPLEMENTATION/EXTERNAL_RETENTION_NOT_RUN** |
| D5 | One invocation + at most one classified technical retry; no retries for terminal behavioral FAIL; fresh versions after repair/leak/semantic changes | Both owners accept attempt/finality/invalidation rules and bounded run limits before registration | PENDING |
| D6 | Authorize implementation and settle integration dependencies | Both owners accept scoped PR #31 auditor disposition, #26/#34 prerequisites for reused paths, future shared-change proposals and public synthetic qualification evidence | PENDING; no code authorized by this record |
| D7 | Authorize first formal run and later acceptance | Separate both-owner exact-epoch/candidate/implementation/budget permission before dispatch; R's review and both-owner acceptance/refusal after evidence | NOT_RUN |

## Receipt form for later authorized decisions

The following is an unfilled form, not a signed record:

- Decision ID/type (protocol / appointment / registration / run / acceptance).
- Exact document version or registration/epoch, candidate and implementation IDs.
- Chosen profile, scope, explicit limitations/conflicts and unresolved blockers.
- Vladimir: authenticated actor, timestamp, exact acceptance/refusal statement,
  permanent receipt reference.
- Ilia: authenticated actor, timestamp, exact acceptance/refusal statement,
  permanent receipt reference.
- R: appointment/eligibility and independent review reference; private evidence
  references only in the restricted record.
- Effective state and successor/amendment reference.

Git author, task assignee, workflow SUCCESS, silence, one owner's approval or a
ChatGPT code review are not the other owner's consent. The executor does not
sign for either owner. No teammate message is implied by a checked-in handoff.

## Consequences

This proposal reuses existing isolated workers, exact comparison and local pack
mechanisms. It adds registration/custody, durable storage and authenticated
acceptance outside current strict DTOs first. If implementation later needs a
shared API/schema/runtime change, present its concrete compatibility plan to
both owners before editing. Do not relabel verifyPair's current G4 or change its
public/synthetic scope to bypass that decision.

G4_PROTOCOL_READY is a document acceptance milestone. G4_PASS requires execution,
controls, accepted isolation and retained evidence; product PASS additionally
requires every applicable mandatory G0-G4 and full registered coverage. Today:
**G4 INCONCLUSIVE, product NOT_ESTABLISHED, formal run NOT_RUN**.
Issue #38 stays open until joint architecture acceptance; #44 and the PR #31
historical proof remain unchanged.
