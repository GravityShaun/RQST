from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from app.core.database import SessionLocal
from app.realtime.manager import manager
from app.repositories.requests import build_request_reads, get_session_queue

if TYPE_CHECKING:
    from asyncio import AbstractEventLoop

_main_loop: AbstractEventLoop | None = None


def set_main_event_loop(loop: AbstractEventLoop) -> None:
    global _main_loop
    _main_loop = loop


def session_queue_channel(session_id: int) -> str:
    return f"session:{session_id}:queue"


async def broadcast_session_queue(session_id: int) -> None:
    with SessionLocal() as db:
        queue = get_session_queue(db, session_id)
        reads = build_request_reads(db, queue)
        payload = {
            "type": "queue.updated",
            "session_id": session_id,
            "requests": [item.model_dump(mode="json") for item in reads],
        }
        await manager.broadcast(session_queue_channel(session_id), payload)


def schedule_session_queue_broadcast(session_id: int) -> None:
    if _main_loop is None or _main_loop.is_closed():
        return
    asyncio.run_coroutine_threadsafe(broadcast_session_queue(session_id), _main_loop)
