$ErrorActionPreference = "Stop"

Write-Host "Node:" (node -v)
Write-Host "NPM:" (npm -v)

Write-Host "`nInstalling root deps..."
npm ci

Write-Host "`nInstalling server deps..."
npm --prefix server ci

Write-Host "`nInstalling client deps..."
npm --prefix client ci

if ((Test-Path "server\.env.example") -and !(Test-Path "server\.env")) {
  Write-Host "`nCreating server\.env from example..."
  Copy-Item "server\.env.example" "server\.env"
  Write-Host "Edit server\.env if needed."
}

Write-Host "`nDone."
Write-Host "Run in Terminal 1: npm run dev"
Write-Host "Run in Terminal 2: npm run client"