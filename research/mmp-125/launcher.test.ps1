# Original fake executables only. No Docker daemon, candidate or reference code.
param([string]$CaseRoot,[switch]$Child)
$ErrorActionPreference='Stop'
$corePath=Join-Path $PSScriptRoot 'launcher-core.psm1'
$fakePath=Join-Path $PSScriptRoot 'fake-docker.mjs'
$node=(Get-Command node -CommandType Application | Select-Object -First 1).Source
$pwsh=(Get-Process -Id $PID).Path
$canary='MMP125_PRIVATE_STDERR_SQL_PATH_CANARY'
if ($Child) {
  # Private module substitution exists only in this separate test entrypoint.
  # The production launcher has no CLI/env route to it. The sole child executable
  # returned here is node + this original fake fixture; never real Docker.
  $config=Get-Content -LiteralPath (Join-Path $CaseRoot 'config.json') -Raw | ConvertFrom-Json
  if ($config.kind -cne 'MMP125_SYNTHETIC_PROCESS_FIXTURE') { exit 98 }
  $module=Import-Module $corePath -Force -PassThru
  $code=& $module {
    param($Config,$Node,$Fake,$ConfigPath)
    $script:Fixture=@{Config=$Config;Node=$Node;Fake=$Fake;ConfigPath=$ConfigPath}
    function script:Get-DockerInvocation { return @{Executable=$script:Fixture.Node;Prefix=@($script:Fixture.Fake,$script:Fixture.ConfigPath)} }
    function script:Assert-Source { }
    function script:New-SourceBundle($Context) { [IO.File]::WriteAllText($Context.Bundle,'SYNTHETIC_ONLY') }
    function script:Get-LauncherLimits { return @{OverallMs=$script:Fixture.Config.overallMs;CommandMs=$script:Fixture.Config.commandMs;CleanupMs=$script:Fixture.Config.cleanupMs;CleanupCommandMs=$script:Fixture.Config.cleanupCommandMs;PollMs=10} }
    if ($Config.writeFailure) {
      function script:Write-ConsentBytes($Stream,[byte[]]$Bytes) { $Stream.Write($Bytes,0,3); throw [IO.IOException]::new('SYNTHETIC_WRITE_FAILURE') }
    }
    Invoke-DiagnosticCore -ScratchRoot (Join-Path $Config.root 'scratch') -AuthorizedHead ('a'*40)
  } $config $node $fakePath (Join-Path $CaseRoot 'config.json')
  exit $code
}
Import-Module $corePath -Force
$root=Join-Path ([IO.Path]::GetTempPath()) ('mmp125-launcher-test-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $root | Out-Null
$passed=0
function Check([bool]$Condition,[string]$Name) { if (-not $Condition) { throw "MMP125_CONTROL_FAILED_$Name" } }
function New-Case([string]$Name,[string]$Mode='success') {
  $path=Join-Path $root $Name
  New-Item -ItemType Directory -Path $path | Out-Null
  $config=@{kind='MMP125_SYNTHETIC_PROCESS_FIXTURE';root=$path;mode=$Mode;canary=$canary;overallMs=10000;commandMs=1500;cleanupMs=4000;cleanupCommandMs=1000;descendant=$false;writeFailure=$false}
  Save-Config $config
  return $config
}
function Save-Config($Config) { $Config | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Config.root 'config.json') -Encoding utf8NoBOM }
function Calls($Config) {
  $file=Join-Path $Config.root 'calls.jsonl'
  if (Test-Path -LiteralPath $file) { return @(Get-Content -LiteralPath $file | ForEach-Object { ,(ConvertFrom-Json $_ -NoEnumerate) }) }
  return @()
}
function Receipts($Config) { return @(Get-ChildItem -LiteralPath (Join-Path $Config.root 'scratch') -Filter host-execution.json -Recurse | ForEach-Object { Read-Receipt $_.FullName }) }
function Read-Receipt([string]$Path) {
  $json=[IO.File]::ReadAllText($Path)
  Check (-not $json.Contains($canary) -and -not $json.Contains($root)) 'NO_PUBLIC_CANARY_OR_PATH'
  return $json | ConvertFrom-Json
}
function Run-Case($Config) {
  $r=[Metamorph.Mmp125.BoundedProcess]::Run($pwsh,@('-NoProfile','-File',$PSCommandPath,'-Child','-CaseRoot',$Config.root),20000,65536)
  Check ($r.Category -ceq 'EXIT') 'CONTROLLER_BOUNDED'
  return $r
}
function Done([string]$Name) { $script:passed++; Write-Output "PASS $Name (fake processes only)" }
function Check-NoFakeProcesses($Config) {
  $pidFile=Join-Path $Config.root 'pids.jsonl'
  if (-not (Test-Path -LiteralPath $pidFile)) { return }
  foreach ($childId in (Get-Content -LiteralPath $pidFile | Select-Object -Unique)) {
    $watch=[Diagnostics.Stopwatch]::StartNew()
    while ((Get-Process -Id ([int]$childId) -ErrorAction SilentlyContinue) -and $watch.ElapsedMilliseconds -lt 2000) { Start-Sleep -Milliseconds 10 }
    Check ($null -eq (Get-Process -Id ([int]$childId) -ErrorAction SilentlyContinue)) 'NO_SURVIVING_FAKE_CHILD'
  }
}
try {
  $normal=New-Case 'success with spaces'
  $run=Run-Case $normal; $receipt=(Receipts $normal)[0]
  Check ($run.ExitCode -eq 0 -and $receipt.status -ceq 'COMPLETED' -and $receipt.cleanupStatus -ceq 'VERIFIED_ZERO_RESOURCES' -and $receipt.inventoryStatus -ceq 'COMPLETE' -and $receipt.workerResourcesRemaining -eq 0 -and $receipt.ownedResourcesRemaining -eq 0) 'SUCCESS'
  $state=Get-Content -LiteralPath (Join-Path $normal.root 'state.json') -Raw | ConvertFrom-Json
  Check ($null -eq $state.container -and @($state.volumes.PSObject.Properties).Count -eq 0) 'OWNED_CLEANUP'
  Done 'successful launch and exact owned cleanup with argument-array paths'

  $fail=New-Case 'missing then recovered' 'version-fail'
  Check ((Run-Case $fail).ExitCode -ne 0) 'FIRST_FAIL'
  $marker=Join-Path $fail.root 'scratch/diagnostic-consumed.json'
  $markerBytes=[IO.File]::ReadAllText($marker)
  $mark=$markerBytes | ConvertFrom-Json
  Check ($mark.status -ceq 'CONSUMED_NO_RETRY' -and $mark.headSha -ceq ('a'*40) -and $mark.diagnosticId -match '^[a-f0-9-]{36}$') 'DURABLE_MARKER'
  $n=@(Calls $fail).Count; $fail.mode='success'; Save-Config $fail
  Check ((Run-Case $fail).ExitCode -ne 0 -and @(Calls $fail).Count -eq $n -and [IO.File]::ReadAllText($marker) -ceq $markerBytes) 'NO_DOCKER_ON_SECOND'
  $receipts=Receipts $fail
  Check (@($receipts | Where-Object { $_.markerAcquired -and $_.inventoryStatus -ceq 'UNAVAILABLE' -and $null -eq $_.workerResourcesRemaining }).Count -eq 1) 'FAILED_INVENTORY_NOT_ZERO'
  Done 'failed daemon consumes consent; recovered daemon gets zero second-attempt calls'

  foreach ($kind in @('complete','partial','directory')) {
    $case=New-Case "existing $kind"
    New-Item -ItemType Directory -Path (Join-Path $case.root 'scratch') | Out-Null
    $path=Join-Path $case.root 'scratch/diagnostic-consumed.json'
    if ($kind -eq 'directory') { New-Item -ItemType Directory -Path $path | Out-Null }
    else { [IO.File]::WriteAllText($path, $(if($kind -eq 'partial'){'{"incomplete":'}else{'{"status":"CONSUMED_NO_RETRY"}'})) }
    Check ((Run-Case $case).ExitCode -ne 0 -and @(Calls $case).Count -eq 0) 'EXISTING_MARKER_NO_DOCKER'
    Check ((Receipts $case)[0].status -ceq 'ERROR_CONSENT_GUARD') 'GUARD_STATUS'
    Done "existing $kind marker fails closed without any Docker"
  }
  $write=New-Case 'partial failed write'; $write.writeFailure=$true; Save-Config $write
  Check ((Run-Case $write).ExitCode -ne 0 -and @(Calls $write).Count -eq 0) 'FAILED_WRITE_NO_DOCKER'
  $path=Join-Path $write.root 'scratch/diagnostic-consumed.json'; $bytes=[IO.File]::ReadAllBytes($path)
  Check ($bytes.Length -eq 3) 'PARTIAL_WRITE_PRESERVED'
  $write.writeFailure=$false; Save-Config $write
  Check ((Run-Case $write).ExitCode -ne 0 -and @(Calls $write).Count -eq 0 -and [IO.File]::ReadAllBytes($path).Length -eq 3) 'PARTIAL_NO_RETRY'
  Done 'failed marker write preserves partial guard and refuses recovered writer'

  $race=New-Case 'concurrent guard' 'version-fail'
  $controllers=@()
  for($i=0;$i -lt 2;$i++) {
    $p=[Diagnostics.Process]::new(); $p.StartInfo.FileName=$pwsh; $p.StartInfo.UseShellExecute=$false; $p.StartInfo.CreateNoWindow=$true; $p.StartInfo.RedirectStandardOutput=$true; $p.StartInfo.RedirectStandardError=$true
    foreach($arg in @('-NoProfile','-File',$PSCommandPath,'-Child','-CaseRoot',$race.root)) { $p.StartInfo.ArgumentList.Add($arg) }
    $p.Start() | Out-Null; $controllers+=,$p
  }
  foreach($p in $controllers) { if(-not $p.WaitForExit(20000)) { $p.Kill($true); throw 'CONCURRENT_CONTROLLER_TIMEOUT' }; Check ($p.ExitCode -ne 0) 'RACE_FAILS'; $p.Dispose() }
  $receipts=Receipts $race
  Check ($receipts.Count -eq 2 -and @($receipts | Where-Object markerAcquired).Count -eq 1) 'ONE_ACQUISITION'
  Check (@((Calls $race) | Where-Object { $_[0] -ceq 'version' }).Count -eq 1 -and @($receipts | Where-Object { -not $_.markerAcquired -and $_.dockerCommands -eq 0 }).Count -eq 1) 'LOSER_NO_DOCKER'
  Done 'two concurrent controller processes acquire at most one atomic marker'

  foreach($mode in @('hang-version','hang-image','hang-poll','hang-cleanup','hang-final')) {
    $case=New-Case $mode $mode
    $case.overallMs=3500; $case.commandMs=800; $case.cleanupMs=1800; $case.cleanupCommandMs=500
    if($mode -eq 'hang-poll') { $case.commandMs=12000; $case.overallMs=2200 }
    if($mode -eq 'hang-version') { $case.descendant=$true }
    Save-Config $case
    $clock=[Diagnostics.Stopwatch]::StartNew(); $r=Run-Case $case; $clock.Stop(); $receipt=(Receipts $case)[0]
    Check ($r.ExitCode -ne 0 -and $receipt.dockerTimeouts -ge 1 -and $clock.ElapsedMilliseconds -lt 12000) 'HUNG_CHILD_BOUNDED'
    Check (Test-Path -LiteralPath (Join-Path $case.root 'scratch/diagnostic-consumed.json')) 'HANG_MARKER_FIRST'
    if($mode -in @('hang-cleanup','hang-final')) { Check ($receipt.cleanupStatus -cne 'VERIFIED_ZERO_RESOURCES' -and $receipt.inventoryStatus -ceq 'UNAVAILABLE' -and $null -eq $receipt.workerResourcesRemaining) 'UNKNOWN_NOT_ZERO' }
    if($mode -eq 'hang-poll') { Check ($receipt.mainStatus -ceq 'ERROR_DOCKER_TIMEOUT' -and $receipt.elapsedSeconds -lt 8) 'GLOBAL_BEFORE_LONG_COMMAND_TIMEOUT' }
    if($mode -eq 'hang-version') { Check (@(Get-Content -LiteralPath (Join-Path $case.root 'pids.jsonl')).Count -ge 2) 'TREE_CHILD_WAS_STARTED' }
    Check-NoFakeProcesses $case
    Done "$mode kills real fake child; wall-clock and cleanup budgets hold"
  }
  foreach($mode in @('foreign-worker','wrong-volume-owner','foreign-outer-owner','stale-ledger','unknown-workers','unknown-inventory','output-limit')) {
    $case=New-Case $mode $mode
    $r=Run-Case $case; $receipt=(Receipts $case)[0]
    Check ($r.ExitCode -ne 0 -and $receipt.status -cne 'COMPLETED') 'FAIL_CLOSED'
    $calls=Calls $case
    Check (@($calls | Where-Object { ($_[0] -eq 'rm' -or ($_[0] -eq 'volume' -and $_[1] -eq 'rm')) -and (($_ -join ' ') -match '11111111-1111-1111-1111-111111111111|system prune') }).Count -eq 0) 'NO_FOREIGN_REMOVE'
    if($mode -in @('foreign-worker','wrong-volume-owner','foreign-outer-owner')) { Check (@($calls | Where-Object { $_[0] -eq 'rm' -or ($_[0] -eq 'volume' -and $_[1] -eq 'rm') }).Count -eq 0) 'NO_FOREIGN_OWNER_REMOVE' }
    Check-NoFakeProcesses $case
    Done "$mode refuses unsafe execution/cleanup and keeps receipts categorical"
  }
  $primitive=New-Case 'primitive args and cancellation'
  $prefix=@($fakePath,(Join-Path $primitive.root 'config.json'))
  $arguments=@('with spaces','quote"literal','$(no_shell); & newline' + "`n" + 'end')
  $r=[Metamorph.Mmp125.BoundedProcess]::Run($node,($prefix+@('echo')+$arguments),1000,65536)
  Check ($r.Category -ceq 'EXIT' -and $r.ExitCode -eq 0 -and (@($r.Stdout | ConvertFrom-Json) -join '|') -ceq ($arguments -join '|')) 'ARGUMENT_ARRAY'
  $cts=[Threading.CancellationTokenSource]::new(); $cts.CancelAfter(250)
  $r=[Metamorph.Mmp125.BoundedProcess]::Run($node,($prefix+@('hang')),3000,65536,$cts.Token); $cts.Dispose()
  Check ($r.Category -ceq 'CANCELLED' -and $r.KillRequested) 'CANCEL_KILLS_CHILD'
  Check-NoFakeProcesses $primitive
  Done 'literal argv and cancellation terminate actual child without shell parsing'
  Write-Output "MMP125_LAUNCHER_CONTROLS PASS=$passed FAIL=0 NO_REAL_DOCKER_RUN"
} finally {
  $absolute=[IO.Path]::GetFullPath($root); $temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if(-not $absolute.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($absolute) -notmatch '^mmp125-launcher-test-[a-f0-9]{32}$') { throw 'TEST_CLEANUP_PATH_REJECTED' }
  Remove-Item -LiteralPath $absolute -Recurse -Force
}
