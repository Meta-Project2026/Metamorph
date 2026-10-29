# Scope and evidence safety

- Only existing manual `agent-workshop-compose.yml` with explicit
  `model_provider=none` is authorized and used. No real-model lane, discovery,
  retry/failover, API budget, provider generation or paid operation is requested.
- Existing admission runner returns `AI_GENERATION_NOT_RUN`, requests0 and
  MISSING_PROVIDER for none. Each new run's public `trial.json` is checked; the
  deterministic proof separately reports offline replay, synthetic billing and
  paidCalls0. Scripted repair is not AI generation.
- Existing workflow uses its read-only GitHub token for policy/source access.
  This is not a claim of zero GitHub authentication. No model secrets, keys,
  signing material, credential exports or owner-private packs are read.
- Trusted host adapters and candidate Docker workers remain unchanged. Candidate
  TS/PHP is executed only by the existing isolated Docker recipes. No network,
  socket mount, memory/time/CPU/privilege or resource-cleanup policy is relaxed.
- Published evidence contains structural public receipts, hashes and bounded
  status data. No raw candidate source, stdout/stderr, arbitrary stack trace,
  private paths, hidden G4 or original missing case data is exported.
- New tests are SYNTHETIC_UNIT_ONLY. Fake command receipts and resource sets
  exercise production controller/report functions; they cannot attest actual
  Docker execution or the historical root cause.
- No new research mjs directory; new package tests are selected by existing root
  and agent-real test globs. CI coverage validator and matrix remain unchanged.
- #89 crypto/export, paid-run, Meta workflow, Oracle/comparator/PHP/frozen
  fixtures/recipe pins and governance are untouched. No merge or issue closure.

Normal cleanup and emergency removal are recorded separately. A zero final
inventory after emergency removal remains ERROR. Each new trial must pass both
normal cleanup and independent inventory before another is dispatched.
All three executed trials satisfied this condition. Each model admission receipt
has generatedRequests=0, MISSING_PROVIDER and AI_GENERATION_NOT_RUN; each replay
reports paidCalls=0, and each compiler control reports metaRequests=0.
Product NOT_ESTABLISHED; G0/G4 INCONCLUSIVE; model trial #81 ROOT_CAUSE_UNKNOWN.
