# CI/CD: zero → production deploy guide

This document is a **practical plan** to take **AI Sales Agent** from “changes on your laptop” to **repeatable deploys** on a live server. Adapt names (domain, user, paths) to your environment.

## What you are automating

| Piece | Typical approach |
|--------|------------------|
| **Frontend** | `npm run build` → static files (`frontend/dist/`) |
| **Backend** | `uvicorn` (or `run_prod.py`) + Python venv on the server |
| **Database** | SQLite file on disk *or* Postgres via `DATABASE_URL` |
| **Secrets** | **Never** in git — server env files or CI secrets |
| **AI (Free)** | Ollama on same VPS or reachable URL (`OLLAMA_URL` / `OLLAMA_BASE_URL`) |
| **AI (Pro)** | OpenAI when `MODE=api` + workspace keys |

---

## Phase 0 — Preconditions (once)

1. **Git repo** hosted (GitHub, GitLab, etc.) with this project.
2. **Server** (VPS) with Ubuntu 22.04+ or similar: public IP, SSH access, firewall allowing **80/443** (and **22** for SSH).
3. **Domain** DNS: `A` record → server IP (e.g. `app.example.com`, `api.example.com`).
4. **Local proof:** `pytest` passes in `backend/`, `npm run build` succeeds in `frontend/`.

---

## Phase 1 — Server layout (convention)

Suggested paths (as `deploy` user or your choice):

```text
/opt/ai-sales-agent/          # git clone / release directory
/opt/ai-sales-agent/.venv/    # Python virtualenv
/opt/ai-sales-agent/backend/.env
/opt/ai-sales-agent/frontend/dist/   # after build
```

**Environment files (not in git):**

- `backend/.env` — `SECRET_KEY`, `DATABASE_URL`, `BOOTSTRAP_ADMIN_*`, `CORS_ORIGINS`, `OLLAMA_URL`, `MODE`, etc.
- For **production** frontend you either:
  - **Rebuild on server** with `VITE_API_URL=https://api.example.com` before `npm run build`, or  
  - **Build in CI** and upload `dist/` only.

---

## Phase 2 — Manual deploy (first live cut)

Do this once manually so you know each step; then automate the same in CI.

### 2.1 Server packages

```bash
sudo apt update
sudo apt install -y python3.11 python3.11-venv nginx certbot python3-certbot-nginx nodejs npm
# Optional: Node 20 LTS via NodeSource if distro package is old
```

### 2.2 Clone and backend

```bash
cd /opt
sudo git clone https://github.com/YOUR_ORG/ai-sales-agent.git
sudo chown -R $USER:$USER ai-sales-agent
cd ai-sales-agent
python3.11 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
nano backend/.env   # set production values
```

### 2.3 Frontend build (production)

```bash
cd frontend
npm ci
echo 'VITE_API_URL=https://api.example.com' > .env.production.local
npm run build
```

### 2.4 Process manager (systemd) — API

Example `/etc/systemd/system/ai-sales-api.service`:

```ini
[Unit]
Description=AI Sales Agent API
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/ai-sales-agent/backend
Environment=PATH=/opt/ai-sales-agent/.venv/bin
ExecStart=/opt/ai-sales-agent/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ai-sales-api.service
```

*(If your app uses `run_prod.py`, point `ExecStart` to that instead; keep API bound to `127.0.0.1` and put TLS on nginx/Caddy.)*

### 2.5 Reverse proxy + TLS

**nginx:** site for `https://app.example.com` → `root` = `frontend/dist`, `location /api` or separate host `api.example.com` → `proxy_pass http://127.0.0.1:8000` (match how your frontend calls the API — usually full `VITE_API_URL` to `https://api.example.com` with CORS set).

```bash
sudo certbot --nginx -d app.example.com -d api.example.com
```

Set `CORS_ORIGINS` in `backend/.env` to your real UI origin(s), e.g. `https://app.example.com`.

### 2.6 Ollama on VPS (Free plan)

Install Ollama on the server, `ollama pull <model>`, set `OLLAMA_URL` (or `OLLAMA_BASE_URL`) to `http://127.0.0.1:11434` or the correct bind. If the API runs in **Docker** and Ollama on the **host**, use e.g. `http://host.docker.internal:11434` (where supported) or the host LAN IP.

---

## Phase 3 — CI: GitHub Actions (recommended shape)

Add `.github/workflows/deploy.yml` when ready. **Do not commit secrets** — use **GitHub → Settings → Secrets and variables → Actions**.

### 3.1 Secrets to create

| Secret | Purpose |
|--------|---------|
| `SSH_PRIVATE_KEY` | Deploy user’s ed25519/RSA private key |
| `SSH_HOST` | Server hostname or IP |
| `SSH_USER` | e.g. `deploy` |
| `DEPLOY_PATH` | e.g. `/opt/ai-sales-agent` |
| `VITE_API_URL` | e.g. `https://api.example.com` (for build) |

### 3.2 Workflow outline (conceptual)

1. **Trigger:** `push` to `main` (or `release` tags).
2. **Job `test`:** checkout → Python venv → `pip install -r backend/requirements.txt` → `pytest` in `backend/`.
3. **Job `build-frontend`:** `npm ci` in `frontend/` → create `.env.production` with `VITE_API_URL` from secret → `npm run build` → upload `frontend/dist` as artifact.
4. **Job `deploy`:** needs `test` + `build-frontend` → SSH to server → `git pull` (or rsync tarball) → `pip install -r backend/requirements.txt` → copy new `dist/` → `sudo systemctl restart ai-sales-api` → optional `nginx -s reload`.

Use `appleboy/ssh-action` or `rsync` over SSH; pin action versions by commit SHA in real repos.

### 3.3 Minimal `deploy.yml` skeleton (customize)

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r backend/requirements.txt
        working-directory: .
      - run: pytest -q
        working-directory: backend

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci && npm run build
        working-directory: frontend
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}

  # deploy:
  #   needs: build
  #   runs-on: ubuntu-latest
  #   steps:
  #     - ... rsync dist + git pull on server + systemctl restart ...
```

*(Add `package-lock.json` to the repo if you use `npm ci`; otherwise use `npm install` in CI.)*

---

## Phase 4 — Safe release habits

1. **Feature branch → PR → merge to `main`** → pipeline deploys.
2. **Database:** SQLite — back up `app.db` before deploy (`cp backend/app.db backend/app.db.bak`). For Postgres, use `pg_dump` on a schedule.
3. **Rollback:** keep previous `dist/` tarball or previous git tag; `systemctl restart` after `git checkout <tag>`.
4. **Smoke test after deploy:** open login, `/auth/me` as user, one read-only API check.
5. **Logs:** `journalctl -u ai-sales-api -f` on the server.

---

## Phase 5 — Optional next steps

- **Postgres:** set `DATABASE_URL=postgresql+psycopg2://...`, install `psycopg2-binary`, run migrations/init as per your process.
- **Docker:** one image for API + volume for DB; separate static hosting for UI — add `Dockerfile` + `docker-compose.yml` when you standardize on containers.
- **Staging:** second server or `staging` branch → `staging.example.com` with its own `.env`.

---

## Doc map

| File | Role |
|------|------|
| [`README.md`](./README.md) | Overview, config tables, features |
| [`CLIENT_SETUP.md`](./CLIENT_SETUP.md) | Detailed install (local + server) |
| [`SIMPLE_START.md`](./SIMPLE_START.md) | Short checklist for operators |
| **This file** | CI/CD and production deploy |

When this pipeline is in place, **every merge to `main`** (or your chosen branch) can ship the same steps you did manually — with tests first, then build, then deploy.
