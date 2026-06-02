# Start Tracksy (backend port 5000, frontend port 3000)
Write-Host "Starting Tracksy..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location D:\tracksy\backend; npm run dev" -WindowStyle Normal
Start-Sleep 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location D:\tracksy\frontend; npm run dev" -WindowStyle Normal

Write-Host "Backend:  http://localhost:5000" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "`nDemo login: adaline@tracksy.com / password123" -ForegroundColor Yellow
Write-Host "Both servers starting in separate windows." -ForegroundColor White
