"""Run API with reload. Port from ports.env / .env; BACKEND_PORT=0 picks a free port from 8000.

Writes repo-root ../.backend-port so Vite's dev proxy targets the same port.
"""
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
            f"\n  [backend] BACKEND_PORT=0 — using free port {port} (written to .backend-port for Vite)\n",
            flush=True,
        )

    write_backend_port_file(port)

    print(f"  [backend] API: http://{host}:{port}\n", flush=True)

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,
    )
