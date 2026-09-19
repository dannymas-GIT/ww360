"""Contract tests for AquaSafe → WW360 sync (HMAC + idempotency)."""

import hashlib
import hmac
import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.db.database import get_db
from app.main import app

client = TestClient(app, base_url="http://localhost")


@pytest.fixture(autouse=True)
def _configure_hmac(monkeypatch):
    monkeypatch.setattr(settings, "WW360_SYNC_HMAC_SECRET", "test-secret")


def _sign(body: dict) -> str:
    raw = json.dumps(body, sort_keys=True).encode()
    return hmac.new(b"test-secret", raw, hashlib.sha256).hexdigest()


def test_sync_rejects_missing_signature():
    body = {"events": []}
    resp = client.post("/api/v1/sync/aquasafe/events", json=body)
    assert resp.status_code == 401


def test_sync_accepts_district_event():
    """HMAC + inbox accept/idempotency without live Postgres."""
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
                "event_id": "evt-test-1",
                "aggregate": "district",
                "aggregate_id": "WW360",
                "event_type": "upsert",
                "version": 1,
                "payload": {
                    "id": 1,
                    "district_code": "WW360",
                    "district_name": "Test Utility",
                    "state_code": "NY",
                    "is_active": True,
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
            assert resp.json()["accepted"] == 1

            # Idempotent replay (inbox already has event_id)
            resp2 = client.post(
                "/api/v1/sync/aquasafe/events",
                json=body,
                headers={"X-WW360-Signature": sig},
            )
            assert resp2.status_code == 200
            assert resp2.json()["accepted"] == 0
    finally:
        app.dependency_overrides.pop(get_db, None)
