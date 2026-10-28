# MMP-055 v1 — format, bounds and trust

## Receipt handshake for #56

`ReceiptIdentityV1` in `packages/evidence-retention/src/boundary.ts` is an additive
proposal, not a jointly approved shared API. Fields: `format`, opaque `runId`,
`epochId`, `registrationCommitment`, `candidateCommitment`, `attemptId`,
`terminalReceiptAt`, `witnessRef`, `custodyScopeId`. The signed outer witness adds
the immutable exact-byte `manifestSha256`. Per-pack inputs bind `attemptId`,
terminal timestamp, `pairId`, sealed `indexSha256`, COMPLETE/INCOMPLETE and the
observed PASS/FAIL/ERROR/ABORTED outcome. The root enumerates every source child,
all packs, each attempt/pair and every record including the original index.

#56 remains responsible for authentic registration/attempt completeness, start/
terminal ordering and retry authority. This adapter cannot discover an attempt
never submitted by a dishonest controller; the independent witness must compare
the expected attempt set against #56's witnessed terminal ledger. No selection,
private pool, hidden seed/nonce, #56 journal or strict G4 schema is imported or
modified. A storage root referencing earlier attempts does not authorize retry
after FAIL. Candidate/runtime/source provenance is retained exactly, not asserted
true by a hash. Future #57 must supply authenticated admission/finalizer receipts;
`writersRevoked: true` supplied by a caller alone is not proof of actual teardown.

## Budgets before writes

`mmp-evidence-admission-v1` explicitly admits max packs, scenarios/requests per
pack, record/pack/aggregate bytes and journal bytes. Hard ceilings: 16 packs,
100 scenarios / 10,000 requests, 16 MiB/record, 128 MiB/pack, 256 MiB/bundle,
8 MiB metadata, 64 KiB header, 4 MiB/4096 events journal. Some combinations are
rejected when their derived root/overhead cannot fit: maxima are not a promise
that their Cartesian product fits. Existing Oracle 12 MiB raw file/64 MiB raw
total bounds and strict index remain intact.

Derived raw file count is `6 + 3*S + 6*R`, 117 for MANIFEST. Reserve another 16
records for provenance, index, finalization and partial/error overhead. Per-pack
manifest reserve is `2048 + 256*maxFiles`; root reserve is 64 KiB plus all admitted
pack manifests. Every encrypted pack also contains the complete root catalog.
The binary archive costs 4 bytes + bounded metadata wrapper, manifest, full root
catalog and exact files;
AEAD adds a 16-byte tag and a 12-byte framing prefix plus the bounded header.
Admission returns aggregate **two-copy** storage bound, receipt overhead, journal
reservation and a conservative four-pack-buffer working-set bound. No lossful
compression/truncation, giant unbounded raw read or plaintext JSON reserialization.
Expected original JSON bytes are archived verbatim, including index/error rows.
No differently permissioned custody scopes are combined.

## Binary encrypted format

One independent object per sealed pack:

```
"MMP0551\n" (8 bytes)
headerBytes (unsigned 32-bit big endian)
canonical UTF-8 JSON header (<=64 KiB)
AES-256-GCM ciphertext
GCM tag (16 bytes)
```

Header suite is fixed `AES-256-GCM/RSA-OAEP-SHA256/Ed25519`. It binds full outer
identity, pack ID, root manifest SHA-256, plaintext size, 96-bit random nonce and
ordered reader/recovery recipient identities, SPKI fingerprints and wrapped
keys. Prefix + exact header are AEAD associated data. Each object uses a fresh
32-byte OS-random DEK, wrapped using RSA-OAEP with SHA-256 and a root/pack/recipient
label, with 3072–8192-bit RSA keys. The persistent exclusive nonce reservation
also rejects a repeated nonce across distinct keys. No key/nonce injection or
algorithm negotiation is offered. DEK buffers are zeroed, including failure paths;
this is not a guarantee against swap, crash dumps or a privileged debugger.

Plaintext is a 32-bit metadata length, canonical versioned wrapper containing the
exact private pack manifest and complete root catalog, and the original file
bytes in sorted order. Thus both stores retain the root catalog encrypted as
well as independently witnessing its prior commitment. No archive extraction paths are
trusted: filenames are constrained, lengths bounded, all hashes/rows cross-checked
against the **external prior signed witness**, and no trailing data is allowed.
Authentication completes before writing any plaintext file. The new restore then
re-runs unchanged `PrivateEvidence.verify` and complete root inspection, and
retains the exact prior root catalog. Catalog and storage witnesses use Ed25519;
SHA-256 pins both signed receipts in the independent reader configuration.

The public root commitment is SHA-256 of the fixed domain
`MMP-055-WITNESSED-CATALOG-V1\0`, 32 private random blinding bytes, unsigned 64-bit
catalog length and exact catalog bytes. It is distinct from #56's selection
blinding nonce. Private witness openings, file paths and per-file hashes are
never emitted by the public serializer.

## Filesystem and trust limits

Linux canonical absolute roots, owner UID and exact 0700 directories/0600 files
are required; files must be regular and nlink=1. Descriptor-relative procfs paths,
O_NOFOLLOW/O_DIRECTORY, bounded size+1 reads and before/after inode/device/mode/
owner/link/size/mtime/ctime checks protect reads. Source, nonce, audit and two store
roots must be disjoint. Restoration uses a fresh private staged directory in a
disjoint destination and publishes after complete verification.

New versions reserve directories exclusively. Files use O_EXCL staging, fsync,
link NOREPLACE publication, unlink staging and directory fsync. A final ready
marker commits the exact storage receipt. Missing/extra/staged files fail reads;
interrupted versions survive and cannot be overwritten. Restore directory rename
assumes the trusted sole owner controls its 0700 parent. This is crash-resistant
POSIX publication, not a physical power-loss test or WORM proof. Real device/fsync
guarantees require the selected media rehearsal.

All same-UID/root administrators, kernel, Node/OpenSSL, witness/reader configs and
their signing keys are in the trust base. A privileged operator can undo local
permissions, erase files, alter time/config/revocation lists, replace process code
or roll back a whole journal. Hash chains detect edits only against an external
current signed checkpoint. A signature proves possession of a key, not a separate
human/admin/failure domain. The synthetic APIs refuse REAL deployment rather than
claim that these assumptions authenticate physical custody. Candidate uid 65534
denial tests exercise OS access, not containment of hostile root or runtime escape.

## Calendar and deletion

Deadlines are UTC calendar days at the terminal receipt's UTC time: minimum +180,
independent full restore +90. A bundle including older attempts uses the latest
terminal receipt, extending their retention. Holds extend indefinitely. Immediate
post-teardown restore is separately required; it does not mark day90 complete.
Fake time is passed only in synthetic unit tests; the reader CLI uses real time.
Day90 tasks are pullable by an external operator/scheduler; no background daemon.
Missing/late/one-copy checks create a sticky incident and block deletion/acceptance.
Clock rollback also records a sticky incident. No local-clock tamper-proof claim.

Expiry is not deletion authorization. Both pinned owner keys sign the exact
witness/storage identity and time, with a separate current no-hold reviewer receipt.
The store independently checks its configured authority and 180-day bound; a magic
string or caller boolean cannot authorize deletion. Both copy witnesses, escrow
and snapshots must then attest the exact plan through pinned keys; otherwise
DELETION_UNVERIFIED. Local ciphertext removal retains version receipts/tombstones;
it does not prove secure physical erasure, destruction of RSA escrow keys or
nonexistence of unregistered administrator snapshots. Those facts need real
custodian verification. No automated key erasure/rekey/hold waiver is provided.
