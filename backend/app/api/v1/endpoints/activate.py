"""Activate flow: magic-link/OTP, org claim, billing link requests, PWSID link."""

from __future__ import annotations

from app.api import deps
from app.core.login_rate_limit import client_ip, enforce_login_rate_limit
from app.db.database import get_db
from app.models.user import User
from app.services import activate_service
from app.tenant_auth import TenantContext
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

router = APIRouter()


class MagicLinkRequestBody(BaseModel):
    email: EmailStr


class MagicLinkVerifyBody(BaseModel):
    email: EmailStr | None = None
    token: str | None = None
    otp: str | None = Field(default=None, min_length=6, max_length=6)


class ActivateClaimBody(BaseModel):
    email: EmailStr
    full_name: str | None = None
    username: str | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    session_id: str | None = None
    org_name: str | None = None
    state_code: str = Field(default="NY", min_length=2, max_length=2)


class RequestLinkBody(BaseModel):
    requester_email: EmailStr
    billing_email: EmailStr | None = None
    pwsid: str | None = None
    state_code: str | None = Field(default=None, max_length=2)
    notes: str | None = None


class ApproveLinkBody(BaseModel):
    request_id: str
    approval_token: str


class LinkDistrictBody(BaseModel):
    org_code: str
    pwsid: str = Field(..., min_length=3, max_length=20)
    state_code: str = Field(..., min_length=2, max_length=2)
    district_name: str | None = None


@router.post("/auth/magic-link/request")
def magic_link_request(
    body: MagicLinkRequestBody,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_login_rate_limit(request)
    # Touch IP for logging without leaking existence
    _ = client_ip(request)
    return activate_service.request_magic_link(db, email=str(body.email))


@router.post("/auth/magic-link/verify")
def magic_link_verify(body: MagicLinkVerifyBody, db: Session = Depends(get_db)):
    if not body.token and not (body.otp and body.email):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Provide token or email+otp",
        )
    return activate_service.verify_magic_link(
        db,
        email=str(body.email) if body.email else None,
        token=body.token,
        otp=body.otp,
    )


@router.post("/auth/activate/claim")
def activate_claim(body: ActivateClaimBody, db: Session = Depends(get_db)):
    return activate_service.claim_org(
        db,
        email=str(body.email),
        full_name=body.full_name,
        username=body.username,
        password=body.password,
        session_id=body.session_id,
        org_name=body.org_name,
        state_code=body.state_code,
    )


@router.post("/auth/activate/request-link")
def activate_request_link(
    body: RequestLinkBody,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_login_rate_limit(request)
    return activate_service.request_billing_link(
        db,
        requester_email=str(body.requester_email),
        billing_email=str(body.billing_email) if body.billing_email else None,
        pwsid=body.pwsid,
        state_code=body.state_code,
        notes=body.notes,
    )


@router.post("/auth/activate/approve-link")
def activate_approve_link(body: ApproveLinkBody, db: Session = Depends(get_db)):
    return activate_service.approve_link_request(
        db,
        request_id=body.request_id,
        approval_token=body.approval_token,
    )


@router.post("/org/districts/link")
def link_org_district(
    body: LinkDistrictBody,
    context: TenantContext = Depends(deps.get_current_tenant_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == context.user_id).first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    # Caller must belong to org or be platform_admin
    if "platform_admin" not in set(context.roles or []):
        if context.active_org_code != body.org_code and body.org_code not in {
            o.get("org_code") if isinstance(o, dict) else None for o in (context.orgs or [])
        }:
            # Also allow if user has district_admin and org membership via DB
            from app.models.workforce_organization import OrganizationUserMembership

            mem = (
                db.query(OrganizationUserMembership)
                .filter(
                    OrganizationUserMembership.user_id == user.id,
                    OrganizationUserMembership.org_code == body.org_code,
                )
                .first()
            )
            if not mem:
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of that organization")
    return activate_service.link_district_pwsid(
        db,
        org_code=body.org_code,
        user=user,
        pwsid=body.pwsid,
        state_code=body.state_code,
        district_name=body.district_name,
    )


@router.get("/auth/activate/entitlement-preview")
def entitlement_preview(
    email: str = Query(...),
    db: Session = Depends(get_db),
):
    """Safe preview used by /activate after verification (no existence leak beyond match)."""
    match = activate_service._lookup_entitlement_by_email(db, email)
    if not match:
        return {"matched": False}
    return match
