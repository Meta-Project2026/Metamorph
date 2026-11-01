param([Parameter(Mandatory=$true)][string]$ScratchRoot)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$runId = [guid]::NewGuid().ToString('N')
$image = 'mmp115-offline-harness'
$container = "mmp115-harness-$runId"
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
  if ($LASTEXITCODE -ne 0) { throw 'MMP115_DOCKER_COMMAND_FAILED' }
  return $value
}
function Check-OwnedVolume {
  param([string]$Name)
  if ($Name -notmatch '^mmp115-(work|private|output)-[a-f0-9]{32}$') { throw 'MMP115_VOLUME_NAME_REJECTED' }
  $info = (Check-Docker -Arguments @('volume','inspect',$Name) | ConvertFrom-Json)[0]
  if ($info.Labels.'metamorph.mmp115.run' -ne $runId) { throw 'MMP115_VOLUME_OWNER_REJECTED' }
  if ($info.Mountpoint -ne "/var/lib/docker/volumes/$Name/_data") { throw 'MMP115_VOLUME_PATH_REJECTED' }
  return $info.Mountpoint
}
Push-Location -LiteralPath $repo
try {
  $head = (& git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $head -notmatch '^[a-f0-9]{40}$') { throw 'MMP115_HEAD_REJECTED' }
  if (& git status --porcelain=v1) { throw 'MMP115_REQUIRES_COMMITTED_CLEAN_TREE' }
  $foreign = @(Check-Docker -Arguments @('container','ls','--all','--format','{{.Names}}')) + @(Check-Docker -Arguments @('volume','ls','--format','{{.Name}}'))
  if ($foreign | Where-Object { $_ -match '^(mmp007-|mmp-reference-|mmp-inspector-|mmp008a-clock-)' }) { throw 'MMP115_FOREIGN_WORKER_RESOURCES_PRESENT' }
  & git bundle create $bundle HEAD
  if ($LASTEXITCODE -ne 0) { throw 'MMP115_SOURCE_BUNDLE_FAILED' }
  foreach ($kind in @('work','private','output')) {
    $name = "mmp115-$kind-$runId"
    & docker volume inspect $name 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { throw 'MMP115_PREEXISTING_VOLUME_REJECTED' }
    Check-Docker -Arguments @('volume','create','--label',"metamorph.mmp115.run=$runId",$name) | Out-Null
    $createdVolumes += $name
    Check-OwnedVolume $name | Out-Null
  }
  $work = Check-OwnedVolume "mmp115-work-$runId"
  $private = Check-OwnedVolume "mmp115-private-$runId"
  $output = Check-OwnedVolume "mmp115-output-$runId"
  $program = @'
set -eu
umask 077
test ! -e /usr/bin/docker && ln -s /usr/local/bin/docker /usr/bin/docker
mkdir -p "$MMP115_PRIVATE/tools" "$MMP115_OUTPUT"
(umask 022; git clone --quiet /task.bundle "$MMP115_WORK/repo")
cd "$MMP115_WORK/repo"
test "$(git rev-parse HEAD)" = "$MMP115_HEAD"
pnpm install --frozen-lockfile >"$MMP115_PRIVATE/install.log" 2>&1
pnpm build >"$MMP115_PRIVATE/build.log" 2>&1
RUNNER_TEMP="$MMP115_PRIVATE/tools" node research/mmp-089/install-age.mjs >"$MMP115_PRIVATE/tools.log" 2>&1
node research/mmp-115/run-offline.mjs
'@
  $started = $true
  & docker run --name $container --label "metamorph.mmp115.run=$runId" --cpus 2 --memory 1536m --pids-limit 256 --mount "type=bind,src=$bundle,dst=/task.bundle,readonly" --mount "type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock" --mount "type=volume,src=mmp115-work-$runId,dst=$work" --mount "type=volume,src=mmp115-private-$runId,dst=$private" --mount "type=volume,src=mmp115-output-$runId,dst=$output" -e "MMP115_WORK=$work" -e "MMP115_PRIVATE=$private" -e "MMP115_OUTPUT=$output" -e "MMP115_HEAD=$head" $image /bin/sh -c $program
  $result = $LASTEXITCODE
  New-Item -ItemType Directory -Force -Path $receipts | Out-Null
  & docker cp "${container}:$output/summary.json" (Join-Path $receipts 'summary.json')
  if ($LASTEXITCODE -ne 0) { throw 'MMP115_SUMMARY_UNAVAILABLE' }
  Write-Output "MMP115_SUMMARY=$receipts/summary.json"
  if ($result -ne 0) { throw 'MMP115_OFFLINE_ACCEPTANCE_FAILED' }
} finally {
  if ($started) {
    $info = & docker container inspect $container 2>$null | ConvertFrom-Json
    if ($LASTEXITCODE -eq 0) {
      if ($info[0].Config.Labels.'metamorph.mmp115.run' -ne $runId) { throw 'MMP115_CONTAINER_OWNER_REJECTED' }
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
