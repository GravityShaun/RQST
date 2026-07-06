from __future__ import annotations

import json
import re
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

APPLE_MUSIC_CATALOG_SEARCH_URL = "https://api.music.apple.com/v1/catalog/{storefront}/search"
ITUNES_SEARCH_URL = "https://itunes.apple.com/search"


class AppleMusicError(RuntimeError):
    pass


@dataclass(frozen=True)
class AppleMusicSong:
    title: str
    artist: str
    album: str | None
    duration_ms: int | None
    isrc: str | None
    apple_music_id: str
    album_art_url: str | None
    explicit: bool = False
    score: int = 0


@dataclass(frozen=True)
class AppleMusicArtist:
    name: str
    apple_music_id: str
    image_url: str | None = None
    genre_names: list[str] | None = None
    score: int = 0


@dataclass(frozen=True)
class AppleMusicSearchResults:
    songs: list[AppleMusicSong]
    artists: list[AppleMusicArtist]


def search_catalog(
    query: str,
    *,
    developer_token: str | None,
    storefront: str = "us",
    limit: int = 10,
    include_artists: bool = True,
) -> AppleMusicSearchResults:
    if not developer_token:
        return _search_itunes_catalog(query, limit=limit, include_artists=include_artists)

    types = ["songs"]
    if include_artists:
        types.append("artists")

    params = urlencode(
        {
            "term": query,
            "types": ",".join(types),
            "limit": max(1, min(limit, 25)),
        }
    )
    request = Request(
        f"{APPLE_MUSIC_CATALOG_SEARCH_URL.format(storefront=storefront.lower())}?{params}",
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {developer_token}",
        },
    )

    try:
        with urlopen(request, timeout=4) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code in {400, 401, 403}:
            return _search_itunes_catalog(query, limit=limit, include_artists=include_artists)
        raise AppleMusicError("Apple Music search is unavailable") from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise AppleMusicError("Apple Music search is unavailable") from exc

    results = payload.get("results") if isinstance(payload, dict) else {}
    songs = results.get("songs", {}).get("data", []) if isinstance(results, dict) else []
    artists = results.get("artists", {}).get("data", []) if isinstance(results, dict) else []

    return AppleMusicSearchResults(
        songs=[
            _normalize_song(song, score=limit - index)
            for index, song in enumerate(songs)
            if isinstance(song, dict) and song.get("id")
        ],
        artists=[
            _normalize_artist(artist, score=limit - index)
            for index, artist in enumerate(artists)
            if isinstance(artist, dict) and artist.get("id")
        ],
    )


def _search_itunes_catalog(
    query: str,
    *,
    limit: int,
    include_artists: bool,
) -> AppleMusicSearchResults:
    songs_payload = _search_itunes_entity(query, entity="musicTrack", limit=limit)
    artist_payload = (
        _search_itunes_entity(query, entity="musicArtist", limit=limit) if include_artists else []
    )

    songs = [
        _normalize_itunes_song(result, score=limit - index)
        for index, result in enumerate(songs_payload)
        if isinstance(result, dict) and result.get("wrapperType") == "track" and result.get("trackId")
    ]

    artists: list[AppleMusicArtist] = []
    artist_ids: set[str] = set()
    for index, result in enumerate(artist_payload):
        if not isinstance(result, dict):
            continue
        if result.get("wrapperType") != "artist" or not result.get("artistId"):
            continue
        artist_id = str(result["artistId"])
        if artist_id in artist_ids:
            continue
        artist_ids.add(artist_id)
        artists.append(_normalize_itunes_artist(result, score=limit - index))

    return AppleMusicSearchResults(songs=songs, artists=artists)


def _search_itunes_entity(query: str, *, entity: str, limit: int) -> list[dict]:
    params = urlencode(
        {
            "term": query,
            "media": "music",
            "entity": entity,
            "limit": max(1, min(limit, 50)),
        }
    )
    request = Request(
        f"{ITUNES_SEARCH_URL}?{params}",
        headers={
            "Accept": "application/json",
            "User-Agent": "RQST/0.1",
        },
    )

    try:
        with urlopen(request, timeout=4) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise AppleMusicError("Apple Music search is unavailable") from exc

    results = payload.get("results") if isinstance(payload, dict) else []
    if not isinstance(results, list):
        return []

    return [result for result in results if isinstance(result, dict)]


def _normalize_itunes_song(song: dict, *, score: int) -> AppleMusicSong:
    return AppleMusicSong(
        title=song.get("trackName") or "Unknown title",
        artist=song.get("artistName") or "Unknown artist",
        album=song.get("collectionName"),
        duration_ms=song.get("trackTimeMillis"),
        isrc=None,
        apple_music_id=str(song["trackId"]),
        album_art_url=_itunes_artwork_url(song.get("artworkUrl100")),
        explicit=song.get("trackExplicitness") == "explicit",
        score=score,
    )


def _normalize_itunes_artist(artist: dict, *, score: int) -> AppleMusicArtist:
    return AppleMusicArtist(
        name=artist.get("artistName") or "Unknown artist",
        apple_music_id=str(artist["artistId"]),
        genre_names=[artist["primaryGenreName"]] if artist.get("primaryGenreName") else None,
        score=score,
    )


def rank_songs(query: str, songs: list[AppleMusicSong]) -> list[AppleMusicSong]:
    return [
        song
        for _, song in sorted(
            enumerate(songs),
            key=lambda item: (-item[1].score, item[0]),
        )
    ]


def rank_artists(query: str, artists: list[AppleMusicArtist]) -> list[AppleMusicArtist]:
    return [
        artist
        for _, artist in sorted(
            enumerate(artists),
            key=lambda item: (-item[1].score, item[0]),
        )
    ]


def filter_songs_by_artist(songs: list[AppleMusicSong], artist_name: str) -> list[AppleMusicSong]:
    selected_artist = " ".join(_words(artist_name))
    if not selected_artist:
        return songs

    matching = [
        song
        for song in songs
        if selected_artist == " ".join(_words(song.artist))
        or selected_artist in " ".join(_words(song.artist))
    ]
    return matching or songs


def _normalize_song(song: dict, *, score: int) -> AppleMusicSong:
    attributes = song.get("attributes") or {}

    return AppleMusicSong(
        title=attributes.get("name") or "Unknown title",
        artist=attributes.get("artistName") or "Unknown artist",
        album=attributes.get("albumName"),
        duration_ms=attributes.get("durationInMillis"),
        isrc=attributes.get("isrc"),
        apple_music_id=song["id"],
        album_art_url=_artwork_url(attributes.get("artwork")),
        explicit=attributes.get("contentRating") == "explicit",
        score=score,
    )


def _normalize_artist(artist: dict, *, score: int) -> AppleMusicArtist:
    attributes = artist.get("attributes") or {}

    return AppleMusicArtist(
        name=attributes.get("name") or "Unknown artist",
        apple_music_id=artist["id"],
        image_url=_artwork_url(attributes.get("artwork")),
        genre_names=attributes.get("genreNames"),
        score=score,
    )


def _artwork_url(artwork: dict | None) -> str | None:
    if not isinstance(artwork, dict):
        return None

    url = artwork.get("url")
    if not isinstance(url, str):
        return None

    width = artwork.get("width") or 300
    height = artwork.get("height") or 300
    return url.replace("{w}", str(width)).replace("{h}", str(height))


def _itunes_artwork_url(url: object) -> str | None:
    if not isinstance(url, str):
        return None

    return re.sub(r"/\d+x\d+bb\.", "/600x600bb.", url)


def _song_score(query_words: list[str], song: AppleMusicSong) -> int:
    title = " ".join(_words(song.title))
    artist = " ".join(_words(song.artist))
    album = " ".join(_words(song.album or ""))
    combined = f"{title} {artist} {album}".strip()
    query = " ".join(query_words)
    score = sum(1 for word in query_words if word in combined)

    if query == title:
        score += 30
    if query == artist:
        score += 20
    if query in combined:
        score += 8

    for index in range(1, len(query_words)):
        left = " ".join(query_words[:index])
        right = " ".join(query_words[index:])
        if left in artist and right in title:
            score += 40
        if left in title and right in artist:
            score += 40

    return score


def _artist_score(query_words: list[str], artist: AppleMusicArtist) -> int:
    name = " ".join(_words(artist.name))
    canonical_name = _drop_leading_article(name)
    query = " ".join(query_words)
    canonical_query = _drop_leading_article(query)
    score = sum(1 for word in query_words if word in name)

    if query == name:
        score += 100
    if canonical_query == canonical_name:
        score += 90
    if name.startswith(query):
        score += 70
    if canonical_query and canonical_name.startswith(canonical_query):
        score += 60
    if query in name:
        score += 12
    if canonical_query and canonical_query in canonical_name:
        score += 10
    if query_words and all(
        any(name_word.startswith(query_word) for name_word in name.split())
        for query_word in query_words
    ):
        score += 18

    return score


def _drop_leading_article(value: str) -> str:
    words = value.split()
    if words and words[0] == "the":
        return " ".join(words[1:])
    return value


def _words(value: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", value.lower())
