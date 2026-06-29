from fastapi import APIRouter

router = APIRouter(prefix="/songs", tags=["songs"])


@router.get("/search", response_model=list[dict])
def search_songs(q: str) -> list[dict]:
    return [
        {
            "id": 1,
            "title": q,
            "artist": "Search Result",
            "source": "internal_catalog",
            "is_playability_guaranteed": False,
        }
    ]


@router.get("/{song_id}", response_model=dict)
def get_song(song_id: int) -> dict:
    return {"id": song_id, "title": "Sample Song", "artist": "Sample Artist"}

