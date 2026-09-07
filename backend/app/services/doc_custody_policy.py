"""Document custody policy — Water Workforce 360 / utility libraries."""

from __future__ import annotations

CUSTODY_POLICY_VERSION = "2026-09-06-ww360-v1"

MAX_TRANSFER_DOCUMENTS = 50
MAX_TRANSFER_BYTES = 500 * 1024 * 1024  # 500 MB per transfer batch

CUSTODY_POLICY_MARKDOWN = """# Water Workforce 360 Document Data Custody Policy

**Version:** {version}  
**Effective:** September 6, 2026

## 1. Purpose

This policy governs how Document Studio materials (Workforce & succession, Compliance,
Operations, and similar utility- or program-owned content) are stored, transferred, and
retained when using Water Workforce 360 on behalf of a water utility or the One Water
Workforce program.

**Working tutorials, shift logs, and templates** remain in WW360 and are **not** eligible
for custody transfer.

## 2. Temporary working copies

Documents created or edited in Document Studio are **temporary working copies** intended
to support planning and documentation during an engagement. For eligible materials, WW360
is **not** the long-term system of record after a verified custody transfer.

## 3. Custodial responsibility

After transfer to your connected cloud storage (OneDrive, Google Drive, Dropbox,
SharePoint, or equivalent):

- **You** (the utility or program organization) are solely responsible for backup, retention,
  access control, and regulatory compliance of the transferred documents.
- Water Workforce 360 **does not warrant** continued availability, integrity, or recoverability
  of document content after verified transfer and the applicable retention window.

## 4. Transfer and verification

Before transfer, an authorized representative must acknowledge this policy. Only eligible
folders (Workforce & succession, Compliance, Operations) may be transferred. Transferred
files are checksum-verified at upload. Confirm receipt in your external library before the
retention window expires.

## 5. Retention and purge

Following verified transfer, WW360 retains local copies for a **{retention_days}-day** grace
period (configurable per transfer). After that period, WW360 **permanently deletes** document
content and associated media from its servers. A permanent **audit record** of the transfer
(who, when, checksums, destination) is retained without document bytes.

## 6. No restoration guarantee

WW360 cannot restore purged document content. Maintain copies in your organizational storage
before the purge date.

---

*This document is provided for operational acknowledgment. It is not legal advice.*
"""

CUSTODY_ACKNOWLEDGMENT_CHECKBOX = (
    "I confirm that documents transferred to our connected storage are backed up and maintained "
    "by our {owner_label}. Water Workforce 360 retains no custodial responsibility after verified "
    "transfer and the stated retention period."
)


def render_custody_policy(retention_days: int = 30) -> str:
    return CUSTODY_POLICY_MARKDOWN.format(
        version=CUSTODY_POLICY_VERSION,
        retention_days=retention_days,
    )


def render_acknowledgment_text(owner_type: str, owner_code: str, owner_name: str) -> str:
    if owner_type == "program":
        owner_label = f"program library ({owner_name or owner_code})"
    else:
        owner_label = f"utility ({owner_name or owner_code})"
    return CUSTODY_ACKNOWLEDGMENT_CHECKBOX.format(owner_label=owner_label)
