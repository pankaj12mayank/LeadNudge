from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_REPO_ROOT = _BACKEND_DIR.parent
# Load order: backend/.env first, then repo-root ports.env (ports.env wins on same keys).
# So BACKEND_PORT=0 in ports.env overrides an old PORT=8000 in .env (fixes busy 8000).
_env_list: list[str] = []
_env_backend = _BACKEND_DIR / ".env"
if _env_backend.is_file():
    _env_list.append(str(_env_backend))
_ports = _REPO_ROOT / "ports.env"
if _ports.is_file():
    _env_list.append(str(_ports))
_ENV_FILES: tuple[str, ...] = tuple(_env_list)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILES if _ENV_FILES else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "sqlite:///./app.db"
    secret_key: str = "secret"
    # Deployment-wide AI mode: "local" = always Ollama; "api" = allow OpenAI when workspace/key permits
    mode: str = Field(
        default="local",
        validation_alias=AliasChoices("MODE", "mode"),
    )
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    ollama_base_url: str = Field(
        default="http://localhost:11434",
        validation_alias=AliasChoices(
            "OLLAMA_URL",
            "OLLAMA_BASE_URL",
            "ollama_base_url",
        ),
    )
    ollama_model: str = Field(
        default="llama3.2:latest",
        validation_alias=AliasChoices("OLLAMA_MODEL", "ollama_model"),
    )
    openai_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OPENAI_API_KEY", "openai_api_key"),
    )
    # Use 0 for "first free port" from 8000 upward (see run_prod.py + ports.env).
    backend_port: int = Field(
        default=8000,
        ge=0,
        le=65535,
        validation_alias=AliasChoices("BACKEND_PORT", "PORT", "backend_port"),
    )
    # Extra CORS origins (comma-separated), appended to built-in dev defaults
    cors_origins: str | None = Field(
        default=None,
        validation_alias=AliasChoices("CORS_ORIGINS", "cors_origins"),
    )
    bootstrap_admin_email: str | None = None
    bootstrap_admin_password: str | None = None
    frontend_base_url: str = Field(
        default="http://localhost:5173",
        validation_alias=AliasChoices("FRONTEND_URL", "frontend_base_url"),
    )

    @field_validator("openai_api_key", mode="before")
    @classmethod
    def _empty_openai(cls, v):
        if v == "":
            return None
        return v

    def cors_origins_list(self) -> list[str]:
        defaults = [
            "http://127.0.0.1:5173",
            "http://localhost:5173",
        ]
        extra: list[str] = []
        if self.cors_origins:
            extra = [
                o.strip().rstrip("/")
                for o in self.cors_origins.split(",")
                if o.strip()
            ]
        merged = defaults + extra
        return list(dict.fromkeys(merged))


settings = Settings()
