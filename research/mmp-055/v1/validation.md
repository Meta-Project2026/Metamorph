# Executed synthetic validation — 2026-10-29 local

BASE_SHA: `cb707bb3481ec115460b26ca0da4356a1b47a3ad`.
Branch: `Vladimir/mmp-055-encrypted-local-evidence`.
Scope: new package and original synthetic fixtures, additive root unit-test entry
and workspace lock importer only. No protected Oracle/comparator/worker/DTO,
reference/candidate/public MANIFEST, historical audit, CI workflow or active
feature pointer changed. No hidden pack read, real G4, model/provider call, cloud
service, purchased medium or deployment. Review is pending, not self-approval.

Published [PR #64](https://github.com/Meta-Project2026/Metamorph/pull/64) with
implementation `2658da4cd66cf063d9fe2922481f2648a74c77e7`.
[Independent review request](https://github.com/Meta-Project2026/Metamorph/pull/64#issuecomment-6482128835)
is posted; the GitHub ChatGPT connector acknowledged code review running. No
verdict is inferred. The [#56 interface handoff](https://github.com/Meta-Project2026/Metamorph/issues/56#issuecomment-6482129406)
is proposed, not agreed. [Fast CI](https://github.com/Meta-Project2026/Metamorph/actions/runs/40779029504)
was in progress when this publication note was written; consult its actual
terminal result separately. Subsequent documentation-only publication metadata
does not change the locally tested implementation.

## Actual results

| Command / environment | Exit | Tests / result |
| --- | ---: | --- |
| `pnpm install --frozen-lockfile`, Windows | 0 | Existing pinned dependencies + workspace-only importer |
| `pnpm lint`, Windows | 0 | Biome; no fixes required |
| `pnpm typecheck`, Windows | 0 | Builds and workspace checks; typed handoff compiles |
| `pnpm test`, Windows | 0 | 223 total: 153 PASS, 0 FAIL, 70 explicit Linux skips |
| `pnpm build`, Windows | 0 | All workspace builds |
| `pnpm --filter @metamorph/evidence-retention test`, Windows | 0 | 75 total: 5 PASS, 0 FAIL, 70 explicit Linux skips |
| Pinned Linux synthetic unit-test container, command below | 0 | 75 total: **74 PASS, 0 FAIL**, 1 Windows-only skip; 84.419 s reported test duration |
| `git diff --check` | 0 | No whitespace errors |

See [actual sanitized test output](test-output.txt). It contains only literal
test names and terminal counts, not keys, raw packs, paths or private file hashes.
Full development logs are outside Git and are not a retention artifact.

Windows checks ran on Node **22.23.1**, OpenSSL **3.5.7**, pnpm **11.25.0**,
TypeScript **5.9.3**, Biome **2.6.3**. Linux tests used official Node
**22.23.1-bookworm-slim**, Node **22.23.1**, OpenSSL **3.5.7**, linux x64, uid 0,
pinned image digest:
`sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3`.
Actual local Docker CLI/daemon **29.9.2**, Docker Desktop **4.97.0**; daemon kernel
`6.18.54.1-microsoft-standard-WSL2`. This is a local Docker Desktop Linux VM, not
independent hardware. Test capability exceptions CHOWN/SETUID/SETGID are solely
for real foreign-owner/uid-denial unit fixtures, not an untrusted candidate.
All other capabilities dropped, no-new-privileges, no network, read-only root,
2 CPUs / 1 GiB / 96 PIDs and a 768 MiB /tmp tmpfs. Source mount is read-only;
tests copy only trusted code and built Oracle/contracts into tmpfs and use the
installed frozen Zod. No Docker socket or host credentials is mounted/forwarded.

PowerShell reproduction after frozen install and `pnpm build`:

```powershell
docker run --rm --network none --read-only --cpus 2 --memory 1g --pids-limit 96 `
  --cap-drop ALL --security-opt no-new-privileges `
  --cap-add SETUID --cap-add SETGID --cap-add CHOWN `
  --tmpfs /tmp:rw,nosuid,nodev,size=768m `
  --mount "type=bind,source=$((Get-Location).Path),target=/source,readonly" `
  node@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3 `
  node /source/research/mmp-055/v1/linux-test.mjs
```

No new CI job was added. These bounded unit tests are part of existing `pnpm test`.
On ordinary nonroot hosted Linux the two chown/setuid-specific fixtures explicitly
skip; the local root-capability container actually executed both. Hosted CI,
independent review and actual physical custody are separate facts and must be
reported from their own future receipts.

## Scenarios actually exercised

- Real existing `verifyPair(MANIFEST)` and `retainOracle`, independent synthetic
  SQLite adapters, **3 scenarios / 17 requests / 117 raw files**, umask 022,
  owner-only modes and exact records/index. Separate witness process freezes the
  prior catalog. Both encrypted copies restore in distinct new reader processes
  after raw/source directories are destroyed; every retained file and all 117
  embedded original byte arrays are compared to the original frozen values.
- Complete behavioral FAIL remains COMPLETE/FAIL. Request ERROR, cleanup ERROR,
  aborted attempt and multiple packs/earlier partial attempts remain explicit.
  High-count synthetic fixture retains **498** raw files without sampling. Exact
  byte budget admits; one-byte overflow rejects. Full root catalog is encrypted
  in every pack and compared to the external prior witness, not trusted solely
  because it was recovered from the ciphertext.
- Missing/extra/duplicate original index, record deletion/mutation/oversize,
  symlink/hardlink/outside-root/excess depth, real foreign owner, weak modes,
  custody-scope mismatch, pinned-descriptor TOCTOU substitution and late/missing
  writer revocation reject. Storage roots/receipt overrides also reject.
- Ciphertext bitflip, tag change, truncation, appended/deleted object, missing
  ready marker, extra upload file and altered receipt; wrong key, wrong run/
  epoch/candidate/attempt, mismatched/absent prior witness, unapproved rekey/suite
  downgrade, weak/public-key confusion and actual forced nonce reuse reject.
- Simulated interrupted WRITE/FSYNC/PUBLISH/RECEIPT boundaries survive as
  immutable partial versions and reject retry overwrite. Partial secondary
  failure preserves primary/secondary artifacts and incident. Secondary audit
  error does not hide primary error. This is fault injection, not power-cut
  testing of a physical disk.
- Loss of either store still permits independent full restore of the other.
  A real uid-65534 child with empty environment cannot read private source or
  key. Malicious shared/root administration never establishes physical
  independence and REAL deployment is rejected. Escrow succeeds only with a
  signed unexpired/unrevoked grant; separate delegated child restores after
  original source teardown. These principals and custody signatures are synthetic.
- UTC +180/+90 deadlines, immediate versus day90 distinction, full signed
  two-copy day90 restores, missing/one-copy/late day90 fail-closed incident,
  forged/incomplete receipts, persistent clock rollback, legal/incident holds,
  two-owner hold release, premature/unauthorized deletion, exact both-owner plus
  reviewer expiration, actual synthetic ciphertext unlink+tombstones and all
  four pinned copy/escrow/snapshot witness receipts. Time is deterministic/fake
  only for these future lifecycle tests; no 90/180 real days are claimed.
- Journal bounds/reserved failure space, chained history/checkpoint tamper and
  rollback detection, persistent revocation and public output canary allowlist.

Development failures were corrected before the final successful run: upstream
mkdtemp names required case-sensitive safe basename support; a real foreign-owner
read can fail with EACCES after dropping DAC override; a missing archive root now
returns a fixed witness-mismatch failure. These are not erased qualification runs.

## Explicit non-claims

ENCRYPTION_IMPLEMENTED; TWO_SIMULATED_COPIES_TESTED;
REAL_PHYSICAL_CUSTODY_NOT_DEPLOYED; REAL_DAY90_NOT_YET_DUE/NOT_RUN;
REAL_G4_RESTORE_NOT_RUN. **G4=INCONCLUSIVE, PRODUCT=NOT_ESTABLISHED,
EXTERNAL_RETENTION_NOT_RUN** for real evidence. No actual 180-day storage elapsed,
named real media/custodians, real escrow/key-loss recovery, second-owner signature,
full hidden execution or product acceptance is established. The trusted same-uid/
root operator can bypass filesystem/clock/config controls; external live witness
checkpoints and real independent administration remain required. Prior #31
AUDIT_FAIL remains unchanged. Issue #55 stays open for review/deployment work.
