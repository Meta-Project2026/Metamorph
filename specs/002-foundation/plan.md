# Implementation Plan: MMP-001 foundation

**Branch**: `feat/mmp-001-foundation` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

## Summary

Keep the imported pack in place. Add one contracts package and a Fastify health
service; defer UI until there is real data. Use Node's built-in test runner.

## Technical Context

- Available Node 22.23.1; support Node 22.13+ or 24; CI matrix checks 22/24.
- Available/pinned pnpm 11.25.0 requires Node >=22.13.
- Exact dependencies: TypeScript 5.9.3, Fastify 5.12.7, Zod 4.6.7, Biome 2.6.3,
  Node 22 types 22.20.5. Pin TypeScript 5.9 instead of adopting a new compiler major.
- Storage: none. Tests: compiled ESM, Node runner, injection and built CLI HTTP.
- Build contracts before server using pnpm topological ordering. Typecheck builds
  public declarations first. Tests deliberately build before importing artifacts.
- CI: frozen install plus four checks; 8-minute timeout per matrix job; 2–4 minute
  target is an estimate, not a hosted measurement.

## Constitution Check

The [root constitution](../../.specify/memory/constitution.md) is a template;
it cannot establish approval. Follow the [proposed principles](../../metamorph-architecture-v0.1/.specify/memory/constitution.md)
for a small runnable slice, independent verification, explicit uncertainty,
ownership and fast CI. No benchmark code runs on the host. Neither constitution
nor [ADR-0001](../../metamorph-architecture-v0.1/docs/decisions/ADR-0001-modular-monolith.md)
is ratified here. Oracle evaluation meaning remains unchanged.

## Project Structure

```text
apps/server/src/{app,start}.ts
apps/server/test/health.test.mjs
packages/contracts/src/index.ts
packages/contracts/test/{contracts.test.mjs,consumer.ts,tsconfig.json}
specs/002-foundation/{spec,plan,tasks,interface-note}.md
.github/workflows/ci.yml
```

See [interface-note.md](interface-note.md). Vladimir owns server/integration;
Ilia owns independent Oracle/evidence; both review DTO changes. Schemas do not
implement coverage aggregation or verify evidence. Health has no verdict.

## Spec Kit compatibility and deviations

Installed Spec Kit 1.0.12 supports sequential `specs/NNN-name/`, independent branch
names and explicit `SPECIFY_FEATURE_DIRECTORY` / `SPECIFY_FEATURE_NO_PERSIST=1`.
Reserve 001 for the imported umbrella and use 002. Adapt installed spec/plan/tasks
templates compactly by hand, without a full skill chain, broad implement command,
extra research/governance files, scaffold replacement or local pointer changes.

## Validation

Execute frozen install and four checks; independently build contracts; check 002
prerequisites with non-persisting explicit selection; inspect Git diff/status and
unchanged scaffold/imported docs. Real HTTP smoke closes its child process.
Local validation is distinct from hosted CI, teammate review and Oracle parity.
