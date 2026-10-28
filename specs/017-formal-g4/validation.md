# MMP-038 documentation validation

Prepared 2026-10-28 from fresh origin/main:
`00c913243ba7a4c05259dd1da25bdcfa7cf9e127`.
Branch: `docs/mmp-038-formal-g4-protocol`.
Directory 017 is used because 016-candidate-compat already exists on that base.

## Sources and actual scope

Read root AGENTS.md, README, draft constitution, foundation spec/interface,
MMP-010B spec/plan/tasks/handoff/hosted-proof, public MMP-010A and MMP-049
validation, current strict contracts, Oracle HTTP/SQLite/runner/private evidence,
audit runner/adapters/lifecycle/public/finalizer and retention helper.
GitHub reads: Issue #38 (including empty comments), #44, #26, #34 and PR #31
metadata. The specified sources are public code/reports; no private pack, sampled
input, expectation, seed or diagnostic was retrieved.

Public current-main updates were checked to avoid implying that later public
candidate parity changes the old sampled AUDIT_FAIL. Historical runtime counts
in README are attributed to committed reports, not re-executed here.

## Checks

The final precommit checks and their actual exit statuses are recorded below
after execution. No test suite or documentation schema is added for Markdown.

| Check | Status |
| --- | --- |
| `git fetch origin` and base HEAD verification | Exit 0; base above |
| Relative Markdown target/anchor check within this new package | Exit 0; all relative targets resolve, no broken local anchors |
| Protected-scope check: only specs/017-formal-g4/*.md added | Exit 0; eight new Markdown files, all preexisting tracked paths unchanged |
| `git diff --check` (including staged content) | Exit 0 after correcting extra EOF blank lines reported by the initial staged check |
| lint / typecheck / unit tests / build (local) | NOT_RUN; Markdown-only change, executable source/config/dependencies unchanged |
| Docker / formal G4 / private sampling / live API | NOT_RUN; outside this task |
| Independent review and both-owner acceptance | PENDING; no approval inferred |

New protocol steps are future requirements, not executed check results.
Current canonical G4 INCONCLUSIVE; product NOT_ESTABLISHED. No workflow dispatch,
private generation, self-merge or issue closure. Exact committed SHA and PR
handoff are published externally after the atomic documentation commit; this
file does not claim its own Git commit hash.
