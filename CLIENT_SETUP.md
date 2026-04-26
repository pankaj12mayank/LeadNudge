# Client setup guide

Install and run **LeadNudge** on a new machine. Windows steps are primary; Linux/macOS use the same commands with `source` instead of `Scripts\activate`.

**Related docs**

| Doc | Use for |
|-----|---------|
| **[`SIMPLE_START.md`](./SIMPLE_START.md)** | Short local vs server overview |
| **[`README.md`](./README.md)** | Features, env variable tables, architecture |
| **[`CI_CD_DEPLOYMENT_GUIDE.md`](./CI_CD_DEPLOYMENT_GUIDE.md)** | Production deploy + GitHub Actions from zero |

---

## B2B: you keep admin; clients get only the user portal

| Role | Access |
|------|--------|
| **You (vendor)** | **Admin** — workspaces, Team, branding, SMTP, logs, AI settings. |
| **Customer’s team** | **Workspace users** — same public URL, credentials you create. No admin. |

**Checklist:** deploy once → **Branding** → per client **Workspaces** + **Team** → send **only** user login + `https://your-domain`.

End clients **do not** use this install guide — browser only.

---

## Cheap domain + hosting (starter)

1. **Domain** — compare registrars / promos.
2. **VPS** — 1 vCPU, 1–2 GB RAM is enough for many pilots (API + static UI + optional Ollama), or split **static host** (Pages/Netlify) + **API** (Railway/Render/small VPS).
3. **HTTPS** — Caddy, nginx + Certbot, or Cloudflare proxy.
4. **Secrets** — strong `SECRET_KEY`, `CORS_ORIGINS` = real UI origins.

---

## 1. Prerequisites

| Tool | Notes |
|------|--------|
| **Python 3.11+** | [python.org](https://www.python.org/downloads/) — Windows: *Add to PATH*. |
| **Node.js 18+** | [nodejs.org](https://nodejs.org/) LTS. |
| **Ollama** (local AI) | [ollama.com](https://ollama.com) — then e.g. `ollama pull llama3.2` (match `OLLAMA_MODEL`, e.g. `llama3.2:latest`). |

---

## 2. Get the project

Clone or copy the **LeadNudge** project folder onto the machine. On Windows, **`start.bat`** in the repo root can create **`backend/.env`** from **`backend/.env.example`**, install dependencies, and start backend + frontend in one step.

---

## 3. Backend setup

### Windows (PowerShell or CMD)

```powershell
cd path\to\LeadNudge\backend
python -m venv ..\.venv
..\.venv\Scripts\activate
pip install -U pip
pip install -r requirements.txt
copy .env.example .env
```

### Linux / macOS

```bash
cd /path/to/LeadNudge/backend
python3 -m venv ../.venv
source ../.venv/bin/activate
pip install -U pip
pip install -r requirements.txt
cp .env.example .env
```

### Edit `backend/.env`

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | Long random string (**required** in production). |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | First admin (change after login). |
| `DATABASE_URL` | Default SQLite: `sqlite:///./app.db`. For Postgres use `postgresql+psycopg2://...` and install `psycopg2-binary`. |
| `PORT` or `BACKEND_PORT` | API port (`0` = auto from 8000 when using `run_prod.py` / `ports.env`). |
| `OLLAMA_URL` or `OLLAMA_BASE_URL` | Ollama HTTP base, e.g. `http://127.0.0.1:11434`. |
| `OLLAMA_MODEL` | e.g. `llama3.2:latest` (must exist in `ollama list`). |
| `MODE` | `local` = Ollama only; `api` = OpenAI allowed for **Pro** workspaces with API mode + key. |
| `OPENAI_API_KEY` | Optional global key. |
| `CORS_ORIGINS` | Extra UI origins, comma-separated (dev localhosts are often built-in). |

---

## 4. Frontend setup

### Windows

```powershell
cd path\to\LeadNudge\frontend
npm install
copy .env.example .env
```

### Linux / macOS

```bash
cd /path/to/LeadNudge/frontend
npm install
cp .env.example .env
```

### Edit `frontend/.env` (development)

- **`VITE_API_URL`** — Full backend origin, no path (e.g. `http://127.0.0.1:8000`). Leave unset to use Vite’s `/api` proxy (see `.env.example` and repo-root `.backend-port`).
- **`VITE_DEV_PORT`** — UI dev port (default `5173`).
- **`VITE_PROXY_TARGET`** — Override proxy target if needed.

### Production build (hosting)

Set the **public** API URL **at build time**:

```bash
cd frontend
export VITE_API_URL=https://api.yourdomain.com   # Linux/macOS
# Windows PowerShell: $env:VITE_API_URL="https://api.yourdomain.com"
npm ci
npm run build
```

Output: **`frontend/dist/`** — upload or serve from nginx/Caddy/Cloudflare Pages.

---

## 5. Run locally

### Windows — one click

From repo root:

```text
start.bat
```

Starts backend (`run_prod.py`), Vite dev server (minimized), checks Ollama, opens browser. Default UI: **http://localhost:5173**.

### Manual (any OS)

**Terminal 1 — API**

```bash
cd backend
source ../.venv/bin/activate    # or ..\.venv\Scripts\activate on Windows
python run_dev.py                 # hot reload, or run_prod.py for prod-style port file
```

**Terminal 2 — UI**

```bash
cd frontend
npm run dev
```

---

## 6. Admin login

1. Open the app URL.
2. Sign in with `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`.
3. **Branding** — set SMTP for transactional email (optional but recommended).

---

## 7. Workspaces and users

1. **Workspaces** — Free / Pro, expiry, limits.
2. **Team** — create **user** accounts (same URL as customers).
3. **Email templates** — optional customization.

---

## 8. Hosting on a server (production)

Use this after local setup works. Goal: **HTTPS**, stable API, static UI.

### 8.1 Layout

- **API:** Python venv on server, Uvicorn listening on **127.0.0.1:8000** (example).
- **UI:** `frontend/dist` served by **nginx** or **Caddy** on **443**.
- **TLS:** Let’s Encrypt (e.g. `certbot --nginx`).

### 8.2 Deploy steps (summary)

1. Clone repo to e.g. `/opt/LeadNudge`.
2. Create venv, `pip install -r backend/requirements.txt`.
3. Configure **`backend/.env`** (production `SECRET_KEY`, `CORS_ORIGINS`, `DATABASE_URL`, `OLLAMA_URL`, etc.).
4. On build machine or CI: `npm ci && VITE_API_URL=https://api.yourdomain.com npm run build` → deploy **`dist/`** to the web root.
5. **systemd** unit for Uvicorn (or `uvicorn main:app` from `backend/` with correct `WorkingDirectory`).
6. **nginx:** `location /` → static files; `location /` API host or separate `api.` subdomain → `proxy_pass http://127.0.0.1:8000`.
7. Restrict admin SSH; firewall **22**, **80**, **443** only as needed.

### 8.3 Ollama on the same VPS

Install Ollama, pull model, keep `OLLAMA_URL=http://127.0.0.1:11434` if the API runs on the same OS. If the API is in **Docker**, use the host-reachable URL (e.g. `http://host.docker.internal:11434` where supported).

### 8.4 Postgres (optional)

Set `DATABASE_URL=postgresql+psycopg2://user:pass@host/dbname`, install **`psycopg2-binary`** (see comment in `backend/requirements.txt`), redeploy.

### 8.5 Automating future deploys

Follow **[`CI_CD_DEPLOYMENT_GUIDE.md`](./CI_CD_DEPLOYMENT_GUIDE.md)** for GitHub Actions, SSH deploy, backups, and rollback.

---

## 9. Troubleshooting

| Issue | What to check |
|-------|----------------|
| **Module not found** | Same Python as venv; `pip install -r backend/requirements.txt`. |
| **CORS errors** | `CORS_ORIGINS` includes your exact UI origin (scheme + host + port). |
| **Wrong API port** | If `BACKEND_PORT=0`, read repo-root `.backend-port` or backend window; align `VITE_API_URL` / proxy. |
| **Ollama unreachable** | Service running; URL correct; Docker vs host `localhost` mismatch. |
| **No email** | Branding SMTP; **Logs** for `EMAIL` entries. |

---

For the shortest non-technical checklist, see **[`SIMPLE_START.md`](./SIMPLE_START.md)**.
