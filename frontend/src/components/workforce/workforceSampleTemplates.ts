/**
 * Display-only sample rows for workforce planning sections.
 * Shown when "Show sample templates" is enabled; adopted via "Use this template"
 * which pre-fills the Add dialog without writing to the database.
 *
 * Samples are organized into "pathways" — real-world succession scenarios that
 * thread through critical functions, coverage, succession candidates, knowledge
 * artifacts, and transition milestones. Each pathway carries a reflection
 * prompt so district admins and managers can map the scenario onto their own
 * district instead of copying rows verbatim.
 */
import type { WorkforceEntityType } from '@/services/workforceSuccessionService';

export type WorkforcePathwayId =
  | 'retirement'
  | 'single_point'
  | 'compliance'
  | 'emergency'
  | 'bench';

export interface WorkforcePathway {
  id: WorkforcePathwayId;
  title: string;
  /** One-line scenario framing shown under the pathway title. */
  scenario: string;
  /** Question to prompt the district to think about their own workflows. */
  prompt: string;
}

/** Ordered pathway definitions — rendering follows this order. */
export const WORKFORCE_PATHWAYS: WorkforcePathway[] = [
  {
    id: 'retirement',
    title: 'Planned retirement',
    scenario:
      'A senior operator has announced retirement (or will reach eligibility soon). Trace the handoff from announcement to a confident successor.',
    prompt:
      'Who in your district could retire within 24 months, and what would the first 90 days without them look like?',
  },
  {
    id: 'single_point',
    title: 'Single point of failure',
    scenario:
      'One person carries a niche system or program — SCADA, backflow, a specialized process. Build a real backup before it becomes an emergency.',
    prompt:
      'Which function in your district would stop tomorrow if one specific person were out for a month?',
  },
  {
    id: 'compliance',
    title: 'New or expanding mandate',
    scenario:
      'PFAS, LSLR, and reporting obligations keep growing. Every mandate needs a named owner, a trained backup, and a documented procedure.',
    prompt:
      'For each regulatory program you run, can you name the primary, the backup, and where the procedure is written down?',
  },
  {
    id: 'emergency',
    title: 'After-hours and emergency readiness',
    scenario:
      'Main breaks and alarms do not wait for business hours. Document who responds, how they escalate, and who covers when they cannot.',
    prompt:
      'If a main break happened at 2 AM tonight, who gets called — and who gets called if they do not answer?',
  },
  {
    id: 'bench',
    title: 'Developing the bench',
    scenario:
      'Trainees, CEU plans, and cross-training turn coverage gaps into career paths — and keep institutional knowledge in-house.',
    prompt:
      'Which employees want to grow, and what function could each one start shadowing this quarter?',
  },
];

export interface SampleTemplateRow {
  label: string;
  why: string;
  /** Pathway (real-world scenario) this sample belongs to. */
  pathway: WorkforcePathwayId;
  /** Pre-fill values for non-reference columns only. */
  values: Record<string, string>;
  /** Plain-language hint for required reference dropdowns left empty. */
  referenceHint: string;
}

export type SampleTemplateEntityType = Extract<
  WorkforceEntityType,
  | 'critical_functions'
  | 'role_coverage'
  | 'succession_candidates'
  | 'knowledge_artifacts'
  | 'transition_milestones'
>;

export const SAMPLE_TEMPLATE_ENTITY_TYPES: SampleTemplateEntityType[] = [
  'critical_functions',
  'role_coverage',
  'succession_candidates',
  'knowledge_artifacts',
  'transition_milestones',
];

export const ENTITY_SAMPLE_TEMPLATES: Record<SampleTemplateEntityType, SampleTemplateRow[]> = {
  critical_functions: [
    {
      label: 'Treatment plant daily operation',
      why: 'Daily checks, chemical feed adjustments, and process control must continue during absences — and after a retirement.',
      pathway: 'retirement',
      values: {
        function_name: 'Treatment plant daily operation',
        function_area: 'Treatment',
        description:
          'Daily rounds, chemical dosing, process adjustments, and logbook entries for the treatment plant.',
        linked_program: 'Treatment',
        required_certification_type: 'Water treatment plant operator',
        required_certification_grade: 'C',
      },
      referenceHint: 'Link to a facility or schedule if applicable.',
    },
    {
      label: 'SCADA operations and alarm response',
      why: 'Who monitors alarms overnight and can respond when the primary operator is unavailable?',
      pathway: 'single_point',
      values: {
        function_name: 'SCADA operations and alarm response',
        function_area: 'Operations',
        description:
          'Monitor SCADA alarms, acknowledge events, and dispatch or respond per district protocol.',
        linked_program: 'SCADA',
        required_certification_type: 'Water treatment plant operator',
        required_certification_grade: 'B',
      },
      referenceHint: 'Link to a facility or schedule if your district tracks them in AquaSafe.',
    },
    {
      label: 'Backflow prevention program',
      why: 'Cross-connection control often depends on one certified inspector.',
      pathway: 'single_point',
      values: {
        function_name: 'Backflow prevention program',
        function_area: 'Compliance',
        description:
          'Annual backflow device testing, customer notifications, and violation follow-up.',
        linked_program: 'Cross-connection control',
      },
      referenceHint: 'Link to a facility or schedule if applicable.',
    },
    {
      label: 'Chemical delivery receiving and verification',
      why: 'Accepting bulk chemical deliveries safely requires site-specific knowledge that rarely gets written down.',
      pathway: 'single_point',
      values: {
        function_name: 'Chemical delivery receiving and verification',
        function_area: 'Treatment',
        description:
          'Verify chemical deliveries against orders, supervise transfer to bulk storage, and check containment and safety systems.',
        linked_program: 'Treatment',
      },
      referenceHint: 'Link to the treatment facility that receives deliveries.',
    },
    {
      label: 'Compliance sampling and DOH reporting',
      why: 'Missed samples or late reports can trigger regulatory follow-up.',
      pathway: 'compliance',
      values: {
        function_name: 'Compliance sampling and DOH reporting',
        function_area: 'Compliance',
        description:
          'Collect routine and special samples, chain-of-custody, and submit required NYSDOH reports.',
        linked_program: 'Sampling',
      },
      referenceHint: 'Link to sampling schedules in AquaSafe when available.',
    },
    {
      label: 'PFAS quarterly sampling',
      why: 'Emerging-contaminant programs add sampling obligations that need a trained owner and QA-aware backup.',
      pathway: 'compliance',
      values: {
        function_name: 'PFAS quarterly sampling',
        function_area: 'Compliance',
        description:
          'Quarterly PFAS sample collection per NYSDOH guidance, including PFAS-specific contamination-avoidance protocol.',
        linked_program: 'PFAS',
      },
      referenceHint: 'Link to the PFAS sampling schedule if it exists in AquaSafe.',
    },
    {
      label: 'Lead service line inventory (LSLR)',
      why: 'LSLR inventory and replacement scheduling is a growing mandate that often lands on one person.',
      pathway: 'compliance',
      values: {
        function_name: 'Lead service line inventory and replacement',
        function_area: 'Distribution',
        description:
          'Maintain the service-line materials inventory, update records after field verifications, and schedule replacements.',
        linked_program: 'LSLR',
      },
      referenceHint: 'Link to a facility or schedule if applicable.',
    },
    {
      label: 'After-hours emergency callout',
      why: 'Identify who is authorized to respond to main breaks and water-quality emergencies.',
      pathway: 'emergency',
      values: {
        function_name: 'After-hours emergency callout',
        function_area: 'Operations',
        description:
          'On-call response for main breaks, loss of pressure, and water-quality emergencies.',
        linked_program: 'Emergency response',
      },
      referenceHint: 'Assign primary and backup coverage once employees are entered.',
    },
    {
      label: 'Distribution valve exercising and flushing',
      why: 'Maintaining distribution integrity requires scheduled field work with trained staff — a natural cross-training assignment.',
      pathway: 'bench',
      values: {
        function_name: 'Distribution valve exercising and flushing',
        function_area: 'Distribution',
        description:
          'Exercise valves, conduct unidirectional flushing, and document field activities.',
        linked_program: 'Distribution',
        required_certification_type: 'Distribution system operator',
        required_certification_grade: 'D',
      },
      referenceHint: 'Link to a facility or schedule if applicable.',
    },
  ],
  role_coverage: [
    {
      label: 'Treatment plant — primary',
      why: 'Chief or lead operator coverage for daily plant operations.',
      pathway: 'retirement',
      values: {
        coverage_role: 'primary',
        proficiency_level: 'expert',
        notes: 'Responsible for daily treatment rounds and chemical adjustments.',
      },
      referenceHint: 'Select the treatment function and your lead plant operator.',
    },
    {
      label: 'Treatment plant — interim during transition',
      why: 'When a retirement or vacancy is underway, name the interim owner explicitly instead of leaving it implied.',
      pathway: 'retirement',
      values: {
        coverage_role: 'interim',
        proficiency_level: 'proficient',
        notes:
          'Acting coverage during chief operator transition; review monthly until permanent hire.',
      },
      referenceHint: 'Select the treatment function and the employee acting in the interim.',
    },
    {
      label: 'SCADA — primary operator',
      why: 'Document who is the first person responsible for SCADA alarms.',
      pathway: 'single_point',
      values: {
        coverage_role: 'primary',
        proficiency_level: 'expert',
        notes: 'Primary SCADA operator for weekday day shift.',
      },
      referenceHint: 'Select the critical function (SCADA) and the employee who serves as primary.',
    },
    {
      label: 'SCADA — backup (single-point-of-failure risk)',
      why: 'If only one person knows SCADA, flag the gap and assign a developing backup.',
      pathway: 'single_point',
      values: {
        coverage_role: 'backup',
        proficiency_level: 'developing',
        notes: 'Cross-training in progress — not yet comfortable after hours.',
      },
      referenceHint: 'Select the SCADA function and an employee being cross-trained as backup.',
    },
    {
      label: 'Compliance sampling — interim coverage',
      why: 'Interim roles cover vacations, leave, or transitions without a permanent backup.',
      pathway: 'compliance',
      values: {
        coverage_role: 'interim',
        proficiency_level: 'proficient',
        notes: 'Covers sampling during primary operator vacation periods.',
      },
      referenceHint: 'Select the compliance sampling function and the interim employee.',
    },
    {
      label: 'PFAS sampling — backup needing QA training',
      why: 'A backup who has not done contaminant-specific QA training is not yet real coverage — track that honestly.',
      pathway: 'compliance',
      values: {
        coverage_role: 'backup',
        proficiency_level: 'trainee',
        notes: 'Needs PFAS-specific contamination-avoidance training before covering solo.',
      },
      referenceHint: 'Select the PFAS sampling function and the employee being trained as backup.',
    },
    {
      label: 'Emergency callout — primary on rotation',
      why: 'On-call rotations still need a documented primary so escalation is unambiguous.',
      pathway: 'emergency',
      values: {
        coverage_role: 'primary',
        proficiency_level: 'expert',
        notes: 'First call on the after-hours rotation; authorized to mobilize contractors.',
      },
      referenceHint: 'Select the emergency callout function and the current rotation lead.',
    },
    {
      label: 'Treatment plant — trainee',
      why: 'Track operators building proficiency before a retirement or vacancy.',
      pathway: 'bench',
      values: {
        coverage_role: 'trainee',
        proficiency_level: 'trainee',
        notes: 'Shadowing lead operator; target proficiency within 12 months.',
      },
      referenceHint: 'Select the treatment function and the trainee employee.',
    },
  ],
  succession_candidates: [
    {
      label: 'Ready now — assistant to chief operator',
      why: 'An internal candidate who could step into the chief role with minimal delay.',
      pathway: 'retirement',
      values: {
        readiness_level: 'now',
        training_plan_summary:
          'Already holds Grade B; completed supervisory cross-training. Ready for acting chief assignment.',
        notes: 'Discuss civil service eligibility and posting timeline with HR.',
      },
      referenceHint: 'Select the candidate employee and the chief operator target position.',
    },
    {
      label: '12–24 months — lead operator pipeline',
      why: 'Plan cross-training and CEU completion before a known retirement.',
      pathway: 'retirement',
      values: {
        readiness_level: '12-24mo',
        training_plan_summary:
          'Complete Grade B upgrade CEUs, shadow chief on budget and regulatory calls.',
        notes: 'Align readiness target date with expected retirement eligibility.',
      },
      referenceHint: 'Select the candidate employee and the target position (e.g. Chief Operator).',
    },
    {
      label: '0–12 months — SCADA cross-coverage',
      why: 'Build bench strength for a specialized function before the primary retires.',
      pathway: 'single_point',
      values: {
        readiness_level: '0-12mo',
        training_plan_summary:
          'SCADA vendor training, after-hours shadow shifts, document alarm response procedures.',
        notes: 'Pair with knowledge artifact capture for SCADA runbooks.',
      },
      referenceHint: 'Select the candidate and the position that owns SCADA responsibilities.',
    },
    {
      label: '12–24 months — compliance program owner',
      why: 'Regulatory programs (PFAS, LSLR, CCR) benefit from a named successor before the current owner moves on.',
      pathway: 'compliance',
      values: {
        readiness_level: '12-24mo',
        training_plan_summary:
          'Shadow quarterly PFAS sampling, co-author next CCR/AWQR, attend NYSDOH compliance training.',
        notes: 'Target owning one full reporting cycle independently before transition.',
      },
      referenceHint: 'Select the candidate and the position that owns compliance programs.',
    },
    {
      label: '24–36 months — distribution lead',
      why: 'Longer-horizon development for distribution system leadership.',
      pathway: 'bench',
      values: {
        readiness_level: '24-36mo',
        training_plan_summary:
          'Grade D renewal CEUs, valve program lead assignment, mentor with current distribution supervisor.',
        notes: 'Identify mentor on the next tab once employees are entered.',
      },
      referenceHint: 'Select the candidate and target distribution supervisor position.',
    },
    {
      label: 'Longer horizon — apprentice to certified operator',
      why: 'Entry-level staff with a certification plan are your future bench — make the pathway visible early.',
      pathway: 'bench',
      values: {
        readiness_level: 'longer',
        training_plan_summary:
          'Complete required experience hours, sit for Grade D exam, rotate through treatment and distribution crews.',
        notes: 'Review progress at annual evaluations; adjust rotation to fill coverage gaps.',
      },
      referenceHint: 'Select the apprentice employee and an entry operator target position.',
    },
  ],
  knowledge_artifacts: [
    {
      label: 'Plant startup and shutdown SOP',
      why: 'Seasonal or emergency shutdowns rely on documented steps that may live with one operator.',
      pathway: 'retirement',
      values: {
        external_id: 'SAMPLE-SOP-PLANT-STARTUP',
        artifact_type: 'sop',
        title: 'Treatment plant startup and shutdown SOP',
        summary:
          'Step-by-step procedures for seasonal startup, emergency shutdown, and chemical system isolation.',
        notes: 'Capture from retiring chief operator; verify with current NYSDOH requirements.',
      },
      referenceHint: 'Link to the treatment plant critical function and the source employee.',
    },
    {
      label: 'Retiring operator interview transcript',
      why: 'Structured exit interviews capture decision history that SOPs miss.',
      pathway: 'retirement',
      values: {
        external_id: 'SAMPLE-INTERVIEW-RETIREMENT',
        artifact_type: 'interview_transcript',
        title: 'Retiring chief operator knowledge interview',
        summary:
          'Recorded interview covering unwritten procedures, seasonal adjustments, and regulatory relationships.',
        notes: 'Schedule before last 30 days on the job; redact personal information.',
      },
      referenceHint: 'Select the retiring employee as the source and the function they own.',
    },
    {
      label: 'Seasonal source and blending decision history',
      why: 'Why the district switches sources or adjusts blending each season usually lives in one person’s head.',
      pathway: 'retirement',
      values: {
        external_id: 'SAMPLE-DECISIONS-SOURCE-BLENDING',
        artifact_type: 'decision_history',
        title: 'Seasonal source switching and blending decisions',
        summary:
          'Rationale for seasonal well rotation, blending ratios, and demand-driven source changes over recent years.',
        notes:
          'Capture alongside the retiring operator interview; note the triggers, not just the settings.',
      },
      referenceHint: 'Link to the treatment or operations function and the source employee.',
    },
    {
      label: 'Well pump troubleshooting guide',
      why: 'Field troubleshooting knowledge is often tribal — document before it walks out the door.',
      pathway: 'single_point',
      values: {
        external_id: 'SAMPLE-TROUBLESHOOT-WELL-PUMP',
        artifact_type: 'troubleshooting',
        title: 'Well pump troubleshooting guide',
        summary:
          'Common alarm codes, VFD resets, and vendor escalation paths for production wells.',
        notes: 'Include photos of local control panels and panel locations.',
      },
      referenceHint: 'Link to the relevant critical function and the operator who knows the wells.',
    },
    {
      label: 'SCADA alarm response training notes',
      why: 'Training materials support backup operators building proficiency.',
      pathway: 'single_point',
      values: {
        external_id: 'SAMPLE-TRAINING-SCADA',
        artifact_type: 'training_note',
        title: 'SCADA alarm response training notes',
        summary:
          'Annotated alarm list, escalation tree, and practice scenarios for backup operators.',
        notes: 'Pair with role coverage trainee assignments.',
      },
      referenceHint: 'Link to the SCADA critical function.',
    },
    {
      label: 'PFAS sampling protocol quick reference',
      why: 'Contaminant-specific sampling protocols are easy to get wrong — a backup needs them written down.',
      pathway: 'compliance',
      values: {
        external_id: 'SAMPLE-SOP-PFAS-SAMPLING',
        artifact_type: 'sop',
        title: 'PFAS sampling protocol quick reference',
        summary:
          'Contamination-avoidance checklist, approved containers, field blanks, and lab courier handoff steps for PFAS sampling.',
        notes: 'Review against the latest NYSDOH guidance each year.',
      },
      referenceHint: 'Link to the PFAS sampling critical function.',
    },
    {
      label: 'Main break response playbook',
      why: 'A 2 AM main break is not the time to figure out who to call and where the valve maps are.',
      pathway: 'emergency',
      values: {
        external_id: 'SAMPLE-SOP-MAIN-BREAK',
        artifact_type: 'sop',
        title: 'Main break response playbook',
        summary:
          'Isolation steps, shutdown maps, notification requirements, contractor mobilization, and boil-water decision criteria.',
        notes:
          'Keep a printed copy in each response vehicle; walk through it at an annual tabletop exercise.',
      },
      referenceHint: 'Link to the emergency callout critical function.',
    },
    {
      label: 'Critical vendor contact list',
      why: 'Contracts and emergency vendors should not depend on one person’s phone contacts.',
      pathway: 'emergency',
      values: {
        external_id: 'SAMPLE-VENDOR-CONTACTS',
        artifact_type: 'vendor_contact',
        title: 'Critical vendor and contractor contact list',
        summary:
          'SCADA support, chemical supplier, excavation contractor, and lab courier contacts with after-hours numbers.',
        notes: 'Review annually; store a copy off-site for emergency use.',
      },
      referenceHint: 'Optionally link to the function this supports (e.g. SCADA or treatment).',
    },
  ],
  transition_milestones: [
    {
      label: 'Retirement announcement and timeline',
      why: 'Communicate early so HR and the board can align on civil service rules.',
      pathway: 'retirement',
      values: {
        milestone_type: 'announcement',
        title: 'Announce chief operator retirement timeline',
        status: 'planned',
        toolkit_phase: 'plan',
        notes: 'Coordinate with board and union/civil service before public announcement.',
      },
      referenceHint: 'Select the position being vacated (e.g. Chief Operator).',
    },
    {
      label: 'Civil service posting',
      why: 'Track posting deadlines for classified positions.',
      pathway: 'retirement',
      values: {
        milestone_type: 'posting',
        title: 'Post civil service vacancy — chief operator',
        status: 'planned',
        toolkit_phase: 'hire',
        notes: 'Confirm minimum qualifications and operator grade requirements with HR.',
      },
      referenceHint: 'Select the vacant or soon-to-be-vacant position.',
    },
    {
      label: 'Form the interview panel',
      why: 'A search committee with operations, HR, and board representation avoids a stalled hire.',
      pathway: 'retirement',
      values: {
        milestone_type: 'search_committee',
        title: 'Form interview panel for chief operator search',
        status: 'planned',
        toolkit_phase: 'hire',
        notes:
          'Include at least one person who understands the day-to-day operational requirements.',
      },
      referenceHint: 'Select the position being filled and the panel coordinator as owner.',
    },
    {
      label: 'Knowledge capture sprint',
      why: 'Block time for SOP and interview capture before the departure date.',
      pathway: 'retirement',
      values: {
        milestone_type: 'knowledge_capture',
        title: 'Knowledge capture sprint — 60 days before departure',
        status: 'planned',
        toolkit_phase: 'transition',
        notes: 'Schedule SOP reviews, vendor walkthroughs, and recorded interviews.',
      },
      referenceHint: 'Select the position and assign an owner employee to coordinate capture.',
    },
    {
      label: 'SCADA backup handoff walkthrough',
      why: 'Cross-training needs a scheduled, supervised handoff — not just good intentions.',
      pathway: 'single_point',
      values: {
        milestone_type: 'handoff',
        title: 'Supervised SCADA handoff — backup runs a full week',
        status: 'planned',
        toolkit_phase: 'transition',
        notes: 'Backup operates SCADA for one week with the primary available; log gaps found.',
      },
      referenceHint: 'Select the position that owns SCADA and the backup employee as owner.',
    },
    {
      label: '30-day new-hire check-in',
      why: 'Structured check-ins reduce early turnover and knowledge gaps.',
      pathway: 'bench',
      values: {
        milestone_type: 'checkin_30',
        title: '30-day check-in with new chief operator',
        status: 'planned',
        toolkit_phase: 'sustain',
        notes: 'Review coverage assignments, CEU plan, and open knowledge artifacts.',
      },
      referenceHint: 'Select the position and the mentor or supervisor as milestone owner.',
    },
    {
      label: '90-day proficiency review',
      why: 'Confirm the new hire can operate independently on critical functions.',
      pathway: 'bench',
      values: {
        milestone_type: 'checkin_90',
        title: '90-day proficiency review',
        status: 'planned',
        toolkit_phase: 'sustain',
        notes: 'Validate role coverage updates and close remaining knowledge gaps.',
      },
      referenceHint: 'Select the position and owner employee for the review.',
    },
  ],
};

/** Group an entity's samples by pathway, in WORKFORCE_PATHWAYS order. */
export function samplesByPathway(
  samples: SampleTemplateRow[]
): { pathway: WorkforcePathway; samples: SampleTemplateRow[] }[] {
  return WORKFORCE_PATHWAYS.map(pathway => ({
    pathway,
    samples: samples.filter(s => s.pathway === pathway.id),
  })).filter(group => group.samples.length > 0);
}

const SHOW_SAMPLE_TEMPLATES_KEY = 'aquasafe.workforce.show-sample-templates';

export function loadShowSampleTemplates(districtCode: string): boolean {
  try {
    const raw = window.localStorage.getItem(`${SHOW_SAMPLE_TEMPLATES_KEY}:${districtCode}`);
    return raw === 'true';
  } catch {
    return false;
  }
}

export function saveShowSampleTemplates(districtCode: string, on: boolean): void {
  try {
    window.localStorage.setItem(`${SHOW_SAMPLE_TEMPLATES_KEY}:${districtCode}`, String(on));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Keys that must stay empty in sample values (FK / reference fields). */
export const SAMPLE_REFERENCE_FIELDS: Record<SampleTemplateEntityType, string[]> = {
  critical_functions: [],
  role_coverage: ['function_id', 'employee_id'],
  succession_candidates: ['employee_id', 'target_position_id', 'mentor_employee_id'],
  knowledge_artifacts: ['function_id', 'source_employee_id'],
  transition_milestones: ['position_id', 'owner_employee_id'],
};

export function samplesForEntity(entityType: WorkforceEntityType): SampleTemplateRow[] {
  if (!(SAMPLE_TEMPLATE_ENTITY_TYPES as readonly string[]).includes(entityType)) {
    return [];
  }
  return ENTITY_SAMPLE_TEMPLATES[entityType as SampleTemplateEntityType] ?? [];
}

/** Build form state from a sample template (reference fields left blank). */
export function formFromSample(
  sample: SampleTemplateRow,
  columns: string[]
): Record<string, string> {
  const form: Record<string, string> = {};
  for (const c of columns) {
    const raw = sample.values[c] ?? '';
    // Sample artifact IDs are placeholders — district must supply their own on save.
    if (c === 'external_id' && raw.startsWith('SAMPLE-')) {
      form[c] = '';
    } else {
      form[c] = raw;
    }
  }
  return form;
}
