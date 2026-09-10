/**
 * Helpers for workforce record detail dialogs: titles, tab mapping, related joins.
 */
import {
  ENTITY_FORM_COLUMNS,
  formatEntityCellValue,
  labelForField,
  type ReferenceSource,
} from '@/components/workforce/workforcePlanningFormModel';
import {
  ENTITY_TO_FLOW_NODE,
  WORKFORCE_FLOW_NODES,
} from '@/components/workforce/workforceFlowModel';
import { WORKFORCE_TAB_META } from '@/components/workforce/workforceContinuityTabs';
import type { WorkforceContinuityTab } from '@/components/workforce/workforceContinuityTabs';
import type { WorkforceEntityType } from '@/services/workforceSuccessionService';

export type WorkforceRow = Record<string, unknown>;

export const ENTITY_TO_TAB: Record<WorkforceEntityType, WorkforceContinuityTab> = {
  positions: 'positions',
  employees: 'employees',
  certifications: 'certifications',
  critical_functions: 'functions',
  role_coverage: 'coverage',
  succession_candidates: 'succession',
  knowledge_artifacts: 'knowledge',
  transition_milestones: 'milestones',
};

export const ENTITY_SINGULAR_LABEL: Record<WorkforceEntityType, string> = {
  positions: 'Position',
  employees: 'Employee',
  certifications: 'Certification',
  critical_functions: 'Critical function',
  role_coverage: 'Coverage assignment',
  succession_candidates: 'Succession candidate',
  knowledge_artifacts: 'Knowledge artifact',
  transition_milestones: 'Transition milestone',
};

export interface RelatedRecordLink {
  entityType: WorkforceEntityType;
  row: WorkforceRow;
  label: string;
  sublabel?: string;
}

export interface RelatedSection {
  title: string;
  links: RelatedRecordLink[];
}

export function getFlowCopy(entityType: WorkforceEntityType) {
  const nodeId = ENTITY_TO_FLOW_NODE[entityType];
  return WORKFORCE_FLOW_NODES[nodeId];
}

export function getPhaseAccentClass(entityType: WorkforceEntityType): string {
  const nodeId = ENTITY_TO_FLOW_NODE[entityType];
  const tabMeta = WORKFORCE_TAB_META[nodeId as WorkforceContinuityTab];
  return tabMeta?.activeClass ?? 'border-indigo-600 text-indigo-700';
}

export function getRecordTitle(
  entityType: WorkforceEntityType,
  row: WorkforceRow,
  refRowsBySource: Record<ReferenceSource, WorkforceRow[]>
): string {
  switch (entityType) {
    case 'positions':
      return String(row.title ?? row.position_code ?? 'Position');
    case 'employees':
      return String(row.full_name ?? row.employee_code ?? 'Employee');
    case 'certifications': {
      const type = String(row.certification_type ?? 'Certification');
      const grade = row.certification_grade ? ` (${row.certification_grade})` : '';
      return `${type}${grade}`;
    }
    case 'critical_functions':
      return String(row.function_name ?? row.function_code ?? 'Critical function');
    case 'role_coverage': {
      const fn = formatEntityCellValue('role_coverage', 'function_id', row, refRowsBySource);
      const emp = formatEntityCellValue('role_coverage', 'employee_id', row, refRowsBySource);
      return `${fn} — ${emp}`;
    }
    case 'succession_candidates': {
      const emp = formatEntityCellValue(
        'succession_candidates',
        'employee_id',
        row,
        refRowsBySource
      );
      const pos = formatEntityCellValue(
        'succession_candidates',
        'target_position_id',
        row,
        refRowsBySource
      );
      return `${emp} → ${pos}`;
    }
    case 'knowledge_artifacts':
      return String(row.title ?? row.artifact_type ?? 'Knowledge artifact');
    case 'transition_milestones':
      return String(row.title ?? row.milestone_type ?? 'Milestone');
    default:
      return ENTITY_SINGULAR_LABEL[entityType];
  }
}

export function findRowById(rows: WorkforceRow[], id: unknown): WorkforceRow | undefined {
  if (id == null) return undefined;
  return rows.find(r => String(r.id) === String(id));
}

export function findRowByCode(
  rows: WorkforceRow[],
  codeKey: string,
  code: unknown
): WorkforceRow | undefined {
  if (code == null || code === '') return undefined;
  return rows.find(r => String(r[codeKey] ?? '') === String(code));
}

function link(
  entityType: WorkforceEntityType,
  row: WorkforceRow | undefined,
  label: string,
  sublabel?: string
): RelatedRecordLink | null {
  if (!row) return null;
  return { entityType, row, label, sublabel };
}

export function buildRelatedSections(
  entityType: WorkforceEntityType,
  row: WorkforceRow,
  lists: {
    positions: WorkforceRow[];
    employees: WorkforceRow[];
    certifications: WorkforceRow[];
    critical_functions: WorkforceRow[];
    role_coverage: WorkforceRow[];
    succession_candidates: WorkforceRow[];
    knowledge_artifacts: WorkforceRow[];
    transition_milestones: WorkforceRow[];
  },
  refRowsBySource: Record<ReferenceSource, WorkforceRow[]>
): RelatedSection[] {
  const sections: RelatedSection[] = [];

  const push = (title: string, links: (RelatedRecordLink | null)[]) => {
    const valid = links.filter((l): l is RelatedRecordLink => l != null);
    if (valid.length) sections.push({ title, links: valid });
  };

  switch (entityType) {
    case 'employees': {
      const code = row.employee_code;
      push(
        'Certifications',
        lists.certifications
          .filter(
            c =>
              String(c.employee_code ?? '') === String(code ?? '') ||
              String(c.employee_id ?? '') === String(row.id ?? '')
          )
          .map(c =>
            link(
              'certifications',
              c,
              String(c.certification_type ?? 'Certification'),
              c.expiration_date ? `Expires ${c.expiration_date}` : undefined
            )
          )
      );
      push(
        'Coverage assignments',
        lists.role_coverage
          .filter(
            r =>
              String(r.employee_code ?? '') === String(code ?? '') ||
              String(r.employee_id ?? '') === String(row.id ?? '')
          )
          .map(r =>
            link(
              'role_coverage',
              r,
              `${formatEntityCellValue('role_coverage', 'function_id', r, refRowsBySource)} (${r.coverage_role ?? 'role'})`
            )
          )
      );
      push(
        'Succession candidacies',
        lists.succession_candidates
          .filter(
            s =>
              String(s.employee_code ?? '') === String(code ?? '') ||
              String(s.employee_id ?? '') === String(row.id ?? '')
          )
          .map(s =>
            link(
              'succession_candidates',
              s,
              `Target: ${formatEntityCellValue('succession_candidates', 'target_position_id', s, refRowsBySource)}`,
              String(s.readiness_level ?? '')
            )
          )
      );
      const pos = findRowByCode(lists.positions, 'position_code', row.position_code);
      push('Position', [
        link('positions', pos, String(pos?.title ?? row.position_code ?? 'Position')),
      ]);
      break;
    }
    case 'positions': {
      const code = row.position_code;
      push(
        'Employees in this position',
        lists.employees
          .filter(
            e =>
              String(e.position_code ?? '') === String(code ?? '') ||
              String(e.position_id ?? '') === String(row.id ?? '')
          )
          .map(e => link('employees', e, String(e.full_name ?? e.employee_code ?? 'Employee')))
      );
      push(
        'Succession candidates',
        lists.succession_candidates
          .filter(
            s =>
              String(s.target_position_code ?? '') === String(code ?? '') ||
              String(s.target_position_id ?? '') === String(row.id ?? '')
          )
          .map(s =>
            link(
              'succession_candidates',
              s,
              formatEntityCellValue('succession_candidates', 'employee_id', s, refRowsBySource),
              String(s.readiness_level ?? '')
            )
          )
      );
      push(
        'Milestones',
        lists.transition_milestones
          .filter(
            m =>
              String(m.position_code ?? '') === String(code ?? '') ||
              String(m.position_id ?? '') === String(row.id ?? '')
          )
          .map(m =>
            link('transition_milestones', m, String(m.title ?? m.milestone_type ?? 'Milestone'))
          )
      );
      break;
    }
    case 'critical_functions': {
      const code = row.function_code;
      push(
        'Coverage roster',
        lists.role_coverage
          .filter(
            r =>
              String(r.function_code ?? '') === String(code ?? '') ||
              String(r.function_id ?? '') === String(row.id ?? '')
          )
          .map(r =>
            link(
              'role_coverage',
              r,
              `${formatEntityCellValue('role_coverage', 'employee_id', r, refRowsBySource)} (${r.coverage_role ?? 'role'})`
            )
          )
      );
      push(
        'Knowledge artifacts',
        lists.knowledge_artifacts
          .filter(
            k =>
              String(k.function_code ?? '') === String(code ?? '') ||
              String(k.function_id ?? '') === String(row.id ?? '')
          )
          .map(k =>
            link('knowledge_artifacts', k, String(k.title ?? k.artifact_type ?? 'Artifact'))
          )
      );
      break;
    }
    case 'certifications': {
      const emp =
        findRowByCode(lists.employees, 'employee_code', row.employee_code) ??
        findRowById(lists.employees, row.employee_id);
      push('Employee', [
        link('employees', emp, String(emp?.full_name ?? row.employee_code ?? 'Employee')),
      ]);
      break;
    }
    case 'role_coverage': {
      const fn =
        findRowByCode(lists.critical_functions, 'function_code', row.function_code) ??
        findRowById(lists.critical_functions, row.function_id);
      const emp =
        findRowByCode(lists.employees, 'employee_code', row.employee_code) ??
        findRowById(lists.employees, row.employee_id);
      push('Critical function', [
        link(
          'critical_functions',
          fn,
          String(fn?.function_name ?? row.function_code ?? 'Function')
        ),
      ]);
      push('Employee', [
        link('employees', emp, String(emp?.full_name ?? row.employee_code ?? 'Employee')),
      ]);
      break;
    }
    case 'succession_candidates': {
      const emp =
        findRowByCode(lists.employees, 'employee_code', row.employee_code) ??
        findRowById(lists.employees, row.employee_id);
      const pos =
        findRowByCode(lists.positions, 'position_code', row.target_position_code) ??
        findRowById(lists.positions, row.target_position_id);
      push('Candidate', [
        link('employees', emp, String(emp?.full_name ?? row.employee_code ?? 'Employee')),
      ]);
      push('Target position', [
        link('positions', pos, String(pos?.title ?? row.target_position_code ?? 'Position')),
      ]);
      break;
    }
    case 'knowledge_artifacts': {
      const fn =
        findRowByCode(lists.critical_functions, 'function_code', row.function_code) ??
        findRowById(lists.critical_functions, row.function_id);
      const src =
        findRowByCode(lists.employees, 'employee_code', row.source_employee_code) ??
        findRowById(lists.employees, row.source_employee_id);
      push('Critical function', [
        link(
          'critical_functions',
          fn,
          String(fn?.function_name ?? row.function_code ?? 'Function')
        ),
      ]);
      push('Source employee', [
        link('employees', src, String(src?.full_name ?? row.source_employee_code ?? 'Employee')),
      ]);
      break;
    }
    case 'transition_milestones': {
      const pos =
        findRowByCode(lists.positions, 'position_code', row.position_code) ??
        findRowById(lists.positions, row.position_id);
      const owner =
        findRowByCode(lists.employees, 'employee_code', row.owner_employee_code) ??
        findRowById(lists.employees, row.owner_employee_id);
      push('Position', [
        link('positions', pos, String(pos?.title ?? row.position_code ?? 'Position')),
      ]);
      push('Owner', [
        link('employees', owner, String(owner?.full_name ?? row.owner_employee_code ?? 'Employee')),
      ]);
      break;
    }
    default:
      break;
  }

  return sections;
}

export function getFieldEntries(
  entityType: WorkforceEntityType,
  row: WorkforceRow,
  refRowsBySource: Record<ReferenceSource, WorkforceRow[]>,
  showEmpty: boolean
): { field: string; label: string; value: string; empty: boolean }[] {
  const columns = ENTITY_FORM_COLUMNS[entityType] ?? [];
  return columns
    .map(field => {
      const raw = row[field];
      const empty = raw == null || raw === '' || (typeof raw === 'string' && raw.trim() === '');
      const value = empty ? '—' : formatEntityCellValue(entityType, field, row, refRowsBySource);
      return { field, label: labelForField(field), value, empty };
    })
    .filter(entry => showEmpty || !entry.empty);
}
