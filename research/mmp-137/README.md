# MMP-137 — offline post-mortem of paid run 41505679809

Research-only, offline. No Meta API call, no rerun, no Docker, no candidate
plaintext, no age-identity access. Tracking issue: #137. Related: #115, #61.

| File | Content |
| --- | --- |
| [findings.md](findings.md) | Exact run categorization, `HTTP_JSON_TYPE` localization, what the published codes force, custody/preservation/restore status distinctions |
| [hypothesis-matrix.md](hypothesis-matrix.md) | Ranked falsifiable PHP-7.4-typing hypotheses (H1/H2/H3), trigger-step maps, falsification and discrimination conditions |
| [evidence.json](evidence.json) | Allowlisted categorical evidence (receipts, gates, artifact metadata, pinned source SHAs) |
| [owner-restore-gate.md](owner-restore-gate.md) | Owner-only restore procedure and boundaries (artifact 13169609004, expiry 2026-11-09 ~19:00 UTC) |
| [validation.md](validation.md) | Commands actually executed with exit codes; NOT_RUN discipline |
| [comparator-mechanics.test.mjs](comparator-mechanics.test.mjs) | Offline synthetic test of the trusted comparator mechanics (`pnpm --filter @metamorph/oracle build` first; not wired into hosted CI) |

Headline: the public G3 results establish equality of the **compared initial and post-step SQLite snapshots** across all three scenarios. HTTP statuses and stable headers match; the only **reported** mismatch class is `HTTP_JSON_TYPE`. The comparator short-circuits when two JSON nodes have different kinds: the absence of MISSING/VALUE/LENGTH findings proves equality only on paths the comparison actually visits, not inside mismatched-type subtrees. PHP 7.4 PDO string conversion makes `appointment_id` and appointment-row typing plausible hypotheses, not established candidate faults. H1 is one parsimonious single-field explanation for all three scenarios, **not uniquely implied**. Confirming actual candidate behavior requires separately gated evidence.