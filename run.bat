@echo off
REM Simple batch start script: creates venv (if missing) and runs the app
IF NOT EXIST venv\Scripts\python.exe (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate
echo Starting Flask app...
python app.py
