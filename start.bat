@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM Visible terminals: Backend + Frontend in separate windows (no hidden PowerShell).
REM Ports: edit ports.env next to this file (BACKEND_PORT=0 = auto free port from 8000).
REM Set SKIP_OLLAMA_AUTO=1 to skip starting Ollama.

set "BACKEND=%~dp0backend"
set "FRONTEND=%~dp0frontend"

set "PYEXE=python"
if exist "%~dp0.venv\Scripts\python.exe" set "PYEXE=%~dp0.venv\Scripts\python.exe"
if exist "%~dp0backend\.venv\Scripts\python.exe" set "PYEXE=%~dp0backend\.venv\Scripts\python.exe"

if not defined SKIP_OLLAMA_AUTO (
  curl -s -m 2 http://127.0.0.1:11434/api/tags >nul 2>&1
  if errorlevel 1 (
    where ollama >nul 2>&1 && start "Ollama" cmd /k ollama serve
  )
)

echo.
echo  [1/2] Opening BACKEND in a new window...
start "AI Sales - Backend" cmd /k "cd /d ""%BACKEND%"" && ""%PYEXE%"" run_prod.py"

timeout /t 3 /nobreak >nul

echo  [2/2] Opening FRONTEND in a new window...
start "AI Sales - Frontend" cmd /k "cd /d ""%FRONTEND%"" && npm run dev"

timeout /t 3 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo  Done. Two windows: "AI Sales - Backend" and "AI Sales - Frontend".
echo  Browser: http://localhost:5173
echo  Tip: do not pin frontend/.env VITE_API_URL to port 8000 if BACKEND_PORT=0 — use Vite /api proxy.

endlocal
exit /b 0
