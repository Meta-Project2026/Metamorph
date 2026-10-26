# Metamorph v0.1 — Architecture and contracts

**Status: PROPOSED**, 2026-10-26. All execution and testing results are **NOT_RUN** until verified separately.

## Product boundary

MVP: migrate a real, pinned MIT-licensed PHP 7.4 SQLite HTTP application to an independent TS/Node implementation; demonstrate stateful parity, a deliberately failing regression and bounded agent repair; compare Meta model strategies with honest cost/timing accounting. Not in scope: Go, generic AST transpilation, arbitrary user-provided GitHub repositories, public deployment, production auth/billing, multiple DB engines, or a full cloud job scheduler.

## Suggested repository layout

```text
metamorph/
├─ apps/
│  ├─ server/src/
│  │  ├─ api/               # HTTP endpoints and SSE
│  │  ├─ run/               # lifecycle, budgets, orchestrator
│  │  ├─ migration/         # analyzer/planner/patch application
│  │  ├─ models/            # Meta Model API adapter
│  │  ├─ oracle/            # verifier coordinator and comparator
│  │  ├─ workers/           # disposable PHP/TS runners
│  │  ├─ benchmarks/        # registry/manifest validation
│  │  └─ evidence/          # manifests, run receipts, exporter
│  └─ web/src/             # Vite/React, small run dashboard
├─ packages/contracts/src/ # Shared public DTOs/types only
├─ benchmarks/<selected>/  # pinned OSS provenance, scenarios, public fixtures
├─ infra/                  # disposable runtime definitions
├─ scripts/                # local setup/demo commands
├─ specs/                  # Spec Kit feature requirements
├─ docs/                   # architecture/decisions/development
├─ .github/workflows/      # fast PR CI, added when executable exists
├─ AGENTS.md
└─ pnpm-workspace.yaml
```

## Concrete stack (recommended for the first slice)

- **Node.js 24 LTS + TypeScript + pnpm workspaces** for the project; lock dependency versions in `pnpm-lock.yaml`.
- **Fastify** for a small typed server API, **React + Vite** for a single-page dashboard, **Zod** for boundary validation, **Vitest** for fast deterministic tests.
- **Meta Model API** (`https://api.meta.ai/v1`) through one narrow client adapter using an official OpenAI-compatible SDK; store the token in `MODEL_API_KEY` only on the trusted host.
- **Docker/Compose** for disposable baseline and candidate runtimes. Run manifests and evidence use file-based JSON/JSONL on local disk; benchmark apps use their own SQLite files.
- **SQLite adapter for generated target** remains a decision gate until real PHP/TS transaction and serialization parity is measured.

Dependencies are suggestions, not proof of working builds. Do not add Redux, message queues, an ORM, or a generic plugin platform without a demonstrated MVP need.

**Architectural rule:** this is a directory-level modular monolith. Do not split every folder into a separately published package or independent service. Begin with two apps and one shared contracts package. Keep domain logic out of React and runtime adapters.

## Main flow

1. **Choose pinned fixture:** read manifest (source commit/license, runtime, required routes, migration units, scenario IDs); verify safe isolated startup.
2. **Acquire baseline:** run original PHP without modifications; save version/environment and public calibration responses + pre/post logical SQLite state.
3. **Analyze & plan:** Meta Spark consumes only allowed source files, public behavior contract and calibration suite; emits dependency-ordered migration units and a bounded plan.
4. **Generate:** Meta Spark writes TS implementation only under target workspace with file/path/size limits. Runtime builds candidate; migration agent cannot access reference process or held-out answers.
5. **Verify:** G0→G4 verdicts. Oracle is deterministic and independently implemented; each scenario starts with equivalent clean logical state and separate DBs.
6. **Repair:** provide limited redacted/public mismatch description (not private expected response) and try bounded corrective patch. Escalate to Wonder after configured failure/complexity condition. Stop on pass, budget exhaustion, irreducible mismatch or inconclusive infrastructure.
7. **Export:** generate a manifest with fixture versions, executed test IDs, model/API usage, elapsed time, patch provenance, verdict and links to diffs. Prepare a concise HTML report from the same canonical data.

## Run lifecycle

`CREATED → BASELINE_READY → ANALYZING → PLANNING → GENERATING → VERIFYING → {REPAIRING → VERIFYING | PASS | FAIL | INCONCLUSIVE | ERROR}`

`FAIL` means a verified behavioral mismatch; `INCONCLUSIVE` means insufficient proof or unavailable runtime; `ERROR` means harness/provider infrastructure failure. A model self-assessment cannot set `PASS`. Persist each state transition as a timestamped JSONL event under a unique run ID.

## Minimal cross-module interfaces (draft)

```ts
type Strategy = 'spark-only' | 'wonder-only' | 'cascade';
type Verdict = 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'ERROR';
type Gate = 'G0' | 'G1' | 'G2' | 'G3' | 'G4';

type BenchmarkDefinition = {
  id: string;
  sourceRepo: string;
  sourceCommit: string;
  license: string;
  phpRuntime: string;
  scenarioIds: readonly string[];
  migrationUnitIds: readonly string[];
  normalizationVersion: string;
};

type RunConfig = {
  benchmarkId: string;
  strategy: Strategy;
  maxRepairsPerUnit: number;
  maxEscalations: number;
  maxModelSpendUsd: number;
  timeoutSeconds: number;
};

type GateResult = {
  gate: Gate;
  verdict: Verdict;
  executedTestIds: string[];
  findings: { code: string; message: string; scenarioId?: string }[];
  evidencePaths: string[];
};
```

`RunConfig` caps are configurable, their concrete defaults must be measured before the experiment; do not silently compare strategies with different task coverage or budgets. `sourceCommit` and `normalizationVersion` are research/demo evidence, **not commits that must be recomputed for every PR**.

## Suggested backend endpoints

- `GET /api/health`: simple readiness, no external provider dependency.
- `GET /api/benchmarks`: safe, allowlisted pinned fixtures and eligibility/readiness status.
- `POST /api/runs`: start one run using a validated benchmark and strategy.
- `GET /api/runs/:id`: current state, stats and gate outcomes.
- `GET /api/runs/:id/events`: SSE stream for step-by-step UI.
- `GET /api/runs/:id/evidence`: downloadable evidence pack (once finalized).

Demo may use one active run at a time; do not build multi-tenant auth, Kafka or a distributed job queue.

## Isolation and trust

- Legacy PHP is read-only and pinned. Both PHP and generated TS receive **separate disposable databases** and identical logical fixtures. Never point tests at developers' real SQLite files.
- An agent can propose source analysis and patches only. It cannot edit oracle code, manifests, trusted scenarios, policies, GitHub workflows or source fixture checkout.
- Worker execution must have memory/CPU/time limits, path restrictions, controlled inputs and no egress to legacy/hidden fixtures. Container isolation is useful, but not a formal security sandbox; do not assume untrusted arbitrary repos are safe.
- Oracle keeps calibration/public vectors, private held-out vectors and verifier positive/negative controls separate. Private files must be absent from model context and committed repo. A private suite visible to both developers is *hidden from the agent*, not secret from the team.
- Network/API keys remain only in the trusted host adapter. Never mount Meta credentials inside PHP/TS candidate workers.

## OSS reuse guidance

Adopt GitHub Spec Kit, standard typed HTTP/server libraries, Vite/React and Vitest, official/open-compatible Meta SDK support, Docker/Compose for deterministic local workers. Borrow interfaces, tactics and validation ideas from Casper after auditing their applicability. Do not port Casper's durable intents, DB recovery machinery, CI approval digest, worktree managers, multi-provider routing or generalized Oracle framework. A comparator needs deliberate domain rules; generic JSON deep equality alone is insufficient for SQLite and time semantics.

## Open implementation decisions (gates)

1. **Benchmark gate (by Oct 29):** PHP 7.4 runtime with extensions, repeatable isolated startup, stateful baseline and control of nondeterministic routes. Select car-workshop or Tech2Teach based on actual behavior, not static ranking.
2. **Node/SQLite driver gate:** verify candidate DB driver reproduces SQLite transaction/serialization quirks in a pinned runtime. Never claim parity based only on compilation.
3. **Model API gate:** confirm `MODEL_API_KEY` access and successful calls to both named models, or record honest unavailable/INCONCLUSIVE strategy rows.
4. **Demo gate:** repeatable clean end-to-end run, including negative test and repair, with no privileged hidden fixtures in the agent view.
