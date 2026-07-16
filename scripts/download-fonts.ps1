# download-fonts.ps1 — Shams al-Asrār (Windows convenience wrapper)
# ----------------------------------------------------------------------------
# The canonical, cross-platform font provisioner is scripts/download-fonts.mjs
# (Node). This wrapper exists only so Windows devs can keep muscle-memory of the
# old command; it simply delegates to the Node script so there is ONE manifest
# to maintain and the fonts can never drift from what src/theme/typography.ts
# actually references.
#
# Usage:
#   pwsh ./scripts/download-fonts.ps1          # download missing
#   pwsh ./scripts/download-fonts.ps1 -Force   # re-download all

[CmdletBinding()]
param(
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Script = Join-Path $PSScriptRoot 'download-fonts.mjs'

$nodeArgs = @($Script)
if ($Force) { $nodeArgs += '--force' }

Push-Location $RepoRoot
try {
  & node @nodeArgs
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
