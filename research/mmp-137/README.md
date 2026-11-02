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

Headline: the run's published evidence forces the conclusion that the
candidate was state-perfect (all SQLite snapshots equal) and string-perfect
(all messages equal) — the only divergence class is JSON *type* on
`appointment_id` / `get_appointments` row fields / `get_slots` fields, where
PHP 7.4 PDO semantics (stringified columns, string `lastInsertId()`) differ
from natural `node:sqlite` emission. H1 (`appointment_id` number-vs-string) is
the unique single-field explanation covering all three scenarios. Confirming
which hypothesis holds requires gated evidence paths or a separately
authorized sanitized candidate review.
