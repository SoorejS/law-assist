# Create LawAssist Standalone Build Package in a separate directory

$TargetDir = "c:\Users\soore\LawAssist_Standalone"

Write-Host "========================================="
Write-Host " Building LawAssist Standalone Package"
Write-Host " Target Directory: $TargetDir"
Write-Host "========================================="

if (Test-Path $TargetDir) {
    Remove-Item -Recurse -Force $TargetDir
}
New-Item -ItemType Directory -Path $TargetDir | Out-Null

# 1. Copy engine files
New-Item -ItemType Directory -Path "$TargetDir\engine" | Out-Null
Copy-Item "engine\*.py" -Destination "$TargetDir\engine\"
Copy-Item "engine\requirements.txt" -Destination "$TargetDir\engine\"

# Copy verticals
New-Item -ItemType Directory -Path "$TargetDir\engine\verticals" | Out-Null
Copy-Item "engine\verticals\*.yaml" -Destination "$TargetDir\engine\verticals\"

# Pre-set LawAssist environment
$EnvContent = @"
SARAVONIX_VERTICAL=law_firm
LLM_BACKEND=local
EMBEDDING_MODEL=BAAI/bge-m3
CHUNK_SIZE_WORDS=400
CHUNK_OVERLAP_WORDS=60
TOP_K=6
SIMILARITY_THRESHOLD=1.0
API_HOST=0.0.0.0
API_PORT=8765
JWT_SECRET=lawassist_secure_secret_2026
LICENSE_ENABLED=false
"@
Set-Content -Path "$TargetDir\engine\.env" -Value $EnvContent

# 2. Copy compiled UI
New-Item -ItemType Directory -Path "$TargetDir\ui" | Out-Null
Copy-Item -Recurse "ui\dist" -Destination "$TargetDir\ui\"

# 3. Create Install Script for LawAssist
$InstallScript = @"
Write-Host "========================================="
Write-Host " Installing LawAssist AI Workstation"
Write-Host " Private Legal Intelligence Platform"
Write-Host "========================================="

`$EngineDir = Join-Path `$PSScriptRoot "engine"

# Check Python
if (!(Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Python is not installed or not in PATH."
    Write-Host "Please download Python 3.12 from python.org, run the installer,"
    Write-Host "make sure to check 'Add Python to PATH', and try again."
    Pause
    exit
}

Write-Host "`n[1/3] Creating isolated LawAssist AI environment..."
Set-Location `$EngineDir
python -m venv .venv_312

Write-Host "`n[2/3] Installing LawAssist AI dependencies..."
.\.venv_312\Scripts\python.exe -m pip install -r requirements.txt

Write-Host "`n[3/3] Creating Desktop Shortcut..."
`$WshShell = New-Object -comObject WScript.Shell
`$ShortcutPath = `"$([Environment]::GetFolderPath('Desktop'))\LawAssist.lnk`"
`$Shortcut = `$WshShell.CreateShortcut(`$ShortcutPath)
`$Shortcut.TargetPath = Join-Path `$PSScriptRoot "Launch_LawAssist.vbs"
`$Shortcut.WorkingDirectory = `$PSScriptRoot
`$Shortcut.IconLocation = "shell32.dll, 297"
`$Shortcut.Save()

Write-Host "`n========================================="
Write-Host " LawAssist Installation Complete!"
Write-Host " Double-click 'LawAssist' on your Desktop to launch."
Write-Host "========================================="
Pause
"@
Set-Content -Path "$TargetDir\Install_LawAssist.ps1" -Value $InstallScript

# 4. Create VBS Launcher for LawAssist
$LaunchScriptVBS = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "engine"
WshShell.Run ".\.venv_312\Scripts\python.exe api.py", 0, False
WScript.Sleep 3000
WshShell.Run "http://localhost:8765"
"@
Set-Content -Path "$TargetDir\Launch_LawAssist.vbs" -Value $LaunchScriptVBS

# 5. Create Readme
$Readme = @"
LawAssist — Standalone Deployment Package

Instructions for Law Firm Staff:
1. Right-click 'Install_LawAssist.ps1' and select 'Run with PowerShell'.
2. Follow the on-screen prompts.
3. Once completed, double-click the 'LawAssist' shortcut created on your Desktop.
"@
Set-Content -Path "$TargetDir\README.txt" -Value $Readme

Write-Host "`n========================================="
Write-Host " SUCCESS: LawAssist Standalone built!"
Write-Host " Location: $TargetDir"
Write-Host "========================================="
