#!/bin/sh
# Manual-only host commands for the MMP-108 disposable Linux harness.
# Never dispatched automatically; not a GitHub workflow; no paid secrets.
# Run from the repository root on a host with a Linux-container Docker engine.
#
# B4: the exact image for this run is built first (run-scoped tag) and that
# tag is what executes, so a stale or absent cached image can never run.
# B2/B5: run-scoped owner labels; the script refuses any preexisting mmp108
# volume name; an EXIT trap removes the run-scoped receipt container (tracked
# after successful creation, before volumes, since it holds the output
# volume) and only the volumes this run created (owner label re-verified
# inside volume-guard.sh) on every exit path, including failures before any
# receipt exists; removal errors are reported and flip a successful run to
# nonzero, and never mask an already-failing status.
# B6: receipts land in a run-scoped evidence directory that is refused if it
# already exists, so runs can never overwrite or mix each other's evidence;
# receipts are copied only after a successful harness run.
set -eu
: "${AGENT_HEAD_SHA:?set AGENT_HEAD_SHA to the exact reviewed commit}"
GUARD="$(dirname "$0")/volume-guard.sh"
VOLUMES="mmp108-work mmp108-private mmp108-output"
CREATED=""
RUN_ID=""
RECEIPTS_CONTAINER=""
cleanup_status=0
cleanup_done=0
cleanup() {
  [ "$cleanup_done" -eq 1 ] && return 0
  cleanup_done=1
  # The receipt container holds the output volume: it must be removed before
  # any owned-volume removal, and only this run's uniquely named container is
  # ever touched (tracked after successful creation; foreign state excluded).
  if [ -n "$RECEIPTS_CONTAINER" ]; then
    if docker container inspect "$RECEIPTS_CONTAINER" >/dev/null 2>&1; then
      docker rm "$RECEIPTS_CONTAINER" >/dev/null || cleanup_status=1
      if docker container inspect "$RECEIPTS_CONTAINER" >/dev/null 2>&1; then
        echo "MMP108_RECEIPTS_CONTAINER_CLEANUP_FAILURE" >&2
        cleanup_status=1
      fi
    fi
  fi
  for volume in $CREATED; do
    sh "$GUARD" remove-owned "$volume" "$RUN_ID" || cleanup_status=1
  done
  if [ "$cleanup_status" -ne 0 ]; then
    echo "MMP108_CLEANUP_FAILURE" >&2
  fi
}
trap cleanup EXIT

RUN_ID="mmp108-$(date -u +%Y%m%dT%H%M%SZ)-$(dd if=/dev/urandom bs=6 count=1 2>/dev/null | od -An -tx1 | tr -d ' \n')"
IMAGE_TAG="metamorph-mmp108-harness:$RUN_ID"
echo "mmp108 run id: $RUN_ID"

# B6: a repeat run must never overwrite or mix a previous run's receipts.
short_head=$(printf '%s' "$AGENT_HEAD_SHA" | cut -c1-8)
evidence_dir="research/mmp-108/evidence/local-$short_head-$RUN_ID"
if [ -e "$evidence_dir" ]; then
  echo "EVIDENCE_TARGET_EXISTS $evidence_dir" >&2
  exit 1
fi

# B4: fresh exact-image build precedes any state provisioning.
docker build -f "$(dirname "$0")/Dockerfile" -t "$IMAGE_TAG" "$(dirname "$0")"

for volume in $VOLUMES; do
  sh "$GUARD" require-free "$volume"
  docker volume create \
    --label metamorph.mmp108=true \
    --label "metamorph.mmp108.run=$RUN_ID" \
    "$volume" >/dev/null
  CREATED="$CREATED $volume"
done

# Windows/Git-Bash path conversion for the repository mount is intentionally
# left enabled on the primary run (no MSYS_NO_PATHCONV here).
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
  "$IMAGE_TAG" mmp108-run; then
  run_status=0
else
  run_status=$?
fi

# Receipts are copied only after a successful run: failures publish nothing,
# so partial or failed runs can never mix into the reviewed evidence tree.
# docker create/cp avoids host-path bind conversion entirely; the container
# path arguments must stay unconverted, hence MSYS_NO_PATHCONV (harmless on
# Linux).
if [ "$run_status" -eq 0 ]; then
  mkdir -p "$evidence_dir"
  receipts_container="mmp108-receipts-${RUN_ID}"
  MSYS_NO_PATHCONV=1 docker create --name "$receipts_container" \
    -v mmp108-output:/o "$IMAGE_TAG" >/dev/null
  # Tracked only after successful creation, so the EXIT trap owns its removal
  # on every path; a failed create leaves nothing to clean.
  RECEIPTS_CONTAINER="$receipts_container"
  MSYS_NO_PATHCONV=1 docker cp "$receipts_container:/o/." "$evidence_dir"
  docker rm "$receipts_container" >/dev/null
  RECEIPTS_CONTAINER=""
  echo "mmp108 harness receipts: $evidence_dir"
fi

trap - EXIT
cleanup
if [ "$run_status" -ne 0 ]; then
  echo "mmp108 harness run status: $run_status"
  exit "$run_status"
fi
if [ "$cleanup_status" -ne 0 ]; then
  exit 1
fi
exit 0
