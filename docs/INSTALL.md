# law-assist v1.0.0 — Installation Guide

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | Windows 10 (64-bit) | Windows 11 (64-bit) |
| RAM | 8 GB | 16 GB |
| Storage | 5 GB free | 10 GB free |
| CPU | 4 cores x86-64 | 8 cores x86-64 |
| Internet | Not required | Not required |

---

## Installation Methods

### Option 1: Windows MSI Installer (Recommended)

1. Download `law-assist-1.0.0-Setup.msi` from [law-assist.com/download](https://law-assist.com/download)
2. Double-click the `.msi` file
3. Accept the installer prompts (no admin rights needed for per-user install)
4. law-assist will appear in your Start Menu
5. On first launch, the AI model (~1 GB) downloads automatically

### Option 2: NSIS EXE Installer

1. Download `law-assist-1.0.0-Setup.exe`
2. Run the installer — select install location and components
3. Start law-assist from the desktop shortcut

### Option 3: Portable ZIP (No Installation)

1. Download `law-assist-1.0.0-Portable.zip`
2. Extract to any folder (USB drive, Desktop, etc.)
3. Run `law-assist.exe` inside the extracted folder
4. No registry modifications. No admin rights.

### Option 4: Enterprise ISO (IT Deployment)

For silent deployment via Group Policy or SCCM:

```powershell
# Silent install (no UI)
msiexec /i "law-assist-1.0.0-Setup.msi" /quiet /norestart

# Silent install with custom data directory
msiexec /i "law-assist-1.0.0-Setup.msi" /quiet INSTALLDIR="C:\lawassist" DATADIR="D:\lawdata"
```

---

## First Launch Setup

1. **Start the engine**: Open law-assist — the engine starts automatically on port 8765
2. **Wait for model download**: The first launch downloads the AI model (~1 GB). Takes 2–5 minutes depending on connection speed.
3. **Initial Setup Screen**: Enter your firm name and create the first Admin account
4. **Create users**: In Settings → Users, add accounts for each member of your team

---

## Verifying Your Download

Open PowerShell and run:

```powershell
certutil -hashfile "law-assist-1.0.0-Setup.msi" SHA256
```

Compare the hash with the SHA256 values listed on the [download page](https://law-assist.com/download).

---

## Troubleshooting

**Engine won't start:**
- Ensure port 8765 is not blocked by Windows Firewall
- Check `engine/engine.log` for error details
- Try running `python api.py` manually in a terminal

**Model download fails:**
- Check your internet connection (only needed for the initial model download)
- Manually place the model file at `engine/models/model.gguf`

**"Database is locked" error:**
- Restart law-assist — this clears any stale connections
- Ensure only one instance of law-assist is running

**Antivirus blocks the application:**
- This is a false positive common with locally-compiled Python apps
- Add an exclusion for the law-assist installation folder in your antivirus settings
