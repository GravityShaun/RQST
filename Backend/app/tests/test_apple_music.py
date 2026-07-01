import pytest

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


def test_search_catalog_requires_developer_token() -> None:
    with pytest.raises(AppleMusicError):
        search_catalog("one more time", developer_token=None)


def test_search_catalog_wraps_transport_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_urlopen(_request, timeout: int):
        raise TimeoutError

    monkeypatch.setattr(apple_music, "urlopen", fake_urlopen)

    with pytest.raises(AppleMusicError):
        search_catalog("one more time", developer_token="dev-token")


def test_rank_songs_prefers_artist_title_matches() -> None:
    cover = AppleMusicSong(
        title="Daft Punk - One More Time",
        artist="Cover Artist",
        album="All Covers",
        duration_ms=None,
        isrc=None,
        apple_music_id="cover",
        album_art_url=None,
    )
    canonical = AppleMusicSong(
        title="One More Time",
        artist="Daft Punk",
        album="Discovery",
        duration_ms=None,
        isrc=None,
        apple_music_id="canonical",
        album_art_url=None,
    )

    ranked = rank_songs("daft punk one more time", [cover, canonical])

    assert ranked[0].apple_music_id == "canonical"


def test_rank_artists_prefers_exact_canonical_artist_names() -> None:
    tribute = AppleMusicArtist(name="The Bootleg Beatles", apple_music_id="tribute")
    canonical = AppleMusicArtist(name="The Beatles", apple_music_id="canonical")

    ranked = rank_artists("the beatles", [tribute, canonical])

    assert ranked[0].apple_music_id == "canonical"


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
