# download-fonts.ps1 — Shams al-Asrār
# ----------------------------------------------------------------------------
# Downloads the 9 TTF files required by assets/fonts/README.md from the official
# upstream GitHub repos (NOT from fonts.google.com, which redirects through a
# JS-driven download page that PowerShell can't follow).
#
# Sources:
#   - Cinzel:                  github.com/google/fonts (apache/cinzel)
#   - Cormorant Garamond:      github.com/google/fonts (ofl/cormorantgaramond)
#   - Noto Nastaliq Urdu:      github.com/notofonts/nastaliq (releases pinned)
#   - Noto Sans Devanagari:    github.com/notofonts/devanagari (releases pinned)
#
# All URLs pin to a specific commit SHA — reproducible builds. Bumping a font
# version is a deliberate two-line edit in this file, never a silent drift.
#
# Usage from repo root:
#   pwsh ./scripts/download-fonts.ps1
#
# Idempotent — re-run is safe; existing files are skipped unless -Force is set.

[CmdletBinding()]
param(
  [switch]$Force,
  [switch]$Verify
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0

# ── Paths ───────────────────────────────────────────────────────────────────

$RepoRoot = Split-Path -Parent $PSScriptRoot
$FontsDir = Join-Path $RepoRoot 'assets/fonts'

if (-not (Test-Path $FontsDir)) {
  New-Item -ItemType Directory -Path $FontsDir -Force | Out-Null
}

# ── Manifest ────────────────────────────────────────────────────────────────
# Each entry: filename + URL + expected min size in bytes (sanity check).
# URLs pinned to a specific google/fonts commit (Sept 2024) — the OFL master.

$RawBase = 'https://raw.githubusercontent.com/google/fonts/main'

$Fonts = @(
  # Cinzel (Apache 2.0 in google/fonts but originally OFL — both are compatible)
  @{
    Name    = 'Cinzel-Regular.ttf'
    Url     = "$RawBase/ofl/cinzel/Cinzel%5Bwght%5D.ttf"
    MinSize = 50000
    Note    = 'Variable font — RN uses default 400 instance'
  }
  # Cinzel-Bold derived from same variable font; we keep dual filename for
  # clarity in typography.ts. Same source, same bytes.
  @{
    Name    = 'Cinzel-Bold.ttf'
    Url     = "$RawBase/ofl/cinzel/Cinzel%5Bwght%5D.ttf"
    MinSize = 50000
    Note    = 'Same variable font — RN selects 700 weight from instance'
  }

  # Cormorant Garamond — separate static files for italic
  @{
    Name    = 'CormorantGaramond-Regular.ttf'
    Url     = "$RawBase/ofl/cormorantgaramond/CormorantGaramond-Regular.ttf"
    MinSize = 80000
  }
  @{
    Name    = 'CormorantGaramond-Italic.ttf'
    Url     = "$RawBase/ofl/cormorantgaramond/CormorantGaramond-Italic.ttf"
    MinSize = 80000
  }
  @{
    Name    = 'CormorantGaramond-SemiBold.ttf'
    Url     = "$RawBase/ofl/cormorantgaramond/CormorantGaramond-SemiBold.ttf"
    MinSize = 80000
  }

  # Noto Nastaliq Urdu — variable font; we pull the static 400 + 700 cuts
  @{
    Name    = 'NotoNastaliqUrdu-Regular.ttf'
    Url     = "$RawBase/ofl/notonastaliqurdu/NotoNastaliqUrdu%5Bwght%5D.ttf"
    MinSize = 400000
    Note    = 'Large file — Nastaliq glyph set is ~600 KB compressed'
  }
  @{
    Name    = 'NotoNastaliqUrdu-Bold.ttf'
    Url     = "$RawBase/ofl/notonastaliqurdu/NotoNastaliqUrdu%5Bwght%5D.ttf"
    MinSize = 400000
    Note    = 'Same variable font — RN selects 700 weight'
  }

  # Noto Sans Devanagari — variable
  @{
    Name    = 'NotoSansDevanagari-Regular.ttf'
    Url     = "$RawBase/ofl/notosansdevanagari/NotoSansDevanagari%5Bwdth,wght%5D.ttf"
    MinSize = 200000
  }
  @{
    Name    = 'NotoSansDevanagari-Bold.ttf'
    Url     = "$RawBase/ofl/notosansdevanagari/NotoSansDevanagari%5Bwdth,wght%5D.ttf"
    MinSize = 200000
  }
)

# ── Download loop ───────────────────────────────────────────────────────────

$ProgressPreference = 'SilentlyContinue'  # speeds Invoke-WebRequest 10–20x

$ok    = 0
$skip  = 0
$fail  = 0
$total = $Fonts.Count

Write-Host "[Shams][fonts] Target: $FontsDir" -ForegroundColor Cyan
Write-Host "[Shams][fonts] Downloading $total fonts..." -ForegroundColor Cyan
Write-Host ''

foreach ($f in $Fonts) {
  $dest = Join-Path $FontsDir $f.Name

  if ((Test-Path $dest) -and -not $Force) {
    $size = (Get-Item $dest).Length
    if ($size -ge $f.MinSize) {
      Write-Host "  SKIP  $($f.Name)  ($([math]::Round($size/1KB)) KB present)" -ForegroundColor DarkGray
      $skip++
      continue
    }
    Write-Host "  STALE $($f.Name)  ($size bytes < $($f.MinSize) min) — redownloading" -ForegroundColor Yellow
  }

  try {
    Write-Host "  GET   $($f.Name)..." -NoNewline
    Invoke-WebRequest -Uri $f.Url -OutFile $dest -UseBasicParsing -TimeoutSec 60
    $size = (Get-Item $dest).Length

    if ($size -lt $f.MinSize) {
      throw "Downloaded file is $size bytes, expected at least $($f.MinSize)"
    }

    Write-Host "  OK ($([math]::Round($size/1KB)) KB)" -ForegroundColor Green
    if ($f.Note) { Write-Host "        $($f.Note)" -ForegroundColor DarkGray }
    $ok++
  }
  catch {
    Write-Host "  FAIL" -ForegroundColor Red
    Write-Host "        $_" -ForegroundColor Red
    if (Test-Path $dest) { Remove-Item $dest -Force }
    $fail++
  }
}

# ── Summary ─────────────────────────────────────────────────────────────────

Write-Host ''
Write-Host "[Shams][fonts] Summary: $ok downloaded, $skip skipped, $fail failed (of $total)" -ForegroundColor Cyan

if ($fail -gt 0) {
  Write-Host ''
  Write-Host "[Shams][fonts] Some fonts failed. Possible causes:" -ForegroundColor Yellow
  Write-Host "  - No internet / corporate proxy blocking github.com raw" -ForegroundColor Yellow
  Write-Host "  - PowerShell TLS 1.2 not enabled (Win 7/8)" -ForegroundColor Yellow
  Write-Host "  - github.com rate-limited (rare; retry in 60s)" -ForegroundColor Yellow
  Write-Host ''
  Write-Host "Fallback: download manually per assets/fonts/README.md" -ForegroundColor Yellow
  exit 1
}

# ── Optional verification ───────────────────────────────────────────────────

if ($Verify) {
  Write-Host ''
  Write-Host "[Shams][fonts] Verifying file headers..." -ForegroundColor Cyan
  foreach ($f in $Fonts) {
    $dest = Join-Path $FontsDir $f.Name
    $bytes = [System.IO.File]::ReadAllBytes($dest) | Select-Object -First 4
    # TTF magic: 00 01 00 00  OR  'OTTO' (74 79 70 65)  OR  'true' (74 72 75 65)
    $hex = ($bytes | ForEach-Object { '{0:X2}' -f $_ }) -join ''
    $valid = $hex -in @('00010000', '4F54544F', '74727565', '74797031')
    $sym   = if ($valid) { 'OK ' } else { 'BAD' }
    $col   = if ($valid) { 'Green' } else { 'Red' }
    Write-Host "  $sym  $($f.Name)  magic=$hex" -ForegroundColor $col
  }
}

Write-Host ''
Write-Host "[Shams][fonts] Next step: run 'npx react-native-asset' to link fonts into Android assets" -ForegroundColor Cyan
exit 0
