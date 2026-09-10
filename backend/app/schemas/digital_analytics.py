"""Pydantic schemas for Digital reach (GA4 + SEO) reports."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

DigitalPropertyId = Literal["ww360", "oww-web", "learning-stream"]
DigitalRange = Literal["30d", "qtr", "12mo"]
DigitalDataMode = Literal["live", "sample"]


class Ga4SummaryOut(BaseModel):
    sessions: int
    users: int
    newUsers: int
    pageviews: int
    engagementRate: float
    avgSessionDurationSec: float
    conversions: int
    bounceRate: float


class Ga4DailyPointOut(BaseModel):
    date: str
    sessions: int
    users: int
    pageviews: int


class Ga4ChannelRowOut(BaseModel):
    channel: str
    sessions: int
    users: int
    conversions: int


class Ga4PageRowOut(BaseModel):
    pagePath: str
    title: str
    pageviews: int
    sessions: int
    bounceRate: float


class Ga4GeoRowOut(BaseModel):
    region: str
    sessions: int
    users: int


class Ga4DeviceRowOut(BaseModel):
    device: str
    sessions: int
    share: float


class Ga4ConversionRowOut(BaseModel):
    event: str
    count: int
    rate: float


class Ga4BlockOut(BaseModel):
    summary: Ga4SummaryOut
    daily: List[Ga4DailyPointOut]
    channels: List[Ga4ChannelRowOut]
    topPages: List[Ga4PageRowOut]
    geo: List[Ga4GeoRowOut]
    devices: List[Ga4DeviceRowOut]
    conversions: List[Ga4ConversionRowOut]


class SeoSummaryOut(BaseModel):
    clicks: int
    impressions: int
    ctr: float
    avgPosition: float


class SeoDailyPointOut(BaseModel):
    date: str
    clicks: int
    impressions: int


class SeoQueryRowOut(BaseModel):
    query: str
    clicks: int
    impressions: int
    ctr: float
    position: float
    branded: bool


class SeoLandingRowOut(BaseModel):
    page: str
    title: str
    clicks: int
    impressions: int
    ctr: float
    position: float


class SeoDeviceRowOut(BaseModel):
    device: str
    clicks: int
    impressions: int


class SeoBlockOut(BaseModel):
    summary: SeoSummaryOut
    daily: List[SeoDailyPointOut]
    topQueries: List[SeoQueryRowOut]
    topLandings: List[SeoLandingRowOut]
    devices: List[SeoDeviceRowOut]


class DigitalInsightOut(BaseModel):
    id: str
    severity: Literal["high", "medium", "info"]
    title: str
    body: str
    action: str


class DigitalPropertyReportOut(BaseModel):
    property: DigitalPropertyId
    label: str
    dataMode: DigitalDataMode
    range: DigitalRange
    lastSynced: Optional[str] = None
    ga: Ga4BlockOut
    seo: SeoBlockOut
    insights: List[DigitalInsightOut]


class DigitalTeaserOut(BaseModel):
    ww360Sessions30d: int
    owwOrganicClicks30d: int
    lsCatalogSessions30d: int
    blendedSeoImpressions30d: int
