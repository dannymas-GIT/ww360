"""Platform library scope access and role-based folder visibility."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.services.doc_studio_folder_audience import folder_visible, visible_folder_audiences
from app.services.doc_studio_service import resolve_scope
from app.tenant_auth import TenantContext


def _ctx(*, roles: list[str], district_code: str | None = "HFWD") -> TenantContext:
    return TenantContext(
        user_id=1,
        username="demo",
        district_code=district_code,
        roles=roles,
        active_state_code="NY",
    )


def test_resolve_scope_allows_district_user_to_view_program_library():
    ctx = _ctx(roles=["district_operator"])
    assert resolve_scope(ctx, "program:NY") == "program:NY"


def test_resolve_scope_denies_other_state_program_library():
    ctx = _ctx(roles=["district_operator"])
    with pytest.raises(HTTPException) as exc:
        resolve_scope(ctx, "program:NJ")
    assert exc.value.status_code == 403


def test_visible_folder_audiences_operator():
    ctx = _ctx(roles=["district_operator"])
    assert visible_folder_audiences(ctx) == {"all", "operator"}


def test_visible_folder_audiences_manager():
    ctx = _ctx(roles=["district_manager"])
    assert visible_folder_audiences(ctx) == {"all", "operator", "manager"}


def test_visible_folder_audiences_partner():
    ctx = _ctx(roles=["oww_partner"])
    assert visible_folder_audiences(ctx) == {"all", "operator", "manager", "partner"}


def test_folder_visible_respects_audience():
    ctx = _ctx(roles=["district_operator"])
    assert folder_visible(ctx, "all")
    assert folder_visible(ctx, "operator")
    assert not folder_visible(ctx, "manager")
    assert not folder_visible(ctx, "partner")
