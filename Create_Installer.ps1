$DeployDir = "Saravonix_Deploy"
if (Test-Path $DeployDir) { Remove-Item -Recurse -Force $DeployDir }
New-Item -ItemType Directory -Path $DeployDir | Out-Null

# 1. Copy backend
New-Item -ItemType Directory -Path "$DeployDir\engine" | Out-Null
Copy-Item "engine\*.py" -Destination "$DeployDir\engine\"
Copy-Item "engine\requirements.txt" -Destination "$DeployDir\engine\"
Copy-Item -Recurse "engine\verticals" -Destination "$DeployDir\engine\"

# 2. Copy compiled UI
New-Item -ItemType Directory -Path "$DeployDir\ui" | Out-Null
Copy-Item -Recurse "ui\dist" -Destination "$DeployDir\ui\"

# 3. Create Install script
$InstallScript = @"
Write-Host "========================================="
Write-Host " Installing Saravonix AI Workstation"
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

Write-Host "`n[1/3] Creating isolated AI environment..."
Set-Location `$EngineDir
python -m venv .venv_312

Write-Host "`n[2/3] Downloading AI dependencies (this may take 5-10 minutes)..."
.\.venv_312\Scripts\python.exe -m pip install -r requirements.txt

Write-Host "`n[3/3] Creating Desktop Shortcut..."
`$WshShell = New-Object -comObject WScript.Shell
`$ShortcutPath = `"$([Environment]::GetFolderPath('Desktop'))\Saravonix.lnk`"
`$Shortcut = `$WshShell.CreateShortcut(`$ShortcutPath)
`$Shortcut.TargetPath = Join-Path `$PSScriptRoot "Launch_Saravonix.vbs"
`$Shortcut.WorkingDirectory = `$PSScriptRoot
`$Shortcut.IconLocation = "shell32.dll, 297"
`$Shortcut.Save()

Write-Host "`n========================================="
Write-Host " Installation Complete!"
Write-Host " You can now double-click 'Saravonix' on your Desktop."
Write-Host "========================================="
Pause
"@
Set-Content -Path "$DeployDir\Install.ps1" -Value $InstallScript

# 4. Create Launch script (VBS to hide console window)
$LaunchScriptVBS = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "engine"
WshShell.Run ".\.venv_312\Scripts\python.exe api.py", 0, False
WScript.Sleep 3000
WshShell.Run "http://localhost:8765"
"@
Set-Content -Path "$DeployDir\Launch_Saravonix.vbs" -Value $LaunchScriptVBS

# 5. Create a Readme
$Readme = @"
Saravonix Deployment Package

Instructions for Law Firm Staff:
1. Right-click 'Install.ps1' and select 'Run with PowerShell'.
2. Follow the on-screen prompts.
3. Once finished, double-click the 'Saravonix' icon on your Desktop to start the system.
"@
Set-Content -Path "$DeployDir\README.txt" -Value $Readme

Write-Host "Deployment package successfully created in: $DeployDir"
Write-Host "You can zip this folder and send it to the law firm!"
