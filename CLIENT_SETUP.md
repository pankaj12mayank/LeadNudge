# Client setup guide

Step-by-step instructions to install and run the **AI Sales Agent** console on a new machine (Windows-focused; Linux/macOS steps are similar).

## B2B plan: you keep admin, clients get only the user portal

Use this when you **sell the system to businesses** and want **low-cost hosting** on your own domain.

| Role | Access |
|------|--------|
| **You (vendor / operator)** | Full **admin** — workspaces, Team users, branding, SMTP, logs, AI settings. Admin credentials live only with you. |
| **Your customer’s team** | **Workspace users** only — after login they see Leads, Follow-ups, mail, profile, etc. They use the **same public URL** as you, but with **user** accounts you create. They do **not** need admin and should not receive admin passwords. |

**Operational checklist:**

1. Deploy once to your **cheapest suitable** server + domain (see **README → Deployment** and “Cheap domain hosting plan” below).
2. In admin: **Branding** — set product name/logo so the login page looks like **your** product for all clients (or one brand per deployment if you run separate installs per client).
3. Per client company: **Workspaces** → new workspace → **Team** → create users → send them **only** `https://your-domain.com` (or your chosen path) + user credentials.
4. Optional: use **workspace name / plan / limits** to separate clients on one server (multi-tenant) or run **one VPS per big client** if they pay for isolation.

**End clients do not follow this file for installation** — they only need a browser. This guide is for **you** installing and operating the stack.

## Cheap domain hosting plan (starter)

Goal: **minimum spend** while staying professional (HTTPS, your domain).

1. **Domain:** pick a budget registrar; often **\$1–\$15/year** on promo (prices change — compare `.com` / `.in` / your country TLD).
2. **Hosting:** smallest **VPS** (1 vCPU, 1–2 GB RAM) is enough for many small B2B pilots — run API + reverse proxy + optional Ollama on same box, or use **cloud LLM** (OpenAI) for Pro workspaces to avoid heavy GPU on the server.
3. **Frontend:** `npm run build` → serve `frontend/dist` via **Caddy** or **nginx** on the same VPS, or host static files on **Cloudflare Pages** / **Netlify** (often free tier) and point `VITE_API_URL` at your API subdomain (e.g. `api.yourdomain.com`).
4. **DNS:** `A` record to VPS IP, or CNAME to PaaS; enable **HTTPS**.
5. **Secrets:** strong `SECRET_KEY`, unique admin password, `CORS_ORIGINS` = your real UI origin(s).

You can start with **one cheap domain + one small VPS** for many workspace clients before upgrading.

## 1. Install prerequisites

1. **Python 3.11 or newer** — from [python.org](https://www.python.org/downloads/). During setup on Windows, enable **“Add python.exe to PATH”**.
2. **Node.js 18+** (includes npm) — from [nodejs.org](https://nodejs.org/).
3. **Ollama** (for local AI follow-ups) — from [ollama.com](https://ollama.com). After install, run once in a terminal:

   ```bash
   ollama pull llama3.2
   ```

   (Or another model; match the name in `backend/.env` as `OLLAMA_MODEL`.)

## 2. Get the project

Copy the `ai-sales-agent` folder to the machine (zip, git clone, or shared drive).

## 3. Backend setup

Open **PowerShell** or **Command Prompt**:

```powershell
cd path\to\ai-sales-agent\backend
python -m venv ..\.venv
..\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Edit **`backend\.env`**:

| Variable | What to set |
|----------|-------------|
| `SECRET_KEY` | Long random string (required for production). |
| `BOOTSTRAP_ADMIN_EMAIL` | First admin sign-in email. |
| `BOOTSTRAP_ADMIN_PASSWORD` | First admin password (change after first login). |
| `DATABASE_URL` | Default SQLite is fine: `sqlite:///./app.db`. |
| `PORT` or `BACKEND_PORT` | API port (often `8000`). |
| `OLLAMA_URL` | Usually `http://127.0.0.1:11434`. |
| `OLLAMA_MODEL` | e.g. `llama3.2` (must exist in Ollama). |
| `MODE` | `local` = only Ollama. `api` = allow OpenAI for **Pro** workspaces that use API mode and keys. |
| `OPENAI_API_KEY` | Optional; used when workspace is **Pro** and configured for API mode. |
| `CORS_ORIGINS` | Add your UI origin if not localhost (comma-separated). |

## 4. Frontend setup

```powershell
cd path\to\ai-sales-agent\frontend
npm install
copy .env.example .env
```

Edit **`frontend\.env`**:

- **`VITE_API_URL`** — Backend base URL, e.g. `http://127.0.0.1:8000` (no path suffix).  
  For local dev you can **leave it unset** to use the Vite `/api` proxy (see `VITE_PROXY_TARGET` in `.env.example`).
- **`VITE_DEV_PORT`** — Dev UI port (default `5173`).

## 5. Run the system

From the **`ai-sales-agent`** folder (repo root):

```text
start.bat
```

This starts the API, the Vite dev server (minimized windows), checks Ollama, and opens the browser at `http://localhost:5173`.

Manual alternative:

```powershell
# Terminal 1
cd backend
..\.venv\Scripts\activate
python run_dev.py

# Terminal 2
cd frontend
npm run dev
```

## 6. Admin login

1. Open the app URL (e.g. `http://localhost:5173`).
2. Sign in with **`BOOTSTRAP_ADMIN_EMAIL`** / **`BOOTSTRAP_ADMIN_PASSWORD`** from `backend\.env`.
3. Go to **Branding** (admin account) and configure **SMTP** if you want transactional emails (new user, password changed, password request acknowledgment, etc.).

## 7. Create a workspace and users

1. **Workspaces** — create a workspace; set plan **Free** or **Pro** (Pro allows OpenAI when `MODE=api` and workspace AI mode is API with a key).
2. **Team** — add users with email and password; they sign in on the same URL as **workspace users** (not admin).
3. Optional: **Email templates** — customize subjects and HTML bodies under **Email templates**.

## 8. Production build (optional)

```powershell
cd frontend
npm run build
```

Serve the `frontend/dist` static files with nginx, Caddy, or similar, and run the API with Uvicorn behind a process manager. Point `VITE_API_URL` at the public API URL in a **production** frontend env if you rebuild the bundle.

---

For a shorter, non-technical checklist, see **`SIMPLE_START.md`** in this folder.
