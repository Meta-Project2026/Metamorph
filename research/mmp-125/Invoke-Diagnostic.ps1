# Manual only. No new diagnostic consent is supplied by this implementation.
param(
  [Parameter(Mandatory=$true)][string]$ScratchRoot,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$AuthorizedHead
)
$ErrorActionPreference = 'Stop'
try {
  Import-Module (Join-Path $PSScriptRoot 'launcher-core.psm1') -Force
  $result = Invoke-DiagnosticCore -ScratchRoot $ScratchRoot -AuthorizedHead $AuthorizedHead
  exit $result
} catch {
  # Includes module admission / unwritable receipt root. Never print raw errors.
  Write-Output 'MMP125_LAUNCHER_ERROR'
  exit 1
}
