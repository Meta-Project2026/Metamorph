# Feature Specification: MMP-001 development foundation

**Feature Branch**: `feat/mmp-001-foundation`
**Created**: 2026-10-26
**Status**: Scoped implementation; both-owner interface review pending.
**Input**: MMP-001 bootstrap and shared-contract foundation task.

## User Scenarios & Testing

### User Story 1 — reproducible baseline (P1)

Vladimir and Ilia can install identical dependencies, run fast checks and start
the health service without credentials or benchmark runtimes.

**Independent test**: frozen install, lint, typecheck, test, build and real HTTP.

1. Given supported Node/pnpm, each command exits zero and the built server returns
   health HTTP 200 with explicit foundation-only capabilities.
2. Given no Meta credentials or PHP on PATH, the same health smoke succeeds
   without fabricating any migration verdict.

### User Story 2 — shared boundaries (P1)

Both streams import the same typed, validated records without depending on
one another's adapters. **Independent test**: standalone contracts build, public
type consumer and synthetic schema tests.

1. Invalid budgets, missing limits and unknown configuration fields are rejected.
2. G0–G4 remain distinct. PASS/FAIL without executed IDs/evidence is rejected.
3. Unknown usage stays null; invalid nested events and unsafe paths are rejected.
   Structural validity does not establish Oracle acceptance.

### Edge Cases

Unknown fields fail closed. Duplicate scenario/test IDs are invalid. Missing
evidence permits INCONCLUSIVE/ERROR with reasons. Health uses capability labels
rather than pretending an unexecuted gate returned a verdict.

## Requirements

- FR-001: Minimal workspace with contracts/server; defer optional web UI.
- FR-002: Export typed schemas for BenchmarkDefinition, RunConfig, GateResult,
  RunEvent, ModelUsage, Verdict and Gate; server imports the public package.
- FR-003: Executable lint/typecheck/test/build and offline health with real smoke.
- FR-004: PR/main CI runs frozen install and all fast checks; timeout 8 minutes;
  no models, Docker, PHP or full Oracle execution.
- FR-005: Preserve architecture proposal status, scaffold and local pointers.
- FR-006: Document DTO refinements and separate next tasks for both owners.

Out of scope: real benchmark, Oracle, migration agent, live APIs, credentials,
PHP checkout/execution, remote writes and deployment.

## Success Criteria

- SC-001: Frozen install and four root checks execute successfully locally, with
  true exit statuses reported, distinct from hosted CI.
- SC-002: Built CLI passes actual HTTP smoke without credentials or PHP on PATH.
- SC-003: Contracts compile independently, public imports work and invalid
  RunConfig/GateResult fixtures fail validation.
- SC-004: No changed evaluation meaning or product PASS claim.

## Ownership and context

Vladimir owns foundation/server integration; Ilia owns the next Oracle stream;
both review shared interface changes. Root [constitution](../../.specify/memory/constitution.md)
remains a template. The [proposed constitution](../../metamorph-architecture-v0.1/.specify/memory/constitution.md)
and [umbrella spec](../../metamorph-architecture-v0.1/specs/001-verified-migration/spec.md)
are context, without ratification or authorization for full product execution.
