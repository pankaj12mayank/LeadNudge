"""Run API without reload (dev / background). Port: set in repo-root ports.env or backend/.env."""
import os
from pathlib import Path

import uvicorn

from listen_port import resolve_backend_listen_port, write_backend_port_file

if __name__ == "__main__":
    os.chdir(Path(__file__).resolve().parent)
    from core.config import settings

    host = "127.0.0.1"
    want = settings.backend_port
    port = resolve_backend_listen_port(want, host)
    if want == 0:
        print(
            f"\n  [backend] BACKEND_PORT=0 - bound to next free port: {port}\n",
            flush=True,
        )

    write_backend_port_file(port)

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
