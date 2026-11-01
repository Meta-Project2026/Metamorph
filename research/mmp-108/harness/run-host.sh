#!/bin/sh
# Manual-only host commands for the MMP-108 disposable Linux harness.
# Never dispatched automatically; not a GitHub workflow; no paid secrets.
# Run from the repository root on a host with a Linux-container Docker engine.
#
# Volume safety (review B2): run-scoped owner labels; every invocation refuses
# to start if any mmp108 volume name already exists, so preexisting or
# concurrently owned state is never reused or deleted; cleanup removes only
# volumes whose owner label matches this run id, and no removal error is
# swallowed. Public receipts are copied into the repository before cleanup.
set -eu
: "${AGENT_HEAD_SHA:?set AGENT_HEAD_SHA to the exact reviewed commit}"
GUARD="$(dirname "$0")/volume-guard.sh"
RUN_ID="mmp108-$(date -u +%Y%m%dT%H%M%SZ)-$(dd if=/dev/urandom bs=6 count=1 2>/dev/null | od -An -tx1 | tr -d ' \n')"
VOLUMES="mmp108-work mmp108-private mmp108-output"
echo "mmp108 run id: $RUN_ID"
for volume in $VOLUMES; do
  sh "$GUARD" require-free "$volume"
  docker volume create \
    --label metamorph.mmp108=true \
    --label "metamorph.mmp108.run=$RUN_ID" \
    "$volume" >/dev/null
done
if docker run --rm --name mmp108-harness \
  --network bridge \
  --pids-limit 512 \
  --memory 4g \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "mmp108-work:/var/lib/docker/volumes/mmp108-work/_data" \
  -v "mmp108-private:/var/lib/docker/volumes/mmp108-private/_data" \
  -v "mmp108-output:/var/lib/docker/volumes/mmp108-output/_data" \
  -v "$(pwd):/repo:ro" \
  -e AGENT_HEAD_SHA \
  -e MMP108_RUN_ID="$RUN_ID" \
  -e MMP108_PRIVATE_PARENT=/var/lib/docker/volumes/mmp108-private/_data \
  -e MMP108_PUBLIC_OUTPUT=/var/lib/docker/volumes/mmp108-output/_data \
  metamorph-mmp108-harness mmp108-run; then
  run_status=0
else
  run_status=$?
fi
# Public receipts only (allowlisted categorical JSON) land in the repository;
# the private volume is removed unopened by the owned-volume cleanup below.
short_head=$(printf '%s' "$AGENT_HEAD_SHA" | cut -c1-8)
evidence_dir="research/mmp-108/evidence/local-$short_head"
mkdir -p "$evidence_dir"
# Windows/Git-Bash hosts may need MSYS_NO_PATHCONV=1 for the repository mount.
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "mmp108-output:/o" \
  -v "$(pwd)/$evidence_dir:/out" \
  metamorph-mmp108-harness sh -c 'cp /o/*.json /out/'
for volume in $VOLUMES; do
  sh "$GUARD" remove-owned "$volume" "$RUN_ID"
done
echo "mmp108 harness receipts: $evidence_dir (run status $run_status)"
exit "$run_status"
