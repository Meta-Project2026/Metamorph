# MMP-055 roles and key flow — proposal for real custody

Docs-only proposal, 2026-11-04. Role names, key generation, isolation,
witness/authority anchors, blinded commitments, escrow and recovery. **No key
is generated, no role is appointed and no person is named by this document.**
Synthetic fixtures and mock principals in
[test/fixture.mjs](../../../packages/evidence-retention/test/fixture.mjs)
demonstrate the mechanics and "must not be copied into real custody"
([README](../../../packages/evidence-retention/README.md)) — this file is the
real-custody counterpart of that warning.

## 1. Roles

| Role | Symbol | Real-custody responsibilities | Must never have |
| --- | --- | --- | --- |
| Candidate author | C | Submit exact candidate bundle; no storage/custody duties during the epoch | Any decrypt key, witness key, authority key, store/journal/anchor/nonce-root access; hidden pool access |
| Custodian (evaluator) | E | Operate approved evaluator; admit/free candidate; execute the one draw; publish evidence | Unreviewed policy changes; candidate repair; shared private diagnostics with C |
| Reviewer | R | Verify commitments, custody history, coverage; no-hold attestation at expiry; restricted private review | Authoring candidates qualified on the same corpus after exposure ([threat-model.md:52–53](../../../specs/017-formal-g4/threat-model.md)) |
| Storage owner 1 | S1 | Administers Domain 1 (primary); store principal account. **Must be an eligible non-C principal** — not the candidate author and not administered by a candidate-author account | Any role conflict declared in the appointment record |
| Storage owner 2 | S2 | Administers Domain 2 (offline medium + its mount host). **Must be an eligible non-C principal**, distinct from S1's administration | Shared root/admin with S1 or C |
| Reader administrator | (may be E or a delegate) | Runs the reader CLI from pinned configs for restores | Authority signing key; writer-supplied trust anchors |
| Recovery delegate | D | Key-escrow recovery path, independent of the transient runner account | Same-corpus exposure; C must not be able to reach escrow ([storage.md:135–138](../../../specs/017-formal-g4/storage.md)) |
| Owners | Vladimir + Ilia | Joint decisions D1–D7; deletion authorization; acceptance/refusal | An owner who is the candidate author (C) cannot simultaneously be S1/S2 or hold storage/anchor/escrow administration |

**Non-C storage administration is required under every independence profile.**
`LIMITED_TWO_PERSON` limits the human-independence claim of the G4
*assessment*; it does **not** exempt the deployment from two independently
administered storage domains. Per the [access matrix](../../../specs/017-formal-g4/threat-model.md)
and [storage policy](../../../specs/017-formal-g4/storage.md), C and
C-controlled service/admin accounts manage no retained copy, key, witness,
authority anchor or escrow — withholding the decrypt key does not neutralize
root/admin ability to delete, roll back or substitute ciphertext. If the two
owners cannot supply two eligible non-C storage administrators (an owner who
is C is ineligible), qualified additional participants or separate
organizational administration are required; otherwise the real storage
profile stays **BLOCKED**. Declaring the conflict never waives it.

Appointments must satisfy the [access matrix](../../../specs/017-formal-g4/threat-model.md)
and the chosen independence profile ([risk-matrix.md](risk-matrix.md)); a
third human's nominal presence does not create independence
([local-first-decision.md:26](../../../specs/017-formal-g4/local-first-decision.md)).
No LLM/repository secret is a recovery delegate
([README](../../../packages/evidence-retention/README.md)).

## 2. Key inventory and generation

All keys are generated on the trusted host of their principal, offline from
candidate contexts, never in Git, CI, workflow, model/chat or candidate
workspace ([AGENTS.md](../../../AGENTS.md) rules; [storage.md:75–77](../../../specs/017-formal-g4/storage.md)).

| Key | Algorithm / role in adapter | Held by | Isolation |
| --- | --- | --- | --- |
| Witness signing key | Ed25519; signs catalog/storage receipts and checkpoints | Witness principal (independent of pack author) | Separate machine/account; private key `0600` in `0700` dir; never sent to writer |
| Policy authority signing key | Ed25519; signs each privileged policy event bound to prior checkpoint | Authority operator, outside Git/candidate/reader config ([README](../../../packages/evidence-retention/README.md) §"Policy writers") | Not passed to readers; anchor dir separately administered |
| Owner / reviewer / custodian proof keys | Ed25519; sign RESTORE/HOLD_RELEASE/DELETION proofs, pinned via `policyContext()` | Each named principal | Never co-located with the authority key |
| Reader recipient keys (reader, recovery) | RSA 3072–8192 (`SUITE` = AES-256-GCM/RSA-OAEP-SHA256/Ed25519, [crypto.mjs:29](../../../packages/evidence-retention/src/crypto.mjs)); unwrap pack DEKs | Reader admin; recovery delegate | Private keys on their own hosts; SPKI fingerprints pinned in pack headers |
| Per-pack DEK | Fresh 32-byte OS-random per pack; RSA-OAEP-wrapped to ordered recipients with root/pack/recipient label | Ephemeral; zeroed, incl. failure paths ([format.md:64–74](../v1/format.md)) | Never persisted in plaintext |
| Blinding nonces | Fresh private 32-byte random per commitment domain | Encrypted private registration bundle | Never public; distinct per domain |

OS/hardware isolation floor: one OS account per principal on its own machine
or clearly separated VM; encrypted key storage; no shared SSH agents; keys
never leave the principal's host; no key in any env var consumed by candidate
or worker processes. Hardware tokens are acceptable **additions**, not
requirements — do not overclaim what is not rehearsed.

## 3. Witness and trust-anchor flow

1. **Catalog witness (before encryption).** An external principal runs
   `witnessCatalog`, signing the exact source catalog and recipient
   configuration into a restricted witness directory; the writer receives the
   signature + public key, never the witness private key
   ([README step 3](../../../packages/evidence-retention/README.md),
   [crypto.mjs:83](../../../packages/evidence-retention/src/crypto.mjs)).
2. **Publish.** `publish({input, witness, witnessPublicKey,
   expectedWitnessSha256, stores, nonceRoot, journal})` encrypts each pack and
   publishes unique immutable versions to the **two** `LocalStore` domains,
   verifying exact ciphertext size/hash; a partial second write leaves the
   first copy and an incident intact; no overwrite/retry API exists
   ([engine.mjs:54](../../../packages/evidence-retention/src/engine.mjs),
   [README step 4](../../../packages/evidence-retention/README.md)).
3. **Storage witness (after publish).** The witness independently reads **both**
   stores via `witnessStorage` and signs an immutable receipt
   ([engine.mjs:146](../../../packages/evidence-retention/src/engine.mjs)).
4. **Reader pinning.** The reader config (separately administered) pins
   `witnessSha256` and `storageWitnessSha256` plus the witness public key;
   writer-supplied replacements are forbidden and a missing witness is
   `NOT_VERIFIED`, never self-replaced
   ([reader.mjs:27](../../../packages/evidence-retention/src/reader.mjs),
   [README step 6](../../../packages/evidence-retention/README.md)).

## 4. Blinded public commitments

- #55 catalog commitment: SHA-256 over domain `MMP-055-WITNESSED-CATALOG-V1\0`
  + 32 private blinding bytes + u64 length + exact catalog bytes; distinct
  from #56 nonces; per-file hashes/paths/nonces never public
  ([format.md:86–90](../v1/format.md)).
- #56 (now implemented synthetically, [PR #185](https://github.com/Meta-Project2026/Metamorph/pull/185)):
  domains `MMP-056-REGISTRATION-V1`, `MMP-056-CANDIDATE-V1`,
  `MMP-056-SELECTION-V1` over canonical JSON with length prefix and distinct
  openings; selection commitment binds private draw entropy + candidate +
  registration commitments + draw ID
  ([interface.md:44–65](../../mmp-056/interface.md)). Low-entropy secrets
  always use blinding, never bare SHA-256 ([#56](https://github.com/Meta-Project2026/Metamorph/issues/56)).
- Openings are verified by R through the restricted review path only
  ([protocol.md:80–81](../../../specs/017-formal-g4/protocol.md)).

## 5. Live authority anchors (revocation freshness)

Revocation freshness after B1 uses a live, replay-validated policy journal plus
a **separately administered** append-only signed high-water anchor directory:
the reader config pins the anchor's device/inode identity and public key; the
common exclusive lock spans fresh authority verification through decrypt and
signed receipt publication; revoke commits either before access (denied) or
after it finishes — never inside
([authority.mjs:98](../../../packages/evidence-retention/src/authority.mjs),
[security-remediation.md:25–57](../v1/security-remediation.md)).
Real requirement: the anchor directory is administered by someone other than
the writer/reader operator, on its own storage, or the B1 assumption
("independently administered live source") is unmet.

## 6. Escrow and recovery

- Each pack's DEK is wrapped to the ordered recipient set including the
  recovery recipient; recovery requires a separately wrapped RSA recipient and
  an **unexpired witness-signed `RECOVER` grant** bound to witness, full
  identity hash, principal and purpose; the reader freshly validates the live
  signed journal against the pinned anchor before decrypt
  ([README §recovery](../../../packages/evidence-retention/README.md),
  [withRecoveryAuthority](../../../packages/evidence-retention/src/authority.mjs)).
- Escrow custody: delegate D holds the recovery private key offline; a copy is
  escrowed under dual control (e.g. sealed envelope with one owner + D) so no
  single person — and never C — can reconstruct decryption alone
  ([storage.md:135–138](../../../specs/017-formal-g4/storage.md)).
- No rekey/downgrade API exists; revocation does not erase already-copied
  plaintext/keys outside the adapter — physical/admin separation remains
  mandatory ([security-remediation.md:53–56](../v1/security-remediation.md)).

## 7. Deletion and hold proofs

Expiration ≠ deletion authorization: both pinned owner keys sign the exact
witness/storage identity and time, a separate current no-hold reviewer receipt
is required, and the store rechecks a checkpoint-bound deletion plan against
the **live** ledger (holds, incidents, day-90 receipts) while holding the
exclusive lock through physical unlink; any intervening journal event
invalidates the plan ([deletion.mjs:16](../../../packages/evidence-retention/src/deletion.mjs),
[format.md:145–152](../v1/format.md)). Completion additionally needs both copy
witnesses, escrow and snapshots to attest the plan; otherwise
`DELETION_UNVERIFIED`.

## 8. Flow summary (who hands what to whom)

```text
C ──candidate bundle──▶ E ──freeze/draw (witnessed)──▶ AUTHORIZED_RUN
E ──sealed packs────────▶ publish() ──copy A──▶ Domain 1 (S1 admin)
                                    └──copy B──▶ Domain 2 (S2 admin)
Witness ──signed catalog+storage receipts──▶ reader config (pinned)
Authority ──signed events──▶ journal + anchor dir (separate admin)
R ──no-hold receipt──▶ deletion;  Owners ──signature pair──▶ deletion
D ──RECOVER grant──▶ restore drill / real recovery
```
