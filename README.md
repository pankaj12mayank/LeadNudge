# Sales Follow-up Console

Single-repo SaaS-style app: **FastAPI** backend + **React (Vite)** admin and workspace-user portals, multi-tenant **workspaces**, **local-first AI** (Ollama) with optional OpenAI.

**Plans:** **Free** workspaces default to **200** AI-generated messages (cap); **Paid (Pro)** defaults to **10,000** — applied when a workspace is created or its plan changes (you can still override per workspace in AI configuration).

**Admin:** **Account & branding** in the UI updates your profile, password, product name, and logo (`/static/uploads/`). Public sign-in metadata: `GET /public/site` (no auth).

## Prerequisites

- **Python** 3.11+ (3.14+ supported; install deps with the same interpreter you use to run the API)
- **Node.js** 18+ and npm
- **Ollama** (for local AI): [https://ollama.com](https://ollama.com) — pull a model, e.g. `ollama pull llama3.2`

## Quick start (Windows)

1. **Backend environment**

   ```powershell
   cd ai-sales-agent\backend
   python -m venv ..\.venv
   ..\.venv\Scripts\activate
   pip install -r requirements.txt
   copy .env.example .env
   ```

   Edit `backend\.env` (see [Configuration](#configuration)).

2. **Frontend**

   ```powershell
   cd ..\frontend
   npm install
   copy .env.example .env
   ```

3. **One-click run**

   From the repo root `ai-sales-agent\`:

   ```text
   start.bat
   ```

   This opens two windows: API (`run_dev.py`) and `npm run dev`. You can instead run them manually:

   ```powershell
   # Terminal 1 — backend (port from .env PORT / BACKEND_PORT)
   cd backend
   ..\.venv\Scripts\activate   # if you use a venv
   python run_dev.py

   # Terminal 2 — frontend (port from .env VITE_DEV_PORT)
   cd frontend
   npm run dev
   ```

4. **Open the app**

   - UI: `http://localhost:5173` (or your `VITE_DEV_PORT`)
   - API docs: `http://127.0.0.1:8000/docs` (or your `PORT`)

## Default login credentials

There is **no fixed password** in code. The first admin is created from **bootstrap** variables in `backend\.env`:

| Variable | Example (`.env.example`) |
|----------|-------------------------|
| `BOOTSTRAP_ADMIN_EMAIL` | `admin@example.com` |
| `BOOTSTRAP_ADMIN_PASSWORD` | `changeme` |

Change these before any real use. After login as admin, create **workspaces** and **users** from the admin UI.

Workspace users log in with the email/password you set when creating them.

## Configuration

### Backend (`backend\.env`)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | SQLite default `sqlite:///./app.db` |
| `SECRET_KEY` | JWT signing secret |
| `MODE` | `local` = **always Ollama** (no OpenAI). `api` = allow OpenAI when workspace AI mode + key |
| `OLLAMA_URL` | Ollama base URL (e.g. `http://localhost:11434` or `http://127.0.0.1:11434`) |
| `OLLAMA_MODEL` | Model name for `/api/generate` |
| `OPENAI_API_KEY` | Optional global OpenAI key (workspace key still preferred when set) |
| `PORT` or `BACKEND_PORT` | API port (default **8000**) |
| `CORS_ORIGINS` | Extra allowed browser origins, comma-separated (defaults include `localhost:5173` and `127.0.0.1:5173`) |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | Optional first admin |

### Frontend (`frontend\.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Full backend origin, **no trailing path** (e.g. `http://localhost:8000`). Axios calls `/auth/...`, `/admin/...` on this host. |
| `VITE_DEV_PORT` | Vite dev server port (default **5173**) |
| `VITE_PROXY_TARGET` | Used only when `VITE_API_URL` is **unset**: dev proxy sends `/api` → this URL (default `http://127.0.0.1:8000`) |

### Changing ports

- **Backend:** set `PORT` (or `BACKEND_PORT`) in `backend\.env`, then run `python run_dev.py` (or `start.bat`).
- **Frontend:** set `VITE_DEV_PORT` in `frontend\.env`, then `npm run dev`.
- If the UI runs on a **non-default** origin, add it to backend `CORS_ORIGINS` (comma-separated).

### Changing API URL (frontend)

Set `VITE_API_URL` to your API origin, e.g. `http://localhost:8000` or `http://127.0.0.1:9000` if you change the API port.

### Changing Ollama URL

Set `OLLAMA_URL` in `backend\.env` (same value as in Ollama’s listen address).

## AI behavior (summary)

- **`MODE=local`:** only Ollama is used; workspace “API” mode does not call OpenAI.
- **`MODE=api`:** if a workspace is set to API mode and a key exists (**workspace** or **`OPENAI_API_KEY`**), OpenAI is tried first; on failure, Ollama is used as fallback.
- Ollama requests use **`OLLAMA_URL`** and **`OLLAMA_MODEL`**.

## Project layout

```text
ai-sales-agent/
├── backend/          # FastAPI, SQLAlchemy, agents
│   ├── run_dev.py    # Uvicorn with PORT from .env
│   ├── start_backend.cmd
│   └── .env
├── frontend/         # React + Vite + Tailwind
│   ├── start_frontend.cmd
│   └── .env
├── start.bat         # Windows: backend + frontend
└── README.md
```

## Troubleshooting

- **`ModuleNotFoundError` (e.g. bcrypt):** install requirements with the **same** Python as `python run_dev.py`.
- **CORS errors:** ensure the page origin is allowed (defaults cover `5173`; extend `CORS_ORIGINS`).
- **401 / kicked to login:** JWT expired or invalid; sign in again. The app clears the token on 401.
- **Network / cannot reach API:** confirm the backend is up and `VITE_API_URL` matches host/port (or use the Vite `/api` proxy by removing `VITE_API_URL`).

## License

Use and modify for your own projects.
