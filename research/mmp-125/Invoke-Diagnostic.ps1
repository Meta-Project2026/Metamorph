# Manual, single-use launcher. Never called by CI. Consent is recorded in plan.
param(
  [Parameter(Mandatory=$true)][string]$ScratchRoot,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$AuthorizedHead
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$id = [guid]::NewGuid().ToString()
$run = $id.Replace('-','')
# Independently inspected cached MMP115 image, built from the unchanged pinned
# MMP108 Dockerfile. Invoke /bin/sh directly, never its old shell entrypoint.
$image = 'sha256:45e21e7c564b016c68662f87e558840fb86844e9221f6ed1b1c4c298f0bd1a6f'
$container = "mmp125-harness-$run"
$volumes = @()
$started = $false
$result = 1
$emergency = 0
$hostStatus = 'ERROR_SETUP'
$watch = [Diagnostics.Stopwatch]::new()
function Invoke-OwnedDocker {
  param([string[]]$Arguments)
  $value = & docker @Arguments 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'MMP125_DOCKER_COMMAND_FAILED' }
  return $value
}
function VolumePath([string]$Name) {
  if ($Name -notmatch '^mmp125-(work|private|output)-[a-f0-9]{32}$') { throw 'MMP125_VOLUME_NAME_REJECTED' }
  $info = (Invoke-OwnedDocker -Arguments @('volume','inspect',$Name) | ConvertFrom-Json)[0]
  if ($info.Labels.'metamorph.mmp125.run' -ne $id -or $info.Mountpoint -ne "/var/lib/docker/volumes/$Name/_data") { throw 'MMP125_VOLUME_OWNER_REJECTED' }
  return $info.Mountpoint
}
function Workers {
  return @(@(Invoke-OwnedDocker -Arguments @('container','ls','--all','--format','{{.Names}}')) + @(Invoke-OwnedDocker -Arguments @('volume','ls','--format','{{.Name}}')) | Where-Object { $_ -match '^(mmp007-|mmp-reference-|mmp-inspector-|mmp008a-clock-)' })
}
New-Item -ItemType Directory -Force -Path $ScratchRoot | Out-Null
$scratch = (Resolve-Path -LiteralPath $ScratchRoot).Path
$bundle = Join-Path $scratch "source-$run.bundle"
$receipts = Join-Path $scratch "receipts-$run"
New-Item -ItemType Directory -Path $receipts | Out-Null
Push-Location -LiteralPath $repo
try {
  $head = (& git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $head -ne $AuthorizedHead -or (& git status --porcelain=v1)) { throw 'MMP125_COMMITTED_HEAD_REJECTED' }
  & node research/mmp-125/audit.mjs >$null
  if ($LASTEXITCODE -ne 0) { throw 'MMP125_IMMUTABLE_AUDIT_FAILED' }
  $engine = Invoke-OwnedDocker -Arguments @('version','--format','{{json .Server}}') | ConvertFrom-Json
  if ($engine.Os -ne 'linux' -or $engine.Arch -ne 'amd64') { throw 'MMP125_DOCKER_PLATFORM_REJECTED' }
  $info = (Invoke-OwnedDocker -Arguments @('image','inspect',$image) | ConvertFrom-Json)[0]
  if ($info.Id -ne $image -or $info.Os -ne 'linux' -or $info.Architecture -ne 'amd64') { throw 'MMP125_HARNESS_IMAGE_REJECTED' }
  if (@(Workers).Count -ne 0) { throw 'MMP125_FOREIGN_WORKERS_PRESENT' }
  # Fail closed on any second invocation using this consent's scratch root.
  $marker = Join-Path $scratch 'diagnostic-consumed.json'
  $stream = [IO.File]::Open($marker,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes((@{ diagnosticId=$id; headSha=$head; candidateSha='0cf5ba0bb22fd1d335b3d061b0a9b258d7ac660f3038e1e651ddaad1262d03c1'; authorization='USER_ONE_RUN_2026_11_02'; status='CONSUMED_NO_RETRY' } | ConvertTo-Json))
    $stream.Write($bytes,0,$bytes.Length)
    $stream.Flush($true)
  } finally { $stream.Dispose() }
  & git bundle create $bundle HEAD 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'MMP125_BUNDLE_FAILED' }
  foreach ($kind in @('work','private','output')) {
    $name = "mmp125-$kind-$run"
    if (Invoke-OwnedDocker -Arguments @('volume','ls','--quiet','--filter',"name=^$name$")) { throw 'MMP125_PREEXISTING_VOLUME' }
    Invoke-OwnedDocker -Arguments @('volume','create','--label',"metamorph.mmp125.run=$id",$name) | Out-Null
    $volumes += $name
    VolumePath $name | Out-Null
  }
  $work = VolumePath "mmp125-work-$run"
  $private = VolumePath "mmp125-private-$run"
  $output = VolumePath "mmp125-output-$run"
  $program = @'
set -eu
umask 077
if [ ! -e /usr/bin/docker ]; then ln -s /usr/local/bin/docker /usr/bin/docker; fi
mkdir -p "$MMP125_PRIVATE/home" "$MMP125_OUTPUT"
(umask 022; git clone --quiet /task.bundle "$MMP125_WORK/repo") 2>"$MMP125_PRIVATE/clone.log"
cd "$MMP125_WORK/repo"
test "$(git rev-parse HEAD)" = "$MMP125_HEAD"
timeout --signal=KILL 180 /bin/sh -c 'pnpm install --frozen-lockfile && pnpm build' >"$MMP125_PRIVATE/setup.log" 2>&1
node research/mmp-125/diagnostic.mjs
'@
  $program = $program.Replace("`r`n","`n")
  $watch.Start()
  $started = $true
  Invoke-OwnedDocker -Arguments @('run','--detach','--name',$container,'--label',"metamorph.mmp125.run=$id",'--cpus','2','--memory','4g','--pids-limit','512',
    '--mount',"type=bind,src=$bundle,dst=/task.bundle,readonly",'--mount','type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock',
    '--mount',"type=volume,src=mmp125-work-$run,dst=$work",'--mount',"type=volume,src=mmp125-private-$run,dst=$private",'--mount',"type=volume,src=mmp125-output-$run,dst=$output",
    '-e',"MMP125_WORK=$work",'-e',"MMP125_PRIVATE=$private",'-e',"MMP125_OUTPUT=$output",'-e',"MMP125_HEAD=$head",'-e',"MMP125_ID=$id",$image,'/bin/sh','-c',$program) | Out-Null
  Write-Output "MMP125_STARTED diagnosticId=$id head=$head deadlineSeconds=1200"
  do {
    $state = Invoke-OwnedDocker -Arguments @('inspect','--format','{{json .State}}',$container) | ConvertFrom-Json
    if (-not $state.Running) { break }
    if ($watch.Elapsed.TotalSeconds -ge 1200) { $hostStatus='ERROR_DEADLINE'; throw 'MMP125_DEADLINE' }
    Start-Sleep -Seconds 2
  } while ($true)
  $result = [int]$state.ExitCode
  & docker cp "${container}:$output/diagnostic.json" (Join-Path $receipts 'diagnostic.json') 2>$null
  if ($LASTEXITCODE -ne 0) { $hostStatus='ERROR_DIAGNOSTIC_UNAVAILABLE'; $result=1 }
  else {
    $record = Get-Content -LiteralPath (Join-Path $receipts 'diagnostic.json') -Raw | ConvertFrom-Json
    if ($record.diagnosticId -ne $id -or $record.headSha -ne $head) { throw 'MMP125_OUTPUT_IDENTITY_REJECTED' }
    $hostStatus = if ($result -eq 0) { 'COMPLETED' } else { 'ERROR_DIAGNOSTIC' }
  }
} catch {
  # Fixed category only. Do not print raw tool errors, private paths or logs.
  $result = 1
  Write-Output 'MMP125_LAUNCHER_ERROR_NO_RETRY'
} finally {
  try {
    if ($started) {
      # Trusted host sidecar only; no raw candidate/private evidence is copied.
      $ownershipFile = Join-Path $scratch "private-ownership-$run.json"
      $hasOwnership = $false
      $outerJson = & docker inspect $container 2>$null
      if ($LASTEXITCODE -eq 0) {
        $owned = ($outerJson | ConvertFrom-Json)[0]
        if ($owned.Config.Labels.'metamorph.mmp125.run' -ne $id) { throw 'MMP125_OUTER_OWNER_REJECTED' }
        & docker cp "${container}:$private/ownership.json" $ownershipFile 2>$null
        $hasOwnership = $LASTEXITCODE -eq 0
        Invoke-OwnedDocker -Arguments @('rm','--force',$container) | Out-Null
      }
      if (@(Workers).Count -ne 0 -and $hasOwnership) {
        $ledger = Get-Content -LiteralPath $ownershipFile -Raw | ConvertFrom-Json
        if ($ledger.format -ne 'mmp125-private-ownership-v1' -or $ledger.diagnosticId -ne $id) { throw 'MMP125_LEDGER_REJECTED' }
        foreach ($n in $ledger.containers) { if ($n -notmatch '^(mmp-reference-|mmp-inspector-|mmp008a-clock-)[a-f0-9-]{36}$') { throw 'MMP125_LEDGER_REJECTED' } }
        foreach ($n in $ledger.volumes) { if ($n -notmatch '^mmp-reference-state-[a-f0-9-]{36}$') { throw 'MMP125_LEDGER_REJECTED' } }
        foreach ($n in $ledger.prefixes) { if ($n -notmatch '^mmp007-[a-f0-9-]{36}-$') { throw 'MMP125_LEDGER_REJECTED' } }
        $existingContainers = @(Invoke-OwnedDocker -Arguments @('container','ls','--all','--format','{{.Names}}'))
        $existingVolumes = @(Invoke-OwnedDocker -Arguments @('volume','ls','--format','{{.Name}}'))
        foreach ($n in $existingContainers) {
          $match = $ledger.containers -contains $n
          foreach ($prefix in $ledger.prefixes) { if ($n.StartsWith($prefix,[StringComparison]::Ordinal)) { $match=$true } }
          if ($match) { Invoke-OwnedDocker -Arguments @('rm','--force',$n) | Out-Null; $emergency++ }
        }
        foreach ($n in $existingVolumes) {
          $match = $ledger.volumes -contains $n
          foreach ($prefix in $ledger.prefixes) { if ($n.StartsWith($prefix,[StringComparison]::Ordinal)) { $match=$true } }
          if ($match) { Invoke-OwnedDocker -Arguments @('volume','rm',$n) | Out-Null; $emergency++ }
        }
      }
    }
    foreach ($name in $volumes) {
      VolumePath $name | Out-Null
      Invoke-OwnedDocker -Arguments @('volume','rm',$name) | Out-Null
    }
    $remaining = @(Workers).Count
    if ($remaining -ne 0 -or $emergency -ne 0) { $hostStatus='ERROR_CLEANUP'; $result=1 }
  } catch { $remaining=$null; $hostStatus='ERROR_CLEANUP'; $result=1 }
  $watch.Stop()
  @{ format='mmp125-host-execution-v1'; diagnosticId=$id; headSha=$AuthorizedHead; status=$hostStatus; exitCode=$result; elapsedSeconds=[math]::Ceiling($watch.Elapsed.TotalSeconds); deadlineSeconds=1200; outerMemoryMiB=4096; outerPids=512; workerResourcesRemaining=$remaining; hostEmergencyRemoved=$emergency; launchAttempts=[int]$started; models=0; repairs=0; artifactUploads=0 } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $receipts 'host-execution.json') -Encoding utf8NoBOM
  Pop-Location
  Write-Output "MMP125_FINISHED status=$hostStatus exit=$result receiptDirectory=$receipts"
}
exit $result
