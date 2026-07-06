from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse

import pytest

from app.api.routes import songs as songs_route
from app.services import apple_music
from app.services.apple_music import (
    AppleMusicArtist,
    AppleMusicError,
    AppleMusicSong,
    filter_songs_by_artist,
    rank_artists,
    rank_songs,
    search_catalog,
)


class FakeSongDb:
    def __init__(self) -> None:
        self.added = []
        self.committed = False

    def scalar(self, _statement):
        return None

    def add(self, song) -> None:
        song.id = 1
        self.added.append(song)

    def flush(self) -> None:
        return None

    def commit(self) -> None:
        self.committed = True


def test_search_catalog_normalizes_apple_music_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def read(self) -> bytes:
            return b"""
            {
              "results": {
                "songs": {
                  "data": [
                    {
                      "id": "1440857781",
                      "attributes": {
                        "name": "One More Time",
                        "artistName": "Daft Punk",
                        "albumName": "Discovery",
                        "durationInMillis": 320357,
                        "isrc": "GBDUW0000059",
                        "contentRating": "explicit",
                        "artwork": {
                          "url": "https://is1-ssl.mzstatic.com/image/thumb/Music/{w}x{h}bb.jpg",
                          "width": 600,
                          "height": 600
                        }
                      }
                    }
                  ]
                },
                "artists": {
                  "data": [
                    {
                      "id": "5468295",
                      "attributes": {
                        "name": "Daft Punk",
                        "genreNames": ["Dance", "Electronic"]
                      }
                    }
                  ]
                }
              }
            }
            """

    def fake_urlopen(request, timeout: int):
        assert timeout == 4
        assert request.headers["Authorization"] == "Bearer dev-token"
        return FakeResponse()

    monkeypatch.setattr(apple_music, "urlopen", fake_urlopen)

    results = search_catalog("one more time", developer_token="dev-token")

    assert len(results.songs) == 1
    assert results.songs[0].title == "One More Time"
    assert results.songs[0].artist == "Daft Punk"
    assert results.songs[0].album == "Discovery"
    assert results.songs[0].duration_ms == 320357
    assert results.songs[0].isrc == "GBDUW0000059"
    assert results.songs[0].apple_music_id == "1440857781"
    assert results.songs[0].album_art_url == "https://is1-ssl.mzstatic.com/image/thumb/Music/600x600bb.jpg"
    assert results.songs[0].explicit is True
    assert results.artists[0].apple_music_id == "5468295"
    assert results.artists[0].genre_names == ["Dance", "Electronic"]


def test_search_catalog_caps_apple_music_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def read(self) -> bytes:
            return b"""{"results": {"songs": {"data": []}, "artists": {"data": []}}}"""

    def fake_urlopen(request, timeout: int):
        assert timeout == 4
        query = parse_qs(urlparse(request.full_url).query)
        assert query["limit"] == ["25"]
        return FakeResponse()

    monkeypatch.setattr(apple_music, "urlopen", fake_urlopen)

    search_catalog("The", developer_token="dev-token", limit=50)


def test_search_catalog_uses_itunes_fallback_without_developer_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = []

    class FakeResponse:
        def __init__(self, body: bytes) -> None:
            self.body = body

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def read(self) -> bytes:
            return self.body

    def fake_urlopen(request, timeout: int):
        assert timeout == 4
        assert "itunes.apple.com" in request.full_url
        query = parse_qs(urlparse(request.full_url).query)
        calls.append(query["entity"][0])
        if query["entity"] == ["musicArtist"]:
            return FakeResponse(
                b"""
                {
                  "results": [
                    {
                      "wrapperType": "artist",
                      "artistId": 5468295,
                      "artistName": "Daft Punk",
                      "primaryGenreName": "Electronic"
                    }
                  ]
                }
                """
            )
        return FakeResponse(
            b"""
            {
              "results": [
                {
                  "wrapperType": "track",
                  "trackId": 1440857781,
                  "trackName": "One More Time",
                  "artistName": "Daft Punk"
                }
              ]
            }
            """
        )

    monkeypatch.setattr(apple_music, "urlopen", fake_urlopen)

    results = search_catalog("one more time", developer_token=None)

    assert calls == ["musicTrack", "musicArtist"]
    assert results.songs[0].title == "One More Time"
    assert results.artists[0].name == "Daft Punk"


def test_search_catalog_falls_back_to_itunes_when_token_is_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = []

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def read(self) -> bytes:
            return b"""
            {
              "results": [
                {
                  "wrapperType": "artist",
                  "artistId": 5468295,
                  "artistName": "Daft Punk",
                  "primaryGenreName": "Electronic"
                },
                {
                  "wrapperType": "track",
                  "trackId": 1440857781,
                  "trackName": "One More Time",
                  "artistName": "Daft Punk",
                  "collectionName": "Discovery",
                  "trackTimeMillis": 320357,
                  "trackExplicitness": "notExplicit",
                  "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music/100x100bb.jpg"
                }
              ]
            }
            """

    def fake_urlopen(request, timeout: int):
        calls.append(request.full_url)
        if "api.music.apple.com" in request.full_url:
            raise HTTPError(request.full_url, 401, "Unauthorized", hdrs=None, fp=None)
        return FakeResponse()

    monkeypatch.setattr(apple_music, "urlopen", fake_urlopen)

    results = search_catalog("daft punk", developer_token="invalid-token")

    assert "api.music.apple.com" in calls[0]
    assert "itunes.apple.com" in calls[1]
    assert results.songs[0].title == "One More Time"
    assert results.songs[0].apple_music_id == "1440857781"
    assert results.songs[0].album_art_url == "https://is1-ssl.mzstatic.com/image/thumb/Music/600x600bb.jpg"
    assert results.artists[0].name == "Daft Punk"


def test_search_catalog_falls_back_to_itunes_when_apple_rejects_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = []

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def read(self) -> bytes:
            return b"""
            {
              "results": [
                {
                  "wrapperType": "track",
                  "trackId": 1440857781,
                  "trackName": "One More Time",
                  "artistName": "Daft Punk"
                }
              ]
            }
            """

    def fake_urlopen(request, timeout: int):
        calls.append(request.full_url)
        if "api.music.apple.com" in request.full_url:
            raise HTTPError(request.full_url, 400, "Bad Request", hdrs=None, fp=None)
        return FakeResponse()

    monkeypatch.setattr(apple_music, "urlopen", fake_urlopen)

    results = search_catalog("The", developer_token="dev-token", limit=50, include_artists=False)

    assert "api.music.apple.com" in calls[0]
    assert "itunes.apple.com" in calls[1]
    assert results.songs[0].title == "One More Time"


def test_search_catalog_wraps_transport_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_urlopen(_request, timeout: int):
        raise TimeoutError

    monkeypatch.setattr(apple_music, "urlopen", fake_urlopen)

    with pytest.raises(AppleMusicError):
        search_catalog("one more time", developer_token="dev-token")


def test_rank_songs_prefers_provider_popularity_order() -> None:
    popular_cover = AppleMusicSong(
        title="Daft Punk - One More Time",
        artist="Cover Artist",
        album="All Covers",
        duration_ms=None,
        isrc=None,
        apple_music_id="popular-cover",
        album_art_url=None,
        score=20,
    )
    less_popular_exact_match = AppleMusicSong(
        title="One More Time",
        artist="Daft Punk",
        album="Discovery",
        duration_ms=None,
        isrc=None,
        apple_music_id="less-popular-exact-match",
        album_art_url=None,
        score=5,
    )

    ranked = rank_songs("daft punk one more time", [less_popular_exact_match, popular_cover])

    assert ranked[0].apple_music_id == "popular-cover"


def test_rank_artists_prefers_provider_popularity_order() -> None:
    popular_tribute = AppleMusicArtist(name="The Bootleg Beatles", apple_music_id="popular-tribute", score=20)
    exact_match = AppleMusicArtist(name="The Beatles", apple_music_id="exact-match", score=5)

    ranked = rank_artists("the beatles", [exact_match, popular_tribute])

    assert ranked[0].apple_music_id == "popular-tribute"


def test_rank_artists_keeps_popularity_order_for_partial_typing() -> None:
    tribute = AppleMusicArtist(name="The Bootleg Beatles", apple_music_id="tribute", score=30)
    beatles = AppleMusicArtist(name="The Beatles", apple_music_id="beatles", score=20)
    beatnuts = AppleMusicArtist(name="The Beatnuts", apple_music_id="beatnuts", score=10)

    ranked = rank_artists("The Beat", [tribute, beatnuts, beatles])

    assert [artist.apple_music_id for artist in ranked] == ["tribute", "beatles", "beatnuts"]


def test_filter_songs_by_artist_keeps_matching_artists_when_available() -> None:
    songs = [
        AppleMusicSong(
            title="One More Time",
            artist="Daft Punk",
            album=None,
            duration_ms=None,
            isrc=None,
            apple_music_id="match",
            album_art_url=None,
        ),
        AppleMusicSong(
            title="One More Time",
            artist="Cover Artist",
            album=None,
            duration_ms=None,
            isrc=None,
            apple_music_id="cover",
            album_art_url=None,
        ),
    ]

    filtered = filter_songs_by_artist(songs, "Daft Punk")

    assert [song.apple_music_id for song in filtered] == ["match"]


def test_song_search_does_not_duplicate_selected_artist(monkeypatch: pytest.MonkeyPatch) -> None:
    search_terms = []

    def fake_search_catalog(query: str, **_kwargs):
        search_terms.append(query)
        return apple_music.AppleMusicSearchResults(
            songs=[
                AppleMusicSong(
                    title="One More Time",
                    artist="Daft Punk",
                    album="Discovery",
                    duration_ms=320357,
                    isrc="GBDUW0000059",
                    apple_music_id="1440857781",
                    album_art_url=None,
                )
            ],
            artists=[],
        )

    monkeypatch.setattr(songs_route, "search_catalog", fake_search_catalog)

    results = songs_route.search_songs(FakeSongDb(), q="Daft Punk", artist="Daft Punk", limit=10)

    assert search_terms == ["Daft Punk"]
    assert results[0].title == "One More Time"
