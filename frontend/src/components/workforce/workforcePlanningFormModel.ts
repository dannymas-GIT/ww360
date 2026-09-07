/**
 * Defaults and step metadata for the resumable workforce planning wizard.
 * Row field names mirror the CSV templates under docs/workforce_succession/csv_templates/.
 */
import type { WorkforcePlanningPayload } from '@/services/workforceSuccessionService';

export interface FormWizardStep {
  id: string;
  title: string;
  subtitle: string;
  phase: 'overview' | 'plan' | 'hire' | 'transition' | 'sustain' | 'finish';
  whatItMeans: string;
  whatYouNeed: string[];
  whatAquaSafeDoes: string;
  suggestedPrompts: string[];
}

export const FORM_WIZARD_STEPS: FormWizardStep[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    subtitle: 'Guided workforce continuity intake',
    phase: 'overview',
    whatItMeans:
      'You will enter workforce continuity data directly into AquaSafe—no spreadsheets required. ' +
      'Each step saves to the live dataset immediately, so tabs and the dashboard reflect your entries right away.',
    whatYouNeed: [
      'Rough roster and position list from the utility.',
      'Certification expirations and critical operational functions the utility cares about.',
    ],
    whatAquaSafeDoes:
      'Creates and updates rows in the workforce continuity tables as you save each step—no separate publish step.',
    suggestedPrompts: [
      'Explain what data I should collect before starting this wizard.',
      'How is this different from uploading CSV files?',
    ],
  },
  {
    id: 'setup',
    title: 'Planning setup',
    subtitle: 'Who to coordinate with',
    phase: 'plan',
    whatItMeans:
      'Capture the primary contact at the utility for this planning exercise. Notes are saved in this browser for the selected district.',
    whatYouNeed: [
      'Name and email of HR or operations liaison.',
      'Any scope notes (facilities, unions, civil service).',
    ],
    whatAquaSafeDoes:
      'Keeps contact notes in this browser for the selected district so they restore when you reopen the wizard.',
    suggestedPrompts: [
      'What should I put in planning scope notes?',
      'Who is usually the right contact for succession planning at a water utility?',
    ],
  },
  {
    id: 'express_setup',
    title: 'Express setup',
    subtitle: 'Minimum data for the documentation pack',
    phase: 'plan',
    whatItMeans:
      'Enter positions, employees, and critical functions in one screen. Data saves to the same live tables as the full wizard.',
    whatYouNeed: [
      'Position titles and vacancy status',
      'Operator names and grades',
      'Critical function names',
    ],
    whatAquaSafeDoes:
      'Creates workforce rows immediately so you can jump to Generate documentation pack.',
    suggestedPrompts: [
      'What is the minimum data for the pack?',
      'Can I import a roster CSV instead?',
    ],
  },
  {
    id: 'positions',
    title: 'Positions',
    subtitle: 'Funded roles and vacancies',
    phase: 'plan',
    whatItMeans:
      'List each position title. A position # is assigned automatically if you leave it blank; you can change it later.',
    whatYouNeed: [
      'Position titles',
      'Which slots are vacant',
      'FTE and civil service grade if applicable',
    ],
    whatAquaSafeDoes: 'Saves each position to workforce_positions immediately.',
    suggestedPrompts: [
      'How should I label positions so they stay easy to find?',
      'What is the difference between funded and vacant?',
    ],
  },
  {
    id: 'employees',
    title: 'Employees',
    subtitle: 'Who holds each role today',
    phase: 'plan',
    whatItMeans:
      'One row per person with their name, assigned position, and retirement-eligibility date if known. An employee # is assigned automatically when left blank.',
    whatYouNeed: [
      'Employee names',
      'Operator license grade (A/B/C/D)',
      'Hire dates',
      'Retirement horizon estimates',
    ],
    whatAquaSafeDoes: 'Saves each employee to workforce_employees immediately.',
    suggestedPrompts: [
      'How do I link an employee to their AquaSafe login?',
      'What employee details should I avoid collecting?',
    ],
  },
  {
    id: 'critical_functions',
    title: 'Critical functions',
    subtitle: 'Operational responsibilities that must stay covered',
    phase: 'plan',
    whatItMeans:
      'Define discrete functions (treatment, SCADA, compliance, sampling, etc.) that need explicit backup coverage.',
    whatYouNeed: [
      'Function names (a function # is assigned automatically when left blank)',
      'Optional links to schedules or programs',
    ],
    whatAquaSafeDoes: 'Saves each function to workforce_critical_functions immediately.',
    suggestedPrompts: [
      'Help me decide whether a function is critical.',
      'Give examples of critical functions for a small water district.',
    ],
  },
  {
    id: 'certifications',
    title: 'Certifications',
    subtitle: 'Licenses and credentials with expiration dates',
    phase: 'plan',
    whatItMeans:
      'Track operator grades, OSHA, confined space, CDL, or any credential where expiry drives operational risk.',
    whatYouNeed: [
      'Certification type and grade',
      'Expiration dates',
      'Whether required for the role',
    ],
    whatAquaSafeDoes:
      'Saves each certification to workforce_certifications immediately. These records appear under CEU & Training → Certifications.',
    suggestedPrompts: [
      'Which certifications should I ask operators about for NYS utilities?',
      'What does is_required_for_role mean here?',
    ],
  },
  {
    id: 'role_coverage',
    title: 'Role coverage',
    subtitle: 'Primary, backup, and trainee assignments',
    phase: 'plan',
    whatItMeans:
      'For each critical function, record who is primary, who can back them up, and trainees working toward proficiency.',
    whatYouNeed: ['Mapping of employees to functions', 'Coverage role and proficiency level'],
    whatAquaSafeDoes: 'Saves each coverage row to workforce_role_coverage immediately.',
    suggestedPrompts: [
      'Is one backup enough for SCADA responsibilities?',
      'What coverage_role values can I use?',
    ],
  },
  {
    id: 'succession_candidates',
    title: 'Succession candidates',
    subtitle: 'Internal readiness for target positions',
    phase: 'hire',
    whatItMeans:
      'Record employees being developed for leadership or operator roles so hiring and transition planning stay visible.',
    whatYouNeed: ['Candidate names', 'Target positions', 'Readiness notes'],
    whatAquaSafeDoes: 'Saves each candidate to workforce_succession_candidates immediately.',
    suggestedPrompts: [
      'What readiness levels should I use for succession candidates?',
      'How do succession candidates relate to the Hire phase?',
    ],
  },
  {
    id: 'knowledge_artifacts',
    title: 'Knowledge artifacts',
    subtitle: 'SOPs, runbooks, and transfer materials',
    phase: 'transition',
    whatItMeans:
      'Capture knowledge-transfer artifacts tied to critical functions so tribal knowledge is documented before retirements.',
    whatYouNeed: ['Artifact titles', 'Linked critical functions', 'Capture status'],
    whatAquaSafeDoes: 'Saves each artifact to workforce_knowledge_artifacts immediately.',
    suggestedPrompts: [
      'What should I capture in a knowledge artifact row?',
      'Which functions usually need SOP documentation first?',
    ],
  },
  {
    id: 'transition_milestones',
    title: 'Transition milestones',
    subtitle: 'Plan / Hire / Transition / Sustain tasks',
    phase: 'transition',
    whatItMeans:
      'Track milestone tasks across toolkit phases—onboarding check-ins, cross-training, and transition deadlines.',
    whatYouNeed: ['Milestone titles', 'Target dates', 'Phase tags'],
    whatAquaSafeDoes: 'Saves each milestone to workforce_transition_milestones immediately.',
    suggestedPrompts: [
      'What milestone types match the toolkit phases?',
      'How should I schedule 30/60/90-day check-ins?',
    ],
  },
  {
    id: 'ceu_baseline',
    title: 'CEU baseline',
    subtitle: 'Operator renewal progress and vouchers',
    phase: 'sustain',
    whatItMeans:
      'Review CEU progress for operators entered earlier. Record known completions and attach vouchers before renewal cycles end.',
    whatYouNeed: [
      'Course completion records from the current renewal cycle',
      'Signed voucher documents for DOH-352 packages',
    ],
    whatAquaSafeDoes:
      'Shows live CEU summaries from certifications and employees you entered; records save to CEU & Training → CEUs immediately.',
    suggestedPrompts: [
      'How many contact hours does my operator grade require?',
      'What vouchers do I need for DOH-352 renewal?',
    ],
  },
  {
    id: 'review',
    title: 'Review',
    subtitle: 'Summary and optional data-quality check',
    phase: 'finish',
    whatItMeans:
      'Review live row counts for your district. Run an optional data-quality check that uses the same rules as CSV import—nothing is blocked by it.',
    whatYouNeed: ['A few minutes to review counts and fix any flagged rows'],
    whatAquaSafeDoes:
      'Shows current table counts and runs a non-blocking validation pass against live data.',
    suggestedPrompts: [
      'How do I read data-quality check results?',
      'What should I fix first if issues are found?',
    ],
  },
  {
    id: 'generate_doc_pack',
    title: 'Generate documentation pack',
    subtitle: 'Create workforce toolkit documents in Document Studio',
    phase: 'finish',
    whatItMeans:
      'Turn the workforce data you entered into a documentation pack—assessment, search packet, onboarding plans, and knowledge-transfer workplans—saved in Document Studio under Workforce Continuity.',
    whatYouNeed: [
      'Completed positions, employees, and critical functions (earlier steps)',
      'Document Studio access for your district',
      'Optional: connected cloud storage when ready to transfer custody',
    ],
    whatAquaSafeDoes:
      'Fills toolkit templates from your live data and saves them as editable Document Studio drafts. Documents remain on AquaSafe until you authorize transfer to district or NYS organization storage.',
    suggestedPrompts: [
      'What documents are included in the pack?',
      'When should we transfer documents to our own storage?',
    ],
  },
];

export const WORKFORCE_PHASE_COLORS: Record<
  FormWizardStep['phase'],
  { active: string; badge: string }
> = {
  overview: { active: 'border-indigo-600 text-indigo-700', badge: 'bg-indigo-100 text-indigo-800' },
  plan: { active: 'border-blue-600 text-blue-700', badge: 'bg-blue-100 text-blue-800' },
  hire: { active: 'border-amber-600 text-amber-700', badge: 'bg-amber-100 text-amber-800' },
  transition: {
    active: 'border-purple-600 text-purple-700',
    badge: 'bg-purple-100 text-purple-800',
  },
  sustain: { active: 'border-green-600 text-green-700', badge: 'bg-green-100 text-green-800' },
  finish: { active: 'border-slate-600 text-slate-700', badge: 'bg-slate-100 text-slate-800' },
};

export interface WizardSetupMeta {
  contact_name: string;
  contact_email: string;
  planning_scope_notes: string;
  pwsid?: string;
}

const WIZARD_SETUP_META_KEY = 'aquasafe.workforce-wizard.setup-meta';

export function emptyWizardSetupMeta(): WizardSetupMeta {
  return {
    contact_name: '',
    contact_email: '',
    planning_scope_notes: '',
    pwsid: '',
  };
}

export function loadWizardSetupMeta(districtCode: string): WizardSetupMeta {
  try {
    const raw = window.localStorage.getItem(`${WIZARD_SETUP_META_KEY}:${districtCode}`);
    if (!raw) return emptyWizardSetupMeta();
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return emptyWizardSetupMeta();
    const m = parsed as Record<string, unknown>;
    return {
      contact_name: String(m.contact_name ?? ''),
      contact_email: String(m.contact_email ?? ''),
      planning_scope_notes: String(m.planning_scope_notes ?? ''),
      pwsid: String(m.pwsid ?? ''),
    };
  } catch {
    return emptyWizardSetupMeta();
  }
}

export function saveWizardSetupMeta(districtCode: string, meta: WizardSetupMeta): void {
  try {
    window.localStorage.setItem(`${WIZARD_SETUP_META_KEY}:${districtCode}`, JSON.stringify(meta));
  } catch {
    /* ignore quota / private mode */
  }
}

export function emptyPayload(): WorkforcePlanningPayload {
  return {
    meta: emptyWizardSetupMeta(),
    positions: [],
    employees: [],
    certifications: [],
    critical_functions: [],
    role_coverage: [],
    succession_candidates: [],
    knowledge_artifacts: [],
    transition_milestones: [],
  };
}

export function mergePayload(saved: unknown): WorkforcePlanningPayload {
  const e = emptyPayload();
  if (!saved || typeof saved !== 'object') {
    return e;
  }
  const s = saved as Record<string, unknown>;
  const meta = s.meta;
  if (meta && typeof meta === 'object') {
    const m = meta as Record<string, unknown>;
    e.meta = {
      contact_name: String(m.contact_name ?? ''),
      contact_email: String(m.contact_email ?? ''),
      planning_scope_notes: String(m.planning_scope_notes ?? ''),
    };
  }
  const keys = [
    'positions',
    'employees',
    'certifications',
    'critical_functions',
    'role_coverage',
    'succession_candidates',
    'knowledge_artifacts',
    'transition_milestones',
  ] as const;
  for (const k of keys) {
    const arr = s[k];
    e[k] = Array.isArray(arr)
      ? (arr.filter(x => x && typeof x === 'object') as Record<string, unknown>[])
      : [];
  }
  return e;
}

/** Ensure every row sent to the API carries district_code (templates allow omitting it in the UI). */
export function applyDistrictToPayload(
  payload: WorkforcePlanningPayload,
  districtCode: string
): WorkforcePlanningPayload {
  const inject = (rows: Record<string, unknown>[]) =>
    rows.map(r => ({
      ...r,
      district_code: districtCode,
    }));
  return {
    meta: { ...payload.meta },
    positions: inject(payload.positions),
    employees: inject(payload.employees),
    certifications: inject(payload.certifications),
    critical_functions: inject(payload.critical_functions),
    role_coverage: inject(payload.role_coverage),
    succession_candidates: inject(payload.succession_candidates),
    knowledge_artifacts: inject(payload.knowledge_artifacts),
    transition_milestones: inject(payload.transition_milestones),
  };
}

export function welcomeMessageForFormStep(step: FormWizardStep): string {
  return (
    `You are on "${step.title}" in the Workforce Planning Wizard. ${step.whatItMeans} ` +
    'Use the suggested prompts or ask your own question.'
  );
}

export function chatPreambleForFormStep(
  step: FormWizardStep,
  districtCode: string | undefined,
  summary: string
): string {
  const dist = districtCode ? `District: ${districtCode}. ` : '';
  return (
    `Context: AquaSafe Workforce Planning Wizard, step "${step.title}". ` +
    dist +
    `${step.whatItMeans} ` +
    (summary ? `Current form snapshot: ${summary} ` : '') +
    'Answer in plain English for a water-utility professional. Do not invent database rows.\n\nUser question:\n'
  );
}

/** Column keys shown as editable fields per entity (district_code injected on save). */
export const ENTITY_FORM_COLUMNS: Record<string, string[]> = {
  positions: [
    'title',
    'department',
    'civil_service_classification',
    'civil_service_grade',
    'reports_to_position_id',
    'fte_count',
    'is_funded',
    'is_vacant',
    'vacancy_since',
    'external_id',
    'notes',
  ],
  employees: [
    'full_name',
    'operator_grade',
    'work_email',
    'work_phone',
    'home_email',
    'home_phone',
    'home_address_line1',
    'home_address_line2',
    'home_city',
    'home_state',
    'home_zip',
    'county_of_employment',
    'is_veteran',
    'is_contract_operator',
    'position_id',
    'hire_date',
    'retirement_eligible_date',
    'planned_departure_date',
    'linked_aquasafe_username',
    'is_active',
    'external_id',
    'notes',
  ],
  critical_functions: [
    'function_name',
    'function_area',
    'description',
    'linked_facility_id',
    'linked_schedule_id',
    'linked_program',
    'required_certification_type',
    'required_certification_grade',
    'external_id',
  ],
  certifications: [
    'employee_id',
    'certification_type',
    'certification_grade',
    'issuing_authority',
    'credential_id',
    'issued_date',
    'expiration_date',
    'is_required_for_role',
    'external_id',
    'notes',
  ],
  role_coverage: [
    'function_id',
    'employee_id',
    'coverage_role',
    'proficiency_level',
    'last_performed_date',
    'external_id',
    'notes',
  ],
  succession_candidates: [
    'employee_id',
    'target_position_id',
    'readiness_level',
    'readiness_target_date',
    'training_plan_summary',
    'mentor_employee_id',
    'external_id',
    'notes',
  ],
  knowledge_artifacts: [
    'external_id',
    'function_id',
    'artifact_type',
    'title',
    'summary',
    'source_employee_id',
    'captured_by',
    'captured_date',
    'verified_by',
    'verified_date',
    'storage_uri',
    'document_id',
    'notes',
  ],
  transition_milestones: [
    'position_id',
    'milestone_type',
    'title',
    'owner_employee_id',
    'target_date',
    'completed_date',
    'status',
    'toolkit_phase',
    'external_id',
    'notes',
  ],
};

/**
 * Required fields per entity — mirrors the backend importer `required_columns`
 * (minus `district_code`, which the UI injects automatically on save). A row is
 * rejected by publish/CRUD validation if any of these are empty.
 */
export const ENTITY_REQUIRED_FIELDS: Record<string, string[]> = {
  positions: ['title'],
  employees: ['full_name'],
  certifications: ['employee_id', 'certification_type'],
  critical_functions: ['function_name'],
  role_coverage: ['function_id', 'employee_id', 'coverage_role'],
  succession_candidates: ['employee_id', 'target_position_id'],
  knowledge_artifacts: ['external_id', 'artifact_type', 'title'],
  transition_milestones: ['position_id', 'milestone_type', 'title'],
};

/** NYS operator grades used for CEU hour requirements (Subpart 5-4.8). */
export const CEU_CERTIFICATION_GRADES = ['A', 'B', 'C', 'D', 'IIIA', 'IIIB', 'IIIC'] as const;

/** Brief plain-language labels for the employee operator-grade picker. */
export const OPERATOR_GRADE_DESCRIPTIONS: Record<
  (typeof CEU_CERTIFICATION_GRADES)[number],
  string
> = {
  A: 'Treatment plant operator, Grade A',
  B: 'Treatment plant operator, Grade B',
  C: 'Treatment or assistant operator, Grade C',
  D: 'Distribution system operator, Grade D',
  IIIA: 'Treatment plant operator, Grade 3-A',
  IIIB: 'Treatment plant operator, Grade 3-B',
  IIIC: 'Treatment assistant operator, Grade 3-C',
};

export function operatorGradeOptions(): RefOption[] {
  return CEU_CERTIFICATION_GRADES.map(grade => ({
    value: grade,
    label: `${grade} — ${OPERATOR_GRADE_DESCRIPTIONS[grade]}`,
  }));
}

/**
 * Enum-constrained fields — mirrors the backend model value tuples. Supplying a
 * value outside this set fails validation, so the UI renders these as dropdowns.
 */
export const ENTITY_FIELD_ENUMS: Record<string, Record<string, string[]>> = {
  employees: {
    operator_grade: [...CEU_CERTIFICATION_GRADES],
  },
  role_coverage: {
    coverage_role: ['primary', 'backup', 'trainee', 'interim'],
    proficiency_level: ['trainee', 'developing', 'proficient', 'expert'],
  },
  succession_candidates: {
    readiness_level: ['now', '0-12mo', '12-24mo', '24-36mo', 'longer'],
  },
  knowledge_artifacts: {
    artifact_type: [
      'sop',
      'decision_history',
      'troubleshooting',
      'vendor_contact',
      'interview_transcript',
      'training_note',
    ],
  },
  transition_milestones: {
    milestone_type: [
      'announcement',
      'knowledge_capture',
      'search_committee',
      'posting',
      'interview',
      'offer',
      'handoff',
      'checkin_30',
      'checkin_60',
      'checkin_90',
      'checkin_180',
      'review',
    ],
    status: ['planned', 'in_progress', 'complete', 'blocked', 'skipped'],
    toolkit_phase: ['plan', 'hire', 'transition', 'sustain'],
  },
};

/** Boolean fields rendered as yes/no selects to keep stored values clean. */
export const ENTITY_BOOLEAN_FIELDS: Record<string, string[]> = {
  positions: ['is_funded', 'is_vacant'],
  employees: ['is_active'],
  certifications: ['is_required_for_role'],
};

export const ENTITY_NULLABLE_BOOLEAN_FIELDS: Record<string, string[]> = {
  employees: ['is_veteran', 'is_contract_operator'],
};

/**
 * Date fields rendered as native date pickers. Mirrors the backend importer
 * `date_columns`; an `<input type="date">` emits ISO `YYYY-MM-DD`, which the
 * importer's `_parse_date` accepts directly.
 */
export const ENTITY_DATE_FIELDS: Record<string, string[]> = {
  positions: ['vacancy_since'],
  employees: ['hire_date', 'retirement_eligible_date', 'planned_departure_date'],
  certifications: ['issued_date', 'expiration_date'],
  role_coverage: ['last_performed_date'],
  succession_candidates: ['readiness_target_date'],
  knowledge_artifacts: ['captured_date', 'verified_date'],
  transition_milestones: ['target_date', 'completed_date'],
};

/**
 * Cross-entity reference fields. These store another entity's natural-key code
 * and MUST be chosen from existing rows of the source entity — never free-typed
 * — so the data normalizes (each step is the controlled source for the next:
 * positions → employees → coverage, etc.).
 */
export type ReferenceSource = 'positions' | 'employees' | 'critical_functions';

export interface FieldReference {
  source: ReferenceSource;
  /** Column on the source entity stored as the code value. */
  valueKey: string;
  /** Columns combined (in order) to label each option. */
  labelKeys: string[];
}

/** Human-readable column headers for tables and forms. */
export const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  full_name: 'Name',
  operator_grade: 'Operator grade',
  function_name: 'Function',
  department: 'Department',
  civil_service_classification: 'Civil service class',
  civil_service_grade: 'Civil service grade',
  reports_to_position_id: 'Reports to',
  position_id: 'Position',
  employee_id: 'Employee',
  function_id: 'Function',
  target_position_id: 'Target position',
  mentor_employee_id: 'Mentor',
  source_employee_id: 'Source employee',
  owner_employee_id: 'Owner',
  fte_count: 'FTE',
  is_funded: 'Funded',
  is_vacant: 'Vacant',
  vacancy_since: 'Vacant since',
  work_email: 'Work email',
  work_phone: 'Work phone',
  home_email: 'Home email',
  home_phone: 'Home phone',
  home_address_line1: 'Home address line 1',
  home_address_line2: 'Home address line 2',
  home_city: 'Home city',
  home_state: 'Home state',
  home_zip: 'Home ZIP',
  county_of_employment: 'County of employment',
  is_veteran: 'Veteran',
  is_contract_operator: 'Contract operator',
  mailing_address_line1: 'Employer address line 1',
  mailing_address_line2: 'Employer address line 2',
  hire_date: 'Hire date',
  retirement_eligible_date: 'Retirement eligible',
  planned_departure_date: 'Planned departure',
  linked_aquasafe_username: 'AquaSafe login',
  is_active: 'Active',
  function_area: 'Area',
  description: 'Description',
  linked_facility_id: 'Linked facility',
  linked_schedule_id: 'Linked schedule',
  linked_program: 'Program',
  required_certification_type: 'Required cert type',
  required_certification_grade: 'Required cert grade',
  certification_type: 'Certification type',
  certification_grade: 'Grade',
  issuing_authority: 'Issuing authority',
  credential_id: 'Credential ID',
  issued_date: 'Issued',
  expiration_date: 'Expires',
  is_required_for_role: 'Required for role',
  coverage_role: 'Coverage role',
  proficiency_level: 'Proficiency',
  last_performed_date: 'Last performed',
  readiness_level: 'Readiness',
  readiness_target_date: 'Readiness target',
  training_plan_summary: 'Training plan',
  artifact_type: 'Artifact type',
  summary: 'Summary',
  captured_by: 'Captured by',
  captured_date: 'Captured',
  verified_by: 'Verified by',
  verified_date: 'Verified',
  storage_uri: 'Storage URI',
  milestone_type: 'Milestone type',
  target_date: 'Target date',
  completed_date: 'Completed',
  status: 'Status',
  toolkit_phase: 'Toolkit phase',
  external_id: 'External ID',
  notes: 'Notes',
};

export function labelForField(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, ' ');
}

/** First N columns shown in entity list tables. */
export function displayColumnsForEntity(entityType: string): string[] {
  return (ENTITY_FORM_COLUMNS[entityType] ?? []).slice(0, 6);
}

export function resolveRefLabel(
  ref: FieldReference,
  idValue: unknown,
  refRows: Record<string, unknown>[]
): string {
  if (idValue == null || String(idValue).trim() === '') return '—';
  const id = String(idValue).trim();
  const row = refRows.find(r => String(r[ref.valueKey]) === id);
  if (!row) return '—';
  const label = ref.labelKeys
    .map(k => row[k])
    .filter(v => v != null && String(v).trim() !== '')
    .map(String)
    .join(' — ');
  return label || '—';
}

export function formatEntityCellValue(
  entityType: string,
  field: string,
  row: Record<string, unknown>,
  refRowsBySource: Record<ReferenceSource, Record<string, unknown>[]>
): string {
  const ref = referenceFor(entityType, field);
  if (ref) {
    return resolveRefLabel(ref, row[field], refRowsBySource[ref.source]);
  }
  const v = row[field];
  if (v == null || v === '') return '—';
  if (field === 'operator_grade' && typeof v === 'string') {
    const desc = OPERATOR_GRADE_DESCRIPTIONS[v as keyof typeof OPERATOR_GRADE_DESCRIPTIONS];
    return desc ? `${v} — ${desc}` : String(v);
  }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

/** Map a natural-key code column to a display name from loaded entity rows. */
export function buildCodeLabelMap(
  rows: Record<string, unknown>[] | undefined,
  codeKey: string,
  labelKey: string
): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of rows ?? []) {
    const code = row[codeKey];
    const label = row[labelKey];
    if (code == null || label == null) continue;
    const c = String(code).trim();
    const l = String(label).trim();
    if (c && l) out.set(c, l);
  }
  return out;
}

export function labelsForCodes(codes: string[], map: Map<string, string>): string {
  if (!codes.length) return '—';
  return codes.map(c => map.get(c) ?? c).join(', ');
}

const POSITION_REF: FieldReference = {
  source: 'positions',
  valueKey: 'id',
  labelKeys: ['title'],
};
const EMPLOYEE_REF: FieldReference = {
  source: 'employees',
  valueKey: 'id',
  labelKeys: ['full_name'],
};
const FUNCTION_REF: FieldReference = {
  source: 'critical_functions',
  valueKey: 'id',
  labelKeys: ['function_name'],
};

export const ENTITY_FIELD_REFERENCES: Record<string, Record<string, FieldReference>> = {
  positions: {
    reports_to_position_id: POSITION_REF,
  },
  employees: {
    position_id: POSITION_REF,
  },
  certifications: {
    employee_id: EMPLOYEE_REF,
  },
  role_coverage: {
    function_id: FUNCTION_REF,
    employee_id: EMPLOYEE_REF,
  },
  succession_candidates: {
    employee_id: EMPLOYEE_REF,
    target_position_id: POSITION_REF,
    mentor_employee_id: EMPLOYEE_REF,
  },
  knowledge_artifacts: {
    function_id: FUNCTION_REF,
    source_employee_id: EMPLOYEE_REF,
  },
  transition_milestones: {
    position_id: POSITION_REF,
    owner_employee_id: EMPLOYEE_REF,
  },
};

export function referenceFor(entityKey: string, field: string): FieldReference | undefined {
  return ENTITY_FIELD_REFERENCES[entityKey]?.[field];
}

export function referencedSources(entityKey: string): ReferenceSource[] {
  const refs = ENTITY_FIELD_REFERENCES[entityKey];
  if (!refs) return [];
  return Array.from(new Set(Object.values(refs).map(r => r.source)));
}

export interface RefOption {
  value: string;
  label: string;
}

/** Build de-duplicated, sorted dropdown options from source-entity rows. */
export function buildRefOptions(rows: Record<string, unknown>[], ref: FieldReference): RefOption[] {
  const seen = new Set<string>();
  const out: RefOption[] = [];
  for (const row of rows) {
    const raw = row[ref.valueKey];
    if (raw == null || String(raw).trim() === '') continue;
    const value = String(raw).trim();
    if (seen.has(value)) continue;
    seen.add(value);
    const label =
      ref.labelKeys
        .map(k => row[k])
        .filter(v => v != null && String(v).trim() !== '')
        .map(String)
        .join(' — ') || value;
    out.push({ value, label });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

/** Integer FK columns sent as numbers to the API. */
export const ENTITY_INTEGER_FIELDS = new Set([
  'fte_count',
  'linked_facility_id',
  'linked_schedule_id',
  'reports_to_position_id',
  'position_id',
  'employee_id',
  'function_id',
  'target_position_id',
  'mentor_employee_id',
  'source_employee_id',
  'owner_employee_id',
]);

export function isRequiredField(entityKey: string, field: string): boolean {
  return (ENTITY_REQUIRED_FIELDS[entityKey] ?? []).includes(field);
}

export function enumOptionsFor(entityKey: string, field: string): string[] | undefined {
  return ENTITY_FIELD_ENUMS[entityKey]?.[field];
}

/** Enum fields with human-readable option labels (falls back to plain enum values). */
export function labeledEnumOptionsFor(entityKey: string, field: string): RefOption[] | undefined {
  if (entityKey === 'employees' && field === 'operator_grade') {
    return operatorGradeOptions();
  }
  const opts = enumOptionsFor(entityKey, field);
  if (!opts) return undefined;
  return opts.map(value => ({ value, label: value }));
}

export function isBooleanField(entityKey: string, field: string): boolean {
  return (ENTITY_BOOLEAN_FIELDS[entityKey] ?? []).includes(field);
}

export function isNullableBooleanField(entityKey: string, field: string): boolean {
  return (ENTITY_NULLABLE_BOOLEAN_FIELDS[entityKey] ?? []).includes(field);
}

export function isDateField(entityKey: string, field: string): boolean {
  return (ENTITY_DATE_FIELDS[entityKey] ?? []).includes(field);
}

/**
 * Normalize a stored value to the `YYYY-MM-DD` an `<input type="date">` expects.
 * Stored drafts/records may carry ISO datetimes or alternate formats; anything
 * unparseable falls back to empty so the picker stays valid.
 */
export function toDateInputValue(raw: unknown): string {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (s === '') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoMatch) return isoMatch[1];
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}

/** True when every required field for the entity has a non-empty value. */
export function hasAllRequiredFields(entityKey: string, values: Record<string, unknown>): boolean {
  return (ENTITY_REQUIRED_FIELDS[entityKey] ?? []).every(f => {
    const v = values[f];
    return v !== undefined && v !== null && String(v).trim() !== '';
  });
}

export const CEU_FORM_FIELDS = [
  { key: 'employee_code', label: 'Employee', required: true, kind: 'employee' as const },
  { key: 'course_title', label: 'Course title', required: true, kind: 'select' as const },
  { key: 'provider', label: 'Provider', required: false, kind: 'select' as const },
  { key: 'approval_number', label: 'Approval number', required: false, kind: 'select' as const },
  { key: 'ceu_hours', label: 'Contact hours', required: true, kind: 'hours' as const },
  { key: 'completion_date', label: 'Completion date', required: true, kind: 'date' as const },
  {
    key: 'certification_grade',
    label: 'Certification grade',
    required: false,
    kind: 'grade' as const,
  },
  { key: 'category', label: 'Category', required: false, kind: 'select' as const },
];

export function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    if (raw == null) continue;
    const v = String(raw).trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/** Fields that should remain free-text inputs rather than prior-value dropdowns. */
export const ENTITY_FREE_TEXT_ONLY = new Set([
  'notes',
  'description',
  'summary',
  'storage_uri',
  'training_plan_summary',
  'title',
  'function_name',
  'full_name',
  'work_email',
  'work_phone',
  'credential_id',
  'external_id',
  'linked_aquasafe_username',
  'captured_by',
  'verified_by',
]);

export function shouldUsePriorValueSelect(entityKey: string, field: string): boolean {
  if (referenceFor(entityKey, field)) return false;
  if (enumOptionsFor(entityKey, field)) return false;
  if (isBooleanField(entityKey, field)) return false;
  if (isNullableBooleanField(entityKey, field)) return false;
  if (isDateField(entityKey, field)) return false;
  return !ENTITY_FREE_TEXT_ONLY.has(field);
}

/** Distinct saved values for a column across entity rows (for dropdown options). */
export function buildFieldValueOptions(
  rows: Record<string, unknown>[],
  field: string
): RefOption[] {
  return uniqueNonEmpty(rows.map(r => r[field] as string | null | undefined)).map(v => ({
    value: v,
    label: v,
  }));
}

export const CEU_CUSTOM_VALUE = '__custom__';

export function emptyRowForEntity(entityKey: string): Record<string, string> {
  const cols = ENTITY_FORM_COLUMNS[entityKey] ?? [];
  const row: Record<string, string> = {};
  for (const c of cols) {
    row[c] = '';
  }
  return row;
}

/** Six-step district wizard (Setup → Positions → People → Coverage → Bench → Review). */
export const COMPACT_WIZARD_STEP_IDS = [
  'setup',
  'positions',
  'employees',
  'role_coverage',
  'succession_candidates',
  'review',
] as const;

export const COMPACT_FORM_WIZARD_STEPS: FormWizardStep[] = FORM_WIZARD_STEPS.filter(s =>
  (COMPACT_WIZARD_STEP_IDS as readonly string[]).includes(s.id)
);

/** Grouped form sections for resumable employee/position dialogs. */
export const EMPLOYEE_FORM_SECTIONS = [
  { id: 'identity', title: 'Identity', fields: ['employee_code', 'full_name', 'operator_grade'] },
  {
    id: 'role',
    title: 'Role & dates',
    fields: ['position_code', 'hire_date', 'retirement_eligible_date', 'planned_departure_date'],
  },
  {
    id: 'contact',
    title: 'Contact',
    fields: ['work_email', 'work_phone', 'home_email', 'home_phone'],
    collapsedDefault: true,
  },
  { id: 'notes', title: 'Continuity notes', fields: ['notes'], collapsedDefault: true },
] as const;

export const POSITION_FORM_SECTIONS = [
  { id: 'basics', title: 'Basics', fields: ['position_code', 'title', 'department'] },
  {
    id: 'reporting',
    title: 'Reporting',
    fields: ['reports_to_position_code', 'civil_service_classification', 'civil_service_grade'],
  },
  { id: 'funding', title: 'Funding', fields: ['fte_count', 'is_funded', 'is_vacant'] },
] as const;
