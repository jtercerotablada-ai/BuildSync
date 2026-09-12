/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TERCERO TABLADA — public site content & configuration (ENGLISH)
 * ─────────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for the marketing site in English. `site.es.ts`
 * mirrors every text object in Spanish and `content.ts` hands components the
 * bundle for the language of the page. Structure (routes, slugs, photos,
 * counts) is shared; only words differ between the two files.
 *
 * ⚠ CONTENT INTEGRITY RULES — please keep these when editing:
 *   • Never add a client name, project, metric, testimonial, year-count or
 *     license number that is not verified. Empty is better than invented.
 *   • `contact.phone` / `contact.address` are `null` until they are real. The UI
 *     omits those blocks entirely rather than printing "coming soon".
 *   • `leadership.portrait` and `leadership.license` are `null` until a real
 *     portrait and a verified license number exist; the UI renders a
 *     finished composition without them — never a "coming soon".
 *   • `caseStudies` is empty until real, publishable work exists. Until then
 *     the work page renders `engagements` (anonymized, representative scope).
 *   • Photographs and video come from `media.ts` and illustrate TYPOLOGIES and
 *     SERVICES — never a specific job. Read that file's rules before adding a
 *     placement; the "one placement per asset" rule is enforced by hand.
 *   • Regulatory thresholds (recertification ages) are per JURISDICTION and
 *     they move. Every published number names its authority and the date it
 *     was last checked. Re-verify before amending.
 */

import { photo, video, type Photo, type Clip } from './media';

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
    'Structural engineering for South Florida — structural design for new buildings, evaluation of existing buildings, building recertification, milestone and safety inspections, and BIM coordination across Miami-Dade and Broward.',
  tagline: 'Structural Engineering for South Florida.',
  /**
   * Two real brand assets, both supplied by the client — never redraw either.
   *   lockup* = full horizontal signature (TT monogram + wordmark + tagline).
   *   mark*   = monogram only, for tight spots.
   * The `dark` variants are for LIGHT backgrounds and the `light` variants
   * are white, for DARK backgrounds only.
   */
  logo: {
    lockupDark: '/ttc/img/logo-horizontal.png',
    lockupLight: '/ttc/img/logo-white-wide.png',
    lockupSize: { w: 2172, h: 827 },
    dark: '/ttc/img/logo-square.png',
    light: '/ttc/img/logo-white.png',
    markSize: { w: 1254, h: 1254 },
  },
  /**
   * Florida Engineering Business Registry number (DBPR).
   *
   * This is the FIRM's registration, not the engineer's personal P.E. licence,
   * and it is the one that belongs in public view: it says the COMPANY may
   * legally offer engineering services in Florida, which is what a board or a
   * developer is actually hiring. Verified 2026-09-12 in the DBPR registry —
   * #40285, status Current, no expiry (the Certificate of Authorization was
   * replaced by a free, non-renewing registry in October 2019).
   *
   * Kept in English in both languages: it is the official designation someone
   * would type into myfloridalicense.com to verify it. `null` removes the line
   * from the footer entirely.
   */
  registry: 'FL Engineering Business No. 40285' as string | null,
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   CONTACT
   ═══════════════════════════════════════════════════════════════════════════
   `null` means "not configured yet" — the UI skips it. Do not substitute a
   placeholder string.
   ═══════════════════════════════════════════════════════════════════════════ */

export const contact = {
  /**
   * The firm's mailbox. Google Workspace on ttcivilstructural.com — MX
   * verified live 2026-09-12 (smtp.google.com), single root SPF
   * (include:_spf.google.com), so this address genuinely receives.
   *
   * It replaced info@tercerotablada.com, which was published here for months
   * on a domain with NO MX at all: anyone who wrote to it got a bounce and
   * assumed they had reached us. Before changing this, dig the MX.
   */
  email: 'info@ttcivilstructural.com',
  /** e.g. { display: '(305) 555-0100', href: 'tel:+13055550100' } */
  phone: null as { display: string; href: string } | null,
  /** e.g. { line1: '…', city: 'Miami', state: 'FL', zip: '33131' } */
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
  /** Shown near the form. No response-time promise: only what is always true. */
  responseNote:
    'Every inquiry is read and answered by the engineer, not by a call center.',
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════════════════════════════════ */

export type NavItem = { href: string; label: string; description?: string };

export const primaryNav: NavItem[] = [
  { href: '/services', label: 'Services' },
  { href: '/existing-buildings', label: 'Existing Buildings' },
  { href: '/projects', label: 'Work' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export const primaryCta = { href: '/contact', label: 'Request a Proposal' };

export const footerNav: { title: string; items: NavItem[] }[] = [
  {
    title: 'Navigate',
    items: [
      { href: '/services', label: 'Services' },
      { href: '/existing-buildings', label: 'Existing Buildings' },
      { href: '/projects', label: 'Work' },
      { href: '/about', label: 'About' },
      { href: '/about#engineer', label: 'Meet the Engineer' },
      { href: '/contact', label: 'Request a Proposal' },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   UI STRINGS — chrome that is not content (buttons, labels, form, footer)
   ═══════════════════════════════════════════════════════════════════════════ */

export const ui = {
  skipToContent: 'Skip to content',
  home: 'Home',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  siteMenu: 'Site menu',
  primaryNavLabel: 'Primary',
  language: { label: 'Language', en: 'EN', es: 'ES', switchTo: 'Ver en español' },
  breadcrumb: 'Breadcrumb',
  explore: 'Explore',
  exploreService: 'See this service',
  learnMore: 'Learn more',
  requestProposal: 'Request a Proposal',
  exploreServices: 'Explore Our Services',
  seeAllServices: 'All services',
  newProjects: 'New projects',
  existingBuildings: 'Existing buildings',
  whenYouNeedIt: 'When you need it',
  whatsIncluded: "What's included",
  whatYouReceive: 'What you receive',
  nextStep: 'Next step',
  whenItApplies: 'When it applies',
  howItRuns: 'How the work runs',
  considerations: 'Good to know',
  designBasis: 'Design basis',
  relatedServices: 'Related services',
  atAGlance: 'At a glance',
  service: 'Service',
  appliesTo: 'Applies to',
  newConstruction: 'New construction',
  basis: 'Basis',
  coverage: 'Coverage',
  verified: 'Verified',
  lastChecked: 'Last verified',
  footer: {
    services: 'Services',
    contact: 'Contact',
    navigate: 'Navigate',
    linkedin: 'LinkedIn',
    imageCredits: 'Image Credits',
  },
  engineer: {
    eyebrow: 'Meet the engineer',
    /** Home teaser label. The name belongs to About and Contact only. */
    eyebrowTeaser: 'Who is responsible',
    role: 'Principal Engineer',
    credential: 'Florida Professional Engineer',
    license: 'Florida P.E. license',
    verify: 'Verify with the Florida DBPR',
    education: 'Education',
    focus: 'Practice focus',
    approach: 'How I work',
    forYou: 'What that means for you',
    readMore: 'Meet the engineer',
    plateNote: 'Professional portrait to follow',
  },
  work: {
    projectType: 'Project type',
    location: 'Location',
    problem: 'The problem',
    scope: 'Scope',
    role: 'Our role',
    result: 'Result',
    structuralSystem: 'Structural system',
    deliverables: 'Deliverables',
    codes: 'Codes',
    status: 'Status',
    illustrative: 'Illustrative image — not the project described.',
    firmProjects: 'Firm projects',
    priorExperience: 'Prior professional experience',
    priorNote:
      'Work performed at other firms before the practice was founded. Listed for experience only — not projects of Tercero Tablada Civil & Structural Engineering Inc.',
  },
  form: {
    heading: 'Request a proposal',
    intro:
      'Tell us what you own, what you are planning or what you received. The more specific the description, the more precise the proposal.',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    company: 'Company or association',
    companyPlaceholder: 'Association, developer, architecture firm',
    service: 'Service needed',
    selectService: 'Select a service…',
    location: 'Project location',
    locationPlaceholder: 'City or county — e.g. Coral Gables, Miami-Dade',
    message: 'Project description',
    messagePlaceholder:
      'Building type, number of stories, what you need engineered or inspected, and any deadline or notice you are working to.',
    attachments: 'Attachments',
    attachmentsHint:
      'Municipal notice, photographs or drawings. PDF, images, DWG, DXF or ZIP — up to 25 MB each, five files.',
    addFiles: 'Add files',
    removeFile: 'Remove',
    uploading: 'Uploading',
    optional: 'optional',
    send: 'Send request',
    sending: 'Sending',
    sendAnother: 'Send another request',
    successTitle: 'Request received.',
    successBody: 'Your request is in the engineer’s inbox.',
    successConfirmed: 'A confirmation has been sent to your email address.',
    successRef: 'Reference',
    whatNext: 'What happens next',
    nextSteps: [
      'The engineer reads your description and any files you attached.',
      'You receive a reply by email with questions, or with a proposal that states the scope, the deliverables and the fee.',
      'Work starts once the scope is agreed in writing — nothing is assumed on your behalf.',
    ],
    directEmail: 'Prefer email? Write to',
    errors: {
      name: 'Please enter your name',
      email: 'Please enter an email address',
      emailFormat: 'Check the email address',
      service: 'Select the service you need',
      location: 'Tell us where the project or building is',
      message: 'Tell us a little more about the project',
      generic: 'Something went wrong. Please email us instead.',
      upload: 'That file could not be uploaded.',
      fileType: 'File type not accepted.',
      fileSize: 'Files must be 25 MB or smaller.',
      fileCount: 'Up to five files per request.',
      tooMany: 'Too many requests from this connection. Please try again shortly.',
    },
  },
  contactPage: {
    emailLabel: 'Email',
    emailMeta: 'Best for scope, drawings and permit questions.',
    phone: 'Phone',
    office: 'Office',
    serviceArea: 'Service area',
    serviceAreaMeta: 'On-site inspections and coordination across South Florida.',
    whatWeCover: 'What we cover',
    disclaimer:
      'Descriptions on this site are general. The scope, sequence and deliverables for any specific building are confirmed in writing before work begins, and requirements vary by jurisdiction.',
  },
  typologiesNote:
    'Photographs illustrate the kind of structure described. They are not Tercero Tablada projects — published case studies appear on',
  typologiesNoteLink: 'Work',
  typologiesNoteEnd: ', with client permission.',
  galleryNote:
    'Licensed architectural photography, shown as material rather than as portfolio. No image on this page depicts a Tercero Tablada project.',
  processDisclaimer:
    'Requirements vary by jurisdiction, building age, construction type and scope. This describes a typical sequence, not a guaranteed procedure or outcome.',
  legalPages: { privacy: 'Privacy Policy', terms: 'Terms of Use', legal: 'Legal' },
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════════════════════════════════════ */

export const hero = {
  eyebrow: 'Miami-Dade · Broward · Florida Professional Engineer',
  title: 'Structural Engineering for South Florida.',
  /** Line breaks of the headline as rendered; the accent word is italic serif. */
  titleLines: ['Structural Engineering', 'for South Florida.'],
  accentWord: 'South Florida.',
  sub: 'Structural design for new buildings, evaluation of existing ones, building recertification and BIM coordination — led by a Florida Professional Engineer who stays on your project from the first call to the final report.',
  primary: { href: '/contact', label: 'Request a Proposal' },
  secondary: { href: '/services', label: 'Explore Our Services' },
  caps: [
    'Structural design',
    'Existing-building evaluation',
    'Building recertification',
    'BIM coordination',
  ],
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   SERVICES
   ═══════════════════════════════════════════════════════════════════════════ */

export type ServiceTrack = 'new' | 'existing';

export type Service = {
  slug: string;
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
  /** Concrete situations in which a client needs this. Client language. */
  when: string[];
  /** Typical scope of work — full sentences, used on the service page. */
  scope: string[];
  /** Three-to-five word labels for cards. Not sentences. */
  capabilities: string[];
  /** How the work runs, step by step. */
  process: { step: string; detail: string }[];
  /** What the client receives. */
  deliverables: string[];
  /** The one thing the client does next. */
  nextStep: string;
  /** Honest caveats — what changes the scope, what we do not promise. */
  considerations: string[];
  /**
   * When the obligation is triggered. Only the regulated existing-building
   * services carry one. Every row names its JURISDICTION, because Miami-Dade,
   * Broward and the State each set a different clock.
   *
   * THESE NUMBERS ARE REGULATORY AND THEY MOVE. `source` names the authority
   * and `checked` the date the row was last verified. Re-verify before amending.
   */
  timing?: {
    checked: string;
    note: string;
    rows: { jurisdiction: string; source: string; facts: { k: string; v: string }[] }[];
  };
  /** Reference standards. Kept short; this is not a code list. */
  standards: string[];
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
    when: [
      'You are building a house, townhouses, a mid-rise or a commercial frame and need the structural set for permit.',
      'An architect has a design and needs the structure engineered behind it.',
      'A contractor needs buildable reinforcement details, not a schematic.',
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
      { step: 'Load take-down', detail: 'Occupancy, dead, live, wind and seismic demand established against ASCE 7 before any member is sized.' },
      { step: 'System selection', detail: 'Framing layout, slab type and lateral strategy chosen with the architect — span, depth and cost tested together.' },
      { step: 'Analysis & sizing', detail: 'Members analyzed and designed to ACI 318 and the Florida Building Code, with deflection and serviceability checked.' },
      { step: 'Detailing', detail: 'Reinforcement drawn so it can actually be placed — congestion, cover, hooks and splices resolved on the drawing.' },
      { step: 'Review & seal', detail: 'Independent internal check, then signed and sealed for permit submittal.' },
    ],
    deliverables: [
      'Structural drawing set, permit-ready',
      'Structural calculations package',
      'General notes and typical details',
      'Signed and sealed documents where the scope requires it',
    ],
    nextStep:
      'Send the architectural drawings (any stage) and the site location. You receive a proposal with scope, deliverables and fee.',
    considerations: [
      'Foundation design depends on a geotechnical report; where none exists we will tell you what is needed before we start.',
      'Scope and fee change with irregularity — transfers, cantilevers, post-tensioning and unusual geometry are priced honestly, not absorbed silently.',
      'Permit review comments are part of the process; we respond to them, but no engineer can guarantee a jurisdiction’s decision.',
    ],
    standards: ['ACI 318', 'ASCE 7', 'Florida Building Code'],
    seo: {
      title: 'Reinforced Concrete Design',
      description:
        'Reinforced concrete design for South Florida buildings — foundations, columns, beams, slabs and shear walls detailed to ACI 318 and the Florida Building Code, issued permit-ready. Miami-Dade and Broward.',
      keywords: ['reinforced concrete design', 'concrete structure design Miami', 'structural engineer Miami', 'structural engineer Broward'],
    },
  },
  {
    slug: 'structural-analysis',
    n: '02',
    title: 'Structural Analysis & Foundations',
    shortTitle: 'Structural Analysis & Foundations',
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
    when: [
      'You need to know whether a site, a soil report or a building concept works structurally before committing.',
      'The project has a difficult site: tight lot, poor bearing, high water table, close neighbours.',
      'You need wind and lateral demand resolved for a High-Velocity Hurricane Zone site.',
    ],
    capabilities: ['3D modelling', 'Wind & seismic demand', 'Drift control', 'Deep foundations', 'Settlement checks'],
    scope: [
      'Three-dimensional analytical modelling of the structure',
      'Wind and seismic demand per ASCE 7',
      'Lateral system selection and drift control',
      'Diaphragm, collector and load-path continuity checks',
      'Shallow and deep foundation design',
      'Settlement, bearing and uplift verification against the geotechnical report',
    ],
    process: [
      { step: 'Define the demand', detail: 'Risk category, exposure, wind speed and seismic parameters fixed for the actual site — not assumed.' },
      { step: 'Build the model', detail: 'Geometry, stiffness, restraints and mass assembled into one analytical model of the whole structure.' },
      { step: 'Analyze', detail: 'Gravity, wind and seismic load combinations run; drift, torsion and stability checked.' },
      { step: 'Resolve the foundation', detail: 'Reactions carried into a foundation system matched to the soil report and site constraints.' },
      { step: 'Document', detail: 'Results traced back into drawings and a calculation package a reviewer can follow.' },
    ],
    deliverables: [
      'Analysis model and results summary',
      'Load and load-combination documentation',
      'Foundation design and reactions schedule',
      'Structural calculations package',
    ],
    nextStep:
      'Share the site, the geotechnical report if you have one, and the building concept. We reply with what is feasible and what the analysis will cost.',
    considerations: [
      'Foundation recommendations are only as good as the geotechnical data behind them.',
      'Existing structures require field verification before an analytical model can be trusted.',
      'Analysis results are reported as they are — including when they show a system does not work.',
    ],
    standards: ['ASCE 7', 'ACI 318', 'AISC 360', 'Florida Building Code'],
    seo: {
      title: 'Structural Analysis & Foundations',
      description:
        'Structural analysis and foundation design for South Florida — gravity and lateral systems, wind and seismic demand per ASCE 7, shallow and deep foundations in Miami-Dade and Broward.',
      keywords: ['structural analysis South Florida', 'foundation design Miami', 'wind analysis ASCE 7 Florida', 'lateral system design'],
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
    when: [
      'The project team works in Revit and needs the structure modelled to the same standard.',
      'The owner or contractor requires a federated model and clash reports as a deliverable.',
      'Ducts, pipes and structure keep colliding on drawings and someone has to own the resolution.',
    ],
    capabilities: ['Structural modelling', 'Model federation', 'Clash detection', 'Issue tracking', 'Model-derived drawings'],
    scope: [
      'Structural modelling — foundations, columns, slabs, walls, framing',
      'Federation of structural, architectural and MEP models',
      'Interference checking and clash resolution tracking',
      'Model-derived drawings, schedules and quantities',
      'Coordination meetings and issue reporting',
      'Model delivery aligned to project information requirements',
    ],
    process: [
      { step: 'Set the rules', detail: 'Shared coordinates, level and grid naming, model breakdown and level of information agreed before modelling starts.' },
      { step: 'Model the structure', detail: 'The structural model is built as the design source, not as a drafting by-product.' },
      { step: 'Federate', detail: 'Discipline models combined and checked against each other on a fixed cycle.' },
      { step: 'Resolve', detail: 'Conflicts logged, assigned and tracked to closure — with the structural fix engineered, not improvised.' },
      { step: 'Deliver', detail: 'Drawings, schedules and the model itself issued as one consistent set.' },
    ],
    deliverables: [
      'Structural model at the agreed level of information',
      'Clash and issue reports with resolution status',
      'Model-derived drawings and schedules',
      'Coordination record for the project file',
    ],
    nextStep:
      'Tell us the software the team uses, the level of detail required and the coordination schedule. We propose the modelling scope and the exchange format.',
    considerations: [
      'Coordination quality depends on what the other disciplines deliver and when; the process is collaborative by definition.',
      'A model is not a substitute for a signed and sealed drawing set — it supports it.',
      'Level of information should match the decision being made, not the largest number available.',
    ],
    standards: ['ISO 19650', 'Model-based coordination'],
    seo: {
      title: 'BIM Modeling & Coordination',
      description:
        'Structural BIM modeling and multi-discipline coordination — federated Revit models, clash detection and model-derived structural deliverables for South Florida projects.',
      keywords: ['BIM coordination Miami', 'structural BIM modeling', 'clash detection structural', 'Revit structural engineer Florida'],
    },
  },
  {
    slug: 'peer-review',
    n: '04',
    title: 'Peer Review & Compliance',
    shortTitle: 'Peer Review',
    track: 'new',
    summary:
      'An independent second read of the structural design — code compliance, load path, constructability and documentation quality.',
    problem:
      'By the time a structural problem is found in construction, it is a schedule event. An independent review before issue is the cheapest risk reduction available on a project.',
    audience: [
      'Owners and developers managing structural risk',
      'Design teams seeking an independent check',
      'Lenders and insurers requiring third-party review',
    ],
    when: [
      'A lender, insurer or owner requires an independent structural review before construction.',
      'A drawing set is about to be issued and nobody outside the design team has read it.',
      'Something in the structure worries you and you want a second engineer to look, not to redesign.',
    ],
    capabilities: ['Drawing review', 'Calculation check', 'Load-path continuity', 'Constructability', 'Comment log'],
    scope: [
      'Independent review of structural drawings and calculations',
      'Code compliance and load-path continuity check',
      'Review of analysis assumptions and modelling',
      'Constructability and detailing review',
      'Documentation completeness and coordination review',
      'Written comment log with resolution tracking',
    ],
    process: [
      { step: 'Scope the review', detail: 'Depth agreed up front — full review, targeted systems, or a specific concern.' },
      { step: 'Review', detail: 'Drawings, calculations and models read independently against the governing code.' },
      { step: 'Comment', detail: 'Findings issued as a structured comment log, prioritized by structural consequence.' },
      { step: 'Close out', detail: 'Responses reviewed and comments tracked to closure so the record is complete.' },
    ],
    deliverables: [
      'Independent review report',
      'Prioritized comment log',
      'Resolution tracking through close-out',
    ],
    nextStep:
      'Send the drawing set and calculations, and say what the review is for. You receive a fixed-fee proposal for the depth of review that matches it.',
    considerations: [
      'A peer review examines the design as submitted; it does not transfer engineer-of-record responsibility.',
      'Review depth and fee scale with the size and complexity of the set.',
      'Comments are written to be resolved, not to assign blame.',
    ],
    standards: ['ACI 318', 'ASCE 7', 'AISC 360', 'Florida Building Code'],
    seo: {
      title: 'Structural Peer Review & Compliance',
      description:
        'Independent structural peer review — code compliance, load path, constructability and documentation review for projects in Miami-Dade and Broward.',
      keywords: ['structural peer review', 'independent structural review Florida', 'third party structural review Miami', 'structural due diligence'],
    },
  },
  {
    slug: 'building-recertification',
    n: '05',
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
    when: [
      'A recertification notice from Miami-Dade or Broward has arrived, or the building is approaching the age at which one will.',
      'A previous report identified repairs and the building now has to be reinspected and closed out.',
      'You are buying or managing a building and want to know where it stands in the recertification cycle.',
    ],
    capabilities: ['Notice review', 'Site inspection', 'Findings report', 'Repair scope', 'Reinspection'],
    scope: [
      'Review of the notice, building records and prior reports',
      'Visual structural inspection of the building',
      'Documentation of observed conditions with photographs',
      'Structural recertification report on the required form',
      'Repair recommendations where conditions require them',
      'Reinspection after repairs and submission support',
    ],
    process: [
      { step: 'Notice review', detail: 'We read the notice and the building’s history, then confirm what the jurisdiction is actually asking for and by when.' },
      { step: 'Site inspection', detail: 'Visual structural inspection of accessible elements — frame, slabs, balconies, roof structure, foundations where exposed.' },
      { step: 'Findings', detail: 'Observed conditions documented and classified, with the structural reasoning written in plain language for the board.' },
      { step: 'Repairs', detail: 'Where repairs are required, we describe what has to be corrected and to what standard, so the work can be bid fairly.' },
      { step: 'Reinspection', detail: 'Completed repairs are re-inspected and documented against the original findings.' },
      { step: 'Submission', detail: 'The report is finalized and submitted, and we respond to questions the reviewing office raises.' },
    ],
    deliverables: [
      'Structural recertification report on the required form',
      'Photographic documentation of observed conditions',
      'Written repair recommendations where applicable',
      'Reinspection documentation after repairs',
    ],
    nextStep:
      'Attach the notice (or tell us the building’s age and address). We confirm which program applies and reply with a proposal for the inspection and report.',
    timing: {
      checked: 'September 2026',
      note: 'County recertification and the state milestone inspection are separate obligations. A condominium in Miami-Dade or Broward can owe both, on different clocks and in different reports. Which programs reach your building is confirmed before we start.',
      rows: [
        {
          jurisdiction: 'Miami-Dade County',
          source: 'Code of Miami-Dade County §8-11(f)',
          facts: [
            { k: 'First due', v: '30 years — 25 years for buildings within about 3 miles of the coast' },
            { k: 'Then', v: 'Every 10 years, for the life of the structure' },
            { k: 'Time to comply', v: '90 days from the county notice' },
            { k: 'Outside the program', v: 'Single-family homes, duplexes, and buildings of 10 occupants or fewer and 2,000 sq ft or less' },
          ],
        },
        {
          jurisdiction: 'Broward County',
          source: 'Building Safety Inspection Program (Board of Rules and Appeals)',
          facts: [
            { k: 'First due', v: '25 years' },
            { k: 'Then', v: 'Every 10 years' },
            { k: 'Scope', v: 'Structural and electrical, reported separately by licensed professionals' },
          ],
        },
      ],
    },
    considerations: [
      'Requirements differ between Miami-Dade and Broward and between municipalities — the sequence above is typical, not universal.',
      'Recertification is not a one-time event. After the first report the building is due again every ten years, for the life of the structure.',
      'Recertification covers the structural scope; electrical recertification is a separate discipline.',
      'A report documents observed conditions. No engineer can guarantee how a reviewing office will act on it.',
      'Concealed conditions may require additional investigation before conclusions can be drawn.',
    ],
    standards: ['Florida Building Code', 'Miami-Dade & Broward requirements'],
    seo: {
      title: 'Building Recertification — Miami-Dade & Broward',
      description:
        'Structural building recertification in Miami-Dade (30 / 25 years) and Broward (25 years) — notice review, inspection, findings, repair recommendations, reinspection and report submission by a Florida P.E.',
      keywords: ['building recertification Miami-Dade', 'building recertification Broward', '30 year recertification Miami', '25 year recertification Broward', 'structural recertification report'],
    },
  },
  {
    slug: 'building-safety-inspections',
    n: '06',
    title: 'Milestone & Building Safety Inspections',
    shortTitle: 'Milestone & Safety Inspections',
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
    when: [
      'Your condominium or cooperative is three habitable stories or more and is reaching 30 years — 25 near the coast.',
      'A phase-one report found deterioration and a phase-two investigation has been called for.',
      'Balconies, walkways or railings show spalling, cracking or corrosion staining and the board needs an engineer’s read.',
    ],
    capabilities: ['Structural inspection', 'Balcony & railing review', 'Distress mapping', 'Prioritized findings'],
    scope: [
      'Visual inspection of the primary structural system',
      'Balcony, walkway and railing structural review',
      'Concrete distress mapping — spalling, cracking, corrosion staining',
      'Waterproofing-related structural deterioration review',
      'Prioritized findings and recommended follow-up',
      'Phase two investigation scoping where warranted',
    ],
    process: [
      { step: 'Records review', detail: 'Available drawings, prior reports and repair history reviewed before the site visit.' },
      { step: 'Field inspection', detail: 'Systematic visual inspection with photographic documentation and location mapping.' },
      { step: 'Evaluation', detail: 'Observations evaluated structurally — distinguishing cosmetic from structural, and urgent from monitorable.' },
      { step: 'Report', detail: 'Findings issued with clear priorities and, where required, a defined scope for further investigation.' },
    ],
    deliverables: [
      'Inspection report with photographic record',
      'Condition findings organized by priority',
      'Recommended follow-up or further investigation scope',
      'Signed and sealed documents where the scope requires it',
    ],
    nextStep:
      'Tell us the building’s age, height and distance from the coast. We confirm whether the milestone inspection applies and propose the phase-one scope.',
    timing: {
      checked: 'September 2026',
      note: 'The milestone inspection is a state obligation under Florida Statute 553.899 and is separate from county recertification. Both can apply to the same building, on different deadlines.',
      rows: [
        {
          jurisdiction: 'State of Florida — milestone inspection',
          source: 'Florida Statute 553.899',
          facts: [
            { k: 'Applies to', v: 'Condominium and cooperative buildings of three habitable stories or more' },
            { k: 'First due', v: 'By December 31 of the year the building reaches 30 years — 25 years where the local authority requires it for proximity to salt water' },
            { k: 'Then', v: 'Every 10 years' },
            { k: 'Phase two', v: 'Only where phase one finds substantial structural deterioration' },
          ],
        },
      ],
    },
    considerations: [
      'Visual inspection covers accessible, observable conditions. Concealed deterioration may require testing or selective demolition.',
      'Milestone inspection requirements depend on building age, height and location; applicability is confirmed case by case.',
      'An inspection reports condition at a point in time; it is not a warranty of future performance.',
    ],
    standards: ['Florida Building Code', 'Florida Statute 553.899'],
    seo: {
      title: 'Milestone & Building Safety Inspections',
      description:
        'Florida milestone inspections (F.S. 553.899) and structural safety inspections across South Florida — visual structural inspection, concrete distress documentation and prioritized findings by a licensed P.E.',
      keywords: ['milestone inspection Florida', 'milestone inspection Miami', 'building safety inspection Broward', 'balcony inspection Miami', 'structural inspection South Florida'],
    },
  },
  {
    slug: 'structural-condition-assessments',
    n: '07',
    title: 'Structural Assessments & Repair Design',
    shortTitle: 'Assessments & Repairs',
    track: 'existing',
    summary:
      'What the building is actually doing today — deterioration assessed, capacity evaluated, repairs engineered so they can be bid and built.',
    problem:
      'Cracking, spalling and movement all look alarming and mean very different things. Before spending on repairs, an owner needs to know which conditions affect capacity and which do not — and then needs repairs specified precisely enough to price.',
    audience: [
      'Owners planning repairs or capital works',
      'Buyers performing structural due diligence',
      'Associations responding to inspection findings',
    ],
    when: [
      'An inspection or recertification report lists repairs and the contractors’ bids are not comparable because nobody defined the scope.',
      'Visible distress has appeared and someone needs to say whether it affects the structure.',
      'You are buying a building, adding a floor, changing its use or cutting an opening in a wall or slab.',
    ],
    capabilities: ['Field assessment', 'Deterioration mapping', 'Capacity evaluation', 'Repair specification'],
    scope: [
      'Field assessment of the structural system in its current state',
      'Concrete deterioration and reinforcement corrosion evaluation',
      'Capacity evaluation of existing members where required',
      'Evaluation of alterations, overloads and change of use',
      'Repair design — concept, details and specification',
      'Prioritization and phasing guidance',
    ],
    process: [
      { step: 'Understand the building', detail: 'Original drawings, alterations and repair history reviewed; where drawings are missing, the structure is field-verified.' },
      { step: 'Assess condition', detail: 'Deterioration mapped and its structural significance evaluated element by element.' },
      { step: 'Evaluate capacity', detail: 'Where condition or use has changed, remaining capacity is checked against current demand.' },
      { step: 'Design the repair', detail: 'Repairs described in enough detail to be bid, executed and inspected — not left as a general recommendation.' },
    ],
    deliverables: [
      'Condition assessment report',
      'Deterioration mapping and photographic record',
      'Capacity evaluation where performed',
      'Repair drawings and specifications',
    ],
    nextStep:
      'Send photographs of the conditions and any previous report. We tell you whether a site visit is needed and what the assessment will cover.',
    considerations: [
      'Assessments of existing structures carry uncertainty; where it matters, testing or exploratory openings are recommended rather than assumed away.',
      'Missing original documentation increases the field verification required.',
      'Repair design is scoped and quoted separately from the assessment that leads to it.',
    ],
    standards: ['ACI 318', 'ACI repair practice', 'Florida Building Code'],
    seo: {
      title: 'Structural Condition Assessments & Repair Design',
      description:
        'Structural condition assessments, capacity evaluation and concrete repair design for existing South Florida buildings — deterioration evaluation, repair drawings and specifications.',
      keywords: ['structural condition assessment Miami', 'concrete repair engineer Florida', 'balcony repair design', 'existing building evaluation', 'structural due diligence Miami'],
    },
  },
];

export const serviceBySlug = (slug: string) =>
  services.find((s) => s.slug === slug);

export const servicesByTrack = (track: ServiceTrack) =>
  services.filter((s) => s.track === track);

/** Service options offered in the contact form dropdown. */
export const contactServiceOptions = [
  ...services.map((s) => s.shortTitle),
  'Other / not sure yet',
];

/* ═══════════════════════════════════════════════════════════════════════════
   IMAGERY — allocation of the media catalogue (shared by both languages)
   ═══════════════════════════════════════════════════════════════════════════ */

export const imagery = {
  hero: video.heroMiami,
  pages: {
    services: photo.concreteBeamColumn,
    existingBuildings: photo.miamiResidentialTowers,
    work: photo.miamiCondoAerial,
    about: photo.concreteStair,
    contact: photo.miamiBrickell,
  },
  services: {
    'reinforced-concrete-design': photo.concreteFrameSlabs,
    'structural-analysis': photo.analysisTowersUp,
    'bim-coordination': photo.bimWireframeModel,
    'building-recertification': photo.recertBalconiesBw,
    'building-safety-inspections': photo.inspectBalconyPair,
    'structural-condition-assessments': photo.inspectWall,
    'peer-review': photo.peerTowerBw,
  } as Record<string, Photo>,
  sections: {
    southFlorida: photo.southFloridaAerial,
    engineer: photo.concreteRamp,
  },
  engagements: {
    '01': photo.frameUnderConstruction,
    '02': photo.midriseGlassBalconies,
    '03': photo.miamiTowersUp,
    '04': photo.rebarBundles,
    '05': photo.frameSlabEdges,
    '06': photo.rebarCageTower,
  } as Record<string, Photo>,
  clips: {
    design: video.craneSky,
    existing: video.existingMidrise,
    practice: video.structureGeometry,
    bim: video.bimAssembly,
  } as Record<string, Clip>,
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
   WHAT WE DESIGN — building typologies (photos illustrate the KIND, never a job)
   ═══════════════════════════════════════════════════════════════════════════ */

export type Typology = {
  n: string;
  title: string;
  lede: string;
  track: ServiceTrack;
  href: string;
  photo: Photo;
};

export const typologiesSection = {
  eyebrow: 'What we design',
  title: 'From a single house to a mid-rise concrete frame.',
  accentWord: 'mid-rise',
  lede: 'The same engineer, the same load path, the same detailing standard — scaled to the building in front of us. If your project is not on this list, it is worth a conversation rather than an assumption.',
} as const;

export const typologies: Typology[] = [
  { n: '01', title: 'Single-family residences', lede: 'New houses engineered from the footing up — foundations sized to the soil report, a frame that carries hurricane wind, and drawings a local builder can price and build.', track: 'new', href: '/services/reinforced-concrete-design', photo: photo.houseConcreteGarden },
  { n: '02', title: 'Townhouses & duplexes', lede: 'Party walls, shared foundations and repeated bays — the structure resolved once and detailed so the repetition stays a saving instead of a risk.', track: 'new', href: '/services/structural-analysis', photo: photo.houseTownhouses },
  { n: '03', title: 'Mid-rise reinforced concrete', lede: 'Flat plates, shear-wall cores and cantilevered balconies — the system South Florida is built from, engineered as one continuous load path.', track: 'new', href: '/services/reinforced-concrete-design', photo: photo.frameCurvedBalconies },
  { n: '04', title: 'Mixed-use & commercial frames', lede: 'Long spans over ground-floor retail, transfer structure where the grid changes, and coordination with everyone whose services run through it.', track: 'new', href: '/services/bim-coordination', photo: photo.frameCraneClean },
  { n: '05', title: 'Foundations on difficult sites', lede: 'Tight lots, poor bearing, high water table and neighbours close enough to matter — the substructure engineered against the geotechnical report, not around it.', track: 'new', href: '/services/structural-analysis', photo: photo.foundationMatPit },
  { n: '06', title: 'Repairs to existing structures', lede: 'Balconies, facades, slabs and columns that have been in service for decades — condition documented, repairs engineered, and the paperwork the county asks for.', track: 'existing', href: '/existing-buildings', photo: photo.facadeRepairRope },
];

/* ═══════════════════════════════════════════════════════════════════════════
   THE TWO PATHS — new projects vs. existing buildings
   ═══════════════════════════════════════════════════════════════════════════ */

export type Path = {
  n: string;
  key: ServiceTrack;
  eyebrow: string;
  title: string;
  accentWord: string;
  lede: string;
  /** Slugs of the services in this path, in display order. */
  serviceSlugs: string[];
  cta: { href: string; label: string };
  photo: Photo;
};

export const pathsSection = {
  eyebrow: 'What we solve',
  titleLines: ['Two kinds of clients.', 'One engineer responsible for both.'],
  accentWord: 'both',
  lede: 'Some clients are building something new and need the structure designed and permitted. Others own a building that is already standing and need it evaluated, recertified or repaired. Both get the same engineer, the same documentation standard and the same direct line.',
} as const;

export const paths: Path[] = [
  {
    n: '01',
    key: 'new',
    eyebrow: 'New projects',
    title: 'I am building something new.',
    accentWord: 'new',
    lede: 'Houses, townhouses, mid-rise concrete and commercial frames — engineered from the load path to the sealed permit set, and coordinated in BIM with the rest of the team.',
    serviceSlugs: ['reinforced-concrete-design', 'structural-analysis', 'bim-coordination', 'peer-review'],
    cta: { href: '/services#new', label: 'Services for new projects' },
    photo: photo.frameTowerSunlit,
  },
  {
    n: '02',
    key: 'existing',
    eyebrow: 'Existing buildings',
    title: 'I own or manage an existing building.',
    accentWord: 'existing',
    lede: 'Recertification notices, milestone inspections, visible distress and repair scopes — documented condition, engineered repairs, and a clear route through Miami-Dade and Broward compliance.',
    serviceSlugs: ['building-recertification', 'building-safety-inspections', 'structural-condition-assessments'],
    cta: { href: '/existing-buildings', label: 'Services for existing buildings' },
    photo: photo.midriseBalconies,
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   RECERTIFICATION BAND (home) — numbers per jurisdiction, verified 2026-09
   ═══════════════════════════════════════════════════════════════════════════ */

export const recertBand = {
  eyebrow: 'Existing buildings',
  titleLines: ['Thousands of buildings.', 'One deadline each.'],
  accentWord: 'deadline',
  plainTitle: 'Thousands of buildings. One deadline each.',
  body: 'South Florida’s recertification programs reach most buildings between 25 and 30 years of age and return every ten years for the life of the structure. We carry the structural side end to end: inspection, findings, repair scope, reinspection, submission.',
  facts: [
    { k: 'Miami-Dade', v: '30 years · 25 near the coast · then every 10' },
    { k: 'Broward', v: '25 years · then every 10' },
    { k: 'State milestone', v: 'Condos 3+ stories · 30 years (25 by local rule) · then every 10' },
  ],
  cta: { href: '/existing-buildings', label: 'Existing-building services' },
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   BIM — section copy
   ═══════════════════════════════════════════════════════════════════════════ */

export const bim = {
  eyebrow: 'BIM / Digital coordination',
  title: 'Conflicts resolved in the model, not on your site.',
  body: 'We build the structural model as the design source, federate it with architecture and MEP, and track every clash to closure — so the drawings you permit are the drawings that get built.',
  notes: [
    'One model as the design source, not a drafting by-product.',
    'Conflicts found and resolved in coordination, not in the field.',
    'Drawings, schedules and quantities derived from the same model.',
  ],
  cta: { href: '/services/bim-coordination', label: 'BIM coordination in detail' },
} as const;

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
   HOW WE WORK — the client-facing process, five steps
   ═══════════════════════════════════════════════════════════════════════════ */

export const howWeWork = {
  eyebrow: 'How we work',
  title: 'Five steps. You always know which one you are on.',
  lede: 'The sequence is the same whether you are permitting a new frame or answering a recertification notice. What changes is the depth of step three.',
  steps: [
    {
      n: '01',
      title: 'Initial consultation',
      youDo: 'Describe the project or the building, share what you have — drawings, photos, the notice.',
      youGet: 'A direct conversation with the engineer and a first read on what is needed.',
    },
    {
      n: '02',
      title: 'Scope & proposal',
      youDo: 'Review a written proposal that states scope, deliverables, exclusions and fee.',
      youGet: 'A document you can compare, question and approve. Nothing starts before it is agreed.',
    },
    {
      n: '03',
      title: 'Evaluation or design',
      youDo: 'Give access to the site, or answer the architect’s coordination questions as they come.',
      youGet: 'Inspection and findings for existing buildings; analysis, modelling and detailing for new ones — with progress you can see.',
    },
    {
      n: '04',
      title: 'Delivery',
      youDo: 'Receive the report or the signed and sealed drawing set, and the calculations behind it.',
      youGet: 'Documents written to be acted on: a board can read the findings, a contractor can build the details, a reviewer can follow the reasoning.',
    },
    {
      n: '05',
      title: 'Follow-up',
      youDo: 'Forward the reviewer’s comments, the contractor’s RFIs or the reinspection request.',
      youGet: 'Answers from the engineer who did the work — through permit comments, construction questions and, for existing buildings, reinspection and submission.',
    },
  ],
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   WORK — real case studies (empty until supplied) + representative engagements
   ═══════════════════════════════════════════════════════════════════════════ */

export type CaseStudy = {
  n: string;
  title: string;
  projectType: string;
  /** General location only — city or county, never an address. */
  location: string;
  problem: string;
  scope: string;
  /** The firm's role, or Juan's role at a prior employer. */
  role: string;
  result: string;
  /** 'firm' = Tercero Tablada project; 'prior' = Juan's experience elsewhere. */
  attribution: 'firm' | 'prior';
  /** Real project photography, or an illustrative stock photo flagged as such. */
  photo?: Photo;
  photoIsIllustrative?: boolean;
};

/** Real, client-authorized case studies. Empty until material is supplied. */
export const caseStudies: CaseStudy[] = [];

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
};

export const engagements: Engagement[] = [
  { n: '01', title: 'Mid-rise residential frame', projectType: 'Residential — new construction', location: 'Miami-Dade County, FL', scope: 'Full structural design: gravity and lateral systems, foundations, detailing', structuralSystem: 'Reinforced concrete flat plate with shear-wall core', deliverables: 'Structural drawing set · Calculations · General notes', codes: 'ACI 318 · ASCE 7 · Florida Building Code', status: 'Representative scope' },
  { n: '02', title: 'Coastal condominium recertification', projectType: 'Existing building — recertification', location: 'Broward County, FL', scope: 'Notice review, structural inspection, findings, repair recommendations, reinspection', structuralSystem: 'Reinforced concrete frame with cantilevered balconies', deliverables: 'Recertification report · Photographic record · Repair scope', codes: 'Florida Building Code · County recertification requirements', status: 'Representative scope' },
  { n: '03', title: 'Milestone structural inspection', projectType: 'Existing building — safety inspection', location: 'South Florida', scope: 'Visual structural inspection, concrete distress mapping, prioritized findings', structuralSystem: 'Reinforced concrete frame, post-tensioned slabs', deliverables: 'Inspection report · Distress mapping · Follow-up scope', codes: 'Florida Building Code · F.S. 553.899', status: 'Representative scope' },
  { n: '04', title: 'Foundation system for a constrained site', projectType: 'New construction — foundations', location: 'Miami-Dade County, FL', scope: 'Foundation design against geotechnical report, settlement and uplift verification', structuralSystem: 'Mat foundation with grade beams; deep foundations at transfer zones', deliverables: 'Foundation drawings · Reactions schedule · Calculations', codes: 'ACI 318 · ASCE 7 · Florida Building Code', status: 'Representative scope' },
  { n: '05', title: 'Multi-discipline BIM coordination', projectType: 'New construction — coordination', location: 'South Florida', scope: 'Structural modelling, model federation, interference checking, issue tracking', structuralSystem: 'Reinforced concrete frame with long-span transfer beams', deliverables: 'Structural model · Clash & issue reports · Model-derived drawings', codes: 'ISO 19650 information management', status: 'Representative scope' },
  { n: '06', title: 'Independent structural peer review', projectType: 'Design review — third party', location: 'South Florida', scope: 'Independent review of drawings and calculations, comment log, close-out tracking', structuralSystem: 'Reinforced concrete and structural steel, mixed system', deliverables: 'Review report · Prioritized comment log · Resolution record', codes: 'ACI 318 · ASCE 7 · AISC 360 · Florida Building Code', status: 'Representative scope' },
];

export const workSection = {
  eyebrowReal: 'Selected work',
  eyebrowRepresentative: 'Representative scope',
  engagementsNote:
    'Representative engagement profiles — anonymized scope, structural systems and deliverables of the kind the practice carries. Named case studies are published only with client permission, and are labelled as firm projects or prior professional experience.',
  galleryEyebrow: 'The material',
  galleryLede: 'Reinforced concrete, reinforcement, residences and the coastline they stand on — the vocabulary of the work, uncaptioned on purpose.',
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   CREDENTIALS — design basis, stated once
   ═══════════════════════════════════════════════════════════════════════════ */

export const credentials = {
  eyebrow: 'Standards & accountability',
  sealedDeliverables: true,
  sealingStatement:
    'Deliverables are signed and sealed by Juan Tercero, PE., M.Sc., Florida-licensed Professional Engineer, where the scope of work requires it.',
  items: [
    { k: 'Design basis', v: 'ACI 318', note: 'Reinforced concrete design and detailing' },
    { k: 'Loads', v: 'ASCE 7', note: 'Wind, seismic and load combinations' },
    { k: 'Governing code', v: 'Florida Building Code', note: 'Structural provisions and existing-building requirements' },
    { k: 'Steel design', v: 'AISC 360', note: 'Applied where structural steel is in scope' },
    { k: 'Coordination', v: 'ISO 19650', note: 'Model-based information management' },
    { k: 'Service area', v: 'Miami-Dade & Broward', note: 'South Florida jurisdictions' },
  ],
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   THE ENGINEER — Juan Tercero, PE., M.Sc.
   ═══════════════════════════════════════════════════════════════════════════
   Only confirmed facts. `portrait` and `license` are null until supplied and
   the UI renders a finished composition without them. Do not add a
   university, a year count, a prior employer or an award that has not been
   confirmed in writing.
   ═══════════════════════════════════════════════════════════════════════════ */

export const leadership = {
  name: 'Juan Tercero, PE., M.Sc.',
  firstName: 'Juan',
  role: 'Principal Engineer · Founder',
  credential: 'Florida Professional Engineer',
  /** Path under /public, e.g. '/ttc/img/leadership/juan-tercero.jpg' — null until a real portrait exists. */
  portrait: null as { src: string; alt: string; w: number; h: number } | null,
  /** { number: 'PE 00000', url: 'https://www.myfloridalicense.com/…' } — null until confirmed. */
  license: null as { number: string; url: string } | null,
  linkedin: null as string | null,
  /** Home teaser: two sentences. */
  /** Home-teaser headline. Carries the promise without naming anyone. */
  teaserTitle: 'One engineer is responsible for the whole project.',
  teaser:
    'Every project at Tercero Tablada is engineered, reviewed and signed by the same person. You speak to the engineer of record from the first call, and the proposal you approve is the scope that gets built.',
  bio: [
    'Juan Tercero is a Florida-licensed Professional Engineer and the founder of Tercero Tablada Civil & Structural Engineering Inc. A civil engineer by training (National University of Engineering) with a Master in Construction Project Management from the Universidad de Barcelona, he leads every engagement personally — from the first conversation with an owner, board or architect to the sealed drawing set or the submitted report.',
    'The practice covers both halves of structural work in South Florida: the design of new reinforced-concrete buildings, and the evaluation, recertification and repair of buildings already standing. Both are done with the same discipline — the reasoning behind every conclusion is written down, and nothing leaves the office that has not been checked line by line.',
  ],
  education: [
    'Master in Construction Project Management — Universidad de Barcelona',
    'Civil Engineer — National University of Engineering',
    'Licensed Professional Engineer (P.E.), State of Florida',
  ],
  focus: [
    'Reinforced-concrete design for houses, mid-rise and commercial frames',
    'Recertification, milestone inspections and condition assessments',
    'Structural BIM modelling and multi-discipline coordination',
    'Wind and lateral design for the High-Velocity Hurricane Zone',
  ],
  approach:
    'I would rather explain a structural decision in plain language than hide it behind a code reference. A board should be able to read a findings report and know what to do next; a contractor should be able to build from the drawing without calling; and a reviewer should be able to follow the calculation from load to detail.',
  forYou: [
    { k: 'Direct communication', v: 'You talk to the engineer who is doing the work — not to an account manager relaying questions.' },
    { k: 'A scope you can read', v: 'Every proposal states what is included, what is not, what you receive and what it costs, before anything starts.' },
    { k: 'One engineer’s judgment', v: 'The person who inspects the building or sets the design basis is the person who signs the report and answers the reviewer.' },
  ],
  /** Rendered as facts on the typographic plate while there is no portrait. */
  plate: [
    { k: 'Name', v: 'Juan Tercero, PE., M.Sc.' },
    { k: 'Licensure', v: 'Professional Engineer, Florida' },
    { k: 'Role', v: 'Principal Engineer · Founder' },
    { k: 'Practice', v: 'Tercero Tablada Civil & Structural Engineering Inc.' },
    { k: 'Region', v: 'Miami-Dade & Broward' },
  ],
} as const;

export const aboutPage = {
  eyebrow: 'About the practice',
  titleLines: ['A structural practice built', 'around one accountable engineer.'],
  accentWord: 'accountable',
  plainTitle: 'A structural practice built around one accountable engineer.',
  sub: 'Tercero Tablada Civil & Structural Engineering Inc. designs new reinforced-concrete buildings and evaluates the ones already standing, across Miami-Dade and Broward — with the reasoning behind every conclusion written down and one Florida Professional Engineer responsible for all of it.',
  facts: [
    { k: 'Principal', v: 'Juan Tercero, PE., M.Sc.' },
    { k: 'Focus', v: 'Concrete · Existing buildings · BIM' },
    { k: 'Region', v: 'South Florida' },
  ],
  approach: {
    eyebrow: 'Approach',
    title: 'Reviewed line by line, before it leaves.',
    body: [
      'Two kinds of work run through this practice, and they inform each other. Designing new structures teaches you what fails in the field; inspecting buildings that have been standing for decades teaches you what to detail differently the next time.',
      'Our method is model-first. Structure is modelled, coordinated and documented as one connected source of truth, checked against the design basis, so that the design that gets permitted is the design that gets built.',
      'On existing buildings the same discipline applies in reverse: the building is field-verified before it is analyzed, and nothing is concluded from a drawing that has not been confirmed on site.',
    ],
  },
  principles: {
    eyebrow: 'Principles',
    title: 'How we hold the line.',
    items: [
      { k: 'Rigor', v: 'Every member is analyzed and checked against the governing code before it reaches a drawing.' },
      { k: 'Constructibility', v: 'Details that respect the field — buildable, sequenceable and clear to the contractor.' },
      { k: 'Coordination', v: 'Structure resolved against architecture and services early, so conflicts are caught in the model rather than on site.' },
      { k: 'Documented reasoning', v: 'Assumptions, loads and code provisions are written down, so any reviewer can follow the argument.' },
      { k: 'Longevity', v: 'Designed for durability and service life in a coastal environment, not just for the first day of occupancy.' },
    ],
  },
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE COPY — heroes and intros for the internal pages
   ═══════════════════════════════════════════════════════════════════════════ */

export const servicesPage = {
  eyebrow: 'Services',
  titleLines: ['Organised by what you need,', 'not by what we do.'],
  accentWord: 'need',
  plainTitle: 'Organised by what you need, not by what we do.',
  sub: 'Seven services in two tracks. If you are building something, start with new projects. If you own or manage a building that is already standing, start with existing buildings. Each service says when you need it, what is included, what you receive and what to do next.',
  facts: [
    { k: 'New projects', v: '4 services' },
    { k: 'Existing buildings', v: '3 services' },
    { k: 'Coverage', v: 'Miami-Dade & Broward' },
  ],
  tracks: {
    new: {
      id: 'new',
      eyebrow: 'New projects',
      title: 'You are building something.',
      lede: 'For owners, developers, architects and contractors with a project in design or heading to permit.',
    },
    existing: {
      id: 'existing',
      eyebrow: 'Existing buildings',
      title: 'You own or manage a building.',
      lede: 'For associations, property managers and owners with a notice, a deadline, visible distress or a repair to scope.',
    },
  },
} as const;

export const existingPage = {
  eyebrow: 'Existing buildings',
  titleLines: ['The building is', 'already standing.'],
  accentWord: 'standing.',
  plainTitle: 'The building is already standing.',
  sub: 'Recertification, milestone inspection, structural assessment and repair design for buildings in service across Miami-Dade and Broward. We document what is actually there, explain what it means structurally, and define the work that follows.',
  facts: [
    { k: 'For', v: 'Associations, owners, managers' },
    { k: 'Coverage', v: 'Miami-Dade & Broward' },
    { k: 'Output', v: 'Reports, repair scopes, reinspections' },
  ],
  triggers: {
    eyebrow: 'When to call',
    title: 'Four moments that need an engineer.',
    items: [
      { k: 'A notice arrived', v: 'A recertification or milestone-inspection notice has been issued and the board needs a structural engineer engaged before the deadline.' },
      { k: 'Visible distress', v: 'Cracking, spalling, corrosion staining or movement has appeared and someone needs to say whether it affects capacity.' },
      { k: 'Before you spend', v: 'Repairs are being priced and the scope has not been defined by an engineer, so the bids are not comparable.' },
      { k: 'Before you buy', v: 'Structural due diligence on an acquisition, including alterations and change-of-use questions.' },
    ],
  },
  servicesEyebrow: 'Services for existing buildings',
  timeline: {
    eyebrow: 'Building recertification',
    title: 'A clear path from notice to compliance.',
    lede: 'Miami-Dade calls the first recertification at 30 years — 25 near the coast; Broward at 25; the state milestone inspection at 30 for condominiums of three habitable stories or more. All of them come back every ten years. We run the structural side end to end so the board knows what happens next at every stage.',
    cta: { href: '/services/building-recertification', label: 'Recertification in detail' },
    steps: [
      { n: '01', title: 'Notice review', detail: 'We read the notice and the building record, confirm what the jurisdiction is asking for, and set the schedule against the stated deadline.' },
      { n: '02', title: 'Site inspection', detail: 'Visual structural inspection of accessible elements — frame, slabs, balconies, roof structure and exposed foundations — documented in the field.' },
      { n: '03', title: 'Findings', detail: 'Observed conditions are classified and explained in language a board can act on, with photographs tied to locations.' },
      { n: '04', title: 'Repairs', detail: 'Where repairs are required we define what must be corrected and to what standard, so the work can be bid and executed fairly.' },
      { n: '05', title: 'Reinspection', detail: 'Completed repairs are re-inspected and documented against the original findings before anything is certified.' },
      { n: '06', title: 'Submission', detail: 'The report is finalized, submitted, and we respond to questions raised by the reviewing office.' },
    ],
  },
} as const;

export const workPage = {
  eyebrowReal: 'Selected work',
  eyebrowRepresentative: 'Representative capabilities',
  titleLines: ['The frame behind', 'the project.'],
  accentWord: 'project.',
  plainTitle: 'The frame behind the project.',
  subReal: 'Structural engagements across South Florida — the building, the problem, the scope, our role and the documented result.',
  subRepresentative:
    'Engagement profiles describing the structural systems we work with, the scope each one carries, and the documents that come out of it. Anonymized by default; named case studies are published only with client permission.',
  facts: [
    { k: 'Coverage', v: 'Miami-Dade & Broward' },
    { k: 'Systems', v: 'Reinforced concrete, steel' },
  ],
} as const;

export const contactPage = {
  eyebrow: 'Request a proposal',
  titleLines: ['Tell us about the building.', 'We reply with a scope.'],
  accentWord: 'scope.',
  plainTitle: 'Tell us about the building. We reply with a scope.',
  sub: 'Describe the project, the building or the notice you received — and attach whatever you already have. The engineer reads every request and replies with questions or with a written proposal.',
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   SERVICE AREA
   ═══════════════════════════════════════════════════════════════════════════ */

export const serviceArea = {
  eyebrow: 'Where we work',
  title: 'Engineered for this coast.',
  body: 'Hurricane wind, a corrosive coastal environment, a high water table and a code shaped by all three. South Florida is not a generic design condition — it is the one we work in every day, across Miami-Dade and Broward.',
  counties: [
    { name: 'Miami-Dade County', code: 'MDC', note: 'High-Velocity Hurricane Zone' },
    { name: 'Broward County', code: 'BRW', note: 'High-Velocity Hurricane Zone' },
  ],
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
  eyebrow: 'Next step',
  titleLines: ['Tell us about the building.', 'We reply with a scope.'],
  accentWord: 'scope.',
  plainTitle: 'Tell us about the building. We reply with a scope.',
  body: 'A new project, an existing building or a notice with a deadline — describe it and attach what you have. You hear back from the engineer, with questions or with a written proposal.',
  primary: { href: '/contact', label: 'Request a Proposal' },
  secondary: { href: '/about#engineer', label: 'Meet the engineer' },
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   LEGAL
   ═══════════════════════════════════════════════════════════════════════════ */

export const legal = {
  notice:
    'Information on this site is general and does not constitute an engineering opinion, a professional engagement, or a representation about a specific building. Requirements vary by jurisdiction and scope.',
  contactFormNotice:
    'Submitting this form does not create a professional engineering relationship. We use your details and files only to respond to this request.',
  links: [
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms of Use' },
    { href: '/credits', label: 'Image Credits' },
  ],
  privacy: {
    title: 'Privacy Policy',
    sub: 'What we collect through this website, why we collect it, and what we do with it.',
    sections: [
      { h: 'What we collect', p: 'The only personal information this website collects is what you submit through the proposal request form: your name, email address, optional phone number and company, the service you selected, the project location, the description you write and any files you attach.' },
      { h: 'Why we collect it', p: 'We use it to respond to your request and to understand the engineering scope you are asking about. We do not sell it, rent it, or share it for advertising.' },
      { h: 'How it is stored', p: 'Submissions are stored in our project database and attachments in cloud file storage at an address that is never published or linked; a notification is emailed to the office through a transactional email provider so that we see your message, and a confirmation is emailed to you. Access is limited to the people who need it to reply to you.' },
      { h: 'How long we keep it', p: 'Requests are retained while they are commercially relevant and for as long as any resulting engagement requires. You may ask us to delete your request and its attachments at any time.' },
      { h: 'Cookies and analytics', p: 'This site does not set advertising or tracking cookies. Cookies may be used by the authenticated project-management area of this domain for sign-in purposes; those are strictly necessary to keep a session active and are not used to profile visitors to the public site.' },
      { h: 'Your choices', p: 'You can ask us what we hold about you, ask for it to be corrected, or ask for it to be deleted. Write to the address below and we will respond.' },
      { h: 'Changes', p: 'If this policy changes we will update it on this page.' },
    ],
  },
  terms: {
    title: 'Terms of Use',
    sub: 'The basis on which the information published here is provided.',
    sections: [
      { h: 'General information only', p: 'The content on this website describes services in general terms. It is not an engineering opinion, a recommendation for a specific building, or a substitute for a site-specific evaluation. Nothing here should be relied on as the basis for a construction, repair or compliance decision.' },
      { h: 'No professional relationship', p: 'Visiting this site, reading it, or submitting the proposal request form does not create a professional engineering relationship. An engagement begins only when scope, fee and terms are agreed in writing.' },
      { h: 'Regulatory outcomes', p: 'Requirements for inspection, recertification and permitting vary by jurisdiction, building age, construction type and scope. Ages and deadlines published here were verified on the date stated next to them and can change. Descriptions of any process on this site are typical sequences, not guarantees. We do not promise approval by any building department or reviewing authority.' },
      { h: 'Sealed documents', p: 'Where a signed and sealed document is required, it is issued as a formal deliverable under an agreed scope of work. Content on this website is never a sealed deliverable.' },
      { h: 'Accuracy and availability', p: 'We keep this site current, but do not warrant that every statement is complete or free of error, or that the site will always be available.' },
      { h: 'Intellectual property', p: 'The text, drawings and marks on this site belong to Tercero Tablada Civil & Structural Engineering Inc. unless stated otherwise, and may not be reproduced without permission.' },
    ],
  },
  contactHeading: 'Contact',
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   BUNDLE — everything a page needs, typed once and mirrored in site.es.ts
   ═══════════════════════════════════════════════════════════════════════════ */

export const en = {
  company,
  contact,
  primaryNav,
  primaryCta,
  footerNav,
  ui,
  hero,
  services,
  contactServiceOptions,
  typologiesSection,
  typologies,
  pathsSection,
  paths,
  recertBand,
  bim,
  software,
  howWeWork,
  caseStudies,
  engagements,
  workSection,
  credentials,
  leadership,
  aboutPage,
  servicesPage,
  existingPage,
  workPage,
  contactPage,
  serviceArea,
  closingCta,
  legal,
};

/**
 * The English bundle is written with `as const` so components can rely on
 * literal tuples; the Spanish bundle carries different strings, so the shared
 * type widens every literal to `string` while keeping the shape.
 */
type DeepWiden<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends readonly (infer U)[]
        ? readonly DeepWiden<U>[]
        : T extends object
          ? { readonly [K in keyof T]: DeepWiden<T[K]> }
          : T;

export type SiteContent = DeepWiden<typeof en>;
