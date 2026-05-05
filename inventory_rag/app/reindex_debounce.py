"""Coalesce many write notifications into one full reindex after a quiet period."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.config import Settings

_task: asyncio.Task | None = None
_lock = asyncio.Lock()


async def schedule_debounced_reindex(settings: Settings) -> None:
    """
    Each new POST resets the timer. After `rag_reindex_debounce_seconds` with no new pings,
    runs `reindex_from_api` once (same as manual /internal/reindex).
    """
    global _task
    from app.indexing import reindex_from_api

    delay = max(5.0, float(getattr(settings, "rag_reindex_debounce_seconds", 25.0)))

    async with _lock:
        if _task is not None and not _task.done():
            _task.cancel()

        async def runner() -> None:
            try:
                await asyncio.sleep(delay)
            except asyncio.CancelledError:
                return
            await reindex_from_api(settings)

        _task = asyncio.create_task(runner())
