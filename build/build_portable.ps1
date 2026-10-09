# Portable ZIP Builder — law-assist v1.0.0
# Generates a ready-to-run portable package without requiring any installer

$Version = "1.0.0"
$ROOT = Split-Path -Parent $PSScriptRoot
$RELEASE_DIR = Join-Path $ROOT "releases\v$Version"
$STAGING = Join-Path $ROOT "build\portable_staging"

Write-Host "Building Portable ZIP..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $RELEASE_DIR | Out-Null
New-Item -ItemType Directory -Force -Path "$STAGING" | Out-Null
New-Item -ItemType Directory -Force -Path "$STAGING\engine" | Out-Null
New-Item -ItemType Directory -Force -Path "$STAGING\engine\models" | Out-Null
New-Item -ItemType Directory -Force -Path "$STAGING\engine\data" | Out-Null
New-Item -ItemType Directory -Force -Path "$STAGING\engine\verticals" | Out-Null
New-Item -ItemType Directory -Force -Path "$STAGING\ui" | Out-Null

# Copy engine EXE if it exists (from PyInstaller)
$engineExe = Join-Path $ROOT "engine\dist_release\law-assist-engine.exe"
if (Test-Path $engineExe) {
    Copy-Item $engineExe "$STAGING\engine\"
    Write-Host "  [ok] Engine EXE copied" -ForegroundColor Green
} else {
    Write-Host "  [warn] Engine EXE not found — portable will run engine via Python" -ForegroundColor Yellow
    # Copy Python engine files instead
    $engineFiles = @("api.py","agent.py","auth.py","config.py","ingest.py","store.py","users.py",
                     "embedder.py","llm.py","license_client.py","vertical.py","retrieve.py",
                     "download_model.py","requirements.txt")
    foreach ($f in $engineFiles) {
        $src = Join-Path $ROOT "engine\$f"
        if (Test-Path $src) { Copy-Item $src "$STAGING\engine\" }
    }
    Copy-Item (Join-Path $ROOT "engine\verticals") "$STAGING\engine\verticals" -Recurse -Force
}

# Copy .env.example
$envExample = Join-Path $ROOT "engine\.env.example"
if (Test-Path $envExample) { Copy-Item $envExample "$STAGING\engine\.env" }

# Copy built UI
$uiDist = Join-Path $ROOT "ui\dist"
if (Test-Path $uiDist) {
    Copy-Item $uiDist "$STAGING\ui" -Recurse -Force
    Write-Host "  [ok] UI dist copied" -ForegroundColor Green
} else {
    Write-Host "  [warn] UI dist not built — run 'npm run build' in ui/ first" -ForegroundColor Yellow
}

# Create launcher batch file
$launcher = @"
@echo off
title law-assist v$Version — Private Legal Intelligence
color 0B
cls
echo.
echo  ██╗      █████╗ ██╗    ██╗      █████╗ ███████╗███████╗██╗███████╗████████╗
echo  ██║     ██╔══██╗██║    ██║     ██╔══██╗██╔════╝██╔════╝██║██╔════╝╚══██╔══╝
echo  ██║     ███████║██║ █╗ ██║     ███████║███████╗███████╗██║███████╗   ██║   
echo  ██║     ██╔══██║██║███╗██║     ██╔══██║╚════██║╚════██║██║╚════██║   ██║   
echo  ███████╗██║  ██║╚███╔███╔╝     ██║  ██║███████║███████║██║███████║   ██║   
echo  ╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝      ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝╚══════╝   ╚═╝   
echo.
echo  Version: $Version   Portable Edition   law-assist.com
echo =========================================================================
echo.

if exist engine\law-assist-engine.exe (
    echo [1] Starting AI Engine...
    start "" /B engine\law-assist-engine.exe
) else (
    echo [1] Starting AI Engine via Python...
    cd engine
    if exist .venv_312\Scripts\python.exe (
        start "" /B .venv_312\Scripts\python.exe api.py
    ) else (
        start "" /B python api.py
    )
    cd ..
)

echo [2] Waiting for engine to start...
timeout /t 4 /nobreak >nul

echo [3] Opening law-assist in your browser...
start "" http://localhost:8765

echo.
echo  law-assist is running at: http://localhost:8765
echo  Close this window to STOP the engine.
echo.
pause
"@
$launcher | Out-File "$STAGING\law-assist.bat" -Encoding ASCII

# Create README
$readme = @"
# law-assist v$Version — Portable Edition

## Quick Start

1. Double-click **law-assist.bat** to launch
2. Your browser will open automatically at http://localhost:8765
3. Complete first-time setup (create admin account)
4. Create notebooks and upload your documents

## Requirements
- Windows 10 or 11 (64-bit)
- 8GB RAM minimum

## Model Download
On first launch, the AI model (~1GB) will download automatically.
To use offline: manually place your GGUF model file at:
  engine/models/model.gguf

## Support
https://law-assist.com
"@
$readme | Out-File "$STAGING\README.txt" -Encoding UTF8

# Create the ZIP
$zipPath = Join-Path $RELEASE_DIR "law-assist-$Version-Portable.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$STAGING\*" -DestinationPath $zipPath
$size = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "`n[DONE] Portable ZIP: $zipPath ($size MB)" -ForegroundColor Green

# Compute SHA256
$hash = (certutil -hashfile $zipPath SHA256 | Select-String -Pattern "[0-9a-f]{64}").Matches[0].Value
Write-Host "SHA256: $hash" -ForegroundColor Cyan

# Update release.json
$releaseJsonPath = Join-Path $ROOT "releases\release.json"
if (Test-Path $releaseJsonPath) {
    $json = Get-Content $releaseJsonPath -Raw | ConvertFrom-Json
    $json.sha256.zip = $hash
    $json | ConvertTo-Json -Depth 5 | Set-Content $releaseJsonPath -Encoding UTF8
    Write-Host "release.json updated with ZIP checksum" -ForegroundColor Green
}
