# Project: AI Architecture Papers Portal

## Python Environment

- **Use the global Python 3.14** — packages are installed here:
  ```
  C:\Users\dugganwx\AppData\Local\Python\pythoncore-3.14-64\python.exe
  ```
- Do NOT use `python` or `python3` directly — Windows Store aliases intercept them and they won't resolve to the correct interpreter.
- A `.venv` exists at `c:\Users\dugganwx\vscode101\.venv\` but does NOT have project dependencies installed. Use the global Python above.

## Installing Packages (pip)

Intel corporate proxy blocks direct PyPI access. Always use:
```
C:\Users\dugganwx\AppData\Local\Python\pythoncore-3.14-64\python.exe -m pip install <package> --trusted-host pypi.org --trusted-host files.pythonhosted.org --proxy http://proxy-dmz.intel.com:912
```

To install all dependencies:
```
C:\Users\dugganwx\AppData\Local\Python\pythoncore-3.14-64\python.exe -m pip install -r WebProject1/requirements.txt --trusted-host pypi.org --trusted-host files.pythonhosted.org --proxy http://proxy-dmz.intel.com:912
```

## Launching the Website

1. `cd` into `WebProject1` first — `app.py` must run from that directory.
2. Run:
   ```
   cd C:\Users\dugganwx\vscode101\WebProject1
   C:\Users\dugganwx\AppData\Local\Python\pythoncore-3.14-64\python.exe app.py
   ```
3. Server starts at **http://localhost:5000** with login required.
4. The PID file mechanism (`flask.pid`) auto-kills stale processes on port 5000.

## Critical: Stale Flask Processes

- Flask runs with `use_reloader=False` — code changes require a manual server restart.
- If the server won't start or serves old code, a stale Python process may hold port 5000.
- Diagnose: `netstat -ano | findstr ":5000"` → `Stop-Process -Id <PID> -Force`
- The PID file auto-kill at startup usually handles this, but manual kill may be needed.

## Intel Proxy Configuration

- Outbound HTTP proxy: `http://proxy-dmz.intel.com:912`
- `NO_PROXY=localhost,127.0.0.1,*.intel.com,.openai.azure.com,10.*` — set in `proxy.bat` and must be inherited by the Flask process.
- `.openai.azure.com` MUST be in `NO_PROXY` — Azure OpenAI returns 403 "Public access is disabled" when traffic arrives through Intel's proxy. Bypassing the proxy for Azure fixes this.
- `app.py` also sets `NO_PROXY` via `os.environ.setdefault()` before imports — do not remove this or localhost requests will route through the proxy and fail.
- Test scripts (`_test_discover.py`) use `proxies={}` (empty dict) to bypass proxy for localhost.

### Launching with proxy.bat

The correct way to start the server with all proxy/bypass settings:
```
cmd /c "cd /d C:\Users\dugganwx\vscode101\WebProject1 && set NO_PROXY=localhost,127.0.0.1,*.intel.com,.openai.azure.com,10.* && set no_proxy=localhost,127.0.0.1,*.intel.com,.openai.azure.com,10.* && set http_proxy=http://proxy-dmz.intel.com:912 && set https_proxy=http://proxy-dmz.intel.com:912 && set HTTP_PROXY=http://proxy-dmz.intel.com:912/ && set HTTPS_PROXY=http://proxy-dmz.intel.com:912/ && C:\Users\dugganwx\AppData\Local\Python\pythoncore-3.14-64\python.exe app.py"
```
Note: `proxy.bat` contains a `pause` command that blocks execution — use inline `set` commands instead of `call proxy.bat` when chaining with `app.py`.

## Project Structure

- **Entry point**: `WebProject1/app.py` — Flask server, REST API, SSE, OpenAlex discovery, auth
- **Data layer**: `WebProject1/models.py` — SQLite CRUD for papers and users
- **Database**: `WebProject1/papers.db` (SQLite, gitignored)
- **Frontend**: `WebProject1/index.html`, `app.js`, `styles.css`
- **Auth pages**: `WebProject1/login.html`, `WebProject1/register.html`
- **Papers folder**: `WebProject1/AI papers for WebProject1/` (PDFs + JSON sidecars)
- **Requirements**: `WebProject1/requirements.txt` — flask, flask-login, requests

## Key Architecture Details

- `app = Flask(__name__, static_folder=None)` — all static files served via explicit routes
- `threaded=True` is required because SSE `/api/changes` holds long connections
- Frontend uses SSE (EventSource on `/api/changes`) for live updates, not polling
- First user to log in when no accounts exist is auto-created (bootstrap mechanism)
- `app.secret_key` defaults to `"dev-secret-change-in-production"`
