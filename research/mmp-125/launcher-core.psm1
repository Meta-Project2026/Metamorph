# Trusted manual launcher core. Private function substitution is used ONLY by the
# isolated test harness; production exposes no executable/budget/env test switch.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not ('Metamorph.Mmp125.BoundedProcess' -as [type])) {
  Add-Type -Path (Join-Path $PSScriptRoot 'BoundedProcess.cs')
}
function Get-LauncherLimits {
  return @{ OverallMs=1200000; CommandMs=15000; CleanupMs=60000; CleanupCommandMs=5000; PollMs=2000 }
}
function Fail([string]$Code) {
  $failure = [InvalidOperationException]::new('MMP125_LAUNCHER_REJECTED')
  $failure.Data['Mmp125Code'] = $Code
  throw $failure
}
function Get-FailureCode($Failure, [string]$Fallback) {
  $code = $Failure.Exception.Data['Mmp125Code']
  if ($code -is [string] -and $code -cmatch '^ERROR_[A-Z_]+$') { return $code }
  return $Fallback
}
function Get-DockerInvocation {
  # Resolve an application, never a function/alias/shell command. Fixed name;
  # no production CLI/env parameter can substitute an executable or prefix.
  return @{ Executable=(Get-Command docker -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source; Prefix=@() }
}
function Remaining-Ms($Context) {
  $watch = if ($Context.InCleanup) { $Context.CleanupWatch } else { $Context.Watch }
  $limit = if ($Context.InCleanup) { $Context.Limits.CleanupMs } else { $Context.Limits.OverallMs }
  return [math]::Max(0, [math]::Floor($limit - $watch.Elapsed.TotalMilliseconds))
}
function Invoke-Bounded($Context, [string]$Executable, [string[]]$Arguments) {
  $remaining = Remaining-Ms $Context
  if ($remaining -lt 1) { Fail 'ERROR_DEADLINE' }
  $perCall = if ($Context.InCleanup) { $Context.Limits.CleanupCommandMs } else { $Context.Limits.CommandMs }
  $timeout = [int][math]::Min($remaining,$perCall)
  return [Metamorph.Mmp125.BoundedProcess]::Run($Executable,$Arguments,$timeout,65536)
}
function Invoke-OwnedDocker {
  param($Context,[string[]]$Arguments,[switch]$AcceptNonzero)
  # The only host Docker process call site. All setup/poll/copy/cleanup/inventory
  # operations share the same wall-clock budget and bounded process supervision.
  $Context.DockerCalls++
  $r = Invoke-Bounded $Context $Context.Docker.Executable (@($Context.Docker.Prefix) + $Arguments)
  switch ($r.Category) {
    'TIMEOUT' { $Context.Timeouts++; Fail 'ERROR_DOCKER_TIMEOUT' }
    'CANCELLED' { Fail 'ERROR_DOCKER_CANCELLED' }
    'OUTPUT_LIMIT' { Fail 'ERROR_DOCKER_OUTPUT_LIMIT' }
    'EXIT' {
      if ($r.ExitCode -ne 0 -and -not $AcceptNonzero) { Fail 'ERROR_DOCKER_EXIT_NONZERO' }
      return $r
    }
    default { Fail 'ERROR_DOCKER_UNAVAILABLE' }
  }
}
function Assert-Source($Context) {
  $git = (Get-Command git -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
  $node = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
  $h = Invoke-Bounded $Context $git @('rev-parse','HEAD')
  $s = Invoke-Bounded $Context $git @('status','--porcelain=v1')
  if ($h.Category -ne 'EXIT' -or $h.ExitCode -ne 0 -or $h.Stdout.Trim() -cne $Context.Head -or $s.Category -ne 'EXIT' -or $s.ExitCode -ne 0 -or $s.Stdout.Length -ne 0) { Fail 'ERROR_SOURCE_HEAD' }
  $a = Invoke-Bounded $Context $node @('research/mmp-125/audit.mjs')
  if ($a.Category -ne 'EXIT' -or $a.ExitCode -ne 0) { Fail 'ERROR_IMMUTABLE_AUDIT' }
}
function New-SourceBundle($Context) {
  $git = (Get-Command git -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
  $r = Invoke-Bounded $Context $git @('bundle','create',$Context.Bundle,'HEAD')
  if ($r.Category -ne 'EXIT' -or $r.ExitCode -ne 0) { Fail 'ERROR_SOURCE_BUNDLE' }
}
function Write-ConsentBytes($Stream,[byte[]]$Bytes) {
  $Stream.Write($Bytes,0,$Bytes.Length)
  $Stream.Flush($true)
}
function Consume-Consent($Context) {
  try {
    $marker = Join-Path $Context.Scratch 'diagnostic-consumed.json'
    $stream = [IO.File]::Open($marker,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try {
      $bytes = [Text.Encoding]::UTF8.GetBytes((@{ diagnosticId=$Context.Id; headSha=$Context.Head; candidateSha='0cf5ba0bb22fd1d335b3d061b0a9b258d7ac660f3038e1e651ddaad1262d03c1'; authorization='USER_ONE_RUN_2026_11_02'; status='CONSUMED_NO_RETRY' } | ConvertTo-Json))
      Write-ConsentBytes $stream $bytes
    } finally { $stream.Dispose() }
    $Context.MarkerAcquired = $true
  } catch { Fail 'ERROR_CONSENT_GUARD' }
}
function Get-Names($Context,[string]$Kind) {
  $args = if ($Kind -eq 'container') { @('container','ls','--all','--format','{{.Names}}') } else { @('volume','ls','--format','{{.Name}}') }
  $r = Invoke-OwnedDocker -Context $Context -Arguments $args
  $names = @($r.Stdout -split '\r?\n' | Where-Object { $_.Length -ne 0 })
  foreach ($n in $names) { if ($n -cnotmatch '^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,255}$') { Fail 'ERROR_INVENTORY' } }
  if (@($names | Select-Object -Unique).Count -ne $names.Count) { Fail 'ERROR_INVENTORY' }
  return $names
}
function Get-Inventory($Context) {
  # Do not publish one successful half if the other command fails or truncates.
  $containers = @(Get-Names $Context 'container')
  $volumes = @(Get-Names $Context 'volume')
  return @{ Containers=$containers; Volumes=$volumes; Workers=@(@($containers)+@($volumes) | Where-Object { $_ -cmatch '^(mmp007-|mmp-reference-|mmp-inspector-|mmp008a-clock-)' }) }
}
function Volume-Path($Context,[string]$Name) {
  if ($Context.Volumes -cnotcontains $Name) { Fail 'ERROR_VOLUME_NAME' }
  $r = Invoke-OwnedDocker -Context $Context -Arguments @('volume','inspect',$Name)
  $items = @($r.Stdout | ConvertFrom-Json)
  if ($items.Count -ne 1 -or $items[0].Labels.'metamorph.mmp125.run' -cne $Context.Id -or $items[0].Mountpoint -cne "/var/lib/docker/volumes/$Name/_data") { Fail 'ERROR_VOLUME_OWNER' }
  return $items[0].Mountpoint
}
function Read-BoundedJson([string]$Path) {
  $file = Get-Item -LiteralPath $Path -Force
  if ($file.PSIsContainer -or $file.LinkType -or $file.Length -gt 65536) { Fail 'ERROR_RECEIPT' }
  return [IO.File]::ReadAllText($file.FullName) | ConvertFrom-Json
}
function Start-Diagnostic($Context) {
  $engine = (Invoke-OwnedDocker -Context $Context -Arguments @('version','--format','{{json .Server}}')).Stdout | ConvertFrom-Json
  if ($engine.Os -cne 'linux' -or $engine.Arch -cne 'amd64') { Fail 'ERROR_DOCKER_PLATFORM' }
  $images = @((Invoke-OwnedDocker -Context $Context -Arguments @('image','inspect',$Context.Image)).Stdout | ConvertFrom-Json)
  if ($images.Count -ne 1 -or $images[0].Id -cne $Context.Image -or $images[0].Os -cne 'linux' -or $images[0].Architecture -cne 'amd64') { Fail 'ERROR_HARNESS_IMAGE' }
  if ((Get-Inventory $Context).Workers.Count -ne 0) { Fail 'ERROR_FOREIGN_WORKERS' }
  New-SourceBundle $Context
  foreach ($kind in @('work','private','output')) {
    $name = "mmp125-$kind-$($Context.Run)"
    $existing = Invoke-OwnedDocker -Context $Context -Arguments @('volume','ls','--quiet','--filter',"name=^$name$")
    if ($existing.Stdout.Length -ne 0) { Fail 'ERROR_PREEXISTING_VOLUME' }
    # Track a creation attempt before the call, whose timeout may hide success.
    $Context.Volumes.Add($name)
    Invoke-OwnedDocker -Context $Context -Arguments @('volume','create','--label',"metamorph.mmp125.run=$($Context.Id)",$name) | Out-Null
    Volume-Path $Context $name | Out-Null
  }
  $work = Volume-Path $Context "mmp125-work-$($Context.Run)"
  $Context.Private = Volume-Path $Context "mmp125-private-$($Context.Run)"
  $output = Volume-Path $Context "mmp125-output-$($Context.Run)"
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
  $Context.Started = $true
  Invoke-OwnedDocker -Context $Context -Arguments @('run','--detach','--name',$Context.Container,'--label',"metamorph.mmp125.run=$($Context.Id)",'--cpus','2','--memory','4g','--pids-limit','512',
    '--mount',"type=bind,src=$($Context.Bundle),dst=/task.bundle,readonly",'--mount','type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock',
    '--mount',"type=volume,src=mmp125-work-$($Context.Run),dst=$work",'--mount',"type=volume,src=mmp125-private-$($Context.Run),dst=$($Context.Private)",'--mount',"type=volume,src=mmp125-output-$($Context.Run),dst=$output",
    '-e',"MMP125_WORK=$work",'-e',"MMP125_PRIVATE=$($Context.Private)",'-e',"MMP125_OUTPUT=$output",'-e',"MMP125_HEAD=$($Context.Head)",'-e',"MMP125_ID=$($Context.Id)",$Context.Image,'/bin/sh','-c',$program) | Out-Null
  do {
    $state = (Invoke-OwnedDocker -Context $Context -Arguments @('inspect','--format','{{json .State}}',$Context.Container)).Stdout | ConvertFrom-Json
    if ($state.Running -isnot [bool]) { Fail 'ERROR_INVENTORY' }
    if (-not $state.Running) { break }
    $remaining = Remaining-Ms $Context
    if ($remaining -lt 1) { Fail 'ERROR_DEADLINE' }
    Start-Sleep -Milliseconds ([int][math]::Min($Context.Limits.PollMs,$remaining))
  } while ($true)
  if ($state.ExitCode -isnot [long] -and $state.ExitCode -isnot [int]) { Fail 'ERROR_DIAGNOSTIC' }
  $copy = Invoke-OwnedDocker -Context $Context -Arguments @('cp',"$($Context.Container):$output/diagnostic.json",(Join-Path $Context.Receipts 'diagnostic.json')) -AcceptNonzero
  if ($copy.ExitCode -ne 0) { Fail 'ERROR_DIAGNOSTIC_UNAVAILABLE' }
  $record = Read-BoundedJson (Join-Path $Context.Receipts 'diagnostic.json')
  if ($record.diagnosticId -cne $Context.Id -or $record.headSha -cne $Context.Head) { Fail 'ERROR_RECEIPT_IDENTITY' }
  if ($state.ExitCode -ne 0) { Fail 'ERROR_DIAGNOSTIC' }
}
function Remove-OwnedResources($Context) {
  $before = Get-Inventory $Context
  $ownership = $null
  if ($before.Containers -ccontains $Context.Container) {
    $items = @((Invoke-OwnedDocker -Context $Context -Arguments @('inspect',$Context.Container)).Stdout | ConvertFrom-Json)
    if ($items.Count -ne 1 -or $items[0].Config.Labels.'metamorph.mmp125.run' -cne $Context.Id) { Fail 'ERROR_OUTER_OWNER' }
    if ($Context.Started -and $before.Workers.Count -ne 0) {
      $path = Join-Path $Context.Scratch "private-ownership-$($Context.Run).json"
      $cp = Invoke-OwnedDocker -Context $Context -Arguments @('cp',"$($Context.Container):$($Context.Private)/ownership.json",$path) -AcceptNonzero
      if ($cp.ExitCode -eq 0) { $ownership = Read-BoundedJson $path }
    }
    Invoke-OwnedDocker -Context $Context -Arguments @('rm','--force',$Context.Container) | Out-Null
  }
  if ($null -ne $ownership) {
    if ($ownership.format -cne 'mmp125-private-ownership-v1' -or $ownership.diagnosticId -cne $Context.Id) { Fail 'ERROR_LEDGER' }
    foreach ($list in @('containers','volumes','prefixes')) {
      if ($ownership.$list -isnot [array] -or $ownership.$list.Count -gt 128) { Fail 'ERROR_LEDGER' }
    }
    foreach ($n in $ownership.containers) { if ($n -isnot [string] -or $n -cnotmatch '^(mmp-reference-|mmp-inspector-|mmp008a-clock-)[a-f0-9-]{36}$') { Fail 'ERROR_LEDGER' } }
    foreach ($n in $ownership.volumes) { if ($n -isnot [string] -or $n -cnotmatch '^mmp-reference-state-[a-f0-9-]{36}$') { Fail 'ERROR_LEDGER' } }
    foreach ($n in $ownership.prefixes) { if ($n -isnot [string] -or $n -cnotmatch '^mmp007-[a-f0-9-]{36}-$') { Fail 'ERROR_LEDGER' } }
    foreach ($kind in @('container','volume')) {
      $names = if ($kind -eq 'container') { $before.Containers } else { $before.Volumes }
      $exact = if ($kind -eq 'container') { $ownership.containers } else { $ownership.volumes }
      foreach ($n in $names) {
        $match = $exact -ccontains $n
        foreach ($prefix in $ownership.prefixes) { if ($n.StartsWith($prefix,[StringComparison]::Ordinal)) { $match=$true } }
        if ($match) {
          $arguments = if ($kind -eq 'container') { @('rm','--force',$n) } else { @('volume','rm',$n) }
          Invoke-OwnedDocker -Context $Context -Arguments $arguments | Out-Null
          $Context.Emergency++
        }
      }
    }
  }
  foreach ($name in $Context.Volumes) {
    if ($before.Volumes -ccontains $name) {
      Volume-Path $Context $name | Out-Null
      Invoke-OwnedDocker -Context $Context -Arguments @('volume','rm',$name) | Out-Null
    }
  }
  $after = Get-Inventory $Context
  $Context.WorkersRemaining = $after.Workers.Count
  $Context.OwnedRemaining = @($after.Containers | Where-Object { $_ -ceq $Context.Container }).Count + @($after.Volumes | Where-Object { $Context.Volumes -ccontains $_ }).Count
  $Context.InventoryStatus = 'COMPLETE'
  if ($Context.WorkersRemaining -ne 0 -or $Context.OwnedRemaining -ne 0 -or $Context.Emergency -ne 0) { Fail 'ERROR_CLEANUP' }
}
function Invoke-DiagnosticCore {
  param([Parameter(Mandatory=$true)][string]$ScratchRoot,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$AuthorizedHead)
  $limits = Get-LauncherLimits
  $id = [guid]::NewGuid().ToString(); $run=$id.Replace('-','')
  $c = @{ Head=$AuthorizedHead; Id=$id; Run=$run; Image='sha256:45e21e7c564b016c68662f87e558840fb86844e9221f6ed1b1c4c298f0bd1a6f'; Container="mmp125-harness-$run"; Volumes=[Collections.Generic.List[string]]::new(); Started=$false; Private=''; MarkerAcquired=$false; Docker=$null; DockerCalls=0; Timeouts=0; Emergency=0; WorkersRemaining=$null; OwnedRemaining=$null; InventoryStatus='NOT_RUN'; InCleanup=$false; Limits=$limits; Watch=[Diagnostics.Stopwatch]::StartNew(); CleanupWatch=[Diagnostics.Stopwatch]::new() }
  New-Item -ItemType Directory -Force -Path $ScratchRoot | Out-Null
  $c.Scratch = (Resolve-Path -LiteralPath $ScratchRoot).Path
  $c.Bundle = Join-Path $c.Scratch "source-$run.bundle"
  $c.Receipts = Join-Path $c.Scratch "receipts-$run"
  New-Item -ItemType Directory -Path $c.Receipts | Out-Null
  $status='ERROR_SETUP'; $mainStatus='ERROR_SETUP'; $cleanupStatus='NOT_RUN'; $result=1
  Push-Location -LiteralPath (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
  try {
    Assert-Source $c
    # Atomic CreateNew + Flush(true), BEFORE resolving/invoking any Docker CLI.
    # Never read, overwrite, remove or trust the contents of an existing marker.
    Consume-Consent $c
    $c.Docker = Get-DockerInvocation
    Start-Diagnostic $c
    $mainStatus='COMPLETED'; $status='COMPLETED'; $result=0
  } catch { $mainStatus=Get-FailureCode $_ 'ERROR_SETUP'; $status=$mainStatus; $result=1 }
  finally {
    $executionElapsedMs=$c.Watch.Elapsed.TotalMilliseconds
    if ($c.MarkerAcquired -and $null -ne $c.Docker) {
      $c.InCleanup=$true; $c.CleanupWatch.Start(); $c.InventoryStatus='UNAVAILABLE'
      try { Remove-OwnedResources $c; $cleanupStatus='VERIFIED_ZERO_RESOURCES' }
      catch { $cleanupStatus=Get-FailureCode $_ 'ERROR_CLEANUP'; $status='ERROR_CLEANUP'; $result=1 }
      $c.CleanupWatch.Stop()
    }
    $c.Watch.Stop()
    $receipt = @{ format='mmp125-host-execution-v2'; diagnosticId=$id; headSha=$AuthorizedHead; status=$status; mainStatus=$mainStatus; exitCode=$result; markerAcquired=$c.MarkerAcquired; elapsedSeconds=[math]::Ceiling($c.Watch.Elapsed.TotalSeconds); executionElapsedSeconds=($executionElapsedMs/1000); deadlineSeconds=($limits.OverallMs/1000); cleanupBudgetSeconds=($limits.CleanupMs/1000); cleanupElapsedSeconds=($c.CleanupWatch.Elapsed.TotalMilliseconds/1000); cleanupStatus=$cleanupStatus; inventoryStatus=$c.InventoryStatus; workerResourcesRemaining=$c.WorkersRemaining; ownedResourcesRemaining=$c.OwnedRemaining; hostEmergencyRemoved=$c.Emergency; launchAttempts=[int]$c.Started; dockerCommands=$c.DockerCalls; dockerTimeouts=$c.Timeouts; outerMemoryMiB=4096; outerPids=512; models=0; repairs=0; artifactUploads=0 }
    $receipt | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $c.Receipts 'host-execution.json') -Encoding utf8NoBOM
    Pop-Location
    Write-Host "MMP125_FINISHED status=$status exit=$result"
  }
  return $result
}
Export-ModuleMember -Function Invoke-DiagnosticCore
