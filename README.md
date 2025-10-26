# first-web-game
Small ping-pong web game (Flask backend + JavaScript frontend).

Quick start (Windows PowerShell):

1. Create and activate the virtual environment, install dependencies and start the server:

```powershell
python -m venv venv
.\venv\Scripts\python.exe -m pip install --upgrade pip
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe app.py
```

2. Or use the helper scripts provided in the repository:

- Start (PowerShell): `.\run.ps1` (creates venv if missing and starts server; writes PID to `server.pid`)
- Stop  (PowerShell): `.\stop.ps1` (stops server using PID from `server.pid`)
- Start (cmd): `run.bat`
- Stop  (cmd): `stop.bat`
- Start + open browser (PowerShell): `.\run_open.ps1` (starts server then opens http://localhost:5000)

Open http://localhost:5000 in your browser.

Notes:
- The scripts assume you're on Windows. `run.ps1` and `stop.ps1` are PowerShell scripts. If you prefer, use the `.bat` variants.
- For production, use a real WSGI server instead of the built-in Flask development server.
# first-web-game