@echo off
cd /d "%~dp0"

REM LeadNudge — one double-click: venv + pip + npm + verify, then backend + frontend in ONE window.
REM Ollama runs in a separate window when not already listening on 11434.
REM Optional: set SKIP_OLLAMA_AUTO=1 to skip starting Ollama.

title LeadNudge — starting

echo.
echo  LeadNudge — install, verify, run
echo  Root: %~dp0
echo.

where python >nul 2>&1
if errorlevel 1 (
  echo ERROR: Python not on PATH. Install Python 3.11+ from https://www.python.org/downloads/
  pause
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm not on PATH. Install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "%~dp0.venv\Scripts\python.exe" (
  echo [1/4] Creating virtual environment .venv ...
  python -m venv "%~dp0.venv"
  if errorlevel 1 (
    echo ERROR: Could not create .venv
    pause
    exit /b 1
  )
)

set "PYEXE=%~dp0.venv\Scripts\python.exe"

echo [2/4] Backend dependencies ^(pip^)...
"%PYEXE%" -m pip install -q --upgrade pip
if errorlevel 1 (
  echo ERROR: pip upgrade failed
  pause
  exit /b 1
)
"%PYEXE%" -m pip install -q -r "%~dp0backend\requirements.txt"
if errorlevel 1 (
  echo ERROR: pip install requirements failed
  pause
  exit /b 1
)

echo [3/4] Frontend dependencies ^(npm^)...
pushd "%~dp0frontend"
call npm install --no-fund --no-audit
if errorlevel 1 (
  echo ERROR: npm install failed
  popd
  pause
  exit /b 1
)
popd

echo [4/4] Verify...
"%PYEXE%" -c "import fastapi, uvicorn; print('  Backend imports: OK')"
if errorlevel 1 (
  echo ERROR: Backend verification failed
  pause
  exit /b 1
)
if not exist "%~dp0frontend\node_modules\vite\package.json" (
  echo ERROR: frontend node_modules incomplete ^(vite missing^)
  pause
  exit /b 1
)
echo   Frontend: OK ^(vite present^)

if not defined SKIP_OLLAMA_AUTO (
  curl -s -m 2 http://127.0.0.1:11434/api/tags >nul 2>&1
  if errorlevel 1 (
    where ollama >nul 2>&1 && (
      echo.
      echo  Starting Ollama in a separate window...
      start "LeadNudge - Ollama" cmd /k "ollama serve"
      timeout /t 2 /nobreak >nul
    )
  )
)

echo.
curl -s -m 3 http://127.0.0.1:11434/api/version >nul 2>&1
if errorlevel 1 (
  echo  Ollama: not on port 11434 ^(optional — needed for local AI features^)
) else (
  echo  Ollama: OK at http://127.0.0.1:11434
)

echo.
echo  Backend + frontend will run below with [backend] / [frontend] prefixes.
echo  Press Ctrl+C in this window to stop both.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1" -SkipInstall
set "PS_EXIT=%ERRORLEVEL%"

echo.
if not "%PS_EXIT%"=="0" echo  dev.ps1 exited with code %PS_EXIT%
pause
exit /b %PS_EXIT%
