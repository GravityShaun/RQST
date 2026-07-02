from typing import Literal

from app.schemas.common import APIModel


class SongSearchResult(APIModel):
    result_type: Literal["song"] = "song"
    id: int | None = None
    title: str
    artist: str
    album: str | None = None
    duration_ms: int | None = None
    album_art_url: str | None = None
    isrc: str | None = None
    external_source: str
    external_id: str
    popularity_score: int = 0
    is_playability_guaranteed: bool = False


class ArtistSearchResult(APIModel):
    result_type: Literal["artist"] = "artist"
    id: str
    name: str
    image_url: str | None = None
    disambiguation: str | None = None
    country: str | None = None
    artist_type: str | None = None
    external_source: str = "apple_music"
    external_id: str


MusicSearchResult = SongSearchResult | ArtistSearchResult


class SongRead(APIModel):
    id: int
    title: str
    artist: str
    album: str | None = None
    duration_ms: int | None = None
    album_art_url: str | None = None
    isrc: str | None = None
    external_source: str | None = None
    external_id: str | None = None
    explicit: bool = False
