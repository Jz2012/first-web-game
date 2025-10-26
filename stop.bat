@echo off
REM Stop script: uses server.pid if present to terminate the server process
IF EXIST server.pid (
    for /f "delims=" %%i in (server.pid) do set PID=%%i
    if defined PID (
        echo Killing process %PID% ...
        taskkill /PID %PID% /F
        del /f server.pid >nul 2>&1
        echo Done.
    ) else (
        echo server.pid is empty.
    )
) ELSE (
    echo server.pid not found.
)
