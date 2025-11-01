#!/usr/bin/env pwsh
# Stop the server started by run.ps1 using the PID in server.pid
Set-StrictMode -Version Latest

if (Test-Path .\server.pid) {
    $pid = Get-Content .\server.pid | Select-Object -First 1
    if ($pid -and ($pid -as [int])) {
        Write-Host "Stopping process PID $pid..."
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Remove-Item .\server.pid -ErrorAction SilentlyContinue
            Write-Host "Process $pid stopped and server.pid removed."
        } catch {
            Write-Warning ("Failed to stop process {0}: {1}" -f $pid, $_)
        }
    } else {
        Write-Warning "server.pid does not contain a valid PID"
    }
} else {
    Write-Host "server.pid not found. Searching for python processes in this folder..."
    Get-Process python -ErrorAction SilentlyContinue | Where-Object {
        ($_.Path -and ($_.Path -like "*first-web-game*")) -or ($_.Path -like "*$PWD*")
    } | ForEach-Object {
        Write-Host "Stopping process $($_.Id) ($($_.Path))"
        Stop-Process -Id $_.Id -Force
    }
}
