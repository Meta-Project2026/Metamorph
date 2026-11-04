# MMP-187 — bounded per-process repeat evidence

Each cell is exit code / elapsed seconds, measured by the external driver around
a fresh process. These are local Windows observations, not actual Docker runs.
All failed samples are retained. Each child invocation executes all seven
baseline tests or all eight final tests; no test-name filter or retry is used.
Node 22 = v22.23.1; Node 24 = v24.22.1; pnpm = 11.25.0.

## Timing distribution

Times in seconds; median averages the middle two samples, P95 uses nearest rank.

| Phase | Suite | Node | N | Exit 0 / nonzero | Min | Median | P95 | Max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | child | 22 | 50 | 49 / 1 | 4.913 | 5.358 | 7.473 | 7.974 |
| baseline | child | 24 | 50 | 49 / 1 | 5.244 | 5.791 | 8.146 | 8.379 |
| baseline | parent | 22 | 3 | 3 / 0 | 8.473 | 8.900 | 9.020 | 9.020 |
| baseline | parent | 24 | 3 | 3 / 0 | 8.506 | 8.816 | 8.884 | 8.884 |
| baseline | package | 22 | 1 | 1 / 0 | 11.939 | 11.939 | 11.939 | 11.939 |
| baseline | package | 24 | 1 | 1 / 0 | 11.580 | 11.580 | 11.580 | 11.580 |
| after | child | 22 | 50 | 50 / 0 | 6.275 | 8.168 | 13.220 | 13.770 |
| after | child | 24 | 50 | 50 / 0 | 6.671 | 8.729 | 13.753 | 14.101 |
| after | parent | 22 | 3 | 3 / 0 | 11.912 | 11.976 | 15.819 | 15.819 |
| after | parent | 24 | 3 | 3 / 0 | 11.922 | 11.950 | 15.869 | 15.869 |
| after | package | 22 | 2 | 2 / 0 | 18.777 | 20.190 | 21.602 | 21.602 |
| after | package | 24 | 2 | 2 / 0 | 18.173 | 19.493 | 20.813 | 20.813 |

## Child processes

| Attempt | Before 22 | Before 24 | After 22 | After 24 |
| --- | --- | --- | --- | --- |
| 1 | 0 / 5.869 | 0 / 6.298 | 0 / 6.347 | 0 / 6.984 |
| 2 | 0 / 5.376 | 0 / 5.977 | 0 / 7.942 | 0 / 8.614 |
| 3 | 0 / 5.823 | 0 / 6.318 | 0 / 7.107 | 0 / 7.839 |
| 4 | 0 / 6.759 | 1 / 7.605 | 0 / 8.187 | 0 / 9.710 |
| 5 | 0 / 7.473 | 0 / 8.146 | 0 / 10.161 | 0 / 11.769 |
| 6 | 0 / 7.974 | 0 / 8.379 | 0 / 12.333 | 0 / 12.349 |
| 7 | 0 / 7.824 | 0 / 7.731 | 0 / 9.806 | 0 / 9.705 |
| 8 | 0 / 6.488 | 0 / 6.571 | 0 / 8.686 | 0 / 10.117 |
| 9 | 0 / 5.614 | 0 / 5.624 | 0 / 10.122 | 0 / 11.623 |
| 10 | 0 / 5.081 | 0 / 5.347 | 0 / 12.563 | 0 / 13.887 |
| 11 | 0 / 4.917 | 0 / 5.334 | 0 / 13.342 | 0 / 14.101 |
| 12 | 0 / 5.017 | 0 / 5.493 | 0 / 12.925 | 0 / 9.061 |
| 13 | 0 / 5.161 | 0 / 5.691 | 0 / 7.466 | 0 / 8.328 |
| 14 | 0 / 5.274 | 0 / 5.626 | 0 / 7.744 | 0 / 10.667 |
| 15 | 0 / 5.160 | 0 / 5.828 | 0 / 9.992 | 0 / 11.121 |
| 16 | 0 / 5.401 | 0 / 5.694 | 0 / 10.300 | 0 / 9.471 |
| 17 | 0 / 5.313 | 0 / 6.335 | 0 / 8.967 | 0 / 10.822 |
| 18 | 0 / 5.504 | 0 / 7.220 | 0 / 8.702 | 0 / 13.753 |
| 19 | 0 / 6.658 | 0 / 7.024 | 0 / 13.770 | 0 / 12.418 |
| 20 | 0 / 6.580 | 0 / 6.887 | 0 / 13.220 | 0 / 8.765 |
| 21 | 0 / 6.613 | 0 / 6.791 | 0 / 9.052 | 0 / 10.294 |
| 22 | 0 / 6.138 | 0 / 7.855 | 0 / 8.870 | 0 / 11.091 |
| 23 | 0 / 6.682 | 0 / 6.164 | 0 / 9.895 | 0 / 9.977 |
| 24 | 1 / 7.366 | 0 / 5.797 | 0 / 10.161 | 0 / 8.332 |
| 25 | 0 / 5.404 | 0 / 5.919 | 0 / 7.960 | 0 / 7.869 |
| 26 | 0 / 5.267 | 0 / 8.340 | 0 / 7.628 | 0 / 7.559 |
| 27 | 0 / 6.115 | 0 / 6.113 | 0 / 6.927 | 0 / 7.543 |
| 28 | 0 / 6.593 | 0 / 5.658 | 0 / 6.754 | 0 / 8.261 |
| 29 | 0 / 5.757 | 0 / 5.615 | 0 / 6.724 | 0 / 8.693 |
| 30 | 0 / 5.365 | 0 / 6.003 | 0 / 7.459 | 0 / 9.328 |
| 31 | 0 / 5.180 | 0 / 5.574 | 0 / 8.137 | 0 / 9.282 |
| 32 | 0 / 5.136 | 0 / 5.892 | 0 / 8.289 | 0 / 9.307 |
| 33 | 0 / 5.353 | 0 / 5.680 | 0 / 8.612 | 0 / 9.279 |
| 34 | 0 / 5.254 | 0 / 5.465 | 0 / 8.572 | 0 / 8.939 |
| 35 | 0 / 5.381 | 0 / 5.466 | 0 / 8.790 | 0 / 8.820 |
| 36 | 0 / 5.312 | 0 / 5.651 | 0 / 8.148 | 0 / 8.040 |
| 37 | 0 / 4.956 | 0 / 5.650 | 0 / 8.395 | 0 / 7.049 |
| 38 | 0 / 5.174 | 0 / 5.882 | 0 / 8.291 | 0 / 7.007 |
| 39 | 0 / 5.259 | 0 / 6.174 | 0 / 6.595 | 0 / 7.158 |
| 40 | 0 / 5.189 | 0 / 5.334 | 0 / 6.352 | 0 / 7.020 |
| 41 | 0 / 5.336 | 0 / 5.620 | 0 / 6.302 | 0 / 7.063 |
| 42 | 0 / 5.868 | 0 / 5.724 | 0 / 6.498 | 0 / 7.072 |
| 43 | 0 / 5.052 | 0 / 5.786 | 0 / 6.275 | 0 / 7.198 |
| 44 | 0 / 5.285 | 0 / 5.820 | 0 / 6.340 | 0 / 7.125 |
| 45 | 0 / 5.219 | 0 / 5.324 | 0 / 6.373 | 0 / 6.955 |
| 46 | 0 / 5.364 | 0 / 5.489 | 0 / 6.322 | 0 / 7.002 |
| 47 | 0 / 5.289 | 0 / 5.343 | 0 / 6.576 | 0 / 7.013 |
| 48 | 0 / 5.102 | 0 / 5.361 | 0 / 6.442 | 0 / 6.671 |
| 49 | 0 / 4.913 | 0 / 5.442 | 0 / 6.340 | 0 / 6.720 |
| 50 | 0 / 5.203 | 0 / 5.244 | 0 / 6.425 | 0 / 6.755 |

## Parent and package processes

| Phase | Suite | Attempt | Node 22 | Node 24 |
| --- | --- | --- | --- | --- |
| baseline | parent | 1 | 0 / 9.020 | 0 / 8.884 |
| baseline | parent | 2 | 0 / 8.900 | 0 / 8.816 |
| baseline | parent | 3 | 0 / 8.473 | 0 / 8.506 |
| baseline | package | 1 | 0 / 11.939 | 0 / 11.580 |
| after | parent | 1 | 0 / 15.819 | 0 / 15.869 |
| after | parent | 2 | 0 / 11.976 | 0 / 11.950 |
| after | parent | 3 | 0 / 11.912 | 0 / 11.922 |
| after | package | 1 | 0 / 18.777 | 0 / 18.173 |
| after | package | 2 | 0 / 21.602 | 0 / 20.813 |

## Child test names and fault interpretation

Final suite names (baseline has the same names except the new explicit tight-deadline test):

- behavioral failure followed by post-seal tamper is ERROR with both findings retained
- explicit tight cleanup deadline retains cleanup and evidence faults after delayed capture
- qualification rejects a live negative control with failed capture integrity
- corrupted independent finalizer evidence cannot qualify a behavioral FAIL
- failed receipt write revokes the live receipt and its evidence condition
- a swallowed background capture error still overrides the original behavioral fault
- abort-ignoring work cannot block the separate ledger finalizer or mutate sealed evidence later
- verified live controls still qualify; copies have no authority and real provenance stays NOT_RUN

Passing results mean the assertions ran; fault arrays are not emitted by ordinary
TAP successes. The historical integrity control verifies exactly
[G0_CHALLENGE,G0_EVIDENCE]. The new delayed 25 ms negative verifies exactly
[G0_CHALLENGE,G0_CLEANUP,G0_EVIDENCE]; abort-ignoring work verifies exactly
[G0_CHALLENGE,G0_CLEANUP]. These are asserted outcomes, not separately captured
fault telemetry for every run. All final child attempts have zero skips.

Baseline Node 22 attempt 24: first test failed, actual
[G0_CHALLENGE,G0_CLEANUP,G0_EVIDENCE], expected
[G0_CHALLENGE,G0_EVIDENCE] (6 pass / 1 fail).
Baseline Node 24 attempt 4: final positive-qualification test failed with
G0_CONTROL_FAILED from qualifyAdapter() (6 pass / 1 fail); underlying receipt
faults were not emitted and remain unknown.

Parent results: each successful process has 25 pass / 0 fail / 1 existing Windows
POSIX-only skip. Package results: baseline 78 pass / 0 fail / 2 existing
POSIX-only skips; final 78 pass / 0 fail / 2 existing POSIX-only skips.
The extra child test is inside the existing parent child-process test and does
not increase the outer package count.

Machine-readable JSONL, per-invocation TAP/spec logs, diagnostics and the bounded
capture scripts are retained locally under %TEMP%/mmp-187-evidence/.
Commands, source SHA and limitations are recorded in [validation.md](validation.md).
No executable research module or raw candidate/private evidence was added.
