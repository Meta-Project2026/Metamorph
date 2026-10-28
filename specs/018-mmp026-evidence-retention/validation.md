# MMP-026: local evidence retention validation

Refs #26. Base: `1aa36b8f4ab7a6f1d8f291d8751856ed51274685` (freshly fetched `origin/main`).
Branch: `fix/mmp-026-complete-private-evidence`. Implementation HEAD will be recorded after commit; hosted proof is pending.

## Scope and root causes

The previous bridge rejected the 101st file, although the public MANIFEST has
3 scenarios, 17 requests, and 117 writer files. Child directories inherited
0755 under umask 022 and were correctly refused by the private reader.
The runner delta only adds explicit 0700 to its three child-directory creations;
its existing file writes remain 0600. No comparator, normalization, MANIFEST,
fixture, controls, gate meaning, historical receipt or workflow is changed.

Retention now lives in `packages/differential/src/oracle-retention.mjs`, re-exported
through the existing import path. It validates captured metadata before copying,
preflights actual serialized sizes, reads back every destination record, and
checks source stability before publishing the catalog. PrivateEvidence verification
checks exact directory/index membership, unique IDs, sizes, hashes and bounded reads.

## Bounded inventory and publication

- Maximum admitted writer shape: 100 scenarios, 100 requests per scenario.
  Absolute file admission bound: `6 + 3*100 + 6*100*100 = 60306`.
  The tighter publication budget is `6 + 3*scenarioIds.length + 6*expectedSteps`.
  For MANIFEST: `6 + 9 + 102 = 117`. Complete runs require equality and all
  initial/reference/paired/diff paths derived from executed IDs, not just a count.
- Raw file <=12 MiB; aggregate raw <=64 MiB. Each serialized base64 record,
  catalog and projected index <=16 MiB. Existing pack occupancy + all planned
  records + catalog + projected index <=128 MiB. Base64 envelope overhead counts.
  Later caller metadata remains subject to the unchanged pack write limit and
  final verifier; retention cannot reserve arbitrary future writes.
- Only fixed run files and the writer's bounded single-level db/http/diffs names
  are admitted. Duplicate, extra, missing and unindexed files fail closed.
  Reads require owner-only mode, current UID, one link, no symlink ancestors,
  O_NOFOLLOW, stable inode/size/mode/owner/timestamps and a size+1 bounded buffer.
- ERROR and initial-mismatch publications retain every available indexed file
  as INCOMPLETE. A failed diff creation may leave an executed ID and its two
  saved observations; only the absent diff is optional for an ERROR gate.
  PASS/complete publications still require all derived files. A complete FAIL
  comparison can retain COMPLETE evidence without changing its gate verdict.
- A copy or readback failure writes a safe INCOMPLETE receipt where possible and
  preserves the original public-safe error. A failed catalog publication withdraws
  that catalog. If its write already entered the pack's in-memory index, sealing
  cannot verify successfully: preserve the partial directory and original error,
  do not retry it as a completed pack. Cleanup failure cannot manufacture success.
  A catalog alone is not an accepted sealed pack; callers must check retention's
  result and verify the final index after their own metadata/teardown.

## Synthetic test design

Tests drive real verifyPair and PrivateEvidence with two independent SQLite
observations adapters and the public MANIFEST. No PHP, candidate source, private
sample, provider call or container is executed. The full test measures raw count,
executed HTTP/DB IDs, closed adapters, catalog path uniqueness, exact base64-restored
bytes, byte lengths, SHA-256 and full sealed-index membership under umask 022.
This is evidence plumbing proof, not migration parity or product acceptance.

Negative controls cover modes, symlink/hardlink, real foreign ownership when
root/passwordless sudo is available, forged UID admission, unsafe/extra/nested
paths, missing initial/run files, duplicate metadata/scenarios/references,
manifest overflow, raw/encoded/aggregate/occupied-pack bounds, read/copy mutation,
interrupted writes, post-catalog faults, corrupt index/hash/size, partial requests,
initial mismatch, failed comparison, cleanup and three failed diff writes.
Windows explicitly skips POSIX cases; it does not emulate Linux ownership.

## Executed commands

Local Windows, Node 24.21.0, pnpm 11.25.0. Original implementation checks:

| Command | Exit | Observed result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | lockfile unchanged |
| `pnpm lint` | 0 | 138 files |
| `pnpm typecheck` | 0 | workspace build/typechecks |
| `pnpm test` | 0 | 148 PASS, 0 FAIL, 0 SKIP |
| `pnpm build` | 0 | workspace build |
| `pnpm --filter @metamorph/oracle test:reference` | 0 | 55 PASS, 0 FAIL, 1 POSIX SKIP |
| `pnpm --filter @metamorph/differential test` | 0 | 77 PASS, 0 FAIL, 39 POSIX SKIP (before review additions) |
| `node --test packages/oracle/probes/qualification.test.mjs` | 0 | 2 PASS, 0 FAIL, 0 SKIP |
| `node --test packages/differential/test/evidence.test.mjs` | 0 | 0 PASS, 0 FAIL, 39 POSIX SKIP (before review additions) |

Review found a missing-diff ERROR regression; it was corrected with three writer
fault-injection cases. Final review-amended Windows checks also completed with exit 0:
`pnpm lint` (138 files), `pnpm typecheck`, focused
`node --test packages/differential/test/evidence.test.mjs` (0 PASS, 0 FAIL,
45 POSIX SKIP), and `pnpm --filter @metamorph/differential test`
(77 PASS, 0 FAIL, 45 POSIX SKIP). Primary Linux 117/117 proof: **NOT_RUN**, pending existing
Fast CI. No workflow change or private/Docker test is requested.

## Review and limits

A fresh read-only investigation and patch review were performed under the security
fix skill. They are implementation-assistance checks, not independent ChatGPT
acceptance or owner approval. The independent ChatGPT handoff remains outstanding.

Local-first and the minimum 180-day retention / independent full-index exact-byte
restore by day 90 are reported owner-approved policy, not certified by this patch.
The authenticated second-owner record remains a separate governance action.
Dual-copy encrypted storage belongs to #55. Historical sampled PR #31 remains
AUDIT_FAIL; formal G4 remains INCONCLUSIVE; product remains NOT_ESTABLISHED.
