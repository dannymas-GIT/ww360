"""Contract tests for facility sync aggregate."""

from __future__ import annotations

import hashlib
import hmac
import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.db.database import get_db
from app.main import app
from app.models.sync import ExtFacility
from app.services.sync_processor import apply_event

client = TestClient(app, base_url="http://localhost")


@pytest.fixture(autouse=True)
def _configure_hmac(monkeypatch):
    monkeypatch.setattr(settings, "WW360_SYNC_HMAC_SECRET", "test-secret")


def _sign(body: dict) -> str:
    raw = json.dumps(body, sort_keys=True).encode()
    return hmac.new(b"test-secret", raw, hashlib.sha256).hexdigest()


def test_facility_handler_upsert_and_version_guard():
    """Unit-level: facility handler creates row and respects version."""
    db = MagicMock()
    created = {}

    def _query_side_effect(model):
        q = MagicMock()
        if model is ExtFacility:
            q.filter.return_value.one_or_none.return_value = created.get("row")
        return q

    db.query.side_effect = _query_side_effect
    db.get.return_value = None

    def _add(obj):
        created["row"] = obj

    db.add.side_effect = _add

    apply_event(
        db,
        {
            "aggregate": "facility",
            "version": 2,
            "payload": {
                "publisher": "aquasafe-wastewater",
                "facility_id": "wwtp-1",
                "district_code": "NY-TEST",
                "facility_type": "wwtp",
                "name": "Test POTW",
                "state_code": "NY",
                "npdes_id": "NY0021234",
                "plant_class": "3A",
                "design_flow_mgd": 1.25,
            },
        },
    )
    row = created["row"]
    assert row.facility_type == "wwtp"
    assert row.npdes_id == "NY0021234"
    assert row.plant_class == "3A"
    assert row.version == 2

    # Stale version must not overwrite
    row.name = "Test POTW"
    created["row"] = row
    apply_event(
        db,
        {
            "aggregate": "facility",
            "version": 1,
            "payload": {
                "publisher": "aquasafe-wastewater",
                "facility_id": "wwtp-1",
                "district_code": "NY-TEST",
                "facility_type": "wwtp",
                "name": "Stale",
            },
        },
    )
    assert created["row"].name == "Test POTW"


def test_sync_api_accepts_facility_event():
    """HTTP path: HMAC + facility aggregate accepted (no live Postgres required)."""
    mock_db = MagicMock()
    inbox: dict = {}

    def _get(model, key):
        return inbox.get(key)

    def _add(obj):
        eid = getattr(obj, "event_id", None)
        if eid is not None:
            inbox[eid] = obj

    mock_db.get.side_effect = _get
    mock_db.add.side_effect = _add
    app.dependency_overrides[get_db] = lambda: mock_db

    body = {
        "events": [
            {
                "event_id": "evt-facility-1",
                "aggregate": "facility",
                "aggregate_id": "wwtp-1",
                "event_type": "upsert",
                "version": 1,
                "payload": {
                    "publisher": "aquasafe-wastewater",
                    "facility_id": "wwtp-1",
                    "district_code": "NY-TEST",
                    "facility_type": "wwtp",
                    "name": "API POTW",
                    "state_code": "NY",
                    "npdes_id": "NY0029999",
                },
            }
        ]
    }
    sig = _sign(body)
    try:
        with patch("app.api.v1.endpoints.sync.process_inbox_event", return_value=True):
            resp = client.post(
                "/api/v1/sync/aquasafe/events",
                json=body,
                headers={"X-WW360-Signature": sig},
            )
        assert resp.status_code == 200
        assert resp.json()["accepted"] >= 1
        assert "evt-facility-1" in inbox
    finally:
        app.dependency_overrides.pop(get_db, None)
