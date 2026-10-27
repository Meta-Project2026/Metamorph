# Real Agent workshop composition (MMP-010A)

This host adapter connects the unchanged Agent, CandidateWriter, admitted target
worker, PHP reference and Oracle. It replays two already-public MIT-attributed TS
files. **AI_GENERATION_NOT_RUN**: there is no model service, paid request or new
PHP-to-TS generation. Tokens are null; synthetic usage cost is zero. The Agent's
USD1 admission ceiling works around its existing zero-budget stop and is not a
charge or price estimate.

`pnpm --filter @metamorph/agent-real test` runs original synthetic boundary tests.
`pnpm --filter @metamorph/agent-real proof` requires Linux, a disposable Docker
daemon, built workspace dependencies and `AGENT_HEAD_SHA` equal to checked-out
HEAD. Use the dispatch-only `agent-workshop-compose.yml` workflow for the actual
proof. `AGENT_PUBLIC_OUTPUT` is trusted host configuration for structural JSON.
Candidate code is never imported/compiled/executed on the host. The TypeScript
host check covers the port declaration; executable MJS is linted and exercised
by unit tests and the Docker proof.

The trusted session owns a directory issued by createCandidateWriter. A write
captures its SHA; verification excludes further writes, admits a frozen snapshot,
checks root/link/hardlink identity, and rechecks source bytes around each pair and
on release. This assumes exclusive trusted host ownership, not a hostile host
administrator. Each verification uses three fresh independent PHP/TS pairs with
the immutable public MANIFEST. The unchanged Oracle compares initial DB before
business HTTP. Target lifetime remains180s per pair, including build and resets.
The public `targetLifetimePolicyMs` is the configured upper bound, not an
observation of elapsed runtime; no measured duration is published.
Cancellation combines Agent and per-operation signals; the driver joins pending
verification after Agent timeout before recording final cleanup.

Public G2/G3 aggregates are conjunctions of the actual per-scenario receipts and
exact executed IDs:17 HTTP and20 SQLite per complete attempt. G1 uses trusted
Docker typecheck/build phase receipts. G0 completeness and independent held-out
G4 remain INCONCLUSIVE, so the Agent must also finish INCONCLUSIVE for the good
candidate. The public cancellation defect keeps a row that should be deleted;
one repair rewrites the real TS files, gets a new SHA, new workers and new packs.

All raw HTTP/SQLite/DDL, command output, source bytes/paths and agent events stay
under an owner-only temporary root outside the checkout. PrivateEvidence seals
atomic0600 records with SHA indexes after cleanup; the finalizer verifies those
indexes again. Public JSON is rebuilt from fixed gate codes, public IDs, hashes,
coverage, model usage and cleanup. Repair feedback contains only allowlisted
codes, at most512 characters. No hidden inputs/expected values/seeds are accessed.
Raw storage is ephemeral runner-local: **EXTERNAL_RETENTION_NOT_RUN**. Public
artifact retention is7days; a hash is not external retention.

Existing six workshop Docker controls are rerun unchanged and labeled REAL_DOCKER
(quota, corrupt DB, startup timeout, crash and cancellation). Their readiness
cancel control wraps actual Docker commands without fabricating receipts. New
budget, malformed provider, stale receipt, source mutation and cleanup-fault
controls are explicitly synthetic. No claim of a real Docker cleanup-fault
injection or unseen-scenario acceptance is made.
