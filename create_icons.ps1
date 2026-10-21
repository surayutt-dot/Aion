Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\com\.gemini\antigravity\brain\152a09b0-30e3-4caa-a8ad-af3164277321\.user_uploaded\media_1792462826862_3c6e437e.jpg"
$destCar = "c:\Users\com\Desktop\antigravityPC\s5ev\public\car.jpg"
Copy-Item $srcPath -Destination $destCar -Force

$src = [System.Drawing.Image]::FromFile($srcPath)

function Create-SquareIcon([int]$size, [string]$outPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    # 1. Background: Crisp white
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillRectangle($bgBrush, 0, 0, $size, $size)

    # 2. Draw subtle soft gradient at top/bottom for depth
    $gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point(0, $size)),
        [System.Drawing.Color]::FromArgb(255, 248, 250, 252),
        [System.Drawing.Color]::FromArgb(255, 241, 245, 249)
    )
    $g.FillRectangle($gradBrush, 0, 0, $size, $size)

    # 3. Crop car tighter to maximize car visibility
    # Original width 1024, height 768
    # Car is situated from X: 0 to 1000, Y: 330 to 760
    $cropX = 0
    $cropY = 320
    $cropW = 1000
    $cropH = 430

    $targetW = [int]($size * 0.98)
    $targetH = [int]($targetW * ($cropH / $cropW))
    $destX = [int](($size - $targetW) / 2)
    # Place slightly centered
    $destY = [int](($size - $targetH) / 2)

    $srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
    $destRect = New-Object System.Drawing.Rectangle($destX, $destY, $targetW, $targetH)

    $g.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

    # 4. Small stylish top badge: "MG S5 EV"
    $fontSize = [float]($size * 0.07)
    if ($fontSize -ge 8) {
        $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold)
        $badgeText = "MG S5 EV"
        $textSize = $g.MeasureString($badgeText, $font)
        
        $badgeY = [int]($size * 0.06)
        $badgeX = [int](($size - $textSize.Width) / 2)
        
        # Pill background
        $pillRect = New-Object System.Drawing.Rectangle(
            [int]($badgeX - ($size * 0.02)),
            [int]($badgeY - ($size * 0.01)),
            [int]($textSize.Width + ($size * 0.04)),
            [int]($textSize.Height + ($size * 0.02))
        )
        $pillBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 2, 132, 199))
        $g.FillRectangle($pillBrush, $pillRect)
        
        $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
        $g.DrawString($badgeText, $font, $textBrush, [float]$badgeX, [float]$badgeY)
    }

    # 5. Clean border
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(40, 0, 0, 0), 2)
    $g.DrawRectangle($pen, 1, 1, $size - 2, $size - 2)

    $g.Dispose()
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

Create-SquareIcon 512 "c:\Users\com\Desktop\antigravityPC\s5ev\public\icon-512.png"
Create-SquareIcon 192 "c:\Users\com\Desktop\antigravityPC\s5ev\public\icon-192.png"
Create-SquareIcon 180 "c:\Users\com\Desktop\antigravityPC\s5ev\public\apple-touch-icon.png"
Create-SquareIcon 64  "c:\Users\com\Desktop\antigravityPC\s5ev\public\favicon.png"

$src.Dispose()
Write-Host "Icons generated with MG S5 EV badge!"
