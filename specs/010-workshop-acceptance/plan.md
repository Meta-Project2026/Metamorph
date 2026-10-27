# Plan

1. Fetch main, inspect Issue19, accepted entrypoints/handoffs and hash-verified
   upstream archive. Read original API/config only; never load upstream DB on host.
2. Refactor trusted proof into acceptance driver with existing worker/inspector.
   Each of two passes constructs a worker with exact MANIFEST.map(s => s.id).
   Bootstrap is separate; step IDs stay step-01 onwards within each scenario.
3. Validate source-derived invariants privately; compare both passes' initial,
   bootstrap and per-step full HTTP/stable headers/raw body/before+after snapshots.
   Public corpus contains only known IDs, shapes/types, counts and SHA receipts.
4. Original synthetic fixture tests typed int64/finite real/blob/null/multiplicity,
   DDL/default/PK/index/sequence mapping. Effective synthetic faults cover corrupt
   transport, scheduling, reset and cleanup; actual isolated processes test exit,
   timeout and cancel. Label these separately from real PHP business replay.
5. Keep three bounded owner-only evidence packs outside Git; independent resource
   ledger/reaper, sticky operation/cleanup failures and verify hashes after close.
6. Run frozen install, root checks and reference tests. Commit/push and use existing
   registered manual workflow on exact feature SHA with proof=reference; artifact
   stays reference-summary.json with additive versioned acceptanceCorpus field.
7. Inspect only allowlisted artifact, record actual CI/run/job/ZIP receipts, publish
   structural corpus and measured contract; repeat final HEAD proof if changed.
   PR Refs19, no self-merge, issue closure or implicit target-owner ratification.
