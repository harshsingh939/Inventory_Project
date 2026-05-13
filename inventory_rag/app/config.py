from functools import lru_cache
from pathlib import Path

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Self

# Always load this package's .env (uvicorn cwd is often repo root, not inventory_rag/)
_RAG_ROOT = Path(__file__).resolve().parent.parent
_RAG_ENV = _RAG_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_RAG_ENV) if _RAG_ENV.is_file() else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    inventory_api_base: str = "http://127.0.0.1:3000/api"
    google_api_key: str = ""
    pinecone_api_key: str = ""
    pinecone_index_name: str = "inventory"
    pinecone_namespace: str = "inventory-live"
    rag_internal_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    # If primary model returns 503/429 (capacity), try this after retries (e.g. gemini-2.0-flash or gemini-2.5-pro).
    gemini_fallback_model: str = ""
    # Google GenAI v1beta embedContent: use gemini-embedding-001 (text-embedding-004 often 404s on this API).
    embedding_model: str = "gemini-embedding-001"
    embedding_output_dimensionality: int = 768
    # Free tier ~100 embed requests/min — smaller batches + pause avoids 429 RESOURCE_EXHAUSTED.
    index_embed_batch_size: int = 16
    index_embed_sleep_seconds: float = 3.5
    # Transient Google errors (503 UNAVAILABLE, 429, “high demand”) — embed + chat.
    google_api_retry_max_attempts: int = 6
    google_api_retry_initial_delay_seconds: float = 2.0
    # After POST /internal/reindex-debounced, wait this long (reset on each ping) before full reindex.
    rag_reindex_debounce_seconds: float = 25.0
    rag_service_host: str = "0.0.0.0"
    rag_service_port: int = 8787

    @model_validator(mode="after")
    def _strip_secret_fields(self) -> Self:
        """`.env` lines like `GOOGLE_API_KEY= key` leave a leading space."""
        for name in (
            "google_api_key",
            "pinecone_api_key",
            "inventory_api_base",
            "rag_internal_key",
            "gemini_fallback_model",
        ):
            v = getattr(self, name, None)
            if isinstance(v, str):
                object.__setattr__(self, name, v.strip())
        return self

    @field_validator("gemini_model", mode="before")
    @classmethod
    def _gemini_model_supported(cls, v: object) -> str:
        """v1beta AI Studio often drops older IDs; map legacy names to current Flash."""
        s = ("" if v is None else str(v)).strip()
        if not s:
            return "gemini-2.5-flash"
        if s.startswith("models/"):
            s = s.replace("models/", "", 1)
        legacy = {
            "gemini-1.5-flash": "gemini-2.5-flash",
            "gemini-1.5-flash-latest": "gemini-2.5-flash",
            "gemini-1.5-flash-8b": "gemini-2.5-flash",
            "gemini-1.5-pro": "gemini-2.5-pro",
            "gemini-1.5-pro-latest": "gemini-2.5-pro",
            "gemini-pro": "gemini-2.5-flash",
        }
        return legacy.get(s, s)

    @field_validator("gemini_fallback_model", mode="before")
    @classmethod
    def _gemini_fallback_strip(cls, v: object) -> str:
        s = ("" if v is None else str(v)).strip()
        if not s:
            return ""
        if s.startswith("models/"):
            s = s.replace("models/", "", 1)
        legacy = {
            "gemini-1.5-flash": "gemini-2.5-flash",
            "gemini-1.5-flash-latest": "gemini-2.5-flash",
            "gemini-1.5-pro": "gemini-2.5-pro",
            "gemini-1.5-pro-latest": "gemini-2.5-pro",
            "gemini-pro": "gemini-2.5-flash",
        }
        return legacy.get(s, s)

    @field_validator("pinecone_index_name", mode="before")
    @classmethod
    def _pinecone_index_nonempty(cls, v: object) -> str:
        s = ("" if v is None else str(v)).strip()
        if not s or s.lower() == "none":
            return "inventory"
        return s

    @field_validator("pinecone_namespace", mode="before")
    @classmethod
    def _pinecone_ns_strip(cls, v: object) -> str:
        s = ("" if v is None else str(v)).strip()
        return s if s else "inventory-live"

    @field_validator("rag_reindex_debounce_seconds", mode="before")
    @classmethod
    def _reindex_debounce_bounds(cls, v: object) -> float:
        try:
            x = float(v)
        except (TypeError, ValueError):
            return 25.0
        return max(5.0, min(600.0, x))


@lru_cache
def get_settings() -> Settings:
    return Settings()


def pinecone_namespace_effective(ns: str | None) -> str:
    """Empty / unset → Pinecone default namespace label used by the console."""
    t = (ns or "").strip()
    return t if t else "__default__"
