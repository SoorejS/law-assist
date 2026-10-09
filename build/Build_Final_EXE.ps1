# ProAssist - Full, Clean, Verified EXE Build
# Rebuilds EVERYTHING from source in the correct order so no stale UI can leak in:
#   1. React UI (ui/dist)            -> fresh hashed bundle
#   2. Engine exe (PyInstaller)      -> embeds the fresh ui/dist
#   3. Launcher exe (ProAssist.exe)
#   4. portable_staging              -> wiped & refilled
#   5. NSIS installer (ProAssist-Setup.exe)
#   6. Verification: the bundle hash inside staging must match ui/dist
#   7. Copies final artifacts to Downloads
# Run from repo root:  powershell -ExecutionPolicy Bypass -File build\Build_Final_EXE.ps1

$ErrorActionPreference = "Stop"
$ROOT      = Split-Path -Parent $PSScriptRoot
$UI        = Join-Path $ROOT "ui"
$ENGINE    = Join-Path $ROOT "engine"
$BUILD     = Join-Path $ROOT "build"
$STAGING   = Join-Path $BUILD "portable_staging"
$ENGINE_DIST   = Join-Path $BUILD "engine_dist"
$LAUNCHER_DIST = Join-Path $BUILD "launcher_dist"
$WORK      = Join-Path $BUILD "pyinstaller_work"
$RELEASES  = Join-Path $ROOT "releases"
$DOWNLOADS = Join-Path $env:USERPROFILE "Downloads"
$PY        = Join-Path $ENGINE ".venv_312\Scripts\python.exe"

function Step($n, $msg) { Write-Host "`n[$n/7] $msg" -ForegroundColor Yellow }
function Ok($msg)       { Write-Host "      OK  $msg" -ForegroundColor Green }
function Fail($msg)     { Write-Host "      FAIL $msg" -ForegroundColor Red; exit 1 }

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  ProAssist FINAL EXE build  $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# 0. Stop running copies so files aren't locked and port 8765 is freed
Get-Process law-assist-engine, ProAssist -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# 1. UI
Step 1 "Building React UI from source"
Push-Location $UI
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "UI build failed" }
Pop-Location
$uiJs = (Get-ChildItem (Join-Path $UI "dist\assets") -Filter "index-*.js" | Select-Object -First 1).Name
Ok "UI bundle: $uiJs"

# 2. Engine exe
Step 2 "Packaging engine with PyInstaller (embeds fresh UI)"
if (-not (Test-Path $PY)) { Fail "Python venv not found at $PY" }
Push-Location $ENGINE
& $PY -m PyInstaller --noconfirm --clean --distpath $ENGINE_DIST --workpath $WORK "law-assist-engine.spec"
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "Engine PyInstaller failed" }
Pop-Location
Ok "Engine: $((Get-Item (Join-Path $ENGINE_DIST 'law-assist-engine.exe')).LastWriteTime)"

# 3. Launcher exe
Step 3 "Packaging ProAssist.exe launcher"
Push-Location $ENGINE
& $PY -m PyInstaller --noconfirm --clean --distpath $LAUNCHER_DIST --workpath (Join-Path $WORK "launcher") "ProAssist.spec"
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "Launcher PyInstaller failed" }
Pop-Location
Ok "Launcher: $((Get-Item (Join-Path $LAUNCHER_DIST 'ProAssist.exe')).LastWriteTime)"

# 4. Staging (wipe & refill - preserves icons and .env)
Step 4 "Refreshing portable_staging"
$keepIcon = Join-Path $BUILD "icon_backup.ico"
if (Test-Path "$STAGING\icons\icon.ico") { Copy-Item "$STAGING\icons\icon.ico" $keepIcon -Force }
$keepEnv  = Join-Path $BUILD "env_backup"
if (Test-Path "$STAGING\engine\.env") { Copy-Item "$STAGING\engine\.env" $keepEnv -Force }

if (Test-Path $STAGING) { Remove-Item -Recurse -Force $STAGING }
New-Item -ItemType Directory -Force -Path "$STAGING\engine\models", "$STAGING\engine\data", "$STAGING\icons" | Out-Null

Copy-Item (Join-Path $ENGINE_DIST "law-assist-engine.exe") "$STAGING\engine\"
Copy-Item (Join-Path $ENGINE "verticals") "$STAGING\engine\" -Recurse
if (Test-Path $keepEnv) { Copy-Item $keepEnv "$STAGING\engine\.env" } else { Copy-Item (Join-Path $ENGINE ".env.example") "$STAGING\engine\.env" -ErrorAction SilentlyContinue }
Copy-Item (Join-Path $UI "dist") "$STAGING\ui" -Recurse
Copy-Item (Join-Path $LAUNCHER_DIST "ProAssist.exe") "$STAGING\"
if (Test-Path $keepIcon) { Copy-Item $keepIcon "$STAGING\icons\icon.ico" }
Ok "Staging refreshed"

# 5. NSIS installer
Step 5 "Building ProAssist-Setup.exe (NSIS)"
$makensis = (Get-Command makensis -ErrorAction SilentlyContinue).Source
if (-not $makensis) { $makensis = "C:\Program Files (x86)\NSIS\makensis.exe" }
if (-not (Test-Path $makensis)) { Fail "makensis not found" }
New-Item -ItemType Directory -Force -Path $RELEASES | Out-Null
Push-Location $BUILD
& $makensis /V2 "installer.nsi"
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "NSIS failed" }
Pop-Location
Ok "Installer: $((Get-Item (Join-Path $RELEASES 'ProAssist-Setup.exe')).LastWriteTime)"

# 6. Verify the newest UI is really inside the package
Step 6 "Verifying the packaged UI matches the fresh build"
$stagedJs = (Get-ChildItem "$STAGING\ui\assets" -Filter "index-*.js" | Select-Object -First 1).Name
if ($stagedJs -ne $uiJs) { Fail "Staged UI ($stagedJs) != fresh UI ($uiJs)" }
$content = Get-Content (Join-Path $UI "dist\assets\$uiJs") -Raw
foreach ($marker in @("Display & Reading Preferences", "data-font-family")) {
    if ($content -notlike "*$marker*") { Fail "Marker '$marker' missing from UI bundle" }
}
Ok "Packaged UI = $stagedJs (contains Display & Reading Preferences)"

# 7. Deliver
Step 7 "Copying final artifacts to Downloads"
Copy-Item (Join-Path $RELEASES "ProAssist-Setup.exe") (Join-Path $DOWNLOADS "ProAssist-Setup.exe") -Force
Copy-Item (Join-Path $LAUNCHER_DIST "ProAssist.exe") (Join-Path $DOWNLOADS "ProAssist.exe") -Force
Ok "Delivered to $DOWNLOADS"

Write-Host "`n==============================================" -ForegroundColor Green
Write-Host "  BUILD COMPLETE - all artifacts are fresh" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Get-Item (Join-Path $DOWNLOADS "ProAssist-Setup.exe"), (Join-Path $DOWNLOADS "ProAssist.exe") | Format-Table Name, Length, LastWriteTime -AutoSize
