"""AuthZ / IDOR tests for workforce-summary and coverage/summary."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from app.core.config import settings
from app.db.database import get_db
from app.main import app
from app.services.auth_service import mint_ww360_token
from fastapi import HTTPException
from fastapi.testclient import TestClient

client = TestClient(app, base_url="http://localhost")

SERVICE_TOKEN = "ww360-service-token-idor"


@pytest.fixture(autouse=True)
def _configure(monkeypatch):
    monkeypatch.setattr(settings, "WW360_SERVICE_TOKEN", SERVICE_TOKEN)
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", "jwt-idor-secret")


def _user_token(*, user_id: int, districts: list[str], roles: list[str] | None = None) -> str:
    return mint_ww360_token(
        {
            "user_id": user_id,
            "username": f"user{user_id}",
            "roles": roles or ["district_admin"],
            "district_memberships": districts,
            "active_state_code": "NY",
        }
    )


def test_workforce_summary_unauthenticated_401():
    resp = client.get("/api/v1/districts/HF001/workforce-summary")
    assert resp.status_code == 401


def test_workforce_summary_cross_district_403():
    db = MagicMock()
    app.dependency_overrides[get_db] = lambda: db
    token = _user_token(user_id=10, districts=["OTHER"])
    try:
        with patch(
            "app.api.v1.endpoints.districts._require_district_auth",
            side_effect=HTTPException(status_code=403, detail="Not authorized for this district"),
        ):
            resp = client.get(
                "/api/v1/districts/HF001/workforce-summary",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_workforce_summary_service_token_200():
    db = MagicMock()
    q = MagicMock()
    q.filter.return_value.scalar.return_value = 5
    q.filter.return_value.first.return_value = (1,)
    q.filter.return_value.all.return_value = []
    db.query.return_value = q
    app.dependency_overrides[get_db] = lambda: db
    try:
        with patch(
            "app.api.v1.endpoints.districts._count_retirements_24mo", return_value=2
        ), patch(
            "app.api.v1.endpoints.districts._count_critical_roles_without_successor",
            return_value=1,
        ), patch(
            "app.api.service_token_auth.district_exists", return_value=True
        ):
            resp = client.get(
                "/api/v1/districts/HF001/workforce-summary",
                headers={"Authorization": f"Bearer {SERVICE_TOKEN}"},
            )
            assert resp.status_code == 200
            body = resp.json()
            assert body["retirements_24mo"] == 2
            assert body["critical_roles_without_successor"] == 1
            assert body["district_code"] == "HF001"
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_workforce_summary_authorized_user_200():
    db = MagicMock()
    q = MagicMock()
    q.filter.return_value.scalar.return_value = 4
    q.filter.return_value.all.return_value = []
    db.query.return_value = q
    app.dependency_overrides[get_db] = lambda: db
    token = _user_token(user_id=3, districts=["HF001"])
    try:
        with patch(
            "app.api.v1.endpoints.districts._require_district_auth",
            return_value="HF001",
        ), patch(
            "app.api.v1.endpoints.districts._count_retirements_24mo", return_value=0
        ), patch(
            "app.api.v1.endpoints.districts._count_critical_roles_without_successor",
            return_value=0,
        ):
            resp = client.get(
                "/api/v1/districts/HF001/workforce-summary",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 200
            assert resp.json()["employee_count"] == 4
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_coverage_summary_unauthenticated_401():
    resp = client.get(
        "/api/v1/coverage/summary",
        params={"district_code": "HF001", "facility_id": "WWTP-1"},
    )
    assert resp.status_code == 401


def test_coverage_summary_service_token_200():
    db = MagicMock()
    app.dependency_overrides[get_db] = lambda: db
    try:
        with patch(
            "app.api.service_token_auth.district_exists", return_value=True
        ), patch(
            "app.api.endpoints.coverage.compute_coverage_summary",
            return_value={
                "district_code": "HF001",
                "facility_id": "WWTP-1",
                "program": "wastewater",
                "required_grade": "3",
                "covered": False,
                "chief_operator": None,
                "warnings": ["no_chief_operator"],
            },
        ):
            resp = client.get(
                "/api/v1/coverage/summary",
                params={"district_code": "HF001", "facility_id": "WWTP-1"},
                headers={"Authorization": f"Bearer {SERVICE_TOKEN}"},
            )
            assert resp.status_code == 200
            assert resp.json()["facility_id"] == "WWTP-1"
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_coverage_summary_user_jwt_authorized():
    db = MagicMock()
    app.dependency_overrides[get_db] = lambda: db
    token = _user_token(user_id=3, districts=["HF001"], roles=["district_admin"])
    try:
        with patch(
            "app.api.endpoints.coverage._require_district_auth",
            return_value="HF001",
        ), patch(
            "app.api.endpoints.coverage.compute_coverage_summary",
            return_value={
                "district_code": "HF001",
                "facility_id": "WWTP-1",
                "program": "wastewater",
                "required_grade": "3",
                "covered": True,
                "chief_operator": {"employee_code": "E1", "employee_name": "Pat"},
                "warnings": [],
            },
        ):
            resp = client.get(
                "/api/v1/coverage/summary",
                params={"district_code": "HF001", "facility_id": "WWTP-1"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 200
            assert resp.json()["covered"] is True
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_admin_district_merge_unauthenticated_401():
    resp = client.post(
        "/api/v1/admin/districts/merge",
        json={
            "source_district_code": "A",
            "target_district_code": "B",
            "reason": "duplicate pwsid",
        },
    )
    assert resp.status_code == 401
