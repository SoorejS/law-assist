# law-assist — Backup and Recovery Guide

## What to Back Up

law-assist stores all data in a single SQLite file:

```
engine/data/memory.db
```

This file contains:
- All ingested document chunks and their vector embeddings
- Chat history (all conversations)
- User accounts and roles
- Matter (notebook) metadata

**Also back up:**
- `engine/.env` — your API keys and configuration
- `engine/models/` — AI model files (large, only needed if you don't want to re-download)

---

## Automated Daily Backup Script

Create `backup.ps1` in your law-assist folder:

```powershell
# law-assist Daily Backup Script
# Run this as a Scheduled Task

$LAW_ASSIST_DIR = "C:\law-assist\engine"
$BACKUP_DIR = "D:\lawassist-backups"  # Change to your backup drive
$DATE = Get-Date -Format "yyyy-MM-dd"
$BACKUP_PATH = "$BACKUP_DIR\$DATE"

# Create dated backup directory
New-Item -ItemType Directory -Force -Path $BACKUP_PATH

# Stop the engine gracefully (optional — SQLite WAL mode allows hot backup)
# Stop-Service law-assist

# Copy the database
Copy-Item "$LAW_ASSIST_DIR\data\memory.db" "$BACKUP_PATH\memory.db"
Copy-Item "$LAW_ASSIST_DIR\.env" "$BACKUP_PATH\.env.bak"

# Verify backup integrity
$size = (Get-Item "$BACKUP_PATH\memory.db").Length
if ($size -gt 0) {
    Write-Host "[$(Get-Date)] Backup successful: $BACKUP_PATH\memory.db ($size bytes)" -ForegroundColor Green
} else {
    Write-Host "[$(Get-Date)] ERROR: Backup file is empty!" -ForegroundColor Red
    exit 1
}

# Clean up backups older than 30 days
Get-ChildItem $BACKUP_DIR -Directory | Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Recurse -Force

Write-Host "[$(Get-Date)] Old backups cleaned up." -ForegroundColor Cyan
```

### Schedule it:
```powershell
$action = New-ScheduledTaskAction -Execute "powershell" -Argument "-File C:\law-assist\backup.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "law-assist-daily-backup" -RunLevel Highest
```

---

## Manual Backup

```powershell
# Single command backup with timestamp
$ts = Get-Date -Format "yyyyMMdd-HHmm"
Copy-Item "C:\law-assist\engine\data\memory.db" "D:\backup\lawassist-$ts.db"
```

---

## Recovery Procedures

### Restore from Backup

1. **Stop law-assist** (close the application)
2. Navigate to `engine/data/`
3. Rename current `memory.db` → `memory.db.old`
4. Copy the backup `memory.db` into `engine/data/`
5. Restart law-assist

```powershell
# PowerShell recovery commands
Stop-Process -Name "law-assist" -Force -ErrorAction SilentlyContinue
Rename-Item "C:\law-assist\engine\data\memory.db" "memory.db.old"
Copy-Item "D:\backup\lawassist-20260617-0200.db" "C:\law-assist\engine\data\memory.db"
Start-Process "C:\law-assist\law-assist.exe"
```

### Disaster Recovery (Fresh Machine)

1. Install law-assist on the new machine
2. Do not complete the setup wizard yet
3. Copy your backed-up `memory.db` to `engine/data/memory.db`
4. Copy your backed-up `.env` to `engine/.env`
5. Launch law-assist — it will recognize the existing database and skip setup

---

## Database Integrity Check

```powershell
# Verify the database isn't corrupted
$result = & sqlite3 "C:\law-assist\engine\data\memory.db" "PRAGMA integrity_check;"
if ($result -eq "ok") {
    Write-Host "Database integrity: OK" -ForegroundColor Green
} else {
    Write-Host "Database may be corrupted: $result" -ForegroundColor Red
}
```

---

## Backup Size Estimates

| Firm Size | Documents | Est. DB Size |
|-----------|-----------|-------------|
| Small (1–3 lawyers) | < 500 pages | < 50 MB |
| Medium (5–15 lawyers) | 500–5000 pages | 50–500 MB |
| Large (15+ lawyers) | 5000+ pages | 500 MB–2 GB |

Vector embeddings are stored as 1024-dimensional float32 vectors (~4KB per chunk, ~25 chunks per page).
