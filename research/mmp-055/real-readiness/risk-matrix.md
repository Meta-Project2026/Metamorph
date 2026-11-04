# MMP-055 risk/effort/choice matrix — custody options and smallest follow-up

Docs-only analysis, 2026-11-04. No cloud subscription or external cost is
required by any option; all options are local-first compatible.

## 1. The two independence paths ([decision-record.md:23–37](../../../specs/017-formal-g4/decision-record.md))

| Dimension | Option A: `LIMITED_TWO_PERSON` (minimum acceptable) | Option B: `INDEPENDENT_CUSTODIAN` |
| --- | --- | --- |
| Claim | **Qualified limited** G4 only; always published with profile + limitations; never advertised as full organizational independence | Strong-claim eligibility, if reviewer/custodian eligibility is real |
| Hardware/admin | 2 domains, 2 distinct admin accounts; **both storage administrators must be eligible non-C principals**: a candidate author (including a candidate-author owner) may not administer either retained copy, the witness/authority anchors or escrow — withholding the decrypt key does not compensate for root/admin power to delete, roll back or substitute ciphertext ([threat-model.md:32–53](../../../specs/017-formal-g4/threat-model.md), [storage.md:128–138](../../../specs/017-formal-g4/storage.md)). Disclosed overlap is **not** a waiver; if the two owners cannot supply two eligible non-C storage administrators, add qualified participants or the storage profile stays **BLOCKED** | Same hardware + at least a third qualified human as custodian and/or reviewer with no candidate authorship or disqualifying exposure; same non-C storage-admin requirement |
| Key flow | Same as [roles-and-key-flow.md](roles-and-key-flow.md); reviewer overlap disclosed if E=R or R is an owner — technical re-verification is then not an independent third-person witness | Escrow/delegate must exclude both owners' candidate-side roles; reviewer strictly separate from the attested work |
| Residual risks | Privileged custodian dishonesty, collusion, shared root; finite coverage; exposure-history gaps | Eligibility verification burden; scheduling; third-party trust still not cryptography |
| Effort | Low-to-medium: existing two-person team + ~2 media items + rehearsal | Medium-to-high: recruit + verify a third party before any hidden data |
| Failure mode if prerequisites missing | **BLOCKED** — no default acceptance, no signature can fix it | **BLOCKED** until eligible appointments exist ([threat-model.md:77–82](../../../specs/017-formal-g4/threat-model.md)) |

Either way: fresh unexposed corpus, technical isolation, complete evidence
([threat-model.md:77–78](../../../specs/017-formal-g4/threat-model.md)); the
MMP-010B selection cannot be retroactively qualified.

## 2. Concrete resource/admin risks

| Risk | Mechanism / blast radius | Mitigation in this package |
| --- | --- | --- |
| Candidate author administers a retained copy | Root/admin power enables deletion, rollback, ciphertext substitution even without decrypt keys; invalidates independence claim | Non-C storage-admin requirement in D2/appointments ([threat-model.md](../../../specs/017-formal-g4/threat-model.md), [storage.md:128–138](../../../specs/017-formal-g4/storage.md)); disclosed conflict ≠ waiver |
| Single control-plane process/principal for both domains | One writer touching both roots defeats administrative separation regardless of media separation | Cross-domain I/O design gate `BLOCKED_CROSS_DOMAIN_IO_DESIGN`; one-process/one-root invariant as a mandatory acceptance control ([two-domain-deployment.md §1a](two-domain-deployment.md)) |
| Single-person root compromise | Same-UID/root operator rolls back journal **and** anchors, or erases a copy — documented adapter trust limit ([format.md:113–121](../v1/format.md)) | Separate admins per domain; anchor dir separately administered; residual risk recorded, never hidden |
| Candidate author holds power | C administering every host/storage/key voids independent custody ([local-first-decision.md:26](../../../specs/017-formal-g4/local-first-decision.md)) | Access matrix + uid-denial drills (qualification 2.6) |
| Key loss / delegate unavailable | Encrypted copies unrecoverable despite integrity | Escrow under dual control; delegate drill 2.8 before real data |
| Medium failure / site loss | One domain gone | Two genuinely separate domains; drill 2.2/2.4; immutable versions survive |
| Power-loss dishonesty | fsync lies → corrupt "committed" version | Drill 1.2 power-cut rehearsal; crash-between-journal-and-anchor fails closed |
| Calendar failure (day-90 missed) | Sticky incident; blocks deletion/acceptance | Named operator + scheduled task; no silent retry ([format.md:142–143](../v1/format.md)) |
| GitHub-artifact confusion | 7-day artifacts mistaken for retention | Explicitly rejected as retention ([two-domain-deployment.md](two-domain-deployment.md) §2) |
| Windows host temptation | POSIX checks don't verify Windows ACLs; production paths Linux-only | Fail-closed `UNSUPPORTED_PLATFORM` is preserved; run drills on Linux |
| Reviewer contamination | R exposed to raw cases becomes ineligible for later candidates on that corpus | Appointment record; restricted review path only |

## 3. Prerequisites before any real private admission (condensed)

From [deployment.md](../v1/deployment.md) and [checklist.md B](../../../specs/017-formal-g4/checklist.md):
authenticated D1/D2; named C/E/R/S1/S2/D with exposure/conflict records; media
inventory; independent security re-review of #64 remediation at exact head;
#26 acceptance for affected paths; #34 disposition for reused runner paths;
#56 handoff fields agreed; synthetic rehearsal receipts (qualification
Phases 1–3); then separate D7 exact-run authorization. **Merge of this docs PR
satisfies none of these.**

## 4. Acceptance commands / proofs (per drill)

```sh
# research syntax + inventory must stay green after docs changes
node research/mmp-069/check-syntax.mjs && node research/mmp-069/validate.mjs
# synthetic regression floor (per copy, per restore drill)
pnpm --filter @metamorph/evidence-retention test
# real-domain restore drill (reader CLI, Linux, fresh process per copy)
node packages/evidence-retention/src/reader.mjs /restricted/reader-admin/config.json
# deletion denial proof (no owners+reviewer+hold-free state)
#   => reader/lifecycle commands must exit 1 with coarse failure enums only
git diff --check
```

Signed private receipts (exact version coverage) + public coarse summaries are
the receipts; stdout contains only allowlisted content
([README](../../../packages/evidence-retention/README.md)).

## 5. Blocking security defect? Smallest follow-up code change?

- **No blocking defect is identified in the synthetic scope** as of merged
  main `3814af2`. The two independent-review blockers of PR #64 (B1 stale
  revoked grant; B2 unsigned DAY90 injection) are fixed with regression tests
  at `af7a36d` ([security-remediation.md](../v1/security-remediation.md)). What
  is missing is an **independent exact-head confirmation** of that remediation —
  recorded as NOT_RECORDED in [README](README.md), not masked here. Separately,
  the independent audit of this PR identified two P1 docs blockers (single-
  process cross-domain I/O; candidate-author administration), both remediated
  in this package.
- **No code change is made by this docs package.** After the owner decisions,
  the minimum next code task is **not** "just remove the `SYNTHETIC_ONLY`
  gate": it is a separately agreed, jointly reviewed and independently
  verified **cross-domain I/O and authority/witness boundary** — for example
  domain-local writer/reader processes (one process per domain, each owning
  only its own root) or an equivalently isolated transfer of encrypted bytes
  and signed receipts, with the mandatory acceptance controls of
  [two-domain-deployment.md §1a](two-domain-deployment.md). A later,
  separate slice may then replace the `deployment: SYNTHETIC_ONLY` gate with a
  versioned real-deployment profile pinning named principals, domain
  identities and anchor administration
  ([deployment.md:19–21](../v1/deployment.md): "mere strings naming principals
  or a boolean REAL flag are not admission"). No crypto change: the
  AEAD/wrapping suite stays untouched absent a demonstrated defect and
  independent review (task-card authority rule).
- Anything larger (cloud adapters, scheduler daemons, rekey APIs) is out of
  scope and separately authorized.

## 6. Effort summary

Docs package (this PR): complete. Owner decisions: one joint session. Minimum
deployment: 1 custodian machine/NAS + 1 encrypted removable medium + 2 admin
accounts + key ceremony + ~10 drills of [qualification-plan.md](qualification-plan.md).
The calendar-bound items (180-day retention, day-90 restore) then take real
time and cannot be compressed or simulated.
