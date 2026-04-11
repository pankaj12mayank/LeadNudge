"""Run API without reload (dev / background). Port: set in repo-root ports.env or backend/.env."""
import os
import socket
from pathlib import Path

import uvicorn

_REPO_ROOT = Path(__file__).resolve().parent.parent


def _pick_free_port(host: str, start: int, attempts: int = 80) -> int:
    for port in range(start, start + attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((host, port))
                return port
            except OSError:
                continue
    raise RuntimeError(
        f"No free TCP port between {start} and {start + attempts - 1} on {host}"
    )


def _write_port_file(port: int) -> None:
    try:
        (_REPO_ROOT / ".backend-port").write_text(str(port), encoding="utf-8")
    except OSError:
        pass


if __name__ == "__main__":
    os.chdir(Path(__file__).resolve().parent)
    from core.config import settings

    host = "127.0.0.1"
    want = settings.backend_port
    if want == 0:
        port = _pick_free_port(host, 8000)
        print(
            f"\n  [backend] Port 8000 busy — using next free port: {port}\n",
            flush=True,
        )
    else:
        port = want

    _write_port_file(port)

    print(f"  [backend] API: http://{host}:{port}", flush=True)
    print(
        "  [backend] Tip: change BACKEND_PORT in ports.env (repo root) or PORT in backend/.env\n",
        flush=True,
    )

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False,
        log_level="info",
    )
