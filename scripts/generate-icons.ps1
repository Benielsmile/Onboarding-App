#
# PIGA STUDIO — Génération du set d'icônes depuis le logo officiel
# Source : src/assets/icon/PIGA LOGO SYMBOL.png
# Sortie : public/ (favicon, apple-touch, PWA any + maskable)
# Rejouable : powershell -ExecutionPolicy Bypass -File scripts/generate-icons.ps1
#
param()

Add-Type -AssemblyName System.Drawing

$root   = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'src\assets\icon\PIGA LOGO SYMBOL.png'
$outDir = Join-Path $root 'public'

if (-not (Test-Path $source)) {
    Write-Error "Logo source introuvable : $source"
    exit 1
}

$src = [System.Drawing.Image]::FromFile($source)
Write-Output ("Source: {0}x{1}" -f $src.Width, $src.Height)

function New-Icon {
    param(
        [int]$Size,
        [double]$Scale,          # 1.0 = logo plein cadre ; <1.0 = marges (maskable/iOS)
        [string]$Background,     # 'transparent' ou couleur hex '#RRGGBB'
        [string]$OutFile
    )
    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($Background -ne 'transparent') {
        $g.Clear([System.Drawing.ColorTranslator]::FromHtml($Background))
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }

    # Logo centré, ratio préservé (contain) dans une boîte carrée Size*Scale
    $box      = [double]($Size * $Scale)
    $ratio    = [Math]::Min($box / $src.Width, $box / $src.Height)
    $drawW    = [int]($src.Width * $ratio)
    $drawH    = [int]($src.Height * $ratio)
    $offsetX  = [int](($Size - $drawW) / 2)
    $offsetY  = [int](($Size - $drawH) / 2)
    $g.DrawImage($src, $offsetX, $offsetY, $drawW, $drawH)
    $g.Dispose()

    $outPath = Join-Path $outDir $OutFile
    $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
    Write-Output "Genere: $OutFile ($Size x $Size, scale $Scale, fond $Background)"
}

try {
    #findOrFail Copie du symbole pour le splash statique index.html (first paint)
    Copy-Item $source (Join-Path $outDir 'logo-symbol.png') -Force
    Write-Output 'Genere: logo-symbol.png (splash pre-paint)'

    # Favicon navigateur : le symbole officiel, copie EXACTE sans retouche
    # (src/assets/icon/PIGA LOGO SYMBOL.png) — source unique, aucun variant default
    Copy-Item $source (Join-Path $outDir 'favicon.png') -Force
    Write-Output 'Genere: favicon.png (copie exacte du symbole officiel)'

    # Apple touch (iOS : pas de transparence, fond noir de la marque)
    New-Icon -Size 180 -Scale 0.80 -Background '#000000' -OutFile 'apple-touch-icon.png'

    # PWA "any" : plein cadre sur fond noir opaque
    New-Icon -Size 192 -Scale 1.0 -Background '#000000' -OutFile 'pwa-192x192.png'
    New-Icon -Size 512 -Scale 1.0 -Background '#000000' -OutFile 'pwa-512x512.png'

    # PWA "maskable" : zone de sécurité 80% (logo à 70% du masque rond Android)
    New-Icon -Size 512 -Scale 0.70 -Background '#000000' -OutFile 'pwa-maskable-512x512.png'

    Write-Output 'Set d icons PIGA genere avec succes.'
}
finally {
    $src.Dispose()
}
