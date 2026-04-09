from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
STATIC_ROOT = BACKEND_ROOT / "static"
UPLOAD_DIR = STATIC_ROOT / "uploads"
