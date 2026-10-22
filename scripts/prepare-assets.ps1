$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$iconDir = Join-Path $PSScriptRoot '..\src-tauri\icons'
New-Item -ItemType Directory -Force -Path $iconDir | Out-Null
$bitmap = New-Object System.Drawing.Bitmap 64,64
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::FromArgb(16,26,48))
$font = New-Object System.Drawing.Font 'Arial',42,([System.Drawing.FontStyle]::Bold -bor [System.Drawing.FontStyle]::Italic)
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(232,237,248))
$gold = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(244,209,92))
$graphics.DrawString('A',$font,$white,-1,-3)
$graphics.FillRectangle($gold,28,51,29,5)
$icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
$stream = [System.IO.File]::Create((Join-Path $iconDir 'icon.ico'))
$icon.Save($stream)
$stream.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
$font.Dispose()
$white.Dispose()
$gold.Dispose()

Write-Output "Generated application icon."
