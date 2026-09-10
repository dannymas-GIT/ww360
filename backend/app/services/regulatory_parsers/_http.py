"""Minimal HTTP helpers for WW360 training scraper (extracted from AquaSafe)."""

from __future__ import annotations

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

DEFAULT_TIMEOUT = 30
USER_AGENT = (
    "Mozilla/5.0 (compatible; WW360Bot/1.0; +https://ww360.aquasafe-solutions.us)"
)


class ParserFetchError(Exception):
    """HTTP or network failure fetching a regulatory source."""


class ParserParseError(Exception):
    """HTML/JSON could not be parsed into structured rows."""


def default_parser_session() -> requests.Session:
    """Session with User-Agent, Accept header, and retry on transient failures."""
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        }
    )
    retry = Retry(
        total=3,
        backoff_factor=0.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET",),
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session
