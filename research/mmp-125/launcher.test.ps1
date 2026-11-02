# Stateful in-process Docker/Git/Node stubs. Never contact a real daemon.
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'Invoke-Diagnostic.ps1'
$root = Join-Path ([IO.Path]::GetTempPath()) ('mmp125-launcher-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $root | Out-Null
$global:mmp125test_head = 'a' * 40
$global:mmp125test_calls = [Collections.Generic.List[string]]::new()
$global:mmp125test_volumes = @{}
$global:mmp125test_foreign = $false
$global:mmp125test_wrongOwner = $false
$global:mmp125test_active = $false
$global:mmp125test_runId = ''
function global:git {
  param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Items)
  $global:LASTEXITCODE = 0
  if ($Items[0] -eq 'rev-parse') { return $global:mmp125test_head }
  if ($Items[0] -eq 'bundle') { [IO.File]::WriteAllText($Items[2],'STUB_ONLY') }
}
function global:node { $global:LASTEXITCODE=0 }
function global:docker {
  param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Items)
  $global:LASTEXITCODE = 0
  $global:mmp125test_calls.Add(($Items -join ' '))
  switch ($Items[0]) {
    'version' { return '{"Os":"linux","Arch":"amd64"}' }
    'image' { return '[{"Id":"sha256:45e21e7c564b016c68662f87e558840fb86844e9221f6ed1b1c4c298f0bd1a6f","Os":"linux","Architecture":"amd64"}]' }
    'container' { if ($global:mmp125test_foreign) { return 'mmp-reference-11111111-1111-1111-1111-111111111111' }; return }
    'volume' {
      switch ($Items[1]) {
        'ls' { if ($Items -contains '--quiet') { return }; return @($global:mmp125test_volumes.Keys) }
        'create' {
          $n=$Items[-1]; $label=$Items[3].Split('=')[1]; $global:mmp125test_volumes[$n]=$label; return $n
        }
        'inspect' {
          $n=$Items[2]; $owner=$global:mmp125test_volumes[$n]; if ($global:mmp125test_wrongOwner) { $owner='FOREIGN' }
          return (@(@{Labels=@{'metamorph.mmp125.run'=$owner};Mountpoint="/var/lib/docker/volumes/$n/_data"}) | ConvertTo-Json -AsArray -Compress)
        }
        'rm' { $global:mmp125test_volumes.Remove($Items[2]); return $Items[2] }
      }
    }
    'run' {
      $global:mmp125test_active=$true; $labelIndex=[array]::IndexOf($Items,'--label'); $global:mmp125test_runId=$Items[$labelIndex+1].Split('=')[1]
      return 'STUB_CONTAINER'
    }
    'inspect' {
      if ($Items -contains '--format') { return '{"Running":false,"ExitCode":0}' }
      return (@(@{Config=@{Labels=@{'metamorph.mmp125.run'=$global:mmp125test_runId}}}) | ConvertTo-Json -AsArray -Depth 6 -Compress)
    }
    'cp' {
      if ($Items[1].EndsWith('/ownership.json')) { $global:LASTEXITCODE=1; return }
      @{diagnosticId=$global:mmp125test_runId;headSha=$global:mmp125test_head;status='SYNTHETIC_ONLY'} | ConvertTo-Json | Set-Content -LiteralPath $Items[2]
      return
    }
    'rm' { $global:mmp125test_active=$false; return }
    default { throw 'UNEXPECTED_STUB_COMMAND' }
  }
}
function Check([bool]$Condition) { if (-not $Condition) { throw 'MMP125_LAUNCHER_CONTROL_FAILED' } }
try {
  $success = Join-Path $root 'success'
  & $launcher -ScratchRoot $success -AuthorizedHead $global:mmp125test_head | Out-Null
  $receipt = Get-Content -LiteralPath (Get-ChildItem -Path $success -Filter host-execution.json -Recurse).FullName -Raw | ConvertFrom-Json
  Check ($receipt.status -eq 'COMPLETED' -and $receipt.workerResourcesRemaining -eq 0 -and $receipt.hostEmergencyRemoved -eq 0)
  Check (-not $global:mmp125test_active -and $global:mmp125test_volumes.Count -eq 0)
  Check (@($global:mmp125test_calls | Where-Object { $_.StartsWith('run ') }).Count -eq 1)
  & $launcher -ScratchRoot $success -AuthorizedHead $global:mmp125test_head | Out-Null
  Check (@($global:mmp125test_calls | Where-Object { $_.StartsWith('run ') }).Count -eq 1)
  Write-Output 'PASS single launch, argument binding, owned cleanup and durable no-retry marker (stubs)'
  $global:mmp125test_calls.Clear(); $global:mmp125test_foreign=$true
  & $launcher -ScratchRoot (Join-Path $root 'foreign') -AuthorizedHead $global:mmp125test_head | Out-Null
  Check (@($global:mmp125test_calls | Where-Object { $_ -match '^(run|rm|volume create|volume rm) ' }).Count -eq 0)
  Write-Output 'PASS preexisting foreign worker refuses execution/removal (stubs)'
  $global:mmp125test_foreign=$false; $global:mmp125test_calls.Clear(); $global:mmp125test_wrongOwner=$true
  & $launcher -ScratchRoot (Join-Path $root 'wrong-owner') -AuthorizedHead $global:mmp125test_head | Out-Null
  Check (@($global:mmp125test_calls | Where-Object { $_ -match '^(run|rm|volume rm) ' }).Count -eq 0)
  Write-Output 'PASS mismatching volume owner refuses execution/removal (stubs)'
} finally {
  # Only the explicit test-owned absolute temp directory may be removed.
  $absolute = [IO.Path]::GetFullPath($root)
  $temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if (-not $absolute.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($absolute) -notmatch '^mmp125-launcher-test-[a-f0-9]{32}$') { throw 'TEST_CLEANUP_PATH_REJECTED' }
  Remove-Item -LiteralPath $absolute -Recurse -Force
  Remove-Item Function:git,Function:node,Function:docker
}
