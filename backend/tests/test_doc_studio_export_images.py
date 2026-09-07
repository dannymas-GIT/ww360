"""Unit tests for Document Studio markdown → export block parsing."""

from app.services.doc_studio_export_service import (
    expand_text_with_images,
    normalize_markdown,
    parse_markdown,
    split_image_alt,
)


def test_split_image_alt_strips_layout_meta():
    caption, width = split_image_alt("shot.png|width=69|float=left")
    assert caption == "shot.png"
    assert width == 69


def test_expand_inline_image_glued_to_text():
    blocks = expand_text_with_images(
        "![shot.png|width=50|float=left](/api/v1/doc-studio/assets/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/file)**Title:** Hello"
    )
    assert [b.kind for b in blocks] == ["image", "paragraph"]
    assert blocks[0].src.endswith("/file")
    assert blocks[0].width_pct == 50
    assert "Title" in blocks[1].text


def test_normalize_hard_break_before_heading():
    md = normalize_markdown(
        "![logo](/api/v1/doc-studio/assets/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/file)\\## Career pipeline"
    )
    assert "\n## Career pipeline" in md


def test_normalize_preserves_escaped_hash_in_table_cells():
    """TipTap writes ``\\#`` for a # column — must not become a markdown heading."""
    src = (
        "## Modules\n\n"
        "| \\# | Module | Duration | Key activities |\n"
        "| --- | --- | --- | --- |\n"
        "| 1 | Hydraulics refresh | 90 min | Case study + quiz |\n"
        "| 2 | Water quality in the pipes | 2 hr | Residual logs workshop |\n"
    )
    assert "| \\# | Module |" in normalize_markdown(src)
    blocks = parse_markdown(src)
    tables = [b for b in blocks if b.kind == "table"]
    assert len(tables) == 1
    assert tables[0].rows[0] == ["#", "Module", "Duration", "Key activities"]
    assert tables[0].rows[1][1] == "Hydraulics refresh"
    assert not any(b.kind == "heading" and b.text.startswith("|") for b in blocks)


def test_parse_image_then_heading_after_hard_break():
    md = (
        "![logo](/api/v1/doc-studio/assets/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/file)"
        "\\## Career pipeline\n\nBody text."
    )
    blocks = parse_markdown(md)
    kinds = [b.kind for b in blocks]
    assert "image" in kinds
    assert "heading" in kinds
    img = next(b for b in blocks if b.kind == "image")
    assert img.src.endswith("/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/file")
