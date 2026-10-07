# Build ProAssist Standalone Package & Deliver to Downloads
$DownloadsDir = "C:\Users\soore\Downloads"
$TargetDir = Join-Path $DownloadsDir "ProAssist_Standalone"
$ZipTarget = Join-Path $DownloadsDir "ProAssist_Setup.zip"
$SourceRoot = "c:\Users\soore\Agentic_RAG_Local\Agentic_RAG_Local"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Building ProAssist Standalone Package" -ForegroundColor Green
Write-Host " Target: $TargetDir" -ForegroundColor Yellow
Write-Host " ZIP:    $ZipTarget" -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Cyan

# 0. Clean old target if exists
if (Test-Path $TargetDir) {
    Remove-Item -Recurse -Force $TargetDir
}
New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

# 1. Copy ProAssist.exe
$ExeSource = Join-Path $SourceRoot "engine\dist\ProAssist.exe"
if (Test-Path $ExeSource) {
    Copy-Item $ExeSource -Destination $TargetDir
    # Also place a direct copy in Downloads root
    Copy-Item $ExeSource -Destination "$DownloadsDir\ProAssist.exe"
    Write-Host "[OK] ProAssist.exe copied to package and Downloads root" -ForegroundColor Green
} else {
    Write-Host "[WARN] ProAssist.exe not found in engine\dist" -ForegroundColor Red
}

# 2. Setup engine directory
$TargetEngine = Join-Path $TargetDir "engine"
New-Item -ItemType Directory -Force -Path $TargetEngine | Out-Null

Copy-Item (Join-Path $SourceRoot "engine\*.py") -Destination $TargetEngine
Copy-Item (Join-Path $SourceRoot "engine\requirements.txt") -Destination $TargetEngine
Copy-Item (Join-Path $SourceRoot "engine\verticals") -Destination $TargetEngine -Recurse -Force

# Create ProAssist .env
$EnvContent = @"
SARAVONIX_VERTICAL=generic
LLM_BACKEND=local
EMBEDDING_MODEL=BAAI/bge-m3
CHUNK_SIZE_WORDS=400
CHUNK_OVERLAP_WORDS=60
TOP_K=6
SIMILARITY_THRESHOLD=1.0
API_HOST=0.0.0.0
API_PORT=8765
JWT_SECRET=proassist_enterprise_secure_2026
LICENSE_ENABLED=false
"@
Set-Content -Path (Join-Path $TargetEngine ".env") -Value $EnvContent

# 3. Copy compiled UI
$TargetUi = Join-Path $TargetDir "ui"
New-Item -ItemType Directory -Force -Path $TargetUi | Out-Null
Copy-Item (Join-Path $SourceRoot "ui\dist") -Destination $TargetUi -Recurse -Force
Write-Host "[OK] Compiled UI copied to package" -ForegroundColor Green

# 4. Create Launch_ProAssist.vbs
$VbsLauncher = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "engine"
WshShell.Run ".\.venv_312\Scripts\python.exe api.py", 0, False
WScript.Sleep 3000
WshShell.Run "http://localhost:8765"
"@
Set-Content -Path (Join-Path $TargetDir "Launch_ProAssist.vbs") -Value $VbsLauncher

# 5. Create Install_ProAssist.bat and Install_ProAssist.ps1
$InstallBat = @"
@echo off
title ProAssist Installer
echo ===================================================
echo   Installing ProAssist AI Workstation
echo ===================================================
powershell -ExecutionPolicy Bypass -File "%~dp0Install_ProAssist.ps1"
pause
"@
Set-Content -Path (Join-Path $TargetDir "Install_ProAssist.bat") -Value $InstallBat

$InstallPs1 = @"
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Installing ProAssist Enterprise Workstation" -ForegroundColor Green
Write-Host " Private Local AI Workstation" -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan

`$EngineDir = Join-Path `$PSScriptRoot "engine"

if (!(Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Python 3.12 is not detected in PATH." -ForegroundColor Red
    Write-Host "Please install Python 3.12 with 'Add Python to PATH' enabled."
    Pause
    exit
}

Write-Host "`n[1/3] Initializing ProAssist environment..." -ForegroundColor Yellow
Set-Location `$EngineDir
python -m venv .venv_312

Write-Host "`n[2/3] Installing ProAssist offline dependencies..." -ForegroundColor Yellow
.\.venv_312\Scripts\python.exe -m pip install -r requirements.txt

Write-Host "`n[3/3] Creating Desktop Shortcut..." -ForegroundColor Yellow
`$WshShell = New-Object -comObject WScript.Shell
`$ShortcutPath = `"$([Environment]::GetFolderPath('Desktop'))\ProAssist.lnk`"
`$Shortcut = `$WshShell.CreateShortcut(`$ShortcutPath)
`$Shortcut.TargetPath = Join-Path `$PSScriptRoot "ProAssist.exe"
`$Shortcut.WorkingDirectory = `$PSScriptRoot
`$Shortcut.IconLocation = "shell32.dll, 297"
`$Shortcut.Save()

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host " ProAssist Installation Complete!" -ForegroundColor Green
Write-Host " You can now double-click 'ProAssist' on your Desktop or run ProAssist.exe."
Write-Host "=========================================" -ForegroundColor Cyan
Pause
"@
Set-Content -Path (Join-Path $TargetDir "Install_ProAssist.ps1") -Value $InstallPs1

# 6. Create README.txt
$Readme = @"
========================================================================
                      PROASSIST AI WORKSTATION
        Private, Local-First Professional Intelligence Platform
========================================================================

HOW TO RUN:
Option A: Double-click 'ProAssist.exe' directly in this folder.
Option B: Run 'Install_ProAssist.bat' once to configure an isolated Python 
          environment and place a shortcut on your Desktop.

FEATURES INCLUDED:
1. Autonomous Coworkers:
   - Case Chronology & Litigation Analyst
   - Due Diligence & Contract Risk Auditor
   - Limitation & Court Deadline Tracker (with 1-Click .ics Calendar Sync)
   - Contract & Document Redline Analyzer (Comparative Diff Engine)
   - Client Advisory Memo Drafter
   - Tax & Financial Compliance Auditor
   - Executive Workspace Assistant
2. Interactive Citation Viewer:
   - Click any citation badge in chat or audit memos to inspect the exact 
     source passage, page number, and similarity score.
3. Calendar (.ics) Deadline Sync:
   - 1-click export of hearing dates, limitation periods, and milestones 
     into Outlook, Apple Calendar, or Google Calendar.
4. Document Comparison (Redline Diff):
   - Compares 2 contract versions or drafts to detect added covenants, 
     removed obligations, and shifted liabilities.
5. Global Command Palette (Ctrl + K):
   - Fast Spotlight search across all matters, coworkers, and actions.
6. Matter Tags & Status Badges:
   - Organize and filter matters with tags like #ActiveTrial, #TaxCompliance.
7. Optional Gated Web Verification:
   - Human-in-the-loop approval gate with offline PII redaction.

Local Workstation URL: http://localhost:8765
Privacy Guarantee: 100% Local-First. Documents never leave your device.
========================================================================
"@
Set-Content -Path (Join-Path $TargetDir "README.txt") -Value $Readme

# 7. Compress into ProAssist_Setup.zip in Downloads
Write-Host "`nCompressing package into $ZipTarget..." -ForegroundColor Yellow
if (Test-Path $ZipTarget) {
    Remove-Item -Force $ZipTarget
}
Compress-Archive -Path "$TargetDir\*" -DestinationPath $ZipTarget -CompressionLevel Optimal
Write-Host "[SUCCESS] ProAssist_Setup.zip created successfully!" -ForegroundColor Green

Write-Host "`nDelivery verified in:" -ForegroundColor Cyan
Get-ChildItem -Path $DownloadsDir -Filter "ProAssist*" | Format-Table Name, Length, LastWriteTime
