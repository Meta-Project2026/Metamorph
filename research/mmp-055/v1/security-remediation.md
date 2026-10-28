# PR #64 — B1/B2 security remediation, 2026-10-29 local

Base/main: `cb707bb3481ec115460b26ca0da4356a1b47a3ad`.
Starting PR HEAD: `e538603a6295759c0282d8a8db052dee2d26b829`.
Both refs were fetched and matched before editing. Existing PR branch only;
no reset/rebase, sibling worktree, shared DTO/Oracle/worker/CI or feature-pointer edit.
Source of findings: [independent review 5690747718](https://github.com/Meta-Project2026/Metamorph/pull/64#pullrequestreview-5690747718).
Earlier automated no-findings re-review did not resolve this later blocking review.

## Before-fix proof

Two negative security tests were added BEFORE changing implementation and executed
against the vulnerable HEAD in the pinned Linux unit container. **Exit 1: 87 total,
84 PASS, 2 FAIL, 1 Windows-only SKIP** (79.044 s). Both intended failures occurred:

- B1: a valid recovery completed, a different authority instance recorded revoke,
  then the identical config/grant/key/cached empty list was reused in a new reader
  process. Actual exit **0**, expected **1**: revoked grant was admitted.
- B2: two generic unsigned DAY90 events were appended. Actual
  **SIMULATED_VERIFIED**, expected unverified/pending: no signed restore occurred.

The same two invariant tests are retained in `security-remediation.test.mjs` and
pass after the fix. No expected failure was renamed a successful control.

## B1: current authority before access

`authority.mjs` implements the narrow versioned live handoff. The immutable reader
config pins the external anchor directory's device/inode, policy context and
authority public key. The context is rebuilt against the reader's already frozen
catalog/storage witnesses. Signed checkpoint records in that directory form an
exclusive, contiguous append-only chain, one checkpoint for EVERY policy event.
Each anchored prefix must match the replay-validated journal; the latest external
checkpoint must equal the current log. Old signed snapshots, missing or changed
pins, journal rollback, signature/context/sequence/digest substitution and
unavailable authority fail closed. Neither the cached `revoked` vector nor a
snapshot handed over solely by the writer at restore time establishes freshness.

The live source must be independently administered in real custody. Its protected
path/inode/key are trusted out-of-band configuration. This is a synthetic local
simulation, not a claim of administrator-resistant monotonic hardware. A malicious
same-UID/root operator able to roll back BOTH log and external anchors/config can
defeat those assumptions. Real deployment remains refused.

The common exclusive journal lock spans fresh authority verification, grant scope/
identity/purpose/time validation, unwrap/decrypt, exact-byte restore and CLI signed
receipt publication. A separate writer cannot make revocation authoritative in
that interval: its attempt fails busy and must retry. Once revoke commits and its
anchor is published, all later readers with the unchanged old config deny access.
A crash between log and anchor publication leaves a mismatch and blocks access;
there is no silent repair, lock override or automatic rollback. Authorized
unrevoked grants and ordinary READER principals retain their intended behavior.

Revocation is adapter authorization, not erasure of already disclosed plaintext or
of a private key/ciphertext copied outside the trusted adapter. Separate OS/admin
custody and current independently protected anchors are still mandatory for real
claims. The synthetic reader needs the lock capability, reads authority records,
and receives no authority signing private key.

## B2: authenticated events on admission AND replay

`policy-events.mjs` centralizes privileged types. Generic Journal/Ledger append
rejects RESTORE_RECEIPT, HOLD_RELEASE, DELETION_AUTHORIZED, DELETION_VERIFIED,
GRANT_REVOKED, RETENTION_POLICY and old RESTORE_VERIFIED without appropriate proof.
The harmless restore audit marker is now RESTORE_CHECKED_AUDIT and has no reducer
authority. Ordinary logging, incidents and conservative hold additions remain.

Privileged records carry an Ed25519 authority authorization over context, prior
checkpoint, timestamp and exact event digest. Restore events also retain the FULL
signed reader receipt, not only a caller-selected SHA: exact identity/witness/
manifest, registered principal/domain, complete version/file/pack coverage and
purpose/time are validated independently. Duplicate receipts and replay at a
different prefix reject. Hold release/deletion retain and reverify the actual
owner/reviewer/custodian proofs and current hold/day90/incident prerequisites.

The identical validator runs at ingest, journal restart, state reduction and at
physical deletion. Deletion retains the previous lock/checkpoint guarantees and
also checks the live external high-water source. A hand-written syntactically valid
forged event cannot upgrade state after restart. Genuine recovery of an INCOMPLETE
pack proves only its recoverability: G4 remains INCONCLUSIVE, product NOT_ESTABLISHED.

Bounds: existing canonical 4096-byte event limit, admitted journal bytes and
4096-event count remain. External anchors are individually <=4096 bytes, at most
4096 records and <=4 MiB total. Admission additionally reserves journal+anchor
storage as `maxAuthorityBytes`; original pack/record/AEAD bounds are unchanged.
The unit-container helper copies frozen Zod once into tmpfs, avoiding repeated
Windows-bind-mount module loads in the new child tests without changing assertions,
network isolation or deadlines. No new dependency, daemon, cloud or model job.

## Executed post-fix matrix

The final command outputs/counts are in `security-test-output.txt`; actual source
and test versions are those of the pushed remediation commit linked in the PR.
All data and signing/decryption keys are fabricated ephemeral test fixtures.
Commands: frozen install, lint, typecheck, root test, build, targeted package test,
Linux unit-container command from validation.md, `git diff --check`.
All commands exited 0 after the fixes. Node 22.23.1 / OpenSSL 3.5.7, pnpm 11.25.0,
TypeScript 5.9.3, Biome 2.6.3. The same pinned Node image and Docker restrictions
as validation.md were used; no network, host credentials or candidate code.

| Actual final run | Total | PASS | FAIL | SKIP |
| --- | ---: | ---: | ---: | ---: |
| Local Linux root-capability unit container | 107 | 106 | 0 | 1 Windows-only |
| Windows targeted package | 107 | 5 | 0 | 102 Linux-only |
| Windows root suite | 255 | 153 | 0 | 102 Linux-only |

Linux reported 26.053 s. Both privileged foreign-owner/uid-denial tests executed;
none was counted as passed through a skip. Windows explicitly rejects POSIX-only
storage instead of asserting equivalent Windows ACL security. All 22 added
security cases ran in Linux, including the same two originally failing attacks.
Final-head hosted CI is reported in the append-only PR/Issue receipt with exact
SHA/job URLs; previous-head SUCCESS is never substituted for this run.

Required controls cover unchanged-config revoke/restart/unrelated grant; missing,
stale, forged and substituted authority; invalid grant scope/purpose/signature;
separate writer contention; unsigned generic and persistent event injection;
replayed signatures; wrong reader/domain/manifest/version/count; legitimate full
117-file dual child DAY90 recovery; incomplete evidence non-claims; old FIFO,
deletion hold/lock, byte/index tamper, partial/error and uid-denial regressions.

Real media/custody NOT_DEPLOYED; real elapsed 180d/day90 NOT_RUN; G4 INCONCLUSIVE;
PRODUCT NOT_ESTABLISHED; PR #31 AUDIT_FAIL unchanged. Independent reviewer
acceptance is REQUESTED/NOT_YET_APPROVED. PR #64/#55 remain open; no merge.
