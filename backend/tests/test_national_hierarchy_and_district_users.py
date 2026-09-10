"""National hierarchy + district user management unit tests."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.models.doc_document import NATIONAL_PROGRAM_SCOPE, is_national_program_scope
from app.services.doc_studio_service import resolve_scope
from app.services.district_user_service import (
    can_manage_district_users,
    require_district_user_manager,
)
from app.services.role_catalog_service import DEFAULT_UTILITY_ENABLED, utility_assignable_keys
from app.tenant_auth import TenantContext


def _ctx(*, roles: list[str], district_code: str | None = "HFWD", state: str = "NY") -> TenantContext:
    return TenantContext(
        user_id=1,
        username="demo",
        district_code=district_code,
        roles=roles,
        active_state_code=state,
    )


def test_national_program_scope_helpers():
    assert is_national_program_scope(NATIONAL_PROGRAM_SCOPE)
    assert NATIONAL_PROGRAM_SCOPE == "program:US"


def test_resolve_scope_allows_national_observer_program_us():
    ctx = _ctx(roles=["national_observer"], district_code=None)
    assert resolve_scope(ctx, "program:US") == NATIONAL_PROGRAM_SCOPE


def test_resolve_scope_denies_operator_program_us():
    ctx = _ctx(roles=["district_operator"])
    with pytest.raises(HTTPException) as exc:
        resolve_scope(ctx, "program:US")
    assert exc.value.status_code == 403


def test_district_manager_can_manage_users():
    ctx = _ctx(roles=["district_manager"])
    require_district_user_manager(ctx, "HFWD")


def test_state_admin_can_manage_users():
    ctx = _ctx(roles=["oww_partner"], district_code=None)
    assert can_manage_district_users(ctx, "HFWD")


def test_operator_cannot_manage_users():
    ctx = _ctx(roles=["district_operator"])
    with pytest.raises(HTTPException) as exc:
        require_district_user_manager(ctx, "HFWD")
    assert exc.value.status_code == 403


def test_utility_catalog_defaults():
    assert "district_operator" in DEFAULT_UTILITY_ENABLED
    assert "platform_admin" not in utility_assignable_keys()
