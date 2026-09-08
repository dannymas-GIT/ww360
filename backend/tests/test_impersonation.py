"""Tests for impersonation eligibility and read-only guard."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.models.user import User
from app.services.impersonation_service import _can_actor_impersonate_target


class _FakeQuery:
    def __init__(self, rows=None):
        self._rows = rows or []

    def filter(self, *args, **kwargs):
        return self

    def all(self):
        return self._rows

    def first(self):
        return self._rows[0] if self._rows else None


class _FakeDB:
    def __init__(self):
        self._orgs = []
        self._districts = []

    def query(self, model):
        name = getattr(model, "__name__", str(model))
        if "OrganizationUserMembership" in name:
            return _FakeQuery(self._orgs)
        if "WaterDistrict" in name:
            return _FakeQuery(self._districts)
        if "WorkforceOrganization" in name:
            return _FakeQuery([])
        return _FakeQuery([])


def test_cannot_impersonate_platform_admin():
    db = _FakeDB()
    actor = User(id=1, username="actor", roles=["platform_admin"], is_active=True)
    target = User(id=2, username="target", roles=["platform_admin"], is_active=True)
    with pytest.raises(HTTPException) as exc:
        _can_actor_impersonate_target(db, actor, target, mode="preview")
    assert exc.value.status_code == 403


def test_preview_requires_scope_for_state_admin():
    db = _FakeDB()
    actor = User(id=1, username="actor", roles=["state_admin"], is_active=True, district_memberships=[])
    target = User(
        id=2,
        username="target",
        roles=["district_admin"],
        is_active=True,
        district_memberships=["WBWD"],
    )
    with pytest.raises(HTTPException) as exc:
        _can_actor_impersonate_target(db, actor, target, mode="preview")
    assert exc.value.status_code == 403
