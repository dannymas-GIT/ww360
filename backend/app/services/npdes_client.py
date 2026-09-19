"""HTTP client for EPA ECHO CWA (NPDES) REST services and Detailed Facility Report."""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# NPDES permit IDs are typically 2-letter state + 7 alphanumerics (e.g. NY0021234).
_NPDES_EXACT_RE = re.compile(r"^[A-Z]{2}[A-Z0-9]{7}$", re.IGNORECASE)
_NAME_SUFFIX_RE = re.compile(
    r"\s+(wastewater\s+treatment\s+plant|waste\s+water\s+plant|wwtp|"
    r"sewer\s+authority|sanitary\s+district|potw)\.?$",
    re.IGNORECASE,
)


class NPDESClientError(Exception):
    pass


class NPDESClient:
    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> None:
        self.base_url = (base_url or settings.SDWIS_API_BASE_URL).rstrip("/")
        self.timeout = timeout or settings.SDWIS_REQUEST_TIMEOUT_SECONDS
        self._client = httpx.Client(timeout=self.timeout, follow_redirects=True)

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "NPDESClient":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

    def _get_json(self, path: str, params: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url}/{path.lstrip('/')}"
        params = {k: v for k, v in params.items() if v is not None}
        try:
            resp = self._client.get(url, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.warning("NPDES HTTP error %s: %s", url, e)
            raise NPDESClientError(str(e)) from e
        try:
            return resp.json()
        except Exception as e:
            raise NPDESClientError("Invalid JSON from EPA API") from e

    @staticmethod
    def _results(payload: Dict[str, Any]) -> Dict[str, Any]:
        return (payload or {}).get("Results") or {}

    @staticmethod
    def _echo_error(results: Dict[str, Any]) -> Optional[str]:
        err = results.get("Error")
        if isinstance(err, dict):
            return err.get("ErrorMessage") or err.get("message")
        return None

    @staticmethod
    def _normalize_npdes_id(value: str) -> str:
        return value.strip().upper()

    @classmethod
    def _is_exact_npdes_id(cls, value: str) -> bool:
        return bool(_NPDES_EXACT_RE.match(cls._normalize_npdes_id(value)))

    @staticmethod
    def _name_query_candidates(raw_q: str) -> List[str]:
        q = (raw_q or "").strip()
        if not q:
            return []
        out: List[str] = []
        seen: set[str] = set()

        def _add(candidate: str) -> None:
            c = candidate.strip()
            if len(c) < 2:
                return
            key = c.lower()
            if key in seen:
                return
            seen.add(key)
            out.append(c)

        _add(q)
        stripped = _NAME_SUFFIX_RE.sub("", q).strip()
        _add(stripped)
        tokens = [t for t in re.split(r"[\s\-_/]+", stripped or q) if t]
        if len(tokens) >= 2:
            _add(" ".join(tokens[:2]))
        return out

    def get_facilities(
        self,
        *,
        state: Optional[str] = None,
        facility_name: Optional[str] = None,
        npdes_id: Optional[str] = None,
        potw_only: bool = True,
        major_only: Optional[bool] = None,
        **extra: Any,
    ) -> Dict[str, Any]:
        """Query CWA facilities (POTWs by default)."""
        params: Dict[str, Any] = {"output": "JSON"}
        if state:
            params["p_st"] = state.upper()[:2]
        if facility_name:
            params["p_fn"] = facility_name.strip()
        if npdes_id:
            params["p_pid"] = self._normalize_npdes_id(npdes_id)
        if potw_only:
            # SIC 4952 = Sewerage Systems (POTW proxy when fac type param unavailable)
            params["p_sic"] = "4952"
        if major_only is True:
            params["p_maj"] = "Y"
        elif major_only is False:
            params["p_maj"] = "N"
        params["p_act"] = "Y"
        params.update(extra)
        data = self._get_json("cwa_rest_services.get_facilities", params)
        results = self._results(data)
        msg = self._echo_error(results)
        if msg:
            raise NPDESClientError(msg)
        return data

    def get_qid(self, qid: str, page: int = 1) -> Dict[str, Any]:
        data = self._get_json(
            "cwa_rest_services.get_qid",
            {"output": "JSON", "qid": str(qid), "pageno": str(page)},
        )
        results = self._results(data)
        msg = self._echo_error(results)
        if msg:
            raise NPDESClientError(msg)
        return data

    def get_dfr(self, p_id: str) -> Dict[str, Any]:
        data = self._get_json(
            "dfr_rest_services.get_dfr",
            {"output": "JSON", "p_id": p_id.strip()},
        )
        results = self._results(data)
        msg = self._echo_error(results)
        if msg:
            raise NPDESClientError(msg)
        return data

    def _facility_rows(self, page_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        results = self._results(page_data)
        return (
            results.get("Facilities")
            or results.get("CWAFacilities")
            or results.get("Results")
            or []
        )

    def _paginate_qid(
        self,
        qid: str,
        *,
        max_pages: int,
        page_size_check: int = 500,
    ) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        seen: set[str] = set()
        for page in range(1, max_pages + 1):
            page_data = self.get_qid(str(qid), page=page)
            rows = self._facility_rows(page_data)
            if not rows:
                break
            for row in rows:
                if not isinstance(row, dict):
                    continue
                pid = (
                    row.get("SourceID")
                    or row.get("NPDESId")
                    or row.get("NPDESID")
                    or row.get("RegistryID")
                )
                if not pid or str(pid) in seen:
                    continue
                seen.add(str(pid))
                out.append(row)
                if len(out) >= page_size_check:
                    return out
            if len(rows) < 100:
                break
        return out

    def fetch_state_potws(
        self,
        state: str,
        *,
        max_pages: int = 50,
        major_only: Optional[bool] = None,
    ) -> List[Dict[str, Any]]:
        """Paginate POTW facilities for a state (landscape cache)."""
        state = state.upper()[:2]
        resp = self.get_facilities(state=state, potw_only=True, major_only=major_only)
        results = self._results(resp)
        qid = results.get("QueryID") or results.get("QID")
        if not qid:
            # Some responses inline Facilities without a QID
            rows = self._facility_rows(resp)
            return [r for r in rows if isinstance(r, dict)]
        return self._paginate_qid(str(qid), max_pages=max_pages)

    def lookup_facility(
        self,
        *,
        state: str,
        query: Optional[str] = None,
        max_pages: int = 5,
    ) -> List[Dict[str, Any]]:
        state = state.upper()[:2]
        raw_q = (query or "").strip()
        if raw_q and self._is_exact_npdes_id(raw_q):
            try:
                data = self.get_dfr(self._normalize_npdes_id(raw_q))
            except NPDESClientError:
                return []
            results = self._results(data)
            for permit in results.get("Permits") or []:
                if not isinstance(permit, dict):
                    continue
                if (permit.get("Statute") or "").upper() not in ("CWA", "NPDES", ""):
                    continue
                sid = str(permit.get("SourceID") or "").strip().upper()
                if sid != self._normalize_npdes_id(raw_q):
                    continue
                return [
                    {
                        "NPDESId": sid,
                        "FacilityName": permit.get("FacilityName"),
                        "StateCode": (permit.get("FacilityState") or state)[:2].upper(),
                        "County": permit.get("FacilityCounty"),
                    }
                ]
            return []

        candidates = self._name_query_candidates(raw_q) if raw_q else [None]
        for candidate in candidates:
            try:
                resp = self.get_facilities(
                    state=state,
                    facility_name=candidate,
                    potw_only=True,
                )
            except NPDESClientError as exc:
                logger.warning("NPDES lookup failed for %s/%s: %s", state, candidate, exc)
                continue
            results = self._results(resp)
            qid = results.get("QueryID") or results.get("QID")
            if qid:
                rows = self._paginate_qid(str(qid), max_pages=max_pages, page_size_check=50)
            else:
                rows = [r for r in self._facility_rows(resp) if isinstance(r, dict)]
            if rows:
                return rows
        return []
