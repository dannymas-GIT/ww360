"""Page hash helpers for training catalog drift detection (WW360 subset)."""

from __future__ import annotations

import hashlib
import re

from bs4 import BeautifulSoup


def normalize_page_text(html: str) -> str:
    """Strip scripts/nav and collapse whitespace for stable hashing."""
    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception:
        return re.sub(r"\s+", " ", html).strip().lower()

    for tag in soup(["script", "style", "noscript", "nav", "header", "footer"]):
        tag.decompose()
    text = soup.get_text("\n", strip=True)
    text = re.sub(r"\s+", " ", text)
    return text.strip().lower()


def compute_page_hash(html: str) -> str:
    normalized = normalize_page_text(html)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
