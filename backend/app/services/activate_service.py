"""Magic-link / OTP + org claim helpers for /activate."""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
import uuid
from datetime import timedelta
from typing import Any

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.stripe_entitlement import AuthMagicToken, OrgLinkRequest, OwwStripeEntitlement
from app.models.user import User
from app.models.water_district import WaterDistrict
from app.models.workforce_organization import (
    OrganizationDistrictMembership,
    OrganizationUserMembership,
    WorkforceOrganization,
)
from app.services.auth_service import mint_ww360_token
from app.services.email_service import EmailService
from app.services.entitlement_service import sync_org_from_entitlement_row
from app.services.jurisdiction_context_service import build_session_payload
from app.services.stripe_entitlement_utils import evaluate_access, utcnow
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

MAGIC_TTL_MINUTES = 15
PURPOSE_ACTIVATE = "activate"
PURPOSE_BILLING_APPROVAL = "billing_approval"


def _hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _public_app_url() -> str:
    return (settings.WW360_PUBLIC_APP_URL or f"https://{settings.APP_DOMAIN}").rstrip("/")


def request_magic_link(
    db: Session,
    *,
    email: str,
    purpose: str = PURPOSE_ACTIVATE,
) -> dict[str, Any]:
    """Create hashed magic token + 6-digit OTP. Always returns anti-enumeration 200 shape."""
    normalized = (email or "").strip().lower()
    if not normalized or "@" not in normalized:
        return {"ok": True, "message": "If that email is eligible, a code was sent."}

    raw_token = secrets.token_urlsafe(32)
    otp = f"{secrets.randbelow(1_000_000):06d}"
    expires = utcnow() + timedelta(minutes=MAGIC_TTL_MINUTES)
    row = AuthMagicToken(
        id=str(uuid.uuid4()),
        email=normalized,
        token_hash=_hash_secret(raw_token),
        otp_code_hash=_hash_secret(otp),
        purpose=purpose,
        expires_at=expires,
    )
    db.add(row)
    db.commit()

    activate_url = f"{_public_app_url()}/activate?token={raw_token}&email={normalized}"
    subject = "Your Water Workforce 360 activation code"
    body = (
        f"Your one-time code is {otp} (expires in {MAGIC_TTL_MINUTES} minutes).\n\n"
        f"Or open this link once: {activate_url}\n\n"
        f"If you did not request this, ignore this email.\n"
    )
    try:
        EmailService().send_email(
            to_emails=[normalized], subject=subject, body_text=body
        )
    except Exception as exc:
        logger.warning("Magic-link email failed for %s: %s", normalized, exc)

    # Include otp/token only when email disabled (local/dev/tests).
    out: dict[str, Any] = {"ok": True, "message": "If that email is eligible, a code was sent."}
    if not settings.EMAIL_ENABLED:
        out["dev_token"] = raw_token
        out["dev_otp"] = otp
    return out


def verify_magic_link(
    db: Session,
    *,
    email: str | None = None,
    token: str | None = None,
    otp: str | None = None,
) -> dict[str, Any]:
    """Consume a single-use magic token or OTP; return a short-lived activate session JWT claim."""
    now = utcnow()
    row: AuthMagicToken | None = None
    if token:
        row = (
            db.query(AuthMagicToken)
            .filter(AuthMagicToken.token_hash == _hash_secret(token))
            .first()
        )
    elif otp and email:
        candidates = (
            db.query(AuthMagicToken)
            .filter(
                AuthMagicToken.email == email.strip().lower(),
                AuthMagicToken.consumed_at.is_(None),
                AuthMagicToken.expires_at >= now,
                AuthMagicToken.purpose == PURPOSE_ACTIVATE,
            )
            .order_by(AuthMagicToken.created_at.desc())
            .limit(5)
            .all()
        )
        otp_hash = _hash_secret(otp.strip())
        for c in candidates:
            if c.otp_code_hash and hmac.compare_digest(c.otp_code_hash, otp_hash):
                row = c
                break
    if not row or row.consumed_at is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired code")
    if row.expires_at < now:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Code expired")

    row.consumed_at = now
    db.commit()

    # Mint a lightweight activate proof (not a full login until claim).
    proof = mint_ww360_token(
        {
            "user_id": 0,
            "username": f"activate:{row.email}",
            "email": row.email,
            "roles": ["activate_pending"],
            "district_memberships": [],
            "activate_email": row.email,
            "activate_verified": True,
        },
        expire_minutes=60,
    )
    return {
        "ok": True,
        "email": row.email,
        "activate_token": proof,
        "entitlement_match": _lookup_entitlement_by_email(db, row.email),
    }


def _lookup_entitlement_by_email(db: Session, email: str) -> dict[str, Any] | None:
    row = (
        db.query(OwwStripeEntitlement)
        .filter(OwwStripeEntitlement.billing_email == email.strip().lower())
        .first()
    )
    if not row:
        return None
    access = evaluate_access(
        row.status, grace_until=row.grace_until, current_period_end=row.current_period_end
    )
    return {
        "stripe_customer_id": row.stripe_customer_id,
        "status": access["status"],
        "access_mode": access["access_mode"],
        "allows_write": access["allows_write"],
        "customer_name": row.customer_name,
        "org_code": row.org_code,
        "matched": True,
    }


def _lookup_checkout_session(session_id: str) -> dict[str, Any] | None:
    key = (settings.OWW_STRIPE_RESTRICTED_KEY or "").strip()
    if not key or not session_id.startswith("cs_"):
        return None
    try:
        import stripe

        stripe.api_key = key
        sess = stripe.checkout.Session.retrieve(session_id)
        return {
            "customer_id": sess.get("customer") if isinstance(sess, dict) else getattr(sess, "customer", None),
            "customer_email": (
                sess.get("customer_email")
                if isinstance(sess, dict)
                else getattr(sess, "customer_email", None)
            ),
            "subscription": (
                sess.get("subscription")
                if isinstance(sess, dict)
                else getattr(sess, "subscription", None)
            ),
        }
    except Exception as exc:
        logger.warning("Checkout session lookup failed: %s", exc)
        return None


def claim_org(
    db: Session,
    *,
    email: str,
    full_name: str | None = None,
    username: str | None = None,
    password: str | None = None,
    session_id: str | None = None,
    org_name: str | None = None,
    state_code: str = "NY",
) -> dict[str, Any]:
    """Atomically claim a Stripe entitlement row and provision org + district_admin user."""
    email_n = email.strip().lower()
    ent: OwwStripeEntitlement | None = None

    if session_id:
        sess = _lookup_checkout_session(session_id)
        if sess and sess.get("customer_id"):
            ent = (
                db.query(OwwStripeEntitlement)
                .filter(OwwStripeEntitlement.stripe_customer_id == str(sess["customer_id"]))
                .with_for_update()
                .first()
            )
            if ent is None:
                # Create placeholder from checkout if webhook hasn't landed yet.
                ent = OwwStripeEntitlement(
                    id=str(uuid.uuid4()),
                    stripe_customer_id=str(sess["customer_id"]),
                    stripe_subscription_id=str(sess["subscription"]) if sess.get("subscription") else None,
                    billing_email=(sess.get("customer_email") or email_n).strip().lower(),
                    status="active",
                )
                db.add(ent)
                db.flush()

    if ent is None:
        ent = (
            db.query(OwwStripeEntitlement)
            .filter(OwwStripeEntitlement.billing_email == email_n)
            .with_for_update()
            .first()
        )

    if ent is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={
                "code": "entitlement_not_found",
                "message": (
                    "No matching OWW membership for this email. "
                    "If your town treasurer pays the invoice, request a billing-email link."
                ),
            },
        )

    access = evaluate_access(
        ent.status, grace_until=ent.grace_until, current_period_end=ent.current_period_end
    )
    if not access["allows_write"] and access["access_mode"] not in ("full", "grace"):
        if access["access_mode"] != "readonly":
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                detail={"code": "payment_required", "status": access["status"]},
            )

    # Already claimed?
    if ent.org_code:
        org = (
            db.query(WorkforceOrganization)
            .filter(WorkforceOrganization.org_code == ent.org_code)
            .first()
        )
        user = _ensure_user(
            db,
            email=email_n,
            full_name=full_name,
            username=username,
            password=password,
            org_code=ent.org_code,
        )
        payload = build_session_payload(db, user)
        token = mint_ww360_token(payload)
        return {
            "ok": True,
            "already_claimed": True,
            "org_code": ent.org_code,
            "access_token": token,
            "user": _user_dict(user, payload),
            "next": "/district/users",
        }

    org_code = f"OWW_{ent.stripe_customer_id[-12:]}".upper().replace("-", "")
    # Avoid collisions
    existing = db.query(WorkforceOrganization).filter(WorkforceOrganization.org_code == org_code).first()
    if existing:
        org_code = f"OWW_{uuid.uuid4().hex[:10].upper()}"

    org = WorkforceOrganization(
        org_code=org_code,
        name=org_name or ent.customer_name or f"OWW Utility {org_code}",
        org_type="utility",
        state_code=(state_code or "NY").upper()[:2],
        contact_email=email_n,
        contact_name=full_name,
        stripe_customer_id=ent.stripe_customer_id,
        stripe_subscription_id=ent.stripe_subscription_id,
        entitlement_status=str(access["status"]),
        entitlement_source="stripe",
        current_period_end=ent.current_period_end,
        grace_until=ent.grace_until,
        seat_limit=ent.seat_limit,
        is_active=True,
    )
    db.add(org)
    db.flush()

    ent.org_code = org_code
    sync_org_from_entitlement_row(db, ent)

    user = _ensure_user(
        db,
        email=email_n,
        full_name=full_name,
        username=username,
        password=password,
        org_code=org_code,
        roles=["district_admin"],
    )
    # Org membership
    if not (
        db.query(OrganizationUserMembership)
        .filter(
            OrganizationUserMembership.user_id == user.id,
            OrganizationUserMembership.org_code == org_code,
        )
        .first()
    ):
        db.add(
            OrganizationUserMembership(
                id=str(uuid.uuid4()),
                user_id=user.id,
                org_code=org_code,
                role="district_admin",
            )
        )
    db.commit()
    db.refresh(user)

    payload = build_session_payload(db, user)
    token = mint_ww360_token(payload)
    return {
        "ok": True,
        "already_claimed": False,
        "org_code": org_code,
        "access_token": token,
        "user": _user_dict(user, payload),
        "next": "/activate?step=pwsid",
    }


def _ensure_user(
    db: Session,
    *,
    email: str,
    full_name: str | None,
    username: str | None,
    password: str | None,
    org_code: str,
    roles: list[str] | None = None,
) -> User:
    user = db.query(User).filter(User.email.ilike(email)).first()
    if user:
        roles_set = set(user.roles or [])
        for r in roles or ["district_admin"]:
            roles_set.add(r)
        user.roles = list(roles_set)
        if full_name and not user.full_name:
            user.full_name = full_name
        if password and not user.hashed_password:
            user.hashed_password = get_password_hash(password)
        db.flush()
        return user

    base_username = (username or email.split("@")[0] or "user").strip().lower()[:40]
    candidate = base_username
    n = 1
    while db.query(User).filter(User.username == candidate).first():
        candidate = f"{base_username}{n}"
        n += 1
    user = User(
        username=candidate,
        email=email,
        full_name=full_name,
        roles=roles or ["district_admin"],
        district_memberships=[],
        is_active=True,
        hashed_password=get_password_hash(password) if password else get_password_hash(secrets.token_urlsafe(16)),
    )
    db.add(user)
    db.flush()
    return user


def _user_dict(user: User, payload: dict) -> dict[str, Any]:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "roles": list(payload.get("roles") or user.roles or []),
        "districts": list(payload.get("district_memberships") or user.district_memberships or []),
        "active_state_code": payload.get("active_state_code"),
        "active_org_code": payload.get("active_org_code"),
        "is_national_admin": payload.get("is_national_admin"),
        "orgs": payload.get("orgs") or [],
    }


def request_billing_link(
    db: Session,
    *,
    requester_email: str,
    billing_email: str | None = None,
    pwsid: str | None = None,
    state_code: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    """Anti-enumeration billing mismatch / PWSID link request."""
    req_email = requester_email.strip().lower()
    bill = (billing_email or "").strip().lower() or None
    # Never reveal whether billing_email exists in Stripe.
    generic = {
        "ok": True,
        "message": (
            "If we can match your request, the billing contact or a platform admin "
            "will receive an approval link shortly."
        ),
    }
    if not req_email or "@" not in req_email:
        return generic

    ent = None
    if bill:
        ent = (
            db.query(OwwStripeEntitlement)
            .filter(OwwStripeEntitlement.billing_email == bill)
            .first()
        )

    approval_raw = secrets.token_urlsafe(24)
    link_req = OrgLinkRequest(
        id=str(uuid.uuid4()),
        requester_email=req_email,
        billing_email=bill,
        stripe_customer_id=ent.stripe_customer_id if ent else None,
        org_code=ent.org_code if ent else None,
        pwsid=(pwsid or "").strip().upper() or None,
        state_code=(state_code or "").upper()[:2] or None,
        request_type="billing_mismatch" if bill else "pwsid_claim",
        status="pending",
        approval_token_hash=_hash_secret(approval_raw),
        notes=notes,
    )
    db.add(link_req)
    db.commit()

    if ent and bill:
        approve_url = (
            f"{_public_app_url()}/activate?approve_link={approval_raw}&request_id={link_req.id}"
        )
        try:
            EmailService().send_email(
                to_emails=[bill],
                subject="Approve WW360 access for your utility",
                body_text=(
                    f"{req_email} requested access to Water Workforce 360\nfor your OWW membership.\n\n"
                    f"Approve (one click): {approve_url}\n\n"
                    f"If you do not recognize this request, ignore this email.\n"
                ),
            )
        except Exception as exc:
            logger.warning("Billing approval email failed: %s", exc)
    else:
        # Platform admin queue — email configured access inbox when present.
        try:
            to_addr = settings.WW360_ACCESS_REQUEST_TO
            if to_addr:
                EmailService().send_email(
                    to_emails=[to_addr],
                    subject="WW360 org link request (platform queue)",
                    body_text=(
                        f"Requester: {req_email}\nBilling email: {bill}\n"
                        f"PWSID: {pwsid}\nState: {state_code}\nNotes: {notes}\n"
                        f"Request id: {link_req.id}\n"
                    ),
                )
        except Exception as exc:
            logger.warning("Platform queue email failed: %s", exc)

    if not settings.EMAIL_ENABLED:
        generic["dev_approval_token"] = approval_raw
        generic["dev_request_id"] = link_req.id
    return generic


def approve_link_request(
    db: Session,
    *,
    request_id: str,
    approval_token: str,
    approver_user_id: int | None = None,
) -> dict[str, Any]:
    row = db.query(OrgLinkRequest).filter(OrgLinkRequest.id == request_id).first()
    if not row or not row.approval_token_hash:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    if not hmac.compare_digest(row.approval_token_hash, _hash_secret(approval_token)):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid approval token")
    if row.status != "pending":
        return {"ok": True, "status": row.status}

    # Bind entitlement billing email match → claim path for requester
    if row.stripe_customer_id:
        ent = (
            db.query(OwwStripeEntitlement)
            .filter(OwwStripeEntitlement.stripe_customer_id == row.stripe_customer_id)
            .with_for_update()
            .first()
        )
        if ent and not ent.org_code:
            # Allow requester email to claim (temporarily mirror billing email for match)
            # Prefer keeping billing_email; store note instead and claim via customer id.
            pass

    row.status = "approved"
    row.decided_at = utcnow()
    row.decided_by_user_id = approver_user_id
    db.commit()

    # Auto-claim for requester when Stripe customer known
    if row.stripe_customer_id:
        result = claim_org(
            db,
            email=row.requester_email,
            session_id=None,
            org_name=None,
            state_code=row.state_code or "NY",
        )
        # Force customer match
        ent = (
            db.query(OwwStripeEntitlement)
            .filter(OwwStripeEntitlement.stripe_customer_id == row.stripe_customer_id)
            .with_for_update()
            .first()
        )
        if ent and not ent.org_code:
            # claim_org matched by email; if that failed path, claim with forced customer
            return claim_org_for_customer(
                db,
                email=row.requester_email,
                stripe_customer_id=row.stripe_customer_id,
                state_code=row.state_code or "NY",
            )
        return result

    return {"ok": True, "status": "approved", "next": "/activate"}


def claim_org_for_customer(
    db: Session,
    *,
    email: str,
    stripe_customer_id: str,
    full_name: str | None = None,
    state_code: str = "NY",
) -> dict[str, Any]:
    ent = (
        db.query(OwwStripeEntitlement)
        .filter(OwwStripeEntitlement.stripe_customer_id == stripe_customer_id)
        .with_for_update()
        .first()
    )
    if not ent:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entitlement not found")
    # Temporarily set billing email so claim_org email path works, then restore.
    original = ent.billing_email
    ent.billing_email = email.strip().lower()
    db.flush()
    try:
        return claim_org(
            db,
            email=email,
            full_name=full_name,
            state_code=state_code,
        )
    finally:
        if original and original != email.strip().lower():
            ent.billing_email = original
            db.commit()


def link_district_pwsid(
    db: Session,
    *,
    org_code: str,
    user: User,
    pwsid: str,
    state_code: str,
    district_name: str | None = None,
) -> dict[str, Any]:
    """Link SDWIS PWSID to org via district membership; queue on conflict."""
    pid = pwsid.strip().upper()
    st = state_code.strip().upper()[:2]
    if not pid or not st:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "pwsid and state_code required")

    # Prefer existing water_districts with matching district_code == pwsid convention
    district = (
        db.query(WaterDistrict)
        .filter(WaterDistrict.district_code == pid)
        .first()
    )
    if district is None:
        # Check remembered / name-based: create a local district shell for onboarding.
        district = WaterDistrict(
            district_code=pid,
            district_name=district_name or f"PWS {pid}",
            state_code=st,
            is_active=True,
        )
        db.add(district)
        db.flush()
    elif district.state_code and district.state_code.upper() != st:
        # Conflict — queue for platform_admin
        req = OrgLinkRequest(
            id=str(uuid.uuid4()),
            requester_email=(user.email or "").lower(),
            requester_user_id=user.id,
            org_code=org_code,
            pwsid=pid,
            state_code=st,
            request_type="pwsid_conflict",
            status="pending",
            notes=f"Existing district state={district.state_code}",
        )
        db.add(req)
        db.commit()
        return {
            "ok": False,
            "queued": True,
            "code": "pwsid_conflict",
            "message": ("This PWSID is already linked under another state. "
                "A platform admin will review."),
            "request_id": req.id,
        }

    existing_membership = (
        db.query(OrganizationDistrictMembership)
        .filter(
            OrganizationDistrictMembership.org_code == org_code,
            OrganizationDistrictMembership.district_code == pid,
        )
        .first()
    )
    if not existing_membership:
        # Another org already owns this district?
        other = (
            db.query(OrganizationDistrictMembership)
            .filter(OrganizationDistrictMembership.district_code == pid)
            .first()
        )
        if other and other.org_code != org_code:
            req = OrgLinkRequest(
                id=str(uuid.uuid4()),
                requester_email=(user.email or "").lower(),
                requester_user_id=user.id,
                org_code=org_code,
                pwsid=pid,
                state_code=st,
                request_type="pwsid_conflict",
                status="pending",
                notes=f"Already linked to org {other.org_code}",
            )
            db.add(req)
            db.commit()
            return {
                "ok": False,
                "queued": True,
                "code": "pwsid_conflict",
                "message": ("This PWSID is claimed by another organization. "
                    "Queued for platform admin merge."),
                "request_id": req.id,
            }
        db.add(
            OrganizationDistrictMembership(
                id=str(uuid.uuid4()),
                org_code=org_code,
                district_code=pid,
                workforce_package_enabled=True,
            )
        )

    # Attach district to user
    districts = list(user.district_memberships or [])
    if pid not in districts:
        districts.append(pid)
        user.district_memberships = districts
        roles = set(user.roles or [])
        roles.add("district_admin")
        user.roles = list(roles)

    db.commit()
    return {
        "ok": True,
        "district_code": pid,
        "org_code": org_code,
        "next": "/district/users",
    }
