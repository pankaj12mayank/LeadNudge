"""Run API without reload (for silent / background startup)."""
import os
from pathlib import Path

import uvicorn

if __name__ == "__main__":
    os.chdir(Path(__file__).resolve().parent)
    from core.config import settings

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=settings.backend_port,
        reload=False,
        log_level="warning",
    )
