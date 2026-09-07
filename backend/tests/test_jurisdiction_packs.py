"""Tests for state content packs."""

from app.services.jurisdiction_service import load_pack, list_pack_states


def test_list_pack_states_includes_ny_and_nj():
    states = list_pack_states()
    assert "NY" in states
    assert "NJ" in states


def test_ny_pack_has_regions_and_eyebrow():
    pack = load_pack("NY")
    assert pack.state_code == "NY"
    assert "AWWA" in pack.section_eyebrow
    assert len(pack.economic_regions) >= 5
    assert pack.sdwis_default_state == "NY"


def test_nj_stub_pack():
    pack = load_pack("NJ")
    assert pack.state_code == "NJ"
    assert pack.partner_name
    assert len(pack.economic_regions) >= 3
