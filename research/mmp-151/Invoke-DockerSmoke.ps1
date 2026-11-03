param([Parameter(Mandatory=$true)][string]$ScratchRoot)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$runId = [guid]::NewGuid().ToString('N')
$image = 'mmp151-offline-harness'
# Official Docker image index, verified against docker-library/repo-info on
# 2026-11-03: repos/docker/remote/29.9.2-dind.md. Never fall back to a mutable tag.
$daemonImage = 'docker:29.9.2-dind@sha256:9e79b879b177fbd72c34376a3dd3d91747da5db49e1f560f76aea59561471977'
$container = "mmp151-harness-$runId"
$daemon = "mmp151-daemon-$runId"
$createdVolumes = @()
$createdContainers = @()
$result = 1
New-Item -ItemType Directory -Force -Path $ScratchRoot | Out-Null
$scratch = (Resolve-Path -LiteralPath $ScratchRoot).Path
$bundle = Join-Path $scratch "source-$runId.bundle"
$receipts = Join-Path $scratch "receipts-$runId"
function Check-Docker {
  param([string[]]$Arguments)
  $value = & docker @Arguments
  if ($LASTEXITCODE -ne 0) { throw 'MMP151_DOCKER_COMMAND_FAILED' }
  return $value
}
function Check-OwnedVolume {
  param([string]$Name)
  if ($Name -notmatch '^mmp151-daemon-(data|socket)-[a-f0-9]{32}$') { throw 'MMP151_VOLUME_NAME_REJECTED' }
  $info = (Check-Docker -Arguments @('volume','inspect',$Name) | ConvertFrom-Json)[0]
  if ($info.Name -ne $Name -or $info.Labels.'metamorph.mmp151.run' -ne $runId) { throw 'MMP151_VOLUME_OWNER_REJECTED' }
  if ($info.Driver -ne 'local' -or $info.Options -or $info.Mountpoint -ne "/var/lib/docker/volumes/$Name/_data") { throw 'MMP151_VOLUME_PATH_REJECTED' }
}
function Check-ContainerId {
  param([string]$Name)
  $info = (Check-Docker -Arguments @('container','inspect',$Name) | ConvertFrom-Json)[0]
  if ($info.Config.Labels.'metamorph.mmp151.run' -ne $runId -or $info.Name -ne "/$Name" -or $info.Id -notmatch '^[a-f0-9]{64}$') { throw 'MMP151_CONTAINER_OWNER_REJECTED' }
  return $info.Id
}
Push-Location -LiteralPath $repo
try {
  $head = (& git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $head -notmatch '^[a-f0-9]{40}$') { throw 'MMP151_HEAD_REJECTED' }
  if (& git status --porcelain=v1) { throw 'MMP151_REQUIRES_COMMITTED_CLEAN_TREE' }
  $hostInfo = Check-Docker -Arguments @('info','--format','{{json .}}') | ConvertFrom-Json
  if (-not $hostInfo.ID) { throw 'MMP151_HOST_DAEMON_UNAVAILABLE' }
  & git bundle create $bundle HEAD
  if ($LASTEXITCODE -ne 0) { throw 'MMP151_SOURCE_BUNDLE_FAILED' }
  foreach ($kind in @('data','socket')) {
    $name = "mmp151-daemon-$kind-$runId"
    $existing = Check-Docker -Arguments @('volume','ls','--quiet','--filter',"name=^$name$")
    if ($existing) { throw 'MMP151_PREEXISTING_VOLUME_REJECTED' }
    # Track before creation: a failed/lost response must still enter cleanup.
    $createdVolumes += $name
    Check-Docker -Arguments @('volume','create','--label',"metamorph.mmp151.run=$runId",$name) | Out-Null
    Check-OwnedVolume $name
  }
  $dataMount = "type=volume,src=mmp151-daemon-data-$runId,dst=/var/lib/docker"
  $socketMount = "type=volume,src=mmp151-daemon-socket-$runId,dst=/var/run"
  $createdContainers += $daemon
  # Explicit `dockerd` bypasses the official entrypoint's implicit TCP listeners.
  # No host socket, bind path, published port, host network or host PID namespace.
  # Upstream dind needs privilege; existing worker sandboxes are unchanged.
  Check-Docker -Arguments @('create','--name',$daemon,'--label',"metamorph.mmp151.run=$runId",'--privileged','--cpus','2','--memory','3g','--memory-swap','3g','--pids-limit','512','--stop-timeout','10','--mount',$dataMount,'--mount',$socketMount,$daemonImage,'dockerd','--host=unix:///var/run/docker.sock','--data-root=/var/lib/docker','--label',"metamorph.mmp151.run=$runId",'--shutdown-timeout=10') | Out-Null
  $daemonId = Check-ContainerId $daemon
  Check-Docker -Arguments @('start',$daemonId) | Out-Null
  $daemonInfo = $null
  for ($attempt = 0; $attempt -lt 45; $attempt++) {
    $raw = & docker exec $daemonId docker --host unix:///var/run/docker.sock info --format '{{json .}}' 2>$null
    if ($LASTEXITCODE -eq 0) { $daemonInfo = $raw | ConvertFrom-Json; break }
    Start-Sleep -Seconds 1
  }
  if (-not $daemonInfo.ID -or $daemonInfo.ID -eq $hostInfo.ID -or $daemonInfo.DockerRootDir -ne '/var/lib/docker' -or $daemonInfo.Labels -notcontains "metamorph.mmp151.run=$runId") { throw 'MMP151_DEDICATED_DAEMON_REJECTED' }
  $work = "/var/lib/docker/volumes/mmp151-work-$runId/_data"
  $private = "/var/lib/docker/volumes/mmp151-private-$runId/_data"
  $output = "/var/lib/docker/volumes/mmp151-output-$runId/_data"
  $program = @'
set -eu
umask 077
if [ ! -e /usr/bin/docker ]; then ln -s /usr/local/bin/docker /usr/bin/docker; fi
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_CONFIG DOCKER_TLS_VERIFY DOCKER_CERT_PATH
test -S /var/run/docker.sock
test "$(docker info --format '{{.ID}}')" = "$MMP151_DAEMON_ID"
for kind in work private output; do
  name="mmp151-$kind-$MMP151_DAEMON_RUN"
  test -z "$(docker volume ls --quiet --filter "name=^$name$")"
  docker volume create --label "metamorph.mmp151.run=$MMP151_DAEMON_RUN" "$name" >/dev/null
  test "$(docker volume inspect --format '{{.Mountpoint}}' "$name")" = "/var/lib/docker/volumes/$name/_data"
done
mkdir -p "$MMP151_PRIVATE/tools" "$MMP151_OUTPUT"
chmod 0700 "$MMP151_PRIVATE" "$MMP151_OUTPUT"
(umask 022; git clone --quiet /task.bundle "$MMP151_WORK/repo")
cd "$MMP151_WORK/repo"
test "$(git rev-parse HEAD)" = "$MMP151_HEAD"
pnpm install --frozen-lockfile >"$MMP151_PRIVATE/install.log" 2>&1
pnpm build >"$MMP151_PRIVATE/build.log" 2>&1
node --test packages/agent-real/test/autonomous-review.test.mjs >"$MMP151_PRIVATE/review-controls.log" 2>&1
tail -n 8 "$MMP151_PRIVATE/review-controls.log"
RUNNER_TEMP="$MMP151_PRIVATE/tools" node research/mmp-089/install-age.mjs >"$MMP151_PRIVATE/tools.log" 2>&1
node research/mmp-151/docker-smoke.mjs
'@
  $program = $program.Replace("`r`n", "`n")
  $createdContainers += $container
  # Both inherited and scrubbed subprocesses use the dedicated default socket.
  Check-Docker -Arguments @('create','--init','--name',$container,'--label',"metamorph.mmp151.run=$runId",'--cpus','2','--memory','1536m','--memory-swap','1536m','--pids-limit','256','--stop-timeout','10','--mount',$dataMount,'--mount',$socketMount,'-e',"MMP151_DAEMON_RUN=$runId",'-e',"MMP151_DAEMON_ID=$($daemonInfo.ID)",'-e',"MMP151_WORK=$work",'-e',"MMP151_PRIVATE=$private",'-e',"MMP151_OUTPUT=$output",'-e',"MMP151_HEAD=$head",$image,'timeout','--signal=TERM','--kill-after=15','2100','/bin/sh','-c',$program) | Out-Null
  $containerId = Check-ContainerId $container
  # Copy into a stopped container rather than passing any host filesystem bind.
  Check-Docker -Arguments @('cp',$bundle,"${containerId}:/task.bundle") | Out-Null
  & docker start --attach $containerId
  $result = $LASTEXITCODE
  New-Item -ItemType Directory -Force -Path $receipts | Out-Null
  if ($result -ne 0) {
    & docker cp "${containerId}:$private/age-tests.log" (Join-Path $receipts 'private-synthetic-tests.log') 2>$null
    & docker cp "${containerId}:$private/tools.log" (Join-Path $receipts 'private-tool-preparation.log') 2>$null
  }
  Check-Docker -Arguments @('cp',"${containerId}:$output/summary.json",(Join-Path $receipts 'summary.json')) | Out-Null
  Write-Output "MMP151_SUMMARY=$receipts/summary.json"
  if ($result -ne 0) { throw 'MMP151_OFFLINE_ACCEPTANCE_FAILED' }
} finally {
  $cleanupFailures = 0
  # Remove inspected immutable IDs only. Continue after each cleanup failure.
  [array]::Reverse($createdContainers)
  foreach ($name in $createdContainers) {
    try {
      $raw = & docker container inspect $name 2>$null
      if ($LASTEXITCODE -ne 0) { throw 'MMP151_CONTAINER_CLEANUP_UNVERIFIABLE' }
      $id = Check-ContainerId $name
      Check-Docker -Arguments @('rm','--force',$id) | Out-Null
    } catch { $cleanupFailures++ }
  }
  foreach ($name in $createdVolumes) {
    try {
      $raw = & docker volume inspect $name 2>$null
      if ($LASTEXITCODE -ne 0) { throw 'MMP151_VOLUME_CLEANUP_UNVERIFIABLE' }
      Check-OwnedVolume $name
      Check-Docker -Arguments @('volume','rm',$name) | Out-Null
    } catch { $cleanupFailures++ }
  }
  Pop-Location
  if ($cleanupFailures -ne 0) { throw 'MMP151_OUTER_CLEANUP_FAILED' }
}
exit $result
