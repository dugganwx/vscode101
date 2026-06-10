@echo off
REM ── Start AI Architecture Papers Portal ────────────────────────────────────
REM Run this from the WebProject1 directory: start.bat
call proxy.bat
set PYTHON=C:\Users\dugganwx\AppData\Local\Python\pythoncore-3.14-64\python.exe
set PORT=5000

REM ── Set Intel proxy environment ────────────────────────────────────────────
set NO_PROXY=localhost,127.0.0.1,*.intel.com,.openai.azure.com,10.*
set no_proxy=%NO_PROXY%
set http_proxy=http://proxy-dmz.intel.com:912
set https_proxy=http://proxy-dmz.intel.com:912
set HTTP_PROXY=http://proxy-dmz.intel.com:912/
set HTTPS_PROXY=http://proxy-dmz.intel.com:912/

echo Proxy settings configured.

REM ── Kill any process holding port 5000 ─────────────────────────────────────
echo.
echo Checking for existing server on port %PORT%...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    echo Killing PID %%p on port %PORT%...
    taskkill /PID %%p /F >nul 2>&1
)
echo Port %PORT% is clear.



"%PYTHON%" app.py
REM ── Launch Flask server ────────────────────────────────────────────────────
echo.
echo Starting Flask server...
echo ============================================================
echo   AI Architecture Papers Portal
echo   URL: http://localhost:%PORT%
echo ============================================================
echo.