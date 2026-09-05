"""Regional filtering and display helpers for NYSDOH training catalog rows."""

from __future__ import annotations

from typing import Any, Dict, Optional

# Suffolk, Nassau, and NYC borough counties (DOH "County" column values).
METRO_COUNTIES = frozenset(
    {
        "nassau",
        "suffolk",
        "new york",
        "kings",
        "queens",
        "bronx",
        "richmond",
    }
)

METRO_CITY_KEYWORDS = frozenset(
    {
        "new york",
        "brooklyn",
        "queens",
        "bronx",
        "staten island",
        "manhattan",
        "hempstead",
        "mineola",
        "garden city",
        "bethpage",
        "new hyde park",
        "copiague",
        "hauppauge",
        "riverhead",
        "huntington",
        "islip",
        "babylon",
        "freeport",
        "long beach",
        "oceanside",
        "valley stream",
        "great neck",
    }
)

ONLINE_DELIVERY_MODES = frozenset({"online", "virtual"})


def is_online_delivery(delivery_mode: Optional[str]) -> bool:
    mode = (delivery_mode or "").strip().lower()
    return mode in ONLINE_DELIVERY_MODES


def _course_field(course: Any, name: str) -> Optional[str]:
    if isinstance(course, dict):
        value = course.get(name)
    else:
        value = getattr(course, name, None)
    if value is None:
        return None
    return str(value)


def is_metro_in_person(course: Any) -> bool:
    """True when an in-person course is in Suffolk, Nassau, or NYC."""
    if is_online_delivery(_course_field(course, "delivery_mode")):
        return True
    county = (_course_field(course, "county") or "").strip().lower()
    if county in METRO_COUNTIES:
        return True
    if county in {"out of state", "out-of-state"}:
        return False
    city = (_course_field(course, "city") or "").strip().lower()
    if any(k in city for k in METRO_CITY_KEYWORDS):
        return True
    location = (_course_field(course, "location_text") or "").strip().lower()
    if any(k in location for k in METRO_CITY_KEYWORDS):
        return True
    sponsor = (_course_field(course, "sponsor") or "").strip().lower()
    if "516" in sponsor or "631" in sponsor:
        return True
    return False


def passes_local_metro_filter(course: Any) -> bool:
    """Include all online courses; in-person/hybrid only when metro-local."""
    mode = (_course_field(course, "delivery_mode") or "in_person").strip().lower()
    if mode in ONLINE_DELIVERY_MODES:
        return True
    return is_metro_in_person(course)


def build_course_description(
    *,
    course_name: str,
    course_category: str,
    cert_type: str,
    grade: Optional[str],
    county: Optional[str],
    city: Optional[str],
    delivery_mode: Optional[str],
    delivery_type_label: Optional[str],
    contact_hours: Optional[float],
) -> str:
    parts: list[str] = []
    cat = (course_category or "training").replace("_", " ")
    ctype = (cert_type or "operator").replace("_", " ")
    parts.append(f"{cat.title()} {ctype} training")
    if grade:
        parts.append(f"Grade {grade}")
    parts.append(f"— {course_name}")
    loc_bits = [b for b in [city, county] if b]
    if loc_bits:
        parts.append(f"({', '.join(loc_bits)})")
    if delivery_type_label:
        parts.append(f"[{delivery_type_label}]")
    elif delivery_mode:
        parts.append(f"[{delivery_mode.replace('_', ' ')}]")
    if contact_hours is not None:
        parts.append(f"{contact_hours:g} contact hr")
    return " ".join(parts)
