# MMP-008B validation

Base: `242fd49cfee891063836827eea3d8087249097ba` (fresh main at reconnaissance).
Branch: `feat/mmp-008b-ilia-workshop-target`; Git author/push account `l1ncolny`.
Issue21 explicitly delegates target-side work to Ilia. No co-owner approval implied.

Candidate source, source/archive/license hashes were inspected without running
PHP or candidate TS on the host. Typecheck/build/run of admitted candidates is
reserved for disposable Docker. Public source hash is pinned in workshop-policy.

Local Windows checks (Node v24.21.0, pnpm11.25.0): frozen install, lint,
typecheck, root test65/65 and build each exited0. Differential78 total:77PASS,
one POSIX-only evidence test SKIP, exit0. Reference56 total:55PASS, one
POSIX-only evidence test SKIP, exit0. Target-worker69/69PASS, exit0.
An unchanged bridge test initially exposed a prototype-call compatibility bug
in the new validation helper; implementation fixed, original test retained,
full differential/target suites rerun successfully. First lint formatting errors
were corrected before the passing lint. Candidate was never compiled/run on host.

Current
Docker G1/G2/G3, quota/lifecycle controls and original Docker regressions: NOT_RUN.
This status is not a parity assertion. Manual workflow has no PR/push trigger.

Coverage required for each of two passes:

| Scenario | HTTP comparisons | Initial DB | Post-step DB |
| --- | ---: | ---: | ---: |
| workshop-business | 6 | 1 | 6 |
| workshop-rejected | 5 | 1 | 5 |
| workshop-capacity | 6 | 1 | 6 |

G4 runs the unchanged nine independent synthetic comparator controls per pair,
but remains INCONCLUSIVE (`HELD_OUT_NOT_RUN`). G0 completeness, external retention,
benchmark registration, model usage and product PASS remain NOT_RUN/NOT_ESTABLISHED.
