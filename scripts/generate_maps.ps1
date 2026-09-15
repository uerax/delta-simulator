Add-Type -AssemblyName System.Drawing

$maps = @(
    @{ name = "零号大坝"; key = "daba"; layer = "map_db"; file = "map_daba.jpg" },
    @{ name = "长弓溪谷"; key = "cgxg"; layer = "map_yc"; file = "map_cgxg.jpg" },
    @{ name = "航天基地"; key = "htjd"; layer = "map_htjd"; file = "map_htjd.jpg" },
    @{ name = "巴克什";   key = "bks";  layer = "map_bks2"; file = "map_bks.jpg" },
    @{ name = "潮汐监狱"; key = "cxjy"; layer = "map_cxjy"; file = "map_cxjy.jpg" },
    @{ name = "AZ3";      key = "az3";  layer = "map_az3";  file = "map_az3.jpg" }
)

$outputDir = Join-Path $PSScriptRoot "..\miniprogram\assets\maps"
if (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$tempDir = Join-Path $PSScriptRoot "temp_tiles"
if (!(Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
}

Write-Host "=== 开始下载并拼接 6 大地图底图 (1024x1024 适中分辨率，无点位无分层) ==="

$client = New-Object System.Net.WebClient

foreach ($m in $maps) {
    Write-Host "`n正在处理: $($m.name) ($($m.key)) Layer: $($m.layer)..."

    # 创建 1024x1024 的位图 (4x4 瓦片，每张 256x256)
    $finalBitmap = New-Object System.Drawing.Bitmap 1024, 1024
    $graphics = [System.Drawing.Graphics]::FromImage($finalBitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

    for ($x = 0; $x -lt 4; $x++) {
        for ($y = 0; $y -lt 4; $y++) {
            $url = "https://game.gtimg.cn/images/dfm/cp/a20240729directory/img/$($m.layer)/2_${x}_${y}.jpg"
            $tilePath = Join-Path $tempDir "$($m.layer)_2_${x}_${y}.jpg"

            try {
                $client.DownloadFile($url, $tilePath)
                $tileImage = [System.Drawing.Image]::FromFile($tilePath)

                # Leaflet 中 x 为横向坐标 (列)，y 为纵向坐标 (行)
                $posX = $x * 256
                $posY = $y * 256
                $graphics.DrawImage($tileImage, $posX, $posY, 256, 256)

                $tileImage.Dispose()
            } catch {
                Write-Warning "下载瓦片失败: $url - $($_.Exception.Message)"
            }
        }
    }

    $graphics.Dispose()

    # 保存合成图 (高质量 JPEG，保持适中体积)
    $outputPath = Join-Path $outputDir $m.file
    $encoder = [System.Drawing.Imaging.Encoder]::Quality
    $encoderParameters = New-Object System.Drawing.Imaging.EncoderParameters 1
    $encoderParameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter $encoder, 85L

    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
    $finalBitmap.Save($outputPath, $codec, $encoderParameters)
    $finalBitmap.Dispose()

    $fileInfo = Get-Item $outputPath
    $sizeKb = [Math]::Round($fileInfo.Length / 1KB, 1)
    Write-Host "已生成: $($m.name) -> $($m.file) (1024x1024, 体积: ${sizeKb} KB)"
}

# 清理临时瓦片
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
}

Write-Host "`n=== 6 大地图底图拼接生成完毕！输出目录: $outputDir ==="
