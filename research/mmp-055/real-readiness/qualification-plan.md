# MMP-055 qualification plan — real two-domain custody, synthetic evidence first

Docs-only plan, 2026-11-04. Execution starts **only after** the owner decisions
in [readiness-worksheet.md](readiness-worksheet.md) exist. Evidence ingested is
**public/synthetic only**; the current adapter is used as designed, unchanged.
Real hidden admission is a separate D7 decision ([#57](https://github.com/Meta-Project2026/Metamorph/issues/57)).

Two receipt classes are kept strictly apart everywhere:

- **SIMULATED** — existing in-process/temp-roots tests ([PR #64](https://github.com/Meta-Project2026/Metamorph/pull/64), 107-case Linux matrix). Proves code paths; proves no hardware.
- **HARDWARE_OBSERVED** — executed on the selected real domains by named custodians, with device identities from the [deployment worksheet](two-domain-deployment.md) §7. Only this class can support custody claims.

**Explicit deny:** any custody, retention or restore claim without the
required HARDWARE_OBSERVED receipt stays denied. Simulation receipts are never
substituted for hardware receipts, and prior-run receipts are never reused for
a new epoch.

## Phase 0 — prerequisites (deny gate)

D1 + D2 + D4-impl + D4-keys authenticated; two-domain inventory completed;
independent exact-head security re-review of the #64 B1/B2 remediation
recorded (currently NOT_RECORDED — [README](README.md)); #26 117/117
umask-022 acceptance green for any reused retention path
([checklist.md B3](../../../specs/017-formal-g4/checklist.md)); **and the
cross-domain I/O design gate resolved** — see below and
[two-domain-deployment.md §1a](two-domain-deployment.md).

### Cross-domain I/O gate (technical, separate from owner policy)

Real-media execution of `publish()`/`witnessStorage()`/restore is
**`NOT_EXECUTABLE_FOR_REAL_MEDIA` today regardless of owner decisions**:
current code writes and reads both copies from one Node process, requires each
root's owner UID to equal the process UID (`0700`), and refuses anything but
`SYNTHETIC_ONLY` ([engine.mjs:54–183](../../../packages/evidence-retention/src/engine.mjs),
[secure-fs.mjs:37–44](../../../packages/evidence-retention/src/secure-fs.mjs),
[store.mjs:27](../../../packages/evidence-retention/src/store.mjs),
[reader.mjs:31](../../../packages/evidence-retention/src/reader.mjs)).
Phases 1–3 below therefore run against **synthetic roots in a single
process/UID** (proving code paths only) until a separately agreed, jointly
reviewed cross-domain design (domain-local writer/reader processes or an
equivalently isolated transfer of ciphertext and signed receipts, with the
acceptance controls listed in
[two-domain-deployment.md §1a](two-domain-deployment.md)) is decided,
implemented and independently verified. Owners pick the variant; this plan
does not. Hardware receipts earned in Phase 1–2 drills on provisioning,
power, keys and devices remain valid inputs; **no HARDWARE_OBSERVED receipt
may claim two-domain publish/witness/restore until the gate passes.**

## Phase 1 — provision and rehearse on the real domains (synthetic data)

| # | Exercise | Method | Required receipt |
| --- | --- | --- | --- |
| 1.1 | Domain provisioning audit | OS-level check of accounts, ACLs, mounts, quotas per [two-domain-deployment.md](two-domain-deployment.md) §4–5 | Signed inventory by S1/S2 |
| 1.2 | fsync/power honesty | Rehearse power-cut during `publish()` on synthetic packs (UPS behavior / fsync semantics) | Power-cut drill transcript; crash-between-journal-and-anchor fails closed and is recovered by witnessed procedure |
| 1.3 | Key ceremony | Generate all §2 keys of [roles-and-key-flow.md](roles-and-key-flow.md) on principal hosts | Key inventory with fingerprints (public parts only recorded) |
| 1.4 | Publish rehearsal (single process, synthetic roots) | `publish()` + `witnessCatalog`/`witnessStorage` against synthetic roots in one process/UID — proves code paths only; **not** a two-domain demonstration | Signed catalog/storage receipts labeled SIMULATED |
| 1.4-gated | Full publish to both real domains | `publish()` with real `LocalStore` roots on Domain 1 + Domain 2, then independent two-copy storage witness | **GATED: `BLOCKED_CROSS_DOMAIN_IO_DESIGN` / `NOT_EXECUTABLE_FOR_REAL_MEDIA`** — not executable with current code; requires the resolved cross-domain design gate ([two-domain-deployment.md §1a](two-domain-deployment.md)) |

## Phase 2 — adversarial drills on the real infrastructure (synthetic data)

Each drill names the adapter mechanism it exercises. All are denied-unless-proven.

| # | Scenario | Expected observed result | Receipt class |
| --- | --- | --- | --- |
| 2.1 | Immediate post-teardown restore from **EACH** copy | Fresh reader process per copy, new `0700` destination parent, decrypt + `PrivateEvidence.verify` + complete root inspection; exact bytes + full index match prior witnessed commitments; signed private receipt per copy | **GATED for real media** (see Phase 0 gate): currently executable only on synthetic roots; the cross-domain design must define per-copy reader execution under each domain's UID ([two-domain-deployment.md §1a](two-domain-deployment.md)) |
| 2.2 | Lost / invalid Domain-2 device | Restore from Domain 1 still succeeds with copy-A receipts; Domain 2 unavailable recorded as incident; no silent overwrite when the medium returns | HARDWARE_OBSERVED |
| 2.3 | Wrong key / revoked grant | Reader denies: wrong recipient key; stale config after a committed `GRANT_REVOKED` via live authority + anchor | HARDWARE_OBSERVED ([authority.mjs:98](../../../packages/evidence-retention/src/authority.mjs)) |
| 2.4 | Disconnected secondary | Domain 2 unplugged during verification window: incident sticky; day-90/deletion blocked while unresolved | HARDWARE_OBSERVED |
| 2.5 | Partial interrupted write | Kill publish mid-copy: first copy + earlier immutable version intact; interrupted version survives for review; no overwrite API used | HARDWARE_OBSERVED |
| 2.6 | Permission / rollback / tamper | Foreign-owner/mode/link rejections; journal rollback rejected against live anchor; tampered ciphertext fails authentication before any plaintext write | HARDWARE_OBSERVED ([catalog.mjs:168](../../../packages/evidence-retention/src/catalog.mjs) `inspect`) |
| 2.7 | Unapproved delete | `verifyDeletionState` refuses without both-owner signatures + current no-hold R receipt + 180-day bound + hold/incident/day-90 checks; intervening journal event invalidates an old plan | HARDWARE_OBSERVED ([deletion.mjs:16](../../../packages/evidence-retention/src/deletion.mjs)) |
| 2.8 | Recovery delegate path | Recovery with D's escrowed key + unexpired witness-signed `RECOVER` grant from a fresh restricted host; C-equivalent principal denied | HARDWARE_OBSERVED |
| 2.9 | DAY-90 window mechanics | Immediate restore relabeled as DAY90 is rejected; out-of-window receipts rejected; task stays pending until a genuine in-window restore | SIMULATED now (existing tests) + HARDWARE_OBSERVED calendar run later ([core.mjs:5](../../../packages/evidence-retention/src/core.mjs) `DAY90_WINDOW_START`) |
| 2.10 | Budget / oversize rejection | `admission()` rejects shapes exceeding pack/record/journal/authority bounds before any write | SIMULATED + confirmed by real-domain preflight logs in Phase 3 |

## Phase 3 — retention qualification (still synthetic evidence)

1. Seal a complete synthetic epoch (complete + one partial/failed attempt) with
   the full 117/117 manifest path under umask 022; verify root catalog covers
   every pack/attempt/record.
2. Teardown, revoke writers, finalize catalog, publish both copies.
3. Independent immediate restore from **each** copy into fresh restricted
   environments (R or eligible delegate), verified against the **prior
   witnessed commitments** — not against any manifest supplied by the restored
   object ([storage.md:93–96](../../../specs/017-formal-g4/storage.md)).
4. Record `RETENTION_QUALIFIED` for the **mechanism**; schedule the real
   day-90 restore task on the real calendar with named operator. Real elapsed
   180 days / real day-90 remain NOT_RUN until the calendar brings them due
   ([format.md:128–143](../v1/format.md)).

## Phase 4 — what this plan never does

- Ingest hidden cases, expected results, entropy or the real candidate into
  any drill; no private pack to LLM/GitHub ([#55](https://github.com/Meta-Project2026/Metamorph/issues/55)).
- Claim physical installation from documentation. Until Phase 1–3 receipts
  exist: `BLOCKED_REAL_CUSTODY`; `REAL_MEDIA NOT_DEPLOYED`;
  `EXTERNAL_RETENTION NOT_RUN`; G4 INCONCLUSIVE; product NOT_ESTABLISHED.
- Treat `SIMULATED_VERIFIED`, a green workflow, or upload-only evidence as
  recoverability ([storage.md:96–97](../../../specs/017-formal-g4/storage.md)).
