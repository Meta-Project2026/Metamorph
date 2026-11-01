#!/bin/sh
# Inner harness steps. Trusted orchestration only; candidate/reference code
# runs exclusively in verifier-provisioned network-off Docker workers.
# The work area lives inside a named volume's _data path: it is the only
# filesystem location visible at the SAME absolute path to this harness
# container and to the Docker daemon (required for build contexts and bind
# mounts), and it is disk-backed and executable (the VM /tmp tmpfs is noexec).
set -eu
: "${AGENT_HEAD_SHA:?AGENT_HEAD_SHA required}"
: "${MMP108_PRIVATE_PARENT:?MMP108_PRIVATE_PARENT required}"
: "${MMP108_PUBLIC_OUTPUT:?MMP108_PUBLIC_OUTPUT required}"
WORK=/var/lib/docker/volumes/mmp108-work/_data
export HOME="$MMP108_PRIVATE_PARENT/home"
# Fresh volume from run-host.sh; clear contents only (WORK is the mount root).
find "$WORK" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
mkdir -p "$HOME" "$MMP108_PRIVATE_PARENT" "$MMP108_PUBLIC_OUTPUT" "$WORK"
git clone --no-hardlinks --quiet /repo "$WORK"
cd "$WORK"
test "$(git rev-parse HEAD)" = "$AGENT_HEAD_SHA"
pnpm install --frozen-lockfile >"$HOME/pnpm-install.log" 2>&1
pnpm build >"$HOME/pnpm-build.log" 2>&1
node research/mmp-108/first-step-proof.mjs all
