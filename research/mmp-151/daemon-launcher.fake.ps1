param([string]$Launcher, [string]$State, [string]$Scratch)
# SYNTHETIC_UNIT_ONLY. No real docker/git process is invoked. The launcher and
# unchanged JavaScript finalizers execute; only the OS/Docker transport is fake.
$ErrorActionPreference = 'Stop'
$global:MMP151FakeModel = @{ containers = @{}; volumes = @{}; calls = @() }
function Save-Model { $global:MMP151FakeModel | ConvertTo-Json -Depth 40 -Compress | Set-Content -LiteralPath $State }
function global:git {
  $global:LASTEXITCODE = 0
  if ($args[0] -eq 'rev-parse') { return ('a' * 40) }
  if ($args[0] -eq 'status') { return }
  if ($args[0] -eq 'bundle') { Set-Content -LiteralPath $args[2] -Value 'SYNTHETIC_BUNDLE'; return }
  throw 'UNEXPECTED_SYNTHETIC_GIT'
}
function global:docker {
  $a = @($args | ForEach-Object { [string]$_ })
  $global:LASTEXITCODE = 0
  $global:MMP151FakeModel.calls += ,$a
  Save-Model
  if ($a[0] -eq 'info') { return (@{ ID = 'host-daemon-id'; DockerRootDir = '/var/lib/docker'; Labels = @() } | ConvertTo-Json -Compress) }
  if ($a[0] -eq 'volume' -and $a[1] -eq 'ls') { return }
  if ($a[0] -eq 'container' -and $a[1] -eq 'ls') { return }
  if ($a[0] -eq 'volume' -and $a[1] -eq 'create') {
    $name = $a[-1]
    $run = $a[$a.IndexOf('--label') + 1].Split('=')[1]
    $global:MMP151FakeModel.volumes[$name] = @{ Name = $name; Driver = 'local'; Labels = @{ 'metamorph.mmp151.run' = $run }; Mountpoint = "/var/lib/docker/volumes/$name/_data"; Options = $null }
    Save-Model
    return $name
  }
  if ($a[0] -eq 'volume' -and $a[1] -eq 'inspect') { return (ConvertTo-Json -InputObject @($global:MMP151FakeModel.volumes[$a[2]]) -Depth 20 -Compress) }
  if ($a[0] -eq 'volume' -and $a[1] -eq 'rm') { $global:MMP151FakeModel.volumes.Remove($a[-1]); Save-Model; return $a[-1] }
  if ($a[0] -in @('run','create')) {
    $name = $a[$a.IndexOf('--name') + 1]
    $run = $a[$a.IndexOf('--label') + 1].Split('=')[1]
    $id = if ($name -like 'mmp151-daemon-*') { 'd' * 64 } else { 'c' * 64 }
    $mounts = @()
    for ($i = 0; $i -lt $a.Length; $i++) {
      if ($a[$i] -eq '--mount') {
        $parts = @{}; foreach ($part in $a[$i + 1].Split(',')) { $pair = $part.Split('=',2); if ($pair.Length -eq 2) { $parts[$pair[0]] = $pair[1] } }
        $mounts += @{ Type = $parts.type; Name = $parts.src; Source = $parts.src; Destination = $parts.dst; RW = -not $a[$i + 1].Contains('readonly') }
      }
    }
    $global:MMP151FakeModel.containers[$id] = @{ Id = $id; Name = "/$name"; Config = @{ Labels = @{ 'metamorph.mmp151.run' = $run } }; Mounts = $mounts; Args = $a }
    Save-Model
    if ($a[0] -eq 'create' -or $name -like 'mmp151-daemon-*') { return $id }
    Invoke-Control $global:MMP151FakeModel.containers[$id]
    return
  }
  if ($a[0] -eq 'start') {
    $id = $a[-1]
    if ($global:MMP151FakeModel.containers[$id].Name -like '/mmp151-harness-*') { Invoke-Control $global:MMP151FakeModel.containers[$id] }
    return $id
  }
  if ($a[0] -eq 'exec') {
    $id = $a[1]
    $run = $global:MMP151FakeModel.containers[$id].Config.Labels.'metamorph.mmp151.run'
    return (@{ ID = 'dedicated-daemon-id'; DockerRootDir = '/var/lib/docker'; Labels = @("metamorph.mmp151.run=$run") } | ConvertTo-Json -Compress)
  }
  if ($a[0] -eq 'container' -and $a[1] -eq 'inspect') {
    $entry = $global:MMP151FakeModel.containers[$a[2]]
    if (-not $entry) { $entry = @($global:MMP151FakeModel.containers.Values | Where-Object { $_.Name -eq "/$($a[2])" })[0] }
    return (ConvertTo-Json -InputObject @($entry) -Depth 20 -Compress)
  }
  if ($a[0] -eq 'rm') {
    $key = $a[-1]
    if (-not $global:MMP151FakeModel.containers.ContainsKey($key)) { $key = @($global:MMP151FakeModel.containers.Keys | Where-Object { $global:MMP151FakeModel.containers[$_].Name -eq "/$($a[-1])" })[0] }
    $global:MMP151FakeModel.containers.Remove($key); Save-Model; return
  }
  if ($a[0] -eq 'cp') {
    if ($a[1] -match '^(mmp151-harness-[a-f0-9]{32}|[a-f0-9]{64}):') { Set-Content -LiteralPath $a[2] -Value '{"execution":"SYNTHETIC"}' }
    return
  }
  throw "UNEXPECTED_SYNTHETIC_DOCKER_$($a[0])"
}
function Invoke-Control($container) {
  $socketDaemon = 'dedicated'
  foreach ($mount in $container.Mounts) {
    if ($mount.Type -eq 'bind' -and $mount.Source -eq '/var/run/docker.sock') { $socketDaemon = 'host' }
  }
  Save-Model
  & $env:MMP151_TEST_NODE (Join-Path $PSScriptRoot 'daemon-process-control.mjs') $State $socketDaemon
  if ($LASTEXITCODE -ne 0) { throw 'SYNTHETIC_PROCESS_CONTROL_FAILED' }
  $merged = Get-Content -Raw -LiteralPath $State | ConvertFrom-Json -AsHashtable
  foreach ($key in @('controlCalls','socketDaemon','foreignSurvivedFinalizer','foreignSurvivedLedger')) { $global:MMP151FakeModel[$key] = $merged[$key] }
  Save-Model
  $global:LASTEXITCODE = 0
}
& $Launcher -ScratchRoot $Scratch

