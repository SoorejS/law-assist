# law-assist — Deployment Guide

## Objective 2: Deploy Landing Page to Vercel

### Prerequisites
- A Vercel account (free at https://vercel.com)
- The `landing/` directory (already built and verified)

---

### Step 1: Install Vercel CLI

```powershell
npm install -g vercel
```

### Step 2: Login to Vercel

```powershell
vercel login
```

Select your preferred login method (GitHub recommended). This will open a browser window for authentication.

### Step 3: Deploy the Landing Page

```powershell
# Navigate to the landing directory
cd C:\Users\soore\Agentic_RAG_Local\Agentic_RAG_Local\landing

# Deploy to Vercel (first time — will ask a few questions)
vercel deploy --prod
```

**When prompted:**
- "Set up and deploy?" → **Y**
- "Which scope?" → Select your account
- "Link to existing project?" → **N** (create new)
- "What's your project's name?" → **law-assist-landing**
- "In which directory is your code located?" → **./` (current)
- "Want to modify these settings?" → **N**

### Step 4: Add Custom Domain

1. Go to https://vercel.com/dashboard → click your `law-assist-landing` project
2. Go to **Settings → Domains**
3. Add: `law-assist.com`
4. Add: `www.law-assist.com`
5. Follow Vercel's DNS instructions to point your domain's nameservers or A records

### Step 5: Environment Variables (if needed)

No environment variables are required — the landing page is fully static.

---

## Quick Deploy Command (After First Setup)

```powershell
cd C:\Users\soore\Agentic_RAG_Local\Agentic_RAG_Local\landing
vercel --prod
```

---

## Hosting Release Artifacts

### Option A: GitHub Releases (Free, Recommended)

1. Create a GitHub repository: `law-assist/releases`
2. Go to **Releases → Draft a new release**
3. Tag: `v1.0.0`
4. Upload all files from `releases/v1.0.0/`
5. The download URLs will be:
   ```
   https://github.com/law-assist/releases/releases/download/v1.0.0/law-assist-1.0.0-Portable.zip
   https://github.com/law-assist/releases/releases/download/v1.0.0/law-assist-1.0.0-Setup.msi
   ```

### Option B: Cloudflare R2 (Recommended for Production)

1. Login to Cloudflare dashboard → R2 → Create Bucket `law-assist-releases`
2. Upload files from `releases/v1.0.0/`
3. Enable public access → set custom domain: `releases.law-assist.com`
4. Update `releases/release.json` with the public URLs

### Updating release.json with Real URLs

After uploading artifacts, update `releases/release.json`:

```json
{
  "version": "1.0.0",
  "msi": "https://releases.law-assist.com/v1.0.0/law-assist-1.0.0-Setup.msi",
  "exe": "https://releases.law-assist.com/v1.0.0/law-assist-1.0.0-Setup.exe",
  "zip": "https://releases.law-assist.com/v1.0.0/law-assist-1.0.0-Portable.zip",
  "iso": "https://releases.law-assist.com/v1.0.0/law-assist-1.0.0-Enterprise.iso"
}
```

Then commit and Vercel will auto-redeploy.

---

## Objective 3: Validation Checklist

### Local Engine Validation

```powershell
# Start the engine
cd C:\Users\soore\Agentic_RAG_Local\Agentic_RAG_Local\engine
.\.venv_312\Scripts\python.exe api.py

# In a new PowerShell window, run validation
Invoke-WebRequest http://localhost:8765/health | ConvertFrom-Json
```

Expected response:
```json
{ "status": "ok", "version": "1.0.0", "app": "law-assist" }
```

### Portable ZIP Validation

1. Extract `releases/v1.0.0/law-assist-1.0.0-Portable.zip` to a test folder
2. Double-click `law-assist.bat`
3. Verify browser opens at `http://localhost:8765`
4. Complete setup wizard
5. Create a test notebook
6. Upload a PDF
7. Ask a question and verify answer

### Landing Page Validation

```powershell
cd C:\Users\soore\Agentic_RAG_Local\Agentic_RAG_Local\landing
npm run preview
```

Open `http://localhost:4173` and verify:
- [ ] Hero section loads with animated app mockup
- [ ] "Download for Windows" button navigates to `/download`
- [ ] Download page shows 4 artifact cards
- [ ] FAQ accordion works
- [ ] Mobile responsive layout works

### MSI/NSIS Installer Validation (after Tauri build)

1. Run `law-assist-1.0.0-Setup.msi` on a clean Windows VM
2. Verify: Start Menu shortcut appears
3. Verify: Application launches on first click
4. Verify: AI model downloads on first launch
5. Verify: Setup wizard completes successfully

---

## Tauri Build Workaround (Windows Defender Issue)

The Tauri/Rust build is blocked by Windows Defender's real-time protection.

**Permanent fix:**
1. Open Windows Security → Virus & threat protection → Manage settings
2. Under "Exclusions", click "Add or remove exclusions"
3. Add folder: `C:\Users\soore\Agentic_RAG_Local\Agentic_RAG_Local\ui\src-tauri\target`
4. Add folder: `%USERPROFILE%\.cargo`
5. Restart PowerShell
6. Run: `npm run tauri build` in `ui/`

**Alternative: Build in WSL2**
```bash
# In WSL2
cd /mnt/c/Users/soore/Agentic_RAG_Local/Agentic_RAG_Local/ui
cargo install tauri-cli
cargo tauri build
```
