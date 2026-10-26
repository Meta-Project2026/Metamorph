# Metamorph — development foundation

MMP-001 implements shared TypeScript/Zod contracts and a local Fastify health
endpoint. Migration generation, Meta integration, PHP execution and the Oracle
are **not implemented**. No benchmark has been selected. The optional web app
is deferred until there is real run data to display.

The [imported architecture pack](metamorph-architecture-v0.1/README.md) remains a
proposal, including its model names, API hostname, ADR and constitution.
The root [Spec Kit constitution](.specify/memory/constitution.md) remains the
generated placeholder. This implementation does not ratify either constitution.

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
| `pnpm typecheck` | Build contracts declarations; check both packages and a public types consumer |
| `pnpm test` | Build packages; run contract tests, injection smoke and real HTTP against the built CLI |
| `pnpm build` | Compile contracts first, then server, using TypeScript |

Tests use synthetic fixtures, never a real benchmark/provider. The child server
smoke receives no credentials or PATH. Test builds exercise compiled exports.

- `packages/contracts/`: schemas and inferred types, without adapters or I/O.
- `apps/server/`: app factory, loopback CLI and health tests.
- `specs/002-foundation/`: [spec](specs/002-foundation/spec.md),
  [plan](specs/002-foundation/plan.md), [tasks](specs/002-foundation/tasks.md),
  [interface note for Ilia](specs/002-foundation/interface-note.md).
- `.github/workflows/ci.yml`: fast checks on PRs and pushes to `main`, Node 22/24
  matrix, eight-minute timeout per job. Target 2–4 minutes per job is an estimate;
  hosted duration/results have not been measured here.

Green Fast CI means technical checks passed. **Oracle PASS** additionally requires
independent G0–G4 execution, all mandatory scenarios and evidence for the exact
candidate. Schemas, health, unit tests and compilation do not establish parity.
See the unchanged [Oracle contract](metamorph-architecture-v0.1/docs/architecture/oracle-contract.md).

## Ilia / parallel work

No remote was created or pushed by MMP-001. After an owner publishes this commit,
replace both placeholders below with the owner-supplied URL and published ref:

```powershell
$repoUrl = '<owner-supplied-repository-url>'
$foundationRef = '<published-foundation-ref>'
git clone $repoUrl metamorph-ilia
Set-Location -LiteralPath '.\metamorph-ilia'
git switch --create feat/mmp-002-oracle $foundationRef
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Do not assume main contains the local foundation commit. Vladimir should use a
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

Next: **MMP-002 Oracle foundation** (Ilia): independent verifier/controls and PHP
7.4 benchmark qualification in an authorized disposable runtime. **MMP-003 Agent
foundation** (Vladimir): bounded orchestration and adapter boundary. API access,
model IDs and pricing require a separately authorized live probe.

## Dependency provenance

Dependencies come from npm and retain upstream notices in installed packages.
Fastify, Zod, pnpm and Node types use MIT; TypeScript uses Apache-2.0; Biome uses
MIT OR Apache-2.0. No external project/benchmark source was copied. Retain these
notices when distributing dependency artifacts.
