"""HTTP client for EPA ECHO SDWA REST services and Detailed Facility Report (DFR)."""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_PWSID_EXACT_RE = re.compile(r"^[A-Z]{2}(?=.*\d)[A-Z0-9]{6,14}$", re.IGNORECASE)
_NAME_SUFFIX_RE = re.compile(
    r"\s+(water\s+district|water\s+dept(?:artment)?|water\s+company|"
    r"public\s+water\s+system|municipal\s+water|pws|wd)\.?$",
    re.IGNORECASE,
)
_TRAILING_WATER_RE = re.compile(r"\s+water\.?$", re.IGNORECASE)


class SDWISClientError(Exception):
    pass


class SDWISClient:
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

    def __enter__(self) -> "SDWISClient":
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
            logger.warning("SDWIS HTTP error %s: %s", url, e)
            raise SDWISClientError(str(e)) from e
        try:
            return resp.json()
        except Exception as e:
            raise SDWISClientError("Invalid JSON from EPA API") from e

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
    def _normalize_pwsid(value: str) -> str:
        return value.strip().upper()

    @classmethod
    def _is_exact_pwsid(cls, value: str) -> bool:
        return bool(_PWSID_EXACT_RE.match(cls._normalize_pwsid(value)))

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
        _add(_TRAILING_WATER_RE.sub("", stripped or q).strip())
        tokens = [t for t in re.split(r"[\s\-_/]+", stripped or q) if t]
        if len(tokens) >= 2:
            _add(" ".join(tokens[:2]))
        return out

    def get_systems(
        self,
        *,
        state: Optional[str] = None,
        activity: Optional[str] = None,
        facility_name: Optional[str] = None,
        **extra: Any,
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {"output": "JSON"}
        if state:
            params["p_st"] = state.upper()[:2]
        if activity:
            params["p_actv"] = activity
        if facility_name:
            params["p_fn"] = facility_name.strip()
        params.update(extra)
        data = self._get_json("sdw_rest_services.get_systems", params)
        results = self._results(data)
        msg = self._echo_error(results)
        if msg:
            raise SDWISClientError(msg)
        return data

    def get_qid(self, qid: str, page: int = 1) -> Dict[str, Any]:
        data = self._get_json(
            "sdw_rest_services.get_qid",
            {"output": "JSON", "qid": str(qid), "pageno": str(page)},
        )
        results = self._results(data)
        msg = self._echo_error(results)
        if msg:
            raise SDWISClientError(msg)
        return data

    def get_dfr(self, p_id: str) -> Dict[str, Any]:
        data = self._get_json(
            "dfr_rest_services.get_dfr",
            {"output": "JSON", "p_id": p_id.strip()},
        )
        results = self._results(data)
        msg = self._echo_error(results)
        if msg:
            raise SDWISClientError(msg)
        return data

    def _lookup_row_from_dfr(self, pwsid: str, state: str) -> Optional[Dict[str, Any]]:
        try:
            data = self.get_dfr(p_id=pwsid)
        except SDWISClientError:
            return None
        results = self._results(data)
        for permit in results.get("Permits") or []:
            if not isinstance(permit, dict):
                continue
            if (permit.get("Statute") or "").upper() != "SDWA":
                continue
            sid = str(permit.get("SourceID") or "").strip().upper()
            if sid != pwsid:
                continue
            st = (permit.get("FacilityState") or state or "")[:2].upper()
            if state and st and st != state.upper():
                continue
            return {
                "PWSId": sid,
                "PWSID": sid,
                "PWSName": permit.get("FacilityName"),
                "StateCode": st or state.upper(),
            }
        return None

    def _paginate_qid(
        self,
        qid: str,
        *,
        max_pages: int,
        name_query: Optional[str],
        page_size_check: int,
        server_filtered: bool,
    ) -> List[Dict[str, Any]]:
        q_lower = (name_query or "").strip().lower()
        out: List[Dict[str, Any]] = []
        seen: set[str] = set()

        for page in range(1, max_pages + 1):
            page_data = self.get_qid(str(qid), page=page)
            pr = self._results(page_data)
            rows = pr.get("WaterSystems") or []
            if not rows:
                break
            for row in rows:
                if not isinstance(row, dict):
                    continue
                pid = row.get("PWSId") or row.get("PWSID")
                if not pid or pid in seen:
                    continue
                pid_s = str(pid)
                if not server_filtered and q_lower:
                    name = (row.get("PWSName") or "") + " " + pid_s
                    if q_lower not in name.lower() and q_lower not in pid_s.lower():
                        continue
                seen.add(pid_s)
                out.append(row)
                if len(out) >= page_size_check:
                    return out
            if len(rows) < 100:
                break
        return out[:page_size_check]

    def lookup_water_systems(
        self,
        *,
        state: str,
        name_query: Optional[str] = None,
        max_pages: Optional[int] = None,
        page_size_check: int = 50,
    ) -> List[Dict[str, Any]]:
        state = state.upper()[:2]
        raw_q = (name_query or "").strip()

        if not raw_q:
            max_pages = max_pages or settings.SDWIS_LOOKUP_UNFILTERED_MAX_PAGES
            systems_resp = self.get_systems(state=state, activity="A")
            results = self._results(systems_resp)
            qid = results.get("QueryID")
            if not qid:
                return []
            return self._paginate_qid(
                str(qid),
                max_pages=max_pages,
                name_query=None,
                page_size_check=page_size_check,
                server_filtered=True,
            )

        if self._is_exact_pwsid(raw_q):
            row = self._lookup_row_from_dfr(self._normalize_pwsid(raw_q), state)
            return [row] if row else []

        max_pages = max_pages or settings.SDWIS_LOOKUP_FILTERED_MAX_PAGES
        for candidate in self._name_query_candidates(raw_q):
            use_server = " " in candidate or not re.match(
                r"^[A-Z0-9-]+$", candidate, re.IGNORECASE
            )
            systems_resp = self.get_systems(
                state=state,
                activity="A",
                facility_name=candidate if use_server else None,
            )
            results = self._results(systems_resp)
            qid = results.get("QueryID")
            if not qid:
                continue
            rows = self._paginate_qid(
                str(qid),
                max_pages=max_pages,
                name_query=None if use_server else candidate,
                page_size_check=page_size_check,
                server_filtered=use_server,
            )
            if rows:
                return rows
        return []

    def fetch_all_active_systems(self, state: str, max_pages: int = 50) -> List[Dict[str, Any]]:
        """Paginate all active systems in a state for landscape cache."""
        state = state.upper()[:2]
        systems_resp = self.get_systems(state=state, activity="A")
        results = self._results(systems_resp)
        qid = results.get("QueryID")
        if not qid:
            return []
        all_rows: List[Dict[str, Any]] = []
        seen: set[str] = set()
        for page in range(1, max_pages + 1):
            page_data = self.get_qid(str(qid), page=page)
            pr = self._results(page_data)
            rows = pr.get("WaterSystems") or []
            if not rows:
                break
            for row in rows:
                if not isinstance(row, dict):
                    continue
                pid = row.get("PWSId") or row.get("PWSID")
                if not pid or str(pid) in seen:
                    continue
                seen.add(str(pid))
                all_rows.append(row)
            if len(rows) < 100:
                break
        return all_rows
