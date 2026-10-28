# Implementation plan

1. Use a separate pinned-base checkout and unchanged public APIs.
2. Bind a source session to CandidateWriter; exclude writes during admission and
   verify source SHA again before/after every pair and on lease release.
3. Prepare pinned trusted images before agent budgets. Fresh pair workers per
   scenario, combined cancellation signals, join pending verifier work after Agent
   timeout, independent cleanup and private pack sealing even on failure.
4. Check exact IDs and per-step raw evidence index. Derive schema-valid aggregate
   gates from receipts; preserve partial execution and fail/error distinctions.
5. Run public source replay and cancellation-no-op -> bounded repair; synthetic
   adversarial unit controls separately labeled from genuine Docker controls.
6. Required fast/regression suites, manual-only Ubuntu Docker proof, exact final
   HEAD, allowlisted artifact and independent final inventory. Commit/push/PR
   Refs #23, independent review; never self-merge.
