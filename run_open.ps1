#!/usr/bin/env pwsh
# Start the Flask app and open the default browser to http://localhost:5000
Set-StrictMode -Version Latest

if (-Not (Test-Path .\venv\Scripts\python.exe)) {
    Write-Host "Virtual environment not found - creating venv..."
    python -m venv venv
}

$python = Join-Path $PWD 'venv\Scripts\python.exe'
if (-Not (Test-Path $python)) {
    Write-Error "Python executable not found at $python"
    exit 1
}

Write-Host "Starting server using: $python"
$proc = Start-Process -FilePath $python -ArgumentList 'app.py' -WorkingDirectory $PWD -WindowStyle Hidden -PassThru
$proc.Id | Out-File -FilePath server.pid -Encoding ascii
Write-Host "Server started (PID: $($proc.Id)). PID written to server.pid"

Start-Sleep -Seconds 1
$url = 'http://localhost:5000'
try {
    Start-Process $url
} catch {
    Write-Warning "Could not open browser automatically. Open $url manually."
}
