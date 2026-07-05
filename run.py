#!/usr/bin/env python3
"""AlphaScribe one-command local launcher.

Run everything (MongoDB + FastAPI backend + React frontend) from a single
terminal. Everything it installs is kept inside the project:

  .venv/        Python virtual environment (backend deps)
  .mongo/       portable MongoDB binary + data files
  frontend/node_modules/   frontend deps

Usage:
    python run.py            # set up (first run) and start all services
    python run.py --setup    # only install/download, don't start
    python run.py --clean    # remove .venv, .mongo, node_modules and exit

First run downloads a portable MongoDB (~250 MB) and installs deps, so it
takes a few minutes. Subsequent runs start in seconds. Press Ctrl+C to stop.
"""
from __future__ import annotations

import os
import platform
import shutil
import signal
import socket
import subprocess
import sys
import tarfile
import threading
import time
import urllib.request
import venv
import zipfile
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths / config
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
VENV = ROOT / ".venv"
MONGO_DIR = ROOT / ".mongo"
MONGO_DATA = MONGO_DIR / "data"

IS_WIN = os.name == "nt"
MONGO_VERSION = os.environ.get("MONGO_VERSION", "7.0.14")

MONGO_PORT = 27017
BACKEND_PORT = 8001
FRONTEND_PORT = 3000

# ANSI colors (enabled on Windows 10+ via the os.system("") trick below)
RESET = "\033[0m"
COLORS = {"setup": "\033[36m", "mongo": "\033[35m", "api": "\033[32m", "web": "\033[34m"}
_PROCS: list[tuple[str, subprocess.Popen]] = []


def log(msg: str, tag: str = "setup") -> None:
    sys.stdout.write(f"{COLORS.get(tag, '')}[{tag}]{RESET} {msg}\n")
    sys.stdout.flush()


def die(msg: str) -> None:
    log(f"ERROR: {msg}", "setup")
    shutdown()
    sys.exit(1)


def run(cmd: list, cwd: Path | None = None) -> None:
    log("$ " + " ".join(str(c) for c in cmd))
    subprocess.check_call(cmd, cwd=str(cwd) if cwd else None)


def venv_python() -> Path:
    return VENV / ("Scripts" if IS_WIN else "bin") / ("python.exe" if IS_WIN else "python")


def port_open(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex((host, port)) == 0


def wait_port(port: int, timeout: float = 40.0) -> bool:
    start = time.time()
    while time.time() - start < timeout:
        if port_open(port):
            return True
        time.sleep(0.5)
    return False


def free_port(port: int) -> None:
    """Kill whatever process is listening on `port` (e.g. a stale backend from a
    previous run that would otherwise serve outdated code)."""
    try:
        if IS_WIN:
            out = subprocess.run(["netstat", "-ano", "-p", "tcp"],
                                 capture_output=True, text=True).stdout
            pids = set()
            for line in out.splitlines():
                parts = line.split()
                if len(parts) >= 5 and parts[1].endswith(f":{port}") and parts[3] == "LISTENING":
                    pids.add(parts[4])
            for pid in pids:
                subprocess.run(["taskkill", "/F", "/PID", pid],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            out = subprocess.run(["lsof", "-ti", f"tcp:{port}"],
                                 capture_output=True, text=True).stdout
            for pid in out.split():
                subprocess.run(["kill", "-9", pid],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:  # noqa: BLE001
        pass
    time.sleep(1.0)


# ---------------------------------------------------------------------------
# Setup steps
# ---------------------------------------------------------------------------
def ensure_venv() -> None:
    if venv_python().exists():
        return
    log("creating virtual environment in .venv ...")
    venv.create(VENV, with_pip=True)


def ensure_backend_deps() -> None:
    sentinel = VENV / ".deps_ok"
    if sentinel.exists():
        return
    py = str(venv_python())
    log("installing backend dependencies into .venv (first run — a few minutes) ...")
    run([py, "-m", "pip", "install", "--upgrade", "pip"])
    run([py, "-m", "pip", "install", "-r", str(BACKEND / "requirements.txt")])
    sentinel.write_text("ok")


def check_gemini_key() -> None:
    """Warn (don't block) if no Gemini API key is configured — the app runs but
    AI features will error until a key is added to backend/.env."""
    env = BACKEND / ".env"
    has_key = False
    if env.exists():
        for line in env.read_text(encoding="utf-8", errors="ignore").splitlines():
            s = line.strip()
            if s.startswith("GEMINI_API_KEY=") and s.split("=", 1)[1].strip():
                has_key = True
                break
    if not has_key:
        log("WARNING: no GEMINI_API_KEY in backend/.env — the app will start, but")
        log("         report generation will fail until you add a free key from")
        log("         https://aistudio.google.com/apikey")


def ensure_frontend_env() -> None:
    """Point the UI at the local backend without touching the committed .env.
    CRA loads .env.local at higher priority than .env."""
    (FRONTEND / ".env.local").write_text(
        f"REACT_APP_BACKEND_URL=http://localhost:{BACKEND_PORT}\n"
        f"WDS_SOCKET_PORT={FRONTEND_PORT}\n"
    )


def _frontend_deps_ok() -> bool:
    """True only if node_modules looks usable *on this OS*. A node_modules that
    was installed elsewhere (e.g. with yarn on macOS and shipped in the zip)
    lacks the Windows .cmd shims, so `npm start` -> `craco` fails."""
    craco = FRONTEND / "node_modules" / ".bin" / ("craco.cmd" if IS_WIN else "craco")
    return craco.exists()


def ensure_frontend_deps() -> None:
    if _frontend_deps_ok():
        return
    npm = shutil.which("npm") or ("npm.cmd" if IS_WIN else "npm")
    if not shutil.which("npm"):
        die("npm not found on PATH. Install Node.js (which includes npm) first.")
    nm = FRONTEND / "node_modules"
    if nm.exists():
        log("frontend node_modules is incomplete/foreign — reinstalling cleanly ...")
        shutil.rmtree(nm, ignore_errors=True)
    # --legacy-peer-deps: the project was authored with yarn and has a known
    # react-day-picker/date-fns peer conflict that npm otherwise refuses.
    log("installing frontend dependencies (npm install — first run, a few minutes) ...")
    run([npm, "install", "--legacy-peer-deps"], cwd=FRONTEND)


# ---------------------------------------------------------------------------
# MongoDB (portable, bundled into .mongo/)
# ---------------------------------------------------------------------------
def _mongod_binary() -> Path | None:
    name = "mongod.exe" if IS_WIN else "mongod"
    hits = list(MONGO_DIR.rglob(name))
    return hits[0] if hits else None


def _mongo_download_url() -> str:
    v = MONGO_VERSION
    sysname = platform.system()
    arch = platform.machine().lower()
    if sysname == "Windows":
        return f"https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-{v}.zip"
    if sysname == "Darwin":
        a = "arm64" if arch in ("arm64", "aarch64") else "x86_64"
        return f"https://fastdl.mongodb.org/osx/mongodb-macos-{a}-{v}.tgz"
    # Linux — best-effort (Ubuntu 22.04 build)
    return f"https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2204-{v}.tgz"


def _download(url: str, dest: Path) -> None:
    log(f"downloading MongoDB {MONGO_VERSION} (~250 MB, one time) ...")
    log(url)

    def hook(blocks, bs, total):
        if total > 0:
            pct = min(100, blocks * bs * 100 // total)
            sys.stdout.write(f"\r[mongo] {pct:3d}%")
            sys.stdout.flush()

    urllib.request.urlretrieve(url, dest, reporthook=hook)
    sys.stdout.write("\n")


def ensure_mongo() -> Path | None:
    """Return the mongod binary to launch, or None if an external MongoDB is
    already listening on the port (in which case we reuse it)."""
    if port_open(MONGO_PORT):
        log(f"a MongoDB is already running on :{MONGO_PORT} — reusing it", "mongo")
        return None
    MONGO_DIR.mkdir(exist_ok=True)
    binary = _mongod_binary()
    if not binary:
        url = _mongo_download_url()
        suffix = ".zip" if url.endswith(".zip") else ".tgz"
        archive = MONGO_DIR / f"mongo{suffix}"
        try:
            _download(url, archive)
        except Exception as e:  # noqa: BLE001
            die(f"failed to download MongoDB: {e}\n"
                f"      Set MONGO_URL in backend/.env to a MongoDB Atlas connection "
                f"string to skip the local download, then re-run.")
        log("extracting ...", "mongo")
        if suffix == ".zip":
            with zipfile.ZipFile(archive) as z:
                z.extractall(MONGO_DIR)
        else:
            with tarfile.open(archive) as t:
                t.extractall(MONGO_DIR)
        archive.unlink(missing_ok=True)
        binary = _mongod_binary()
    if not binary:
        die("could not locate the mongod binary after extraction")
    if not IS_WIN:
        os.chmod(binary, 0o755)
    MONGO_DATA.mkdir(parents=True, exist_ok=True)
    return binary


# ---------------------------------------------------------------------------
# Process orchestration
# ---------------------------------------------------------------------------
def spawn(tag: str, cmd: list, cwd: Path, env: dict | None = None) -> subprocess.Popen:
    kw: dict = {}
    if IS_WIN:
        kw["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kw["start_new_session"] = True
    log("$ " + " ".join(str(c) for c in cmd), tag)
    p = subprocess.Popen(
        cmd, cwd=str(cwd), env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1, **kw,
    )
    _PROCS.append((tag, p))
    threading.Thread(target=_pump, args=(p, tag), daemon=True).start()
    return p


def _pump(p: subprocess.Popen, tag: str) -> None:
    color = COLORS.get(tag, "")
    assert p.stdout is not None
    for line in p.stdout:
        sys.stdout.write(f"{color}[{tag}]{RESET} {line}")
        sys.stdout.flush()


def shutdown() -> None:
    for tag, p in _PROCS:
        if p.poll() is None:
            try:
                if IS_WIN:
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(p.pid)],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    os.killpg(os.getpgid(p.pid), signal.SIGTERM)
            except Exception:  # noqa: BLE001
                pass


def clean() -> None:
    for path in (VENV, MONGO_DIR, FRONTEND / "node_modules", FRONTEND / ".env.local"):
        if path.exists():
            log(f"removing {path.relative_to(ROOT)} ...")
            if path.is_dir():
                shutil.rmtree(path, ignore_errors=True)
            else:
                path.unlink(missing_ok=True)
    log("clean complete.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    if IS_WIN:
        os.system("")  # enable ANSI escape processing on Windows terminals

    args = set(sys.argv[1:])
    if "--clean" in args:
        clean()
        return

    # --- setup (idempotent) ---
    ensure_venv()
    ensure_backend_deps()
    ensure_frontend_env()
    ensure_frontend_deps()
    check_gemini_key()
    mongod = ensure_mongo()

    if "--setup" in args:
        log("setup complete. Run `python run.py` to start.")
        return

    for port, what in ((BACKEND_PORT, "backend"), (FRONTEND_PORT, "frontend")):
        if port_open(port):
            log(f"port {port} ({what}) is in use by a stale process — freeing it ...")
            free_port(port)
            if port_open(port):
                die(f"port {port} ({what}) is still in use — stop that process and retry.")

    # --- launch ---
    if mongod is not None:
        spawn("mongo", [str(mongod), "--dbpath", str(MONGO_DATA),
                        "--port", str(MONGO_PORT), "--bind_ip", "127.0.0.1"], MONGO_DIR)
        log("waiting for MongoDB ...", "mongo")
        if not wait_port(MONGO_PORT):
            die("MongoDB did not start in time")

    spawn("api", [str(venv_python()), "-m", "uvicorn", "server:app",
                  "--host", "127.0.0.1", "--port", str(BACKEND_PORT)],
          BACKEND, env={**os.environ})

    web_env = {**os.environ, "BROWSER": "none", "PORT": str(FRONTEND_PORT)}
    npm = shutil.which("npm") or ("npm.cmd" if IS_WIN else "npm")
    spawn("web", [npm, "start"], FRONTEND, env=web_env)

    log("")
    log("AlphaScribe is starting. Once compiled:")
    log(f"    UI       ->  http://localhost:{FRONTEND_PORT}")
    log(f"    API      ->  http://localhost:{BACKEND_PORT}/api/health")
    log(f"    seed data->  POST http://localhost:{BACKEND_PORT}/api/ingest/samples")
    log("Press Ctrl+C to stop everything.")

    try:
        while True:
            time.sleep(1)
            for tag, p in _PROCS:
                if p.poll() is not None and tag in ("api", "mongo"):
                    die(f"the '{tag}' process exited unexpectedly (see logs above)")
    except KeyboardInterrupt:
        log("\nshutting down ...")
    finally:
        shutdown()


if __name__ == "__main__":
    main()
