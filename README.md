# Metamorph — development and agent foundations

The implemented foundation covers shared TypeScript/Zod contracts and a local
Fastify health endpoint (MMP-001), a bounded offline agent lifecycle with
scripted providers (MMP-003), a standalone
[Oracle foundation](packages/oracle/README.md) for original public/synthetic HTTP
and SQLite comparison, controls and evidence (MMP-002), the real Agent/Oracle
public repair loop (MMP-004), the disposable TypeScript target worker (MMP-007),
the PHP/TS differential bridge (MMP-008A) and the real-model workshop
composition (MMP-010A) with an independent workshop audit and encrypted
evidence retention. Real PHP 7.4 qualification executed on an isolated hosted
Docker runner (MMP-005). One authorized paid model generation executed on
2026-10-29 ([run 40900698372](https://github.com/Meta-Project2026/Metamorph/actions/runs/40900698372)):
the Muse Spark 1.3 candidate passed generation and **failed G1
build/typecheck**; G2/G3 never executed. A successful PHP→TypeScript migration,
complete product verification and formal G4 remain **NOT established**
([product milestone #61](https://github.com/Meta-Project2026/Metamorph/issues/61);
readiness preflight [#100](https://github.com/Meta-Project2026/Metamorph/issues/100)).
No benchmark is registered; the workshop profile is proposed for agreement, not
selected. The offline read-only
[evidence viewer](research/demo-readiness/README.md) presents recorded public
receipts in three separated tracks. The optional web app
is deferred until there is real run data to display. There is no automatic or
standing paid model request; billable probes require separate authorization.

The [imported architecture pack](metamorph-architecture-v0.1/README.md) remains a
proposal, including its model names, API hostname, ADR and constitution.
Coding agents start at root [AGENTS.md](AGENTS.md), then read the root
[Spec Kit constitution](.specify/memory/constitution.md) and relevant feature
documents. The root constitution is now a Metamorph working draft marked
**PROPOSED / PENDING OWNER RATIFICATION**, adapted from the imported proposal.
These are the canonical operational entrypoints; discoverability does not ratify
governance or the imported architecture. Both Vladimir and Ilia must explicitly
agree to shared cross-team API changes and governance ratification; ordinary
reversible work within authorized scope needs no repeated approval.

## Windows PowerShell

Use Node.js 22.13+ in the 22 LTS line, or Node.js 24 LTS. This task was developed
on Node 22.23.1. pnpm is pinned to 11.25.0, with exact direct dependency versions
and a committed lockfile. Install the matching package manager if necessary:

```powershell
node --version
npm install --global pnpm@11.25.0
pnpm --version
Set-Location -LiteralPath 'C:\Users\user\Documents\1. Metamorph'
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

In a second PowerShell window:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/health' | ConvertTo-Json -Depth 3
```

Stop with Ctrl+C. To change the port, set `$env:PORT = '3001'` before startup;
remove it afterward with `Remove-Item Env:PORT`. The server binds only to
`127.0.0.1`. It reads only PORT and needs no API key, PHP, Docker or database.

Health returns HTTP 200 with `status: "ok"`, `scope: "foundation"` and explicit
capabilities: migration/Oracle `not_implemented`, Meta `not_integrated`, benchmark
`undecided`. This describes the health service, without a migration verdict. The capability
strings are that service's static labels, not current project status.

## Checks and layout

| Command | Executed work |
| --- | --- |
| `pnpm lint` | Biome lint, formatting and imports for workspace source/config/tests |
| `pnpm typecheck` | Build dependency declarations; recursively typecheck every workspace package, including a public types consumer |
| `pnpm test` | Build packages; run contracts, agent, oracle, integration, agent-real and evidence-retention synthetic/boundary tests, injection smoke and real HTTP against the built CLI |
| `pnpm build` | Compile packages in dependency order, using TypeScript |

Tests use synthetic fixtures, never a real benchmark/provider. The child server
smoke receives no credentials or PATH. Test builds exercise compiled exports.

- `packages/contracts/`: schemas and inferred types, without adapters or I/O.
- `apps/server/`: app factory, loopback CLI and health tests.
- `packages/agent/`: bounded orchestration, restricted source writer, scripted
  adapters, disabled live Meta seam and [usage/probe blockers](packages/agent/README.md).
  Run `pnpm demo:agent` for a synthetic repair/escalation lifecycle and journal;
  its PASS is synthetic orchestration evidence, never Oracle/product acceptance.
- `packages/oracle/`: independent HTTP/SQLite comparison, public synthetic controls,
  evidence and a trusted broker interface; no PHP/TS worker provisioning.
- `packages/integration/`: [real Agent / Oracle public repair loop](packages/integration/README.md).
  Run `pnpm demo:integration`: real synthetic HTTP/SQLite FAIL -> one repair ->
  G2/G3 PASS; final **INCONCLUSIVE** with actual temporary evidence packs.
  Generated text is never executed; PHP, live Meta, G0/G1 and held-out remain NOT_RUN.
- `packages/target-worker/`: [disposable TypeScript target worker](packages/target-worker/README.md)
  with trusted host admission and isolated Docker execution.
- `packages/differential/`: [Oracle-owned real PHP/TS differential bridge](packages/differential/README.md),
  without a migration model or new comparator.
- `packages/agent-real/`: [real-model workshop composition](packages/agent-real/README.md)
  with source sessions, compiler diagnostics and candidate retention; its
  execution branch stays unreachable without reviewed provider admission.
- `packages/workshop-audit/`: [independent workshop audit harness](packages/workshop-audit/)
  (public corpus recipes, ordered lifecycle, finalizer), executed by CI.
- `packages/evidence-retention/`: [encrypted local evidence adapter](packages/evidence-retention/README.md)
  for synthetic/public data only.
- `specs/005-integration/`: compact MMP-004 specification, plan and validation.
- `specs/003-oracle/`: MMP-002 spec, qualification blocker and validation records.
- `specs/004-agent/`: compact MMP-003 spec, plan, tasks and validation record.
- `specs/002-foundation/`: [spec](specs/002-foundation/spec.md),
  [plan](specs/002-foundation/plan.md), [tasks](specs/002-foundation/tasks.md),
  [interface note for Ilia](specs/002-foundation/interface-note.md).
- `specs/006-php74-qualification/` through `specs/018-mmp026-evidence-retention/`:
  PHP qualification, worker, differential, acceptance, audit, readiness and
  formal-G4 specifications for later milestones.
- `.github/workflows/ci.yml`: PR/push-to-`main` checks on a Node 22/24 matrix,
  eight-minute timeout per job: frozen install, lint, typecheck, test, build plus
  Oracle reference, target-worker, differential, PHP-qualification sanitizer,
  workshop-audit tests, active research lint/syntax, coverage-matrix validation
  with negative controls, connected history/adversarial tests and demo-readiness
  tests. Still PR-scoped: no paid, model or full-differential runs in CI.

Green Fast CI means technical checks passed. **Oracle PASS** additionally requires
independent G0–G4 execution, all mandatory scenarios and evidence for the exact
candidate. Schemas, health, unit tests and compilation do not establish parity.
See the unchanged [Oracle contract](metamorph-architecture-v0.1/docs/architecture/oracle-contract.md).

## Ilia / parallel work

MMP-001 is merged into `main` through [PR #1](https://github.com/Meta-Project2026/Metamorph/pull/1);
MMP-002/003/004/005 and the target-worker, differential, workshop-audit,
agent-real and evidence-retention packages are merged. Current open fronts,
each from current `main` in a separate checkout/branch: product milestone
[#61](https://github.com/Meta-Project2026/Metamorph/issues/61) (Vladimir) —
real model-driven migration parity NOT established; demo
[#71](https://github.com/Meta-Project2026/Metamorph/issues/71) — viewer merged,
human-timed rehearsal pending; paid-v2 readiness preflight
[#100](https://github.com/Meta-Project2026/Metamorph/issues/100) (Ilia,
offline only). Review the shared interface note together
before extending DTOs; no teammate approval is implied by local implementation.

Spec Kit 1.0.12 resolves features independently of branch names. The compact 002
documents adapt installed templates without running the broad 001 workflow or
changing `.specify/feature.json`. Explicit non-persisting feature selection:

```powershell
$env:SPECIFY_FEATURE_DIRECTORY = 'specs/002-foundation'
$env:SPECIFY_FEATURE_NO_PERSIST = '1'
& .\.specify\scripts\powershell\check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks
Remove-Item Env:SPECIFY_FEATURE_DIRECTORY
Remove-Item Env:SPECIFY_FEATURE_NO_PERSIST
```

MMP-002's public/synthetic G2/G3 controls and evidence runner exist independently.
[MMP-005 real PHP 7.4 qualification](specs/006-php74-qualification/qualification-report.md)
executed on an isolated GitHub Docker runner. The sequential car-workshop profile
with a verified fixed clock has two exact clean replays; its benchmark definition
is proposed for agreement, not registered. G0/G1 for a migrated target, held-out
isolation and complete G4 remain NOT_RUN. MMP-004 connects Agent and Oracle using
trusted public synthetic fixtures only. Production isolated PHP/TS worker adapters
and verified Meta API access remain future work; model IDs and pricing require a
separately authorized live probe.

## Dependency provenance

Dependencies come from npm and retain upstream notices in installed packages.
Fastify, Zod, pnpm and Node types use MIT; TypeScript uses Apache-2.0; Biome uses
MIT OR Apache-2.0. No external project/benchmark source was copied. Retain these
notices when distributing dependency artifacts.
