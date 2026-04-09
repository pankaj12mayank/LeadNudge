@echo off
cd /d "%~dp0"
if exist "%~dp0..\.venv\Scripts\activate.bat" call "%~dp0..\.venv\Scripts\activate.bat"
if exist "%~dp0.venv\Scripts\activate.bat" call "%~dp0.venv\Scripts\activate.bat"
where py >nul 2>&1 && (
  py -3 run_dev.py
) || (
  python run_dev.py
)
pause
