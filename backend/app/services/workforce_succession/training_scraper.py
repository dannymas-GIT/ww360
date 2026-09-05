"""Scrape NYS DOH operator training course listings from training.htm."""

from __future__ import annotations

import hashlib
import logging
import re
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup, Tag
from sqlalchemy.orm import Session

from app.models.workforce_succession import (
    WorkforceTrainingCourse,
    WorkforceTrainingSyncLog,
)
from app.services.regulatory_parsers._http import (
    DEFAULT_TIMEOUT as PARSER_DEFAULT_TIMEOUT,
    default_parser_session,
)
from app.services.regulatory_parsers.drift_sensor import compute_page_hash
from app.services.workforce_succession.training_catalog_regions import (
    build_course_description,
)

logger = logging.getLogger(__name__)

DEFAULT_TRAINING_URL = (
    "https://www.health.ny.gov/environmental/water/drinking/operate/training.htm"
)
DEFAULT_TIMEOUT = 45
# Bump when parser or enrichment logic changes so unchanged DOH pages still re-sync.
PARSER_VERSION = "2"
# NY.gov WAF blocks the default python-requests User-Agent; use a browser-like profile.
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.health.ny.gov/environmental/water/drinking/",
}


class TrainingScrapeError(Exception):
    """Failed to fetch or persist NYSDOH training course listings."""

MONTHS = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}


def _training_session(session: Optional[requests.Session] = None) -> requests.Session:
    """HTTP session configured for NYSDOH public HTML pages."""
    sess = session or default_parser_session()
    sess.headers.update(BROWSER_HEADERS)
    return sess


def fetch_training_html(
    url: str = DEFAULT_TRAINING_URL,
    *,
    html_override: Optional[str] = None,
    session: Optional[requests.Session] = None,
) -> str:
    if html_override is not None:
        return html_override
    sess = _training_session(session)
    try:
        response = sess.get(url, timeout=DEFAULT_TIMEOUT or PARSER_DEFAULT_TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise TrainingScrapeError(
            f"NYSDOH training page fetch failed ({url}): {exc}"
        ) from exc
    response.encoding = response.encoding or "utf-8"
    return response.text


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def _infer_cert_type(course_name: str, sponsor: str = "") -> str:
    text = f"{course_name} {sponsor}".lower()
    if "backflow" in text or "cross connection" in text or "cross-connection" in text:
        return "backflow"
    if "wastewater" in text or "sewage" in text:
        return "wastewater"
    if "distribution" in text:
        return "distribution"
    if "treatment" in text or "plant operator" in text:
        return "treatment"
    return "treatment"


def _infer_cert_program(cert_type: str) -> str:
    return "wastewater" if cert_type == "wastewater" else "drinking_water"


def _extract_grade(course_name: str) -> Optional[str]:
    patterns = [
        r"\bgrade\s*([ABCD1-5])\b",
        r"\btype\s*([ABCD])\b",
        r"\bgrades?\s*([AB]/[AB])\b",
        r"\b([AB]/[AB])\b",
        r"\bgrade\s*([12])\b",
        r"\b([ABCD])\b",
    ]
    upper = course_name.upper()
    for pattern in patterns:
        match = re.search(pattern, upper, re.IGNORECASE)
        if match:
            return match.group(1).replace(" ", "")
    return None


def _parse_month_day(value: str, default_year: Optional[int]) -> Optional[date]:
    cleaned = _normalize_text(value)
    if not cleaned:
        return None
    year_match = re.search(r"(20\d{2})", cleaned)
    year = int(year_match.group(1)) if year_match else default_year
    if year is None:
        return None
    for month_name, month_num in MONTHS.items():
        pattern = rf"\b{month_name}\.?\s+(\d{{1,2}})\b"
        match = re.search(pattern, cleaned, re.IGNORECASE)
        if match:
            day = int(match.group(1))
            try:
                return date(year, month_num, day)
            except ValueError:
                return None
    return None


def _parse_date_range(text: str, default_year: Optional[int] = None) -> Tuple[Optional[date], Optional[date]]:
    cleaned = _normalize_text(text)
    if not cleaned:
        return None, None
    years = [int(y) for y in re.findall(r"(20\d{2})", cleaned)]
    if years:
        default_year = years[0]
    parts = re.split(r"\s*[–\-—to]+\s*", cleaned, maxsplit=1)
    if len(parts) == 2:
        start = _parse_month_day(parts[0], default_year)
        end_year = years[-1] if years else default_year
        end_part = parts[1]
        if start and re.match(r"^\d{1,2}\b", end_part.strip()) and not re.search(
            r"[a-zA-Z]", end_part.split(",")[0]
        ):
            day_match = re.match(r"^(\d{1,2})", end_part.strip())
            if day_match:
                try:
                    end = date(start.year, start.month, int(day_match.group(1)))
                    return start, end
                except ValueError:
                    pass
        if not re.search(r"(20\d{2})", end_part) and end_year:
            end_part = f"{end_part}, {end_year}"
        end = _parse_month_day(end_part, end_year)
        return start, end
    single = _parse_month_day(cleaned, default_year)
    return single, single


def _parse_cost(text: str) -> Tuple[Optional[str], Optional[float]]:
    cleaned = _normalize_text(text)
    if not cleaned:
        return None, None
    match = re.search(r"\$[\d,]+(?:\.\d{2})?", cleaned)
    if not match:
        return cleaned, None
    amount_text = match.group(0).replace("$", "").replace(",", "")
    try:
        return cleaned, float(amount_text)
    except ValueError:
        return cleaned, None


def _parse_contact(text: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    cleaned = _normalize_text(text)
    if not cleaned:
        return None, None, None
    email_match = re.search(r"[\w.+-]+@[\w.-]+\.\w+", cleaned)
    phone_match = re.search(
        r"(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}",
        cleaned,
    )
    email = email_match.group(0) if email_match else None
    phone = phone_match.group(0) if phone_match else None
    name = cleaned
    if email:
        name = name.replace(email, "")
    if phone:
        name = name.replace(phone, "")
    name = re.sub(r"[·|]", " ", name).strip(" ,;")
    return (name or None), email, phone


def _course_category_from_context(heading_text: str) -> str:
    lower = heading_text.lower()
    if "renewal" in lower:
        return "renewal"
    return "initial"


def _nearest_heading_category(element: Tag) -> str:
    for sibling in element.find_all_previous(["h1", "h2", "h3", "h4", "strong", "p"]):
        text = _normalize_text(sibling.get_text(" ", strip=True))
        if not text:
            continue
        if "renewal" in text.lower():
            return "renewal"
        if "initial" in text.lower() and "certification" in text.lower():
            return "initial"
    return "initial"


def _nearest_anchor(element: Tag) -> Optional[str]:
    anchor = element.find_previous(id=True)
    if anchor and anchor.get("id"):
        anchor_id = str(anchor.get("id"))
        if anchor_id.startswith("ym"):
            return anchor_id
    return None


def _is_us_date_token(value: str) -> bool:
    return bool(re.match(r"^\d{1,2}/\d{1,2}/\d{4}$", _normalize_text(value)))


def _parse_us_date(value: str) -> Optional[date]:
    cleaned = _normalize_text(value)
    match = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", cleaned)
    if not match:
        return None
    month, day, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _parse_contact_hours(value: str) -> Optional[float]:
    cleaned = _normalize_text(value)
    if not cleaned:
        return None
    try:
        return float(cleaned.replace(",", ""))
    except ValueError:
        return None


def _parse_sponsor_provider_cell(text: str) -> Tuple[str, Optional[str], Optional[str], Optional[str]]:
    cleaned = _normalize_text(text)
    if not cleaned:
        return "", None, None, None
    contact_name, contact_email, contact_phone = _parse_contact(cleaned)
    sponsor = cleaned
    if contact_email:
        sponsor = sponsor.replace(contact_email, "")
    if contact_phone:
        sponsor = sponsor.replace(contact_phone, "")
    sponsor = re.sub(r"\s+", " ", sponsor).strip(" ,;")
    if not sponsor:
        sponsor = contact_name or cleaned
    return sponsor, contact_name, contact_email, contact_phone


def _normalize_delivery_mode(
    *,
    delivery_type_label: Optional[str],
    course_name: str,
    table_kind: str,
) -> str:
    label = (delivery_type_label or "").strip().lower()
    text = course_name.lower()
    if table_kind == "video":
        return "online"
    if any(k in text for k in ("webinar", "virtual", "online", "zoom", "teleconference")):
        return "virtual"
    if label in {"online", "virtual", "webinar", "teleconference"}:
        return "virtual"
    if label in {"hybrid"}:
        return "hybrid"
    return "in_person"


def _location_text(city: Optional[str], county: Optional[str]) -> Optional[str]:
    bits: List[str] = []
    if city:
        bits.append(city)
    if county:
        bits.append(f"{county} County" if county.lower() != "out of state" else "Out of state")
    return ", ".join(bits) if bits else None


def _detect_table_format(header_cells: List[str]) -> Optional[str]:
    header = " ".join(header_cells).lower()
    if "video title" in header:
        return "video"
    if "county" in header and "course name" in header:
        return "schedule"
    if "sponsor" in header and ("grade" in header or "course" in header):
        return "classic"
    return None


def _finalize_course_row(
    row: Dict[str, Any],
    *,
    course_category: str,
    source_url: str,
    source_anchor: Optional[str],
) -> Dict[str, Any]:
    row["course_category"] = course_category
    row["source_url"] = source_url
    row["source_anchor"] = source_anchor
    row["location_text"] = _location_text(row.get("city"), row.get("county"))
    row["description"] = build_course_description(
        course_name=row["course_name"],
        course_category=course_category,
        cert_type=row["cert_type"],
        grade=row.get("grade"),
        county=row.get("county"),
        city=row.get("city"),
        delivery_mode=row.get("delivery_mode"),
        delivery_type_label=row.get("delivery_type_label"),
        contact_hours=row.get("contact_hours"),
    )
    row["natural_key_hash"] = compute_natural_key_hash(row)
    row["content_hash"] = compute_row_content_hash(row)
    return row


def _row_to_schedule_course(
    cells: List[str],
    *,
    course_category: str,
    source_url: str,
    source_anchor: Optional[str],
    last_sponsor: Optional[str],
    last_contact: Tuple[Optional[str], Optional[str], Optional[str]],
) -> Tuple[Optional[Dict[str, Any]], Optional[str], Tuple[Optional[str], Optional[str], Optional[str]]]:
    if len(cells) == 7:
        sponsor_raw, date_text, county, course_name, city, hours_text, delivery_label = cells
        sponsor, contact_name, contact_email, contact_phone = _parse_sponsor_provider_cell(
            sponsor_raw
        )
        last_sponsor = sponsor
        last_contact = (contact_name, contact_email, contact_phone)
    elif len(cells) == 6 and _is_us_date_token(cells[0]) and last_sponsor:
        date_text, county, course_name, city, hours_text, delivery_label = cells
        sponsor = last_sponsor
        contact_name, contact_email, contact_phone = last_contact
    else:
        return None, last_sponsor, last_contact

    course_name = _normalize_text(course_name)
    if not course_name or not sponsor:
        return None, last_sponsor, last_contact

    start_date = _parse_us_date(date_text)
    cert_type = _infer_cert_type(course_name, sponsor)
    contact_hours = _parse_contact_hours(hours_text)
    delivery_mode = _normalize_delivery_mode(
        delivery_type_label=delivery_label,
        course_name=course_name,
        table_kind="schedule",
    )

    row = {
        "state": "NY",
        "source": "NYSDOH",
        "cert_program": _infer_cert_program(cert_type),
        "cert_type": cert_type,
        "sponsor": sponsor,
        "course_name": course_name,
        "grade": _extract_grade(course_name),
        "start_date": start_date,
        "end_date": start_date,
        "cost_text": None,
        "cost_amount": None,
        "contact_name": contact_name,
        "contact_email": contact_email,
        "contact_phone": contact_phone,
        "county": _normalize_text(county) or None,
        "city": _normalize_text(city) or None,
        "delivery_mode": delivery_mode,
        "delivery_type_label": _normalize_text(delivery_label) or None,
        "contact_hours": contact_hours,
    }
    return (
        _finalize_course_row(
            row,
            course_category=course_category,
            source_url=source_url,
            source_anchor=source_anchor,
        ),
        last_sponsor,
        last_contact,
    )


def _row_to_classic_course(
    cells: List[str],
    *,
    course_category: str,
    source_url: str,
    source_anchor: Optional[str],
    last_sponsor: Optional[str],
    last_contact: Tuple[Optional[str], Optional[str], Optional[str]],
) -> Tuple[Optional[Dict[str, Any]], Optional[str], Tuple[Optional[str], Optional[str], Optional[str]]]:
    if len(cells) >= 5:
        sponsor_raw, course_name, dates_text, cost_text, contact_text = cells[:5]
        sponsor = _normalize_text(sponsor_raw)
        contact_name, contact_email, contact_phone = _parse_contact(contact_text)
        last_sponsor = sponsor
        last_contact = (contact_name, contact_email, contact_phone)
    elif len(cells) == 4 and last_sponsor:
        course_name, dates_text, cost_text, contact_text = cells
        sponsor = last_sponsor
        if contact_text:
            contact_name, contact_email, contact_phone = _parse_contact(contact_text)
            last_contact = (contact_name, contact_email, contact_phone)
        else:
            contact_name, contact_email, contact_phone = last_contact
    elif len(cells) == 3 and last_sponsor:
        course_name, dates_text, cost_text = cells
        sponsor = last_sponsor
        contact_name, contact_email, contact_phone = last_contact
    else:
        return None, last_sponsor, last_contact

    course_name = _normalize_text(course_name)
    if not course_name or not sponsor or sponsor.lower() in {"sponsor", "provider", "sponsor/school"}:
        return None, last_sponsor, last_contact

    start_date, end_date = _parse_date_range(dates_text)
    cert_type = _infer_cert_type(course_name, sponsor)
    cost_label, cost_amount = _parse_cost(cost_text)
    delivery_mode = _normalize_delivery_mode(
        delivery_type_label=None,
        course_name=course_name,
        table_kind="classic",
    )

    row = {
        "state": "NY",
        "source": "NYSDOH",
        "cert_program": _infer_cert_program(cert_type),
        "cert_type": cert_type,
        "sponsor": sponsor,
        "course_name": course_name,
        "grade": _extract_grade(course_name),
        "start_date": start_date,
        "end_date": end_date,
        "cost_text": cost_label,
        "cost_amount": cost_amount,
        "contact_name": contact_name,
        "contact_email": contact_email,
        "contact_phone": contact_phone,
        "county": None,
        "city": None,
        "delivery_mode": delivery_mode,
        "delivery_type_label": None,
        "contact_hours": None,
    }
    return (
        _finalize_course_row(
            row,
            course_category=course_category,
            source_url=source_url,
            source_anchor=source_anchor,
        ),
        last_sponsor,
        last_contact,
    )


def _row_to_video_course(
    cells: List[str],
    *,
    course_category: str,
    source_url: str,
    source_anchor: Optional[str],
) -> Optional[Dict[str, Any]]:
    if len(cells) < 2:
        return None
    title = _normalize_text(cells[0])
    hours = _parse_contact_hours(cells[1])
    if not title or title.lower() == "video title":
        return None
    cert_type = _infer_cert_type(title)
    row = {
        "state": "NY",
        "source": "NYSDOH",
        "cert_program": _infer_cert_program(cert_type),
        "cert_type": cert_type,
        "sponsor": "NYSDOH / AWWA online video",
        "course_name": title,
        "grade": _extract_grade(title),
        "start_date": None,
        "end_date": None,
        "cost_text": None,
        "cost_amount": None,
        "contact_name": None,
        "contact_email": None,
        "contact_phone": None,
        "county": None,
        "city": None,
        "delivery_mode": "online",
        "delivery_type_label": "video",
        "contact_hours": hours,
    }
    return _finalize_course_row(
        row,
        course_category=course_category,
        source_url=source_url,
        source_anchor=source_anchor,
    )


def compute_natural_key_hash(row: Dict[str, Any]) -> str:
    parts = [
        row.get("sponsor") or "",
        row.get("course_name") or "",
        str(row.get("start_date") or ""),
        str(row.get("end_date") or ""),
        row.get("county") or "",
        row.get("city") or "",
        row.get("contact_email") or "",
    ]
    digest = "|".join(parts).strip().lower()
    return hashlib.sha256(digest.encode("utf-8")).hexdigest()


def compute_row_content_hash(row: Dict[str, Any]) -> str:
    parts = [
        row.get("sponsor") or "",
        row.get("course_name") or "",
        row.get("grade") or "",
        str(row.get("start_date") or ""),
        str(row.get("end_date") or ""),
        row.get("cost_text") or "",
        row.get("contact_phone") or "",
        row.get("contact_email") or "",
        row.get("course_category") or "",
        row.get("cert_type") or "",
        row.get("county") or "",
        row.get("city") or "",
        row.get("delivery_mode") or "",
        row.get("description") or "",
        str(row.get("contact_hours") or ""),
    ]
    digest = "|".join(parts).strip().lower()
    return hashlib.sha256(digest.encode("utf-8")).hexdigest()


def parse_training_courses(
    html: str,
    *,
    source_url: str = DEFAULT_TRAINING_URL,
) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    parsed: List[Dict[str, Any]] = []
    seen_keys: set[str] = set()

    for table in soup.find_all("table"):
        course_category = _nearest_heading_category(table)
        source_anchor = _nearest_anchor(table)
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue
        header_cells = [
            _normalize_text(cell.get_text(" ", strip=True))
            for cell in rows[0].find_all(["td", "th"])
        ]
        table_format = _detect_table_format(header_cells)
        if table_format is None:
            continue

        last_sponsor: Optional[str] = None
        last_contact: Tuple[Optional[str], Optional[str], Optional[str]] = (
            None,
            None,
            None,
        )

        for row in rows[1:]:
            cells = [
                _normalize_text(cell.get_text(" ", strip=True))
                for cell in row.find_all(["td", "th"])
            ]
            cells = [cell for cell in cells if cell]
            if not cells:
                continue

            course: Optional[Dict[str, Any]] = None
            if table_format == "schedule":
                course, last_sponsor, last_contact = _row_to_schedule_course(
                    cells,
                    course_category=course_category,
                    source_url=source_url,
                    source_anchor=source_anchor,
                    last_sponsor=last_sponsor,
                    last_contact=last_contact,
                )
            elif table_format == "classic":
                course, last_sponsor, last_contact = _row_to_classic_course(
                    cells,
                    course_category=course_category,
                    source_url=source_url,
                    source_anchor=source_anchor,
                    last_sponsor=last_sponsor,
                    last_contact=last_contact,
                )
            elif table_format == "video":
                course = _row_to_video_course(
                    cells,
                    course_category=course_category,
                    source_url=source_url,
                    source_anchor=source_anchor,
                )

            if course is None:
                continue
            key = course["natural_key_hash"]
            if key in seen_keys:
                continue
            seen_keys.add(key)
            parsed.append(course)
    return parsed


def _effective_page_hash(page_hash: str) -> str:
    payload = f"{PARSER_VERSION}:{page_hash}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _latest_page_hash(db: Session, source_url: str) -> Optional[str]:
    latest = (
        db.query(WorkforceTrainingSyncLog)
        .filter(WorkforceTrainingSyncLog.source_url == source_url)
        .order_by(WorkforceTrainingSyncLog.synced_at.desc())
        .first()
    )
    return latest.page_content_hash if latest else None


def sync_training_courses(
    db: Session,
    *,
    source_url: str = DEFAULT_TRAINING_URL,
    html_override: Optional[str] = None,
    commit: bool = True,
) -> Dict[str, Any]:
    html = fetch_training_html(source_url, html_override=html_override)
    page_hash = compute_page_hash(html)
    effective_hash = _effective_page_hash(page_hash)
    previous_hash = _latest_page_hash(db, source_url)
    if previous_hash == effective_hash and html_override is None:
        log = WorkforceTrainingSyncLog(
            source_url=source_url,
            page_content_hash=effective_hash,
            courses_parsed=0,
            courses_added=0,
            courses_updated=0,
            courses_deactivated=0,
            skipped_unchanged=True,
        )
        db.add(log)
        if commit:
            db.commit()
        return {
            "source_url": source_url,
            "page_content_hash": effective_hash,
            "courses_parsed": 0,
            "courses_added": 0,
            "courses_updated": 0,
            "courses_deactivated": 0,
            "skipped_unchanged": True,
            "last_synced_at": datetime.now(timezone.utc).isoformat(),
        }

    rows = parse_training_courses(html, source_url=source_url)
    now = datetime.now(timezone.utc)
    seen_hashes: set[str] = set()
    added = 0
    updated = 0

    for row in rows:
        seen_hashes.add(row["natural_key_hash"])
        existing = (
            db.query(WorkforceTrainingCourse)
            .filter(WorkforceTrainingCourse.natural_key_hash == row["natural_key_hash"])
            .first()
        )
        if existing is None:
            db.add(
                WorkforceTrainingCourse(
                    **row,
                    first_seen_at=now,
                    last_seen_at=now,
                    is_active=True,
                )
            )
            added += 1
            continue

        changed = False
        for field, value in row.items():
            if field in {"natural_key_hash"}:
                continue
            if getattr(existing, field) != value:
                setattr(existing, field, value)
                changed = True
        if not existing.is_active:
            existing.is_active = True
            changed = True
        existing.last_seen_at = now
        if changed:
            updated += 1

    stale_query = db.query(WorkforceTrainingCourse).filter(
        WorkforceTrainingCourse.is_active.is_(True),
        WorkforceTrainingCourse.source_url == source_url,
    )
    if seen_hashes:
        stale_query = stale_query.filter(
            WorkforceTrainingCourse.natural_key_hash.notin_(seen_hashes)
        )
    deactivated = 0
    for stale in stale_query.all():
        stale.is_active = False
        deactivated += 1

    log = WorkforceTrainingSyncLog(
        source_url=source_url,
        page_content_hash=effective_hash,
        courses_parsed=len(rows),
        courses_added=added,
        courses_updated=updated,
        courses_deactivated=deactivated,
        skipped_unchanged=False,
    )
    db.add(log)
    if commit:
        try:
            db.commit()
        except Exception as exc:
            db.rollback()
            raise TrainingScrapeError(f"Failed to save training catalog: {exc}") from exc

    return {
        "source_url": source_url,
        "page_content_hash": effective_hash,
        "courses_parsed": len(rows),
        "courses_added": added,
        "courses_updated": updated,
        "courses_deactivated": deactivated,
        "skipped_unchanged": False,
        "last_synced_at": now.isoformat(),
    }


def get_latest_sync_metadata(db: Session) -> Optional[Dict[str, Any]]:
    latest = (
        db.query(WorkforceTrainingSyncLog)
        .order_by(WorkforceTrainingSyncLog.synced_at.desc())
        .first()
    )
    if latest is None:
        return None
    return {
        "last_synced_at": latest.synced_at,
        "courses_parsed": latest.courses_parsed,
        "skipped_unchanged": latest.skipped_unchanged,
        "source_url": latest.source_url,
    }


def bootstrap_training_catalog_if_empty(db: Session) -> Optional[Dict[str, Any]]:
    """Run an initial scrape when the catalog has never been synced."""
    has_sync = db.query(WorkforceTrainingSyncLog.id).first() is not None
    if has_sync:
        return None
    logger.info("Training catalog empty; running initial NYSDOH scrape")
    return sync_training_courses(db)
