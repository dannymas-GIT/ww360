/** Digital reach report contract — stable for live adapters later. */

export type DigitalPropertyId = 'ww360' | 'oww-web' | 'learning-stream';

export type DigitalRange = '30d' | 'qtr' | '12mo';

export type DigitalDataMode = 'live' | 'sample';

export interface Ga4Summary {
  sessions: number;
  users: number;
  newUsers: number;
  pageviews: number;
  engagementRate: number;
  avgSessionDurationSec: number;
  conversions: number;
  bounceRate: number;
}

export interface Ga4DailyPoint {
  date: string;
  sessions: number;
  users: number;
  pageviews: number;
}

export interface Ga4ChannelRow {
  channel: string;
  sessions: number;
  users: number;
  conversions: number;
}

export interface Ga4PageRow {
  pagePath: string;
  title: string;
  pageviews: number;
  sessions: number;
  bounceRate: number;
}

export interface Ga4GeoRow {
  region: string;
  sessions: number;
  users: number;
}

export interface Ga4DeviceRow {
  device: string;
  sessions: number;
  share: number;
}

export interface Ga4ConversionRow {
  event: string;
  count: number;
  rate: number;
}

export interface Ga4Block {
  summary: Ga4Summary;
  daily: Ga4DailyPoint[];
  channels: Ga4ChannelRow[];
  topPages: Ga4PageRow[];
  geo: Ga4GeoRow[];
  devices: Ga4DeviceRow[];
  conversions: Ga4ConversionRow[];
}

export interface SeoSummary {
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
}

export interface SeoDailyPoint {
  date: string;
  clicks: number;
  impressions: number;
}

export interface SeoQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  branded: boolean;
}

export interface SeoLandingRow {
  page: string;
  title: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SeoDeviceRow {
  device: string;
  clicks: number;
  impressions: number;
}

export interface SeoBlock {
  summary: SeoSummary;
  daily: SeoDailyPoint[];
  topQueries: SeoQueryRow[];
  topLandings: SeoLandingRow[];
  devices: SeoDeviceRow[];
}

export interface DigitalInsight {
  id: string;
  severity: 'high' | 'medium' | 'info';
  title: string;
  body: string;
  action: string;
}

export interface DigitalPropertyReport {
  property: DigitalPropertyId;
  label: string;
  dataMode: DigitalDataMode;
  range: DigitalRange;
  lastSynced: string | null;
  ga: Ga4Block;
  seo: SeoBlock;
  insights: DigitalInsight[];
}

export interface DigitalTeaser {
  ww360Sessions30d: number;
  owwOrganicClicks30d: number;
  lsCatalogSessions30d: number;
  blendedSeoImpressions30d: number;
}

export const DIGITAL_PROPERTY_LABELS: Record<DigitalPropertyId, string> = {
  ww360: 'Water Workforce 360',
  'oww-web': 'onewaterworkforce.org',
  'learning-stream': 'Learning Stream',
};
