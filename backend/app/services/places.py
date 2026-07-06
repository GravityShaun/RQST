from __future__ import annotations

import json
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "RQST/0.1 (venue search; contact@rqst.app)"


class PlaceSearchError(RuntimeError):
    pass


@dataclass(frozen=True)
class PlaceCandidate:
    place_id: str
    name: str
    address: str
    city: str
    state: str | None
    country: str
    latitude: float
    longitude: float
    display_name: str


def _pick_name(item: dict, address: dict) -> str:
    for key in ("name", "amenity", "building", "shop", "tourism", "leisure", "office"):
        value = address.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    display_name = str(item.get("display_name", "")).strip()
    if display_name:
        return display_name.split(",")[0].strip()

    return "Venue"


def _pick_address_line(address: dict) -> str:
    for key in ("road", "pedestrian", "footway", "house_number"):
        value = address.get(key)
        if isinstance(value, str) and value.strip():
            if key == "house_number":
                road = address.get("road")
                if isinstance(road, str) and road.strip():
                    return f"{value.strip()} {road.strip()}"
                return value.strip()
            return value.strip()
    return ""


def _pick_city(address: dict) -> str:
    for key in ("city", "town", "village", "hamlet", "municipality", "county"):
        value = address.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _pick_state(address: dict) -> str | None:
    for key in ("state", "region"):
        value = address.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _pick_country(address: dict) -> str:
    country_code = address.get("country_code")
    if isinstance(country_code, str) and country_code.strip():
        return country_code.strip().upper()
    country = address.get("country")
    if isinstance(country, str) and country.strip():
        return country.strip()
    return "US"


def _parse_place(item: dict) -> PlaceCandidate | None:
    try:
        latitude = float(item["lat"])
        longitude = float(item["lon"])
    except (KeyError, TypeError, ValueError):
        return None

    address = item.get("address")
    if not isinstance(address, dict):
        address = {}

    name = _pick_name(item, address)
    address_line = _pick_address_line(address)
    city = _pick_city(address)
    state = _pick_state(address)
    country = _pick_country(address)
    display_name = str(item.get("display_name", name)).strip()
    place_id = str(item.get("place_id") or item.get("osm_id") or f"{latitude},{longitude}")

    if not address_line:
        parts = [part.strip() for part in display_name.split(",")[1:3] if part.strip()]
        address_line = ", ".join(parts) or display_name

    if not city:
        parts = [part.strip() for part in display_name.split(",") if part.strip()]
        city = parts[1] if len(parts) > 1 else "Unknown"

    return PlaceCandidate(
        place_id=place_id,
        name=name,
        address=address_line,
        city=city,
        state=state,
        country=country,
        latitude=latitude,
        longitude=longitude,
        display_name=display_name,
    )


def search_places(query: str, *, limit: int = 8) -> list[PlaceCandidate]:
    trimmed = query.strip()
    if len(trimmed) < 2:
        return []

    params = urlencode(
        {
            "q": trimmed,
            "format": "jsonv2",
            "addressdetails": "1",
            "limit": max(1, min(limit, 10)),
        }
    )
    request = Request(
        f"{NOMINATIM_SEARCH_URL}?{params}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )

    try:
        with urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise PlaceSearchError("Venue search provider returned an error.") from exc
    except URLError as exc:
        raise PlaceSearchError("Could not reach venue search provider.") from exc
    except json.JSONDecodeError as exc:
        raise PlaceSearchError("Venue search provider returned invalid data.") from exc

    if not isinstance(payload, list):
        return []

    results: list[PlaceCandidate] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        parsed = _parse_place(item)
        if parsed is not None:
            results.append(parsed)
    return results
