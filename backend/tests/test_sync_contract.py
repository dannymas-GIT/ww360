"""Contract tests for AquaSafe → WW360 sync (HMAC + idempotency)."""

import hashlib
import hmac
import json

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)


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
    resp = client.post(
        "/api/v1/sync/aquasafe/events",
        json=body,
        headers={"X-WW360-Signature": sig},
    )
    assert resp.status_code == 200
    assert resp.json()["accepted"] == 1

    # Idempotent replay
    resp2 = client.post(
        "/api/v1/sync/aquasafe/events",
        json=body,
        headers={"X-WW360-Signature": sig},
    )
    assert resp2.status_code == 200
    assert resp2.json()["accepted"] == 0
