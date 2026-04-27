# Quick non-destructive verification — list all generated mipmap PNGs with size.
# Used by Phase 1 §1.12 audit to confirm AAPT2-resolvable resources exist.

$root = Join-Path (Split-Path -Parent $PSScriptRoot) 'android/app/src/main/res'
$total = 0
Get-ChildItem -Recurse -Path "$root/mipmap-*" -Filter *.png |
    Sort-Object DirectoryName, Name |
    ForEach-Object {
        $total += $_.Length
        $bucket = Split-Path -Leaf $_.Directory.FullName
        Write-Output ("{0,7} B  {1,-20} {2}" -f $_.Length, $bucket, $_.Name)
    }
Write-Output ('-' * 56)
Write-Output ("Total payload: {0:N0} bytes" -f $total)
