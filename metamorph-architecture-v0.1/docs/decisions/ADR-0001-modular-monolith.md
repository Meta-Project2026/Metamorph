# ADR-0001 — Modular TypeScript monolith and independent verification

**Status:** Proposed — accepted only after owners review. **Date:** 2026-10-26.

## Context

Two developers, a hackathon deadline, a three-minute demo, and limited time for integration. Casper demonstrated the value of explicit contracts and an independent Oracle, but its long-lived governance/CI/hashes/approvals would obstruct this project. The source benchmark selection is still conditional.

## Decision

1. One TypeScript backend process (`apps/server`) hosts API, run orchestration, Meta adapter, benchmarking commands, verification coordinator and evidence aggregation, separated by directories and narrow TypeScript interfaces. No microservices, message broker, full event-sourcing framework, or general agent marketplace.
2. A separate Vite/React web app (`apps/web`) displays runs, verification, before/after HTTP/SQLite differences, model usage and evidence. A minimal shared `packages/contracts` folder/package defines DTOs where necessary.
3. Untrusted legacy and generated code run in disposable isolated workers with different DBs and no network access to the legacy system from the target. An explicit container/runtime adapter enables development and demo.
4. Oracle assertions, held-out fixtures, normalization and controls are **not editable by the migration agent**. The orchestrator may request verification, never change or override the returned verdict.
5. Benchmark-specific routes, fixtures and expected semantics live in `benchmarks/<name>/` via `BenchmarkDefinition`. Initially implement **only one real benchmark**. Other language pairs are outside MVP; design narrow extension seams without generic transpiler infrastructure.
6. Run artifacts are append-only on the application side and exportable as a self-contained evidence directory/zip; no mandatory database for control-plane state in v0.1. SQLite is required inside benchmark scenarios, with independently snapshotted logical state.

## Consequences

- Simple local development, fast builds, easy shared code review.
- Shared process may require stricter isolation of worker invocation; limits and file permissions must be enforced at the worker boundary.
- Switching benchmarks requires new fixtures/scenarios and adapter configuration, not a new orchestration framework.
- Filesystem run state is sufficient for a single-host hackathon demo, not a production multi-tenant platform.

## Deferred decisions

- Exact benchmark: `car-workshop` vs `Tech2Teach-ExamSuite` (both static recommendations, runtime gate pending).
- SQLite driver for generated TS benchmark code: choose after testing compatibility inside pinned Node runner.
- Public cloud hosting: not an MVP requirement. Demo can run locally.
