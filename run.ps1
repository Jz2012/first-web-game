#!/usr/bin/env pwsh
# Start the Flask app in the project's venv and write the PID to server.pid
Set-StrictMode -Version Latest

# Ensure venv exists (creates it with system python if missing)
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
$proc = Start-Process -FilePath $python -ArgumentList 'app.py' -WorkingDirectory $PWD -WindowStyle Normal -PassThru
$proc.Id | Out-File -FilePath server.pid -Encoding ascii
Write-Host "Server started (PID: $($proc.Id)). PID written to server.pid"
