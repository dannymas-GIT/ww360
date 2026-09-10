"""Tests for federal job listings API."""

from fastapi.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal
from app.services.auth_service import mint_ww360_token
from app.services.jurisdiction_context_service import build_session_payload


def test_federal_jobs_requires_auth():
    client = TestClient(app, base_url="https://test")
    r = client.get("/api/v1/jobs/federal")
    assert r.status_code in (401, 403)


def test_federal_jobs_returns_structure_for_authenticated_user():
    client = TestClient(app, base_url="https://test")
    db = SessionLocal()
    try:
        from app.models.user import User

        user = db.query(User).filter(User.is_active.is_(True)).first()
        if not user:
            return
        token = mint_ww360_token(build_session_payload(db, user))
        r = client.get(
            "/api/v1/jobs/federal",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200
        body = r.json()
        assert "jobs" in body
        assert body["source"] == "usajobs"
        assert "configured" in body
    finally:
        db.close()
