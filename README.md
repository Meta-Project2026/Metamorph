# Metamorph — development and agent foundations

MMP-001 implements shared TypeScript/Zod contracts and a local Fastify health
endpoint. MMP-003 adds a bounded offline agent lifecycle with scripted providers,
a restricted candidate writer and a trusted verifier port. MMP-002 adds a standalone
[Oracle foundation](packages/oracle/README.md) for original public/synthetic HTTP
and SQLite comparison, controls and evidence. Real migration generation, Meta
integration, PHP workers and complete product verification are **not implemented**.
No benchmark has been selected. The optional web app
is deferred until there is real run data to display.

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
`undecided`. This describes the health service, without a migration verdict.

## Checks and layout

| Command | Executed work |
| --- | --- |
| `pnpm lint` | Biome lint, formatting and imports for workspace source/config/tests |
| `pnpm typecheck` | Build dependency declarations; check contracts, server, agent, oracle, integration and a public types consumer |
| `pnpm test` | Build packages; run contracts, agent, oracle and integration synthetic/boundary tests, injection smoke and real HTTP against the built CLI |
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
- `specs/005-integration/`: compact MMP-004 specification, plan and validation.
- `specs/003-oracle/`: MMP-002 spec, qualification blocker and validation records.
- `specs/004-agent/`: compact MMP-003 spec, plan, tasks and validation record.
- `specs/002-foundation/`: [spec](specs/002-foundation/spec.md),
  [plan](specs/002-foundation/plan.md), [tasks](specs/002-foundation/tasks.md),
  [interface note for Ilia](specs/002-foundation/interface-note.md).
- `.github/workflows/ci.yml`: fast checks on PRs and pushes to `main`, Node 22/24
  matrix, eight-minute timeout per job. Target 2–4 minutes per job; the
  first PR's Node 22/24 hosted CI passed in approximately 39 seconds.

Green Fast CI means technical checks passed. **Oracle PASS** additionally requires
independent G0–G4 execution, all mandatory scenarios and evidence for the exact
candidate. Schemas, health, unit tests and compilation do not establish parity.
See the unchanged [Oracle contract](metamorph-architecture-v0.1/docs/architecture/oracle-contract.md).

## Ilia / parallel work

MMP-001 is merged into `main` through [PR #1](https://github.com/Meta-Project2026/Metamorph/pull/1).
Parallel follow-ups: [MMP-002 Oracle](https://github.com/Meta-Project2026/Metamorph/issues/2)
(Ilia) and [MMP-003 agent/orchestrator](https://github.com/Meta-Project2026/Metamorph/issues/3)
(Vladimir). Start both from current `main`:

```powershell
$repoUrl = 'https://github.com/Meta-Project2026/Metamorph.git'
$foundationRef = 'origin/main'
git clone $repoUrl metamorph-ilia
Set-Location -LiteralPath '.\metamorph-ilia'
git switch --create feat/mmp-002-oracle $foundationRef
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Main now contains the foundation. Vladimir should use a
separate checkout/branch for MMP-003. Review the shared interface note together
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
