/** Source attribution chips used across WW360 dashboards. */

export type Ww360SourceId = 'learning-stream' | 'oww-web' | 'ww360' | 'sdwis' | 'bls' | 'usajobs';

export const WW360_SOURCE_LABEL: Record<Ww360SourceId, string> = {
  'learning-stream': 'Learning Stream',
  'oww-web': 'onewaterworkforce.org',
  ww360: 'Water Workforce 360',
  sdwis: 'EPA SDWIS',
  bls: 'BLS OOH',
  usajobs: 'USAJOBS',
};

export const WW360_SOURCE_TONE: Record<Ww360SourceId, string> = {
  'learning-stream': 'bg-sky-50 text-sky-800 border-sky-200',
  'oww-web': 'bg-teal-50 text-teal-800 border-teal-200',
  ww360: 'bg-blue-50 text-blue-800 border-blue-200',
  sdwis: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  bls: 'bg-violet-50 text-violet-800 border-violet-200',
  usajobs: 'bg-indigo-50 text-indigo-800 border-indigo-200',
};
