"""Tests for Succession Binder catalog and pack profiles."""

from app.services.workforce_succession.binder_catalog import (
    BASE_SECTIONS,
    CEU_SECTIONS,
    OPTIONAL_SECTIONS,
    PROFILE_LABELS,
    sections_for_profile,
)


def test_base_sections_always_present():
    for profile in PROFILE_LABELS:
        sections = sections_for_profile(profile)
        base_ids = {s.section_id for s in BASE_SECTIONS}
        assert base_ids.issubset({s.section_id for s in sections})


def test_multi_plant_adds_matrix():
    small = {s.section_id for s in sections_for_profile("small_system")}
    multi = {s.section_id for s in sections_for_profile("multi_plant")}
    assert "multi_plant_matrix" in multi
    assert "multi_plant_matrix" not in small


def test_district_trainees_adds_pathway():
    sections = sections_for_profile("district_trainees")
    ids = {s.section_id for s in sections}
    assert "trainee_pathway" in ids
    assert "board_one_pager" in ids


def test_ceu_pack_has_two_sections():
    assert len(CEU_SECTIONS) == 2
    assert CEU_SECTIONS[0].section_id == "ceu_tracker"


def test_optional_sections_reference_valid_profiles():
    for section in OPTIONAL_SECTIONS:
        assert section.optional_for
        assert section.optional_for.issubset(set(PROFILE_LABELS.keys()))
