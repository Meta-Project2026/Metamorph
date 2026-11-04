# #125 — historical GLM second-run diagnostic: supersession verdict

**Proposal: `closed/not_planned`** — the issue's *present goal* is superseded by a
genuine public success; the historical diagnostic it planned is no longer necessary.
This is not `completed` and not `duplicate`: the planned work was never executed,
and the historical cause it targeted remains unknown.

## What #125 actually planned

An offline evidence audit plus (only under a fresh one-shot authorization) a second
bounded Docker diagnostic of the frozen GLM repair candidate
`0cf5ba0bb22fd1d335b3d061b0a9b258d7ac660f3038e1e651ddaad1262d03c1`, to attribute the
historical first-HTTP failure shape (`G2 0/17`, `G3 1/20` VERIFIER_ERROR) to the
candidate side, reference side, or a shared cause.

## Historical facts preserved (immutable)

- The GLM candidate and its receipts are frozen and unchanged; agent-reported Docker
  execution was never independently rerun.
- The single owner-authorized diagnostic attempt was consumed by `ERROR_ENVIRONMENT`
  **before** any Docker resource creation or candidate invocation; candidate
  validation `NOT_RUN`; global inventory UNAVAILABLE; no 0/0/0 claimed.
- Root cause, failed side and error class of the historical `0/17, 1/20` shape are
  and remain **UNKNOWN**. The static `x-request-id` echo finding (MMP-126, PR #128
  review) is a verified interface defect hypothesis, not a proven cause; PR #131
  disclosed the transport obligation **for future generated candidates only**.

## Why the present goal is met without the diagnostic

The issue's purpose — de-risk the pipeline's first-HTTP verifier behavior before
more paid attempts — is answered by direct evidence: authentic run
[#41856569137](https://github.com/Metamorph/actions/runs/41856569137) at exact
`main@95397bbff94f3e0121ebdc9fa375880762bcbac7` produced a genuine model-generated
candidate with **G1 6/6, G2 17/17, G3 20/20 PASS** (`COMPLETE_PUBLIC_PASS`), custody
artifact 13338306385 and cleanups 0/0/0. The HTTP+SQLite path now has an authentic
full public PASS; rerunning the frozen old candidate would not change any present
decision gate.

**This does not identify the historical failure's cause, and must not be read as
retroactively explaining or fixing it.** The design delta (PR #131 disclosure)
applies to future candidates only; the old candidate bytes and receipts are frozen.

## Dependency check (executed, not assumed)

- `grep -rn "mmp-125|mmp125" packages/ .github/workflows/` at exact main
  `95397bbff94f3e0121ebdc9fa375880762bcbac7`: **no matches** outside Markdown. No
  production code or workflow depends on the #125 diagnostic modules; they are
  research-only (`research/mmp-125/**`, registered for hosted syntax checks in
  `research/mmp-069/coverage-matrix.json`, which stays unchanged).
- Open-PR collision check at closeout time: `gh pr list --state open` was empty.

## #134 remains OPEN, unchanged, and visible — separate P0 debt

Closing #125 must not soften #134. Source-inspected at exact main
`95397bbff94f3e0121ebdc9fa375880762bcbac7`,
`packages/differential/src/workshop-finalizer.mjs:9-29` still force-removes every
container/volume whose name matches the
`mmp007-|mmp-reference-|mmp-reference-state-|mmp-inspector-|mmp008a-clock-` prefix
regex with **no per-run owner-label verification**; the only mitigations are the
in-file "Dedicated disposable Actions daemon only" assumption and repo workflow
topology. On any shared daemon this is a foreign-resource deletion hazard. The
mmp-125 launcher's stricter label-scoped removal (`launcher-core.psm1`) covers only
that research launcher, not the shared finalizer. The actual remediation decision
(ownership-scoped fix vs proven exclusive-daemon isolation) stays in open #134 and
needs both owners' explicit agreement. Nothing in this closeout fixes, closes or
normalizes it.

## What this closure deliberately does NOT claim

- Not that the historical `0/17, 1/20` cause was found, fixed, or would reproduce.
- Not that the GLM candidate was exonerated or convicted (`NOT_REPRODUCED`).
- Not that any new Docker diagnostic ran (it did not; `NOT_RUN`).
- Not that the readiness package's BLOCKED blockers (image identity, daemon health)
  were resolved — they are moot for the superseded diagnostic and unowned elsewhere
  only if a future second-run-style diagnostic is ever re-planned.
