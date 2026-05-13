@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

REM Ukryty start - bez pauzy, bez echa do uzytkownika.
REM Logi i bledy zapisywane do pliku, zeby dalo sie zdiagnozowac.

set "LOGDIR=%~dp0storage\logs"
if not exist "%LOGDIR%" mkdir "%LOGDIR%" >nul 2>nul
set "LOGFILE=%LOGDIR%\launcher.log"

echo. >> "%LOGFILE%"
echo ==== %DATE% %TIME% ==== >> "%LOGFILE%"

if not exist "run.py" (
  echo [ERROR] Nie znaleziono run.py >> "%LOGFILE%"
  exit /b 1
)

where py >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Brak Python launcher 'py'. Zainstaluj Python 3. >> "%LOGFILE%"
  msg * "Grant CRM: brak Python launcher 'py'. Zainstaluj Python 3." 2>nul
  exit /b 1
)

where docker >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Brak Docker CLI. Zainstaluj Docker Desktop. >> "%LOGFILE%"
  msg * "Grant CRM: brak Docker. Zainstaluj Docker Desktop." 2>nul
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker Desktop nie dziala - probuje uruchomic... >> "%LOGFILE%"
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" 2>nul
  REM Czekaj az Docker wstanie (max ~90s)
  for /L %%i in (1,1,45) do (
    timeout /t 2 /nobreak >nul
    docker info >nul 2>nul
    if not errorlevel 1 goto :docker_ready
  )
  echo [ERROR] Docker Desktop nie wstal w czasie. >> "%LOGFILE%"
  msg * "Grant CRM: Docker Desktop nie wstal. Uruchom recznie i sprobuj ponownie." 2>nul
  exit /b 1
)
:docker_ready

echo [INFO] Czyszcze stary kontener PostgreSQL (jesli istnial)... >> "%LOGFILE%"
docker rm -f grantcrm_postgres >nul 2>nul

echo [INFO] Uruchamiam aplikacje w tle... >> "%LOGFILE%"
py .\run.py --detach --no-open >> "%LOGFILE%" 2>&1
if errorlevel 1 (
  echo [ERROR] run.py zakonczyl sie bledem. >> "%LOGFILE%"
  msg * "Grant CRM: blad startu - sprawdz storage\logs\launcher.log" 2>nul
  exit /b 1
)

echo [INFO] Czekam na odpowiedz aplikacji... >> "%LOGFILE%"
for /L %%i in (1,1,30) do (
  powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -Uri http://localhost:8080 -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 goto :app_ready
  timeout /t 1 /nobreak >nul
)
:app_ready

echo [OK] Otwieram przegladarke. >> "%LOGFILE%"
start "" "http://localhost:8080"
exit /b 0
