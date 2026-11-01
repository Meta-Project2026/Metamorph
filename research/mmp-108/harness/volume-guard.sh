#!/bin/sh
# MMP-108 disposable-harness volume ownership guards (review B2).
# require-free  : refuse when the volume name already exists (no reuse, no
#                 deletion of preexisting state).
# verify-owner  : refuse unless the volume carries this run's owner label.
# remove-owned  : verify-owner, then remove, then verify removal; every failure
#                 exits nonzero and no removal error is ever swallowed.
# Inspections are read-only. Removal only ever targets a volume whose
# immutable-at-create owner label matches the given run id.
set -eu
LABEL_KEY="metamorph.mmp108.run"
owner_label() {
  docker volume inspect --format "{{index .Labels \"$LABEL_KEY\"}}" "$1" 2>/dev/null || printf ''
}
command=${1:?usage: volume-guard.sh require-free|verify-owner|remove-owned <volume> <runId>}
volume=${2:?missing volume name}
run_id=${3:-}
case "$command" in
  require-free)
    if docker volume inspect "$volume" >/dev/null 2>&1; then
      echo "VOLUME_COLLISION $volume" >&2
      exit 1
    fi
    ;;
  verify-owner)
    [ -n "$run_id" ] || { echo "RUN_ID_REQUIRED" >&2; exit 1; }
    [ "$(owner_label "$volume")" = "$run_id" ] || {
      echo "VOLUME_NOT_OWNED $volume" >&2
      exit 1
    }
    ;;
  remove-owned)
    [ -n "$run_id" ] || { echo "RUN_ID_REQUIRED" >&2; exit 1; }
    sh "$0" verify-owner "$volume" "$run_id"
    docker volume rm "$volume" >/dev/null
    if docker volume inspect "$volume" >/dev/null 2>&1; then
      echo "VOLUME_REMOVE_FAILED $volume" >&2
      exit 1
    fi
    ;;
  *)
    echo "UNKNOWN_COMMAND $command" >&2
    exit 1
    ;;
esac
