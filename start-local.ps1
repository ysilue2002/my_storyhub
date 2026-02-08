$ErrorActionPreference = "Stop"

Write-Host "Starting MyStoryHub (local)..." -ForegroundColor Cyan

# Backend
$backendEnv = @{
  PORT = "3003"
}

Start-Process powershell -ArgumentList "-NoProfile", "-Command", "cd `"$PSScriptRoot\backend`"; `$env:PORT='3003'; node server.js" | Out-Null

# Frontend
Start-Process powershell -ArgumentList "-NoProfile", "-Command", "cd `"$PSScriptRoot\frontend`"; `$env:PORT='3002'; npm start" | Out-Null

Write-Host "Frontend: http://localhost:3002" -ForegroundColor Green
Write-Host "Backend:  http://localhost:3003" -ForegroundColor Green
