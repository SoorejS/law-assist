Write-Host "========================================="
Write-Host " Installing Saravonix AI Workstation"
Write-Host "========================================="

$EngineDir = Join-Path $PSScriptRoot "engine"

# Check Python
if (!(Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Python is not installed or not in PATH."
    Write-Host "Please download Python 3.12 from python.org, run the installer,"
    Write-Host "make sure to check 'Add Python to PATH', and try again."
    Pause
    exit
}

Write-Host "
[1/3] Creating isolated AI environment..."
Set-Location $EngineDir
python -m venv .venv_312

Write-Host "
[2/3] Downloading AI dependencies (this may take 5-10 minutes)..."
.\.venv_312\Scripts\python.exe -m pip install -r requirements.txt

Write-Host "
[3/3] Creating Desktop Shortcut..."
$WshShell = New-Object -comObject WScript.Shell
$ShortcutPath = "C:\Users\soore\OneDrive\Desktop\Saravonix.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = Join-Path $PSScriptRoot "Launch_Saravonix.vbs"
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.IconLocation = "shell32.dll, 297"
$Shortcut.Save()

Write-Host "
========================================="
Write-Host " Installation Complete!"
Write-Host " You can now double-click 'Saravonix' on your Desktop."
Write-Host "========================================="
Pause
