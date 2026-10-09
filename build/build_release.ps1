# law-assist Build & Release Pipeline
# Generates all release artifacts: MSI, EXE (NSIS), Portable ZIP, Enterprise ISO
# Run from the repository root: .\build\build_release.ps1

param (
    [string]$Version = "1.0.0",
    [switch]$SkipFrontend,
    [switch]$SkipISO
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $PSScriptRoot
$RELEASE_DIR = Join-Path $ROOT "releases\v$Version"

Write-Host "" 
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  law-assist Build Pipeline v$Version" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# ── Prerequisites check ──────────────────────────────────────────────────────
function Test-Cmd {
    param([string]$cmd, [string]$hint)
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "[ERROR] '$cmd' not found. $hint" -ForegroundColor Red
        exit 1
    }
}
Test-Cmd "npm"           "Install Node.js from https://nodejs.org"
Test-Cmd "python"        "Install Python 3.12 from https://python.org"
Test-Cmd "certutil"      "Should be available on Windows by default"

# ── Create output directory ──────────────────────────────────────────────────
New-Item -ItemType Directory -Force -Path $RELEASE_DIR | Out-Null
Write-Host "[1/7] Output directory: $RELEASE_DIR" -ForegroundColor Green

# ── Step 1: Build React frontend ─────────────────────────────────────────────
if (-not $SkipFrontend) {
    Write-Host "[2/7] Building React UI..." -ForegroundColor Yellow
    Push-Location (Join-Path $ROOT "ui")
    npm install --silent
    npm run build
    Pop-Location
    Write-Host "[2/7] UI build complete." -ForegroundColor Green
} else {
    Write-Host "[2/7] Skipping frontend build (-SkipFrontend)." -ForegroundColor Gray
}

# ── Step 2: Package Python engine ────────────────────────────────────────────
Write-Host "[3/7] Packaging Python engine with PyInstaller..." -ForegroundColor Yellow
Push-Location (Join-Path $ROOT "engine")

# Ensure PyInstaller is available
& ".\.venv_312\Scripts\pip.exe" install pyinstaller --quiet

& ".\.venv_312\Scripts\pyinstaller.exe" --onefile --name "law-assist-engine" --hidden-import "sqlite_vec" --hidden-import "jose" --hidden-import "passlib.handlers.bcrypt" --hidden-import "pymupdf" --hidden-import "fitz" --hidden-import "docx" --hidden-import "pandas" --hidden-import "openpyxl" --collect-all "sqlite_vec" --collect-all "pymupdf" --collect-all "pandas" --collect-all "docx" --collect-all "openpyxl" --collect-all "llama_cpp" --add-data "verticals;verticals" --distpath "..\build\engine_dist" api.py

Pop-Location
Write-Host "[3/7] Engine packaged." -ForegroundColor Green

# ── Step 3: Create Portable ZIP ──────────────────────────────────────────────
Write-Host "[4/7] Creating Portable ZIP..." -ForegroundColor Yellow

$ZIP_STAGING = Join-Path $ROOT "build\portable_staging"
New-Item -ItemType Directory -Force -Path $ZIP_STAGING | Out-Null
New-Item -ItemType Directory -Force -Path "$ZIP_STAGING\engine\models" | Out-Null
New-Item -ItemType Directory -Force -Path "$ZIP_STAGING\engine\data" | Out-Null

# Copy engine binary and static assets
Copy-Item (Join-Path $ROOT "build\engine_dist\law-assist-engine.exe") "$ZIP_STAGING\engine\"
Copy-Item (Join-Path $ROOT "engine\.env.example") "$ZIP_STAGING\engine\.env" -ErrorAction SilentlyContinue

# Copy built UI
Copy-Item (Join-Path $ROOT "ui\dist") "$ZIP_STAGING\ui" -Recurse

# Copy launcher
$batPath = Join-Path $ZIP_STAGING "law-assist.bat"
$batLines = @(
    '@echo off',
    'title law-assist',
    'echo Starting law-assist engine (this may take a moment on the first run)...',
    'start "" /B engine\law-assist-engine.exe',
    '',
    'echo Waiting for the engine to initialize...',
    ':loop',
    'timeout /t 2 /nobreak >nul',
    'curl -s http://localhost:8765/health >nul 2>&1',
    'if errorlevel 1 goto loop',
    '',
    'start "" http://localhost:8765',
    'echo law-assist is running. Close this window to stop the AI.',
    'pause'
)
Set-Content -Path $batPath -Value $batLines -Encoding ASCII

# Zip it
$ZIP_PATH = Join-Path $RELEASE_DIR "law-assist-$Version-Portable.zip"
Compress-Archive -Path "$ZIP_STAGING\*" -DestinationPath $ZIP_PATH -Force
Write-Host "[4/7] Portable ZIP created: $ZIP_PATH" -ForegroundColor Green

# ── Step 4: Create NSIS EXE installer ────────────────────────────────────────
Write-Host "[5/7] Building NSIS EXE installer..." -ForegroundColor Yellow
$NSIS_EXE = Get-Command "makensis" -ErrorAction SilentlyContinue

if ($NSIS_EXE) {
    $nsisScript = Join-Path $ROOT "build\installer.nsi"
    if (Test-Path $nsisScript) {
        & makensis /DVERSION=$Version /DOUTDIR=$RELEASE_DIR $nsisScript
        Write-Host "[5/7] NSIS EXE installer built." -ForegroundColor Green
    } else {
        Write-Host "[5/7] NSIS script not found at build\installer.nsi - skipping EXE." -ForegroundColor Yellow
    }
} else {
    Write-Host "[5/7] NSIS not installed - skipping EXE installer. Install from https://nsis.sourceforge.io" -ForegroundColor Yellow
}

# ── Step 5: Build Tauri MSI ──────────────────────────────────────────────────
Write-Host "[6/7] Building Tauri MSI..." -ForegroundColor Yellow
$TAURI_DIR = Join-Path $ROOT "ui"
if (Test-Path (Join-Path $TAURI_DIR "src-tauri")) {
    Push-Location $TAURI_DIR
    npm run tauri build 2>&1
    # Find and copy MSI
    $msiFound = Get-ChildItem "src-tauri\target\release\bundle\msi\*.msi" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($msiFound) {
        $destMsi = Join-Path $RELEASE_DIR "law-assist-$Version-Setup.msi"
        Copy-Item $msiFound.FullName $destMsi
        Write-Host "[6/7] MSI created: $destMsi" -ForegroundColor Green
    }
    Pop-Location
} else {
    Write-Host "[6/7] No Tauri project found - skipping MSI." -ForegroundColor Yellow
}

# ── Step 6: Create Enterprise ISO (optional) ─────────────────────────────────
if (-not $SkipISO) {
    Write-Host "[7/7] Creating Enterprise ISO..." -ForegroundColor Yellow
    $oscdimg = Get-Command "oscdimg" -ErrorAction SilentlyContinue
    if ($oscdimg) {
        $ISO_STAGING = Join-Path $ROOT "build\iso_staging"
        New-Item -ItemType Directory -Force -Path $ISO_STAGING | Out-Null
        Copy-Item "$ZIP_STAGING\*" "$ISO_STAGING\" -Recurse -Force
        if (Test-Path (Join-Path $RELEASE_DIR "law-assist-$Version-Setup.msi")) {
            Copy-Item (Join-Path $RELEASE_DIR "law-assist-$Version-Setup.msi") "$ISO_STAGING\"
        }
        $isoPath = Join-Path $RELEASE_DIR "law-assist-$Version-Enterprise.iso"
        & oscdimg -j1 -o -m $ISO_STAGING $isoPath
        Write-Host "[7/7] Enterprise ISO created: $isoPath" -ForegroundColor Green
    } else {
        Write-Host "[7/7] oscdimg not available - ISO skipped. Install Windows ADK." -ForegroundColor Yellow
    }
} else {
    Write-Host "[7/7] Skipping ISO (-SkipISO)." -ForegroundColor Gray
}

# ── Generate SHA256 checksums ─────────────────────────────────────────────────
Write-Host ""
Write-Host "Computing SHA256 checksums..." -ForegroundColor Yellow
$checksums = @{}
Get-ChildItem $RELEASE_DIR -File | ForEach-Object {
    $hash = (certutil -hashfile $_.FullName SHA256 | Select-String -Pattern "[0-9a-f]{64}").Matches[0].Value
    $checksums[$_.Name] = $hash
    Write-Host "  $($_.Name)" -ForegroundColor White
    Write-Host "  $hash" -ForegroundColor Gray
    Write-Host ""
}

# Update release.json with real checksums
$releaseJson = Get-Content (Join-Path $ROOT "releases\release.json") | ConvertFrom-Json
foreach ($file in $checksums.Keys) {
    if ($file -like "*Portable.zip*") { $releaseJson.sha256.zip = $checksums[$file] }
    if ($file -like "*Setup.msi*") { $releaseJson.sha256.msi = $checksums[$file] }
    if ($file -like "*Setup.exe*") { $releaseJson.sha256.exe = $checksums[$file] }
    if ($file -like "*Enterprise.iso*") { $releaseJson.sha256.iso = $checksums[$file] }
}
$releaseJson | ConvertTo-Json -Depth 5 | Out-File (Join-Path $ROOT "releases\release.json") -Encoding UTF8

Write-Host "======================================" -ForegroundColor Green
Write-Host "  BUILD COMPLETE: releases\v$Version\" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Get-ChildItem $RELEASE_DIR | Format-Table Name, Length -AutoSize
