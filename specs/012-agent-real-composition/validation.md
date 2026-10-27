# MMP-010A validation

Base main: `3de9d5ceef343536a5b56761deb805006fbd4b65`.
Isolated branch: `feat/mmp-010a-real-agent-composition`.
Local platform: Windows, Node22.23.1, pnpm11.25.0. Docker is unavailable locally;
candidate PHP/TS has not been executed on this host.

Local checks: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`,
`pnpm test` and `pnpm build` each exited0. Root test now runs the original65 plus
16 new tests:81/81PASS. New synthetic tests separately16/16, exit0.
Original reference/target/differential suites were executed together using
`node --test packages/oracle/reference/reference.test.mjs packages/oracle/reference/acceptance.test.mjs packages/target-worker/test/*.test.mjs packages/differential/test/*.test.mjs`:
203 total,201 passed,2 existing POSIX-only skips,0 failures, exit0.
Individual required commands also exited0:
`pnpm --filter @metamorph/oracle test:reference`:56 total,55PASS/1POSIX skip;
`pnpm --filter @metamorph/target-worker test`:69/69PASS;
`pnpm --filter @metamorph/differential test`:78 total,77PASS/1POSIX skip.
Implementation was committed/pushed as
`385394673860457a3a0f2f1af59b3eead8cadfe6`; [PR30](https://github.com/Meta-Project2026/Metamorph/pull/30)
is open, Refs #23. Fast CI was queued as
[run40587517919](https://github.com/Meta-Project2026/Metamorph/actions/runs/40587517919).
Its result is independent of Docker/Oracle acceptance. Final PR-head Fast CI is
linked in the PR checks; no code changes are hidden in this reporting update.

## PARTIAL: hosted execution blocker

Hosted real Agent positive/repair proof: **NOT_RUN**.
Hosted runtime failure controls, final Docker inventory and raw/public artifact
SHA receipts: **NOT_RUN**. No new real Agent candidate execution is claimed.

Both authorized dispatch attempts were rejected before a run was created:

1. `gh workflow run agent-workshop-compose.yml --repo Meta-Project2026/Metamorph --ref feat/mmp-010a-real-agent-composition`
   exited1: HTTP404, workflow not found on the default branch.
2. `gh api --method POST repos/Meta-Project2026/Metamorph/actions/workflows/agent-workshop-compose.yml/dispatches -f ref=feat/mmp-010a-real-agent-composition`
   returned HTTP404 Not Found. A follow-up workflow inventory contained no new
   composition workflow; branch run inventory contained only Fast CI.

Local Docker is absent; installing an alternate runtime is not authorized.
The assignment prohibits changing existing workflows and self-merge. This
checkout therefore has no available authorized entrypoint that can execute the
new proof before independent review/registration. The implementation, tests and
manual workflow are delivered as PARTIAL, not simulated hosted success.

To close the blocker, an owner must make the new dispatch-only workflow available
on the default branch through the agreed review process (or authorize a concrete
existing manual entrypoint change). Then dispatch the exact final PR SHA and
verify summary.json, finalizer.json and the Actions artifact SHA. This is a
remaining acceptance condition, not owner agreement or a merge request from the
implementation agent. No self-merge, old-workflow edits or automatic PR Docker
trigger were used to work around the404.

No external raw retention is configured: EXTERNAL_RETENTION_NOT_RUN.

Required semantics: good G1/G2/G3 PASS with17HTTP/20SQLite, G0/G4 INCONCLUSIVE,
Agent INCONCLUSIVE. Broken public cancellation must produce real FAIL; one repair
requires a changed SHA and distinct packs, with all17/20 operations executed again.
No counts in this paragraph are execution claims.

Unexecuted runtime faults are never promoted from synthetic tests. The published
summary labels original real Docker controls separately. Agent timeout/cancel
returns are joined with pending work before final inventory/sealing. A cleanup
fault stays ERROR even if emergency reaping ultimately reaches zero resources.

No paid requests, guessed prices/model APIs, hidden inputs or held-out evidence.
No G0/G4/product PASS, AI-generation claim, owner agreement, merge or issue closure.

## 2026-10-28: independent review corrections

Starting head: `192a6b330901267845c710ea37f4c627e25ed51e`.
The independent [review](https://github.com/Meta-Project2026/Metamorph/pull/30#pullrequestreview-5674811853)
identified G4 control-ID misattribution when an earlier pair lacks gate receipts.
Before the fix, `pnpm --filter @metamorph/agent-real test` exited1 with15/19
passing: the first-missing and middle-missing G4 cases failed, as did the new
policy-field and duplicate-pair-identity controls. These are synthetic receipts;
they do not establish that a real hidden audit or hosted pair ran.

The aggregator now keeps each gate result attached to its originating pair when
filtering, and rejects duplicate pair IDs as `EVIDENCE_ERROR`. Existing stale SHA,
pack, scenario and coverage checks remain. Public output names the configured
limit `targetLifetimePolicyMs`; it does not publish an invented elapsed time.
Focused synthetic tests now cover both missing-pair positions, provenance,
partial FAIL/ERROR precedence, cleanup failure, full17/20 coverage and unchanged
G0/G4 INCONCLUSIVE semantics.

The composition path, source pinning, abort/join, private packs, and workflow
artifact selection were statically reviewed. A `summary.json` `PASS_SCOPED`
alone does not establish completed hosted proof: the successful Actions job,
matching HEAD, `finalizer.json` with zero inventory and artifact digest must also
exist and be independently inspected. The independent finalizer is a later step;
an absent or failed finalizer leaves the overall proof incomplete.

Issue #32 workflow registration is proposed separately in
[PR33](https://github.com/Meta-Project2026/Metamorph/pull/33), head
`baa621f44e0cfc203b0a97be663e0c24fa8577e6`. It contains exactly the two unchanged
manual workflows from the feature branches; YAML 1.2 parsing, exact source bytes,
read-only permissions, exact-SHA checkout, public artifact path selection and
finalizers were checked statically. This is not workflow execution or owner
approval. At review, neither workflow was present on default main. Independent
review and an owner-approved merge are still required before dispatch. The
registration branch Fast CI [run40591121690](https://github.com/Meta-Project2026/Metamorph/actions/runs/40591121690)
passed Node22/24 on the registration SHA; it did not run either Docker proof.

Local correction checks on Windows, Node22.23.1/pnpm11.25.0:

| Command | Exit | Result | Wall time |
| --- | ---: | --- | ---: |
| `pnpm install --frozen-lockfile` | 0 | PASS | 1.51 s |
| `pnpm lint` | 0 | PASS | 1.79 s |
| `pnpm typecheck` | 0 | PASS | 72.02 s |
| `pnpm test` | 0 | 85/85 PASS, no skips | 46.34 s |
| `pnpm build` | 0 | PASS | 30.64 s |
| `pnpm --filter @metamorph/agent-real test` | 0 | 20/20 PASS, synthetic | 3.42 s |
| `pnpm --filter @metamorph/oracle test:reference` | 0 | 55 PASS, 1 POSIX-only skip | 15.36 s |
| `pnpm --filter @metamorph/target-worker test` | 0 | 69/69 PASS | 1.74 s |
| `pnpm --filter @metamorph/differential test` | 0 | 77 PASS, 1 POSIX-only skip | 14.87 s |

After tightening the malformed-receipt assertions to require `EVIDENCE_ERROR`,
the focused suite again passed20/20 and lint plus the full root suite again
passed85/85 in40.03 s combined. The pushed head's Node22/24 Fast CI is tracked
in the PR; none of these checks executes the real candidate or PHP on this host.

Actual Agent/PHP/TS proof, positive, negative/repair, runtime controls, final
Docker inventory, pair/pack SHA receipts and artifact hashes remain **NOT_RUN**.
AI_GENERATION_NOT_RUN, EXTERNAL_RETENTION_NOT_RUN and product NOT_ESTABLISHED.
