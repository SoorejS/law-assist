# law-assist — Administrator Guide

## Overview

The law-assist Admin is responsible for:
- Creating and managing user accounts
- Assigning matters to users
- Managing backups
- Monitoring system health

---

## Accessing the Admin Panel

1. Log in with an `admin` or `senior_partner` account
2. Click your profile icon → **Admin Settings**
3. The admin panel is at `http://localhost:8765/admin` (API-based)

---

## User Management

### Creating a New User

**Via UI:**
1. Admin Panel → Users → Add User
2. Fill in username, full name, email, role
3. The user can change their password on first login

**Via API (curl):**
```bash
curl -X POST http://localhost:8765/users \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "priya.sharma",
    "password": "TempPass123!",
    "full_name": "Priya Sharma",
    "email": "priya@firm.com",
    "role": "associate"
  }'
```

### User Roles

| Role | Can Create Matters | Can Upload | Can Query | Can Delete | Can Admin |
|------|-------------------|------------|-----------|------------|-----------|
| `admin` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `senior_partner` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `associate` | ✓ | ✓ | ✓ | ✗ | ✗ |
| `paralegal` | ✗ | ✗ | ✓ | ✗ | ✗ |
| `intern` | ✗ | ✗ | ✓ (limited) | ✗ | ✗ |

### Resetting a Password

```bash
curl -X POST http://localhost:8765/users/{user_id}/password \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"new_password": "NewSecurePass123!"}'
```

### Deactivating a User

```bash
curl -X DELETE http://localhost:8765/users/{user_id} \
  -H "Authorization: Bearer <admin_token>"
```

---

## Matter Access Control

By default, Admins and Senior Partners can see all matters. Associates, Paralegals, and Interns only see matters they've been explicitly granted access to.

### Grant access:
```bash
curl -X POST "http://localhost:8765/matters/{matter_id}/access/{user_id}?permission=read" \
  -H "Authorization: Bearer <admin_token>"
```

### Permission levels:
- `read` — Can query and view
- `write` — Can also upload documents
- `admin` — Can also delete documents

---

## Configuration

### Environment Variables (`.env` file in `engine/`)

```env
# LLM Backend: "local" | "sarvam" | "anthropic"
LLM_BACKEND=local

# Sarvam AI (optional — Indian sovereign cloud)
SARVAM_API_KEY=your_key_here

# Upload limits
MAX_UPLOAD_MB=150

# Session length in hours
JWT_EXPIRY_HOURS=8

# Number of retrieval results
TOP_K=6
```

### Changing the AI Backend

To switch to Sarvam AI for better quality answers on complex multi-document questions:

1. Get your API key from [sarvam.ai](https://sarvam.ai)
2. Add to `engine/.env`:
   ```
   LLM_BACKEND=sarvam
   SARVAM_API_KEY=sk_...
   ```
3. Restart law-assist

---

## System Health Monitoring

Check engine status:
```bash
curl http://localhost:8765/health
```

Response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "llm_backend": "local",
  "license": { "status": "active", "seat_count": 5 }
}
```

---

## Scheduled Backups

Create a scheduled task to run daily backups:

```powershell
# In PowerShell as Administrator
$action = New-ScheduledTaskAction -Execute "powershell" -Argument "-File C:\law-assist\backup.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "law-assist-backup"
```

See `BACKUP.md` for the backup script.
