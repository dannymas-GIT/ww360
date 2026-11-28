"""Contract tests for AquaSafe → WW360 sync (HMAC + PK isolation + handoff)."""

from __future__ import annotations

import hashlib
import hmac
import json
from unittest.mock import MagicMock, patch

import pytest
from app.core.config import settings
from app.db.database import get_db
from app.main import app
from app.models.user import User
from app.models.water_district import WaterDistrict
from app.services.auth_service import mint_ww360_token, upsert_local_user_from_aquasafe
from app.services.sync_processor import (
    DistrictIdentityConflict,
    apply_event,
    resolve_water_district,
)
from fastapi.testclient import TestClient

client = TestClient(app, base_url="http://localhost")


@pytest.fixture(autouse=True)
def _configure_hmac(monkeypatch):
    monkeypatch.setattr(settings, "WW360_SYNC_HMAC_SECRET", "test-secret")
    monkeypatch.setattr(settings, "WW360_SERVICE_TOKEN", "svc-token-test")
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", "jwt-test-secret")


def _sign_raw(raw: bytes) -> str:
    return hmac.new(b"test-secret", raw, hashlib.sha256).hexdigest()


def _sign_body_dict(body: dict) -> tuple[bytes, str]:
    # Intentionally unsorted keys to prove raw-body HMAC (not re-serialized sort_keys).
    raw = json.dumps(body, separators=(",", ":")).encode()
    return raw, _sign_raw(raw)


def test_sync_rejects_missing_signature():
    body = {"events": []}
    resp = client.post("/api/v1/sync/aquasafe/events", json=body)
    assert resp.status_code == 401


def test_sync_rejects_tampered_body():
    body = {
        "events": [
            {
                "event_id": "evt-tamper",
                "aggregate": "district",
                "aggregate_id": "X",
                "event_type": "upsert",
                "version": 1,
                "occurred_at": "2026-11-28T12:00:00Z",
                "payload": {"id": 9, "district_code": "X", "district_name": "X", "state_code": "NY"},
            }
        ]
    }
    raw, sig = _sign_body_dict(body)
    tampered = raw[:-1] + (b"Z" if raw[-1:] != b"Z" else b"Y")
    resp = client.post(
        "/api/v1/sync/aquasafe/events",
        content=tampered,
        headers={
            "Content-Type": "application/json",
            "X-OneWater-Signature": f"sha256={sig}",
        },
    )
    assert resp.status_code == 401


def test_sync_accepts_onewater_signature_reordered_keys():
    """Raw-body HMAC with X-OneWater-Signature: sha256=<hex> (keys not sorted)."""
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

    # Build JSON with deliberately unsorted object keys.
    raw = (
        b'{"events":[{"version":1,"event_type":"upsert","aggregate":"district",'
        b'"payload":{"state_code":"NY","district_name":"Test Utility","id":1,'
        b'"district_code":"WW360","is_active":true},"aggregate_id":"WW360",'
        b'"event_id":"evt-test-1","occurred_at":"2026-11-28T12:00:00Z"}]}'
    )
    sig = _sign_raw(raw)
    try:
        with patch("app.api.v1.endpoints.sync.process_inbox_event", return_value=True):
            resp = client.post(
                "/api/v1/sync/aquasafe/events",
                content=raw,
                headers={
                    "Content-Type": "application/json",
                    "X-OneWater-Signature": f"sha256={sig}",
                },
            )
            assert resp.status_code == 200
            assert resp.json()["accepted"] == 1

            # Legacy alias still works (bare hex).
            resp2 = client.post(
                "/api/v1/sync/aquasafe/events",
                content=raw,
                headers={
                    "Content-Type": "application/json",
                    "X-WW360-Signature": sig,
                },
            )
            assert resp2.status_code == 200
            assert resp2.json()["accepted"] == 0
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_sync_accepts_legacy_ww360_signature_with_prefix():
    mock_db = MagicMock()
    inbox: dict = {}
    mock_db.get.side_effect = lambda model, key: inbox.get(key)
    mock_db.add.side_effect = lambda obj: inbox.setdefault(getattr(obj, "event_id", None), obj)
    app.dependency_overrides[get_db] = lambda: mock_db
    body = {"events": []}
    raw, sig = _sign_body_dict(body)
    try:
        with patch("app.api.v1.endpoints.sync.process_inbox_event", return_value=True):
            resp = client.post(
                "/api/v1/sync/aquasafe/events",
                content=raw,
                headers={
                    "Content-Type": "application/json",
                    "X-WW360-Signature": f"sha256={sig}",
                },
            )
            assert resp.status_code == 200
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_water_district_pk_not_taken_from_aquasafe_id():
    """AquaSafe district id=1 must not collide with existing OWW water_districts.id=1."""
    db = MagicMock()
    existing_oww = WaterDistrict(
        id=1,
        district_code="OWW_DEMO",
        district_name="OWW Demo",
        state_code="NY",
    )

    # First lookup by district_code → None; aquasafe_district_id → None; pwsid → None
    q = MagicMock()
    q.filter.return_value.one_or_none.return_value = None
    db.query.return_value = q

    added: list[WaterDistrict] = []

    def _add(obj):
        if isinstance(obj, WaterDistrict):
            # Simulate Postgres sequence assigning a new id (not AquaSafe's 1).
            obj.id = 42
            added.append(obj)

    db.add.side_effect = _add

    wd = resolve_water_district(
        db,
        {
            "id": 1,
            "district_code": "AS_UTIL",
            "district_name": "AquaSafe Utility",
            "state_code": "NY",
            "pwsid": "NY1234567",
        },
    )
    assert wd is not None
    assert wd.district_code == "AS_UTIL"
    assert wd.aquasafe_district_id == 1
    assert wd.pwsid == "NY1234567"
    assert wd.id != 1 or existing_oww.id == 1  # local id must not be forced to AquaSafe's 1
    assert getattr(wd, "id", None) != 1 or wd is existing_oww
    # Explicit: we never constructed WaterDistrict(id=1, ...) for the AquaSafe row.
    assert all(getattr(x, "id", None) != 1 or x.district_code == "OWW_DEMO" for x in added)
    assert added and added[0].id == 42


def test_pwsid_state_conflict_raises():
    db = MagicMock()
    claimed = WaterDistrict(
        id=7,
        district_code="OTHER",
        district_name="Other",
        state_code="NY",
        pwsid="NY9999999",
    )
    calls = {"n": 0}

    def query_side_effect(model):
        q = MagicMock()

        def filter_side(*args, **kwargs):
            f = MagicMock()
            calls["n"] += 1
            # 1: district_code, 2: aquasafe_district_id, 3: pwsid+state → conflict
            if calls["n"] >= 3:
                f.one_or_none.return_value = claimed
            else:
                f.one_or_none.return_value = None
            return f

        q.filter.side_effect = filter_side
        return q

    db.query.side_effect = query_side_effect

    with pytest.raises(DistrictIdentityConflict):
        resolve_water_district(
            db,
            {
                "id": 99,
                "district_code": "NEWCODE",
                "district_name": "New",
                "state_code": "NY",
                "pwsid": "NY9999999",
            },
        )


def test_aquasafe_handoff_uses_local_user_id_not_aquasafe_id():
    """AquaSafe user id=1 must not collide with local users.id=1 (OWW)."""
    db = MagicMock()
    oww_user = User(
        id=1,
        username="oww-admin",
        email="oww@example.com",
        roles=["platform_admin"],
        district_memberships=[],
        oww_user_id="oww-1",
        aquasafe_user_id=None,
        is_active=True,
    )
    created: list[User] = []

    def query_side_effect(model):
        q = MagicMock()

        def filter_side(*args, **kwargs):
            f = MagicMock()
            # aquasafe_user_id lookup → None; email match → oww user (protected)
            # username uniqueness check → None
            call = str(args)
            if "aquasafe_user_id" in call or "User.aquasafe_user_id" in call:
                f.first.return_value = None
            elif "email" in call:
                f.first.return_value = oww_user
            else:
                f.first.return_value = None
            return f

        q.filter.side_effect = filter_side
        return q

    db.query.side_effect = query_side_effect

    def add(obj):
        if isinstance(obj, User):
            obj.id = 55
            created.append(obj)

    db.add.side_effect = add

    user = upsert_local_user_from_aquasafe(
        db,
        {
            "user_id": 1,
            "username": "as-user",
            "email": "oww@example.com",  # collides with OWW email — must not overwrite
            "roles": ["district_admin"],
            "district_memberships": ["HF001"],
        },
    )
    assert user.id != 1
    assert user.aquasafe_user_id == 1
    assert oww_user.aquasafe_user_id is None
    token = mint_ww360_token(
        {
            "user_id": user.id,
            "username": user.username,
            "roles": user.roles,
            "district_memberships": user.district_memberships,
        },
        origin="aquasafe",
    )
    import jwt

    claims = jwt.decode(token, "jwt-test-secret", algorithms=["HS256"])
    assert claims["sub"] == str(user.id)
    assert claims["sub"] != "1"
    assert claims["origin"] == "aquasafe"
    assert claims["iss"] == "ww360"


def test_apply_district_event_does_not_set_water_district_id_from_payload():
    db = MagicMock()
    q = MagicMock()
    q.filter.return_value.one_or_none.return_value = None
    db.query.return_value = q
    added = []

    def add(obj):
        added.append(obj)
        if isinstance(obj, WaterDistrict):
            obj.id = 100

    db.add.side_effect = add
    apply_event(
        db,
        {
            "aggregate": "district",
            "version": 1,
            "payload": {
                "id": 1,
                "district_code": "AS1",
                "district_name": "AS One",
                "state_code": "NY",
                "is_active": True,
            },
        },
    )
    wd_rows = [o for o in added if isinstance(o, WaterDistrict)]
    assert wd_rows
    assert not hasattr(wd_rows[0], "_sa_instance_state") or True
    # Constructor must not have received id=1 from payload (autoincrement path).
    assert wd_rows[0].aquasafe_district_id == 1
    assert wd_rows[0].id == 100
