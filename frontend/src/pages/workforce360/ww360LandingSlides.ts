/** Product slides for Workforce 360 landing — aligned with EPA Area 3 employer-side role. */
export type Ww360Slide = {
  id: string;
  label: string;
  headline: string;
  body: string;
  bullets: [string, string, string];
  image: string;
  alt: string;
};

export const WW360_SLIDES: Ww360Slide[] = [
  {
    id: 'ceu',
    label: 'Retention & CE',
    headline: 'Advancement and renewals after hire',
    body: 'Support long-term water careers — CE hours, renewal windows, and certification posture in one district record.',
    bullets: [
      'Operator roster tied to required CE and licenses',
      'Shortfall alerts before renewals slip',
      'Retention support, not just compliance reporting',
    ],
    image: '/landing/ww360/slide-ceu.jpg',
    alt: 'Water plant control desk at dusk with soft blue equipment glow',
  },
  {
    id: 'succession',
    label: 'Succession Planning',
    headline: 'Plan before vacancies go critical',
    body: 'Document anticipated retirements, succession risks, and bench strength — so candidate development can start early.',
    bullets: [
      'Expected openings in the next 12 months and beyond',
      'Role coverage and credential gaps by seat',
      'Proactive planning, not reactive recruitment',
    ],
    image: '/landing/ww360/slide-succession.jpg',
    alt: 'Senior and mid-career operators mentoring on a plant walkway at blue hour',
  },
  {
    id: 'scheduled',
    label: 'Training Connections',
    headline: 'Close skill and certification gaps',
    body: 'Surface OWW and NYS training where operators already work — tied to the gaps your utility identifies.',
    bullets: [
      'Course windows visible in-district',
      'Connect identified training needs to available seats',
      'From workforce gap to registration without guesswork',
    ],
    image: '/landing/ww360/slide-scheduled.jpg',
    alt: 'Empty professional training classroom ready for operator courses',
  },
  {
    id: 'readiness',
    label: 'Workforce Intelligence',
    headline: 'See coverage risk before someone is out',
    body: 'Understand critical positions, staffing levels, and who can actually cover the shift when needs arise.',
    bullets: [
      'Current staffing and critical-role visibility',
      'Coverage risk when credentials or hours lag',
      'Workforce snapshots districts can act on',
    ],
    image: '/landing/ww360/slide-readiness.jpg',
    alt: 'Night exterior of a water treatment plant with a lit doorway',
  },
  {
    id: 'ls-sync',
    label: 'OWW Bridge',
    headline: 'Training in OWW → proof in-district',
    body: 'One Water Workforce trains through Learning Stream; Workforce 360 holds the employer-side record — CE credit, roster, and readiness without double entry.',
    bullets: [
      'Attendance becomes CE credit in Workforce 360',
      'Supply-side training meets demand-side planning',
      'One source of truth for compliance and continuity',
    ],
    image: '/landing/ww360/slide-ls-sync.jpg',
    alt: 'Training space meeting plant corridor light — training connected to operations',
  },
];

/** Hero / main-stage rotator — full-bleed photos with overlay copy. */
export type Ww360StageSlide = {
  id: string;
  label: string;
  /** When true, show large on-dark logo instead of eyebrow + treat headline as secondary */
  logoFocus?: boolean;
  /** When true, diagram-only partners slide (WW360 → AquaSafe + OWW) — no copy/CTAs */
  partnersFocus?: boolean;
  headline: string;
  /** Optional italic/accent phrase appended visually via <em> in the first sentence pattern */
  headlineAccent?: string;
  body: string;
  image: string;
  alt: string;
  /** CSS background-position for cover crop (subjects sit lower after top crop) */
  focus?: string;
};

export const WW360_STAGE_SLIDES: Ww360StageSlide[] = [
  {
    id: 'brand',
    label: 'Workforce 360',
    logoFocus: true,
    headline: 'Employer-side workforce planning',
    headlineAccent: 'for New York utilities.',
    body: 'Water Workforce 360 helps utilities document staffing, anticipated vacancies, retirements, and training needs — so One Water Workforce can connect candidate development before gaps become emergencies.',
    image: '/landing/ww360/hero.jpg',
    alt: 'Water utility team reviewing plans and a tablet at a treatment plant at dusk',
    focus: 'center 45%',
  },
  ...WW360_SLIDES.map(s => ({
    id: s.id,
    label: s.label,
    headline: s.headline,
    body: s.body,
    image: s.image,
    alt: s.alt,
    focus:
      s.id === 'scheduled'
        ? 'center 48%'
        : s.id === 'readiness'
          ? 'center 55%'
          : s.id === 'succession'
            ? 'center 50%'
            : 'center 42%',
  })),
  {
    id: 'partners',
    label: 'Partners',
    partnersFocus: true,
    headline: '',
    body: '',
    image: '',
    alt: 'Water Workforce 360 at the center of the partnership with NYSAWWA, AquaSafe, and One Water Workforce',
  },
];

export const WW360_SLIDE_INTERVAL_MS = 7000;
export const WW360_STAGE_TRANSITION_MS = 550;
