Add-Type -AssemblyName System.Drawing

$dir = Join-Path $PSScriptRoot "..\apps\web\public" | Resolve-Path
$color = [System.Drawing.Color]::FromArgb(255, 79, 70, 229)

foreach ($size in @(192, 512)) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = "AntiAlias"
  $g.Clear($color)
  $fontSize = [int]($size * 0.28)
  $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold)
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $text = "FF"
  $sizeF = $g.MeasureString($text, $font)
  $x = ($size - $sizeF.Width) / 2
  $y = ($size - $sizeF.Height) / 2
  $g.DrawString($text, $font, $brush, $x, $y)
  $path = Join-Path $dir "icon-$size.png"
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  $font.Dispose()
  $brush.Dispose()
  Write-Output "Created $path"
}
