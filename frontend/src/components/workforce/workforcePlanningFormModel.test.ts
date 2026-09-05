import { describe, expect, it } from 'vitest';
import {
  ENTITY_FORM_COLUMNS,
  buildFieldValueOptions,
  loadWizardSetupMeta,
  operatorGradeOptions,
  saveWizardSetupMeta,
  shouldUsePriorValueSelect,
} from '@/components/workforce/workforcePlanningFormModel';

describe('workforcePlanningFormModel', () => {
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
    expect(iiia?.label).not.toContain('IIA');
  });

  it('persists wizard setup contact notes per district in localStorage', () => {
    saveWizardSetupMeta('TEST', {
      contact_name: 'Jane Doe',
      contact_email: 'jane@example.com',
      planning_scope_notes: 'Scope notes',
    });
    expect(loadWizardSetupMeta('TEST')).toEqual({
      contact_name: 'Jane Doe',
      contact_email: 'jane@example.com',
      planning_scope_notes: 'Scope notes',
    });
    window.localStorage.removeItem('aquasafe.workforce-wizard.setup-meta:TEST');
  });
});
