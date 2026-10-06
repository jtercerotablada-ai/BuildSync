/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TERDAX ENGINEERING — public site content & configuration (ENGLISH)
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
 *     the work page renders `engagements`: TYPICAL engagement profiles, not
 *     past jobs. Never call them "anonymized" or give them a specific county —
 *     both tell a reader these are real projects.
 *   • Photographs and video come from `media.ts` and illustrate TYPOLOGIES and
 *     SERVICES — never a specific job. Read that file's rules before adding a
 *     placement; the "one placement per asset" rule is enforced by hand.
 *   • Regulatory thresholds (ages, deadlines) are per JURISDICTION and they
 *     move. Each county's numbers live ONLY in that county's own timing row
 *     — Miami-Dade's on `building-recertification`, Broward's on
 *     `broward-bsip` — never merged into one sentence, and never repeated in
 *     a headline, a lede or a meta description. Every row names its authority
 *     and carries the one shared date, `regulatoryChecked`. Re-verify against
 *     the primary source before amending, then move that date.
 *   • Never on this site: fees, fine amounts, phase-in years, a computed due
 *     year, "40-year" as if it were a current trigger, or any promise about
 *     how a reviewing office will act.
 *   • Both county programs ask for a structural report AND an electrical one.
 *     The firm prepares the structural report. Never write that it delivers
 *     "structural and electrical", and never imply it signs threshold
 *     buildings (over three stories or 50 feet) — see the two program pages.
 */

import { photo, video, type Photo, type Clip } from './media';

/* ═══════════════════════════════════════════════════════════════════════════
   COMPANY
   ═══════════════════════════════════════════════════════════════════════════ */

export const company = {
  /**
   * The brand is "Terdax Engineering" and that is what belongs in page
   * titles, metadata, schema.org, alt text and any sentence that names the
   * practice. `legalName` carries the corporate suffix and is for the
   * footer, the legal pages and schema.org `legalName` only.
   *
   * `shortName` exists ONLY for places where the full name genuinely cannot
   * fit (a drawing title block, a compact chip). Never reach for it just to
   * make a line shorter.
   */
  legalName: 'Terdax Engineering Inc.',
  name: 'Terdax Engineering',
  shortName: 'Terdax',
  discipline: 'Civil & Structural Engineering',
  url: 'https://terdaxengineering.com',
  /**
   * Used in <meta description> fallbacks, the footer tag and Organization
   * schema. Existing buildings first, each county's program by its own name
   * — the order the whole site now follows. No number belongs here.
   */
  description:
    'Structural engineering for South Florida — building recertification in Miami-Dade, the Building Safety Inspection Program (BSIP) in Broward, structural assessments and repair design, and the structural design of new buildings.',
  tagline: 'Structural Engineering for South Florida.',
  /**
   * Two real brand assets, both supplied by the client — never redraw either.
   *   lockup* = full horizontal signature (TT monogram + wordmark + tagline).
   *   mark*   = monogram only, for tight spots.
   * The `dark` variants are for LIGHT backgrounds and the `light` variants
   * are white, for DARK backgrounds only.
   *
   * The `*Sm` files are pure resizes of the same masters (no redraw) for the
   * site chrome, where a 1254px or 2172px PNG was being shipped to draw a
   * 40px mark. The masters stay for JSON-LD, the SaaS and email.
   */
  logo: {
    lockupDark: '/ttc/img/logo-horizontal.png',
    lockupLight: '/ttc/img/logo-white-wide.png',
    lockupSize: { w: 2172, h: 501 },
    lockupDarkSm: '/ttc/img/logo-horizontal@640.png',
    dark: '/ttc/img/logo-square.png',
    light: '/ttc/img/logo-white.png',
    markSize: { w: 1254, h: 1254 },
    markDarkSm: '/ttc/img/logo-square@256.png',
    markLightSm: '/ttc/img/logo-white@256.png',
    lockupLightSm: '/ttc/img/logo-white-wide@640.png',
    markSmSize: { w: 256, h: 256 },
    lockupSmSize: { w: 640, h: 148 },
  },
  /**
   * Florida Engineering Business Registry number (DBPR).
   *
   * This is the FIRM's registration, not the engineer's personal P.E. license,
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
  /* HIDDEN until the entity question is settled. #40285 is the DBPR
     registration of the previous corporate name; publishing it under
     "Terdax Engineering Inc." is only truthful if this is the SAME company
     renamed (Sunbiz amendment + DBPR update). If Terdax is a new entity it
     needs its own registration. Put the verified number back the day that is
     confirmed — the footer line disappears while this is null. */
  registry: null as string | null,
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   CONTACT
   ═══════════════════════════════════════════════════════════════════════════
   `null` means "not configured yet" — the UI skips it. Do not substitute a
   placeholder string.
   ═══════════════════════════════════════════════════════════════════════════ */

export const contact = {
  /**
   * NULL ON PURPOSE until info@terdaxengineering.com genuinely receives.
   *
   * The old mailbox (info@ttcivilstructural.com) is Google Workspace on the
   * retired domain, and publishing it would put the previous brand back on
   * the page. The new domain has no MX yet: adding it to Google Workspace is
   * an owner action. Publishing an address that bounces is worse than
   * publishing none — the contact form reaches us either way — so this stays
   * null until the MX for terdaxengineering.com is dug and confirmed.
   */
  email: null as string | null,
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
  language: {
    label: 'Language',
    en: 'EN',
    es: 'ES',
    switchTo: 'Ver en español',
    /** Visually hidden note on the inert switch of an English-only page (/credits). */
    unavailable: 'Spanish version not available',
  },
  breadcrumb: 'Breadcrumb',
  explore: 'Explore',
  /* Button and link CTAs are Title Case in English, matching the header's
     "Request a Proposal"; headings stay in sentence case. */
  exploreService: 'See This Service',
  learnMore: 'Learn More',
  requestProposal: 'Request a Proposal',
  exploreServices: 'Explore Our Services',
  seeAllServices: 'All Services',
  newProjects: 'New projects',
  existingBuildings: 'Existing buildings',
  whenYouNeedIt: 'When you need it',
  whatsIncluded: "What's included",
  whatYouReceive: 'What you receive',
  /** Section label above the two columns "What's included" / "What you receive". */
  scopeAndDeliverables: 'Scope & deliverables',
  nextStep: 'Next step',
  whenItApplies: 'When it applies',
  howItRuns: 'How the work runs',
  considerations: 'Good to know',
  /** The heading under the "Good to know" label, so the label is not repeated as the H2. */
  considerationsTitle: 'What changes the scope — and what no engineer can promise.',
  /** Labels over the two halves of each How-we-work card. */
  stepYourPart: 'Your part',
  stepYouGet: 'You get',
  /** Background-video toggle (WCAG 2.2.2). The label names the action the button takes. */
  pauseMotion: 'Pause background video',
  /** The one label for the representative profiles on Work — they are not past jobs. */
  typicalEngagements: 'Typical engagements',
  relatedServices: 'Related services',
  atAGlance: 'At a glance',
  appliesTo: 'Applies to',
  newConstruction: 'New construction',
  coverage: 'Coverage',
  verified: 'Verified',
  lastChecked: 'Last verified',
  /** Prefix for a timing row's authority where a layout prints it inline. */
  sourceLabel: 'Source',
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
    approach: 'How we work',
    forYou: 'What that means for you',
    readMore: 'Meet the Engineer',
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
    status: 'Status',
    /* The engagements are typical profiles, not jobs, so "not the project
       described" implied a real project behind each card. If a real case
       study ever carries a stock photo, revisit this wording for it. */
    illustrative: 'Illustrative image',
    firmProjects: 'Firm projects',
    priorExperience: 'Prior professional experience',
    priorNote:
      'Work performed at other firms before the practice was founded. Listed for experience only — not projects of Terdax Engineering.',
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
      'Building type, number of stories, what you need engineered or inspected, and any deadline or notice you are facing.',
    attachments: 'Attachments',
    attachmentsHint:
      'Municipal notice, photographs or drawings. PDF, images, DWG, DXF or ZIP — up to 25 MB each, five files.',
    addFiles: 'Add files',
    removeFile: 'Remove',
    /** Re-upload a file that failed (the form reads it as "Retry <file name>"). */
    retry: 'Retry',
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
      /* States the rule the form enforces (12+ characters), WCAG 3.3.3. */
      message: 'Tell us a little more about the project — at least a sentence (12+ characters)',
      generic: 'Something went wrong. Please email us instead.',
      /** A fetch that never reached the server; replaces the browser's raw "Failed to fetch". */
      network: "We couldn't reach the server. Check your connection and try again, or email us directly.",
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
  /* Rendered as note + link + end. Work has no case studies yet, so the
     note points at what IS there (the typical engagements), not at
     "published case studies" that do not exist. */
  typologiesNote:
    'Photographs illustrate the kind of structure described; none shows a project by Terdax Engineering. Typical engagements are listed under',
  typologiesNoteLink: 'Work',
  typologiesNoteEnd: '.',
  galleryNote:
    'Licensed architectural photography, shown as material rather than as a portfolio. No image on this page depicts a project by Terdax Engineering.',
  processDisclaimer:
    'Requirements vary by jurisdiction, building age, construction type and scope. This describes a typical sequence, not a guaranteed procedure or outcome.',
  legalPages: { privacy: 'Privacy Policy', terms: 'Terms of Use', legal: 'Legal' },
  /** The public 404 (EN and /es), rendered with the site chrome. */
  notFound: {
    eyebrow: 'Error 404',
    title: 'This page doesn’t exist.',
    sub: 'The link may be out of date, or the address may have a typo. The pages below will get you back on track.',
    home: 'Home',
    services: 'All Services',
    contact: 'Request a Proposal',
    metaTitle: 'Page not found',
  },
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
  /* The headline and both buttons are the owner-approved ones and did not
     change. The sub-line now names the two county programs first, by the
     names printed on the letters people receive, and carries NO regulatory
     number: every age and deadline lives in a timing row that names its
     authority and its date. */
  sub: 'Miami-Dade building recertification, Broward’s Building Safety Inspection Program (BSIP) and structural design for new buildings — led by a Florida Professional Engineer who stays on your project from the first conversation to the final report.',
  primary: { href: '/contact', label: 'Request a Proposal' },
  secondary: { href: '/services', label: 'Explore Our Services' },
  /**
   * The strip under the hero is four links, not four labels. A `#hash` href
   * is an anchor on the home page itself (the ids come from
   * `Service.program.id` and the new-buildings section) and is rendered
   * as-is; a path href goes through the locale helper like any other link.
   */
  caps: [
    { label: 'Miami-Dade · Recertification', href: '#miami-dade' },
    { label: 'Broward · BSIP', href: '#broward' },
    { label: 'Assessments & repair design', href: '/services/structural-condition-assessments' },
    { label: 'New-building design', href: '#new-buildings' },
  ],
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   SERVICES
   ═══════════════════════════════════════════════════════════════════════════ */

export type ServiceTrack = 'new' | 'existing';

/**
 * The ONE date every regulatory row on the site was last checked against its
 * primary source — the county codes, the Board of Rules and Appeals policy
 * and the state statute. It feeds `timing.checked` of the three regulated
 * services, and through them the two program sections on the home page, so
 * there is a single value to move after a re-verification. `site.es.ts`
 * carries the same date in Spanish.
 *
 * Move it only after re-reading the sources, never as a formality. Due again
 * no later than January 2027: the 9th Edition Florida Building Code takes
 * effect on December 31, 2026.
 */
export const regulatoryChecked = 'October 4, 2026';

export type Service = {
  slug: string;
  n: string;
  title: string;
  /** Short label for nav / footer / form dropdowns. */
  shortTitle: string;
  track: ServiceTrack;
  /** One or two lines. Used on cards and list rows. */
  summary: string;
  /**
   * The H2 of the "When you need it" section: 3–9 words, client language, no
   * promise. It used to be the whole `problem` paragraph set at display size,
   * which ran 13–23 lines beside an empty column.
   */
  problemTitle: string;
  /** The problem this service solves, in the client's terms. The lede under `problemTitle`, so it does not repeat it. */
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
   * Broward and the State each set a different clock — and each row sits on
   * its own page, so a number can never be read against the wrong county.
   *
   * THESE NUMBERS ARE REGULATORY AND THEY MOVE. `source` names the authority
   * and `checked` (always `regulatoryChecked`) the date the row was last
   * verified. Re-verify before amending.
   *
   * On the two county programs, `rows[0]` is ALSO what the home page prints
   * (ProgramSection): the same six labels, in the same order, on both, so
   * the two counties compare line by line. Do not restate a number from a
   * row anywhere else in the service — point at the row instead.
   */
  timing?: {
    checked: string;
    note: string;
    rows: { jurisdiction: string; source: string; facts: { k: string; v: string }[] }[];
  };
  /**
   * The service-hero "Coverage" fact, e.g. 'Miami-Dade County, Florida'.
   * Only the two county programs set it; every other service falls back to
   * `contact.serviceAreaLabel` (both counties).
   */
  coverage?: string;
  /**
   * JSON-LD `areaServed`. Default: both counties. A county program must not
   * tell a search engine it is offered in the other county. Place names stay
   * in English in both languages: they are identifiers, not copy.
   */
  areaServed?: string[];
  /**
   * The sibling county's page — "Building in Broward?" + "See the BSIP" →
   * /services/<slug>. The two programs never share a page or a number, so
   * each one points at the other instead.
   */
  crossLink?: { text: string; label: string; slug: string };
  /**
   * The home-page section of a county program. ONLY `building-recertification`
   * and `broward-bsip` carry one. The section's numbers are NOT here: it
   * prints `timing.rows[0]` and `timing.checked`. The one number a `program`
   * holds is the filing deadline in its headline, which must always equal
   * the row's "Time to file".
   */
  program?: {
    /** Anchor id on the home page: 'miami-dade' | 'broward' (see `hero.caps`). */
    id: string;
    /** SectionHeading label. */
    eyebrow: string;
    /** Two lines; the two programs are deliberately parallel. */
    titleLines: string[];
    /** ONE accent, and it falls on the thing that differs between counties. */
    accentWord: string;
    /** One paragraph, 55 words at most, no number. */
    lede: string;
    /** Four short labels: the published six-step sequence, compressed. */
    steps: string[];
    /** What the firm signs and what it does not. Never cut for space. */
    scopeNote: string;
    /** Solid button → /contact?service=<slug>. */
    cta: string;
    /** One line under the button: what to send, with or without a notice. */
    ctaNote: string;
    /** Text link → /services/<slug>. */
    detail: string;
  };
  seo: { title: string; description: string; keywords: string[] };
};

export const services: Service[] = [
  /* ── EXISTING BUILDINGS — listed first everywhere ───────────────────────
     This array's order IS the order of the /services tracks, the footer
     column and the contact-form dropdown: existing buildings first, and the
     two county programs first among them.

     Miami-Dade's recertification and Broward's BSIP are different programs,
     under different authorities, with different clocks. Each has its own
     page and its own numbers; neither page states the other county's, and
     each ends in a cross-link to the other. A number read against the wrong
     county is the most expensive mistake this site can make.

     Both pages publish the sequence the counties themselves give owners: the
     report is filed FIRST, even when it lists repairs; repairs follow under
     permit; an amended report (in Broward, with a completion letter) closes
     the file. The six process steps carry the same labels on both pages on
     purpose. The site used to put "Submission" last, after the repairs.

     Facts verified 2026-10-04 against the primary sources (county code,
     Board of Rules and Appeals policy, state statute). Not published on
     purpose, because the sources leave them open or they vary by city: fees
     and fines, phase-in years for buildings that were already past the
     trigger age, the base year of Broward's ten-year cycle, and whether a
     Miami-Dade condominium may rely on the state's longer filing period. */
  {
    slug: 'building-recertification',
    n: '01',
    title: 'Miami-Dade Building Recertification',
    shortTitle: 'Miami-Dade Recertification',
    track: 'existing',
    coverage: 'Miami-Dade County, Florida',
    areaServed: ['Miami-Dade County, Florida'],
    summary:
      'A clear path from the Miami-Dade notice to a closed recertification — inspection, the structural report on the county’s form, repair scope, reinspection.',
    problemTitle: 'A notice arrives with a deadline.',
    problem:
      'The Notice of Required Inspection comes with forms and very little explanation of what actually has to happen. Boards and owners need someone who knows the county’s sequence and can carry the structural side of it from the first site visit to the report that closes the recertification.',
    audience: [
      'Condominium, cooperative and homeowner associations',
      'Property managers',
      'Building owners and asset managers',
    ],
    when: [
      'A Notice of Required Inspection has arrived from your city or from Miami-Dade County — or a courtesy notice says one is on its way.',
      'A previous report listed repairs and the recertification is still open.',
      'You are buying or managing a Miami-Dade building and want to know where it stands in the recertification cycle.',
    ],
    capabilities: ['Notice review', 'Structural inspection', 'Report on the county’s form', 'Repair scope', 'Reinspection'],
    /* Scope = work the engineer does; deliverables = documents the client
       keeps. Four of six scope lines used to restate a deliverable. */
    scope: [
      'Review of the notice, the building’s records and prior reports',
      'Structural inspection on site — frame, slabs, balconies, facade, roof and foundations',
      'Classification of observed conditions by structural significance',
      'Repair scope defined so contractors bid the same work',
      'Reinspection of completed repairs',
      'Answers to the reviewing office’s questions on the structural report',
    ],
    /* The county's order, not the order the site used to publish: file the
       report first (even if it lists repairs), repair under permit, close
       with an amended report. Same six labels as the Broward page. */
    process: [
      { step: 'Notice review', detail: 'We read the notice and the building’s history, and confirm what the Building Official is asking for and by when.' },
      { step: 'Inspection', detail: 'Structural inspection on site — frame, slabs, balconies, facade, roof and exposed foundations — documented with photographs tied to their locations.' },
      { step: 'Report filed', detail: 'The structural report goes on the county’s own form, signed and sealed, and is filed even when it lists repairs. The county asks for the report first, not after the work.' },
      { step: 'Repairs under permit', detail: 'Where repairs are needed, we define what has to be corrected so contractors bid the same work. Repairs that need a permit wait for it, then follow its schedule.' },
      { step: 'Reinspection', detail: 'Completed repairs are reinspected and documented against the original findings.' },
      { step: 'Close-out', detail: 'An amended report states that the repairs are complete. That is what closes the recertification, until the next cycle.' },
    ],
    deliverables: [
      'Structural recertification report on the county’s own form, signed and sealed',
      'Photographic record of observed conditions',
      'Written repair scope where repairs are needed',
      'Letter on whether the building can remain occupied during repairs, where required',
      'Amended report after repairs',
    ],
    nextStep:
      'Send the notice — a phone photo is enough — or the address and the year built. We confirm what your Building Official is asking for and reply with a proposal for the inspection and the structural report.',
    timing: {
      checked: regulatoryChecked,
      /* This note used to say recertification and the state milestone
         inspection were "separate obligations … in different reports". The
         county code says the opposite: the recertification "shall serve as
         compliance" with the milestone requirement (Sec. 8-11(f)(2)(A)), and
         the county states that only the recertification reports are filed.
         What state law still asks of the BOARD is the unit-owner duties of
         F.S. 553.899(5) and (9), which reach only buildings of three habitable
         stories or more. The statute is named in the prose because this
         block's row source is the county's. */
      note: 'The notice comes from the Building Official of your city, or from the county in unincorporated areas, and the report is filed with that same office. For condominium and cooperative buildings of three habitable stories or more, the recertification report serves as the state milestone inspection, and the board’s duties to unit owners under state law (Florida Statute 553.899) remain: within 14 days of receiving the notice, tell them about the required inspection and the date it must be completed; within 45 days of receiving the report, send every owner the engineer’s summary, post it in a conspicuous place on the property, and publish the report and the summary on the association’s website where the association is required to have one.',
      rows: [
        {
          jurisdiction: 'Miami-Dade County',
          source: 'Code of Miami-Dade County, Section 8-11(f)',
          /* Same six labels, same order, as the Broward row — the home page
             prints the two side by side. Re-checked 2026-10-04 against the
             code on Municode (through Ord. 26-59) and miamidade.gov.

             "First due": the 25-year trigger is for "condominium and
             cooperative association buildings that are three stories or
             taller located within three miles of the coastline"; every other
             building is 30. Never shorten it to "coastal buildings" or
             "coastal condos". Age is the Property Appraiser's year built,
             and a renovation does not reset it.

             "Applies to": the small-building exemption needs BOTH conditions
             (occupant load and area), hence "both".

             "Time to file": the code says the Building Official "shall
             provide" the courtesy notices and that not receiving them
             excuses nothing — so "should arrive", never "arrive". */
          facts: [
            { k: 'Applies to', v: 'Almost every building type — condominiums, co-ops, apartments, offices, retail and industrial. Outside the program: single-family homes, duplexes, and buildings with both an occupant load of 10 or less under the Florida Building Code and a gross area of 2,000 sq ft or less.' },
            { k: 'First due', v: 'At 30 years — 25 for condominium and cooperative buildings of three or more stories within 3 miles of the coast. Age is counted from the year built on the Property Appraiser’s record.' },
            { k: 'Then', v: 'Every 10 years, for the life of the structure.' },
            { k: 'Time to file', v: '90 days from the Notice of Required Inspection. Courtesy notices should arrive two years and one year ahead; not receiving them does not move the deadline.' },
            { k: 'If repairs are needed', v: '150 days from the Notice to finish repairs that need no permit and to obtain permits for the rest. Permitted work then follows its permit, and an amended report closes the recertification.' },
            { k: 'Condominiums & co-ops', v: 'The recertification serves as compliance with the state milestone inspection — no separate milestone report is filed.' },
          ],
        },
      ],
    },
    considerations: [
      /* A naming note, not a deadline: owners still search for the program by
         its old name, and a county notice template with the legacy title is
         still online. It deliberately restates NO threshold — it points at
         the verified row instead. This is the one place the page says
         "40-year"; never write it as if it were a current trigger. */
      'Still widely called the “40-year recertification” — the first one now falls due earlier, at the ages listed above.',
      /* Scope honesty. This replaced "electrical recertification is a
         separate discipline", which read as if the electrical part were
         optional. It is part of the same filing; the firm does not sign it. */
      'Miami-Dade’s program asks for a structural report and an electrical report. We prepare the structural report; the electrical report is signed by a professional qualified in electrical design.',
      /* Threshold buildings: neutral on purpose. It states the county's rule
         and what we do about it; it claims no credential either way. */
      'Buildings over three stories or 50 feet are “threshold buildings”, and their structural report must come from an engineer with the additional qualifications Miami-Dade County requires. We confirm this for your building before we propose.',
      'The structural and electrical reports go on the county’s own forms; a firm’s own form is not accepted. The county’s packet also includes certificates for parking-lot illumination and, where a lot is next to water, guardrails.',
      'The building is judged against the code in force when it was built. Recertification does not require bringing it up to today’s code.',
      'The Building Official may grant an extension of up to 60 days to file the report or to obtain permits, on a signed and sealed request from the engineer stating that the building can remain occupied.',
      'The amended report that closes a recertification comes from the engineer or architect who filed the original report. If another firm filed yours, say so when you write — we confirm what closing it will take before we propose.',
      'A condition that puts life or property in danger is reported to the owner and to the Building Official; the engineer has a duty to do so.',
      'Each city runs its own notices and filing, and may have its own forms. Questions about a notice go to the office that sent it, and we read your city’s letter first.',
      'A report documents observed conditions; concealed ones may need further investigation, and no engineer can guarantee how a reviewing office will act on it.',
    ],
    crossLink: { text: 'Building in Broward?', label: 'See the BSIP', slug: 'broward-bsip' },
    program: {
      id: 'miami-dade',
      eyebrow: 'Miami-Dade County · Building Recertification',
      /* Parallel with the Broward headline: the accent falls on the filing
         deadline, the one thing a reader must not carry across counties.
         "90 days" must always equal the row's "Time to file". */
      titleLines: ['Miami-Dade recertification.', '90 days from the notice.'],
      accentWord: '90 days',
      lede: 'Miami-Dade’s recertification reaches almost every building other than single-family homes and duplexes. Send us the notice from your city or the county: we inspect the building, prepare the structural report on the county’s own form, and stay through repairs to the amended report that closes it.',
      steps: ['Notice review', 'Inspection', 'Report filed', 'Repairs & close-out'],
      scopeNote:
        'Miami-Dade’s program asks for a structural report and an electrical report. We prepare the structural report; the electrical report is signed by a professional qualified in electrical design.',
      cta: 'Send the Miami-Dade Notice',
      ctaNote: 'A phone photo of the letter is enough. No notice yet? Send the address and the year built.',
      detail: 'Recertification in Detail',
    },
    /* seo: no ages and no day counts. The numbers live in the timing row,
       with their authority and date; a meta description is where a stale
       number survives longest. "40 year" stays in the keywords only — it is
       what people type, not something the page claims. */
    seo: {
      title: 'Miami-Dade Building Recertification — Structural Engineer',
      description:
        'Miami-Dade building recertification: notice review, structural inspection and report on the county’s own form, repair scope and reinspection, by a Florida P.E.',
      keywords: ['building recertification Miami-Dade', 'Miami-Dade recertification engineer', '40 year recertification Miami', '30 year recertification Miami', 'condo recertification Miami', 'structural recertification report'],
    },
  },
  {
    slug: 'broward-bsip',
    n: '02',
    title: 'Broward Building Safety Inspection Program (BSIP)',
    shortTitle: 'Broward BSIP',
    track: 'existing',
    coverage: 'Broward County, Florida',
    areaServed: ['Broward County, Florida'],
    summary:
      'From the Notice of Required Inspection to the completion letter that closes the file — inspection, the structural report on the program’s official form, repair scope, reinspection.',
    /* Not "The letter says 180 days": what a given city's letter says was not
       verified, and a city may set its own dates. The number is in the row. */
    problemTitle: 'A certified letter with a deadline.',
    /* The one place this page says "40-year": as the name people still use,
       never as a trigger. */
    problem:
      'Broward’s Building Safety Inspection Program (BSIP) is a countywide safety inspection of older buildings, structural and electrical, written by the Broward County Board of Rules and Appeals and enforced by your city’s Building Official. Many owners still call it the 40-year recertification, and much of what is written about it describes rules that have since changed. Boards and owners need someone working from the current policy who can carry the structural side from the first site visit to the close-out.',
    audience: [
      'Condominium, cooperative and homeowner associations',
      'Property managers',
      'Owners of rental, commercial and mixed-use buildings',
    ],
    when: [
      'A Notice of Required Inspection has arrived from your city’s Building Official — or the building is nearing the age at which one will.',
      'A previous report listed repairs and the file is still open.',
      'You are buying or managing a Broward building and want to know where it stands in the inspection cycle.',
    ],
    capabilities: ['Notice review', 'Structural inspection', 'Report on the official form', 'Repair scope', 'Reinspection & close-out'],
    scope: [
      'Review of the notice, the building’s records and prior reports',
      'Structural inspection on site — frame, slabs, balconies, stairs, guardrails, roof and foundations, and the parking garage where there is one',
      'Classification of observed conditions by structural significance',
      'Repair scope defined so contractors bid the same work',
      'Reinspection of the repaired areas',
      'Answers to the Building Official’s questions on the structural report',
    ],
    /* Same six labels as the Miami-Dade page; Broward's own content. */
    process: [
      { step: 'Notice review', detail: 'We read your city’s letter first: the date it was received, the date it sets, and what the Building Official asks to be filed.' },
      { step: 'Inspection', detail: 'A systematic visual examination of the structure on site, with testing or opened finishes only where what we see calls for it.' },
      { step: 'Report filed', detail: 'A written narrative report with color photographs, plus the official structural form of the Board of Rules and Appeals, signed and sealed. It is filed as soon as it is complete, even when it lists repairs.' },
      { step: 'Repairs under permit', detail: 'Where repairs are needed, we define the work so contractors bid the same scope, and issue the signed and sealed letter on whether the building can stay occupied meanwhile. Repairs wait for their permits.' },
      { step: 'Reinspection', detail: 'When the work is complete, the areas noted in the original report are reinspected.' },
      { step: 'Close-out', detail: 'An amended report and a signed and sealed completion letter go to the owner and to the Building Official. That closes the file, until the next cycle.' },
    ],
    deliverables: [
      'Structural report on the program’s official form, with a written narrative and color photographs, signed and sealed',
      'Written repair scope where repairs are needed',
      'Signed and sealed letter on whether the building can remain occupied during repairs',
      'Amended report and completion letter after repairs',
    ],
    nextStep:
      'Send the notice — a phone photo is enough — or the address and the year of the certificate of occupancy. We read what your city is asking for and reply with a proposal for the inspection and the structural report.',
    timing: {
      checked: regulatoryChecked,
      /* Policy #05-05, Sec. I.E: the program "shall serve as compliance for
         both phase one and phase two milestone inspection requirements". The
         two duties to unit owners are the state's (F.S. 553.899(5) and (9))
         and stay with the board. */
      note: 'For condominium and cooperative buildings of three habitable stories or more, the BSIP report serves as phase one and phase two of the state milestone inspection, and the board’s duties to unit owners under state law (Florida Statute 553.899) remain: within 14 days of receiving the notice, tell them about the required inspection and the date it must be completed; within 45 days of receiving the report, send every owner the engineer’s summary, post it in a conspicuous place on the property, and publish the report and the summary on the association’s website where the association is required to have one. Your city’s Building Official enforces the program, and your city’s letter states its own date — which is why we read it first.',
      rows: [
        {
          jurisdiction: 'Broward County',
          source: 'Broward County Board of Rules and Appeals, Policy #05-05 · Florida Building Code, Broward County Amendments, Section 110.15',
          /* Same six labels, same order, as the Miami-Dade row. Checked
             2026-10-04 against the Board's posted Policy #05-05 (effective
             August 9, 2024) and Section 110.15 on Municode.

             "Time to file" carries BOTH hedges and neither may be cut. The
             superseded policy (May 11, 2023) gave 90 days and is still
             hosted on city websites, so a board will have read 90 somewhere;
             and a city may prescribe its own timeline, so its letter rules.
             The 180 days run from RECEIVING the notice.

             "Then": only "every 10 years". Two current official texts count
             the interval from different years, and buildings first inspected
             under the old program keep their cycle — never compute a year.

             "Applies to" lists the exemptions an owner is likely to ask
             about; the government, school, tribal and railroad ones are in
             `considerations`. */
          facts: [
            { k: 'Applies to', v: 'Almost all building types, in every Broward city and the unincorporated area. Outside the program: one- to four-family dwellings of three or fewer habitable stories, fee-simple townhouses, and minor structures under 3,500 sq ft of building area.' },
            { k: 'First due', v: 'At 25 years, counted from the certificate of occupancy.' },
            { k: 'Then', v: 'Every 10 years.' },
            { k: 'Time to file', v: '180 days from receiving the Notice of Required Inspection. Older guides still say 90 days; the policy in force since August 9, 2024 gives 180. Your city’s letter states its own date.' },
            { k: 'If repairs are needed', v: '180 days from the date of the report, under permit, unless the Building Official sets a different time. A reinspection, an amended report and a signed and sealed completion letter close the file.' },
            { k: 'Condominiums & co-ops', v: 'The BSIP report serves as phase one and phase two of the state milestone inspection.' },
          ],
        },
      ],
    },
    considerations: [
      'The Board of Rules and Appeals sends each city its list of buildings by June, and the Building Official mails the notices by certified mail from June through August. Not receiving one is no defense: the inspection, the report and any repairs are still due on time.',
      /* "An extension", never "one extension": the policy does not say
         whether more than one can be granted. */
      'The Building Official may grant an extension of up to 60 days to submit the report.',
      /* Scope honesty — the same sentence as the Miami-Dade page. */
      'Broward’s program asks for a structural report and an electrical report. We prepare the structural report; the electrical report is signed by a professional qualified in electrical design.',
      /* Threshold buildings: neutral on purpose, claims no credential. */
      'Buildings over three stories or 50 feet are “threshold buildings”, and their structural report must come from an engineer with the additional qualifications Broward County requires. We confirm this for your building before we propose.',
      'Only the Board of Rules and Appeals’ own structural and electrical forms are accepted — a firm’s own form is not — and they come in addition to a written narrative report with color photographs, not instead of it.',
      'The building is judged against the code in force when it was built. The program does not require bringing it up to today’s code.',
      'While repairs are underway, the engineer issues a signed and sealed letter on whether the building can remain occupied.',
      'The amended report and the completion letter come from the professional who inspected the building and issued the original report. If another firm issued yours, say so when you write — we confirm what closing the file will take before we propose.',
      'Also outside the program: federal and State of Florida buildings, buildings on sovereign tribal lands, Broward County School Board schools, and railroads. Parking garages, guardrails, and the balconies, elevated decks, docks and seawalls attached to or supporting a structure are part of the inspection.',
      'A condition that puts life or property in danger is reported to the owner and to the Building Official; the engineer has a duty to do so.',
      'Each city handles filing its own way. We read your city’s letter first, and work to the date it states.',
      'A report documents observed conditions; concealed ones may need further investigation, and no engineer can guarantee how a reviewing office will act on it.',
    ],
    crossLink: { text: 'Building in Miami-Dade?', label: 'See Miami-Dade Recertification', slug: 'building-recertification' },
    program: {
      id: 'broward',
      eyebrow: 'Broward County · Building Safety Inspection Program (BSIP)',
      /* "180 days" must always equal the row's "Time to file". */
      titleLines: ['Broward BSIP.', '180 days from the notice.'],
      accentWord: '180 days',
      lede: 'Broward’s Building Safety Inspection Program — many owners still call it the 40-year recertification — reaches almost every building type, in every city. Send us the notice from your Building Official: we inspect the building, prepare the structural report on the Board of Rules and Appeals’ own form, and stay through repairs and close-out.',
      steps: ['Notice review', 'Inspection', 'Report filed', 'Repairs & close-out'],
      scopeNote:
        'Broward’s program asks for a structural report and an electrical report. We prepare the structural report; the electrical report is signed by a professional qualified in electrical design.',
      cta: 'Send the Broward Notice',
      ctaNote: 'A phone photo of the letter is enough. No notice yet? Send the address and the year of the certificate of occupancy.',
      detail: 'BSIP in Detail',
    },
    /* seo.title leads with the words people type: the program's full name,
       the county and the acronym. No ages and no day counts in the
       description (see the Miami-Dade page); the legacy names live in the
       keywords only. */
    seo: {
      title: 'Broward Building Safety Inspection Program (BSIP) — Structural Engineer',
      description:
        'Broward’s Building Safety Inspection Program (BSIP): notice review, structural inspection and report on the official form, and close-out, by a Florida P.E.',
      keywords: ['Broward BSIP engineer', 'building safety inspection program Broward', '25-year building inspection Broward', 'Broward BSIP', 'building safety inspection Broward', '40 year inspection Broward', 'BSIP structural report'],
    },
  },
  {
    /* Renamed from `building-safety-inspections`, which was one word away
       from Broward's program name and would have competed with its page. The
       old URLs redirect permanently, EN and /es (next.config.ts).

       This page used to sell the milestone inspection as a separate job with
       its own report. In Miami-Dade and Broward it is not: the county report
       serves as the milestone inspection. So the page now does three things
       the two county pages do not — it explains the state law to a board,
       it covers the further investigation a report calls for ("phase two"
       is named only in the state row and the note: in both counties the
       county report serves as it), and it covers
       structural safety inspections nobody sent a notice for. */
    slug: 'milestone-inspections',
    n: '03',
    title: 'Milestone & Structural Safety Inspections',
    shortTitle: 'Milestone Inspections',
    track: 'existing',
    summary:
      'Florida’s milestone inspection explained for your building, further investigation when a report calls for it, and structural safety inspections outside a program cycle.',
    problemTitle: 'Which inspection does the building owe?',
    problem:
      'Florida’s milestone law overlaps with Miami-Dade’s recertification and with Broward’s Building Safety Inspection Program, and it is easy to conclude that a building owes two separate inspections — the state’s and the county’s. In Miami-Dade and Broward the milestone inspection is met through the county program. What a board needs is someone to say which rules reach the building, what was actually observed, and what has to happen next.',
    audience: [
      'Condominium and cooperative associations',
      'Buyers, lenders and insurers',
      'Owners and managers of aging or coastal buildings',
    ],
    when: [
      /* Was "…is reaching 30 years — 25 near the coast": under state law 25
         applies only where the local agency requires it. The ages are in the
         row below and on each county's page. */
      'Your board needs to know whether Florida’s milestone law reaches the building, and how it is met in your county.',
      'A report found substantial structural deterioration, and the further investigation it calls for — testing or opened finishes — has to be scoped and carried out.',
      'There is no notice, but there is a reason to look: a purchase, visible distress, or a lender’s or insurer’s request.',
    ],
    capabilities: ['Applicability review', 'Structural inspection', 'Further investigation', 'Prioritized findings'],
    scope: [
      'Review of which rules reach the building — the state milestone law, the county program, or neither',
      'Visual inspection of the primary structural system',
      'Balcony, walkway and railing structural review',
      'Concrete distress mapping — spalling, cracking, corrosion staining',
      'Further investigation where a report found substantial structural deterioration, with testing located where it disturbs least',
      'Separating cosmetic from structural, and urgent from monitorable',
    ],
    process: [
      { step: 'Applicability', detail: 'We confirm which rules reach the building and what any notice in hand is asking for. Where a county program applies, the work runs as that program.' },
      { step: 'Records review', detail: 'Available drawings, prior reports and repair history reviewed before the site visit.' },
      { step: 'Field inspection', detail: 'Systematic visual inspection with photographic documentation and location mapping.' },
      { step: 'Evaluation', detail: 'Observations evaluated structurally — distinguishing cosmetic from structural, and urgent from monitorable. Where deterioration is substantial, the further investigation is scoped.' },
      { step: 'Report', detail: 'Findings issued with clear priorities and, for condominiums and co-ops, a separate summary the board can send to unit owners.' },
    ],
    deliverables: [
      'Inspection report with photographic record',
      'Condition findings organized by priority',
      'Summary of findings for unit owners, for condominiums and co-ops',
      'Scope and findings of any further investigation the inspection calls for',
      'Signed and sealed documents where the scope requires it',
    ],
    nextStep:
      'Tell us the building’s county, age and number of stories, and what raised the question — a notice, a report, a sale. We reply with which rules apply and a proposal for the inspection.',
    timing: {
      checked: regulatoryChecked,
      /* The statute number stays in the row's `source` (the authority every
         regulatory number must name), not in the prose.

         This note used to say the milestone inspection "is separate from
         county recertification … on different deadlines". Both county rules
         say the county report serves as it. "No separate milestone report"
         is stated for Miami-Dade only, where the county says so; for Broward
         the policy says the report serves as both phases and no more is
         claimed. The state's own filing period is deliberately not printed:
         the deadline a board answers to is the one on its county's page. */
      note: 'In Miami-Dade and Broward the state milestone inspection is met through the county program. Miami-Dade’s recertification serves as compliance with it — no separate milestone report is filed there — and Broward’s BSIP report serves as its phase one and phase two. The deadline on your notice is the county program’s, and it is on that county’s page. The board’s duties to unit owners apply in either county.',
      rows: [
        {
          jurisdiction: 'State of Florida — milestone inspection',
          source: 'Florida Statute 553.899',
          facts: [
            { k: 'Applies to', v: 'Condominium and cooperative buildings of three habitable stories or more' },
            { k: 'First due', v: 'By December 31 of the year the building reaches 30 years, counted from the certificate of occupancy — 25 years where the local enforcement agency requires it, for conditions such as proximity to salt water' },
            { k: 'Then', v: 'Every 10 years' },
            { k: 'Phase two', v: 'Only where phase one finds substantial structural deterioration' },
            { k: 'Unit owners', v: 'Within 14 days of receiving the notice, the association tells unit owners about the required inspection and the date it must be completed; within 45 days of receiving the report, it sends every owner the engineer’s summary, posts it in a conspicuous place on the property, and publishes the report and the summary on its website where it is required to have one' },
          ],
        },
      ],
    },
    considerations: [
      'The state law reaches only the condominium and cooperative buildings described above. Other buildings can still fall under a county program, which covers almost every building type.',
      'Further investigation is as limited or as extensive as the distress requires. Its scope is set from what the inspection finds, not before.',
      'Visual inspection covers accessible, observable conditions. Concealed deterioration may require testing or selective demolition.',
      /* Neutral on purpose: states the counties' rule, claims no credential. */
      'For buildings over three stories or 50 feet, each county asks additional qualifications of the engineer who signs the structural report. We confirm this for your building before we propose.',
      'An inspection reports condition at a point in time; it is not a warranty of future performance.',
    ],
    /* "building safety inspection Broward" moved to the BSIP page with the
       slug rename: that query is about Broward's program, not this page. */
    seo: {
      title: 'Florida Milestone Inspections — Miami-Dade & Broward',
      description:
        'Florida milestone inspections for condos and co-ops in Miami-Dade and Broward: how the county program meets them, phase two, and structural safety inspections.',
      keywords: ['milestone inspection Florida', 'milestone inspection Miami', 'condo milestone inspection', 'phase two milestone inspection', 'balcony inspection Miami', 'structural inspection South Florida'],
    },
  },
  {
    slug: 'structural-condition-assessments',
    n: '04',
    title: 'Structural Assessments & Repair Design',
    shortTitle: 'Assessments & Repairs',
    track: 'existing',
    summary:
      'What the building is actually doing today — deterioration assessed, capacity evaluated, repairs engineered so they can be bid and built.',
    problemTitle: 'Not every crack is a structural problem.',
    problem:
      'Cracking, spalling and movement all look alarming and mean very different things. Before spending on repairs, an owner needs to know which conditions affect capacity and which do not — and then needs repairs specified precisely enough to price.',
    audience: [
      'Owners planning repairs or capital works',
      'Buyers performing structural due diligence',
      'Associations responding to inspection findings',
    ],
    when: [
      'A recertification, BSIP or inspection report lists repairs and the contractors’ bids are not comparable because nobody defined the scope.',
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
    seo: {
      title: 'Structural Assessments & Repair Design — Miami-Dade & Broward',
      description:
        'Structural condition assessments and concrete repair design for existing South Florida buildings: what the distress means, and repairs specified to bid.',
      keywords: ['structural condition assessment Miami', 'concrete repair engineer Florida', 'balcony repair design', 'existing building evaluation', 'structural due diligence Miami'],
    },
  },
  /* ── NEW PROJECTS ──────────────────────────────────────────────────────── */
  {
    slug: 'reinforced-concrete-design',
    n: '05',
    title: 'Reinforced Concrete Design',
    shortTitle: 'Reinforced Concrete Design',
    track: 'new',
    summary:
      'Foundations, columns, beams, slabs and shear walls designed as one load path — detailed for the field and issued permit-ready.',
    problemTitle: 'Concrete has to be right on paper first.',
    problem:
      'Concrete is unforgiving: reinforcement that cannot be placed, a transfer condition resolved late, or a slab thickness set before the loads are known all become field problems that cost far more than they saved.',
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
      { step: 'Load take-down', detail: 'Occupancy, dead, live and hurricane-wind loads established for the actual site before any member is sized.' },
      { step: 'System selection', detail: 'Framing layout, slab type and lateral strategy chosen with the architect — span, depth and cost tested together.' },
      { step: 'Analysis & sizing', detail: 'Members analyzed and designed to the Florida Building Code, with deflection and serviceability checked.' },
      { step: 'Detailing', detail: 'Reinforcement drawn so it can actually be placed — congestion, cover, hooks and splices resolved on the drawing.' },
      /* One engineer: the check is thorough, not "independent". */
      { step: 'Check & seal', detail: 'Drawings checked line by line against the calculations, then signed and sealed for permit submittal.' },
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
    /* seo.title: keyword + place inside the ~55 characters a result shows
       before the layout's firm-name suffix. seo.description: 110–160
       characters, no code names. */
    seo: {
      title: 'Reinforced Concrete Design — Miami-Dade & Broward',
      description:
        'Reinforced concrete design for South Florida houses, mid-rise and commercial buildings: foundations, columns, slabs and shear walls, issued permit-ready.',
      keywords: ['reinforced concrete design', 'concrete structure design Miami', 'structural engineer Miami', 'structural engineer Broward'],
    },
  },
  {
    slug: 'structural-analysis',
    n: '06',
    title: 'Structural Analysis & Foundations',
    shortTitle: 'Structural Analysis & Foundations',
    track: 'new',
    summary:
      'Gravity and lateral analysis, wind and seismic demand, and the foundation system that carries all of it into the ground.',
    problemTitle: 'One load path, from roof to soil.',
    problem:
      'When the gravity design, the wind design and the foundations are handled as separate exercises, the seams between them are where failures and change orders start.',
    audience: [
      'Design teams needing a complete structural model',
      'Owners evaluating feasibility or structural options',
      'Contractors assessing constructability of a system',
    ],
    when: [
      'You need to know whether a site, a soil report or a building concept works structurally before committing.',
      'The project has a difficult site: tight lot, poor bearing, high water table, close neighbors.',
      'You need wind and lateral demand resolved for a High-Velocity Hurricane Zone site.',
    ],
    capabilities: ['3D modeling', 'Wind & seismic demand', 'Drift control', 'Deep foundations', 'Settlement checks'],
    scope: [
      'Three-dimensional analytical modeling of the structure',
      'Hurricane wind and lateral demand for the actual site',
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
    seo: {
      title: 'Structural Analysis & Foundations — Miami-Dade & Broward',
      description:
        'Structural analysis and foundation design in Miami-Dade and Broward: hurricane wind, lateral systems, and shallow or deep foundations for difficult sites.',
      keywords: ['structural analysis South Florida', 'foundation design Miami', 'wind analysis ASCE 7 Florida', 'lateral system design'],
    },
  },
  {
    slug: 'bim-coordination',
    n: '07',
    title: 'BIM Modeling & Coordination',
    shortTitle: 'BIM Coordination',
    track: 'new',
    summary:
      'Coordinated digital models that resolve conflicts before they reach the field and produce clearer structural deliverables.',
    problemTitle: 'Find the conflicts before the site does.',
    problem:
      'Most conflicts between the structure, the architecture and the mechanical, electrical and plumbing systems are discovered on site, where they cost the most to fix. A coordinated model moves that discovery back into design, where it costs a conversation instead of a change order.',
    audience: [
      'Design teams running multi-discipline coordination',
      'Contractors requiring model-based deliverables',
      'Owners who want the as-designed model to survive into operations',
    ],
    when: [
      'The project team works in Revit and needs the structure modeled to the same standard.',
      'The owner or contractor requires a federated model and clash reports as a deliverable.',
      'Ducts, pipes and structure keep colliding on drawings and someone has to own the resolution.',
    ],
    capabilities: ['Structural modeling', 'Model federation', 'Clash detection', 'Issue tracking', 'Model-derived drawings'],
    scope: [
      'Structural modeling — foundations, columns, slabs, walls, framing',
      'Federation of structural, architectural and MEP models',
      'Interference checking and clash resolution tracking',
      'Model-derived drawings, schedules and quantities',
      'Coordination meetings and issue reporting',
      'Model delivery aligned to project information requirements',
    ],
    process: [
      { step: 'Set the rules', detail: 'Shared coordinates, level and grid naming, model breakdown and level of information agreed before modeling starts.' },
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
      'Tell us the software the team uses, the level of detail required and the coordination schedule. We propose the modeling scope and the exchange format.',
    considerations: [
      'Coordination quality depends on what the other disciplines deliver and when; the process is collaborative by definition.',
      'A model is not a substitute for a signed and sealed drawing set — it supports it.',
      'Level of information should match the decision being made, not the largest number available.',
    ],
    seo: {
      title: 'BIM Modeling & Coordination — Miami-Dade & Broward',
      description:
        'Structural BIM modeling and coordination for South Florida projects: Revit models, clash detection and model-derived structural drawings.',
      keywords: ['BIM coordination Miami', 'structural BIM modeling', 'clash detection structural', 'Revit structural engineer Florida'],
    },
  },
  {
    slug: 'peer-review',
    n: '08',
    title: 'Peer Review & Compliance',
    shortTitle: 'Peer Review',
    track: 'new',
    summary:
      'An independent second read of the structural design — code compliance, load path, constructability and documentation quality.',
    problemTitle: 'A second read before the drawings go out.',
    problem:
      'By the time a structural problem is found in construction, it is a schedule event. An independent review before the set is issued is the cheapest risk reduction available on a project.',
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
      'Review of analysis assumptions and modeling',
      'Constructability and detailing review',
      'Documentation completeness and coordination review',
      /* Work the engineer does; the comment log itself is a deliverable. */
      'Review of the design team’s responses until every comment is closed',
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
    seo: {
      title: 'Structural Peer Review & Compliance — Miami-Dade & Broward',
      description:
        'Independent structural peer review — code compliance, load path, constructability and documentation review for projects in Miami-Dade and Broward.',
      keywords: ['structural peer review', 'independent structural review Florida', 'third party structural review Miami', 'structural due diligence'],
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
  /* One photograph per service, keyed by slug. The card, the service-page
     hero and — for the two county programs — the home-page section are one
     placement seen from different doors (see media.ts).

     The two program photographs were chosen as a pair, one per county. The
     frame they replaced on recertification (`recertBalconiesBw`) showed a
     derelict facade with broken glass and razor wire: a building with a
     problem, beside a recertification pitch. Neither replacement may ever be
     captioned with a county, a building name or a project. */
  services: {
    'building-recertification': photo.recertMiamiDade,
    'broward-bsip': photo.bsipBroward,
    'milestone-inspections': photo.inspectBalconyPair,
    'structural-condition-assessments': photo.inspectWall,
    'reinforced-concrete-design': photo.concreteFrameSlabs,
    'structural-analysis': photo.analysisTowersUp,
    'bim-coordination': photo.bimWireframeModel,
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
  /* The hero aside, the only clip left is the model in the new-buildings
     section. The recertification band and its aerial clip are gone: the two
     program sections under the hero are photographs, so a second video never
     starts downloading right behind the hero's. */
  clips: {
    bim: video.bimAssembly,
  } as Record<string, Clip>,
  gallery: [
    photo.houseModernLevels,
    photo.concreteVault,
    photo.housePalm,
    photo.rebarSlabCrew,
    photo.miamiSkylineTeal,
    photo.frameGolden,
    photo.midriseClean,
    photo.concreteSteppedGold,
    photo.rebarTyingHands,
    photo.houseDarkBrick,
    photo.miamiBeachDusk,
    photo.houseWhiteTree,
  ],
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   WHAT WE DESIGN — building typologies (photos illustrate the KIND, never a job)
   ═══════════════════════════════════════════════════════════════════════════
   Rendered on /services, after the two tracks. It left the home page when
   the county programs took its place; the home page keeps the headline, on
   `newBuildings`.
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
  lede: 'The same engineer and the same detailing standard, scaled to the building in front of us. If your project is not on this list, it is worth a conversation rather than an assumption.',
} as const;

export const typologies: Typology[] = [
  { n: '01', title: 'Single-family residences', lede: 'New houses engineered from the footing up — foundations sized to the soil report, a frame that carries hurricane wind, and drawings a local builder can price and build.', track: 'new', href: '/services/reinforced-concrete-design', photo: photo.houseConcreteGarden },
  { n: '02', title: 'Townhouses & duplexes', lede: 'Party walls, shared foundations and repeated bays — the structure resolved once and detailed so the repetition stays a saving instead of a risk.', track: 'new', href: '/services/structural-analysis', photo: photo.houseTownhouses },
  { n: '03', title: 'Mid-rise reinforced concrete', lede: 'Flat plates, shear-wall cores and cantilevered balconies — the system South Florida is built from, engineered as one continuous load path.', track: 'new', href: '/services/reinforced-concrete-design', photo: photo.frameCurvedBalconies },
  { n: '04', title: 'Mixed-use & commercial frames', lede: 'Long spans over ground-floor retail, transfer structure where the grid changes, and coordination with everyone whose services run through it.', track: 'new', href: '/services/bim-coordination', photo: photo.frameCraneClean },
  { n: '05', title: 'Foundations on difficult sites', lede: 'Tight lots, poor bearing, high water table and neighbors close enough to matter — the substructure engineered against the geotechnical report, not around it.', track: 'new', href: '/services/structural-analysis', photo: photo.foundationMatPit },
  { n: '06', title: 'Repairs to existing structures', lede: 'Balconies, facades, slabs and columns that have been in service for decades — condition documented, repairs engineered, and the paperwork the county asks for.', track: 'existing', href: '/existing-buildings', photo: photo.repairSoffitTrowel },
];

/* ═══════════════════════════════════════════════════════════════════════════
   NEW BUILDINGS (home) — the design side of the practice, in one section
   ═══════════════════════════════════════════════════════════════════════════
   The home page used to give new construction three sections: the "I am
   building something new" door, the six-photo typology grid and the BIM
   stage. Its first two sections are now the county programs, so this ONE
   paragraph carries what the door and the BIM section said — what gets
   designed, how it is coordinated, what is issued. The component lists the
   four `track: 'new'` services itself, beside the model clip.

   The headline is the owner-approved "What we design" line. The typology
   grid that also carries it now lives on /services, so the two never share
   a page. Owners and boards read the home page: no "federate", no "MEP", and
   no promise about what gets built.

   Gone with this change, in both languages: `pathsSection` / `paths` (the
   two doors), `recertBand` (one band that merged both counties' ages into a
   single sentence) and `bim` (replaced by this section).
   ═══════════════════════════════════════════════════════════════════════════ */

export const newBuildings = {
  eyebrow: 'New buildings',
  title: 'From a single house to a mid-rise concrete frame.',
  accentWord: 'mid-rise',
  body: 'Houses, townhouses, mid-rise concrete and commercial frames — foundations, frame and hurricane-wind design engineered as one structure and issued as a signed and sealed permit set. We build the structural model first and check it against the architect’s model and the mechanical, electrical and plumbing models, so conflicts are settled on screen before they can become a change order on site.',
  cta: { href: '/services#new', label: 'Services for New Projects' },
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   SOFTWARE — the band on the BIM service page
   ═══════════════════════════════════════════════════════════════════════════ */

export const software = {
  eyebrow: 'Software & open standards',
  title: 'The model has to survive the hand-off.',
  body: 'We work in the tools the rest of the project team already uses, and exchange through open formats so the model does not become a dead end when it leaves our office.',
  items: [
    { name: 'Revit', role: 'Structural modeling', logo: '/ttc/img/software/revit.svg' },
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
  lede: 'The sequence is the same whether you are answering a county notice or permitting a new frame. What changes is the depth of step three.',
  steps: [
    {
      n: '01',
      title: 'Initial consultation',
      youDo: 'Send the notice, or describe the building or the project, and share what you have — photos, drawings, prior reports.',
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
      /* No client portal exists, so no "progress you can see". */
      youGet: 'Inspection and findings for existing buildings; analysis, modeling and detailing for new ones — with questions raised as they come up, not saved for the end.',
    },
    {
      n: '04',
      title: 'Delivery',
      /* An action, so the "Your part" label above it reads true. */
      youDo: 'Review the report or the signed and sealed drawing set, and ask about anything that is unclear.',
      youGet: 'Documents written to be acted on: a board can read the findings, a contractor can build the details, a reviewer can follow the reasoning.',
    },
    {
      n: '05',
      title: 'Follow-up',
      youDo: 'Forward the reviewer’s comments, the contractor’s RFIs or the reinspection request.',
      /* Existing buildings end in reinspection and close-out, not in
         "submission": both counties have the report filed before the repairs. */
      youGet: 'Answers from the engineer who did the work — through permit comments, construction questions and, for existing buildings, reinspection and close-out.',
    },
  ],
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   WORK — real case studies (empty until supplied) + typical engagements
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
  /** 'firm' = Terdax Engineering project; 'prior' = experience elsewhere. */
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
  status: string;
};

/* Typical profiles, not jobs: every `location` is the service area, never a
   specific county, and every `status` carries the one Work label.

   02 names both county programs because its location is both counties:
   "recertification" alone is Miami-Dade's word. 03 is no longer called a
   "milestone" inspection — in both counties the milestone inspection is met
   through the county program, which is profile 02. */
export const engagements: Engagement[] = [
  { n: '01', title: 'Mid-rise residential frame', projectType: 'Residential — new construction', location: 'Miami-Dade or Broward', scope: 'Full structural design: gravity and lateral systems, foundations, detailing', structuralSystem: 'Reinforced concrete flat plate with shear-wall core', deliverables: 'Structural drawing set · Calculations · General notes', status: 'Typical engagement' },
  { n: '02', title: 'Condominium recertification or BSIP inspection', projectType: 'Existing building — county program', location: 'Miami-Dade or Broward', scope: 'Notice review, structural inspection, structural report on the official form, repair scope, reinspection', structuralSystem: 'Reinforced concrete frame with cantilevered balconies', deliverables: 'Structural report on the official form · Photographic record · Repair scope', status: 'Typical engagement' },
  { n: '03', title: 'Structural safety inspection', projectType: 'Existing building — safety inspection', location: 'Miami-Dade or Broward', scope: 'Visual structural inspection, concrete distress mapping, prioritized findings', structuralSystem: 'Reinforced concrete frame, post-tensioned slabs', deliverables: 'Inspection report · Distress mapping · Follow-up scope', status: 'Typical engagement' },
  { n: '04', title: 'Foundation system for a constrained site', projectType: 'New construction — foundations', location: 'Miami-Dade or Broward', scope: 'Foundation design based on the geotechnical report, settlement and uplift verification', structuralSystem: 'Mat foundation with grade beams; deep foundations at transfer zones', deliverables: 'Foundation drawings · Reactions schedule · Calculations', status: 'Typical engagement' },
  { n: '05', title: 'Multi-discipline BIM coordination', projectType: 'New construction — coordination', location: 'Miami-Dade or Broward', scope: 'Structural modeling, model federation, interference checking, issue tracking', structuralSystem: 'Reinforced concrete frame with long-span transfer beams', deliverables: 'Structural model · Clash & issue reports · Model-derived drawings', status: 'Typical engagement' },
  { n: '06', title: 'Independent structural peer review', projectType: 'Design review — third party', location: 'Miami-Dade or Broward', scope: 'Independent review of drawings and calculations, comment log, close-out tracking', structuralSystem: 'Reinforced concrete and structural steel, mixed system', deliverables: 'Review report · Prioritized comment log · Resolution record', status: 'Typical engagement' },
];

export const workSection = {
  eyebrowReal: 'Selected work',
  engagementsNote:
    'Typical engagement profiles, not specific past projects: the scope, structural system and deliverables of each kind of work the firm takes on. Named case studies are published only with client permission and are labeled as firm projects or prior professional experience.',
  galleryEyebrow: 'The material',
  galleryLede: 'Reinforced concrete, reinforcement, residences and the coastline they stand on — the vocabulary of the work, uncaptioned on purpose.',
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   CREDENTIALS — accountability, stated once (About only)
   ═══════════════════════════════════════════════════════════════════════════ */

export const credentials = {
  /* Only the sealing statement renders. The code-name grid that used to sit
     here was the "Codes & Standards" band Juan rejected — do not bring it back. */
  sealedDeliverables: true,
  sealingStatement:
    'Deliverables are signed and sealed by a Florida-licensed Professional Engineer, where the scope of work requires it.',
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   THE ENGINEER — the practice, not the person
   ═══════════════════════════════════════════════════════════════════════════
   DELIBERATELY UNNAMED (owner's decision, 2026-10-05): the site carries the
   brand and the licence, never the principal's name, portrait, degrees or
   previous employers. The promise — one licensed engineer is accountable for
   the whole project — survives without identifying anyone, so keep it that
   way. `portrait` and `license` stay null; the UI renders a finished
   composition without them. Only confirmed facts belong here.
   ═══════════════════════════════════════════════════════════════════════════ */

export const leadership = {
  name: 'Terdax Engineering',
  /** Used to sign the pull quote; the firm speaks, not a person. */
  firstName: 'Terdax Engineering',
  role: 'Principal Engineer',
  credential: 'Florida Professional Engineer',
  /** Path under /public, e.g. '/ttc/img/leadership/juan-tercero.jpg' — null until a real portrait exists. */
  portrait: null as { src: string; alt: string; w: number; h: number } | null,
  /** { number: 'PE 00000', url: 'https://www.myfloridalicense.com/…' } — null until confirmed. */
  license: null as { number: string; url: string } | null,
  linkedin: null as string | null,
  /** Home teaser: two sentences. */
  /** Home-teaser headline. Carries the promise without naming anyone. */
  teaserTitle: 'One engineer is responsible for the whole project.',
  /* No phone is published, so "first message", not "first call"; and the
     promise is the scope we deliver, not what gets built. */
  teaser:
    'Every project at Terdax Engineering is engineered, checked and signed by the same licensed engineer. You deal directly with the engineer doing the work from your first message, and the scope you approve in the proposal is the scope we deliver.',
  bio: [
    'Terdax Engineering is a structural practice registered to offer engineering services in Florida. One licensed Professional Engineer leads every engagement from the first conversation with an owner, board or architect through to the sealed drawing set or the submitted report — the same engineer throughout, not a relay of account managers.',
    'The practice covers both halves of structural work in South Florida: the design of new reinforced-concrete buildings, and the evaluation, recertification and repair of buildings already standing. Both are done with the same discipline — the reasoning behind every conclusion is written down, and nothing leaves the office that has not been checked line by line.',
  ],
  /** Empty on purpose: degrees identify the principal. The section hides. */
  education: [] as string[],
  focus: [
    'Miami-Dade recertification, Broward BSIP inspections and condition assessments',
    'Reinforced-concrete design for houses, mid-rise and commercial frames',
    'Structural BIM modeling and multi-discipline coordination',
    'Wind and lateral design for the High-Velocity Hurricane Zone',
  ],
  approach:
    'We would rather explain a structural decision in plain language than hide it behind a code reference. A board should be able to read a findings report and know what to do next; a contractor should be able to build from the drawing without calling; and a reviewer should be able to follow the calculation from load to detail.',
  forYou: [
    { k: 'Direct communication', v: 'You talk to the engineer who is doing the work — not to an account manager relaying questions.' },
    { k: 'A scope you can read', v: 'Every proposal states what is included, what is not, what you receive and what it costs, before anything starts.' },
    { k: 'One engineer’s judgment', v: 'Whoever inspects the building or sets the design basis is the same engineer who signs the report and answers the reviewer.' },
  ],
  /** Rendered as facts on the typographic plate while there is no portrait. */
  plate: [
    { k: 'Practice', v: 'Terdax Engineering' },
    { k: 'Licensure', v: 'Professional Engineer, Florida' },
    { k: 'Role', v: 'Principal Engineer' },
    { k: 'Region', v: 'Miami-Dade & Broward' },
  ],
} as const;

export const aboutPage = {
  eyebrow: 'About the practice',
  titleLines: ['A structural practice built', 'around one accountable engineer.'],
  accentWord: 'accountable',
  sub: 'Terdax Engineering designs new reinforced-concrete buildings and evaluates the ones already standing, across Miami-Dade and Broward — with the reasoning behind every conclusion written down and one Florida Professional Engineer responsible for all of it.',
  facts: [
    { k: 'Licensure', v: 'Florida Professional Engineer' },
    { k: 'Focus', v: 'Concrete · Existing buildings · BIM' },
    { k: 'Region', v: 'South Florida' },
  ],
  approach: {
    eyebrow: 'Approach',
    title: 'Reviewed line by line, before it leaves.',
    body: [
      'Two kinds of work run through this practice, and they inform each other. Designing new structures teaches you what fails in the field; inspecting buildings that have been standing for decades teaches you what to detail differently the next time.',
      'Our method is model-first. Structure is modeled, coordinated and documented as one connected source of truth, checked against the design basis, so that what goes to permit is complete and coordinated.',
      'On existing buildings the same discipline applies in reverse: the building is field-verified before it is analyzed, and nothing is concluded from a drawing that has not been confirmed on site.',
    ],
  },
  principles: {
    eyebrow: 'Principles',
    title: 'How we hold the line.',
    items: [
      { k: 'Rigor', v: 'Every member is analyzed and checked against the governing code before it reaches a drawing.' },
      { k: 'Constructability', v: 'Details that respect the field — buildable, sequenceable and clear to the contractor.' },
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
  titleLines: ['Organized by what you need,', 'not by what we do.'],
  accentWord: 'need',
  /* Existing buildings first — in the sub-line, the facts and the tracks —
     because the page now opens with them. The counts follow the `services`
     array (four and four); change them together. */
  sub: 'Eight services in two tracks. If you own or manage a building that is already standing, start with existing buildings. If you are building something, start with new projects. Each service says when you need it, what is included, what you receive and what to do next.',
  facts: [
    { k: 'Existing buildings', v: '4 services' },
    { k: 'New projects', v: '4 services' },
    { k: 'Coverage', v: 'Miami-Dade & Broward' },
  ],
  tracks: {
    existing: {
      id: 'existing',
      eyebrow: 'Existing buildings',
      title: 'You own or manage a building.',
      lede: 'For associations, property managers and owners with a county notice, a deadline, visible distress or a repair to scope. Miami-Dade and Broward each run their own program, and each has its own page here.',
    },
    new: {
      id: 'new',
      eyebrow: 'New projects',
      title: 'You are building something.',
      lede: 'For owners, developers, architects and contractors with a project in design or heading to permit.',
    },
  },
} as const;

export const existingPage = {
  eyebrow: 'Existing buildings',
  titleLines: ['The building is', 'already standing.'],
  accentWord: 'standing.',
  sub: 'Miami-Dade recertification, Broward’s Building Safety Inspection Program (BSIP), milestone inspections, structural assessments and repair design for buildings already in service. We document what is actually there, explain what it means structurally, and define the work that follows.',
  facts: [
    { k: 'For', v: 'Associations, owners, managers' },
    { k: 'Coverage', v: 'Miami-Dade & Broward' },
    { k: 'Output', v: 'Reports, repair scopes, reinspections' },
  ],
  triggers: {
    eyebrow: 'When to call',
    title: 'Four moments that need an engineer.',
    items: [
      { k: 'A notice arrived', v: 'A Notice of Required Inspection has come from your city or county — recertification in Miami-Dade, the BSIP in Broward — and the board needs a structural engineer engaged before the deadline.' },
      { k: 'Visible distress', v: 'Cracking, spalling, corrosion staining or movement has appeared and someone needs to say whether it affects capacity.' },
      { k: 'Before you spend', v: 'Repairs are being priced and the scope has not been defined by an engineer, so the bids are not comparable.' },
      { k: 'Before you buy', v: 'Structural due diligence on an acquisition, including alterations and change-of-use questions.' },
    ],
  },
  servicesEyebrow: 'Services for existing buildings',
  /* The one sequence both county programs share. It carries NO age and NO
     deadline: this lede used to state Miami-Dade's, Broward's and the
     state's in a single sentence, which is exactly how a number gets read
     against the wrong county. The numbers are on each county's page.

     Step order is the counties' own — report filed first, repairs under
     permit, a final report to close — and the six titles match the
     `process` of the two program pages. It used to end in "Submission",
     after the repairs.

     `cta` goes to Miami-Dade's page and `ctaSecondary` to Broward's: with
     one program per county, a single "in detail" link would leave one
     county without a door. */
  timeline: {
    eyebrow: 'Recertification & BSIP',
    title: 'A clear path from the notice to close-out.',
    lede: 'Miami-Dade calls it building recertification; Broward calls it the Building Safety Inspection Program. The ages and the deadlines are different, and each county’s are on its own page. The sequence is the same: the report is filed first, repairs follow under permit, and a final report closes the file. We run the structural side so the board knows what happens next at every stage.',
    cta: { href: '/services/building-recertification', label: 'Miami-Dade Recertification in Detail' },
    ctaSecondary: { href: '/services/broward-bsip', label: 'Broward BSIP in Detail' },
    steps: [
      { n: '01', title: 'Notice review', detail: 'We read the notice and the building record, confirm what the Building Official is asking for, and set the schedule against the date on the letter.' },
      { n: '02', title: 'Inspection', detail: 'Structural inspection on site — frame, slabs, balconies, roof and exposed foundations — documented in the field, with photographs tied to their locations.' },
      { n: '03', title: 'Report filed', detail: 'The structural report goes on the official form the county requires, in language a board can act on, and is filed even when it lists repairs.' },
      { n: '04', title: 'Repairs under permit', detail: 'Where repairs are required we define what must be corrected and to what standard, so the work can be bid fairly. Work that needs a permit waits for it.' },
      { n: '05', title: 'Reinspection', detail: 'Completed repairs are reinspected and documented against the original findings.' },
      { n: '06', title: 'Close-out', detail: 'An amended report — in Broward, with a signed and sealed completion letter — states that the repairs are complete. That closes the file until the next cycle.' },
    ],
  },
} as const;

export const workPage = {
  eyebrowReal: 'Selected work',
  /* One label for the profiles everywhere (hero, section, status): they are
     typical engagements, not past jobs, and nothing here says "anonymized". */
  titleLines: ['The frame behind', 'the project.'],
  accentWord: 'project.',
  subReal: 'Structural engagements across South Florida — the building, the problem, the scope, our role and the documented result.',
  subRepresentative:
    'Typical engagement profiles: the structural system, the scope and the documents each kind of work produces. They describe what the firm takes on, not specific past projects. Named case studies are published only with client permission.',
  facts: [
    { k: 'Coverage', v: 'Miami-Dade & Broward' },
    { k: 'Systems', v: 'Reinforced concrete, steel' },
  ],
} as const;

export const contactPage = {
  eyebrow: 'Request a proposal',
  titleLines: ['Tell us about the building.', 'We reply with a scope.'],
  accentWord: 'scope.',
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
  /**
   * One visible sentence of the main municipalities, under the county list.
   * Without it the only place names on the site were "Miami-Dade" and
   * "Broward"; a search for a city had no on-page text to match. Keep it to a
   * dozen names so it reads as information, not keyword stuffing.
   */
  cities:
    'Including Miami, Miami Beach, Coral Gables, Doral, Hialeah, Aventura, Sunny Isles Beach, Fort Lauderdale, Hollywood, Hallandale Beach, Pompano Beach and Coral Springs — and everywhere else in both counties.',
} as const;

/* Kept for local SEO (`areaServed`). Not rendered as a visible list; the
   visible sentence of main cities is `serviceArea.cities`. */
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
  /* Leads with the notice: it is the reader the page now opens for, and the
     one with a deadline. The order mirrors the site — notice, existing
     building, new project. */
  body: 'A county notice in your hand, a building that worries you or a new project — describe it and attach what you have. A phone photo of the letter is enough. You hear back from the engineer, with questions or with a written proposal.',
  primary: { href: '/contact', label: 'Request a Proposal' },
  secondary: { href: '/about#engineer', label: 'Meet the Engineer' },
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
      /* The site has no drawings, and every photo and video is licensed stock. */
      { h: 'Intellectual property', p: 'The text and the firm’s name and logo on this site belong to Terdax Engineering Inc. and may not be reproduced without permission. Photographs, video and third-party software marks belong to their respective owners (see Image Credits).' },
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
  newBuildings,
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
