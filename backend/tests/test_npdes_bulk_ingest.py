"""Unit tests for NPDES bulk ingest helpers (no network)."""

from __future__ import annotations

import csv
import io
import zipfile
from datetime import datetime
from unittest.mock import MagicMock, patch

from app.services.national import npdes_bulk_ingest as ingest


def _zip_with_csvs(fac_rows: list[dict], perm_rows: list[dict]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        fac_buf = io.StringIO()
        writer = csv.DictWriter(fac_buf, fieldnames=list(fac_rows[0].keys()))
        writer.writeheader()
        writer.writerows(fac_rows)
        zf.writestr("ICIS_FACILITIES.csv", fac_buf.getvalue())
        perm_buf = io.StringIO()
        writer = csv.DictWriter(perm_buf, fieldnames=list(perm_rows[0].keys()))
        writer.writeheader()
        writer.writerows(perm_rows)
        zf.writestr("ICIS_PERMITS.csv", perm_buf.getvalue())
    return buf.getvalue()


def test_merge_row_keeps_potw():
    now = datetime.utcnow()
    fac = {
        "FACILITY_NAME": "TEST WWTP",
        "STATE_CODE": "NY",
        "SIC_CODE": "4952",
        "FACILITY_COUNTY": "Albany",
    }
    perm = {
        "EXTERNAL_PERMIT_NMBR": "NY0021234",
        "PERMIT_STATUS_CODE": "EFFECTIVE",
        "PERMIT_TYPE_CODE": "NPD",
        "MAJOR_MINOR_STATUS_FLAG": "Y",
        "DESIGN_FLOW_NMBR": "1.5",
    }
    row = ingest._merge_row("NY", fac, perm, now)
    assert row is not None
    assert row.npdes_id == "NY0021234"
    assert row.facility_type_code == "POTW"
    assert row.major_minor == "MAJOR"
    assert row.design_flow_mgd == 1.5


def test_merge_row_skips_general_permit():
    now = datetime.utcnow()
    fac = {"FACILITY_NAME": "Storm Drain", "SIC_CODE": "4952"}
    perm = {
        "EXTERNAL_PERMIT_NMBR": "NYR00A001",
        "PERMIT_STATUS_CODE": "EFFECTIVE",
        "PERMIT_TYPE_CODE": "GEN",
    }
    assert ingest._merge_row("NY", fac, perm, now) is None


def test_refresh_from_bulk_download_with_fixture_zip():
    zdata = _zip_with_csvs(
        [
            {
                "NPDES_ID": "NY0021234",
                "FACILITY_NAME": "Fixture POTW",
                "STATE_CODE": "NY",
                "SIC_CODE": "4952",
                "FACILITY_COUNTY": "Erie",
            }
        ],
        [
            {
                "EXTERNAL_PERMIT_NMBR": "NY0021234",
                "STATE_CODE": "NY",
                "PERMIT_STATUS_CODE": "EFFECTIVE",
                "PERMIT_TYPE_CODE": "NPD",
                "MAJOR_MINOR_STATUS_FLAG": "N",
                "ICIS_FACILITY_INTEREST_ID": "",
            }
        ],
    )

    class _Resp:
        content = zdata

        def raise_for_status(self):
            return None

    class _Client:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def get(self, url):
            return _Resp()

    db = MagicMock()
    db.query.return_value.filter.return_value.delete.return_value = None

    with patch.object(ingest.httpx, "Client", return_value=_Client()):
        results = ingest.refresh_from_bulk_download(db)

    assert isinstance(results, dict)
    assert db.commit.called or db.add.called or "NY" in results
