# Metamorph — coding-agent entrypoint

Start here. Before substantial changes, read the [README](README.md), root
[draft constitution](.specify/memory/constitution.md) and relevant spec/plan/tasks
under `specs/`. The implemented foundation is described in
[002-foundation](specs/002-foundation/spec.md) and its
[shared interface note](specs/002-foundation/interface-note.md).

## Code and proposals

MMP-001 implements `packages/contracts/` (typed, runtime-validated boundaries) and
`apps/server/` (Fastify health), with fast checks. Web UI is deferred. Migration
generation, Meta integration, PHP execution and Oracle are not implemented; no
benchmark is selected. Recheck code and executed results before claiming status.

The imported [overview](metamorph-architecture-v0.1/docs/architecture/overview.md),
[Oracle contract](metamorph-architecture-v0.1/docs/architecture/oracle-contract.md),
[ADR-0001](metamorph-architecture-v0.1/docs/decisions/ADR-0001-modular-monolith.md)
and [original constitution](metamorph-architecture-v0.1/.specify/memory/constitution.md)
remain proposals. The root constitution is the canonical Spec Kit working draft:
**PROPOSED / PENDING OWNER RATIFICATION**. Discoverability does not ratify these
documents or authorize the entire migration product. The imported
[001 umbrella spec](metamorph-architecture-v0.1/specs/001-verified-migration/spec.md)
is context, not a task list to execute wholesale. API hostname, model IDs,
entitlements, limits and pricing remain unverified integration inputs.

## Working rules

- Stay within the user's authorized slice. Prefer small runnable changes; tiny
  fixes need no full Spec Kit sequence or new feature bundle. Preserve generated
  scripts/templates/skills. Use explicit feature selection with
  `SPECIFY_FEATURE_NO_PERSIST=1` in a shared checkout; never overwrite another
  owner's active pointer or commit `.specify/feature.json`.
- Vladimir owns migration/orchestration/integration; Ilia owns independent
  baseline/comparator/Oracle. Shared cross-team API changes and governance
  ratification require both owners' explicit agreement. Ordinary reversible
  work within authorized scope needs no repeated approval.
- Preserve G0–G4: independent complete target; build/type safety; HTTP contracts;
  stateful differential parity; independent controls. Product PASS requires all
  applicable mandatory gates to PASS and all mandatory scenarios to execute with
  evidence. Green fast CI, valid schemas and model confidence do not establish
  Oracle PASS. Never weaken tests or normalization to hide failures.
- Keep PR CI to frozen install, lint, typecheck, unit/contract smoke and build.
  Full differential/model runs belong to separately authorized milestone work.
  No Casper-style approval digests, per-PR recertification or expanded CI ritual.
- Never run untrusted benchmark/candidate code on the host. Use authorized
  disposable isolation, separate reference/candidate state and bounded resources.
  Migration attempts write candidate source only, never reference fixtures,
  Oracle/comparator/controls, held-out tests or CI. Keep held-out inputs and
  expected outputs outside model context, repair feedback and public logs.
- Credentials stay in the trusted host adapter, outside candidate workers and
  Git. Future Meta calls need verified access, explicit spend/time/repair limits
  and actual usage receipts; billable probes require authorization.
- Verify OSS license/provenance and retain notices. Distinguish original work,
  pre-event research, reused dependencies and untouched upstream fixtures.
- Report commands actually run, exit statuses and remaining risks. Unexecuted
  checks are NOT_RUN. Distinguish proven FAIL, missing-evidence INCONCLUSIVE and
  environment ERROR. Local checks, hosted CI, owner agreement and product
  acceptance are separate facts. Never imply teammate notification or approval
  without evidence.
