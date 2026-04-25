"""Resolve TCP port for the API and write repo-root .backend-port (Vite proxy reads it)."""
from __future__ import annotations

import socket
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent


def pick_free_port(host: str, start: int, attempts: int = 80) -> int:
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


def write_backend_port_file(port: int) -> None:
    try:
        (_REPO_ROOT / ".backend-port").write_text(str(port), encoding="utf-8")
    except OSError:
        pass


def resolve_backend_listen_port(configured: int, host: str = "127.0.0.1") -> int:
    """If configured is 0, use first free port from 8000; else use configured."""
    if configured == 0:
        return pick_free_port(host, 8000)
    return configured
