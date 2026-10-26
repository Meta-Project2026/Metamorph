# Delivery plan — deadline-driven

**Assumption:** hackathon starts 2026-10-26, submission 2026-11-04 21:00 ET (2026-11-05 04:00 Europe/Chisinau); 2026-10-30–31 are partially unavailable to the team because of another hackathon. Adjust to official organizer requirements if updated.

## Critical sequence

**26–27 Oct — Foundation and runtime proof**
- Initialize new public repository after checking contest timing and originality restrictions; commit Spec Kit scaffolding + small architecture documents.
- Confirm Meta API access with one Spark and one Wonder request, record usage and pricing format.
- Pin and smoke one candidate real PHP benchmark in disposable PHP 7.4 container. Seed/reset → one success + one error + one stateful follow-up on fresh DBs. Do not adapt orchestration to an unverified fixture.
- Agree minimal DTO and freeze module boundaries. Both streams can start in parallel.

**28–29 Oct — Critical gate**
- Build first TS migration manually or via Spark, verify its independent startup with PHP reference stopped (G0).
- Deliver first end-to-end path: public scenario → PHP baseline → generated TS → response/state compare → reliable verdict.
- Show a deliberately failing mutation and one actual agent repair → PASS; if this cannot be reproduced, reduce task coverage/benchmark complexity rather than add more UI.
- Benchmark selection hard decision: if PHP 7.4 runtime or critical nondeterminism blocks exact requirements, switch based on evidence, not preference.

**30–31 Oct — Protected period**
- Plan around second hackathon; no critical integration dependency assuming full-time availability. Use only optional independent polishing/documentation.

**1–2 Nov — Strengthen evaluator and demo**
- Add mandatory scenarios, stateful writes, negative controls and held-out path.
- Run Spark-only / Wonder-only / Cascade under comparable limits. Instrument tokens, latency, retries, timeouts, raw vs cached tokens and estimated USD.
- Add simple dashboard, live events, status badges (real gate statuses only), diff viewer and one-click evidence export.

**3–4 Nov — Freeze, reproduce, submit**
- Execute clean-room demo twice from README; repair/verify flow with real evidence and no test leakage.
- Perform final negative/independence checks, cost controls, license attribution, public repo provenance, concise three-minute demo and submission.
- Avoid last-day infra rewrites, framework switches and unverified new benchmark additions.

## Must-have demo script (3 minutes)

1. Name real pinned OSS PHP app, show why migration is nontrivial and how PHP side responds.
2. Start a migration through Metamorph: show Spark model generating target and isolated TS starting without PHP.
3. Show one meaningful behavior failure detected by Oracle, triggered bounded repair (Wonder if required) and final PASS with DB post-state diff.
4. Show evidence report and measured Spark vs Wonder vs Cascade comparison, stating coverage and inconclusive cases honestly.

## Quality success criteria

- Reproducible baseline + TS startup; no calls from TS to PHP.
- G0–G4 gates shown separately; one mutation caught by independent Oracle.
- At least one real stateful scenario with response and post-state parity after repair.
- Cost/timing/token instrumentation uses actual provider usage, not guessed numbers.
- Repository, license, code provenance and setup are auditable.
