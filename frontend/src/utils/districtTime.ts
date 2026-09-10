/**
 * Format UTC (or naive-UTC) instants in a district IANA timezone.
 * DB timestamps are stored as naive UTC; normalize before parsing in JS.
 */

const FALLBACK_TIMEZONE = 'America/New_York';

export function normalizeUtcIso(value: string): string {
  if (value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value)) {
    return value;
  }
  return `${value.replace(' ', 'T')}Z`;
}

export function utcToDatetimeLocalValue(
  isoOrNaiveUtc: string | null | undefined,
  timeZone: string = FALLBACK_TIMEZONE
): string {
  if (!isoOrNaiveUtc) return '';
  try {
    const date = new Date(normalizeUtcIso(isoOrNaiveUtc));
    if (Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find(p => p.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  } catch {
    return '';
  }
}

export function utcToPaceDateTime(
  isoOrNaiveUtc: string | null | undefined,
  timeZone: string = FALLBACK_TIMEZONE
): string {
  if (!isoOrNaiveUtc) return '';
  try {
    const date = new Date(normalizeUtcIso(isoOrNaiveUtc));
    if (Number.isNaN(date.getTime())) return isoOrNaiveUtc;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find(p => p.type === type)?.value ?? '';
    return `${get('month')}/${get('day')}/${get('year')} ${get('hour')}:${get('minute')}`;
  } catch {
    return isoOrNaiveUtc;
  }
}

export function utcToPaceDate(
  isoOrNaiveUtc: string | null | undefined,
  timeZone: string = FALLBACK_TIMEZONE
): string {
  if (!isoOrNaiveUtc) return '';
  try {
    const date = new Date(normalizeUtcIso(isoOrNaiveUtc));
    if (Number.isNaN(date.getTime())) return isoOrNaiveUtc;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find(p => p.type === type)?.value ?? '';
    return `${get('month')}/${get('day')}/${get('year')}`;
  } catch {
    return isoOrNaiveUtc;
  }
}

export function districtTodayIso(timeZone: string = FALLBACK_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
