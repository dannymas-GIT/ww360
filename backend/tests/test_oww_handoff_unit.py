"""Unit tests for OWW handoff helpers (no DB)."""

from fastapi import HTTPException
import pytest

from app.services.oww_handoff_service import _org_code_for_oww, _username_for
from app.services.entitlement_service import EntitlementResult


def test_org_code_stable():
    assert _org_code_for_oww("156955") == "OWW_156955"
    assert _org_code_for_oww("abc-def").startswith("OWW_")


def test_username_from_email():
    assert _username_for("pat.admin@utility.org", "9") == "pat.admin"
    assert _username_for("", "42").startswith("oww")


def test_entitlement_active_only():
    assert EntitlementResult("1", "active").is_active
    assert not EntitlementResult("1", "past_due").is_active
    assert not EntitlementResult("1", "none").is_active
