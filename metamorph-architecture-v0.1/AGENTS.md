# Coding-agent instructions — Metamorph

Read `README.md`, `.specify/memory/constitution.md`, relevant `specs/*/spec.md` and `docs/architecture/overview.md` before substantial coding. Report what exists in code vs what is a proposal; never mark tests PASS unless actually run.

## Working rules

- MVP PHP 7.4 → TypeScript/Node.js with Meta Muse via official Model API. No Go, generic AST engine, microservices or arbitrary repo runner.
- Keep orchestrator, models, workers, oracle and evidence as separate modules in one backend. UI is separate app.
- Agent outputs may write candidate source only. Never edit source reference, benchmark fixture, private held-out tests, Oracle controls/comparator or workflow config from a migration attempt.
- No PHP-as-proxy, FFI or hidden reference call from generated TS. Build success is not differential parity.
- Use narrow commits/PRs; clarify any shared interface/schema before changing it. Prefer implementation with a real executable smoke over extra architecture documents.
- Do not copy Casper's approval digest, per-commit evidence recertification or exhaustive 15-minute CI. Apply only needed conceptual patterns.
- On failures: identify exact scenario and mismatch, fix minimal cause; do not modify expected values/normalization or hide test failures.
- Check an OSS component's license and provenance before integrating it. Do not claim code written before hackathon start as new implementation.

## Task handoff format

`Goal; allowed scope; dependencies; acceptance criteria; commands actually run/results; remaining risks; PR link (if created).` Small bugfixes do not need full multi-document Spec Kit ceremony.
