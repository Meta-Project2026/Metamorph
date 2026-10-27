# Validation

Reference-only implementation passed real isolated execution. This is separate
from owner agreement, benchmark registration and product acceptance.

Local Windows broker run: 37 passed, 1 POSIX retention test skipped, exit 0.
The synthetic transport adapter integration proves API compatibility only.
Own trusted Node subprocess controls exercise actual hang/abort/crash supervision;
they do not establish third-party application crash recovery.

Local commands executed:

| Command | Exit | Result |
|---|---:|---|
| `pnpm install --frozen-lockfile` | 0 | Existing lockfile preserved |
| `pnpm lint` | 0 | Clean |
| `pnpm typecheck` | 0 | All workspace packages |
| `pnpm test` (sandbox) | 1 | Sandbox child-process/link restrictions; environment error |
| `pnpm test` (authorized host check) | 0 | All original 65 tests pass, no skips |
| `pnpm build` | 0 | All workspace packages |
| `pnpm --filter @metamorph/oracle test:reference` | 0 | 37 pass, 1 POSIX-only skip on Windows |

Initial remote validation attempts (not successful replay evidence):

- [40425888740](https://github.com/Meta-Project2026/Metamorph/actions/runs/40425888740),
  SHA `88b4778029ceb1e4a6f3cd9948fbcdcda2a3b47b`: fast checks and Linux broker
  tests succeed; Docker proof exits1 in mapping before upstream replay.
- [40426325898](https://github.com/Meta-Project2026/Metamorph/actions/runs/40426325898),
  SHA `ad7830b8cba93e4adf57258323d6aff7725d71e6`: same checks succeed; Docker
  proof exits1 with mapping REFERENCE_INVALID. Added strict legacy PDO decimal
  metadata admission and safe typed diagnostics; no comparator or tests weakened.

- [40426797486](https://github.com/Meta-Project2026/Metamorph/actions/runs/40426797486),
  SHA `3847ce81caa4ae3454e2e0b06d44a51e4f4a4914`: Docker lifecycle controls
  reach expected rejection/cleanup; mapping rejects REAL_WIRE. PDO CASE values
  were textual. Fixed trusted inspector REAL round-trip; kept mapper strict.
- [40427133646](https://github.com/Meta-Project2026/Metamorph/actions/runs/40427133646),
  SHA `66af963b70216f0b734d9ebf3e79829ea2f07c76`: mapping passes; first reset
  errors; cleanup completes.
- [40427493406](https://github.com/Meta-Project2026/Metamorph/actions/runs/40427493406),
  SHA `5f77b2c97769635ed8a11cae79f3b363075e99de`: reset WORKER_CRASH;
  cleanup completes.
- [40427815096](https://github.com/Meta-Project2026/Metamorph/actions/runs/40427815096),
  SHA `166adead4ed1b79594285f32de766d1598324633`: reset COMMAND_CP_ERROR;
  Docker cp cannot copy tmpfs. Replaced it with a unique bounded Docker-managed
  local tmpfs volume, inspector readonly mount + isolated copy, verified volume cleanup.

Successful real Docker execution:

- [Run 40428192376](https://github.com/Meta-Project2026/Metamorph/actions/runs/40428192376)
  / [job 121939130202](https://github.com/Meta-Project2026/Metamorph/actions/runs/40428192376/job/121939130202),
  tested SHA `5dae3b8a4f9a6eb2c40cc2dea941028b6b83aacc` on Ubuntu24.04/Node24.
- Frozen install, lint, typecheck, original65 tests, build, broker37 tests
  (including POSIX private permissions/tamper controls), and real proof: all exit0.
- Six clean resets match the exact MMP-005 initial legacy hash. Three declared
  scenarios each replay twice, 34 actual HTTP steps. Business postconditions,
  subsequent reads, duplicate/invalid/capacity rejects and no-side-effect state
  comparisons pass. Full typed snapshots and exact raw HTTP body repeats match.
- Independent inspector vs core Node snapshot on an original trusted fixture
  confirms defaults/indexes/views/triggers, composite/nullable PK, no-PK duplicate
  multiset, NULL/int64/blob/REAL and sqlite_sequence mapping. Actual application
  DB never opened on host. Original comparators and runner unchanged.
- Real bounded Docker crash/hang/abort controls reject and leave no containers.
  No claim of upstream application crash recovery or concurrent transactions.
- Application/inspector containers and DB volumes are removed and absence verified;
  private pack remains readable and integrity-valid afterward, before runner teardown.
- Actual image ID: `sha256:c859a6e85db1e12e6fe6df850816cba21e5d4e096be91d569c3e7c2a3e53c237`.
  Base/archive/license/clock pins and manifest hash are in `reference-summary.json`.
- Public artifact `php74-reference-summary`, ID12701300105, SHA256
  `b92b653302e40ac12a7ba5d004fbe6fe88a8b1e342e5732f70e70b850fc2b535`.
  It contains only the allowlisted summary. Downloaded summary was checked against
  the trusted public constructor before copying to this spec directory.
- Private pack index SHA256:
  `60e46ef2ef162df94a80e7075d6b1d6c3a32a3271fd74390c4b91390a56a96a3`.
  This is a verification receipt, not a location or recoverable external archive.

Final confirmation:

- [Run 40428649395](https://github.com/Meta-Project2026/Metamorph/actions/runs/40428649395)
  / [job 121940659807](https://github.com/Meta-Project2026/Metamorph/actions/runs/40428649395/job/121940659807),
  tested SHA `c35a407914ec99ff00c1793bd7f45bbe22dd1a61`: frozen install, lint,
  typecheck, original65 tests, build, all38 Linux broker tests (zero skips), and
  complete real Docker proof all exit0. Includes residual-volume cleanup negative.
- Again six clean attempts/34 actual steps, complete mapped snapshots, exact
  replay equality and private pack verification after container/volume cleanup.
- Latest actual image ID:
  `sha256:ff88040e34cde32af496e70c5ac79981e0864f13bd32d58152e2848b7c725419`.
  Builds are recorded by actual content ID; no reproducible derived-image claim.
- Latest sanitized artifact ID12701032648, SHA256
  `7e1409e1e38a73bde08a6ae73e3285fa2585be3b64033a5b0b7a1116ac6a1aac`.
  Latest private pack index receipt:
  `e2d23906c565d40131b77a37b68ef304c04f44f1856029af7227f8ba188c80a0`.
  `reference-summary.json` now contains this final run's allowlist-verified receipt.
- [Fast CI 40428702150](https://github.com/Meta-Project2026/Metamorph/actions/runs/40428702150)
  succeeds separately on Node22 and24 at the same tested SHA.
- Delivery: [PR #14](https://github.com/Meta-Project2026/Metamorph/pull/14), Refs #11.
  PR remains open for independent review; no merge or owner ratification performed.

Subsequent commit changes only validation/task documentation and sanitized receipt.
Runtime source is identical to both successful isolated runs. Final PR HEAD and
the newest hosted CI result are recorded in the PR description.

NOT_RUN: external encrypted/durable retention, cross-language candidate parity,
concurrency, clock advance/DST, upstream crash recovery, held-out controls, Meta
calls and billable model runs. Benchmark registration/owner ratification NOT_APPROVED.
G0/G2/G3/G4 product acceptance remain INCONCLUSIVE; fast CI does not establish them.

Retention: EVIDENCE_RETENTION_NOT_CONFIGURED; EXTERNAL_RETENTION_NOT_RUN.
Raw evidence is never an unencrypted Actions artifact or public repository file.
