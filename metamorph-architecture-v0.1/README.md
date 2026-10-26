# Metamorph — Architecture Pack v0.1

**Status:** proposed architecture, 2026-10-26. **Not an implemented product.**

Metamorph migrates a pinned PHP 7.4 application to an independent TypeScript/Node.js implementation with a Meta-powered analyze → plan → generate → verify → repair loop. Verification uses independent, reproducible HTTP and SQLite differential tests rather than model self-assessment.

## Current scope

- First production-target profile: PHP 7.4 → TypeScript/Node.js, SQLite, observable HTTP behavior.
- Meta Model API: `muse-spark-1.3` first, bounded escalation to `muse-wonder-1.0`; compare Spark-only, Wonder-only and Cascade.
- Run-level G0–G4 verdicts; one demonstrated FAIL → repair → PASS; downloadable evidence and 3-minute demo.
- Real OSS benchmark selected after isolated runtime gate; no general-purpose transpiler or arbitrary repo execution in MVP.

## Documents

- `docs/architecture/overview.md` — components, execution flow, risk boundaries, interfaces.
- `docs/architecture/oracle-contract.md` — G0–G4 and independent testing.
- `docs/decisions/ADR-0001-modular-monolith.md` — architecture decision.
- `docs/development/team-workflow.md` — two-developer split and PR rules.
- `docs/development/delivery-plan.md` — critical milestones and demo.
- `.specify/memory/constitution.md` — deliberately short Spec Kit constitution draft.
- `specs/001-verified-migration/spec.md` — first vertical slice requirements.
- `templates/ci-fast.yml` — GitHub Actions template **not yet activated**; install only after `pnpm` scripts exist.

## Bootstrap (after reviewing proposed decisions)

```powershell
mkdir metamorph
cd metamorph
git init -b main
uv tool install specify-cli
specify version
specify init --here --integration codex --script ps --non-interactive
```

Copy/reconcile the documents into the initialized repository; specifically, review the proposed constitution before replacing the Spec Kit placeholder. In Codex run `$speckit-constitution`, `$speckit-specify`, `$speckit-plan`, `$speckit-tasks`, `$speckit-implement`, `$speckit-converge` **inside Codex chat**, not PowerShell. Use narrow features and skip optional bureaucracy for trivial fixes.

**Do not treat this document bundle as evidence of successful CI, runtime compatibility, or migration.** External OSS licenses and contest provenance must be respected.
