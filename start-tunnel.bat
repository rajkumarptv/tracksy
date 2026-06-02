@echo off
echo ================================================
echo         TRACKSY - Starting All Services
echo ================================================
echo.

echo [1/3] Starting Backend (port 5000)...
start "Tracksy Backend" cmd /k "cd /d D:\tracksy\backend && node src/index.js"

echo [2/3] Starting Frontend (port 3000)...
start "Tracksy Frontend" cmd /k "cd /d D:\tracksy\frontend && npm run dev"

echo [3/3] Waiting for servers to start...
timeout /t 5 /nobreak >nul

echo [4/4] Starting Cloudflare Tunnel...
start "Cloudflare Tunnel" cmd /k "cloudflared tunnel run tracksy-app"

echo.
echo ================================================
echo   All services started!
echo.
echo   Local  : http://localhost:3000
echo   Live   : https://app.topfindstoday.in
echo ================================================
echo.
echo Close this window anytime. The 3 other windows
echo must stay open to keep the site live.
echo.
pause
