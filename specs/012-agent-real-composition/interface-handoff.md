# Interface handoff

Vladimir-owned additive package `packages/agent-real`. Refs #23. No shared API,
Oracle normalization, target policy, reference/candidate fixture, existing CI,
governance or Ilia-owned implementation changes. Root test adds new fast unit
tests; lockfile adds workspace links only. No active feature pointer is written.

`createSourceSession(parent)` wraps the existing `createCandidateWriter` and
issues exclusive frozen-byte leases. `replayProvider(fixtureRoot, mode)` reads
only the pinned public workshop fixture and returns schema-validated TS changes.
`createEnvironment(root, privateParent, headSha)` prepares/verifies trusted images;
`RealVerifier(context, session)` implements the external Agent port. Always await
`waitForIdle()` after runAgent, including timeout/cancellation, then finish the
environment and independently inspect the daemon. No synthetic environment is
accepted by the production verifier; unit-only receipt tests are not attestations.

The verifier joins per-scenario G1/G2/G3 receipts for the exact admitted SHA. It
checks publication identity, index membership, IDs and full coverage; an old pack
or successful prior candidate cannot authorize another SHA. Each pair retains its
own Oracle verdicts and two sealed private pack identities. No full raw findings
or absolute source/evidence paths cross the repair/public boundary.

Safe auditor handshake: immutable candidateSha, fixed public source/manifest and
runtime hashes, gate codes/IDs, coverage and pack-index hashes. This handoff does
not request or reveal hidden tests, seeds, expected outputs or private audit packs.
The final workflow run's checked-out HEAD and artifact digest bind the hosted
claim; local success and a PR do not establish owner agreement or product PASS.

Agent verdict differs from public G2/G3 because all five mandatory gates remain
applicable. G0 independent complete migration is unestablished and G4 held-out
proof is absent. A complete public replay yields Agent INCONCLUSIVE. AI generation
and live provider calls are NOT_RUN; external raw retention is NOT_RUN.

Original code is this composition and its tests. Reused dependencies, worker APIs,
controls and upstream fixtures remain untouched. The replay preserves the entire
MIT upstream notice in schema.ts. New code does not relabel the accepted fixture
as AI-generated work. No teammate notification/approval or self-merge is implied.
