from fastapi import APIRouter

from app.api.routes import admin, auth, djs, health, me, notifications, payments, requests, sessions, songs, tips, venues

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(me.router)
api_router.include_router(djs.router)
api_router.include_router(djs.dj_router)
api_router.include_router(venues.router)
api_router.include_router(sessions.router)
api_router.include_router(sessions.dj_router)
api_router.include_router(songs.router)
api_router.include_router(requests.router)
api_router.include_router(requests.dj_router)
api_router.include_router(tips.router)
api_router.include_router(tips.dj_router)
api_router.include_router(payments.router)
api_router.include_router(notifications.router)
api_router.include_router(admin.router)

