"""Microsoft / Google SSO for WW360 login, seeding Document Studio library tokens.

Uses the same OAuth apps as Document Studio external libraries (`DOC_STUDIO_MS_*`,
`DOC_STUDIO_GOOGLE_*`) so a single consent grants identity + drive access. Tokens
are stored on `DocLibraryConnection` for the user's Studio scope.
"""

from __future__ import annotations

import logging
import os
import urllib.parse
from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.doc_document import program_scope_for_state
from app.models.user import User
from app.services.auth_service import mint_ww360_token
from app.services.doc_studio_library_constants import resolve_owner
from app.services.doc_studio_service import resolve_scope
from app.services.external_library_provider import ExternalLibraryService
from app.services.jurisdiction_context_service import build_session_payload
from app.tenant_auth import TenantContext

logger = logging.getLogger(__name__)

PROVIDER_MICROSOFT = "microsoft_graph"
PROVIDER_GOOGLE = "google_drive"

SSO_PROVIDERS = (PROVIDER_MICROSOFT, PROVIDER_GOOGLE)

# Identity + drive scopes so login tokens work for External library / custody.
MS_SSO_SCOPES = (
    "openid profile email offline_access User.Read Files.ReadWrite.All Sites.Read.All"
)
GOOGLE_SSO_SCOPES = (
    "openid email profile "
    "https://www.googleapis.com/auth/drive.readonly "
    "https://www.googleapis.com/auth/drive.file"
)


def _ms_client_id() -> str:
    return (
        os.getenv("AUTH_SSO_MS_CLIENT_ID")
        or os.getenv("DOC_STUDIO_MS_CLIENT_ID")
        or os.getenv("EMAIL_CLIENT_ID")
        or ""
    )


def _ms_client_secret() -> str:
    return (
        os.getenv("AUTH_SSO_MS_CLIENT_SECRET")
        or os.getenv("DOC_STUDIO_MS_CLIENT_SECRET")
        or os.getenv("EMAIL_CLIENT_SECRET")
        or ""
    )


def _ms_tenant() -> str:
    return (
        os.getenv("AUTH_SSO_MS_TENANT_ID")
        or os.getenv("DOC_STUDIO_MS_TENANT_ID")
        or os.getenv("EMAIL_TENANT_ID")
        or "common"
    )


def _google_client_id() -> str:
    return os.getenv("AUTH_SSO_GOOGLE_CLIENT_ID") or os.getenv("DOC_STUDIO_GOOGLE_CLIENT_ID") or ""


def _google_client_secret() -> str:
    return (
        os.getenv("AUTH_SSO_GOOGLE_CLIENT_SECRET")
        or os.getenv("DOC_STUDIO_GOOGLE_CLIENT_SECRET")
        or ""
    )


def sso_redirect_uri(frontend_origin: str | None = None) -> str:
    """Default OAuth return path is the login page (handles ?code=)."""
    explicit = os.getenv("AUTH_SSO_REDIRECT_URI") or os.getenv("DOC_STUDIO_SSO_REDIRECT_URI")
    if explicit:
        return explicit.rstrip("/")
    if frontend_origin:
        return f"{frontend_origin.rstrip('/')}/login"
    domain = os.getenv("APP_DOMAIN") or "ww360.aquasafe-solutions.us"
    scheme = "http" if domain.startswith("localhost") or domain.startswith("127.") else "https"
    return f"{scheme}://{domain}/login"


def provider_configured(provider: str) -> bool:
    if provider == PROVIDER_MICROSOFT:
        return bool(_ms_client_id() and _ms_client_secret())
    if provider == PROVIDER_GOOGLE:
        return bool(_google_client_id() and _google_client_secret())
    return False


def list_configured_providers() -> list[dict[str, str]]:
    labels = {
        PROVIDER_MICROSOFT: "Microsoft",
        PROVIDER_GOOGLE: "Google",
    }
    return [
        {"id": p, "label": labels[p]}
        for p in SSO_PROVIDERS
        if provider_configured(p)
    ]


def build_sso_auth_url(provider: str, redirect_uri: str, state: str) -> str:
    if provider not in SSO_PROVIDERS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unsupported SSO provider: {provider}")
    if not provider_configured(provider):
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            f"SSO provider {provider} is not configured",
        )
    if provider == PROVIDER_MICROSOFT:
        client_id = urllib.parse.quote(_ms_client_id())
        tenant = urllib.parse.quote(_ms_tenant())
        scopes = urllib.parse.quote(MS_SSO_SCOPES)
        redir = urllib.parse.quote(redirect_uri, safe="")
        st = urllib.parse.quote(state, safe="")
        return (
            f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize"
            f"?client_id={client_id}&response_type=code&redirect_uri={redir}"
            f"&scope={scopes}&state={st}&response_mode=query"
        )
    client_id = urllib.parse.quote(_google_client_id())
    scopes = urllib.parse.quote(GOOGLE_SSO_SCOPES)
    redir = urllib.parse.quote(redirect_uri, safe="")
    st = urllib.parse.quote(state, safe="")
    return (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={client_id}&response_type=code&redirect_uri={redir}"
        f"&scope={scopes}&access_type=offline&prompt=consent&state={st}"
    )


async def exchange_sso_code(provider: str, code: str, redirect_uri: str) -> dict[str, Any]:
    if provider == PROVIDER_MICROSOFT:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"https://login.microsoftonline.com/{_ms_tenant()}/oauth2/v2.0/token",
                data={
                    "client_id": _ms_client_id(),
                    "client_secret": _ms_client_secret(),
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                    "scope": MS_SSO_SCOPES,
                },
            )
            if resp.status_code >= 400:
                logger.warning("MS SSO token exchange failed: %s", resp.text[:500])
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Microsoft sign-in failed")
            return resp.json()

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": _google_client_id(),
                "client_secret": _google_client_secret(),
                "code": code,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if resp.status_code >= 400:
            logger.warning("Google SSO token exchange failed: %s", resp.text[:500])
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Google sign-in failed")
        return resp.json()


async def fetch_sso_profile(provider: str, access_token: str) -> dict[str, str]:
    """Return email, full_name, subject from the IdP."""
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        if provider == PROVIDER_MICROSOFT:
            resp = await client.get("https://graph.microsoft.com/v1.0/me", headers=headers)
            resp.raise_for_status()
            data = resp.json()
            email = (
                data.get("mail")
                or data.get("userPrincipalName")
                or data.get("otherMails", [None])[0]
                or ""
            )
            return {
                "email": str(email).strip().lower(),
                "full_name": (data.get("displayName") or "").strip(),
                "subject": str(data.get("id") or ""),
            }

        resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "email": str(data.get("email") or "").strip().lower(),
            "full_name": (data.get("name") or "").strip(),
            "subject": str(data.get("sub") or ""),
        }


def find_user_for_sso(db: Session, email: str, subject: str | None = None) -> User:
    if not email:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "SSO provider did not return an email address",
        )
    user = (
        db.query(User)
        .filter(User.email.isnot(None))
        .filter(User.email.ilike(email))
        .first()
    )
    if not user and subject:
        # Prefer subject match when email columns were never populated.
        user = (
            db.query(User)
            .filter(User.sso_provider.isnot(None), User.sso_subject == subject)
            .first()
        )
    if not user or not user.is_active:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "No active WW360 account matches this email. Ask an administrator to invite you.",
        )
    return user


def studio_scope_for_user(user: User) -> str:
    """Mirror DocStudioService.resolve_scope without a full TenantContext yet."""
    roles = set(user.roles or [])
    districts = list(user.district_memberships or [])
    if "platform_admin" in roles or "oww_partner" in roles or "state_admin" in roles:
        return program_scope_for_state("NY")
    if districts:
        return districts[0]
    return program_scope_for_state("NY")


def seed_library_connection_from_sso(
    db: Session,
    *,
    user: User,
    provider: str,
    token_payload: dict[str, Any],
    account_email: str | None,
) -> None:
    """Upsert DocLibraryConnection so Studio can use the SSO tokens for drives."""
    scope = studio_scope_for_user(user)
    # Validate against resolve_scope rules for consistency.
    context = TenantContext(
        user_id=user.id,
        username=user.username,
        email=user.email,
        roles=list(user.roles or []),
        assigned_districts=list(user.district_memberships or []),
        is_system_admin="platform_admin" in set(user.roles or []),
    )
    try:
        scope = resolve_scope(context, scope)
    except HTTPException:
        scope = studio_scope_for_user(user)
    owner_type, owner_code = resolve_owner(scope)
    labels = {
        PROVIDER_MICROSOFT: "Microsoft (SSO)",
        PROVIDER_GOOGLE: "Google (SSO)",
    }
    conn = ExternalLibraryService(db).save_connection(
        owner_type,
        owner_code,
        provider,
        token_payload,
        connected_by=user.id,
        account_email=account_email,
    )
    conn.display_name = labels.get(provider, provider)
    conn.scopes = (
        MS_SSO_SCOPES if provider == PROVIDER_MICROSOFT else GOOGLE_SSO_SCOPES
    )
    db.commit()


async def complete_sso_login(
    db: Session,
    *,
    provider: str,
    code: str,
    redirect_uri: str,
) -> dict[str, Any]:
    if provider not in SSO_PROVIDERS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unsupported SSO provider: {provider}")

    tokens = await exchange_sso_code(provider, code, redirect_uri)
    access = tokens.get("access_token")
    if not access:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "SSO token response missing access_token")

    profile = await fetch_sso_profile(provider, access)
    user = find_user_for_sso(db, profile["email"], profile.get("subject"))

    # Persist SSO linkage for future subject-based match.
    if hasattr(user, "sso_provider"):
        user.sso_provider = provider
        user.sso_subject = profile.get("subject") or user.sso_subject
        if not user.email and profile.get("email"):
            user.email = profile["email"]
        if not user.full_name and profile.get("full_name"):
            user.full_name = profile["full_name"]
        db.commit()
        db.refresh(user)

    try:
        seed_library_connection_from_sso(
            db,
            user=user,
            provider=provider,
            token_payload=tokens,
            account_email=profile.get("email") or user.email,
        )
    except Exception:
        logger.exception("SSO login succeeded but library token seed failed for user %s", user.id)

    payload = build_session_payload(db, user)
    token = mint_ww360_token(payload)
    return {
        "access_token": token,
        "token_type": "bearer",
        "library_provider": provider,
        "library_linked": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "roles": list(payload.get("roles") or []),
            "districts": payload.get("district_memberships") or [],
            "active_state_code": payload.get("active_state_code"),
            "active_org_code": payload.get("active_org_code"),
            "is_national_admin": payload.get("is_national_admin"),
            "orgs": payload.get("orgs") or [],
        },
    }
