"""Self-scope helpers for workforce operators (ceu_user).

Operators linked to a workforce_employees row may only read their own
employee / certification / CEU data. Managers and admins are unaffected.
"""

from __future__ import annotations

from typing import Optional, Set

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.workforce_succession import WorkforceEmployee
from app.tenant_auth import TenantContext

# Roles that may view the full district workforce roster.
_DISTRICT_WIDE_ROLES: Set[str] = {
    "ceu_admin",
    "ceu_manager",
    "district_admin",
    "district_manager",
    "global_admin",
    "system_admin",
    "platform_admin",
}


def is_operator_self_scoped(context: TenantContext) -> bool:
    """True when the caller is a CEU operator without district-wide workforce roles."""
    if getattr(context, "is_system_admin", False) or getattr(
        context, "is_global_admin", False
    ):
        return False
    roles = {str(r) for r in (context.roles or [])}
    if roles & _DISTRICT_WIDE_ROLES:
        return False
    return "ceu_user" in roles


def get_linked_employee(
    db: Session,
    *,
    user_id: int,
    district_code: Optional[str] = None,
) -> Optional[WorkforceEmployee]:
    query = db.query(WorkforceEmployee).filter(
        WorkforceEmployee.linked_aquasafe_user_id == user_id,
        WorkforceEmployee.record_status == "active",
    )
    if district_code:
        query = query.filter(WorkforceEmployee.district_code == district_code)
    return query.order_by(WorkforceEmployee.id.asc()).first()


def resolve_operator_employee_code(
    db: Session,
    context: TenantContext,
    district_code: str,
    *,
    requested_employee_code: Optional[str] = None,
    missing_ok: bool = False,
) -> Optional[str]:
    """
    For self-scoped operators, return their employee_code (forced).
    For managers/admins, return requested_employee_code unchanged (may be None).

    When ``missing_ok`` is True and the operator has no linked profile, return
    None instead of raising — callers may fall back to sample / empty data.
    """
    if not is_operator_self_scoped(context):
        return requested_employee_code

    emp = get_linked_employee(
        db, user_id=context.user_id, district_code=district_code
    )
    if emp is None:
        if missing_ok:
            return None
        raise HTTPException(
            status_code=403,
            detail="No workforce profile is linked to this login",
        )
    own = emp.employee_code
    if (
        requested_employee_code
        and requested_employee_code.strip()
        and requested_employee_code.strip() != own
    ):
        raise HTTPException(
            status_code=403,
            detail="Not authorized for another operator's records",
        )
    return own


def operator_missing_workforce_profile(
    db: Session,
    context: TenantContext,
    district_code: str,
) -> bool:
    """True when a self-scoped operator has no linked workforce_employees row."""
    if not is_operator_self_scoped(context):
        return False
    return (
        get_linked_employee(
            db, user_id=context.user_id, district_code=district_code
        )
        is None
    )


def deny_operator_district_wide(context: TenantContext, resource: str = "this data") -> None:
    """Raise 403 when an operator tries to load district-wide workforce resources."""
    if is_operator_self_scoped(context):
        raise HTTPException(
            status_code=403,
            detail=f"Operators cannot access district-wide {resource}",
        )
