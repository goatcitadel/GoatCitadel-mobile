Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$outputDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$size = 1024

function New-Color($hex, $alpha = 255) {
  $hex = $hex.TrimStart("#")
  return [System.Drawing.Color]::FromArgb($alpha, [Convert]::ToInt32($hex.Substring(0,2),16), [Convert]::ToInt32($hex.Substring(2,2),16), [Convert]::ToInt32($hex.Substring(4,2),16))
}

function New-RoundRectPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function Add-Battlements($graphics, $x, $y, $width, $count, $towerColor) {
  $gap = [float]($width / ($count * 2 + 1))
  $brush = New-Object System.Drawing.SolidBrush($towerColor)
  for ($i = 0; $i -lt $count; $i++) {
    $bx = $x + $gap + ($i * 2 * $gap)
    $graphics.FillRectangle($brush, $bx, $y, $gap, 28)
  }
  $brush.Dispose()
}

function Draw-Citadel-Backdrop($graphics, $variant) {
  $rect = New-Object System.Drawing.Rectangle 0,0,$size,$size
  $bgStart = if ($variant -eq "c") { New-Color "#112B3B" } else { New-Color "#0B1E29" }
  $bgEnd = if ($variant -eq "b") { New-Color "#071218" } else { New-Color "#041017" }
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $bgStart, $bgEnd, 90)
  $graphics.FillRectangle($brush, $rect)
  $brush.Dispose()

  $outer = New-RoundRectPath 34 34 956 956 220
  $outline = New-Object System.Drawing.Pen((New-Color "#375F6B" 180), 12)
  $graphics.DrawPath($outline, $outer)
  $outline.Dispose()
  $outer.Dispose()

  $inner = New-RoundRectPath 82 82 860 860 170
  $outline2 = New-Object System.Drawing.Pen((New-Color "#18333D" 210), 3)
  $graphics.DrawPath($outline2, $inner)
  $outline2.Dispose()
  $inner.Dispose()

  $nodePen = New-Object System.Drawing.Pen((New-Color "#214753" 180), 12)
  $nodePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $nodePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawLine($nodePen, 168, 258, 312, 200)
  $graphics.DrawLine($nodePen, 312, 200, 442, 258)
  $graphics.DrawLine($nodePen, 706, 222, 834, 274)
  $graphics.DrawLine($nodePen, 706, 222, 592, 302)
  $graphics.DrawLine($nodePen, 180, 770, 336, 706)
  $graphics.DrawLine($nodePen, 688, 712, 848, 786)
  $nodePen.Dispose()

  foreach ($node in @(@(168,258,18), @(312,200,18), @(442,258,16), @(706,222,18), @(834,274,16), @(592,302,14), @(180,770,16), @(336,706,14), @(688,712,16), @(848,786,14))) {
    $brushNode = New-Object System.Drawing.SolidBrush((New-Color "#73F5FF" 210))
    $graphics.FillEllipse($brushNode, $node[0]-$node[2], $node[1]-$node[2], $node[2]*2, $node[2]*2)
    $brushNode.Dispose()
  }
}

function Draw-GlowEllipse($graphics, $x, $y, $w, $h, $hex, $alpha) {
  $brush = New-Object System.Drawing.SolidBrush((New-Color $hex $alpha))
  $graphics.FillEllipse($brush, $x, $y, $w, $h)
  $brush.Dispose()
}

function Draw-GlyphG($graphics, $bounds, $variant) {
  $fontName = "Segoe UI Black"
  $fontSize = if ($variant -eq "b") { 188 } elseif ($variant -eq "c") { 212 } else { 176 }
  $font = New-Object System.Drawing.Font($fontName, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $shadowBrush = New-Object System.Drawing.SolidBrush((New-Color "#03141A" 190))
  $mainBrush = New-Object System.Drawing.SolidBrush((New-Color "#E6FDFF" 240))
  $accentBrush = New-Object System.Drawing.SolidBrush((New-Color "#98F4FF" 120))
  $shadowRect = [System.Drawing.RectangleF]::new([float]$bounds.X + 8, [float]$bounds.Y + 12, [float]$bounds.Width, [float]$bounds.Height)
  $graphics.DrawString("G", $font, $shadowBrush, $shadowRect, $format)
  $graphics.DrawString("G", $font, $mainBrush, $bounds, $format)
  if ($variant -eq "c") {
    $highlightRect = [System.Drawing.RectangleF]::new([float]$bounds.X, [float]$bounds.Y - 12, [float]$bounds.Width, [float]$bounds.Height)
    $graphics.DrawString("G", $font, $accentBrush, $highlightRect, $format)
  }
  $shadowBrush.Dispose()
  $mainBrush.Dispose()
  $accentBrush.Dispose()
  $font.Dispose()
  $format.Dispose()
}

function Draw-ConceptA($path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bmp)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  Draw-Citadel-Backdrop $graphics "a"
  Draw-GlowEllipse $graphics 256 266 512 508 "#64F5FF" 44

  $wallBrush = New-Object System.Drawing.SolidBrush((New-Color "#7DE6EA"))
  $wallShadow = New-Object System.Drawing.SolidBrush((New-Color "#194854" 140))
  $gateBrush = New-Object System.Drawing.SolidBrush((New-Color "#153A47"))
  $accentBrush = New-Object System.Drawing.SolidBrush((New-Color "#B6FBFF" 230))
  $pen = New-Object System.Drawing.Pen((New-Color "#7CF7FF" 230), 14)
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $graphics.FillRectangle($wallBrush, 288, 372, 448, 316)
  $graphics.FillRectangle($wallShadow, 288, 650, 448, 70)
  $graphics.FillRectangle($wallBrush, 332, 310, 98, 144)
  $graphics.FillRectangle($wallBrush, 594, 310, 98, 144)
  $graphics.FillRectangle($wallBrush, 468, 276, 88, 184)
  Add-Battlements $graphics 288 336 448 6 (New-Color "#7DE6EA")
  $graphics.FillPie($gateBrush, 430, 470, 164, 210, 180, 180)
  $graphics.FillRectangle($gateBrush, 430, 575, 164, 110)
  $graphics.FillEllipse($accentBrush, 468, 410, 88, 64)
  $graphics.FillEllipse((New-Object System.Drawing.SolidBrush((New-Color "#A9F8FC" 120))), 402, 424, 44, 44)
  $graphics.FillEllipse((New-Object System.Drawing.SolidBrush((New-Color "#A9F8FC" 120))), 578, 424, 44, 44)

  $graphics.DrawArc($pen, 282, 280, 462, 290, 194, 152)
  $graphics.DrawArc($pen, 240, 244, 544, 364, 204, 132)
  $graphics.DrawArc($pen, 214, 220, 596, 420, 212, 116)

  $gRect = [System.Drawing.RectangleF]::new(344, 354, 336, 228)
  Draw-GlyphG $graphics $gRect "a"

  $wallBrush.Dispose()
  $wallShadow.Dispose()
  $gateBrush.Dispose()
  $accentBrush.Dispose()
  $pen.Dispose()
  $graphics.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

function Draw-ConceptB($path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bmp)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  Draw-Citadel-Backdrop $graphics "b"
  Draw-GlowEllipse $graphics 216 228 592 560 "#56ECFF" 36

  $outline = New-Object System.Drawing.Pen((New-Color "#7EF7FF" 240), 16)
  $outline.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $fill = New-Object System.Drawing.SolidBrush((New-Color "#10232D"))
  $tower = New-Object System.Drawing.SolidBrush((New-Color "#8CF0F0"))
  $deep = New-Object System.Drawing.SolidBrush((New-Color "#123C49"))

  $shield = New-Object System.Drawing.Drawing2D.GraphicsPath
  $shield.AddPolygon(@(
      ([System.Drawing.PointF]::new(274, 360)),
      ([System.Drawing.PointF]::new(512, 212)),
      ([System.Drawing.PointF]::new(752, 360)),
      ([System.Drawing.PointF]::new(694, 700)),
      ([System.Drawing.PointF]::new(512, 840)),
      ([System.Drawing.PointF]::new(330, 700))
  ))
  $graphics.FillPath($fill, $shield)
  $graphics.DrawPath($outline, $shield)

  $graphics.FillRectangle($tower, 330, 450, 364, 182)
  $graphics.FillRectangle($tower, 380, 328, 112, 248)
  $graphics.FillRectangle($tower, 532, 328, 112, 248)
  $graphics.FillRectangle($tower, 476, 274, 72, 270)
  Add-Battlements $graphics 330 416 364 5 (New-Color "#8CF0F0")
  $graphics.FillPie($deep, 438, 500, 148, 184, 180, 180)
  $graphics.FillRectangle($deep, 438, 592, 148, 54)

  $gRect = [System.Drawing.RectangleF]::new(318, 326, 388, 240)
  Draw-GlyphG $graphics $gRect "b"

  $shield.Dispose()
  $outline.Dispose()
  $fill.Dispose()
  $tower.Dispose()
  $deep.Dispose()
  $graphics.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

function Draw-ConceptC($path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bmp)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  Draw-Citadel-Backdrop $graphics "c"
  Draw-GlowEllipse $graphics 224 254 576 520 "#62F4FF" 28

  $stone = New-Object System.Drawing.SolidBrush((New-Color "#85ECEE"))
  $shadow = New-Object System.Drawing.SolidBrush((New-Color "#15424D"))
  $outline = New-Object System.Drawing.Pen((New-Color "#D2FDFF" 230), 10)
  $outline.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $bridgePen = New-Object System.Drawing.Pen((New-Color "#1D4854" 220), 14)
  $bridgePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $graphics.FillRectangle($stone, 276, 462, 472, 174)
  $graphics.FillRectangle($shadow, 276, 620, 472, 92)
  $graphics.FillRectangle($stone, 330, 350, 112, 208)
  $graphics.FillRectangle($stone, 470, 296, 84, 228)
  $graphics.FillRectangle($stone, 582, 350, 112, 208)
  Add-Battlements $graphics 276 430 472 7 (New-Color "#85ECEE")
  $graphics.DrawLine($bridgePen, 276, 706, 374, 816)
  $graphics.DrawLine($bridgePen, 748, 706, 650, 816)
  $graphics.DrawLine($bridgePen, 374, 816, 650, 816)
  $graphics.FillPie($shadow, 428, 514, 168, 188, 180, 180)
  $graphics.FillRectangle($shadow, 428, 606, 168, 62)

  $graphics.DrawArc($outline, 296, 292, 424, 228, 194, 146)
  $graphics.DrawArc($outline, 260, 264, 500, 290, 204, 132)

  $gRect = [System.Drawing.RectangleF]::new(304, 328, 418, 256)
  Draw-GlyphG $graphics $gRect "c"

  $stone.Dispose()
  $shadow.Dispose()
  $outline.Dispose()
  $bridgePen.Dispose()
  $graphics.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

Draw-ConceptA (Join-Path $outputDir "concept-a-bastion-g.png")
Draw-ConceptB (Join-Path $outputDir "concept-b-keeper-g.png")
Draw-ConceptC (Join-Path $outputDir "concept-c-night-gate.png")
