# MMP-026: local evidence retention validation

Refs #26. Base: `1aa36b8f4ab7a6f1d8f291d8751856ed51274685` (freshly fetched `origin/main`).
Branch: `fix/mmp-026-complete-private-evidence`. Implementation HEAD: `f0692a21cb43c397f0e9afe5e0199b69f9a4ed2a`.
The follow-up validation commit changes documentation only; its final HEAD is recorded
in [PR #59](https://github.com/Meta-Project2026/Metamorph/pull/59).

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
(77 PASS, 0 FAIL, 45 POSIX SKIP). Primary Linux 117/117 proof: **PASS**, measured below. No workflow or
private/Docker test was introduced.

## Hosted Linux proof

[Fast CI run 40755125807](https://github.com/Meta-Project2026/Metamorph/actions/runs/40755125807),
2026-10-28, Ubuntu 24.04.5, completed SUCCESS for both jobs:

- [Node 22.23.4, job 123051887467](https://github.com/Meta-Project2026/Metamorph/actions/runs/40755125807/job/123051887467).
- [Node 24.22.1, job 123051886691](https://github.com/Meta-Project2026/Metamorph/actions/runs/40755125807/job/123051886691).

The pull_request workflow checked out merge
`d66dd82f01c40a4c27ce9308c2f335c764aef48c`, explicitly logged as merging
implementation HEAD `f0692a21cb43c397f0e9afe5e0199b69f9a4ed2a` into base
`1aa36b8f4ab7a6f1d8f291d8751856ed51274685`.
Both jobs used pnpm 11.25.0. All commands below completed with exit 0 in each job:

| Actual workflow command | Node 22 | Node 24 |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | PASS |
| `pnpm lint` | PASS, 138 files | PASS, 138 files |
| `pnpm typecheck` | PASS | PASS |
| `pnpm test` | 148 PASS / 0 FAIL / 0 SKIP | 148 PASS / 0 FAIL / 0 SKIP |
| `pnpm build` | PASS | PASS |
| `pnpm --filter @metamorph/oracle test:reference` | 56 PASS / 0 FAIL / 0 SKIP | 56 PASS / 0 FAIL / 0 SKIP |
| `pnpm --filter @metamorph/target-worker test` | 69 PASS / 0 FAIL / 0 SKIP | 69 PASS / 0 FAIL / 0 SKIP |
| `pnpm --filter @metamorph/differential test` | 122 PASS / 0 FAIL / 0 SKIP | 122 PASS / 0 FAIL / 0 SKIP |
| `node --test packages/oracle/probes/qualification.test.mjs` | 2 PASS / 0 FAIL / 0 SKIP | 2 PASS / 0 FAIL / 0 SKIP |

The differential glob actually executed all **45/45 focused cases**, including
`full MANIFEST 3 scenarios / 17 requests retains 117/117 exact files under umask 022`.
Measured assertions: 3 scenarios, 17 requests, 117 raw files, 117 distinct catalog
entries, 17 HTTP and 20 DB executed IDs, exact bytes/size/hash for every retained
record, exact sealed index and closed adapters. No PRIVATE_FILE or
PRIVATE_PERMISSIONS occurred on the positive path. Real foreign-owner chown and
all three failed-diff writer controls passed without skips. Complete FAIL retains
117 files without changing FAIL; both post-catalog fault controls reject success.

The separate focused command was run on Windows (explicit 45 POSIX skips).
A separate Linux focused-only invocation is NOT_RUN; Linux execution of the same
45 cases is proven within the existing differential command, without CI edits.
Only public synthetic test names/counts and run IDs are retained here; no raw
HTTP/SQLite observations, private packs or hidden material are committed.

Disposition: **READY_FOR_INDEPENDENT_CHATGPT_REVIEW** for Issue #26 implementation.
PR remains open; independent acceptance and owner coordination are not claimed.

## Review and limits

A fresh read-only investigation and patch review were performed under the security
fix skill. They are implementation-assistance checks, not independent ChatGPT
acceptance or owner approval. The independent ChatGPT handoff remains outstanding.

Local-first and the minimum 180-day retention / independent full-index exact-byte
restore by day 90 are reported owner-approved policy, not certified by this patch.
The authenticated second-owner record remains a separate governance action.
Dual-copy encrypted storage belongs to #55. Historical sampled PR #31 remains
AUDIT_FAIL; formal G4 remains INCONCLUSIVE; product remains NOT_ESTABLISHED.
