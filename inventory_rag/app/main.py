from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.indexing import get_index_meta, pinecone_index_stats, reindex_from_api
from app.rag_chain import answer_with_rag
from app.reindex_debounce import schedule_debounced_reindex


@asynccontextmanager
async def lifespan(_app: FastAPI):
    s = get_settings()
    # LangChain Google GenAI 4.x reads GOOGLE_API_KEY from the process env; setdefault
    # would keep an empty system env value and break embeddings init (400 ValueError).
    if (s.google_api_key or "").strip():
        os.environ["GOOGLE_API_KEY"] = s.google_api_key.strip()
    if (s.pinecone_api_key or "").strip():
        os.environ["PINECONE_API_KEY"] = s.pinecone_api_key.strip()
    yield


app = FastAPI(title="Inventory RAG", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_internal_key(
    x_internal_key: str | None = Header(None, alias="X-Internal-Key"),
    settings: Settings = Depends(get_settings),
) -> None:
    expected = (settings.rag_internal_key or "").strip()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="RAG_INTERNAL_KEY is not set on the RAG service; refusing requests.",
        )
    if (x_internal_key or "").strip() != expected:
        raise HTTPException(status_code=401, detail="Invalid internal key")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/internal/status", dependencies=[Depends(verify_internal_key)])
def internal_status(settings: Settings = Depends(get_settings)):
    try:
        body = pinecone_index_stats(settings)
    except Exception as e:  # noqa: BLE001
        body = {"error": str(e)}
    return {"pinecone": body, "indexer": get_index_meta()}


@app.post("/internal/reindex", dependencies=[Depends(verify_internal_key)])
async def internal_reindex(settings: Settings = Depends(get_settings)):
    try:
        result = await reindex_from_api(settings)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/internal/reindex-debounced", dependencies=[Depends(verify_internal_key)])
async def internal_reindex_debounced(settings: Settings = Depends(get_settings)):
    """Node calls this after DB writes; coalesces bursts into one reindex."""
    try:
        await schedule_debounced_reindex(settings)
        return {
            "ok": True,
            "scheduled": True,
            "debounce_s": settings.rag_reindex_debounce_seconds,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/internal/chat", dependencies=[Depends(verify_internal_key)])
def internal_chat(payload: dict, settings: Settings = Depends(get_settings)):
    q = (payload or {}).get("question") or (payload or {}).get("q")
    if not q or not str(q).strip():
        raise HTTPException(status_code=400, detail="question is required")
    try:
        return answer_with_rag(str(q).strip(), settings)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        detail = str(e)
        low = detail.lower()
        if any(
            x in low
            for x in (
                "503",
                "504",
                "429",
                "unavailable",
                "resource_exhausted",
                "high demand",
                "try again later",
                "overloaded",
            )
        ):
            raise HTTPException(
                status_code=503,
                detail=(
                    "Google Gemini/embeddings are temporarily overloaded or rate-limited. "
                    "The service retries with backoff; wait a minute and try again. "
                    "Optional: set GEMINI_FALLBACK_MODEL (e.g. gemini-2.0-flash) in inventory_rag/.env. "
                    f"Raw: {detail[:500]}"
                ),
            ) from e
        raise HTTPException(status_code=500, detail=detail) from e
