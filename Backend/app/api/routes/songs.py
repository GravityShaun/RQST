from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.api.deps import DBSession
from app.core.config import get_settings
from app.models import Song
from app.schemas.songs import ArtistSearchResult, MusicSearchResult, SongRead, SongSearchResult
from app.services.apple_music import (
    AppleMusicArtist,
    AppleMusicError,
    filter_songs_by_artist,
    rank_artists,
    rank_songs,
    search_catalog,
)

router = APIRouter(prefix="/songs", tags=["songs"])


@router.get("/search", response_model=list[MusicSearchResult])
def search_songs(
    db: DBSession,
    q: str = Query(min_length=2, max_length=120),
    artist: str | None = Query(default=None, min_length=2, max_length=120),
    limit: int = Query(default=10, ge=1, le=25),
) -> list[MusicSearchResult]:
    settings = get_settings()
    artist_query = " ".join(artist.split()) if artist else None
    try:
        song_limit = 25 if artist_query else max(1, min(limit, 18))
        artist_limit = min(6, max(2, limit // 3))
        search_limit = min(25, max(song_limit, song_limit + artist_limit))
        search_term = f"{artist_query} {q}" if artist_query else q
        search_results = search_catalog(
            search_term,
            developer_token=settings.apple_music_developer_token,
            storefront=settings.apple_music_storefront,
            limit=search_limit,
            include_artists=not artist_query,
        )
        songs = (
            filter_songs_by_artist(search_results.songs, artist_query)
            if artist_query
            else rank_songs(q, search_results.songs)
        )[:song_limit]
        artists = [] if artist_query else rank_artists(q, search_results.artists)[:artist_limit]
    except AppleMusicError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Apple Music search is temporarily unavailable",
        ) from exc

    results: list[MusicSearchResult] = []
    top_artist = artists[0] if artists else None
    if top_artist:
        results.append(_artist_result(top_artist))

    for song_result in songs:
        song = db.scalar(
            select(Song).where(
                Song.external_source == "apple_music",
                Song.external_id == song_result.apple_music_id,
            )
        )
        if not song:
            song = Song(
                title=song_result.title,
                artist=song_result.artist,
                album=song_result.album,
                duration_ms=song_result.duration_ms,
                album_art_url=song_result.album_art_url,
                isrc=song_result.isrc,
                external_source="apple_music",
                external_id=song_result.apple_music_id,
                explicit=song_result.explicit,
            )
            db.add(song)
            db.flush()
        else:
            if song_result.album_art_url and song.album_art_url != song_result.album_art_url:
                song.album_art_url = song_result.album_art_url
            if song.explicit != song_result.explicit:
                song.explicit = song_result.explicit

        results.append(
            SongSearchResult(
                id=song.id,
                title=song.title,
                artist=song.artist,
                album=song.album,
                duration_ms=song.duration_ms,
                album_art_url=song.album_art_url,
                isrc=song.isrc,
                external_source=song.external_source or "apple_music",
                external_id=song.external_id or song_result.apple_music_id,
                popularity_score=song_result.score,
            )
        )

    for artist in artists[1:]:
        results.append(_artist_result(artist))

    db.commit()
    return results


@router.get("/{song_id}", response_model=SongRead)
def get_song(song_id: int, db: DBSession) -> SongRead:
    song = db.get(Song, song_id)
    if not song:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Song not found")
    return SongRead.model_validate(song)


def _artist_result(artist: AppleMusicArtist) -> ArtistSearchResult:
    genre_names = artist.genre_names or []

    return ArtistSearchResult(
        id=artist.apple_music_id,
        name=artist.name,
        image_url=artist.image_url,
        disambiguation=", ".join(genre_names[:2]) or None,
        artist_type="Artist",
        external_source="apple_music",
        external_id=artist.apple_music_id,
    )
