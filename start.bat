@echo off
cd /d "%~dp0"

REM LeadNudge - one double-click: venv + pip + npm + verify, then backend + frontend in ONE window.
REM Ollama runs in a separate window when not already listening on 11434.
REM Optional: set SKIP_OLLAMA_AUTO=1 to skip starting Ollama.

title LeadNudge - starting

echo.
echo  LeadNudge - install, verify, run
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

if not exist "%~dp0backend\.env" (
  if exist "%~dp0backend\.env.example" (
    echo [setup] Creating backend\.env from .env.example ...
    copy /y "%~dp0backend\.env.example" "%~dp0backend\.env" >nul
    echo   Edit backend\.env for production ^(SECRET_KEY, BOOTSTRAP_ADMIN_PASSWORD^).
  ) else (
    echo WARNING: backend\.env.example missing - create backend\.env manually.
  )
)

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
if exist "package-lock.json" (
  call npm ci --no-fund --no-audit
) else (
  call npm install --no-fund --no-audit
)
if errorlevel 1 (
  echo ERROR: npm ci / install failed
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
  powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri 'http://127.0.0.1:11434/api/tags' | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
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
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 -Uri 'http://127.0.0.1:11434/api/version' | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  echo  Ollama: not on port 11434 ^(optional - needed for local AI features^)
) else (
  echo  Ollama: OK at http://127.0.0.1:11434
)

echo.
echo  Backend + frontend will run below with [backend] / [frontend] prefixes.
echo  Press Ctrl+C in this window to stop both.
echo.

REM Open browser after a short delay ^(Vite usually ready by then^).
start "LeadNudge-browser" /MIN cmd /c "ping -n 12 127.0.0.1 >nul && start http://localhost:5173/"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1" -SkipInstall
set "PS_EXIT=%ERRORLEVEL%"

echo.
if not "%PS_EXIT%"=="0" echo  dev.ps1 exited with code %PS_EXIT%
pause
exit /b %PS_EXIT%
