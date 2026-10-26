# MMP-004: first evidence-backed Agent / Oracle repair loop

Owner: Vladimir. Branch: `feat/mmp-004-integration`. Base: current main
`4dbd38e4d9853afd3f81115a9fd8a18308f16f98`. Refs #6.
Root constitution remains PROPOSED / PENDING OWNER RATIFICATION.

Deliver one offline command invoking existing Agent and real Oracle public APIs:
inert broken marker -> real synthetic HTTP/SQLite mismatch -> bounded repair ->
fresh pair G2/G3 PASS -> agent INCONCLUSIVE. No G0/G1 fabrication or G4 PASS.

- R1: Fresh independent public fixtures and actual `verifyPair()` on every attempt;
  current inert marker hash and new evidence pack linked to agent run/attempt.
- R2: Derive complete coverage from exact actual G2/G3 IDs, including G3 initial;
  reject duplicates/malformed journals; handle scenario IDs containing colons.
- R3: Provider receives only bounded allowlisted public feedback, never raw
  observations, reference values, held-out material, exceptions or private paths.
- R4: Validate evidence publication and files, reject stale candidate changes;
  errors, missing evidence, cancellation and exhausted limits never yield PASS.
- R5: Preserve all existing tests, fast Node 22/24 CI, owned contracts/Oracle and
  scaffolding; add compact docs and publish an unmerged PR with observed CI.

Acceptance: actual offline fail/repair sequence and evidence files; frozen install,
lint, typecheck, test, build, both demos and hosted checks on exact PR head.
Synthetic fixture behavior selection is explicitly a demo, not code migration.
PHP 7.4, Meta, G0/G1, held-out isolation and product acceptance remain NOT_RUN.
Issue #2 was already CLOSED on inspection; no issue-state change is authorized.
