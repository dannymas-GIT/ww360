/** Helpers for drinking-water vs wastewater program splits on dashboards. */

export type CertProgramKey = 'drinking_water' | 'wastewater';

export function normalizeCertProgram(value?: string | null): CertProgramKey {
  return (value || '').trim().toLowerCase() === 'wastewater' ? 'wastewater' : 'drinking_water';
}

export function certProgramShortLabel(program: CertProgramKey): string {
  return program === 'wastewater' ? 'WW' : 'DW';
}

export function certProgramLabel(program: CertProgramKey): string {
  return program === 'wastewater' ? 'Wastewater' : 'Drinking water';
}

export function renewalCycleYears(program: CertProgramKey): number {
  return program === 'wastewater' ? 5 : 3;
}

export interface ProgramSplitCounts {
  drinking_water: number;
  wastewater: number;
  hasBoth: boolean;
}

export function splitCountByProgram(
  items: Array<{ cert_program?: string | null }>
): ProgramSplitCounts {
  let drinking_water = 0;
  let wastewater = 0;
  for (const item of items) {
    if (normalizeCertProgram(item.cert_program) === 'wastewater') {
      wastewater += 1;
    } else {
      drinking_water += 1;
    }
  }
  return {
    drinking_water,
    wastewater,
    hasBoth: drinking_water > 0 && wastewater > 0,
  };
}
