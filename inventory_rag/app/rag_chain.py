from __future__ import annotations

import random
import time
from typing import Callable, TypeVar

from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone

from app.config import Settings, pinecone_namespace_effective
from app.inventory_fetch import fetch_live_summary_sync

T = TypeVar("T")


def _transient_google_error(exc: BaseException) -> bool:
    """503 UNAVAILABLE, 429, overload strings from Gemini / embed API."""
    code = getattr(exc, "code", None)
    if code in (429, 503, 504):
        return True
    text = str(exc).lower()
    needles = (
        "503",
        "429",
        "504",
        "unavailable",
        "resource_exhausted",
        "resource exhausted",
        "high demand",
        "try again later",
        "overloaded",
        "deadline exceeded",
        "econnreset",
        "connection reset",
    )
    return any(n in text for n in needles)


def _call_with_retries(fn: Callable[[], T], settings: Settings) -> T:
    attempts = max(2, min(25, int(settings.google_api_retry_max_attempts)))
    initial = max(0.5, float(settings.google_api_retry_initial_delay_seconds))
    last: BaseException | None = None
    for attempt in range(attempts):
        try:
            return fn()
        except Exception as e:
            last = e
            if not _transient_google_error(e):
                raise
            if attempt >= attempts - 1:
                raise
            delay = min(60.0, initial * (2**attempt)) + random.uniform(0.0, 1.25)
            time.sleep(delay)
    assert last is not None
    raise last

SYSTEM = """You are the InvenTrack inventory assistant (internal ops / admin style). Answer in the same language as the question when it is clearly Hindi or Hinglish; otherwise use clear English.

## Inputs (in order of trust for factual detail)
1. **Retrieved rows** — each block starts with `[kind=…] source_id=…`. These are slices from the last RAG re-index (Pinecone retrieval). They are your primary source for names, serials, repair ids, dates, and statuses.
2. **Live summary** — aggregate table counts + `generated_at` from the same backend family as `/api/rag-export/snapshot`. Use it for fleet scale (“roughly how many assets”), freshness, and sanity checks. **Do not** invent per-row facts from counts alone.

## How to analyze (follow mentally before writing)
- Extract entities: serial fragments, employee name/id, repair id, department, inventory name, date words, status keywords.
- Match against retrieved lines; prefer rows whose `kind` fits the question (e.g. repairs for cost/vendor, `session`/`assignment` for checkout history, `disposed` for retired gear).
- If two rows conflict (e.g. brand vs model line), prefer explicit serial/model evidence and say there is a data inconsistency, citing source_id / asset id.

## Domain map (kinds)
- `inventory` — buckets / locations / lists in the DB.
- `asset` — live hardware row (not disposed).
- `user` — employee directory fields.
- `auth_user` — login accounts and roles (admin, user, repair_authority); no passwords in context.
- `assignment` — historical link user_id ↔ asset_id; lines include resolved employee_name and system_name.
- `active_assignment` — current checkouts only.
- `session` — checkout history with times, working_minutes, conditions (may join disposed device fields if asset row was removed).
- `repair` — tickets; includes resolved device line (brand/model/serial).
- `disposed` — audit after removal from assets; use for “what happened to serial X” if asset row is gone.
- `assignment_request` / `assignment_request_item` — **requests** to assign gear, not the same as `assignment` checkout rows.

## Data quality
- brand, asset_type, and model may be wrong in the DB. For OEM or “laptop” counts you may use well-known product families and serial hints (EliteBook → HP, etc.) as already hinted in some asset lines. State briefly when you override a bad brand field.

## Style
- Lead with a direct answer (1–2 sentences), then short bullets with **identifiers** (repair id, asset id, assignment_id, disposition id) and human-readable names.
- If context is insufficient, say what is missing and suggest re-indexing or narrowing the question — do not guess numbers or names not present.

Stay grounded: no invented serials, costs, or people."""


def _format_retrieved_block(doc) -> str:
    meta = getattr(doc, "metadata", None) or {}
    kind = meta.get("kind") or "row"
    sid = meta.get("source_id") or ""
    chunk = meta.get("chunk")
    head = f"[kind={kind}] source_id={sid}"
    if chunk is not None:
        head += f" chunk={chunk}"
    body = getattr(doc, "page_content", "") or ""
    return f"{head}\n{body}"


def answer_with_rag(question: str, settings: Settings) -> dict:
    if not settings.google_api_key:
        raise ValueError("GOOGLE_API_KEY is required")
    if not settings.pinecone_api_key:
        raise ValueError("PINECONE_API_KEY is required")

    live_summary = fetch_live_summary_sync(settings.inventory_api_base, settings.rag_internal_key)
    if not live_summary.strip():
        live_summary = (
            "(Live summary unavailable — ensure Node exposes GET /api/rag-export/summary and "
            "RAG_INTERNAL_KEY matches on Node and the RAG service.)"
        )

    embeddings = GoogleGenerativeAIEmbeddings(
        model=settings.embedding_model,
        api_key=settings.google_api_key,
        output_dimensionality=settings.embedding_output_dimensionality,
        task_type="RETRIEVAL_QUERY",
    )
    pc = Pinecone(api_key=settings.pinecone_api_key)
    idx = pc.Index(settings.pinecone_index_name)
    store = PineconeVectorStore(
        index=idx,
        embedding=embeddings,
        namespace=pinecone_namespace_effective(settings.pinecone_namespace),
    )
    # Slightly higher k so repairs + sessions + assets can co-exist in one answer.
    docs = _call_with_retries(lambda: store.similarity_search(question, k=18), settings)
    context = "\n\n---\n\n".join(_format_retrieved_block(d) for d in docs)

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM),
            (
                "human",
                "Live summary:\n{live_summary}\n\n"
                "Retrieved indexed rows:\n{context}\n\n"
                "Question:\n{question}",
            ),
        ]
    )
    payload = {"live_summary": live_summary, "context": context, "question": question}

    def invoke_model(model_id: str):
        llm = ChatGoogleGenerativeAI(
            model=model_id,
            api_key=settings.google_api_key,
            temperature=0.15,
        )
        chain = prompt | llm
        return _call_with_retries(lambda: chain.invoke(payload), settings)

    try:
        msg = invoke_model(settings.gemini_model)
    except Exception as primary_err:
        fb = (settings.gemini_fallback_model or "").strip()
        if not fb or fb == settings.gemini_model:
            raise primary_err
        try:
            msg = invoke_model(fb)
        except Exception as secondary_err:
            raise secondary_err from primary_err

    answer = msg.content if hasattr(msg, "content") else str(msg)

    sources = []
    for d in docs[:8]:
        meta = dict(getattr(d, "metadata", None) or {})
        content = getattr(d, "page_content", "") or ""
        sources.append(
            {
                "content": content[:500],
                "kind": meta.get("kind"),
                "source_id": meta.get("source_id"),
                "preview": content[:420],
                "metadata": meta,
            }
        )
    return {"answer": answer, "sources": sources, "live_summary_used": live_summary[:800]}
