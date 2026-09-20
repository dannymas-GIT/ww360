import { describe, expect, it } from 'vitest';
import {
  applyStudioPlaceholders,
  templateLooksGrantRelated,
  varsFromEpaIwiwdAutofill,
} from './studioTemplateFill';

describe('applyStudioPlaceholders', () => {
  it('fills known keys and leaves unknown tokens', () => {
    const md = '**Applicant:** {{applicant}}  \n**State:** {{state_code}}  \n**UEI:** {{uei}}';
    expect(
      applyStudioPlaceholders(md, { applicant: 'One Water Workforce', state_code: 'NY' })
    ).toBe('**Applicant:** One Water Workforce  \n**State:** NY  \n**UEI:** {{uei}}');
  });

  it('clears keys that are present but empty', () => {
    expect(applyStudioPlaceholders('Hello {{name}}', { name: '' })).toBe('Hello ');
  });
});

describe('varsFromEpaIwiwdAutofill', () => {
  it('flattens stats and top-level fields', () => {
    const vars = varsFromEpaIwiwdAutofill(
      {
        applicant: 'OWW NY',
        state_code: 'NY',
        opportunity_number: 'EPA-OW-OWM-26-03',
        deadline: '2026-10-05',
        suggested_project_area: 'area_3',
        stats: { cws_count: 1200, population_served: 50000 },
        narrative_bullets: ['First bullet', 'Second bullet'],
      },
      { applicant: 'Fallback Partner' }
    );
    expect(vars.applicant).toBe('OWW NY');
    expect(vars.state_code).toBe('NY');
    expect(vars.opportunity_number).toBe('EPA-OW-OWM-26-03');
    expect(vars.cws_count).toBe('1200');
    expect(vars.population_served).toBe('50000');
    expect(vars.narrative_bullets).toContain('First bullet');
  });
});

describe('templateLooksGrantRelated', () => {
  it('detects EPA / SAM / grant template ids', () => {
    expect(templateLooksGrantRelated('epa-iwiwd-2026-sam-gov')).toBe(true);
    expect(templateLooksGrantRelated('epa-iwiwd-2026-narrative')).toBe(true);
    expect(templateLooksGrantRelated('sop')).toBe(false);
    expect(templateLooksGrantRelated(null)).toBe(false);
  });
});
