# Actual results — 2026-10-28

Classification: **NOT_ESTABLISHED**. Runtime evidence: **static-only**;
**DOCKER_NOT_RUN**, zero executed public PHP/TS comparisons.

Base/source SHA: `5de7a3315a8b728ee2baa6ed0c97acfc781dc641`.
Preregistration/research code SHA: `bd79223173e1d372caa295cc1a635a3f599a7a9e`.
The final delivery adds only these recorded results; its exact head is in the PR.
No package, worker, fixture, comparator, workflow or dependency changed. Initial
install/build/typecheck/root checks started before the preregistration commit on
the same unchanged package bytes; dedicated suites and recorded research checks
ran after it. No local result is represented as an exact-head hosted execution.

Environment: Windows NT `10.0.26300.0`, x64; Node `v22.23.1`, pnpm `11.25.0`,
Python `3.11.9`. Linux/Docker image/kernel/runtime measurements: **NOT_RUN**.

## Commands actually run

Commands are from the new worktree root unless noted. Counts are test counts,
not PHP/TS comparisons. Package build/type checks do not compile the candidate.

| Command / check | Exit | Actual PASS / FAIL / SKIP | Meaning |
| --- | ---: | --- | --- |
| `git fetch origin` (original checkout) | 0 | n/a | Base refreshed to SHA above |
| `git worktree add -b Vladimir/mmp-044-public-validation-triage ../Metamorph-mmp-044 origin/main` | 0 | n/a | Separate clean worktree |
| `gh api repos/Meta-Project2026/Metamorph/issues/44 --jq '{title,body,state,html_url}'` | 0 | n/a | Public issue metadata only; no linked audit contents fetched |
| `pnpm install --frozen-lockfile` | 0 | n/a | Nine workspace projects, lockfile unchanged |
| `pnpm lint` | 0 | 121 files, no fixes | Executed before and after additions; configured scope excludes research |
| `pnpm typecheck` | 0 | Eight package type checks | Includes dependency build; trusted boundaries only |
| `pnpm test` | 0 | 87 / 0 / 0 | Existing root tests, including synthetic/boundary controls |
| `pnpm build` | 0 | Eight package builds | Trusted package compilation |
| `node --test packages/oracle/reference/reference.test.mjs packages/oracle/reference/acceptance.test.mjs` | 0 | 55 / 0 / 1 | Existing reference tests; TAP duration 1828.1782 ms |
| `node --test packages/target-worker/test/*.test.mjs` | 0 | 69 / 0 / 0 | Existing target tests; TAP duration 729.6736 ms |
| `node --test packages/differential/test/*.test.mjs` | 0 | 77 / 0 / 1 | Existing differential tests; TAP duration 1938.9364 ms |
| `python research/mmp-044/public_source.py` | 0 | Three exact public members verified | Archive/license/source digest checks; no PHP execution |
| `node research/mmp-044/validate.mjs` | 0 | 14 scenarios / 38 admitted requests; four synthetic controls PASS | No application execution |
| Research Biome stdin check with `--write`, asserting output equals original | 0 | No changes | Explicit root-package lint/format rules applied to research JS |
| `git diff --check` / staged equivalent | 0 | n/a | No whitespace errors in additions |
| Real PHP/TS public probe, real positive/negative controls | NOT_RUN | NOT_RUN | Docker executable absent; no driver implemented here |
| Hosted Docker public probe / final Docker inventory | NOT_RUN | NOT_RUN | No workflow changed or dispatched |
| Hosted Fast CI on final PR head | NOT_RUN in this record | NOT_RUN | Automatic PR jobs, if any, are linked separately in the PR |

Root TAP: 87 tests, 6877.0089 ms; no cancellations/todo. Dedicated suites also
have zero cancellations/todo. Reference's skipped test checks POSIX evidence
storage/permissions and skips on win32; differential's skipped evidence catalog
test requires Linux. They remain SKIP, not inferred PASS.

Early exploratory `rg` calls named nonexistent older directory guesses, and an
initial archive reader requested nonexistent `db.php` after reading `api.php`;
those exploratory reads returned nonzero. Correct paths (`config.php`, accepted
main directories) were then used and the versioned reader passed. Initial research
formatting needed Biome fixes; final stdin `--write` output equals committed
source. Plain Biome stdin without `--write` also returns 1 with its “contents
aren't fixed” message even when its fixed output is identical; verification used
the explicit output-equality check. None of these was an executed PHP/TS mismatch
or evidence for evaluator error.

## Public fixture outcomes

`cases.public.json` SHA-256:
`5e3b588003de33d36f37cc2dadc848d0dfebc44fdd2c0a9aaed65e84f240f496`.
This fixed preregistration has 14 scenarios, 38 planned HTTP comparisons and 52
planned SQLite comparisons. The hypothesis table explains their source selection.

| Case id (prefix `public-`) | Planned HTTP / SQLite | Actual outcome |
| --- | --- | --- |
| good-lifecycle | 8 / 9 | NOT_RUN |
| empty-form | 2 / 3 | NOT_RUN |
| zero-name | 2 / 3 | NOT_RUN |
| ascii-padding | 2 / 3 | NOT_RUN |
| phone-letter | 2 / 3 | NOT_RUN |
| engine-nbsp | 2 / 3 | NOT_RUN |
| phone-nbsp | 2 / 3 | NOT_RUN |
| exponent-mechanic | 2 / 3 | NOT_RUN |
| invalid-calendar | 2 / 3 | NOT_RUN |
| past-date | 2 / 3 | NOT_RUN |
| missing-mechanic | 2 / 3 | NOT_RUN |
| reject-before-insert | 4 / 5 | NOT_RUN |
| exponent-cancel | 3 / 4 | NOT_RUN |
| exponent-update | 3 / 4 | NOT_RUN |

Executed PHP/TS counts: **HTTP 0, initial DB 0, post-step DB 0**.
There is no observed first differing step. Static predictions of five potentially
different cases are not observed FAILs. Positive lifecycle and corrupted-public-
observation negative controls remain NOT_RUN on real PHP/TS.

## Static and synthetic receipts

[public-source-check.json](public-source-check.json) records independently
verified public archive and exact members: api.php (360 lines), config.php
(124 lines), LICENSE (21 lines). No upstream files were extracted to disk or run.

[static-check.json](static-check.json) records the research head, case digest,
policy counts, candidate admission SHA, canonical Git recipe SHA and four
synthetic controls: equal HTTP PASS, corrupted HTTP status detected HTTP_STATUS,
equal DB PASS, corrupted SQLite sequence detected DB_STATE. These are four
original synthetic comparisons, separate from the zero real PHP/TS comparisons.

Two original Windows checkout byte differences were observed against canonical
Git blobs: `packages/oracle/reference/inspector.php` and target runtime Dockerfile
have CRLF. Canonical target recipe is `f09b12fe...`; actual Windows recipe is
`bd2296fc...` (full digests in static-check.json). The files were not edited and
the runtime pin was not normalized or weakened. A future Linux checkout must
verify exact recipe bytes and runtime identities before execution. This checkout
observation is not a demonstrated defect in the previously executed evaluator.

## Cleanup, metrics and limits

No containers or volumes were provisioned by this work. Docker inventory was
**NOT_RUN** because the executable is absent. Thus containers, volumes and
emergencyRemoved are **unknown/null**, not verified zero; CLEANUP_PASS is not
claimed. There are no runtime elapsed-time/resource measurements, raw HTTP/DB
receipts or Docker image IDs for this experiment. Error/timeout cleanup behavior
was not exercised on real workers here. No new Docker or paid/model run occurred.

Public static evidence supports the [hypotheses](hypotheses.md), not causal
classification. Follow the [handoff](docker-handoff.md) to distinguish a public
candidate behavior difference from transport/mapping/comparison artifacts.
G0/G4 remain **INCONCLUSIVE**, this corpus's isolated candidate G1 and real G2/G3
are **NOT_RUN**, product **NOT_ESTABLISHED**, private audit unchanged.
