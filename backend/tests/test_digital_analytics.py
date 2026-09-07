"""Tests for Digital reach fixture builder."""

from app.services.digital_analytics_fixtures import (
    build_digital_property_report,
    build_digital_teaser,
)


def test_build_digital_property_report_12mo():
    report = build_digital_property_report("ww360", "12mo")
    assert report["property"] == "ww360"
    assert report["dataMode"] == "sample"
    assert report["ga"]["summary"]["sessions"] > 0
    assert len(report["ga"]["daily"]) > 300
    assert report["seo"]["summary"]["clicks"] > 0
    assert len(report["insights"]) >= 1


def test_range_slicing_30d_smaller_than_12mo():
    full = build_digital_property_report("oww-web", "12mo")
    short = build_digital_property_report("oww-web", "30d")
    assert short["ga"]["summary"]["sessions"] < full["ga"]["summary"]["sessions"]
    assert len(short["ga"]["daily"]) <= 31


def test_learning_stream_always_sample():
    report = build_digital_property_report("learning-stream", "qtr")
    assert report["dataMode"] == "sample"
    assert report["label"] == "Learning Stream"
    assert len(report["seo"]["topQueries"]) >= 1


def test_digital_teaser_keys():
    teaser = build_digital_teaser()
    assert teaser["ww360Sessions30d"] > 0
    assert teaser["blendedSeoImpressions30d"] > teaser["owwOrganicClicks30d"]
