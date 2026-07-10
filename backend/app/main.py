import asyncio

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import get_settings
from app.core.database import Base, SessionLocal, engine
from app.realtime.manager import manager
from app.realtime.queue import broadcast_session_queue, session_queue_channel, set_main_event_loop
from app.services.db_schema import ensure_sqlite_schema_patches
from app.services.deadlines import expire_overdue_requests
from app.services.dev_bootstrap import ensure_admin_user, ensure_local_demo_session, reconcile_local_pending_payments
from app.services.event_sessions import sync_live_sessions_for_events
from app.services.dj_profiles import ensure_registered_dj_profiles

settings = get_settings()
settings.uploads_dir.mkdir(parents=True, exist_ok=True)
Base.metadata.create_all(bind=engine)
ensure_sqlite_schema_patches(engine)

app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix=settings.api_prefix)
app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")


@app.on_event("startup")
async def bootstrap_local_data() -> None:
    set_main_event_loop(asyncio.get_running_loop())
    with SessionLocal() as db:
        ensure_admin_user(db)
        ensure_registered_dj_profiles(db)
        ensure_local_demo_session(db)
        sync_live_sessions_for_events(db)
        reconcile_local_pending_payments(db)
    asyncio.create_task(_expire_play_deadlines_loop())


async def _expire_play_deadlines_loop() -> None:
    while True:
        await asyncio.sleep(15)
        with SessionLocal() as db:
            try:
                expire_overdue_requests(db, force=True)
            except Exception:
                db.rollback()


@app.websocket("/ws/sessions/{session_id}")
async def session_queue_socket(websocket: WebSocket, session_id: int) -> None:
    channel = session_queue_channel(session_id)
    await manager.connect(websocket, channel)
    try:
        await broadcast_session_queue(session_id)
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket, channel)

