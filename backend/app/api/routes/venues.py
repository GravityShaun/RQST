from fastapi import APIRouter

router = APIRouter(prefix="/venues", tags=["venues"])


@router.get("/search", response_model=list[dict])
def search_venues(q: str | None = None) -> list[dict]:
    return [{"id": 1, "name": "Neon Room", "query": q}]


@router.get("/nearby", response_model=list[dict])
def nearby_venues(latitude: float | None = None, longitude: float | None = None) -> list[dict]:
    return [{"id": 1, "name": "Neon Room", "latitude": latitude, "longitude": longitude}]

