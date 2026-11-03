param([Parameter(Mandatory=$true)][string]$ScratchRoot)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$runId = [guid]::NewGuid().ToString('N')
$image = 'mmp151-offline-harness'
$container = "mmp151-harness-$runId"
$createdVolumes = @()
$started = $false
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
  if ($Name -notmatch '^mmp151-(work|private|output)-[a-f0-9]{32}$') { throw 'MMP151_VOLUME_NAME_REJECTED' }
  $info = (Check-Docker -Arguments @('volume','inspect',$Name) | ConvertFrom-Json)[0]
  if ($info.Labels.'metamorph.mmp151.run' -ne $runId) { throw 'MMP151_VOLUME_OWNER_REJECTED' }
  if ($info.Mountpoint -ne "/var/lib/docker/volumes/$Name/_data") { throw 'MMP151_VOLUME_PATH_REJECTED' }
  return $info.Mountpoint
}
Push-Location -LiteralPath $repo
try {
  $head = (& git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $head -notmatch '^[a-f0-9]{40}$') { throw 'MMP151_HEAD_REJECTED' }
  if (& git status --porcelain=v1) { throw 'MMP151_REQUIRES_COMMITTED_CLEAN_TREE' }
  $foreign = @(Check-Docker -Arguments @('container','ls','--all','--format','{{.Names}}')) + @(Check-Docker -Arguments @('volume','ls','--format','{{.Name}}'))
  if ($foreign | Where-Object { $_ -match '^(mmp007-|mmp-reference-|mmp-inspector-|mmp008a-clock-)' }) { throw 'MMP151_FOREIGN_WORKER_RESOURCES_PRESENT' }
  & git bundle create $bundle HEAD
  if ($LASTEXITCODE -ne 0) { throw 'MMP151_SOURCE_BUNDLE_FAILED' }
  foreach ($kind in @('work','private','output')) {
    $name = "mmp151-$kind-$runId"
    $existing = Check-Docker -Arguments @('volume','ls','--quiet','--filter',"name=^$name$")
    if ($existing) { throw 'MMP151_PREEXISTING_VOLUME_REJECTED' }
    Check-Docker -Arguments @('volume','create','--label',"metamorph.mmp151.run=$runId",$name) | Out-Null
    $createdVolumes += $name
    Check-OwnedVolume $name | Out-Null
  }
  $work = Check-OwnedVolume "mmp151-work-$runId"
  $private = Check-OwnedVolume "mmp151-private-$runId"
  $output = Check-OwnedVolume "mmp151-output-$runId"
  $program = @'
set -eu
umask 077
if [ ! -e /usr/bin/docker ]; then ln -s /usr/local/bin/docker /usr/bin/docker; fi
mkdir -p "$MMP151_PRIVATE/tools" "$MMP151_OUTPUT"
chmod 0700 "$MMP151_PRIVATE" "$MMP151_OUTPUT"
(umask 022; git clone --quiet /task.bundle "$MMP151_WORK/repo")
cd "$MMP151_WORK/repo"
test "$(git rev-parse HEAD)" = "$MMP151_HEAD"
pnpm install --frozen-lockfile >"$MMP151_PRIVATE/install.log" 2>&1
pnpm build >"$MMP151_PRIVATE/build.log" 2>&1
RUNNER_TEMP="$MMP151_PRIVATE/tools" node research/mmp-089/install-age.mjs >"$MMP151_PRIVATE/tools.log" 2>&1
node research/mmp-151/docker-smoke.mjs
'@
  $program = $program.Replace("`r`n", "`n")
  $started = $true
  & docker run --name $container --label "metamorph.mmp151.run=$runId" --cpus 2 --memory 1536m --pids-limit 256 --mount "type=bind,src=$bundle,dst=/task.bundle,readonly" --mount "type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock" --mount "type=volume,src=mmp151-work-$runId,dst=$work" --mount "type=volume,src=mmp151-private-$runId,dst=$private" --mount "type=volume,src=mmp151-output-$runId,dst=$output" -e "MMP151_WORK=$work" -e "MMP151_PRIVATE=$private" -e "MMP151_OUTPUT=$output" -e "MMP151_HEAD=$head" $image /bin/sh -c $program
  $result = $LASTEXITCODE
  New-Item -ItemType Directory -Force -Path $receipts | Out-Null
  if ($result -ne 0) {
    & docker cp "${container}:$private/age-tests.log" (Join-Path $receipts 'private-synthetic-tests.log') 2>$null
    & docker cp "${container}:$private/tools.log" (Join-Path $receipts 'private-tool-preparation.log') 2>$null
  }
  & docker cp "${container}:$output/summary.json" (Join-Path $receipts 'summary.json')
  if ($LASTEXITCODE -ne 0) { throw 'MMP151_SUMMARY_UNAVAILABLE' }
  Write-Output "MMP151_SUMMARY=$receipts/summary.json"
  if ($result -ne 0) { throw 'MMP151_OFFLINE_ACCEPTANCE_FAILED' }
} finally {
  if ($started) {
    $info = & docker container inspect $container 2>$null | ConvertFrom-Json
    if ($LASTEXITCODE -eq 0) {
      if ($info[0].Config.Labels.'metamorph.mmp151.run' -ne $runId) { throw 'MMP151_CONTAINER_OWNER_REJECTED' }
      Check-Docker -Arguments @('rm','--force',$container) | Out-Null
    }
  }
  foreach ($name in $createdVolumes) {
    Check-OwnedVolume $name | Out-Null
    Check-Docker -Arguments @('volume','rm',$name) | Out-Null
  }
  Pop-Location
}
exit $result
