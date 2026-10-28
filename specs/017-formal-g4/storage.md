# Durable private G4 evidence requirements (proposed)

Local private packs and public SHA-256 receipts already exist. Durable encrypted
retention, a recovery/key policy and independent restore receipts do not exist in
the reviewed implementation. **EXTERNAL_RETENTION_NOT_RUN** remains the current
status. This document specifies future requirements; no storage was configured
or private bytes read for MMP-038.

## Local-first interpretation (pending exact-policy owner ratification)

The [local-first architecture direction](local-first-decision.md) makes cloud
providers **optional**, not mandatory for any migration or Oracle operation.
For formal G4, a locally administered encrypted primary medium and a physically
separate offline encrypted backup may satisfy the proposed two-failure-domain
requirement **only if** independent physical/admin custody, witnessed immutable
commitments, access denial, key recovery, exact-byte restore and required retention
are demonstrated. Two directories, co-located writable disks or copies controlled
by the candidate-author administrator do not establish independence. Where
local media cannot meet the chosen independence profile, formal G4 is BLOCKED or
requires an explicitly approved stronger custodian/storage option. This is a
proposal, not evidence of current secure storage or second-owner assent.

## Canonical raw pack and integrity

One run root indexes the frozen registration, selection and all attempts/pairs.
Keep complete input definitions, source/license/fixture/runtime/candidate/build
receipts, entropy/sampler transcript, full raw reference/candidate HTTP bytes and
headers, trusted initial/post-step typed SQLite snapshots, comparator diffs,
controls and mutation receipts, private stdout/stderr/diagnostics, execution and
access journals, G0-G4 evidence, teardown inventories and finalization faults.
Store retained source/artifact bytes or a verified recoverable dependency archive;
a disappearing Git URL is not sufficient reproduction evidence.

Use the existing Oracle evidence files (manifest, events, gate results, controls,
usage, http/db/diffs/report) and private PHP/bridge/Oracle/provenance packs rather
than replacing the comparator. Explicitly distinguish raw observations, derived
views and public summaries. Record provider usage receipts where applicable;
NOT_RUN/null remains honest for unexecuted calls/unknown counts.

The private integrity manifest contains format/version, run/epoch/attempt/pair
IDs, full frozen identities, exact relative filenames, byte lengths, SHA-256 of
each file, total file/byte counts, required entries and explicit COMPLETE or
INCOMPLETE status. The run root includes every pair index and partial failed
attempt; a hash-valid partial pack is not a complete pack. Reject duplicate,
missing, extra/unindexed or unsafe paths, symlinks/hardlinks/foreign ownership,
unexpected mutation and wrong modes. Seal exact immutable bytes, not a later
JSON parse/reserialize. Public commitments use protocol blinding; low-entropy
private per-file hashes/paths/IDs/entropy stay private.

Preflight file/byte budgets from admitted scenario/request/raw limits, including
base64 expansion, indexes, diagnostics and partial/failure overhead. Existing
limits differ: retainOracle <100 files and 64 MiB; audit catalog <=256 files /
64 MiB / 12 MiB per file; PrivateEvidence <=16 MiB per record / 128 MiB per pack.
Do not concatenate a whole corpus into one existing pack and assume it fits.
Per-pair packs plus a bounded root catalog are the intended reuse. Admission must
reject a bundle that cannot fit, or approve a separately implemented lossless
bounded layout before registration. No truncation, sampling or dropped evidence.
Issue #26's full-manifest 117-file and umask-022 tests remain a prerequisite when
using that retention path; this proposal does not fix or bypass them.

## Required order and receipts

1. Write raw records under trusted private owner-only Linux directories (0700 /
   0600); enforce permissions independently of a permissive caller umask. Keys,
   corpus and raw logs are outside Git/candidate workspaces.
2. Finish or abort useful execution. Attempt bounded normal worker teardown and
   independent inventory/finalizer. Emergency removals or unknown inventory are
   sticky errors; collect partial receipts anyway.
3. Revoke all asynchronous writers, collect final diagnostics/partial state,
   finalize the exact catalog and seal every available pack. Check byte lengths,
   every SHA-256, index/root coverage and evidence references **after teardown**.
   Keep missing teardown or catalog completeness explicit; successful hash checks
   cannot erase those failures.
4. Encrypt sealed private bytes with an independently reviewed authenticated
   encryption implementation and approved key management. No custom cipher or
   key in repo/workflow/candidate/model context. Record ciphertext identity and
   private plaintext manifest root, algorithm/key version and authenticated
   metadata binding run/epoch/attempt.
5. Transfer to owner-restricted, durably retained storage **outside runner temp**
   and public GitHub artifacts. Encrypted local/offline media under independent
   custody can qualify; a remote/cloud upload is optional. Obtain the durable
   medium and immutable-version identity, length/hash and completion receipt;
   independently verify the retained bytes. Never overwrite an earlier version
   on retry.
6. R or an eligible recovery delegate restores from the durable copy into a new
   restricted environment after application workers have been destroyed. Verify
   decrypt/authentication, every exact plaintext file/index/root and full expected
   coverage. Compare with the preexisting frozen commitments and execution
   receipts, not a new manifest supplied solely by the restored object.
7. Produce a restricted restore attestation and a minimal public retention
   status/opaque receipt. Only then may final acceptance record RETAINED_VERIFIED.
   If keys, storage or restoration fail, retain local/partial material where
   possible and record ERROR. Never assert recoverability from upload alone.

Independent restore uses a fresh reader/process and the prior witnessed
commitments, independent of the upload writer's success report. Under
LIMITED_TWO_PERSON, any overlap of E and R is disclosed: technical re-verification
does not become an independent third-person witness. The strong profile requires
an eligible separate reviewer.

Runner deletion follows successful durable restore; local raw packs must not be
the sole copy. Storage upload/restore has a separately approved bounded time/
byte budget and cannot resume candidate execution. A hard-killed runner may leave
no usable final receipt: report missing evidence, not PASS. Public hashes or a
GitHub artifact holding only summary/finalizer JSON are not raw retention.

## Storage, access and recovery policy

Proposed initial policy, requiring both-owner selection/acceptance:

- Retain complete encrypted run material and all failed attempts for **180 days
  from terminal receipt**, extended while an acceptance dispute or incident is
  open. Record the actual expiry timestamp per run. This is a proposed minimum,
  not an assertion of an existing legal retention obligation.
- Maintain two verified encrypted copies in separate failure domains, with
  immutable version retention for that period. A second directory on the same
  disposable runner is not a second durable copy.
- Permit the named custodian service account to upload new versions. Restrict
  decryption to appointed non-candidate custody/review principals; candidate
  authors and their service accounts have no raw access. Log grants, reads,
  restores, key changes and deletion, with bounded access expiration.
- Name a recovery delegate and tested key escrow path independent of the
  transient runner account. Escrow must not let the current candidate author
  decrypt the pool. If two-person infrastructure cannot enforce this, declare the
  limitation and use an eligible external custodian or remain BLOCKED.
- Select the concrete store, encryption/key service, recovery principal, backup
  location, quotas and deadlines before IMPLEMENTATION_READY. Test recovery with
  synthetic data before any hidden ingestion and with the actual retained pack
  before acceptance. Repeat a recovery check at day 90 for retained evidence;
  keep any failed check as an append-only availability incident.
- At expiry, both owners authorize deletion only after R confirms no hold.
  Record affected object/key versions and verification that all retained copies,
  snapshots and recovery replicas were deleted or cryptographically erased under
  the selected service's reviewed guarantees. Keep a public-safe deletion receipt
  and final metadata. Until verification completes report DELETION_UNVERIFIED.
  Expiry without recovery terminates any claim of current raw availability; it
  never changes the historical observation.
- During loss, unauthorized access or tampering, freeze deletion, revoke affected
  grants, preserve incident metadata and inform the owners via the approved
  process. Do not expose leaked content in the incident report. A new acceptance
  decision is required if evidence integrity or independence cannot be established.

No vendor or cloud entitlement is assumed. Selecting a product does not prove its
configuration. ACL denial, key recovery, exact-byte restore, oversize/corruption,
interrupted upload, missing index and deletion controls must execute on synthetic
packs in the storage slice. Current local helper APIs may be wrapped unchanged;
any required shared helper fix is a separate jointly reviewed change.
