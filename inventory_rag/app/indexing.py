from __future__ import annotations

import re
import time
from typing import Any

from langchain_core.documents import Document
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone

from app.config import Settings, pinecone_namespace_effective
from app.inventory_fetch import documents_from_snapshot, fetch_live_snapshot

_last_index_unix: float | None = None
_last_index_counts: dict[str, int] = {}


def get_index_meta() -> dict[str, Any]:
    return {
        "last_index_unix": _last_index_unix,
        "last_index_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(_last_index_unix))
        if _last_index_unix
        else None,
        "last_counts": _last_index_counts,
    }


def _safe_clear_namespace(index: Any, namespace: str) -> None:
    """First-time namespaces may not exist yet; Pinecone returns 404 / Namespace not found."""
    try:
        index.delete(delete_all=True, namespace=namespace)
    except Exception as e:  # noqa: BLE001
        msg = str(e).lower()
        if (
            "namespace not found" in msg
            or "not found" in msg
            or "404" in msg
            or '"code":5' in msg.replace(" ", "")
            or "code=5" in msg
        ):
            return
        raise


def _parse_retry_after_seconds(msg: str) -> float | None:
    m = re.search(r"retry in ([\d.]+)\s*s", msg, re.I)
    if m:
        return float(m.group(1))
    return None


def _pinecone_from_texts_throttled(
    texts: list[str],
    metas: list[dict[str, Any]],
    embeddings: Any,
    settings: Settings,
    namespace: str,
) -> None:
    """Chunk upserts + pause between chunks; retry on Google 429 embed quota."""
    n = len(texts)
    if n == 0:
        return
    batch = max(4, min(int(settings.index_embed_batch_size), 64))
    pause = max(0.0, float(settings.index_embed_sleep_seconds))
    idx_name = settings.pinecone_index_name
    max_attempts = 12

    for start in range(0, n, batch):
        chunk_t = texts[start : start + batch]
        chunk_m = metas[start : start + batch]
        if start > 0 and pause > 0:
            time.sleep(pause)
        attempt = 0
        while True:
            attempt += 1
            try:
                inner_bs = max(4, min(16, len(chunk_t)))
                inner_ec = max(8, min(32, len(chunk_t)))
                PineconeVectorStore.from_texts(
                    chunk_t,
                    embeddings,
                    metadatas=chunk_m,
                    index_name=idx_name,
                    namespace=namespace,
                    batch_size=inner_bs,
                    embeddings_chunk_size=inner_ec,
                )
                break
            except Exception as e:  # noqa: BLE001
                err = str(e)
                is429 = (
                    "429" in err
                    or "RESOURCE_EXHAUSTED" in err
                    or "quota" in err.lower()
                    or "rate" in err.lower()
                )
                if not is429 or attempt >= max_attempts:
                    raise
                wait = _parse_retry_after_seconds(err) or min(90.0, 12.0 * attempt)
                time.sleep(wait + 1.0)


async def reindex_from_api(settings: Settings) -> dict[str, Any]:
    global _last_index_unix, _last_index_counts

    if not settings.google_api_key:
        raise ValueError("GOOGLE_API_KEY is required for embeddings")
    if not settings.pinecone_api_key:
        raise ValueError("PINECONE_API_KEY is required")
    if not settings.pinecone_index_name:
        raise ValueError("PINECONE_INDEX_NAME is required")

    if not (settings.rag_internal_key or "").strip():
        raise ValueError(
            "RAG_INTERNAL_KEY is required so the indexer can call GET /api/rag-export/snapshot on Node."
        )

    data = await fetch_live_snapshot(settings.inventory_api_base, settings.rag_internal_key)
    pairs = documents_from_snapshot(data)
    documents = [
        Document(page_content=text, metadata={**meta, "chunk": "0"}) for text, meta in pairs
    ]

    embeddings = GoogleGenerativeAIEmbeddings(
        model=settings.embedding_model,
        api_key=settings.google_api_key,
        output_dimensionality=settings.embedding_output_dimensionality,
        task_type="RETRIEVAL_DOCUMENT",
    )

    pc = Pinecone(api_key=settings.pinecone_api_key)
    index = pc.Index(settings.pinecone_index_name)
    ns = pinecone_namespace_effective(settings.pinecone_namespace)
    _safe_clear_namespace(index, ns)

    if documents:
        texts = [d.page_content for d in documents]
        metas = [d.metadata for d in documents]
        _pinecone_from_texts_throttled(
            texts,
            metas,
            embeddings,
            settings,
            ns,
        )

    _last_index_unix = time.time()
    _last_index_counts = {
        "inventories": len(data.get("inventories") or []),
        "assets": len(data.get("assets") or []),
        "users": len(data.get("users") or []),
        "auth_users_public": len(data.get("auth_users_public") or []),
        "assignments": len(data.get("assignments") or []),
        "active_assignments": len(data.get("active_assignments") or []),
        "sessions": len(data.get("sessions") or []),
        "repairs": len(data.get("repairs") or []),
        "disposed_items": len(data.get("disposed_items") or []),
        "assignment_requests": len(data.get("assignment_requests") or []),
        "assignment_request_items": len(data.get("assignment_request_items") or []),
        "vectors": len(documents),
    }

    stats = index.describe_index_stats()
    return {
        "ok": True,
        "namespace": ns,
        "indexed": _last_index_counts,
        "pinecone_stats": _stats_to_dict(stats),
    }


def _stats_to_dict(stats: Any) -> Any:
    if stats is None:
        return {}
    md = getattr(stats, "model_dump", None)
    if callable(md):
        return md()
    td = getattr(stats, "to_dict", None)
    if callable(td):
        return td()
    if isinstance(stats, dict):
        return stats
    try:
        return dict(stats)
    except Exception:
        return {"repr": repr(stats)}


def pinecone_index_stats(settings: Settings) -> dict[str, Any]:
    pc = Pinecone(api_key=settings.pinecone_api_key)
    index = pc.Index(settings.pinecone_index_name)
    return _stats_to_dict(index.describe_index_stats())
