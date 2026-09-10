"""Tests for state content packs."""

from app.services.jurisdiction_service import (
    county_region_index,
    load_pack,
    list_pack_states,
    normalize_county_name,
    region_for_county,
)

# All 62 New York counties (REDC / ESD 10-region geography).
_NY_62_COUNTIES = {
    # Long Island
    "Nassau",
    "Suffolk",
    # New York City
    "Bronx",
    "Kings",
    "New York",
    "Queens",
    "Richmond",
    # Mid-Hudson
    "Dutchess",
    "Orange",
    "Putnam",
    "Rockland",
    "Sullivan",
    "Ulster",
    "Westchester",
    # Capital Region
    "Albany",
    "Columbia",
    "Greene",
    "Rensselaer",
    "Saratoga",
    "Schenectady",
    "Warren",
    "Washington",
    # Mohawk Valley
    "Fulton",
    "Herkimer",
    "Montgomery",
    "Oneida",
    "Otsego",
    "Schoharie",
    # Central NY
    "Cayuga",
    "Cortland",
    "Madison",
    "Onondaga",
    "Oswego",
    # North Country
    "Clinton",
    "Essex",
    "Franklin",
    "Hamilton",
    "Jefferson",
    "Lewis",
    "St. Lawrence",
    # Southern Tier
    "Broome",
    "Chemung",
    "Chenango",
    "Delaware",
    "Schuyler",
    "Steuben",
    "Tioga",
    "Tompkins",
    # Finger Lakes
    "Genesee",
    "Livingston",
    "Monroe",
    "Ontario",
    "Orleans",
    "Seneca",
    "Wayne",
    "Wyoming",
    "Yates",
    # Western NY
    "Allegany",
    "Cattaraugus",
    "Chautauqua",
    "Erie",
    "Niagara",
}


def test_list_pack_states_includes_ny_and_nj():
    states = list_pack_states()
    assert "NY" in states
    assert "NJ" in states


def test_ny_pack_has_regions_and_eyebrow():
    pack = load_pack("NY")
    assert pack.state_code == "NY"
    assert "AWWA" in pack.section_eyebrow
    assert len(pack.economic_regions) == 10
    assert pack.sdwis_default_state == "NY"
    for region in pack.economic_regions:
        assert region.counties, f"{region.id} missing counties"
    finger = next(r for r in pack.economic_regions if r.id == "finger-lakes")
    assert "Monroe" in finger.counties
    north = next(r for r in pack.economic_regions if r.id == "north-country")
    assert "St. Lawrence" in north.counties


def test_ny_counties_cover_all_62_exactly_once():
    pack = load_pack("NY")
    listed: list[str] = []
    for region in pack.economic_regions:
        listed.extend(region.counties)
    assert len(listed) == 62
    assert set(listed) == _NY_62_COUNTIES
    # No duplicate assignments across regions
    assert len(listed) == len(set(listed))


def test_ny_region_for_county_aliases():
    assert region_for_county("NY", "Monroe").id == "finger-lakes"
    assert region_for_county("NY", "  monroe ").id == "finger-lakes"
    assert region_for_county("NY", "St. Lawrence").id == "north-country"
    assert region_for_county("NY", "St Lawrence").id == "north-country"
    assert region_for_county("NY", "Brooklyn").id == "nyc"
    assert region_for_county("NY", "Unknownville") is None
    assert normalize_county_name(" Saint Lawrence ") == "st. lawrence"
    assert "monroe" in county_region_index("NY")


def test_nj_stub_pack():
    pack = load_pack("NJ")
    assert pack.state_code == "NJ"
    assert pack.partner_name
    assert len(pack.economic_regions) >= 3
