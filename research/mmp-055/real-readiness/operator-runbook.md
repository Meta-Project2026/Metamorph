# MMP-055 operator runbook — execute only after owner decisions

Safe, later-executed procedure for the named custodians. Every `<PLACEHOLDER>`
is chosen in the [deployment worksheet](two-domain-deployment.md) §7; every
step that names a principal requires that principal to actually perform it.
**Do not execute before D1/D2/D4 records exist.** Linux only for production
paths; all data in these steps is public/synthetic until a separately
authorized D7 epoch.

## 0. Preconditions (all must be true)

- [ ] Authenticated D1 + D2 + D4-impl + D4-keys records exist
      ([readiness-worksheet.md](readiness-worksheet.md)).
- [ ] Independent exact-head security re-review of the #64 B1/B2 remediation recorded.
- [ ] Domains provisioned per [two-domain-deployment.md](two-domain-deployment.md):
      separate hosts/accounts, `0700`/`0600`, disjoint roots, quotas set.
- [ ] Key ceremony done ([roles-and-key-flow.md](roles-and-key-flow.md) §2);
      witness + authority + owner/reviewer/custodian + recipient keys on their
      own hosts; no key ever on the runner.

## 1. Synthetic fixture epoch (trusted controller, runner host)

```sh
pnpm install --frozen-lockfile
pnpm --filter @metamorph/evidence-retention test   # regression floor incl. 117-file manifest
# then drive the real publish with fixture packs using the package's
# synthetic usage example as the mechanical template — test/fixture.mjs —
# but with REAL LocalStore roots on the two real domains and REAL witness/
# reader configs; do not reuse the fixture's mock administration model.
```

Publication needs `publish({input, witness, witnessPublicKey,
expectedWitnessSha256, stores, nonceRoot, journal})` with `stores` = the two
real domains ([engine.mjs:54](../../../packages/evidence-retention/src/engine.mjs)).

## 2. Witness receipts (witness host)

1. `witnessCatalog` over the exact sealed source; store the signed receipt in
   the restricted witness directory; hand the writer only the signature +
   public key.
2. After publication, `witnessStorage` over **both** stores; signed immutable
   storage receipt ([engine.mjs:146](../../../packages/evidence-retention/src/engine.mjs)).
3. Record blinded public commitment; openings stay in the encrypted private
   bundle; R may verify via restricted path only.

## 3. Reader config (reader admin host, per restore, never reused)

Canonical JSON, `format: mmp-evidence-reader-config-v1`, `deployment:
SYNTHETIC_ONLY` until a separately admitted real-deployment profile exists;
pin `witnessPath`, `storageWitnessPath`, `witnessPublicKeyPath`,
`witnessSha256`, `storageWitnessSha256`, `store`, `principal`,
`privateKeyPath`, `signingKeyPath`, `destinationParent`, `journalRoot`,
`receiptPath`, `purpose: IMMEDIATE|DAY90`; RECOVERY adds `recoveryAuthority`
(`mmp-live-policy-authority-v1`, live `journalRoot`/`anchorRoot`,
`anchorIdentity` device/inode, authenticated `context` from `policyContext()`).
Files `0600` inside canonical `0700` dirs
([README step 6](../../../packages/evidence-retention/README.md)).

## 4. Immediate restore drill (per copy, after teardown)

```sh
node packages/evidence-retention/src/reader.mjs /restricted/reader-admin/config.json
```

- Fresh process, fresh `0700` destination parent, one run per copy.
- Verify: authentication passes before any plaintext write; every exact byte +
  full original index + complete root coverage match the **prior witnessed
  commitments**; signed private receipt; stdout shows only coarse enums.
- Expected failures stay failures: wrong key, stale config after revoke,
  missing witness ⇒ exit 1, `NOT_VERIFIED` — never a self-created replacement.

## 5. Ledger and calendar (custodian + owners)

1. `RetentionLedger` ingests both signed reader receipts; confirm the day-90
   task exists and the 180-day clock anchors to the latest terminal receipt
   ([lifecycle.mjs:30](../../../packages/evidence-retention/src/lifecycle.mjs)).
2. Record the dated day-90 obligation + named operator in the retention
   register. The real day-90 restore executes on the real calendar in-window
   (day 89–day 90); a relabeled immediate receipt does not cancel it.
3. Holds/incidents: append via the journal; a hold extends retention and
   blocks deletion; clock rollback records a sticky incident.

## 6. Deletion at expiry (much later, only if applicable)

Both owners sign the exact witness/storage identity + time; separate current
no-hold R receipt; store rechecks a checkpoint-bound plan against the live
ledger while holding the exclusive lock through unlink; both copy witnesses +
escrow + snapshots attest the plan; else `DELETION_UNVERIFIED`
([deletion.mjs:16](../../../packages/evidence-retention/src/deletion.mjs)).
Public-safe deletion receipt + final metadata retained.

## 7. Incident handling

Loss / unauthorized access / tamper: freeze deletion, revoke affected grants
(live authority + anchor), preserve incident metadata, notify owners via the
approved process, never expose leaked content. Missing/late/one-copy day-90
checks and clock rollback are sticky incidents blocking deletion/acceptance.

## 8. Hygiene for every step

- Report commands actually run, exit statuses, remaining risks; unexecuted
  checks are NOT_RUN; FAIL vs INCONCLUSIVE vs ERROR distinguished
  ([AGENTS.md](../../../AGENTS.md)).
- Nothing irreversible runs without the matching owner record; never run
  untrusted candidate/benchmark code on the host; credentials stay in trusted
  host adapters, outside candidate workers and Git.
- Never send hidden material to any LLM, public log, artifact or chat.
