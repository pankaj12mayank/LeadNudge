from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

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
        default="http://127.0.0.1:11434",
        validation_alias=AliasChoices(
            "OLLAMA_URL",
            "OLLAMA_BASE_URL",
            "ollama_base_url",
        ),
    )
    ollama_model: str = Field(
        default="llama3.2",
        validation_alias=AliasChoices("OLLAMA_MODEL", "ollama_model"),
    )
    openai_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OPENAI_API_KEY", "openai_api_key"),
    )
    backend_port: int = Field(
        default=8000,
        validation_alias=AliasChoices("BACKEND_PORT", "PORT", "backend_port"),
    )
    # Extra CORS origins (comma-separated), appended to built-in dev defaults
    cors_origins: str | None = Field(
        default=None,
        validation_alias=AliasChoices("CORS_ORIGINS", "cors_origins"),
    )
    bootstrap_admin_email: str | None = None
    bootstrap_admin_password: str | None = None

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
