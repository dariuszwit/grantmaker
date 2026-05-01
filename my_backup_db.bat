@echo off
setlocal
cd /d "%~dp0"

echo === Grant CRM database backup ===

where py >nul 2>nul
if %errorlevel% neq 0 (
  echo ERROR: Python launcher "py" was not found.
  echo Install Python or run: python backup_db.py
  pause
  exit /b 1
)

py .\my_backup_db.py --keep-days 30

echo.
echo Backup finished.
pause
