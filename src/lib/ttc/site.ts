/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TERCERO TABLADA — public site content & configuration
 * ─────────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for the marketing site. Navigation, contact details,
 * services, process steps, credentials and legal copy all live here so they can
 * be updated in one place (and later swapped for a CMS without touching the UI).
 *
 * ⚠ CONTENT INTEGRITY RULES — please keep these when editing:
 *   • Never add a client name, project, metric, testimonial, year-count or
 *     license number that is not verified. Empty is better than invented.
 *   • `contact.phone` / `contact.address` are `null` until they are real. The UI
 *     omits those blocks entirely rather than printing "coming soon".
 *   • `leadership.published` stays `false` until a real bio + portrait exist.
 *     While false the About page renders an accountability section instead —
 *     never a "profile forthcoming" placeholder.
 *   • `projects` is empty until real, publishable work exists. Until then the
 *     work page renders `engagements` (anonymized, representative scope).
 *   • Photographs and video come from `media.ts` and illustrate TYPOLOGIES and
 *     SERVICES — never a specific job. Read that file's rules before adding a
 *     placement; the "one placement per asset" rule is enforced by hand.
 */

import { photo, video, type Photo } from './media';

/* ═══════════════════════════════════════════════════════════════════════════
   COMPANY
   ═══════════════════════════════════════════════════════════════════════════ */

export const company = {
  /**
   * The firm is named "Tercero Tablada Civil & Structural Engineering Inc."
   * — that is the name, not a legal long-form of a shorter brand. `name` is
   * therefore the full name and is what belongs in page titles, metadata,
   * schema.org, alt text and any sentence that names the practice.
   *
   * `shortName` exists ONLY for places where the full name genuinely cannot
   * fit (a drawing title block, a compact chip). Never reach for it just to
   * make a line shorter.
   */
  legalName: 'Tercero Tablada Civil & Structural Engineering Inc.',
  name: 'Tercero Tablada Civil & Structural Engineering Inc.',
  shortName: 'Tercero Tablada',
  discipline: 'Civil & Structural Engineering',
  url: 'https://ttcivilstructural.com',
  /** Used in <meta description> fallbacks and Organization schema. */
  description:
    'Structural engineering practice serving South Florida — reinforced-concrete design, structural analysis and foundations, BIM coordination, building recertification, building safety inspections, condition assessments and peer review.',
  positioning: {
    line1: 'We design new structures.',
    line2: 'We protect existing ones.',
    body: 'Tercero Tablada Civil & Structural Engineering Inc. provides structural engineering, building evaluation and BIM coordination for new and existing buildings throughout South Florida.',
  },
  /**
   * Two real brand assets, both supplied by the client — never redraw either.
   *   lockup* = full horizontal signature (TT monogram + wordmark + tagline).
   *             This is the primary mark; use it wherever there is width.
   *   mark*   = monogram only, for tight spots (favicons, small chips).
   * The `dark` variants are for LIGHT backgrounds and the `light` variants
   * are white, for DARK backgrounds only.
   */
  logo: {
    lockupDark: '/ttc/img/logo-horizontal.png',
    lockupLight: '/ttc/img/logo-white-wide.png',
    /** Intrinsic size of both lockups, for correct aspect + no layout shift. */
    lockupSize: { w: 2172, h: 827 },
    dark: '/ttc/img/logo-square.png',
    light: '/ttc/img/logo-white.png',
  },
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   CONTACT
   ═══════════════════════════════════════════════════════════════════════════
   `null` means "not configured yet" — the UI skips it. Do not substitute a
   placeholder string. When the domain mailbox info@ttcivilstructural.com is
   live, swap `email` for it (keep the old one as a forwarding alias first).
   ═══════════════════════════════════════════════════════════════════════════ */

export const contact = {
  email: 'info@tercerotablada.com',
  /** e.g. { display: '(305) 555-0100', href: 'tel:+13055550100' } */
  phone: null as { display: string; href: string } | null,
  /** e.g. { line1: '…', line2: '…', city: 'Miami', state: 'FL', zip: '33131' } */
  address: null as {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
  } | null,
  serviceAreaLabel: 'Miami-Dade & Broward County, Florida',
  /** Social profiles — only add a URL once the profile actually exists. */
  social: {
    linkedin: null as string | null,
  },
  /** Response expectation shown near the contact form. Keep it achievable. */
  responseNote: 'Inquiries are reviewed by an engineer, not a call center.',
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════════════════════════════════ */

export type NavItem = { href: string; label: string; description?: string };

export const primaryNav: NavItem[] = [
  { href: '/services', label: 'Expertise' },
  { href: '/existing-buildings', label: 'Existing Buildings' },
  { href: '/services/bim-coordination', label: 'BIM' },
  { href: '/projects', label: 'Work' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export const primaryCta = { href: '/contact', label: 'Start a project' };

export const footerNav: { title: string; items: NavItem[] }[] = [
  {
    title: 'Navigate',
    items: [
      { href: '/services', label: 'Expertise' },
      { href: '/existing-buildings', label: 'Existing Buildings' },
      { href: '/projects', label: 'Work' },
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   SERVICES
   ═══════════════════════════════════════════════════════════════════════════ */

export type ServiceTrack = 'new' | 'existing';

export type Service = {
  slug: string;
  /** Two-digit index used as the section number in the UI. */
  n: string;
  title: string;
  /** Short label for nav / footer / form dropdowns. */
  shortTitle: string;
  track: ServiceTrack;
  /** One or two lines. Used on cards and list rows. */
  summary: string;
  /** The problem this service solves, in the client's terms. */
  problem: string;
  /** Who it is for. */
  audience: string[];
  /** Typical scope of work — full sentences, used on the service page. */
  scope: string[];
  /** Three-to-five word labels for cards and the home list. Not sentences. */
  capabilities: string[];
  /** How the work runs, step by step. */
  process: { step: string; detail: string }[];
  /** What the client receives. */
  deliverables: string[];
  /** Honest caveats — what changes the scope, what we do not promise. */
  considerations: string[];
  /**
   * When the obligation is triggered. Only the two existing-building services
   * carry one, because only they are driven by a statute or a county code
   * rather than by a client's programme.
   *
   * THESE NUMBERS ARE REGULATORY AND THEY MOVE — the milestone trigger changed
   * twice between 2022 and 2023 alone. `source` names the authority so the next
   * person can re-check rather than guess, and `note` carries the caveat that
   * has to travel with any published threshold. Re-verify before amending.
   */
  timing?: {
    source: string;
    note: string;
    rows: { k: string; v: string }[];
  };
  /** Reference standards. Kept short; this is not a code list. */
  standards: string[];
  /** Line-art key used by the diagram registry in `mp/art.tsx`. Still used on
   *  the service CARDS and the home expertise pane, where there is no photo. */
  art:
    | 'rebar'
    | 'frame'
    | 'bim'
    | 'recert'
    | 'inspection'
    | 'assessment'
    | 'peer';
  seo: { title: string; description: string; keywords: string[] };
};

export const services: Service[] = [
  {
    slug: 'reinforced-concrete-design',
    n: '01',
    title: 'Reinforced Concrete Design',
    shortTitle: 'Reinforced Concrete Design',
    track: 'new',
    summary:
      'Foundations, columns, beams, slabs and shear walls designed as one load path — detailed for the field and issued permit-ready.',
    problem:
      'Concrete is unforgiving: reinforcement that cannot be placed, a transfer condition resolved late, or a slab thickness set before the loads are known all become field problems that cost far more than they saved. The design has to be right on paper before it is right in formwork.',
    audience: [
      'Developers and building owners',
      'Architects carrying a project through permitting',
      'General contractors and concrete subcontractors',
    ],
    capabilities: [
      'Foundations',
      'Columns & beams',
      'Slabs',
      'Shear walls',
      'Reinforcement detailing',
    ],
    scope: [
      'Gravity system — slabs, beams, girders, columns',
      'Lateral system — shear walls, frames, diaphragms',
      'Foundations — spread footings, mats, grade beams, pile caps',
      'Transfer conditions, openings and irregular framing',
      'Reinforcement design, development and splice detailing',
      'Construction-phase RFIs and submittal review',
    ],
    process: [
      {
        step: 'Load take-down',
        detail:
          'Occupancy, dead, live, wind and seismic demand established against ASCE 7 before any member is sized.',
      },
      {
        step: 'System selection',
        detail:
          'Framing layout, slab type and lateral strategy chosen with the architect — span, depth and cost tested together.',
      },
      {
        step: 'Analysis & sizing',
        detail:
          'Members analyzed and designed to ACI 318 and the Florida Building Code, with deflection and serviceability checked.',
      },
      {
        step: 'Detailing',
        detail:
          'Reinforcement drawn so it can actually be placed — congestion, cover, hooks and splices resolved on the drawing.',
      },
      {
        step: 'Review & seal',
        detail:
          'Independent internal check, then signed and sealed for permit submittal.',
      },
    ],
    deliverables: [
      'Structural drawing set, permit-ready',
      'Structural calculations package',
      'General notes and typical details',
      'Signed and sealed documents where the scope requires it',
    ],
    considerations: [
      'Foundation design depends on a geotechnical report; where none exists we will tell you what is needed before we start.',
      'Scope and fee change with irregularity — transfers, cantilevers, post-tensioning and unusual geometry are priced honestly, not absorbed silently.',
      'Permit review comments are part of the process; we respond to them, but no engineer can guarantee a jurisdiction’s decision.',
    ],
    standards: ['ACI 318', 'ASCE 7', 'Florida Building Code'],
    art: 'rebar',
    seo: {
      title: 'Reinforced Concrete Design',
      description:
        'Reinforced concrete design for South Florida buildings — foundations, columns, beams, slabs and shear walls detailed to ACI 318 and the Florida Building Code, issued permit-ready.',
      keywords: [
        'reinforced concrete design',
        'concrete structure design Miami',
        'structural engineer Miami',
        'ACI 318 concrete design Florida',
      ],
    },
  },
  {
    slug: 'structural-analysis',
    n: '02',
    title: 'Structural Analysis & Foundations',
    shortTitle: 'Structural Analysis',
    track: 'new',
    summary:
      'Gravity and lateral analysis, wind and seismic demand, and the foundation system that carries all of it into the ground.',
    problem:
      'Every building is a single continuous load path from roof to soil. When gravity, lateral and foundation design are handled as separate exercises, the seams between them are where failures and change orders live.',
    audience: [
      'Design teams needing a complete structural model',
      'Owners evaluating feasibility or structural options',
      'Contractors assessing constructability of a system',
    ],
    capabilities: [
      '3D modelling',
      'Wind & seismic demand',
      'Drift control',
      'Deep foundations',
      'Settlement checks',
    ],
    scope: [
      'Three-dimensional analytical modelling of the structure',
      'Wind and seismic demand per ASCE 7',
      'Lateral system selection and drift control',
      'Diaphragm, collector and load-path continuity checks',
      'Shallow and deep foundation design',
      'Settlement, bearing and uplift verification against the geotechnical report',
    ],
    process: [
      {
        step: 'Define the demand',
        detail:
          'Risk category, exposure, wind speed and seismic parameters fixed for the actual site — not assumed.',
      },
      {
        step: 'Build the model',
        detail:
          'Geometry, stiffness, restraints and mass assembled into one analytical model of the whole structure.',
      },
      {
        step: 'Analyze',
        detail:
          'Gravity, wind and seismic load combinations run; drift, torsion and stability checked.',
      },
      {
        step: 'Resolve the foundation',
        detail:
          'Reactions carried into a foundation system matched to the soil report and site constraints.',
      },
      {
        step: 'Document',
        detail:
          'Results traced back into drawings and a calculation package a reviewer can follow.',
      },
    ],
    deliverables: [
      'Analysis model and results summary',
      'Load and load-combination documentation',
      'Foundation design and reactions schedule',
      'Structural calculations package',
    ],
    considerations: [
      'Foundation recommendations are only as good as the geotechnical data behind them.',
      'Existing structures require field verification before an analytical model can be trusted.',
      'Analysis results are reported as they are — including when they show a system does not work.',
    ],
    standards: ['ASCE 7', 'ACI 318', 'AISC 360', 'Florida Building Code'],
    art: 'frame',
    seo: {
      title: 'Structural Analysis & Foundations',
      description:
        'Structural analysis and foundation design for South Florida — gravity and lateral systems, wind and seismic demand per ASCE 7, shallow and deep foundations.',
      keywords: [
        'structural analysis South Florida',
        'foundation design Miami',
        'wind and seismic analysis ASCE 7',
        'lateral system design',
      ],
    },
  },
  {
    slug: 'bim-coordination',
    n: '03',
    title: 'BIM Modeling & Coordination',
    shortTitle: 'BIM Coordination',
    track: 'new',
    summary:
      'Coordinated digital models that resolve conflicts before they reach the field and produce clearer structural deliverables.',
    problem:
      'Most conflicts between structure, architecture and MEP are discovered on site, where they are most expensive to fix. A coordinated model moves that discovery back into design, where it costs a conversation instead of a change order.',
    audience: [
      'Design teams running multi-discipline coordination',
      'Contractors requiring model-based deliverables',
      'Owners who want the as-designed model to survive into operations',
    ],
    capabilities: [
      'Structural modelling',
      'Model federation',
      'Clash detection',
      'Issue tracking',
      'Model-derived drawings',
    ],
    scope: [
      'Structural modelling — foundations, columns, slabs, walls, framing',
      'Federation of structural, architectural and MEP models',
      'Interference checking and clash resolution tracking',
      'Model-derived drawings, schedules and quantities',
      'Coordination meetings and issue reporting',
      'Model delivery aligned to project information requirements',
    ],
    process: [
      {
        step: 'Set the rules',
        detail:
          'Shared coordinates, level and grid naming, model breakdown and level of information agreed before modelling starts.',
      },
      {
        step: 'Model the structure',
        detail:
          'The structural model is built as the design source, not as a drafting by-product.',
      },
      {
        step: 'Federate',
        detail:
          'Discipline models combined and checked against each other on a fixed cycle.',
      },
      {
        step: 'Resolve',
        detail:
          'Conflicts logged, assigned and tracked to closure — with the structural fix engineered, not improvised.',
      },
      {
        step: 'Deliver',
        detail:
          'Drawings, schedules and the model itself issued as one consistent set.',
      },
    ],
    deliverables: [
      'Structural model at the agreed level of information',
      'Clash and issue reports with resolution status',
      'Model-derived drawings and schedules',
      'Coordination record for the project file',
    ],
    considerations: [
      'Coordination quality depends on what the other disciplines deliver and when; the process is collaborative by definition.',
      'A model is not a substitute for a signed and sealed drawing set — it supports it.',
      'Level of information should match the decision being made, not the largest number available.',
    ],
    standards: ['ISO 19650', 'Model-based coordination'],
    art: 'bim',
    seo: {
      title: 'BIM Modeling & Coordination',
      description:
        'Structural BIM modeling and multi-discipline coordination — federated models, interference checking and model-derived structural deliverables for South Florida projects.',
      keywords: [
        'BIM coordination',
        'structural BIM modeling',
        'clash detection structural',
        'ISO 19650 coordination',
      ],
    },
  },
  {
    slug: 'building-recertification',
    n: '04',
    title: 'Building Recertification',
    shortTitle: 'Building Recertification',
    track: 'existing',
    summary:
      'A clear path from the county notice to a submitted structural recertification report — inspection, findings, repairs, reinspection.',
    problem:
      'A recertification notice arrives with a deadline, a form, and very little explanation of what actually has to happen. Boards and owners need someone who knows the sequence and can carry the structural side of it end to end.',
    audience: [
      'Condominium and homeowner associations',
      'Property managers',
      'Building owners and asset managers',
    ],
    capabilities: [
      'Notice review',
      'Site inspection',
      'Findings report',
      'Repair scope',
      'Reinspection',
    ],
    scope: [
      'Review of the notice, building records and prior reports',
      'Visual structural inspection of the building',
      'Documentation of observed conditions with photographs',
      'Structural recertification report on the required form',
      'Repair recommendations where conditions require them',
      'Reinspection after repairs and submission support',
    ],
    process: [
      {
        step: 'Notice review',
        detail:
          'We read the notice and the building’s history, then confirm what the jurisdiction is actually asking for and by when.',
      },
      {
        step: 'Site inspection',
        detail:
          'Visual structural inspection of accessible elements — frame, slabs, balconies, roof structure, foundations where exposed.',
      },
      {
        step: 'Findings',
        detail:
          'Observed conditions documented and classified, with the structural reasoning written in plain language for the board.',
      },
      {
        step: 'Repairs',
        detail:
          'Where repairs are required, we describe what has to be corrected and to what standard, so the work can be bid fairly.',
      },
      {
        step: 'Reinspection',
        detail:
          'Completed repairs are re-inspected and documented against the original findings.',
      },
      {
        step: 'Submission',
        detail:
          'The report is finalized and submitted, and we respond to questions the reviewing office raises.',
      },
    ],
    deliverables: [
      'Structural recertification report on the required form',
      'Photographic documentation of observed conditions',
      'Written repair recommendations where applicable',
      'Reinspection documentation after repairs',
    ],
    timing: {
      source:
        'Miami-Dade County Code §8-11(f) · Broward County Building Safety Inspection Program',
      note: 'A county obligation, and separate from the state milestone inspection — a building in Miami-Dade or Broward can owe both, on different deadlines and in different reports. Applicability is confirmed for your building before we start.',
      rows: [
        { k: 'First due at', v: '30 years' },
        {
          k: 'On the coast',
          v: '25 years — condominium or cooperative, three stories or more, within 3 miles of the coastline',
        },
        { k: 'Then', v: 'Every 10 years, for the life of the structure' },
        { k: 'Time to comply', v: '90 days from the date of the county notice' },
        {
          k: 'Outside the program',
          v: 'Single-family homes, duplexes, and buildings at 10 occupant load or less and 2,000 sq ft or less',
        },
      ],
    },
    considerations: [
      'Requirements vary by jurisdiction, building age and construction type — the sequence above is typical, not universal.',
      'Recertification is not a one-time event. After the first report the building is due again every ten years, for the life of the structure.',
      'Single-family homes, duplexes and buildings below the size threshold fall outside the program; applicability is confirmed case by case.',
      'Recertification covers the structural scope; electrical recertification is a separate discipline.',
      'A report documents observed conditions. No engineer can guarantee how a reviewing office will act on it.',
      'Concealed conditions may require additional investigation before conclusions can be drawn.',
    ],
    standards: ['Florida Building Code', 'Miami-Dade & Broward requirements'],
    art: 'recert',
    seo: {
      title: 'Building Recertification',
      description:
        'Structural building recertification in Miami-Dade and Broward — notice review, inspection, findings, repair recommendations, reinspection and report submission.',
      keywords: [
        'building recertification Miami-Dade',
        'building recertification Broward',
        '40 year recertification structural',
        'structural recertification report',
      ],
    },
  },
  {
    slug: 'building-safety-inspections',
    n: '05',
    title: 'Building Safety Inspections',
    shortTitle: 'Building Safety Inspections',
    track: 'existing',
    summary:
      'Milestone and structural safety inspections that document real condition — with findings written to be acted on, not filed.',
    problem:
      'A safety inspection that produces a vague report helps nobody. Owners need to know what was actually observed, what it means structurally, and what has to happen next.',
    audience: [
      'Condominium associations subject to milestone inspection',
      'Owners of aging or coastal buildings',
      'Managers preparing capital plans',
    ],
    capabilities: [
      'Structural inspection',
      'Balcony & railing review',
      'Distress mapping',
      'Prioritized findings',
    ],
    scope: [
      'Visual inspection of the primary structural system',
      'Balcony, walkway and railing structural review',
      'Concrete distress mapping — spalling, cracking, corrosion staining',
      'Waterproofing-related structural deterioration review',
      'Prioritized findings and recommended follow-up',
      'Phase two investigation scoping where warranted',
    ],
    process: [
      {
        step: 'Records review',
        detail:
          'Available drawings, prior reports and repair history reviewed before the site visit.',
      },
      {
        step: 'Field inspection',
        detail:
          'Systematic visual inspection with photographic documentation and location mapping.',
      },
      {
        step: 'Evaluation',
        detail:
          'Observations evaluated structurally — distinguishing cosmetic from structural, and urgent from monitorable.',
      },
      {
        step: 'Report',
        detail:
          'Findings issued with clear priorities and, where required, a defined scope for further investigation.',
      },
    ],
    deliverables: [
      'Inspection report with photographic record',
      'Condition findings organized by priority',
      'Recommended follow-up or further investigation scope',
      'Signed and sealed documents where the scope requires it',
    ],
    timing: {
      source: 'Florida Statute 553.899',
      note: 'A state obligation, and separate from county recertification — a building in Miami-Dade or Broward can owe both, on different deadlines and in different reports. Applicability is confirmed for your building before we start.',
      rows: [
        {
          k: 'Applies to',
          v: 'Condominium and cooperative buildings of three habitable stories or more',
        },
        {
          k: 'First due',
          v: 'By 31 December of the year the building reaches 30 years of age',
        },
        {
          k: 'On the coast',
          v: '25 years where the local enforcement agency requires it for proximity to salt water',
        },
        { k: 'Then', v: 'Every 10 years' },
        {
          k: 'Phase two',
          v: 'Only where phase one finds substantial structural deterioration',
        },
      ],
    },
    considerations: [
      'Visual inspection covers accessible, observable conditions. Concealed deterioration may require testing or selective demolition.',
      'Milestone inspection requirements depend on building age, height and location; applicability is confirmed case by case.',
      'An inspection reports condition at a point in time; it is not a warranty of future performance.',
    ],
    standards: ['Florida Building Code', 'Milestone inspection requirements'],
    art: 'inspection',
    seo: {
      title: 'Building Safety Inspections',
      description:
        'Structural building safety and milestone inspections across South Florida — visual structural inspection, concrete distress documentation and prioritized findings.',
      keywords: [
        'building safety inspection',
        'milestone inspection Florida',
        'structural inspection South Florida',
        'balcony inspection Miami',
      ],
    },
  },
  {
    slug: 'structural-condition-assessments',
    n: '06',
    title: 'Structural Condition Assessments',
    shortTitle: 'Condition Assessments',
    track: 'existing',
    summary:
      'What the building is actually doing today — deterioration assessed, capacity evaluated, repairs specified.',
    problem:
      'Cracking, spalling and movement all look alarming and mean very different things. Before spending on repairs, an owner needs to know which conditions affect capacity and which do not.',
    audience: [
      'Owners planning repairs or capital works',
      'Buyers performing structural due diligence',
      'Associations responding to inspection findings',
    ],
    capabilities: [
      'Field assessment',
      'Deterioration mapping',
      'Capacity evaluation',
      'Repair specification',
    ],
    scope: [
      'Field assessment of the structural system in its current state',
      'Concrete deterioration and reinforcement corrosion evaluation',
      'Capacity evaluation of existing members where required',
      'Evaluation of alterations, overloads and change of use',
      'Repair concept and specification',
      'Prioritization and phasing guidance',
    ],
    process: [
      {
        step: 'Understand the building',
        detail:
          'Original drawings, alterations and repair history reviewed; where drawings are missing, the structure is field-verified.',
      },
      {
        step: 'Assess condition',
        detail:
          'Deterioration mapped and its structural significance evaluated element by element.',
      },
      {
        step: 'Evaluate capacity',
        detail:
          'Where condition or use has changed, remaining capacity is checked against current demand.',
      },
      {
        step: 'Specify repair',
        detail:
          'Repairs described in enough detail to be bid, executed and inspected — not left as a general recommendation.',
      },
    ],
    deliverables: [
      'Condition assessment report',
      'Deterioration mapping and photographic record',
      'Capacity evaluation where performed',
      'Repair recommendations and specifications',
    ],
    considerations: [
      'Assessments of existing structures carry uncertainty; where it matters, testing or exploratory openings are recommended rather than assumed away.',
      'Missing original documentation increases the field verification required.',
      'Repair design is a separate scope from assessment and is quoted as such.',
    ],
    standards: ['ACI 318', 'ACI repair practice', 'Florida Building Code'],
    art: 'assessment',
    seo: {
      title: 'Structural Condition Assessments',
      description:
        'Structural condition assessments and repair recommendations for existing South Florida buildings — deterioration evaluation, capacity checks and repair specification.',
      keywords: [
        'structural condition assessment',
        'existing building evaluation',
        'concrete repair recommendations',
        'structural due diligence Miami',
      ],
    },
  },
  {
    slug: 'peer-review',
    n: '07',
    title: 'Peer Review & Compliance',
    shortTitle: 'Peer Review',
    track: 'existing',
    summary:
      'An independent second read of the structural design — code compliance, load path, constructability and documentation quality.',
    problem:
      'By the time a structural problem is found in construction, it is a schedule event. An independent review before issue is the cheapest risk reduction available on a project.',
    audience: [
      'Owners and developers managing structural risk',
      'Design teams seeking an independent check',
      'Lenders and insurers requiring third-party review',
    ],
    capabilities: [
      'Drawing review',
      'Calculation check',
      'Load-path continuity',
      'Constructability',
      'Comment log',
    ],
    scope: [
      'Independent review of structural drawings and calculations',
      'Code compliance and load-path continuity check',
      'Review of analysis assumptions and modelling',
      'Constructability and detailing review',
      'Documentation completeness and coordination review',
      'Written comment log with resolution tracking',
    ],
    process: [
      {
        step: 'Scope the review',
        detail:
          'Depth agreed up front — full review, targeted systems, or a specific concern.',
      },
      {
        step: 'Review',
        detail:
          'Drawings, calculations and models read independently against the governing code.',
      },
      {
        step: 'Comment',
        detail:
          'Findings issued as a structured comment log, prioritized by structural consequence.',
      },
      {
        step: 'Close out',
        detail:
          'Responses reviewed and comments tracked to closure so the record is complete.',
      },
    ],
    deliverables: [
      'Independent review report',
      'Prioritized comment log',
      'Resolution tracking through close-out',
    ],
    considerations: [
      'A peer review examines the design as submitted; it does not transfer engineer-of-record responsibility.',
      'Review depth and fee scale with the size and complexity of the set.',
      'Comments are written to be resolved, not to assign blame.',
    ],
    standards: ['ACI 318', 'ASCE 7', 'AISC 360', 'Florida Building Code'],
    art: 'peer',
    seo: {
      title: 'Peer Review & Compliance',
      description:
        'Independent structural peer review and engineering compliance services — code compliance, load path, constructability and documentation review for South Florida projects.',
      keywords: [
        'structural peer review',
        'independent structural review',
        'engineering compliance services',
        'structural due diligence',
      ],
    },
  },
];

export const serviceBySlug = (slug: string) =>
  services.find((s) => s.slug === slug);

/** The four services featured on the home page, in order. */
export const coreExpertiseSlugs = [
  'reinforced-concrete-design',
  'building-recertification',
  'building-safety-inspections',
  'bim-coordination',
] as const;

export const coreExpertise = coreExpertiseSlugs
  .map((slug, i) => {
    const s = serviceBySlug(slug);
    return s ? { ...s, n: String(i + 1).padStart(2, '0') } : null;
  })
  .filter((s): s is Service => s !== null);

/** Service options offered in the contact form dropdown. */
export const contactServiceOptions = [
  ...services.map((s) => s.shortTitle),
  'Other',
];

/* ═══════════════════════════════════════════════════════════════════════════
   IMAGERY
   ═══════════════════════════════════════════════════════════════════════════
   Licensed stock architecture used as texture and atmosphere only. Credits
   live in public/ttc/img/IMAGE-CREDITS.md. Nothing here is presented as a
   Tercero Tablada project — see the rules at the top of this file.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * ONE PLACEMENT PER IMAGE — still the rule. The catalogue now lives in
 * `media.ts`; this section only allocates it. Every asset below appears
 * exactly once across the whole site. If you want a photograph in a new place,
 * add a photograph — do not reuse one, because the same crop showing up twice
 * is the single fastest way to make a site look thin.
 *
 * The home page opens on VIDEO rather than a still. Four more silent loops
 * carry the sections that are about movement — a frame going up, a coastline
 * of existing buildings, structure seen from underneath, and a model
 * assembling itself. Everything else is photography.
 */
export const imagery = {
  /** Home hero — a clip, with its poster doing the work when it cannot play. */
  hero: video.heroMiami,

  /** One photograph per page hero. */
  pages: {
    services: photo.concreteBeamColumn,
    existingBuildings: photo.miamiResidentialTowers,
    work: photo.miamiCondoAerial,
    about: photo.concreteStair,
    contact: photo.miamiBrickell,
  },

  /**
   * ONE PHOTOGRAPH PER SERVICE, keyed by slug — and this is the one place the
   * "one placement per asset" rule is deliberately relaxed. A service's
   * photograph appears on its card (home and Expertise), on its row in the
   * Existing Buildings index, and on its detail page. That is not a repeat: it
   * is the service's identity image, and seeing the same picture on the card
   * you clicked and the page you land on is what makes the click feel answered.
   *
   * These replaced the line-art diagrams. The diagrams were accurate and
   * completely inert — "algo creado por un ingeniero recién graduado" was the
   * verdict, and it was right. Do not put them back on the cards.
   */
  services: {
    'reinforced-concrete-design': photo.rebarCageUp,
    'structural-analysis': photo.analysisTowersUp,
    'bim-coordination': photo.bimWireframeModel,
    'building-recertification': photo.recertBalconiesBw,
    'building-safety-inspections': photo.inspectBalconyPair,
    'structural-condition-assessments': photo.inspectWall,
    'peer-review': photo.peerTowerBw,
  } as Record<string, Photo>,

  /**
   * Backdrops for sections that used to be pure SVG plates.
   * `southFlorida` replaces a drawn "PLAN DIAGRAM — NOT TO SCALE", which was a
   * decorative rectangle admitting in its own caption that it was not a map.
   * The aerial is the actual territory; the county names stay as typography, so
   * no information was traded away for atmosphere.
   */
  sections: {
    southFlorida: photo.southFloridaAerial,
    leadership: photo.concreteRamp,
  },

  /** Representative engagement profiles on the Work page, keyed by `n`. */
  engagements: {
    '01': photo.frameUnderConstruction,
    '02': photo.midriseGlassBalconies,
    '03': photo.miamiTowersUp,
    '04': photo.rebarBundles,
    '05': photo.frameSlabEdges,
    '06': photo.rebarCageTower,
  } as Record<string, Photo>,

  /**
   * Clips used inside the page body. `design`, `existing` and `practice` are
   * full-bleed bands; `bim` sits in the bordered stage on the home page, where
   * an SVG wireframe used to be.
   */
  clips: {
    design: video.craneSky,
    existing: video.existingMidrise,
    practice: video.structureGeometry,
    bim: video.bimAssembly,
  },

  /**
   * Closing gallery on the Work page — atmosphere, deliberately uncaptioned.
   *
   * TWELVE, and the count is load-bearing: the grid runs 4 / 3 / 2 columns and
   * twelve divides by all three, so the wall closes on a straight edge at every
   * breakpoint instead of trailing a hole. Add or remove in pairs of six.
   */
  gallery: [
    photo.houseConcreteCarport,
    photo.frameGolden,
    photo.housePalm,
    photo.concreteVault,
    photo.midriseClean,
    photo.rebarSlabCrew,
    photo.concreteSteppedGold,
    photo.frameTower,
    photo.houseDarkBrick,
    photo.miamiSkylineTeal,
    photo.houseWhiteTree,
    photo.miamiBeachDusk,
  ],
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   WHAT WE DESIGN — building typologies
   ═══════════════════════════════════════════════════════════════════════════
   The single most common question a visitor arrives with is "do you do MY kind
   of building?" — and until now the site answered it only in the language of
   engineering services (analysis, detailing, peer review). This section answers
   it in the language of buildings.

   ⚠ These are TYPOLOGIES, not projects. Each carries a photograph of the kind
   of structure described, never a claim that the practice built that one. The
   section prints that distinction in its own footnote; do not remove it, and do
   not retitle this "Projects", "Portfolio" or "Our work". When real project
   photography exists it belongs in `projects`, which has its own honest frame.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Typology = {
  n: string;
  title: string;
  /** One sentence, in the client's language, not the code's. */
  lede: string;
  /** What the practice actually issues for this kind of building. */
  delivers: string[];
  /** Which half of the practice it belongs to. */
  track: ServiceTrack;
  /** Where to go for the detail. */
  href: string;
  photo: Photo;
};

export const typologies: Typology[] = [
  {
    n: '01',
    title: 'Single-family residences',
    lede: 'New houses engineered from the footing up — foundations sized to the soil report, a frame that carries wind, and drawings a local builder can price and build.',
    delivers: ['Foundation design', 'Framing & load path', 'Wind & uplift', 'Permit drawing set'],
    track: 'new',
    href: '/services/reinforced-concrete-design',
    photo: photo.houseConcreteGarden,
  },
  {
    n: '02',
    title: 'Townhouses & duplexes',
    lede: 'Party walls, shared foundations and repeated bays — the structure resolved once and detailed so the repetition stays a saving instead of a risk.',
    delivers: ['Party-wall structure', 'Repeated bay detailing', 'Lateral system', 'Unit-to-unit separation'],
    track: 'new',
    href: '/services/structural-analysis',
    photo: photo.houseTownhouses,
  },
  {
    n: '03',
    title: 'Mid-rise reinforced concrete',
    lede: 'Flat plates, shear-wall cores and cantilevered balconies — the system South Florida is built from, engineered as one continuous load path.',
    delivers: ['Flat-plate & beam framing', 'Shear-wall core', 'Balcony cantilevers', 'Reinforcement detailing'],
    track: 'new',
    href: '/services/reinforced-concrete-design',
    photo: photo.frameCurvedBalconies,
  },
  {
    n: '04',
    title: 'Mixed-use & commercial frames',
    lede: 'Long spans over ground-floor retail, transfer structure where the grid changes, and coordination with everyone whose services run through it.',
    delivers: ['Transfer structure', 'Long-span framing', 'BIM coordination', 'Model-derived drawings'],
    track: 'new',
    href: '/services/bim-coordination',
    photo: photo.frameCurvedCrane,
  },
  {
    n: '05',
    title: 'Foundations on difficult sites',
    lede: 'Tight lots, poor bearing, high water table and neighbours close enough to matter — the substructure engineered against the geotechnical report, not around it.',
    delivers: ['Mat & spread footings', 'Deep foundations', 'Settlement & uplift checks', 'Reactions schedule'],
    track: 'new',
    href: '/services/structural-analysis',
    photo: photo.rebarMatWorkers,
  },
  {
    n: '06',
    title: 'Repairs to existing structures',
    lede: 'Balconies, facades, slabs and columns that have been in service for decades — condition documented, repairs engineered, and the paperwork the county asks for.',
    delivers: ['Condition assessment', 'Repair scope & details', 'Recertification report', 'Reinspection'],
    track: 'existing',
    href: '/existing-buildings',
    photo: photo.inspectRoofHelmets,
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   THE TWO PATHS — new structures vs. existing buildings
   ═══════════════════════════════════════════════════════════════════════════ */

export type Path = {
  n: string;
  key: ServiceTrack;
  title: string;
  serifWord: string;
  lede: string;
  capabilities: string[];
  cta: { href: string; label: string };
  art: 'new' | 'existing';
  /**
   * Architectural photography used as MATERIAL, not as portfolio — never
   * captioned as the firm's work. Swap for real project photography when it
   * exists; the component does not change.
   */
  photo: Photo;
  /** Silent loop shown in place of the still where one earns its bandwidth. */
  clip?: (typeof video)[keyof typeof video];
};

export const paths: Path[] = [
  {
    n: '01',
    key: 'new',
    title: 'Design new structures',
    serifWord: 'new',
    lede: 'From the first load path to the sealed drawing set — reinforced concrete engineered as one continuous system and detailed for the people who have to build it.',
    capabilities: [
      'Reinforced Concrete Design',
      'Structural Analysis',
      'Foundations',
      'Wind & Lateral Systems',
      'Structural Detailing',
      'BIM Coordination',
      'Peer Review',
    ],
    cta: { href: '/services', label: 'Explore design services' },
    art: 'new',
    photo: photo.frameColumnsSky,
  },
  {
    n: '02',
    key: 'existing',
    title: 'Evaluate existing buildings',
    serifWord: 'existing',
    lede: 'Recertification, inspection and assessment for buildings already standing — documented condition, engineered repairs, and a clear route through compliance.',
    capabilities: [
      'Building Recertification',
      'Building Safety Inspections',
      'Structural Condition Assessments',
      'Milestone Inspections',
      'Repair Recommendations',
      'Reinspections',
      'Compliance Documentation',
    ],
    cta: { href: '/existing-buildings', label: 'Explore existing-building services' },
    art: 'existing',
    photo: photo.midriseBalconies,
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   BIM — section copy
   ═══════════════════════════════════════════════════════════════════════════
   `layers` used to live here: six ids driving the toggles on an inline SVG
   wireframe. The drawing was removed and the section now runs the model clip
   instead, so the list had nothing left to switch on and went with it.
   ═══════════════════════════════════════════════════════════════════════════ */

export const bim = {
  eyebrow: 'BIM / Digital coordination',
  title: 'Structural clarity from concept to coordination.',
  body: 'We use coordinated digital models to improve communication, reduce conflicts and produce clearer structural deliverables.',
  notes: [
    'One model as the design source, not a drafting by-product.',
    'Conflicts found and resolved in coordination, not in the field.',
    'Drawings, schedules and quantities derived from the same model.',
  ],
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   SOFTWARE & OPEN STANDARDS
   ═══════════════════════════════════════════════════════════════════════════
   Third-party brand marks, used nominatively to say which tools the practice
   works in. Only list software actually in use, and keep the logo files as
   supplied — never recolour or redraw someone else's mark.
   ═══════════════════════════════════════════════════════════════════════════ */

export const software = {
  eyebrow: 'Software & open standards',
  title: 'The model has to survive the hand-off.',
  body: 'We work in the tools the rest of the project team already uses, and exchange through open formats so the model does not become a dead end when it leaves our office.',
  items: [
    { name: 'Revit', role: 'Structural modelling', logo: '/ttc/img/software/revit.svg' },
    { name: 'Navisworks', role: 'Clash detection', logo: '/ttc/img/software/navisworks.png' },
    { name: 'Autodesk', role: 'Platform', logo: '/ttc/img/software/autodesk.svg' },
    { name: 'CYPE', role: 'Structural analysis', logo: '/ttc/img/software/cype.png' },
    { name: 'BCF', role: 'Issue exchange', logo: '/ttc/img/software/bcf.svg' },
    { name: 'buildingSMART', role: 'IFC / openBIM', logo: '/ttc/img/software/buildingsmart.png' },
  ],
  note: 'Product names and logos are the property of their respective owners and are shown to identify the software used in our workflow.',
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   PROCESSES
   ═══════════════════════════════════════════════════════════════════════════ */

export const recertificationProcess = {
  eyebrow: 'Building recertification',
  title: 'A clear path from notice to compliance.',
  /* This said "Most owners meet this process once." It is not once: under
     Miami-Dade §8-11(f) and the Broward Building Safety Inspection Program the
     first recertification is followed by another every ten years for the life
     of the structure, and F.S. 553.899 milestone inspections recur on the same
     ten-year cycle. A board reading "once" would plan capital wrong. */
  lede: 'The first notice lands at 30 years — 25 on the coast — and comes back every ten years after that. We run it end to end so the board knows what happens next at every stage.',
  steps: [
    {
      n: '01',
      title: 'Notice Review',
      detail:
        'We read the notice and the building record, confirm what the jurisdiction is asking for, and set the schedule against the stated deadline.',
    },
    {
      n: '02',
      title: 'Site Inspection',
      detail:
        'Visual structural inspection of accessible elements — frame, slabs, balconies, roof structure and exposed foundations — documented in the field.',
    },
    {
      n: '03',
      title: 'Findings',
      detail:
        'Observed conditions are classified and explained in language a board can act on, with photographs tied to locations.',
    },
    {
      n: '04',
      title: 'Repairs',
      detail:
        'Where repairs are required we define what must be corrected and to what standard, so the work can be bid and executed fairly.',
    },
    {
      n: '05',
      title: 'Reinspection',
      detail:
        'Completed repairs are re-inspected and documented against the original findings before anything is certified.',
    },
    {
      n: '06',
      title: 'Submission',
      detail:
        'The report is finalized, submitted, and we respond to questions raised by the reviewing office.',
    },
  ],
  disclaimer:
    'Requirements vary by jurisdiction, building age, construction type and scope. This describes a typical sequence, not a guaranteed procedure or outcome.',
} as const;

export const engineeringProcess = {
  eyebrow: 'How the work runs',
  title: 'Six stages. No hand-offs into silence.',
  stages: [
    {
      n: '01',
      title: 'Assess',
      action: 'Understand the building, the site and the constraint.',
      result: 'Scope, governing code and risk are fixed before design starts.',
      deliverable: 'Scope definition & code basis',
    },
    {
      n: '02',
      title: 'Analyze',
      action: 'Model the structure and quantify the demand.',
      result: 'Gravity, wind and seismic demand established for the real site.',
      deliverable: 'Analysis model & load documentation',
    },
    {
      n: '03',
      title: 'Coordinate',
      action: 'Resolve structure against architecture and MEP.',
      result: 'Conflicts are found in the model instead of in the field.',
      deliverable: 'Federated model & issue log',
    },
    {
      n: '04',
      title: 'Detail',
      action: 'Draw it so it can be built.',
      result: 'Reinforcement, connections and interfaces resolved on paper.',
      deliverable: 'Structural drawings & details',
    },
    {
      n: '05',
      title: 'Review',
      action: 'Check the work independently before it leaves.',
      result: 'Calculations, drawings and coordination verified as one set.',
      deliverable: 'Internal review record',
    },
    {
      n: '06',
      title: 'Deliver',
      action: 'Issue, submit and stay on the project.',
      result: 'Comments, RFIs and submittals answered by the engineer who designed it.',
      deliverable: 'Issued set & construction-phase support',
    },
  ],
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   REPRESENTATIVE ENGAGEMENTS
   ═══════════════════════════════════════════════════════════════════════════
   `projects` holds real, publishable project case studies. It is intentionally
   EMPTY until real ones exist — the UI falls back to `engagements` below, which
   describe representative scope and structural systems without naming clients,
   inventing metrics, or claiming work performed elsewhere.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Engagement = {
  n: string;
  title: string;
  projectType: string;
  location: string;
  scope: string;
  structuralSystem: string;
  deliverables: string;
  codes: string;
  status: string;
  art: Service['art'];
};

export const projects: Engagement[] = [];

export const engagements: Engagement[] = [
  {
    n: '01',
    title: 'Mid-rise residential frame',
    projectType: 'Residential — new construction',
    location: 'Miami-Dade County, FL',
    scope: 'Full structural design: gravity and lateral systems, foundations, detailing',
    structuralSystem: 'Reinforced concrete flat plate with shear-wall core',
    deliverables: 'Structural drawing set · Calculations · General notes',
    codes: 'ACI 318 · ASCE 7 · Florida Building Code',
    status: 'Representative scope',
    art: 'rebar',
  },
  {
    n: '02',
    title: 'Coastal condominium recertification',
    projectType: 'Existing building — recertification',
    location: 'Broward County, FL',
    scope: 'Notice review, structural inspection, findings, repair recommendations, reinspection',
    structuralSystem: 'Reinforced concrete frame with cantilevered balconies',
    deliverables: 'Recertification report · Photographic record · Repair scope',
    codes: 'Florida Building Code · County recertification requirements',
    status: 'Representative scope',
    art: 'recert',
  },
  {
    n: '03',
    title: 'Milestone structural inspection',
    projectType: 'Existing building — safety inspection',
    location: 'South Florida',
    scope: 'Visual structural inspection, concrete distress mapping, prioritized findings',
    structuralSystem: 'Reinforced concrete frame, post-tensioned slabs',
    deliverables: 'Inspection report · Distress mapping · Follow-up scope',
    codes: 'Florida Building Code · Milestone inspection requirements',
    status: 'Representative scope',
    art: 'inspection',
  },
  {
    n: '04',
    title: 'Foundation system for a constrained site',
    projectType: 'New construction — foundations',
    location: 'Miami-Dade County, FL',
    scope: 'Foundation design against geotechnical report, settlement and uplift verification',
    structuralSystem: 'Mat foundation with grade beams; deep foundations at transfer zones',
    deliverables: 'Foundation drawings · Reactions schedule · Calculations',
    codes: 'ACI 318 · ASCE 7 · Florida Building Code',
    status: 'Representative scope',
    art: 'frame',
  },
  {
    n: '05',
    title: 'Multi-discipline BIM coordination',
    projectType: 'New construction — coordination',
    location: 'South Florida',
    scope: 'Structural modelling, model federation, interference checking, issue tracking',
    structuralSystem: 'Reinforced concrete frame with long-span transfer beams',
    deliverables: 'Structural model · Clash & issue reports · Model-derived drawings',
    codes: 'ISO 19650 information management',
    status: 'Representative scope',
    art: 'bim',
  },
  {
    n: '06',
    title: 'Independent structural peer review',
    projectType: 'Design review — third party',
    location: 'South Florida',
    scope: 'Independent review of drawings and calculations, comment log, close-out tracking',
    structuralSystem: 'Reinforced concrete and structural steel, mixed system',
    deliverables: 'Review report · Prioritized comment log · Resolution record',
    codes: 'ACI 318 · ASCE 7 · AISC 360 · Florida Building Code',
    status: 'Representative scope',
    art: 'peer',
  },
];

export const engagementsNote =
  'Representative engagement profiles — anonymized scope, structural systems and deliverables. Named project case studies are published only with client permission.';

/* ═══════════════════════════════════════════════════════════════════════════
   CREDENTIALS
   ═══════════════════════════════════════════════════════════════════════════
   ⚠ Add only what is verified and currently active. Do not list a license
   number, a certification body or an affiliation that cannot be confirmed.
   ═══════════════════════════════════════════════════════════════════════════ */

export const credentials = {
  eyebrow: 'Standards & accountability',
  /**
   * Set to false if sealed deliverables are not being offered, and the sealing
   * statement disappears from the whole site.
   */
  sealedDeliverables: true,
  sealingStatement:
    'Deliverables are signed and sealed by a Florida-licensed Professional Engineer where the scope of work requires it.',
  items: [
    {
      k: 'Design basis',
      v: 'ACI 318',
      note: 'Reinforced concrete design and detailing',
    },
    {
      k: 'Loads',
      v: 'ASCE 7',
      note: 'Wind, seismic and load combinations',
    },
    {
      k: 'Governing code',
      v: 'Florida Building Code',
      note: 'Structural provisions and existing-building requirements',
    },
    {
      k: 'Steel design',
      v: 'AISC 360',
      note: 'Applied where structural steel is in scope',
    },
    {
      k: 'Coordination',
      v: 'ISO 19650',
      note: 'Model-based information management',
    },
    {
      k: 'Service area',
      v: 'Miami-Dade & Broward',
      note: 'South Florida jurisdictions',
    },
  ],
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   LEADERSHIP
   ═══════════════════════════════════════════════════════════════════════════
   Keep `published: false` until every field below is real and a professional
   portrait exists at `portrait`. While false, the About page renders the
   practice-accountability composition instead — never a "coming soon" card.
   ═══════════════════════════════════════════════════════════════════════════ */

export const leadership: {
  published: boolean;
  name: string;
  role: string;
  portrait: string;
  portraitAlt: string;
  education: string[];
  expertise: string[];
  philosophy: string;
  bio: string[];
  credentials: string[];
  fallback: {
    eyebrow: string;
    title: string;
    body: string[];
    pillars: { k: string; v: string }[];
  };
} = {
  published: false,
  name: '',
  role: '',
  /** Path under /public, e.g. '/ttc/img/leadership/portrait.jpg' */
  portrait: '',
  portraitAlt: '',
  education: [] as string[],
  expertise: [] as string[],
  philosophy: '',
  bio: [] as string[],
  credentials: [] as string[],
  /** Fallback used while `published` is false. Factual, no placeholders. */
  fallback: {
    eyebrow: 'Practice leadership',
    title: 'One engineer stays responsible for the work.',
    body: [
      'Tercero Tablada Civil & Structural Engineering Inc. is a structural practice built around direct engineering accountability. The engineer who sets the design basis is the engineer who reviews the drawings and answers the questions that come back from the field.',
      'That is the whole operating model: no anonymous hand-offs between a proposal and a drawing set, and no work released that has not been read line by line.',
    ],
    pillars: [
      {
        k: 'Direct responsibility',
        v: 'The engineer who designs it reviews it and stands behind it.',
      },
      {
        k: 'Documented reasoning',
        v: 'Every conclusion is traceable to an assumption, a load and a code provision.',
      },
      {
        k: 'Continuity',
        v: 'The same engineer carries the project from scope through construction-phase questions.',
      },
    ],
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   SERVICE AREA
   ═══════════════════════════════════════════════════════════════════════════ */

export const serviceArea = {
  eyebrow: 'South Florida presence',
  title: 'Engineered for this coast.',
  body: 'Wind exposure, corrosive coastal environment, high water table and a code environment shaped by hurricanes. South Florida is not a generic design condition — it is the design condition we work in.',
  counties: [
    {
      name: 'Miami-Dade County',
      code: 'MDC',
      note: 'High-Velocity Hurricane Zone',
      coords: '25.77° N · 80.19° W',
    },
    {
      name: 'Broward County',
      code: 'BRW',
      note: 'High-Velocity Hurricane Zone',
      coords: '26.12° N · 80.14° W',
    },
  ],
  /**
   * This used to read "Plan diagram — service area representation, not to
   * scale", which described the drawing that sat above it. The drawing is gone
   * and a real aerial is there instead, so the caption now says the one thing a
   * photograph genuinely cannot: coverage is a jurisdictional boundary, not
   * whatever happens to be inside the frame. The wording avoids "above"/"beside":
   * the county list sits to the right on desktop and below on mobile.
   */
  note: 'South Florida from the air. Coverage is defined by jurisdiction, not by the frame of a photograph.',
} as const;

/* Kept for local SEO (`areaServed`). Not rendered as a visible list. */
export const municipalities = [
  'Miami', 'Miami Beach', 'Coral Gables', 'Hialeah', 'Miami Springs',
  'North Miami', 'North Miami Beach', 'Opa-locka', 'South Miami',
  'Homestead', 'Miami Shores', 'Bal Harbour', 'Bay Harbor Islands',
  'Surfside', 'West Miami', 'Florida City', 'Biscayne Park', 'El Portal',
  'Golden Beach', 'Pinecrest', 'Indian Creek', 'Medley', 'North Bay Village',
  'Key Biscayne', 'Sweetwater', 'Virginia Gardens', 'Hialeah Gardens',
  'Aventura', 'Sunny Isles Beach', 'Miami Lakes', 'Palmetto Bay',
  'Miami Gardens', 'Doral', 'Cutler Bay',
  'Fort Lauderdale', 'Hollywood', 'Pembroke Pines', 'Miramar', 'Coral Springs',
  'Pompano Beach', 'Davie', 'Sunrise', 'Plantation', 'Deerfield Beach',
  'Lauderhill', 'Weston', 'Tamarac', 'Margate', 'Coconut Creek',
  'Oakland Park', 'North Lauderdale', 'Hallandale Beach', 'Dania Beach',
  'Cooper City', 'Parkland', 'Lauderdale Lakes', 'Wilton Manors', 'West Park',
  'Southwest Ranches', 'Pembroke Park', 'Lauderdale-by-the-Sea',
  'Lighthouse Point', 'Hillsboro Beach', 'Sea Ranch Lakes', 'Lazy Lake',
];

/* ═══════════════════════════════════════════════════════════════════════════
   CLOSING CTA
   ═══════════════════════════════════════════════════════════════════════════ */

export const closingCta = {
  line1: 'Bring us the structure.',
  line2: 'We’ll carry the responsibility.',
  body: 'Tell us about your project, building or compliance requirement. We will help define the appropriate engineering scope and next steps.',
  primary: { href: '/contact', label: 'Start a project' },
  secondary: { href: '/about', label: 'About the practice' },
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   LEGAL
   ═══════════════════════════════════════════════════════════════════════════ */

export const legal = {
  /** Rendered small in the footer. Keep it short — this is not a terms page. */
  notice:
    'Information on this site is general and does not constitute an engineering opinion, a professional engagement, or a representation about a specific building. Requirements vary by jurisdiction and scope.',
  contactFormNotice:
    'Submitting this form does not create a professional engineering relationship. We will use your details only to respond to this inquiry.',
  links: [
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms of Use' },
    { href: '/credits', label: 'Image Credits' },
  ],
} as const;
