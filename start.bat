@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo ========================================
echo   AI Sales Follow-up Agent - startup
echo ========================================
echo.

echo Starting Backend...
start "ai-sales-backend" cmd /k "%~dp0backend\start_backend.cmd"

timeout /t 2 /nobreak >nul

echo Starting Frontend...
start "ai-sales-frontend" cmd /k "%~dp0frontend\start_frontend.cmd"

echo.
echo ========================================
echo   System running
echo ========================================
echo   Backend:  http://127.0.0.1:8000  (set PORT in backend\.env)
echo   Frontend: http://localhost:5173   (set VITE_DEV_PORT in frontend\.env)
echo   API docs: http://127.0.0.1:8000/docs
echo ========================================
echo.
pause
