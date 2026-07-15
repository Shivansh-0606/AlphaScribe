# Running AlphaScribe locally

AlphaScribe is a multi-agent equity-research app: a **FastAPI** backend, a
**React** frontend, and a **MongoDB** database. This guide gets all three
running on your own machine with a single click — no manual installs.

---

## TL;DR

1. Make sure **Python 3.11+** and **Node.js 18+** are installed.
2. **Double-click `run.bat`** (Windows) — or run `python run.py` (any OS).
3. Wait for the first-run setup to finish, then open **http://localhost:3000**.
4. Load demo data: open the **Ingest** page in the UI and click *Load samples*
   (or run `curl -X POST http://localhost:8001/api/ingest/samples`).

Press **Ctrl+C** (or close the window) to stop everything.

---

## What you need installed first

The launcher installs everything *else* for you, but two base tools must
already be on your system:

| Tool | Version | Check | Get it |
|------|---------|-------|--------|
| Python | 3.11+ | `python --version` | https://www.python.org/downloads/ (tick **"Add Python to PATH"**) |
| Node.js | 18+ | `node --version` | https://nodejs.org/ (LTS) — includes `npm` |

You do **not** need to install MongoDB, `yarn`, or any Python/Node packages by
hand — the launcher handles all of that.

---

## How to run it

### Windows — the easy way
Double-click **`run.bat`** in the project folder. A console window opens and
does everything. When you see the "AlphaScribe is starting" banner, open your
browser to **http://localhost:3000**.

### Any OS — the terminal way
From the project root:
```bash
python run.py
```

### Useful variants
```bash
python run.py --setup    # install/download everything but don't start the app
python run.py --clean    # delete .venv, .mongo, node_modules, .env.local
```

---

## What happens on the first run

The first launch takes **a few minutes** because it downloads and installs a
lot. Everything it creates stays **inside the project folder** — nothing is
installed system-wide:

| Folder created | What it is |
|----------------|------------|
| `.venv/` | Python virtual environment with the backend dependencies |
| `.mongo/` | A portable MongoDB (~250 MB, downloaded once) **and its data** |
| `frontend/node_modules/` | Frontend JavaScript dependencies |
| `frontend/.env.local` | Points the UI at your local backend (auto-generated) |

Subsequent runs skip all of this and start in **seconds**.

Once running, three services share the one terminal window with colour-coded
log prefixes:

| Prefix | Service | URL |
|--------|---------|-----|
| `[mongo]` | MongoDB database | `mongodb://localhost:27017` |
| `[api]` | FastAPI backend | http://localhost:8001/api/health |
| `[web]` | React frontend | http://localhost:3000 |

---

## Loading data so you can try it

The app needs at least one ingested filing before it can generate a report.
Three ways to get data in:

1. **Demo samples** (fastest): on the **Ingest** page click *Load samples*, or
   ```bash
   curl -X POST http://localhost:8001/api/ingest/samples
   ```
2. **Auto-fetch from SEC EDGAR**: on the Ingest page, enter a US ticker
   (e.g. `AAPL`) and let it pull the latest 10-Q/10-K.
3. **Paste text / upload audio**: paste a quarterly result or upload an
   earnings-call recording (transcribed via Whisper).

Then pick a company on the **Dashboard**, ask a question, and watch the
pipeline stream its work live.

---

## Configuration

Backend settings live in `backend/.env`:

```
MONGO_URL="mongodb://localhost:27017"   # local MongoDB the launcher runs
DB_NAME="alphascribe"
CORS_ORIGINS="http://localhost:3001"    # must be explicit, not "*" — cookies require it
GEMINI_API_KEY=your_key_here            # powers all the AI features
RESEND_API_KEY=                         # password-reset OTP email; unset = OTP logged to console in dev
OTP_PEPPER=                             # secret for hashing OTPs; set a random string in production
```

- The AI features (financial extraction, report synthesis, fact-checking,
  audio transcription) all require a valid **`GEMINI_API_KEY`**. Get a free one
  at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). If
  reports fail at the extraction/synthesis step, a missing or invalid key is
  usually why.
- **Keep `backend/.env` private** — it contains a secret key. Do not commit or
  share it.
- **Prefer a cloud database?** Set `MONGO_URL` to a
  [MongoDB Atlas](https://www.mongodb.com/atlas) connection string. The
  launcher detects that a database is already reachable and skips the local
  MongoDB download entirely.

---

## Troubleshooting

**"Python was not found"**
Install Python 3.11+ and re-check *Add Python to PATH* during setup, then
re-run `run.bat`.

**Frontend won't start / `npm not found`**
Install Node.js LTS from https://nodejs.org/ (it includes `npm`), then re-run.

**Reports fail with an API-key error**
Make sure `GEMINI_API_KEY` is set in `backend/.env` (free key at
[aistudio.google.com/apikey](https://aistudio.google.com/apikey)). Restart the
backend after adding it.

**`port 8001 (backend)` or `port 3000 (frontend)` is already in use**
Another program (or a previous run that didn't shut down) is holding the port.
Close it, or restart your PC, then re-run.

**MongoDB download fails**
Set `MONGO_URL` in `backend/.env` to a MongoDB Atlas connection string to skip
the local download, then re-run.

**Want a totally clean slate**
```bash
python run.py --clean
```
This removes `.venv`, `.mongo` (including its data), `node_modules`, and
`.env.local`. The next run rebuilds everything from scratch.

**First run is very slow / lots of output**
That's expected — it's downloading MongoDB (~250 MB) and installing dozens of
packages. Let it finish; later runs are fast.

---

## Stopping the app

Press **Ctrl+C** in the terminal, or simply close the window. The launcher
shuts down MongoDB, the backend, and the frontend together.
