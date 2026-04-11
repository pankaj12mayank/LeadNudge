# Troubleshooting (run / merge issues)

## Quick checks

1. **Backend loads**
   ```bash
   cd backend
   python -c "from main import app; print('OK')"
   ```

2. **Frontend builds**
   ```bash
   cd frontend
   npm run build
   ```

3. **Tests**
   ```bash
   cd backend
   python -m pytest -q
   ```

## Project won’t start on Windows (`start.bat`)

- Use the repo **venv** Python if present: `.\.venv\Scripts\python.exe` or `backend\.venv\Scripts\python.exe`.
- If the backend uses **auto port** (`BACKEND_PORT=0` in `ports.env` / `.env`), the API writes **`.backend-port`** in the repo root. The Vite dev server reads that file so `/api` proxy targets the correct port. **Restart the frontend** after the backend starts, or set `VITE_PROXY_TARGET=http://127.0.0.1:<port>` in `frontend/.env`.
- Do **not** set `VITE_API_URL` to a fixed `8000` if the backend picked another port.

## Profile or account returns 500

- Restart the **backend** once so `init_db()` runs migrations (adds missing `users.display_name`, `users.phone`, `users.is_active`, etc., on Postgres/SQLite).
- Clear the browser token and sign in again if the session is corrupted.

## After a bad git merge

- Search for conflict markers: `<<<<<<<` / `=======` / `>>>>>>>` in `backend/` and `frontend/src/` (not in `node_modules`).
- Re-run the three quick checks at the top.
