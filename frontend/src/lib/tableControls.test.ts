import { describe, expect, it } from 'vitest';
import { compareTableValues, filterTableRows, sortTableRows } from './tableControls';

describe('tableControls', () => {
  it('sorts numbers and strings', () => {
    const rows = [
      { name: 'Sullivan', n: 49 },
      { name: 'Orange', n: 87 },
      { name: 'Albany', n: 12 },
    ];
    const byName = sortTableRows(rows, 'name', 'asc', (r, k) => r[k as 'name' | 'n']);
    expect(byName.map(r => r.name)).toEqual(['Albany', 'Orange', 'Sullivan']);
    const byN = sortTableRows(rows, 'n', 'desc', (r, k) => r[k as 'name' | 'n']);
    expect(byN.map(r => r.n)).toEqual([87, 49, 12]);
  });

  it('filters by search text', () => {
    const rows = [{ county: 'Orange' }, { county: 'Sullivan' }, { county: 'Erie' }];
    const out = filterTableRows(rows, 'sul', r => r.county);
    expect(out).toEqual([{ county: 'Sullivan' }]);
  });

  it('pushes empty values to the end', () => {
    expect(compareTableValues(null, 1, 'asc')).toBe(1);
    expect(compareTableValues(1, null, 'asc')).toBe(-1);
  });
});
