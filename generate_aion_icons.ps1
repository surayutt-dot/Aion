Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\com\.gemini\antigravity\brain\29e0b0c8-2265-4125-baed-9d9a292b651f\aion_ev_white_car_1792566189976.jpg"
Copy-Item $srcPath -Destination ".\public\car.jpg" -Force
Copy-Item $srcPath -Destination ".\car.jpg" -Force

$src = [System.Drawing.Image]::FromFile($srcPath)

function Create-SquareIcon([int]$size, [string]$outPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    # Crisp white background
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillRectangle($bgBrush, 0, 0, $size, $size)

    # Soft ambient glow
    $gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point(0, $size)),
        [System.Drawing.Color]::FromArgb(255, 240, 249, 255),
        [System.Drawing.Color]::FromArgb(255, 255, 255, 255)
    )
    $g.FillRectangle($gradBrush, 0, 0, $size, $size)

    # Calculate car aspect ratio and fit
    $aspect = $src.Width / $src.Height
    $targetW = [int]($size * 0.94)
    $targetH = [int]($targetW / $aspect)
    $destX = [int](($size - $targetW) / 2)
    $destY = [int](($size - $targetH) / 2 + ($size * 0.05))

    $g.DrawImage($src, $destX, $destY, $targetW, $targetH)

    # Top brand badge: 'AION EV'
    $fontSize = [float]($size * 0.075)
    if ($fontSize -ge 7) {
        $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold)
        $badgeText = "AION EV"
        $textSize = $g.MeasureString($badgeText, $font)
        
        $badgeY = [int]($size * 0.06)
        $badgeX = [int](($size - $textSize.Width) / 2)
        
        $pillRect = New-Object System.Drawing.Rectangle(
            [int]($badgeX - ($size * 0.03)),
            [int]($badgeY - ($size * 0.012)),
            [int]($textSize.Width + ($size * 0.06)),
            [int]($textSize.Height + ($size * 0.024))
        )
        $pillBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(240, 6, 182, 212))
        $g.FillRectangle($pillBrush, $pillRect)
        
        $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
        $g.DrawString($badgeText, $font, $textBrush, [float]$badgeX, [float]$badgeY)
    }

    # Clean outer subtle border
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(35, 14, 116, 144), 2)
    $g.DrawRectangle($pen, 1, 1, $size - 2, $size - 2)

    $g.Dispose()
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

$dirs = @(".\public\", ".\")
foreach ($targetDir in $dirs) {
    Create-SquareIcon 512 ($targetDir + "icon-512.png")
    Create-SquareIcon 192 ($targetDir + "icon-192.png")
    Create-SquareIcon 180 ($targetDir + "apple-touch-icon.png")
    Create-SquareIcon 64  ($targetDir + "favicon.png")
}

$src.Dispose()
Write-Host "AION icons generated successfully!"
