# Local encrypted evidence adapter — MMP-055 v1

**Synthetic/public data only.** This package implements and tests encrypted local
retention and full restore. It refuses real deployment. Two temporary roots,
mock principals, signatures and separate processes do not establish independent
physical/admin custody. G4 remains INCONCLUSIVE; PRODUCT NOT_ESTABLISHED;
real EXTERNAL_RETENTION_NOT_RUN. Historical PR #31 AUDIT_FAIL is unchanged.

Start with the versioned [scope](../../research/mmp-055/v1/spec.md),
[format/trust contract](../../research/mmp-055/v1/format.md),
[validation](../../research/mmp-055/v1/validation.md) and
[future deployment checklist](../../research/mmp-055/v1/deployment.md).

## API and order

Runtime exports are `.mjs`; the separate `@metamorph/evidence-retention/boundary`
export supplies TypeScript handoff interfaces. Existing PrivateEvidence, strict
GateResult/RunEvent and comparators are unchanged. `test/fixture.mjs` is a complete
original synthetic usage example. It creates test-only keys outside Git and
never prints them. Do not copy its mock administration model into real custody.

1. A trusted controller finishes bounded normal teardown, revokes writers and
   seals each existing `PrivateEvidence` pack. Its finalization receipt retains
   primary and secondary errors; missing teardown cannot become VERIFIED.
2. `inspect(input)` is read-only and validates the versioned identity, admitted
   bounds, all source-root children, all sealed indexes and exact file bytes.
   Multiple bounded packs and complete/partial earlier attempts share one exact
   root catalog. All must have the same custody scope. Root retention begins at
   the latest terminal receipt, conservatively extending earlier attempts.
3. An external witness independently opens the source with `witnessCatalog`,
   signs the exact catalog/recipient configuration and saves it in a restricted
   witness directory. The writer receives the signed receipt and public key,
   never the witness's private signing key. The full prior catalog and its
   blinded commitment are frozen before encryption/publication.
4. `publish({input,witness,witnessPublicKey,expectedWitnessSha256,stores,nonceRoot,
   journal})` encrypts each pack separately and publishes unique versions to two
   `LocalStore` instances, verifies exact ciphertext size/hash and rechecks the
   source. A partial second write leaves the first copy and incident intact.
   No overwrite/retry repair API exists. Success here remains NOT_VERIFIED.
5. The external witness independently reads both stores via `witnessStorage`
   and saves a signed immutable receipt. The reader administrator pins its hash
   and the prior catalog-witness hash in a separate restricted reader config.
6. Invoke the independent reader after teardown, once for each copy:

   ```sh
   node packages/evidence-retention/src/reader.mjs /restricted/reader-admin/config.json
   ```

   The canonical JSON config has `format: mmp-evidence-reader-config-v1`,
   `deployment: SYNTHETIC_ONLY`, `witnessPath`, `storageWitnessPath`,
   `witnessPublicKeyPath`, `witnessSha256`, `storageWitnessSha256`, `store`,
   `principal`, `privateKeyPath`, `signingKeyPath`, `destinationParent`,
   `journalRoot`, `receiptPath`, `purpose: IMMEDIATE|DAY90` and `revoked: []`.
   See `readerConfig()` in the fixture for exact construction. Files are 0600
   inside existing absolute canonical 0700 directories. A new config/receipt is
   used for each restore. Writer-supplied replacements for these trust anchors
   are forbidden. A lost/missing witness is NOT_VERIFIED, never a self-created
   replacement manifest. Successful signed private receipts include exact
   version coverage; stdout contains only the allowlisted public summary.
7. `RetentionLedger` consumes signed reader receipts, emits day90 tasks, enforces
   the 180-day minimum, holds, access/recovery/revocation history and clock
   high-water. It requires both owner signatures plus a separate no-hold review
   for expiration. DAY90 receipts must fit each attempt's day89-to-day90 window;
   relabeling immediate recovery cannot cancel future tasks. Store deletion
   rechecks a current checkpoint-bound ledger permit, holds/incidents, signatures
   and deadline while holding the same exclusive lock as journal writers. Any
   later journal transition invalidates the permit. Completion additionally requires pinned custodian
   witnesses for both copies, escrow and snapshots. These are synthetic receipts
   here, not a claim that real equipment was erased.

Recovery uses a separately wrapped RSA recipient and an unexpired witness-signed
RECOVER grant bound to the witness/principal. A reader-administered revocation
list denies revoked grants. The ledger records revocation; the trusted operator
must supply its current independently witnessed state to reader configuration.
No LLM/repository secret is a recovery delegate. There is no rekey/downgrade API.

For grouped attempts, 180-day expiry uses the latest terminal receipt and day90
uses the earliest deadline. A common day89-to-day90 window must exist; attempts
more than one UTC day apart require separate bounded retention bundles. The
external #56 run catalog must still enumerate all such bundles and attempts.

## Failure and platform behavior

Linux with procfs is supported for this simulation. Windows is explicitly
UNSUPPORTED_PLATFORM: POSIX mode bits do not verify Windows ACLs. No POSIX check
is silently skipped inside production functions. On Windows, tests explicitly
skip Linux scenarios and separately test fail-closed behavior.

The public serializer permits only opaque run ID, coarse status, pack count,
blinded commitment and non-claim statuses. Native exception text, paths, stacks,
raw stdout/stderr, keys, private file hashes, source/expected bytes and blinding
nonces stay restricted. The reader CLI prints only coarse failure enums and exits
1 when verification fails. Private journal details are not a public receipt.

Interrupted stages/restore directories and prior immutable versions survive for
incident review. Journal write failure is attached as a secondary exception and
does not hide the primary storage/restore failure. No automated deletion of sole
raw evidence, expired keys or failed stages occurs.

## Tests

```sh
pnpm install --frozen-lockfile
pnpm --filter @metamorph/evidence-retention test
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

These are bounded synthetic unit/contract checks in existing Fast CI, with no new
workflow or Docker/model job. The optional local Linux unit-test container recipe
and measured versions/results are in the validation record. It executes only
trusted original synthetic tests; no benchmark/candidate application runs.
