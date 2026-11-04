# MMP-055 two-domain deployment — one realistic minimum

Docs-only proposal, 2026-11-04. **No hardware exists, is purchased or is
asserted.** [#55](https://github.com/Meta-Project2026/Metamorph/issues/55)
requires two encrypted copies in **genuinely distinct physical failure and
administrative domains**. The adapter already enforces the software-visible
part: `pair()` rejects two stores sharing `domainId`, `principal`,
`failureDomain`, `root`, or the same device/inode identity
([store.mjs:221–238](../../../packages/evidence-retention/src/store.mjs)), and
`assessCustody()` reports `NOT_DEPLOYED / NOT_ESTABLISHED` with explicit
limitations ([store.mjs:208–219](../../../packages/evidence-retention/src/store.mjs)).
What follows is the minimum realistic deployment that can make those synthetic
fields true.

## 1. Reference deployment (minimum acceptable)

```
                        ┌─────────────────────────────┐
                        │ Runner host (disposable)     │
                        │ C or operator; NO keys,      │
                        │ NO mounts, NO decrypt rights │
                        └──────────────┬──────────────┘
                     publish() over controlled transfer│
             ┌───────────────────────────┐             │
             ▼                           ▼             ▼
   ┌──────────────────────┐    ┌──────────────────────────────┐
   │ DOMAIN 1 — primary    │    │ DOMAIN 2 — offline secondary │
   │ Custodian machine/NAS │    │ Encrypted removable medium   │
   │ separate physical host│    │ separate site/safe, second   │
   │ separate admin account│    │ storage owner; mounted only  │
   │ owned by custodian S1 │    │ on restricted reader host S2 │
   └──────────────────────┘    └──────────────────────────────┘
```

| Property | Domain 1 (primary) | Domain 2 (offline secondary) |
| --- | --- | --- |
| Hardware | Dedicated custodian machine or NAS, not the runner host, not a candidate dev host | Encrypted removable medium (e.g. hardware-encrypted or LUKS portable SSD) |
| Location | Separate room/power circuit from runner | Physically separate site/safe; not carried with the runner |
| Administrator | Named custodian S1 with a separate OS account; candidate author has no account and no sudo there | Named storage owner S2; medium only mounted on a restricted reader host under S2's account |
| Encryption at rest | Adapter AEAD (AES-256-GCM, [crypto.mjs:29](../../../packages/evidence-retention/src/crypto.mjs)) **plus** device-level encryption; adapter ciphertext alone does not protect an unencrypted-at-rest disk from physical theft | Medium-level encryption mandatory (adapter ciphertext + medium encryption) |
| Network | May be LAN-connected for publish; no inbound exposure; candidate processes never reach it | Disconnected except during witnessed verification sessions |
| Failure-domain separation proven by drill | Loss of Domain 2 (or its site) leaves Domain 1 verifiable, and vice versa | Same |

This matches the default target in
[local-first-decision.md §5](../../../specs/017-formal-g4/local-first-decision.md):
custodian-controlled encrypted primary disk/NAS **plus** physically separate
encrypted offline medium under independent control.

## 2. Explicitly insufficient deployments (rejected by policy)

Per [#55](https://github.com/Meta-Project2026/Metamorph/issues/55),
[storage.md:17–24](../../../specs/017-formal-g4/storage.md) and
[local-first-decision.md §5–6](../../../specs/017-formal-g4/local-first-decision.md):

- two directories on one host or one filesystem;
- a single administrator (or one root account) controlling both copies;
- two copies in one NAS, one RAID set or one enclosure;
- GitHub artifacts (7-day expiry) or any runner-temp location;
- a cloud sync folder mirrored to one physical device;
- custody where the candidate author/admin holds decryption keys or controls
  both administrators.

## 3. Power-loss, fsync and durability expectations

The adapter is crash-resistant POSIX, **not** a power-loss guarantee:
publication uses `O_EXCL` staging, file fsync, `link(NOREPLACE)`, unlink
staging and directory fsync, with a final ready marker
([format.md:105–112](../v1/format.md)). Journal appends fsync per record; the
journal and each store share an exclusive lock; a stale crash lock fails closed
until witnessed recovery ([format.md:122–126](../v1/format.md)).

| Expectation | Requirement on the selected domains |
| --- | --- |
| fsync honored | Verify the real media do not lie about fsync (no volatile write-back cache without capacitor/UPS flush); rehearse power-cut during publish on synthetic data |
| Crash between journal and anchor | Must fail closed and require witnessed recovery — rehearse this exactly (adapter already refuses silent repair) |
| Power events | UPS or known-flush behavior for Domain 1; Domain 2 is offline so its risk is medium loss/degradation, handled by drill |
| Filesystem | POSIX mode-bit semantics required (production paths are Linux; Windows is `UNSUPPORTED_PLATFORM` and fails closed — [README](../../../packages/evidence-retention/README.md)) |
| Snapshots/immutable flags | Useful defense-in-depth but **not WORM** against a privileged administrator ([local-first-decision.md §6](../../../specs/017-formal-g4/local-first-decision.md)); independence claims rest on separate administrators, not flags |

## 4. ACL and access expectations

- Store roots: canonical absolute Linux paths, owner = store principal, dirs
  `0700`, files `0600`, regular files only, `nlink=1`; source/nonce/audit/two
  store roots disjoint ([format.md:93–99](../v1/format.md)).
- Candidate processes and candidate-author administrators: no ACL grant, no
  group traversal, no read on any store root, journal root, anchor root, nonce
  root, witness dir or reader config; verify by actual uid-denial drill, not by
  configuration review.
- Reader administrator pins witness hashes in a separately administered config;
  writer-supplied trust anchors are forbidden
  ([README step 5–6](../../../packages/evidence-retention/README.md)).

## 5. Capacity and quota

Preflight is mandatory before any write: `admission()` derives the aggregate
**two-copy** storage bound, receipt overhead, journal reservation and
`maxAuthorityBytes` from the epoch's shape
([core.mjs:98](../../../packages/evidence-retention/src/core.mjs), [format.md:31–50](../v1/format.md)).
Hard ceilings: 16 packs; 100 scenarios / 10,000 requests; 16 MiB/record;
128 MiB/pack; 256 MiB/bundle; 8 MiB metadata; 64 KiB header; journal 4 MiB /
4096 events ([core.mjs:6–16](../../../packages/evidence-retention/src/core.mjs)).
Per-epoch quota on each domain ≥ published bound + working-set buffer; both
domains must reject the bundle when either cannot fit — never truncate.

**The 117-file public manifest (6 + 3·S + 6·R) is the regression floor, not an
assumed upper bound**; a real epoch's budgets come from its own admitted
registration plus partial/failure overhead ([format.md:41–50](../v1/format.md)).

## 6. Trust assumptions (declared, not hidden)

In the trust base: same-UID/root administrators of each domain, kernel,
Node/OpenSSL, witness/reader configs and signing keys; a privileged operator
can undo permissions, erase files, alter clock/config or roll back journal +
anchors together ([format.md:113–121](../v1/format.md)). Mitigation is
organizational: separate administrators per domain, separate credentials, no
shared root, and the residual risk recorded in the final receipt
([threat-model.md:49–53](../../../specs/017-formal-g4/threat-model.md)).
Hash chains detect edits only against the live externally pinned signed
checkpoint; a signature proves key possession, not a person or a failure
domain.

## 7. Domain inventory worksheet (fill per real deployment)

```text
Domain 1: device= model= serial= location= filesystem=
  admin account= custodian=          (separate from candidate author: yes/no)
  at-rest encryption= fsync/power=   quota=/network=
Domain 2: medium= serial= storage site= mount host= mount policy=
  admin account= storage owner=      (separate from Domain 1 admin: yes/no)
  medium encryption= offline policy=
Separation drills planned: device-loss / site-loss / admin-loss / power-cut
```
