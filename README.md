# AI Sales Agent — Sales follow-up console

Single-repo SaaS-style app: **FastAPI** backend, **React (Vite)** UI for **admin** and **workspace users**, multi-tenant **workspaces**, **local AI** via **Ollama**, and optional **OpenAI** for **Pro** plans.

**Documentation:** detailed setup → [`CLIENT_SETUP.md`](./CLIENT_SETUP.md) · plain-language steps → [`SIMPLE_START.md`](./SIMPLE_START.md)

## B2B model (sell to clients — user portal only)

Typical go-to-market:

- **You (vendor)** run the app on **your** infrastructure and keep **admin** access **only with you** — workspaces, billing logic (outside this repo if needed), SMTP, templates, user creation.
- **Your B2B clients** get **only the workspace user experience**: you send them your **public URL** (ideally on a **cheap domain** you control) and **user** email/password from **Admin → Team**. They never need admin credentials and should not see admin menus (same app, different role after login).
- **Scaling cost:** start with **one low-cost domain + one small VPS** (or static frontend + small API host); add capacity or separate instances per enterprise client as you grow.

Details: [`CLIENT_SETUP.md`](./CLIENT_SETUP.md) (B2B + cheap hosting plan) and [`SIMPLE_START.md`](./SIMPLE_START.md) (who installs vs who only uses the browser).

## Features

- **Admin:** workspaces, team users, AI usage, logs, branding & SMTP, email templates, password-help queue, plan (Free/Pro) and workspace limits.
- **Users:** leads, follow-ups, outbound mail history, email (workspace) settings, profile & password.
- **AI:** Free workspaces always use **Ollama**. **Pro** workspaces may use **OpenAI** when server `MODE=api`, workspace AI mode is **API**, and a workspace or global API key is set.
- **Security / ops:** JWT auth, admin cannot delete or deactivate their own matching workspace user, deactivated users get **403** on session check (forced logout in UI), transactional email logging (success/failure) and **system_logs** fallback on SMTP errors.
- **One-click Windows start:** [`start.bat`](./start.bat) — backend, frontend, browser, Ollama check.

### Sales automation (workspace user portal)

- **CSV import (`Leads`):** required columns `name`, `email`, `phone` (numeric), `country_code` (e.g. `+91`, `+1`); optional `company`, `status`, `notes` (stored as lead context for AI). Invalid rows are skipped; the UI shows **total / success (सफल) / failed** and an error report. **Download Sample CSV** matches the bundled template (`GET /leads/csv-sample`).
- **Lead heat tags:** after import (and nightly maintenance), leads get **HOT** (about 0–2 days since creation), **WARM** (about 3–7 days), **COLD** (older), shown as badges in **Leads** and on the dashboard table.
- **AI follow-ups:** drafts vary by pipeline position (**first contact**, **follow-up reminder**, **closing attempt**) and avoid repeating recent sends; **recovery** follow-ups use friendly check-in / reminder / offer styles. **Morning / afternoon / evening** tone follows the **UTC hour** of `scheduled_at` (see **Follow-ups** → “AI timing”).
- **Missed-lead recovery:** a **daily** job queues **recovery** follow-ups for leads with **no activity for 3–7 whole days** (no pending follow-up, not closed / not interested, at most one recovery send per 7 days). Processed with normal pending follow-up handling.
- **Sales dashboard (`/dashboard`):** `GET /dashboard/summary` — totals, **follow-ups sent** (in date range), **manual replies** and **manual conversions** (editable under **Workspace settings** via the dashboard form), **recent leads** and **recent follow-ups**, with optional filters **date range** (on lead `created_at`) and **status**.

## Quick start (Windows)

1. **Backend:** Python 3.11+, `pip install -r backend/requirements.txt`, copy `backend/.env.example` → `backend/.env`, set `BOOTSTRAP_ADMIN_*` and `SECRET_KEY`.
2. **Frontend:** Node 18+, `npm install` in `frontend/`, copy `frontend/.env.example` → `frontend/.env`.
3. **Ollama:** install and `ollama pull` a model (match `OLLAMA_MODEL` in `backend/.env`).
4. From repo root: run **`start.bat`**.

See [`CLIENT_SETUP.md`](./CLIENT_SETUP.md) for exact commands.

## Configuration

### Ports

| Piece | Default | Where to change |
|-------|---------|-----------------|
| API | `8000` | `backend/.env`: `PORT` or `BACKEND_PORT`. `0` = auto-pick free port from 8000 (`run_prod.py` writes repo-root `.backend-port`). |
| UI (dev) | `5173` | `frontend/.env`: `VITE_DEV_PORT` |
| Ollama | `11434` | Ollama app / `OLLAMA_URL` in `backend/.env` |

Repo root **`ports.env`** (optional) can override `BACKEND_PORT` for `start.bat` / `run_prod.py`.

### Backend (`backend/.env`)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | SQLite default `sqlite:///./app.db` |
| `SECRET_KEY` | JWT signing secret (required in production) |
| `MODE` | `local` = **always Ollama** (no OpenAI). `api` = OpenAI allowed only for **Pro** workspaces with API mode + key |
| `OLLAMA_URL` | Ollama base URL |
| `OLLAMA_MODEL` | Model name for generate/chat |
| `OPENAI_API_KEY` | Optional global key; workspace key preferred when set |
| `PORT` / `BACKEND_PORT` | API listen port |
| `CORS_ORIGINS` | Extra browser origins, comma-separated |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | First admin (change after install) |

### Frontend (`frontend/.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Backend origin, **no path** (e.g. `http://127.0.0.1:8000`). If unset in dev, Vite proxies `/api` → `VITE_PROXY_TARGET`. |
| `VITE_DEV_PORT` | Dev server port |
| `VITE_PROXY_TARGET` | Dev proxy target when `VITE_API_URL` is unset |

### SMTP (transactional mail)

Configure in **Admin → Account & branding** (stored in DB): host, port, from address, password. Used for:

- New user / password changed / activation emails (DB **email templates**).
- **Password request** acknowledgment when a user submits “request password help” on the login page.

Failures are logged under **EMAIL** in system logs and sent-mail log where applicable.

### Ollama

1. Install Ollama and ensure `ollama serve` is running (or use the desktop app).
2. `ollama pull <model>` matching `OLLAMA_MODEL`.
3. Set `OLLAMA_URL` if not on localhost:11434.

### OpenAI (Pro only)

1. Set `MODE=api` in `backend/.env`.
2. Set workspace plan to **Pro** and workspace **AI mode** to **API** with a workspace API key and/or set `OPENAI_API_KEY` globally.

## System flow

### Admin flow

1. Sign in with bootstrap admin credentials.
2. **Branding:** SMTP, product name, logo — required for reliable transactional email.
3. **Workspaces:** create workspace, set **Free** or **Pro**, optional expiry and usage caps.
4. **Team:** create users; **Set password & notify** sends the `password_changed` template when SMTP works.
5. **Password requests:** filter by email/status; resolve after helping the user.
6. **Email templates:** card list → per-template page for subject + HTML body.

### User flow

1. Sign in with admin-created credentials.
2. **Overview (dashboard):** metrics, filters, recent leads/follow-ups, manual reply/conversion counts.
3. **Leads:** download sample CSV → fill → import; manage contacts and heat tags.
4. **Follow-ups:** schedule sends; AI runs at the scheduled time (Ollama on Free; Pro + API may use OpenAI per rules above). Quiet leads may receive **recovery** follow-ups from the daily job.
5. **Profile** to update display name / phone; save is enabled only when something changed.
6. If an admin deactivates the account, the next **`/auth/me`** check logs the user out with a clear message.

## Deployment

### Local / LAN

- Backend: `python backend/run_dev.py` (reload) or `python backend/run_prod.py` (no reload, port file).
- Frontend dev: `npm run dev` in `frontend/`.
- Production UI: `npm run build` and serve `frontend/dist` with any static host; point API URL via env at build time or reverse-proxy `/api` to the FastAPI app.

### Cheapest domain + host plan (B2B friendly)

Good enough for **early sales** when each client only uses the **user portal**:

1. **Domain:** budget registrar (promo TLDs often **~\$1–\$15/year** — shop around). Point DNS to your server or static host.
2. **One small VPS** (e.g. Hetzner CX11-class, DO/Linode smallest) **or** split stack: **free/cheap static** frontend (Cloudflare Pages, Netlify, Vercel) + **small paid** API (Railway, Render, Fly, same VPS).
3. **HTTPS:** Caddy automatic TLS, nginx + Certbot, or Cloudflare proxy — avoid plain HTTP for clients.
4. **You** use **admin** on that deployment; **clients** only get links + **user** logins you create.

See **[`CLIENT_SETUP.md`](./CLIENT_SETUP.md)** → sections *B2B plan* and *Cheap domain hosting plan* for a short checklist.

### Cheap hosting options (typical pattern)

- **VPS** (Hetzner, DigitalOcean, Linode, etc.): single small VM, run Uvicorn behind **Caddy** or **nginx**, SQLite or move to Postgres via `DATABASE_URL`.
- **PaaS:** deploy API to **Railway**, **Render**, **Fly.io**; host static frontend on **Cloudflare Pages** / **Netlify** / **Vercel** with `VITE_API_URL` set to the public API origin.
- **Ollama:** on Free plans, run Ollama on the same VPS or a machine on the LAN; set `OLLAMA_URL` accordingly. OpenAI is optional for Pro.

Always set strong `SECRET_KEY`, HTTPS in production, and restrict `CORS_ORIGINS`.

## Non-technical setup

See **[`SIMPLE_START.md`](./SIMPLE_START.md)** (install Python, Node, Ollama → run `start.bat`).

## Project layout

```text
ai-sales-agent/
├── backend/           # FastAPI, SQLAlchemy, agents
├── frontend/          # React + Vite + Tailwind
├── start.bat          # Windows: backend + frontend + browser + Ollama check
├── CLIENT_SETUP.md    # Detailed client setup
├── SIMPLE_START.md    # Plain-language steps
└── README.md
```

## Testing

From `backend/` (with venv activated):

```bash
pytest
```

Includes schema and AI routing plan checks.

## Troubleshooting

- **ModuleNotFoundError:** install `requirements.txt` with the same Python you use to run the API.
- **CORS:** add your UI origin to `CORS_ORIGINS`.
- **401 / logout:** JWT expired or invalid.
- **403 “deactivated”:** admin set the user inactive; sign-in again blocked until reactivated.
- **No transactional email:** complete SMTP in **Branding**; check **Logs** for `EMAIL` entries.
- **API port mismatch:** if `BACKEND_PORT=0`, read `.backend-port` or the backend window; align `VITE_API_URL` or proxy target.

## Next scope (roadmap ideas)

- **WhatsApp** integration for follow-up notifications and inbound leads.
- **Payment gateway** and self-serve plan upgrades (Stripe, etc.).
- **Multi-tenant SaaS hosting** hardening: Postgres, tenant isolation, horizontal API scaling, managed Ollama or cloud LLM routing.

## License

Use and modify for your own projects.
