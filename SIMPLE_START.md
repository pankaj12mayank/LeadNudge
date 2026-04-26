# Simple start

Quick paths for **local** development vs **hosting on a server**. Full detail: **[`CLIENT_SETUP.md`](./CLIENT_SETUP.md)** · technical overview: **[`README.md`](./README.md)** · **deploy & CI/CD:** **[`CI_CD_DEPLOYMENT_GUIDE.md`](./CI_CD_DEPLOYMENT_GUIDE.md)**

---

## Who this guide is for

| You are… | What you do |
|----------|-------------|
| **The seller / operator (B2B)** | Install and run the stack (or deploy to a VPS). Keep **admin** login **only with you**. Create **workspaces** and **user** accounts for each client. |
| **Your client (their sales team)** | No Python/Node install. You give them a **link** (your domain) and **user** email + password. They use Leads / Follow-ups only — not admin. |

**B2B:** Admin access stays with you. Clients never get the admin password.

---

## A) Local setup — Windows (easiest)

### One-time

1. **Python 3.11+** — [python.org](https://www.python.org/downloads/) — tick *Add to PATH*.
2. **Node.js 18+ LTS** — [nodejs.org](https://nodejs.org/).
3. **Ollama** — [ollama.com](https://ollama.com); then e.g. `ollama pull llama3.2` (match `OLLAMA_MODEL` in `backend/.env`, often `llama3.2:latest`).
4. Put the **LeadNudge** project folder somewhere easy (Desktop, etc.).
5. **First run:** double-click **`start.bat`** — it creates **`backend/.env`** from **`backend/.env.example`** if missing, installs deps, then starts the stack. For manual setup instead, see **[`CLIENT_SETUP.md`](./CLIENT_SETUP.md) → section 3**.
6. **Frontend (optional manual):** `cd frontend` → `npm install` or `npm ci` → copy `frontend/.env.example` to `frontend/.env` if needed.

### Every time you run locally

1. Double-click **`start.bat`** in the **repo root** (folder that contains `start.bat`).
2. Wait a few seconds; browser may open **http://localhost:5173** (or your `VITE_DEV_PORT`).
3. If not, open that URL manually.
4. Sign in with admin credentials from **`backend/.env`**.

**Troubleshooting:** read the minimized **Backend** / **Frontend** console windows on the taskbar; see **`CLIENT_SETUP.md`**.

---

## B) Local setup — Mac or Linux

Same prerequisites (Python 3.11+, Node 18+, Ollama). Use a terminal:

```bash
cd /path/to/LeadNudge/backend
python3 -m venv ../.venv
source ../.venv/bin/activate   # Windows venv: ..\.venv\Scripts\activate
pip install -U pip
pip install -r requirements.txt
cp .env.example .env           # edit: SECRET_KEY, BOOTSTRAP_ADMIN_*, OLLAMA_URL, etc.

cd ../frontend
npm install
cp .env.example .env           # optional for dev; see file comments

# Terminal 1
cd ../backend && source ../.venv/bin/activate && python run_dev.py

# Terminal 2
cd ../frontend && npm run dev
```

Open the URL Vite prints (usually **http://localhost:5173**).

---

## C) Hosting on a server (production)

Use this when clients hit **your domain** (HTTPS), not `localhost`.

**Short checklist:**

1. **VPS** (or PaaS) + **domain** DNS pointed to it.
2. On the server: clone repo, **venv**, `pip install -r backend/requirements.txt`, **`backend/.env`** with production `SECRET_KEY`, `CORS_ORIGINS`, `DATABASE_URL`, `OLLAMA_URL` (or host Ollama separately).
3. **Build frontend** with public API URL, e.g.  
   `VITE_API_URL=https://api.yourdomain.com npm run build`  
   → serve **`frontend/dist`** with **nginx** or **Caddy** (HTTPS).
4. Run API with **systemd** + **Uvicorn** (or `run_prod.py`) behind the reverse proxy.
5. **Ollama:** same machine as API, or set `OLLAMA_URL` / `OLLAMA_BASE_URL` to a reachable address (Docker users: often `http://host.docker.internal:11434` on Windows/Mac hosts).

**Step-by-step server commands, nginx/TLS, and systemd examples:** **[`CLIENT_SETUP.md`](./CLIENT_SETUP.md) → “Hosting on a server”**.

**Automating deploys (GitHub Actions, secrets, rollback):** **[`CI_CD_DEPLOYMENT_GUIDE.md`](./CI_CD_DEPLOYMENT_GUIDE.md)**.

---

## Selling B2B: domain + what you give the client

1. Cheap **domain** + **small VPS** (or static frontend + small API host) — see **README** and **CLIENT_SETUP**.
2. **HTTPS** (Let’s Encrypt / Cloudflare).
3. Per client: **Workspaces** + **Team** users → send **only** `https://yourdomain.com` and **user** login — not admin.

---

## What your client needs (no install)

- A browser, your **link**, and **user** email/password from **Team** — **not** the admin login.

---

## If something does not work

- **`start.bat`:** check Backend/Frontend windows on the taskbar.
- **`CLIENT_SETUP.md`** — full troubleshooting and env tables.
- **API in Docker + Ollama on PC:** `localhost` inside the container is not your PC — set **`OLLAMA_URL`** to the host gateway (e.g. `host.docker.internal`).
