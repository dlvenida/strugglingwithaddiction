"""Fetch Google Place reviews when GOOGLE_PLACES_API_KEY is configured."""

from __future__ import annotations

import logging
import re
import time
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import httpx

from app.config import get_settings

logger = logging.getLogger("swa.google_reviews")

_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_CACHE_TTL_SECONDS = 60 * 60 * 6  # 6 hours
_PLACE_ID_RE = re.compile(r"(ChI[\w-]{10,}|0x[\da-fA-F]+:0x[\da-fA-F]+)")


def _cache_get(key: str) -> dict[str, Any] | None:
    hit = _CACHE.get(key)
    if not hit:
        return None
    expires_at, payload = hit
    if expires_at < time.time():
        _CACHE.pop(key, None)
        return None
    return payload


def _cache_set(key: str, payload: dict[str, Any]) -> None:
    _CACHE[key] = (time.time() + _CACHE_TTL_SECONDS, payload)


def extract_place_id(url: str | None) -> str | None:
    if not url:
        return None
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    for key in ("place_id", "query_place_id"):
        values = qs.get(key) or []
        if values and values[0].startswith("ChIJ"):
            return values[0]
    match = _PLACE_ID_RE.search(unquote(url))
    if match and match.group(1).startswith("ChIJ"):
        return match.group(1)
    return None


def extract_search_query(url: str | None) -> str | None:
    if not url:
        return None
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    for key in ("query", "q"):
        values = qs.get(key) or []
        if values and values[0].strip():
            return values[0].strip()
    return None


def normalize_manual_testimonials(items: list | None, default_rating: float = 5.0) -> list[dict[str, Any]]:
    reviews: list[dict[str, Any]] = []
    for item in items or []:
        if isinstance(item, str):
            quote = item.strip()
            author = None
            rating = default_rating
        elif isinstance(item, dict):
            quote = str(item.get("quote") or item.get("text") or "").strip()
            author = (item.get("author") or item.get("author_name") or item.get("name") or None)
            if author is not None:
                author = str(author).strip() or None
            try:
                rating = float(item.get("rating") or default_rating)
            except (TypeError, ValueError):
                rating = default_rating
        else:
            continue
        if not quote:
            continue
        reviews.append({
            "quote": quote,
            "author": author,
            "rating": max(0.0, min(5.0, rating)),
            "relative_time": item.get("relative_time") if isinstance(item, dict) else None,
            "source": "manual",
        })
    return reviews


def _place_details(client: httpx.Client, api_key: str, place_id: str) -> dict[str, Any] | None:
    res = client.get(
        "https://maps.googleapis.com/maps/api/place/details/json",
        params={
            "place_id": place_id,
            "fields": "name,rating,user_ratings_total,reviews,url",
            "reviews_sort": "most_relevant",
            "key": api_key,
        },
        timeout=12.0,
    )
    res.raise_for_status()
    data = res.json()
    if data.get("status") != "OK":
        logger.info("Place details status=%s place_id=%s", data.get("status"), place_id)
        return None
    return data.get("result") or None


def _find_place_id(client: httpx.Client, api_key: str, query: str) -> str | None:
    res = client.get(
        "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
        params={
            "input": query,
            "inputtype": "textquery",
            "fields": "place_id,name",
            "key": api_key,
        },
        timeout=12.0,
    )
    res.raise_for_status()
    data = res.json()
    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        logger.info("Find place status=%s query=%s", data.get("status"), query)
        return None
    candidates = data.get("candidates") or []
    if not candidates:
        return None
    return candidates[0].get("place_id")


def _reviews_from_place(result: dict[str, Any]) -> dict[str, Any]:
    reviews = []
    for item in result.get("reviews") or []:
        text = (item.get("text") or "").strip()
        if not text:
            continue
        try:
            rating = float(item.get("rating") or 5)
        except (TypeError, ValueError):
            rating = 5.0
        reviews.append({
            "quote": text,
            "author": (item.get("author_name") or "").strip() or "Google reviewer",
            "rating": max(0.0, min(5.0, rating)),
            "relative_time": item.get("relative_time_description"),
            "source": "google",
        })
    return {
        "source": "google",
        "rating": result.get("rating"),
        "user_ratings_total": result.get("user_ratings_total"),
        "google_maps_url": result.get("url"),
        "reviews": reviews,
    }


def fetch_google_reviews(
    *,
    name: str | None,
    address: str | None,
    google_reviews_url: str | None,
    google_maps_url: str | None,
) -> dict[str, Any] | None:
    settings = get_settings()
    api_key = (settings.google_places_api_key or "").strip()
    if not api_key:
        return None

    place_id = extract_place_id(google_reviews_url) or extract_place_id(google_maps_url)
    query = (
        extract_search_query(google_reviews_url)
        or extract_search_query(google_maps_url)
        or " ".join(part for part in [name, address] if part).strip()
    )
    cache_key = f"place:{place_id}" if place_id else f"query:{query.lower()}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        with httpx.Client() as client:
            if not place_id and query:
                place_id = _find_place_id(client, api_key, query)
            if not place_id:
                return None
            result = _place_details(client, api_key, place_id)
            if not result:
                return None
            payload = _reviews_from_place(result)
            _cache_set(f"place:{place_id}", payload)
            if query:
                _cache_set(f"query:{query.lower()}", payload)
            return payload
    except Exception:
        logger.exception("Failed to fetch Google reviews for %s", name or query)
        return None
