# ============================================================================
# Shams al-Asrār — Phase 1 Launcher Icon Generator
# ----------------------------------------------------------------------------
# Generates production-quality placeholder launcher icons for all five Android
# density buckets plus the API 26+ adaptive-icon foreground/background pair.
#
# Visual identity: deep teal disc (#030E10) with the Arabic letter "ش"
# (the first letter of "Shams") rendered in accent teal (#14D4C4). This
# matches the splash background and oracle-screen accent from the locked
# theme palette.
#
# WHY this approach:
#   - ImageMagick is not installed on this machine.
#   - .NET System.Drawing is built into Windows PowerShell 5.x — zero install.
#   - Output is deterministic, lossless 8-bit RGBA PNG, exactly the size the
#     mipmap bucket requires. Android AAPT2 accepts these without complaint.
#
# These icons are PLACEHOLDERS for Phase 1. Final icons (mandala glyph with
# proper Cinzel + Nastaliq treatment) ship in Phase 5 once visual identity
# is signed off by Astro Sarfaraz.
# ============================================================================

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$resRoot     = Join-Path $projectRoot 'android/app/src/main/res'

# Density buckets — Android canonical sizes for launcher icons.
$buckets = @(
    @{ Name = 'mipmap-mdpi';    Size = 48;  Adaptive = 108 }
    @{ Name = 'mipmap-hdpi';    Size = 72;  Adaptive = 162 }
    @{ Name = 'mipmap-xhdpi';   Size = 96;  Adaptive = 216 }
    @{ Name = 'mipmap-xxhdpi';  Size = 144; Adaptive = 324 }
    @{ Name = 'mipmap-xxxhdpi'; Size = 192; Adaptive = 432 }
)

# Locked theme palette (matches src/theme/themes.ts and res/values/colors.xml).
$bgColor     = [System.Drawing.ColorTranslator]::FromHtml('#030E10')
$accentColor = [System.Drawing.ColorTranslator]::FromHtml('#14D4C4')
$ringColor   = [System.Drawing.ColorTranslator]::FromHtml('#0FA89A')
$glyph       = [char]0x0634   # Arabic letter SHEEN (ش)

function New-LauncherIcon {
    param(
        [int]    $Size,
        [bool]   $Round,
        [string] $OutPath
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # Background — circular if Round, else full square (Android masks square
    # icons itself on most launchers; we still draw a disc to look correct
    # on launchers that do NOT mask).
    $bgBrush = New-Object System.Drawing.SolidBrush($bgColor)
    if ($Round) {
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.FillEllipse($bgBrush, 0, 0, $Size, $Size)
    } else {
        $g.FillRectangle($bgBrush, 0, 0, $Size, $Size)
    }
    $bgBrush.Dispose()

    # Inner ring — subtle teal halo at 88% radius, 2 px stroke (scaled).
    $ringStroke = [Math]::Max(2, [int]($Size * 0.018))
    $ringInset  = [int]($Size * 0.06)
    $ringPen    = New-Object System.Drawing.Pen($ringColor, $ringStroke)
    $g.DrawEllipse(
        $ringPen,
        $ringInset, $ringInset,
        $Size - 2 * $ringInset, $Size - 2 * $ringInset
    )
    $ringPen.Dispose()

    # Glyph — Arabic SHEEN, sized to ~62% of icon height.
    # Use a font that ships with Windows and contains Arabic glyphs.
    $fontFamilyName = 'Segoe UI'
    $fontSize       = [int]($Size * 0.62)
    $font = $null
    try {
        $font = New-Object System.Drawing.Font(
            $fontFamilyName,
            $fontSize,
            [System.Drawing.FontStyle]::Bold,
            [System.Drawing.GraphicsUnit]::Pixel
        )
    } catch {
        # Fallback to generic sans-serif if Segoe UI is unavailable.
        $font = New-Object System.Drawing.Font(
            [System.Drawing.FontFamily]::GenericSansSerif,
            $fontSize,
            [System.Drawing.FontStyle]::Bold,
            [System.Drawing.GraphicsUnit]::Pixel
        )
    }

    $glyphBrush = New-Object System.Drawing.SolidBrush($accentColor)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment     = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    # Optical shift down by ~6% — Arabic glyphs sit visually higher than Latin.
    $rect = New-Object System.Drawing.RectangleF(
        [single]0,
        [single]($Size * 0.04),
        [single]$Size,
        [single]$Size
    )
    $g.DrawString([string]$glyph, $font, $glyphBrush, $rect, $sf)

    $sf.Dispose()
    $glyphBrush.Dispose()
    $font.Dispose()
    $g.Dispose()

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

function New-AdaptiveBackground {
    param(
        [int]    $Size,
        [string] $OutPath
    )
    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $brush = New-Object System.Drawing.SolidBrush($bgColor)
    $g.FillRectangle($brush, 0, 0, $Size, $Size)
    $brush.Dispose()
    $g.Dispose()
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

function New-AdaptiveForeground {
    param(
        [int]    $Size,
        [string] $OutPath
    )
    # Adaptive icon foreground: glyph centered on transparent canvas.
    # Safe zone is the inner 66 dp of the 108 dp foreground — we keep our
    # glyph at ~50% of total size to stay well inside it.
    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.Color]::Transparent)

    $fontSize = [int]($Size * 0.50)
    $font = $null
    try {
        $font = New-Object System.Drawing.Font(
            'Segoe UI',
            $fontSize,
            [System.Drawing.FontStyle]::Bold,
            [System.Drawing.GraphicsUnit]::Pixel
        )
    } catch {
        $font = New-Object System.Drawing.Font(
            [System.Drawing.FontFamily]::GenericSansSerif,
            $fontSize,
            [System.Drawing.FontStyle]::Bold,
            [System.Drawing.GraphicsUnit]::Pixel
        )
    }

    $brush = New-Object System.Drawing.SolidBrush($accentColor)
    $sf    = New-Object System.Drawing.StringFormat
    $sf.Alignment     = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    $rect = New-Object System.Drawing.RectangleF(
        [single]0, [single]($Size * 0.04),
        [single]$Size, [single]$Size
    )
    $g.DrawString([string]$glyph, $font, $brush, $rect, $sf)

    $sf.Dispose()
    $brush.Dispose()
    $font.Dispose()
    $g.Dispose()
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

# ----------------------------------------------------------------------------
# Generate per-density legacy launcher icons + adaptive layers.
# ----------------------------------------------------------------------------
foreach ($b in $buckets) {
    $dir = Join-Path $resRoot $b.Name
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

    $square = Join-Path $dir 'ic_launcher.png'
    $round  = Join-Path $dir 'ic_launcher_round.png'
    $afg    = Join-Path $dir 'ic_launcher_foreground.png'
    $abg    = Join-Path $dir 'ic_launcher_background.png'

    New-LauncherIcon       -Size $b.Size     -Round $false -OutPath $square
    New-LauncherIcon       -Size $b.Size     -Round $true  -OutPath $round
    New-AdaptiveForeground -Size $b.Adaptive               -OutPath $afg
    New-AdaptiveBackground -Size $b.Adaptive               -OutPath $abg

    Write-Output ("OK  {0,-18} {1}x{1} (adaptive {2}x{2})" -f $b.Name, $b.Size, $b.Adaptive)
}

Write-Output 'ALL_ICONS_GENERATED'
