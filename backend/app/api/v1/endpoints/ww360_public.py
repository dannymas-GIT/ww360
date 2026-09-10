"""Public Workforce 360 landing endpoints (no auth)."""

from __future__ import annotations

import html
import logging
import os
import time
from collections import defaultdict
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field

from app.services.email_service import EmailService

logger = logging.getLogger(__name__)
router = APIRouter()

# Simple in-process rate limit: IP → timestamps (best-effort on multi-worker).
_RATE: dict[str, list[float]] = defaultdict(list)
_RATE_WINDOW_S = 600
_RATE_MAX = 8

_DEFAULT_TO = "dmas@omnitech-solutions.us"
_LOGO_URL = "https://waterworkforce360.org/workforce-360-logo.png"


class AccessRequestBody(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    organization: str = Field(..., min_length=2, max_length=200)
    phone: str = Field("", max_length=40)
    title: str = Field("", max_length=120)
    message: str = Field("", max_length=2000)
    # Honeypot — bots fill this; humans leave empty.
    company_website: str = Field("", max_length=200)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for") or ""
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    if request.client:
        return request.client.host or "unknown"
    return "unknown"


def _rate_ok(ip: str) -> bool:
    now = time.time()
    bucket = [t for t in _RATE[ip] if now - t < _RATE_WINDOW_S]
    _RATE[ip] = bucket
    if len(bucket) >= _RATE_MAX:
        return False
    bucket.append(now)
    return True


def build_access_request_email(payload: AccessRequestBody) -> tuple[str, str, str]:
    """Return (subject, html, text) for a Workforce 360 access request."""
    safe = {
        "full_name": html.escape(payload.full_name.strip()),
        "email": html.escape(str(payload.email).strip()),
        "organization": html.escape(payload.organization.strip()),
        "phone": html.escape((payload.phone or "").strip()) or "—",
        "title": html.escape((payload.title or "").strip()) or "—",
        "message": html.escape((payload.message or "").strip()) or "—",
    }
    subject = f"Workforce 360 access request — {payload.organization.strip()}"

    html_body = f"""\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{html.escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#eef3f9;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #d7e2f0;">
          <tr>
            <td style="background:#07111f;padding:28px 32px;text-align:left;">
              <img src="{_LOGO_URL}" alt="Workforce 360" width="220" style="display:block;width:220px;max-width:70%;height:auto;border:0;" />
              <p style="margin:16px 0 0;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#38bdf8;font-weight:600;">
                District access request
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0f172a;font-weight:700;">
                New request from waterworkforce360.org
              </h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#475569;">
                Someone submitted the Workforce 360 access form. Review the details below and follow up with the district contact.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d7e2f0;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:14px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;width:34%;font-size:13px;color:#64748b;font-weight:600;">Full name</td>
                  <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-size:15px;color:#0f172a;">{safe["full_name"]}</td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;font-weight:600;">Email</td>
                  <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-size:15px;color:#0f172a;">
                    <a href="mailto:{safe["email"]}" style="color:#2563eb;text-decoration:none;">{safe["email"]}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;font-weight:600;">Organization / district</td>
                  <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-size:15px;color:#0f172a;">{safe["organization"]}</td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;font-weight:600;">Title / role</td>
                  <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-size:15px;color:#0f172a;">{safe["title"]}</td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;font-weight:600;">Phone</td>
                  <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-size:15px;color:#0f172a;">{safe["phone"]}</td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;background:#f8fafc;font-size:13px;color:#64748b;font-weight:600;vertical-align:top;">Message</td>
                  <td style="padding:14px 16px;font-size:15px;color:#0f172a;line-height:1.5;white-space:pre-wrap;">{safe["message"]}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px;">
              <p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">
                Reply directly to the requester at
                <a href="mailto:{safe["email"]}" style="color:#2563eb;text-decoration:none;">{safe["email"]}</a>.
                This message was generated by the Workforce 360 public landing page.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#07111f;padding:18px 32px;text-align:left;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.45;">
                Workforce 360 · Powered by AquaSafe · Partnered with One Water Workforce<br />
                <a href="https://waterworkforce360.org" style="color:#38bdf8;text-decoration:none;">waterworkforce360.org</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    text_body = (
        "Workforce 360 — District access request\n"
        "=====================================\n\n"
        f"Full name: {payload.full_name.strip()}\n"
        f"Email: {payload.email}\n"
        f"Organization / district: {payload.organization.strip()}\n"
        f"Title / role: {(payload.title or '').strip() or '—'}\n"
        f"Phone: {(payload.phone or '').strip() or '—'}\n"
        f"Message:\n{(payload.message or '').strip() or '—'}\n\n"
        "Source: https://waterworkforce360.org/#request-access\n"
    )
    return subject, html_body, text_body


from app.services.jurisdiction_service import JurisdictionPack, load_pack, pack_summary


@router.get("/jurisdictions/{state_code}/pack", response_model=JurisdictionPack)
def public_jurisdiction_pack(state_code: str) -> JurisdictionPack:
    """Public marketing copy pack for a state (landing page)."""
    return load_pack(state_code)


@router.get("/jurisdictions/{state_code}/summary")
def public_jurisdiction_summary(state_code: str) -> dict:
    return pack_summary(state_code)


@router.post("/access-request")
def submit_access_request(body: AccessRequestBody, request: Request) -> Any:
    """Accept a public district access request and email the partnership inbox."""
    if (body.company_website or "").strip():
        # Silent success for bots.
        return {"ok": True, "sent": False, "previewHtml": None}

    ip = _client_ip(request)
    if not _rate_ok(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
        )

    subject, html_body, text_body = build_access_request_email(body)
    to_email = (
        os.getenv("WW360_ACCESS_REQUEST_TO")
        or os.getenv("WW360_LEAD_EMAIL")
        or _DEFAULT_TO
    ).strip()

    mailer = EmailService()
    # Access leads should still attempt SMTP when credentials exist, even if
    # the global EMAIL_ENABLED flag is off (common on staging).
    was_enabled = mailer.enabled
    if not was_enabled and (mailer.smtp_user and mailer.smtp_password):
        mailer.enabled = True
        logger.info("WW360 access request: temporarily enabling SMTP for lead email")

    sent = mailer.send_email(
        to_emails=[to_email],
        subject=subject,
        body_html=html_body,
        body_text=text_body,
    )
    mailer.enabled = was_enabled

    if not sent:
        logger.warning(
            "WW360 access request email not sent (to=%s, from=%s). Returning preview.",
            to_email,
            body.email,
        )

    return {
        "ok": True,
        "sent": bool(sent),
        "to": to_email,
        "previewHtml": html_body,
    }
