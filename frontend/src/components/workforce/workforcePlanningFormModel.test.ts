import { beforeEach, describe, expect, it } from 'vitest';
import {
  ENTITY_FORM_COLUMNS,
  buildFieldValueOptions,
  loadWizardSetupMeta,
  certificationGradeOptions,
  operatorGradeOptions,
  saveWizardSetupMeta,
  shouldUsePriorValueSelect,
  wastewaterGradeOptions,
} from '@/components/workforce/workforcePlanningFormModel';

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const memory = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  };
  const win = (globalThis as { window?: Window & typeof globalThis }).window ?? (globalThis as Window & typeof globalThis);
  if (!(globalThis as { window?: unknown }).window) {
    (globalThis as { window: unknown }).window = win;
  }
  Object.defineProperty(win, 'localStorage', {
    value: memory,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: memory,
    configurable: true,
    writable: true,
  });
}

describe('workforcePlanningFormModel', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });
  it('defines columns for all entity types used in standalone areas', () => {
    const keys = [
      'positions',
      'employees',
      'certifications',
      'critical_functions',
      'role_coverage',
      'succession_candidates',
      'knowledge_artifacts',
      'transition_milestones',
    ];
    for (const k of keys) {
      expect(ENTITY_FORM_COLUMNS[k]?.length).toBeGreaterThan(0);
    }
  });

  it('uses prior-value selects for repeatable metadata fields', () => {
    expect(shouldUsePriorValueSelect('positions', 'department')).toBe(true);
    expect(shouldUsePriorValueSelect('employees', 'position_id')).toBe(false);
    expect(shouldUsePriorValueSelect('employees', 'full_name')).toBe(false);
    expect(shouldUsePriorValueSelect('employees', 'hire_date')).toBe(false);
  });

  it('builds distinct field value options from saved rows', () => {
    const options = buildFieldValueOptions(
      [{ department: 'Operations' }, { department: 'Operations' }, { department: 'Compliance' }],
      'department'
    );
    expect(options.map(o => o.value)).toEqual(['Compliance', 'Operations']);
  });

  it('labels operator grades with brief descriptions', () => {
    const a = operatorGradeOptions().find(o => o.value === 'A');
    expect(a?.label).toContain('Grade A');
    const d = operatorGradeOptions().find(o => o.value === 'D');
    expect(d?.label).toContain('Grade D');
    const iiia = operatorGradeOptions().find(o => o.value === 'IIIA');
    expect(iiia?.label).toContain('Grade 3-A');
    // Label should identify IIIA, not be confused with the IIA grade option.
    expect(iiia?.label.startsWith('IIIA')).toBe(true);
    expect(iiia?.label).not.toMatch(/(^|[^I])IIA\b/);
  });

  it('switches certification grade options by cert program', () => {
    expect(certificationGradeOptions('drinking_water').map(o => o.value)).toContain('A');
    expect(certificationGradeOptions('wastewater').map(o => o.value)).toEqual(
      wastewaterGradeOptions().map(o => o.value)
    );
    expect(certificationGradeOptions('wastewater').map(o => o.value)).toContain('3A');
  });

  it('persists wizard setup contact notes per district in localStorage', () => {
    saveWizardSetupMeta('TEST', {
      contact_name: 'Jane Doe',
      contact_email: 'jane@example.com',
      planning_scope_notes: 'Scope notes',
      pwsid: 'NY1234567',
    });
    expect(loadWizardSetupMeta('TEST')).toEqual({
      contact_name: 'Jane Doe',
      contact_email: 'jane@example.com',
      planning_scope_notes: 'Scope notes',
      pwsid: 'NY1234567',
    });
    window.localStorage.removeItem('aquasafe.workforce-wizard.setup-meta:TEST');
  });
});
