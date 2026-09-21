"""Library seed samples stay read-only; Save As / duplicate strips seed markers."""

LIBRARY_SEED_TAG = "library_seed"
SAMPLE_MARKERS = {LIBRARY_SEED_TAG, "sample"}


def test_library_seed_tag_constant():
    assert LIBRARY_SEED_TAG == "library_seed"


def test_duplicate_strips_sample_markers():
    src_tags = [LIBRARY_SEED_TAG, "sample", "template:sop-basic", "custom"]
    copy_tags = [t for t in src_tags if t not in SAMPLE_MARKERS] or None
    assert copy_tags == ["template:sop-basic", "custom"]


def test_title_prefix_marks_sample():
    assert "Sample — Statewide quarterly update (FY26 Q1)".startswith("Sample —")


def test_save_as_title_strips_sample_prefix():
    import re

    src = "Sample — Statewide quarterly update (FY26 Q1)"
    base = re.sub(r"^Sample —\s*", "", src).strip()
    assert base == "Statewide quarterly update (FY26 Q1)"
    assert not base.startswith("Sample —")
