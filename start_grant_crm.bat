@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   Grant CRM Premium AI - start lokalny
echo ============================================

if not exist "run.py" (
  echo [ERROR] Nie znaleziono run.py.
  echo Skopiuj ten plik BAT do glownego folderu projektu.
  pause
  exit /b 1
)

where py >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Nie znaleziono Python launcher 'py'. Zainstaluj Python 3.
  pause
  exit /b 1
)

where docker >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Nie znaleziono Docker CLI. Zainstaluj Docker Desktop.
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker Desktop nie dziala. Uruchom Docker Desktop i sprobuj ponownie.
  pause
  exit /b 1
)

echo [OK] Uruchamiam aplikacje w tle...
echo [INFO] Sprawdzam stary kontener PostgreSQL...
docker rm -f grantcrm_postgres >nul 2>nul
py .\run.py --detach

echo.
echo Otwieram http://localhost:8080
start "" "http://localhost:8080"
echo.
echo Komendy pomocnicze:
echo   py .\run.py logs
echo   py .\run.py status
echo   py .\run.py stop
echo.
pause
