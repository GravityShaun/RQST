import pytest

from app.core.config import get_settings


@pytest.fixture(autouse=True)
def _reset_settings_cache() -> None:
    """Keep the cached Settings from leaking between tests.

    Several tests set ``RQST_ENVIRONMENT`` via ``monkeypatch`` and call
    ``get_settings.cache_clear()`` so the new environment takes effect. Monkeypatch
    restores the env var on teardown, but the ``lru_cache`` still holds the Settings
    built while it was patched. Clearing the cache around every test prevents a stale
    environment (e.g. ``local``) from bleeding into unrelated tests.
    """
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
