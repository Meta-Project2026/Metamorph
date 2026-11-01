#!/bin/sh
# Manual-only host commands for the MMP-108 disposable Linux harness.
# Never dispatched automatically; not a GitHub workflow; no paid secrets.
# Run from the repository root on a host with a Linux-container Docker engine.
#
# The work/private/output areas are Docker named volumes mounted at their own
# daemon-visible _data paths: one disposable Linux filesystem shared by the
# trusted harness container and the engine, so verifier bind mounts and build
# contexts resolve, and so cleanup is exactly "docker volume rm" with receipts.
set -eu
: "${AGENT_HEAD_SHA:?set AGENT_HEAD_SHA to the exact reviewed commit}"
for volume in mmp108-work mmp108-private mmp108-output; do
  docker volume rm "$volume" >/dev/null 2>&1 || true
  docker volume create "$volume" >/dev/null
done
docker build -f research/mmp-108/harness/Dockerfile \
  -t metamorph-mmp108-harness research/mmp-108/harness
MSYS_NO_PATHCONV=1 docker run --rm --name mmp108-harness \
  --network bridge \
  --pids-limit 512 \
  --memory 4g \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "mmp108-work:/var/lib/docker/volumes/mmp108-work/_data" \
  -v "mmp108-private:/var/lib/docker/volumes/mmp108-private/_data" \
  -v "mmp108-output:/var/lib/docker/volumes/mmp108-output/_data" \
  -v "$(pwd):/repo:ro" \
  -e AGENT_HEAD_SHA \
  -e MMP108_PRIVATE_PARENT=/var/lib/docker/volumes/mmp108-private/_data \
  -e MMP108_PUBLIC_OUTPUT=/var/lib/docker/volumes/mmp108-output/_data \
  metamorph-mmp108-harness mmp108-run
