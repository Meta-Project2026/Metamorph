# MMP-055 readiness worksheet — D1/D2/D4 choices, authorities and receipts

Versioned proposal, 2026-11-04, base `e0e971bd8d8c3d1a28c8332d42748e78e59a970a`.
Companion to [decision-record.md](../../../specs/017-formal-g4/decision-record.md)
(D1–D7 register) and [local-first-decision.md](../../../specs/017-formal-g4/local-first-decision.md).
This worksheet is operator-readable: each row says **what is already fixed**,
**what still must be chosen**, **who has authority**, and **which receipt proves
the choice**. Nothing here is a signature, appointment, deployment or admission.

## 1. Already-fixed owner-reported policy (do not re-litigate, do not extend)

Recorded 2026-10-28 as **JOINT_OWNER_AGREEMENT_REPORTED** by the requester; the
independently authenticated second-owner GitHub receipt is still pending
([decision-record.md:52](../../../specs/017-formal-g4/decision-record.md), D4 row).
These parameters are **binding architecture policy**:

| Parameter | Fixed value | Source |
| --- | --- | --- |
| Architecture | Local-first; cloud/S3 optional, never mandatory | [local-first-decision.md §1, §5](../../../specs/017-formal-g4/local-first-decision.md) |
| Retention floor | Complete **and** partial/failed sealed evidence, ≥ **180 UTC calendar days** from the latest terminal receipt | [storage.md:112–118](../../../specs/017-formal-g4/storage.md) |
| Restore check | Independent **exact-byte + full-index** restore by **day 90** of retention, dated pass/failure + reviewer identity; immediate initial restore additionally required for qualification | [local-first-decision.md §7](../../../specs/017-formal-g4/local-first-decision.md), [#55 acceptance](https://github.com/Meta-Project2026/Metamorph/issues/55) |
| Hold | Active hold/incident/dispute extends retention indefinitely | [storage.md:123–127](../../../specs/017-formal-g4/storage.md) |
| Expiration/deletion | Both owners authorize only after R confirms no hold; verified removal across copies/snapshots/escrow; `DELETION_UNVERIFIED` until then | [storage.md:145–149](../../../specs/017-formal-g4/storage.md) |

**Not fixed by that decision** (explicitly still open): physical media,
custodian machines, distinct administrators, key holders, escrow/recovery
delegates, quotas, independence profile, authenticated joint record.

## 2. Decision worksheet

| ID | Choice required | Authority | Satisfying record (receipt) | Current state |
| --- | --- | --- | --- | --- |
| D1 | Accept exact versions of protocol, threat model, storage policy, checklist, plan | Both owners, each naming document version + PR commit | Authenticated owner statements per the [receipt form](../../../specs/017-formal-g4/decision-record.md); independent public review findings resolved | PENDING |
| D2 | Choose `LIMITED_TWO_PERSON` or `INDEPENDENT_CUSTODIAN`; name C, E, R, two storage owners, recovery delegate; declare exposures/conflicts; administrator trust base | Both owners jointly; reviewer eligibility attested; no self-appointment | Signed appointment record + exposure/conflict declarations; access matrix from [threat-model.md:32–53](../../../specs/017-formal-g4/threat-model.md) | PENDING — no appointments exist |
| D4-impl | Select concrete primary medium/NAS + physically separate offline encrypted medium; locations; filesystem/fsync/power profile; quotas | Custodian(s) proposed by owners; accepted by both owners | [two-domain-deployment.md](two-domain-deployment.md) worksheet completed with real device identities + custody rehearsal receipt | NOT_SELECTED |
| D4-keys | Select key ceremony, escrow, recovery delegate path, authority anchor administration | Both owners; delegates named; never a candidate author | [roles-and-key-flow.md](roles-and-key-flow.md) §5–6 executed as a synthetic-key rehearsal with real named principals | NOT_SELECTED |
| D4-run | Approve the [qualification plan](qualification-plan.md) on real hardware with synthetic evidence | Both owners | Dated authorization naming the two domains + custodians | NOT_RUN |
| D5–D7 | Attempt/finality rules, implementation authorization, exact-run authorization | Both owners | Per [decision-record.md:53–55](../../../specs/017-formal-g4/decision-record.md) | PENDING / NOT_RUN |

D3 (benchmark registration) is a separate #56 track and is intentionally out of
scope here. **No worksheet entry implies another.**

## 3. Status vocabulary and gates

- `READY_FOR_OWNER_DECISION` (current): mechanism + plan exist; owners have not
  authenticated choices. → requires D1 + D2 + D4-impl/D4-keys records.
- `CUSTODY_PROVISIONED`: real two domains deployed, named custodians exercised,
  rehearsal receipts from [qualification-plan.md](qualification-plan.md) Phase 1–2
  exist. Still **no hidden data**.
- `RETENTION_QUALIFIED`: immediate post-teardown exact-byte + full-index restore
  from **each** copy verified against prior witnessed commitments on real media
  (Phase 3); day-90 obligation scheduled, not yet due.
- `RETAINED_VERIFIED`: retention receipt for a real attempt with independent
  restore attestation ([storage.md:93–96](../../../specs/017-formal-g4/storage.md)).
  Only then may a G4 acceptance reference durable retention.
- Any missing proof at any stage ⇒ that stage stays **denied**; a failed or
  missing day-90 check is a sticky incident, never silently retried
  ([format.md:128–143](../v1/format.md)).

## 4. Owner decision form (unfilled)

Copy per decision, per the [decision-record receipt form](../../../specs/017-formal-g4/decision-record.md):

```text
Decision ID/type:        (protocol | profile | media | keys | run | acceptance)
Document/version:        (exact package version + commit)
Chosen profile:          (LIMITED_TWO_PERSON | INDEPENDENT_CUSTODIAN)
Named principals:        C= E= R= storage-owner-1= storage-owner-2= recovery-delegate=
Declared exposures:      (authorship, corpus, chat, administrator powers, overlaps)
Accepted limitations:    (quote the claim boundary accepted)
Vladimir:  actor= timestamp= statement= receipt-ref=
Ilia:      actor= timestamp= statement= receipt-ref=
R (if applicable):       appointment= eligibility= review-ref=
Effective state:         (e.g. CUSTODY_PROVISIONED)  Successor/amendment ref:
```

Git authorship, task assignment, workflow SUCCESS, silence, one owner's
approval or a ChatGPT code review are **not** the other owner's consent. The
executor never signs for an owner.

## 5. Acceptance receipts owed by this package

| Receipt | Produced by | Exists? |
| --- | --- | --- |
| Decision form rows completed and authenticated by both owners | Owners, on the merged version of this PR | NO |
| Two-domain inventory with device identities + administrator split | Owners + custodians, per [two-domain-deployment.md](two-domain-deployment.md) §7 | NO |
| Synthetic-on-real-hardware rehearsal transcript (no hidden data) | Custodians, per [qualification-plan.md](qualification-plan.md) Phase 1–2 | NO |
| Independent immediate restore receipts from EACH copy | Reader CLI runs per [operator-runbook.md](operator-runbook.md) §6 | NO |
| Day-90 scheduled task with named operator | Custodian + owners | NO (obligation recorded, clock not started) |
| Independent exact-head security re-review of #64 remediation | Independent reviewer, at `af7a36d…` | NOT_RECORDED |

Current canonical state: **G4 INCONCLUSIVE; product NOT_ESTABLISHED;
EXTERNAL_RETENTION NOT_RUN; PR #31 AUDIT_FAIL unchanged.**
