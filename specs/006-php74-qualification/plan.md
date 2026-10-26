# Plan — MMP-005

Use Oracle-owned probe scripts and a dedicated 20-minute GitHub Ubuntu job;
local Windows has no Docker/Podman or installed WSL distribution. Build trusted
PHP dependencies before downloading/admitting source, then run offline as an
unprivileged UID with read-only root, dropped capabilities, bounded CPU/memory/
PIDs/tmpfs and wall-time. Mount only the source archive and trusted probe readonly.
Never mount host credentials, the workspace, Docker socket or host-writable output.

The trusted host driver captures container output privately and emits a strict
allowlist of enums, numbers, hashes and predefined scenario IDs; no arbitrary PHP
error/body text becomes public. Raw evidence exists only in disposable tmpfs and
is not uploaded. Preserve an exact reproduction recipe and disclose retention.

Public scenarios are defined from pinned controllers, not guessed routes. No
upstream test/answer contents enter model context. Replay comparison detects
nondeterminism; no production comparator/normalization changes are needed.
Use fallback only after a documented primary NO-GO/blocker. Keep feature selection
non-persisting. No platform framework, model calls, workstation installation or merge.

## Predeclared clock experiment (after unmodified runtime measurements)

Run `workshop-clock` only after the primary and ordinary workshop profiles have
actually returned NO-GO. Build Debian libfaketime into the trusted runtime before
source admission; retain its installed copyright notice. Freeze wall time only
for the workshop PHP server at **2026-10-27 12:00:00 UTC**, preserving real monotonic
time. Before source execution, verify the actual PHP and SQLite clocks both equal
that value. Keep dates explicit (2099-06-15/16) and let the application's Dhaka
timezone logic execute normally. Record the library version and clock checks.

This is a controlled runtime profile, not a field normalizer: keep all timestamp
values, schema, response bytes, IDs and ordering intact. No RNG interception is
authorized or configured. Parent inspection/host deadlines use the real clock.
Re-run all three workshop scenarios twice with independent fresh DBs and the
same clock profile. GO is restricted to that measured sequential demo profile;
real-clock/date-boundary/concurrency semantics remain unverified. Do not register
it as a benchmark or imply either owner's acceptance.
