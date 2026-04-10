@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM Silent startup: backend in background, optional Ollama, frontend minimized, open browser.
REM Set SKIP_OLLAMA_AUTO=1 before running to never auto-start Ollama.

if not defined SKIP_OLLAMA_AUTO (
  curl -s -m 2 http://127.0.0.1:11434/api/tags >nul 2>&1
  if errorlevel 1 (
    where ollama >nul 2>&1 && start "" /B ollama serve >nul 2>&1
  )
)

set "PYEXE=python"
if exist "%~dp0.venv\Scripts\python.exe" set "PYEXE=%~dp0.venv\Scripts\python.exe"
if exist "%~dp0backend\.venv\Scripts\python.exe" set "PYEXE=%~dp0backend\.venv\Scripts\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Set-Location '%~dp0backend'; $py = '%PYEXE%'; ^
   Start-Process -FilePath $py -ArgumentList 'run_prod.py' -WorkingDirectory (Get-Location) -WindowStyle Hidden"

timeout /t 2 /nobreak >nul

start "Frontend" /MIN cmd /c "cd /d %CD%\frontend && npm run dev"

timeout /t 3 /nobreak >nul
start "" "http://localhost:5173"

endlocal
exit /b 0
