# Cloudflare Tunnel for Tracksy
# Run AFTER start.ps1 — exposes port 3000 publicly

Write-Host "`n=== Cloudflare Tunnel ===" -ForegroundColor Cyan

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  Write-Host "Installing cloudflared..." -ForegroundColor Yellow
  winget install --id Cloudflare.cloudflared -e
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

Write-Host "Your public URL will appear below. Share it to access Tracksy anywhere.`n" -ForegroundColor White
cloudflared tunnel --url http://localhost:3000
