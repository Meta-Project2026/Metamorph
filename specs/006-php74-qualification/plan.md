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
