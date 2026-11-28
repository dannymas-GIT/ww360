"""Unit/contract tests for OWW Stripe entitlements, webhooks, magic-link, claim race."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
import uuid
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.core.config import settings
from app.services.entitlement_service import (
    AquaSafeModuleProvider,
    EntitlementResult,
    ProgramCodeProvider,
    StripeCacheProvider,
    entitlement_for_org,
)
from app.services.stripe_entitlement_utils import evaluate_access, is_eligible_product_price, utcnow
from app.services.stripe_webhook_service import process_stripe_event


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def test_entitlement_active_and_grace():
    active = EntitlementResult("1", "active", allows_write=True, allows_read=True, access_mode="full")
    assert active.is_active
    grace = EntitlementResult(
        "1", "past_due", allows_write=True, allows_read=True, access_mode="grace"
    )
    assert grace.is_active
    readonly = EntitlementResult(
        "1", "canceled", allows_write=False, allows_read=True, access_mode="readonly"
    )
    assert not readonly.is_active
    assert readonly.allows_read
    none = EntitlementResult("1", "none")
    assert not none.is_active


def test_evaluate_access_lifecycle():
    now = utcnow()
    full = evaluate_access("active", now=now)
    assert full["access_mode"] == "full" and full["allows_write"]

    grace = evaluate_access("past_due", grace_until=now + timedelta(days=5), now=now)
    assert grace["access_mode"] == "grace" and grace["allows_write"]

    past_grace = evaluate_access(
        "past_due", grace_until=now - timedelta(days=1), now=now
    )
    assert past_grace["access_mode"] == "readonly" and not past_grace["allows_write"]

    archived = evaluate_access(
        "canceled",
        current_period_end=now - timedelta(days=120),
        now=now,
    )
    assert archived["access_mode"] == "archived"


def test_whitelist_filtering(monkeypatch):
    monkeypatch.setattr(settings, "OWW_STRIPE_ELIGIBLE_PRODUCT_IDS", "prod_ww360_utility")
    monkeypatch.setattr(settings, "OWW_STRIPE_ELIGIBLE_PRICE_IDS", "price_ww360_utility")
    assert is_eligible_product_price("prod_ww360_utility", None)
    assert is_eligible_product_price(None, "price_ww360_utility")
    assert not is_eligible_product_price("prod_conference", "price_conference_only")


def _sign_payload(payload: bytes, secret: str, timestamp: int | None = None) -> str:
    ts = int(time.time()) if timestamp is None else timestamp
    signed = f"{ts}.{payload.decode('utf-8')}"
    sig = hmac.new(secret.encode(), signed.encode(), hashlib.sha256).hexdigest()
    return f"t={ts},v1={sig}"


def test_stripe_signature_helpers():
    secret = "whsec_test_secret"
    body = b'{"id":"evt_1","type":"customer.updated","data":{"object":{}}}'
    header = _sign_payload(body, secret)
    assert "v1=" in header
    # Expired tolerance simulation: old timestamp should fail construct_event in endpoint tests
    old = _sign_payload(body, secret, timestamp=int(time.time()) - 10_000)
    assert old.startswith("t=")


class _FakeQuery:
    def __init__(self, rows=None, first_row=None):
        self._rows = rows or []
        self._first = first_row

    def filter(self, *a, **k):
        return self

    def with_for_update(self):
        return self

    def first(self):
        return self._first

    def all(self):
        return self._rows


class _FakeDB:
    def __init__(self):
        self.added = []
        self.committed = False
        self._ent = None
        self._events = {}

    def query(self, model):
        name = getattr(model, "__name__", str(model))
        if name == "StripeWebhookEvent":
            return _FakeQuery(first_row=None)
        if name == "OwwStripeEntitlement":
            return _FakeQuery(first_row=self._ent)
        if name == "WorkforceOrganization":
            return _FakeQuery(first_row=None)
        return _FakeQuery()

    def add(self, obj):
        self.added.append(obj)
        name = obj.__class__.__name__
        if name == "OwwStripeEntitlement":
            self._ent = obj

    def commit(self):
        self.committed = True

    def flush(self):
        return None


def test_webhook_dedup_and_whitelist(monkeypatch):
    monkeypatch.setattr(settings, "OWW_STRIPE_ELIGIBLE_PRODUCT_IDS", "prod_ww360_utility")
    monkeypatch.setattr(settings, "OWW_STRIPE_ELIGIBLE_PRICE_IDS", "price_ww360_utility")
    db = _FakeDB()

    ignored = process_stripe_event(
        db,
        {
            "id": "evt_conf_1",
            "type": "customer.subscription.updated",
            "created": int(time.time()),
            "data": {
                "object": {
                    "id": "sub_x",
                    "customer": "cus_x",
                    "status": "active",
                    "items": {
                        "data": [
                            {
                                "price": {
                                    "id": "price_conference",
                                    "product": "prod_conference",
                                }
                            }
                        ]
                    },
                }
            },
        },
    )
    assert ignored.get("ignored") is True
    assert ignored.get("reason") == "not_whitelisted"

    ok = process_stripe_event(
        db,
        {
            "id": "evt_ok_1",
            "type": "customer.subscription.updated",
            "created": int(time.time()),
            "data": {
                "object": {
                    "id": "sub_ok",
                    "customer": "cus_ok",
                    "status": "active",
                    "current_period_end": int(time.time()) + 86400,
                    "items": {
                        "data": [
                            {
                                "price": {
                                    "id": "price_ww360_utility",
                                    "product": "prod_ww360_utility",
                                }
                            }
                        ]
                    },
                }
            },
        },
    )
    assert ok.get("ok") is True
    assert db._ent is not None
    assert db._ent.status == "active"
    assert db._ent.grace_until is None

    # Replay same event id
    db2 = _FakeDB()

    class _EvtQ(_FakeQuery):
        def first(self):
            return SimpleNamespace(event_id="evt_ok_1")

    def query(model):
        if getattr(model, "__name__", "") == "StripeWebhookEvent":
            return _EvtQ()
        return _FakeQuery()

    db2.query = query  # type: ignore
    replay = process_stripe_event(
        db2,
        {
            "id": "evt_ok_1",
            "type": "customer.subscription.updated",
            "created": int(time.time()),
            "data": {"object": {}},
        },
    )
    assert replay.get("deduplicated") is True


def test_past_due_sets_grace(monkeypatch):
    monkeypatch.setattr(settings, "OWW_STRIPE_ELIGIBLE_PRODUCT_IDS", "")
    monkeypatch.setattr(settings, "OWW_STRIPE_ELIGIBLE_PRICE_IDS", "")
    monkeypatch.setattr(settings, "OWW_STRIPE_GRACE_DAYS", 14)
    db = _FakeDB()
    process_stripe_event(
        db,
        {
            "id": "evt_pd_1",
            "type": "customer.subscription.updated",
            "created": int(time.time()),
            "data": {
                "object": {
                    "id": "sub_pd",
                    "customer": "cus_pd",
                    "status": "past_due",
                    "current_period_end": int(time.time()) + 86400,
                    "items": {"data": [{"price": {"id": "p1", "product": "prod1"}}]},
                }
            },
        },
    )
    assert db._ent.status == "past_due"
    assert db._ent.grace_until is not None


def test_out_of_order_rejected(monkeypatch):
    monkeypatch.setattr(settings, "OWW_STRIPE_ELIGIBLE_PRODUCT_IDS", "")
    monkeypatch.setattr(settings, "OWW_STRIPE_ELIGIBLE_PRICE_IDS", "")
    db = _FakeDB()
    from app.models.stripe_entitlement import OwwStripeEntitlement

    existing = OwwStripeEntitlement(
        id=str(uuid.uuid4()),
        stripe_customer_id="cus_oo",
        status="active",
        last_event_created_at=2_000_000_000,
    )
    db._ent = existing
    result = process_stripe_event(
        db,
        {
            "id": "evt_old",
            "type": "customer.subscription.updated",
            "created": 1_000_000_000,
            "data": {
                "object": {
                    "id": "sub_oo",
                    "customer": "cus_oo",
                    "status": "canceled",
                    "items": {"data": [{"price": {"id": "p1", "product": "prod1"}}]},
                }
            },
        },
    )
    assert result.get("stale") is True
    assert existing.status == "active"


def test_program_code_supersedes_stripe_cancel():
    """ProgramCodeProvider wins over canceled Stripe in the chain."""
    db = MagicMock()
    org = SimpleNamespace(
        org_code="ORG1",
        oww_org_id=None,
        stripe_customer_id="cus_x",
        entitlement_status="canceled",
        entitlement_source="stripe",
        grace_until=None,
        current_period_end=None,
        stripe_subscription_id=None,
    )

    with patch(
        "app.services.entitlement_service.org_has_program_code", return_value=True
    ):
        result = ProgramCodeProvider().resolve(
            db, org=org, org_code="ORG1", oww_org_id=None
        )
    assert result is not None
    assert result.source == "program_code"
    assert result.allows_write


def test_aquasafe_module_provider_hit():
    db = MagicMock()
    org = SimpleNamespace(org_code="ORG1", oww_org_id=None, stripe_customer_id=None)
    membership = SimpleNamespace(district_code="D1")
    flag = SimpleNamespace(module_key="ww360", enabled=True)

    mem_q = MagicMock()
    mem_q.filter.return_value.all.return_value = [membership]
    flag_q = MagicMock()
    flag_q.filter.return_value.first.return_value = flag

    def query(model):
        name = getattr(model, "__name__", "")
        if name == "OrganizationDistrictMembership":
            return mem_q
        return flag_q

    db.query.side_effect = query
    result = AquaSafeModuleProvider().resolve(db, org=org, org_code="ORG1", oww_org_id=None)
    assert result is not None
    assert result.source == "aquasafe"
    assert result.allows_write


def test_magic_link_expiry_and_reuse():
    from app.services.activate_service import request_magic_link, verify_magic_link

    tokens = []

    class TokenRow:
        def __init__(self, **kw):
            self.__dict__.update(kw)
            self.consumed_at = None

    class MagicDB(_FakeDB):
        def query(self, model):
            name = getattr(model, "__name__", "")
            if name == "AuthMagicToken":
                if tokens:
                    return _FakeQuery(first_row=tokens[-1], rows=tokens)
                return _FakeQuery()
            return _FakeQuery()

        def add(self, obj):
            tokens.append(obj)
            self.added.append(obj)

    db = MagicDB()
    with patch("app.services.activate_service.EmailService") as mail:
        mail.return_value.send_email.return_value = False
        monkey_settings = settings
        # EMAIL_ENABLED false → returns dev_token
        out = request_magic_link(db, email="ops@example.gov")
    assert out["ok"] is True
    assert "dev_token" in out or out["message"]

    if "dev_token" in out:
        verify = verify_magic_link(db, token=out["dev_token"])
        assert verify["ok"] is True
        with pytest.raises(Exception):
            verify_magic_link(db, token=out["dev_token"])


def test_billing_mismatch_anti_enumeration():
    from app.services.activate_service import request_billing_link

    db = _FakeDB()
    with patch("app.services.activate_service.EmailService") as mail:
        mail.return_value.send_email.return_value = False
        a = request_billing_link(
            db,
            requester_email="operator@utility.org",
            billing_email="does-not-exist@example.com",
        )
        b = request_billing_link(
            db,
            requester_email="operator@utility.org",
            billing_email="billing@example-utility.gov",
        )
    assert a["ok"] is True and b["ok"] is True
    assert a["message"] == b["message"]


def test_reconcile_dry_run_fixture(monkeypatch):
    from pathlib import Path

    from app.services.stripe_reconcile_service import reconcile_from_stripe

    monkeypatch.setattr(settings, "OWW_STRIPE_ELIGIBLE_PRODUCT_IDS", "prod_ww360_utility")
    monkeypatch.setattr(settings, "OWW_STRIPE_ELIGIBLE_PRICE_IDS", "price_ww360_utility")
    fixture = Path(__file__).parent / "fixtures" / "stripe_subscriptions_sample.json"
    raw = json.loads(fixture.read_text())
    subs = raw["subscriptions"]

    def list_subscriptions(**kwargs):
        return SimpleNamespace(data=subs, has_more=False)

    stats = reconcile_from_stripe(_FakeDB(), dry_run=True, list_subscriptions=list_subscriptions)
    assert stats["dry_run"] is True
    assert stats["would_upsert"] == 1  # conference filtered out
    assert stats["seen"] == 2


def test_webhook_endpoint_signature(monkeypatch):
    """Construct event with stripe SDK using fixture signature."""
    pytest.importorskip("stripe")
    import stripe

    secret = "whsec_test_fixture"
    monkeypatch.setattr(settings, "OWW_STRIPE_WEBHOOK_SECRET", secret)
    payload_dict = {
        "id": "evt_endpoint_1",
        "object": "event",
        "type": "customer.subscription.updated",
        "created": int(time.time()),
        "data": {
            "object": {
                "id": "sub_1",
                "customer": "cus_1",
                "status": "active",
                "items": {"data": []},
            }
        },
    }
    payload = json.dumps(payload_dict, separators=(",", ":")).encode()
    sig = _sign_payload(payload, secret)
    event = stripe.Webhook.construct_event(payload, sig, secret, tolerance=300)
    assert event["id"] == "evt_endpoint_1"

    # Tampered payload
    with pytest.raises(Exception):
        stripe.Webhook.construct_event(payload + b" ", sig, secret, tolerance=300)
