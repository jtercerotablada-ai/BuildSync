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
 *     a headline, a lede, a meta description or an FAQ answer: an answer
 *     points at the row by its label instead. Every row names its authority
 *     and carries the one shared date, `regulatoryChecked`. Re-verify against
 *     the primary source before amending, then move that date.
 *   • Never on this site: fees, fine amounts, phase-in years, a computed due
 *     year, "40-year" as if it were a current trigger, or any promise about
 *     how a reviewing office will act.
 *   • "40-year" as the NAME owners still give both programs ("formerly",
 *     "still called") is the opposite case: it is what people type, so it is
 *     in the two program titles, descriptions and first lines on purpose.
 *   • The site does NOT say who signs which report — the owner's decision
 *     (October 6-7, 2026). Removed at his request, in this order: the
 *     sentence "we prepare the structural report; the electrical report is
 *     signed by a professional qualified in electrical design", the sealing
 *     statement on /about, and then the scope note itself ("<County>'s
 *     program asks for a structural report and an electrical report"), with
 *     its `scopeNote` field and callout. Do not write any of them back, do
 *     not write "both reports, one engineer", and never imply the firm signs
 *     threshold buildings (over three stories or 50 feet). That both programs
 *     cover structural and electrical is still said where the programs are
 *     described (the ledes, the timing rows and the questions), and since
 *     October 7 each program page states what its county asks for (`packet`
 *     and one question) — still without a word on who signs. For the same
 *     reason the home teaser and /about no longer say that one person
 *     "signs" every project: with the package complete, that sentence read
 *     as one engineer signing the electrical report too.
 *   • The site DOES say that one team delivers the COMPLETE package — the
 *     owner's decision (October 7, 2026). Asked whether the firm does only
 *     the structural part of a recertification, he answered "es completo que
 *     hacemos nosotros" and listed it: structural, electrical, parking lot
 *     illumination, thermography, parking lot guardrail. In a second
 *     message the same day he confirmed that Broward's Building Safety
 *     Inspection is delivered complete as well ("también building safety
 *     inspection completa"). Until that day every page said the firm's part
 *     was "the structural side" and "the structural report". Do not
 *     "correct" it back. What the package IS
 *     differs by county, and was read at the primary sources that day:
 *       – Miami-Dade: the structural report and the electrical report on the
 *         county's forms; an infrared thermography report attached to the
 *         electrical one, ONLY where the building's electrical service
 *         requires it (it is not a fifth certificate); the county's two
 *         parking-lot certifications, illumination and guardrails; a cover
 *         letter; photographs; and a site plan or survey where a property
 *         has more than one building.
 *       – Broward: a written report that includes the Board's structural
 *         form and its electrical form, with color photographs (Policy
 *         #05-05, III.E.1 and III.E.3). The policy also names "the
 *         Electrical Safety Inspection report": do not put a count of
 *         reports on a first screen or in a headline. The Board's current policy
 *         asks for no thermography and no parking-lot certificate, and
 *         guardrails and parking garages are items of the structural
 *         inspection. Never print Miami-Dade's certificates on a Broward
 *         page.
 *     Each program's page lays its own package out in `packet`. Where a page
 *     speaks of both counties at once it says "the complete package each
 *     county asks for", never one list for both. What the first rule above
 *     forbids is still forbidden: who prepares, signs or seals which part; a
 *     split of the work between the firm and Precision Source; a credential
 *     the site does not show (no "electrical engineer", no "certified
 *     thermographer"). And never: a number for a condition (amperes,
 *     foot-candles, a distance), "required for every building" where the
 *     source says "where applicable", or "complete" as a promise that a
 *     building will be recertified — a complete package is not a closed
 *     recertification, and each program page says so under "Good to know".
 */

import { ADS, ADS_COOKIE_DAYS } from './ads';
import { photo, video, type Photo, type Clip } from './media';

/* ═══════════════════════════════════════════════════════════════════════════
   COMPANY
   ═══════════════════════════════════════════════════════════════════════════ */

export const company = {
  /**
   * The firm is named "Tercero Tablada Civil and Structural Engineering Inc."
   * — that is the name, not a legal long-form of a shorter brand. `name` is
   * therefore the full name and is what belongs in metadata (og:site_name,
   * og:title), schema.org, alt text, the footer, the legal pages and any
   * sentence that names the practice.
   *
   * `shortName` exists ONLY for places where the full name genuinely cannot
   * fit (a drawing title block, a compact chip). Never reach for it just to
   * make a line shorter.
   *
   * Page titles (<title>) are the one such place on the site. A search
   * result shows about 580 px of a title and the full name alone is 469, so
   * with it every title was cut off before it said what the page is about.
   * A title carries `shortName`, and only where it still fits after the
   * page's own words — `pageTitle` in views/meta.tsx decides, seo.ts has
   * the rule.
   */
  legalName: 'Tercero Tablada Civil and Structural Engineering Inc.',
  name: 'Tercero Tablada Civil and Structural Engineering Inc.',
  shortName: 'Tercero Tablada',
  discipline: 'Civil and Structural Engineering',
  url: 'https://ttcivilstructural.com',
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
   *
   * The `*Xs` files are the header's own: the same masters resized to 144px
   * and stored as LOSSLESS WebP (scripts/encode-header-logos.mjs), for a slot
   * 32–54px tall. The partner block and the engineer plate draw the mark
   * larger and keep the `*Sm` PNGs.
   */
  logo: {
    lockupDark: '/ttc/img/logo-horizontal.png',
    lockupLight: '/ttc/img/logo-white-wide.png',
    lockupSize: { w: 2172, h: 827 },
    dark: '/ttc/img/logo-square.png',
    light: '/ttc/img/logo-white.png',
    markSize: { w: 1254, h: 1254 },
    markDarkSm: '/ttc/img/logo-square@256.png',
    markLightSm: '/ttc/img/logo-white@256.png',
    lockupLightSm: '/ttc/img/logo-white-wide@640.png',
    markSmSize: { w: 256, h: 256 },
    lockupSmSize: { w: 640, h: 244 },
    markDarkXs: '/ttc/img/logo-square@144.webp',
    markLightXs: '/ttc/img/logo-white@144.webp',
    markXsSize: { w: 144, h: 144 },
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
  registry: 'FL Engineering Business No. 40285' as string | null,
} as const;

/**
 * The absolute address of a page of the public site, from its path ('/',
 * '/es', '/services/broward-bsip'): the one string its canonical, its
 * hreflang links, its og:url and the sitemap all print.
 *
 * For the English home page that is the origin WITH its slash,
 * `https://ttcivilstructural.com/` — the address a browser and a crawler
 * actually request. The bare origin (`company.url`) is the same page, but an
 * on-page check reads it as a second address that redirects to the first, so
 * it is a base to build on and never an address to declare.
 */
export const absoluteUrl = (path: string) => `${company.url}${path}`;

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
  /** The owner's own line, supplied by him on October 6, 2026. `href` is
   *  E.164 so the link dials from any country; `display` is the US form. */
  phone: { display: '(772) 265-8506', href: 'tel:+17722658506' } as
    | { display: string; href: string }
    | null,
  /** WhatsApp on the same line. The owner confirmed on October 6, 2026 that
   *  people may send the photo of their notice there. `null` hides every
   *  WhatsApp link on the site.
   *
   *  The address WhatsApp itself serves, not the short `wa.me/<number>`:
   *  that one only answers with a redirect to this one, so every page linked
   *  to a redirect. `whatsappHref` (ReachRow.tsx) appends the first line of
   *  the message as `&text=`, which is why this already ends in a query. */
  whatsapp: { href: 'https://api.whatsapp.com/send?phone=17722658506' } as
    | { href: string }
    | null,
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
  /** Shown near the form. The reply time is the owner's own figure (October
   *  6, 2026: "immediate, more or less one or two hours later"), printed as
   *  what is USUAL, never as a guarantee — a message sent at midnight is
   *  answered in the morning. Do not sharpen "usually" into a promise. */
  responseNote:
    'Every inquiry is read and answered by the engineer, not by a call center — usually within two hours.',
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `inHeader: false` keeps a page out of the header bar and the phone menu —
 * SiteHeader filters on it — WITHOUT taking it out of `primaryNav`.
 */
export type NavItem = { href: string; label: string; description?: string; inHeader?: boolean };

/* This list is read elsewhere: each view takes its breadcrumb label from its
   own entry, by address (`navLabelOf` in content.ts), and the proxy derives
   its public routes from the hrefs. The ORDER is the header's order.
   Removing an entry leaves its page with no label to read — hide it with
   `inHeader` instead.

   /resources is the calculators catalogue (calculators.ts). The owner asked
   for it in the header on October 9, 2026, the day it was made.

   /projects is hidden that way. It holds typical engagement profiles, not
   past jobs, and says so; as "Work", third in the main menu, it sent every
   curious visitor to a page explaining there was nothing to show. It is now
   named for what it is, stays linked from the footer and from the
   typologies note on the Services page, and stays in the sitemap. When
   `caseStudies` has real entries it can be "Work" again and go back in the
   header (site.test.ts holds the two together). */
export const primaryNav: NavItem[] = [
  { href: '/services', label: 'Services' },
  { href: '/existing-buildings', label: 'Existing Buildings' },
  { href: '/projects', label: 'Typical Engagements', inHeader: false },
  { href: '/resources', label: 'Resources' },
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
      { href: '/projects', label: 'Typical Engagements' },
      { href: '/resources', label: 'Resources' },
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
    /* Each language by its own name, the same in both files: the switch
       shows the OTHER one, so an English page says "Español". It used to say
       "ES", which a reader has to know is a language. */
    en: 'English',
    es: 'Español',
    /** Visually hidden note on the inert switch of an English-only page (/credits). */
    unavailable: 'Spanish version not available',
    /* There is no pop-up line offering Spanish. One was shipped on October
       7, 2026 ("¿Prefiere leer esto en español?", for browsers set to
       Spanish) and removed the same day: the owner did not like it. The word
       "Español" in the header is the way in. */
  },
  breadcrumb: 'Breadcrumb',
  /** Accessible name of the jump links under a county program's hero on a
      phone (JumpLinks). The links themselves reuse the section labels below,
      so a link and the section it lands on always say the same thing. */
  onThisPage: 'On this page',
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
  /** The questions block of a service page (`Service.faq`): its label, and
      the h2 of a service that sets no `headings.faq`. */
  faqLabel: 'Questions & answers',
  faqTitle: 'Questions owners and boards ask',
  /** Heading of `timing.duties`, beside a county program's timing table. The
      FAQ answers point at the list by this name. */
  boardDuties: 'What the board must do',
  /** Milestone page: label of the section that sends each county's reader
      to that county's page (`Service.countyPages`, `Service.comparison`). */
  inBothCounties: 'In Miami-Dade & Broward',
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
  /** Label of the "Who sent your notice?" section of a county program
      (`Service.offices`). The section's h2 is the service's own. */
  yourCity: 'Your city',
  /* Opens the line under the home page's two county buttons. The rest of
     that line is cut in code from the program's own `ctaNote`, so this is
     the one sentence of it the home page writes for itself. */
  photoTheLetter: 'Photograph the letter with your phone and send it.',
  /** In front of `offices.checked`, under the list of offices: the day each
      name was last read on its city's own page. The rows stopped being links
      (see `Service.offices`), so the line stopped saying "Links". Not "Last
      verified": that one is about the rules, this one about the names. The
      key keeps its old name. */
  linksChecked: 'Office names last checked',
  footer: {
    services: 'Services',
    contact: 'Contact',
    navigate: 'Navigate',
    linkedin: 'LinkedIn',
    imageCredits: 'Image Credits',
  },
  engineer: {
    eyebrow: 'Meet the engineer',
    /** Home teaser label. The teaser keeps this label and its own headline;
        the engineer's name is on its plate (see EngineerSection). */
    eyebrowTeaser: 'Who is responsible',
    role: 'Principal Engineer',
    credential: 'Florida Professional Engineer',
    license: 'Florida P.E. license',
    verify: 'Verify with the Florida DBPR',
    /**
     * What to do on the page that link opens. The registry has no stable
     * per-license URL (see `leadership.license`), so every link lands on a
     * search form with four modes and no hint. Printed under the link on
     * About, and under the license cards of the partner block.
     */
    verifyHow: 'On the DBPR page, choose “Search by License Number” and type the number.',
    /**
     * The credential block on the two county-program pages
     * (EngineerCredential): "<label> — <name> · <licensePrefix> <P.E. number>
     * · <verify>", then the business registry line. Every fact in it is read
     * from `leadership` and `company`; these two strings only frame them.
     * "Engineer", never "signed by": which report the firm signs is said by
     * the scope note on the same page, and nowhere else.
     */
    label: 'Engineer',
    licensePrefix: 'Florida',
    education: 'Education',
    focus: 'Practice focus',
    approach: 'How I work',
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
      'Work performed at other firms before the practice was founded. Listed for experience only — not projects of Tercero Tablada Civil and Structural Engineering Inc.',
  },
  form: {
    heading: 'Request a proposal',
    /* "Tell us about…", as the H1 over it does ("Tell us about the
       building."): every word of an H1 has to be a word of its page
       (seo.test.ts), and "about" was nowhere under this one. */
    intro:
      'Tell us about what you own, what you are planning or what you received. The more specific the description, the more precise the proposal.',
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
    successBody: 'Your request is in the engineer’s inbox. We usually reply within two hours.',
    successConfirmed: 'A confirmation has been sent to your email address.',
    successRef: 'Reference',
    whatNext: 'What happens next',
    nextSteps: [
      'The engineer reads your description and any files you attached.',
      'You receive a reply by email with questions, or with a proposal that states the scope, the deliverables and the fee.',
      'Work starts once the scope is agreed in writing — nothing is assumed on your behalf.',
    ],
    directEmail: 'Prefer email? Write to',
    /* The two county programs (a service that carries `program`). Every
       button that opens the form with one of them selected says "a phone
       photo of the letter is enough", so the form has to agree: the photo
       comes first, the building is a building and not a "project", and the
       description stops being required once a file has uploaded (the rule is
       descriptionRequired in contact-request.ts; the route applies it too).
       Nothing else is asked: the letter carries its date, the folio and the
       address, and the engineer reads the rest on the county's property
       records — the fewer boxes, the more owners finish the form. So the
       description is "Comments". Design services keep the labels above.
       No age, day count or deadline here — those live in each county's
       timing row and nowhere else. */
    program: {
      attachments: 'Photo of the notice (photo or PDF)',
      attachmentsHint:
        'A phone photo of the letter is enough; a PDF works too. Up to five files, 25 MB each.',
      location: 'Building address',
      locationPlaceholder: 'Street address and city',
      message: 'Comments',
      messagePlaceholder:
        'Anything you want us to know. No notice yet? Tell us how old the building is.',
    },
    errors: {
      name: 'Please enter your name',
      email: 'Please enter an email address',
      emailFormat: 'Check the email address',
      service: 'Select the service you need',
      location: 'Tell us where the project or building is',
      /* States the rule the form enforces (12+ characters), WCAG 3.3.3. */
      message: 'Tell us a little more about the project — at least a sentence (12+ characters)',
      /* A county program with nothing attached yet. Names both ways out, in
         the order the buttons promise them. */
      messageOrNotice: 'Attach the notice, or tell us about the building in at least a sentence (12+ characters)',
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
  /* Rendered as note + link + end. There are no case studies yet, so the
     note points at what IS there (the typical engagements), not at
     "published case studies" that do not exist. The link is the page's name
     — the same words as its nav label — so the sentence leads up to it
     without saying "typical engagements" twice. */
  typologiesNote:
    'Photographs illustrate the kind of structure described; none shows a project by Tercero Tablada Civil and Structural Engineering Inc. What the firm takes on is described under',
  typologiesNoteLink: 'Typical Engagements',
  typologiesNoteEnd: '.',
  galleryNote:
    'Licensed architectural photography, shown as material rather than as a portfolio. No image on this page depicts a project by Tercero Tablada Civil and Structural Engineering Inc.',
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
  /* The headline is the owner-approved one and did not change. The sub-line
     names the two county programs first, by the names printed on the letters
     people receive, and carries NO regulatory number: every age and deadline
     lives in a timing row that names its authority and its date.

     The two buttons changed on 2026-10-06, with the owner's approval. The
     visitor this page is for is holding a county notice with a deadline, so
     each button names one notice and opens the form with that program
     already selected. "Request a Proposal" is still one tap away in the
     header, and Services stays in the menu and in the strip below. */
  sub: 'Miami-Dade building recertification, Broward’s Building Safety Inspection Program (BSIP) and structural design for new buildings — led by a Florida Professional Engineer who stays on your project from the first conversation to the final report.',
  primary: { href: '/contact?service=building-recertification', label: 'I Have a Miami-Dade Notice' },
  secondary: { href: '/contact?service=broward-bsip', label: 'I Have a Broward Notice' },
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

/**
 * The same day as a machine reads it: the `datetime` of the <time> element
 * around every "Last verified", and the `lastReviewed` of each regulated
 * page's WebPage markup. A date has no language, so this one lives here
 * only. Move it WITH the two written dates; site.test.ts fails if the three
 * do not name the same day.
 */
export const regulatoryCheckedISO = '2026-10-04';

/**
 * The day the offices under "Who sent your notice?" (`Service.offices`) were
 * last read on their cities' own pages, one by one, and the links that leave
 * the site — the `sourceUrl` of every timing row, the two `forms` pages —
 * were last opened. A different check from `regulatoryChecked`, so a
 * different date: this one says each office is still called what the page
 * prints and each LINK still lands on the right official page, not that a
 * rule was re-read. The page prints it under the list of offices ("Office
 * names last checked").
 *
 * The cities' pages are no longer linked, and their addresses are no longer
 * in this file: they are in `office-pages.ts`, a record that no page reads,
 * with the reason. City websites move pages without redirecting them (two
 * of the addresses search engines still list for these pages returned "page
 * not found" on the day of the check), and several refuse scripts, so a
 * status code proves nothing: open each one in a browser. Do it whenever
 * `regulatoryChecked` moves, then move this date. `site.es.ts` carries it
 * in Spanish.
 */
export const officeLinksChecked = 'October 7, 2026';
export const officeLinksCheckedISO = '2026-10-07';

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
   * The service's card on /services, in words of its own: one line each for
   * "When you need it", "What you receive" and "Next step". The card used
   * to print `when[0]`, `deliverables[0]` and `nextStep` — the very
   * sentences the service's own page prints — so every service was said
   * twice, once on the index and once on its page, and the on-page check
   * listed each of them as a text block on several pages.
   *
   * A card line is a SHORTER telling of what the page says in full, never a
   * new fact: `when` gathers the page's three situations into one line,
   * `receive` the documents of `deliverables`, `next` what to send first
   * (the page's `nextStep` then says what happens with it). No age, no day
   * count, nothing about who signs. `summary` and `capabilities` are the
   * card's other two lines and are printed nowhere else.
   */
  card: { when: string; receive: string; next: string };
  /**
   * The line under the H1 of the service's own page, where it has to say
   * something `summary` does not (cards, list rows and the schema keep
   * `summary`). The two county programs open with the name owners still
   * search for — "the 40-year recertification" — as a NAME, never as a
   * trigger, and with no number.
   *
   * All eight services set one, so a card and the page it opens never print
   * the same sentence. A service without it falls back to `summary`, and is
   * then one text block on two pages again.
   */
  heroSub?: string;
  /**
   * Headings of the service's own page, in the words people search with.
   * Every key is optional and falls back to the shared label in `ui`
   * (ServiceDetailView), so the other services keep "What's included",
   * "When it applies"… and only a page that has something more exact to say
   * says it. `h1` falls back to `title`, which stays the name on cards, in
   * the nav and in the schema.
   *
   * Whatever is set here is the VISIBLE h2 — never a search phrase in a
   * hidden heading beside a different visible label. No age and no day
   * count in any of them (site.test.ts checks the regulated pages).
   */
  headings?: {
    h1?: string;
    whatsIncluded?: string;
    whenItApplies?: string;
    howItRuns?: string;
    faq?: string;
    considerations?: string;
  };
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
   * Questions a board asks, each with a two- or three-sentence answer:
   * rendered above the process steps as an h2 with one h3 per question, and
   * emitted as FAQPage markup from this same array, so the markup cannot
   * drift from the page. Only the two county programs carry one today.
   *
   * An answer NEVER types an age, a day count or a deadline. It points at
   * the timing row printed just above it, by the row's label in curly quotes
   * (“Time to file”); site.test.ts fails if a quoted label is not one of the
   * row's, or if a number slips in.
   */
  faq?: { q: string; a: string }[];
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
   * `sourceUrl` turns that name into a link, so a reader can check the row
   * in one tap: the authority's own page, or the publisher the authority
   * itself links to — never a third party's copy. Optional on purpose: a
   * source that cannot be opened today prints as plain text, and a guessed
   * address is worse than none. The same URL in both languages
   * (site.test.ts), re-opened with `officeLinksChecked`. County, State and
   * code-publisher pages only: a city's or a town's website is never linked
   * (see `offices`), and pages.test.ts lists the hosts the site may link.
   *
   * On the two county programs, `rows[0]` is ALSO what the home page reads
   * (ProgramSection): the rows flagged `home`, the same labels in the same
   * order on both, so the two counties compare line by line. Do not restate a number from a
   * row anywhere else in the service — point at the row instead.
   *
   * `home: true` marks the facts the home page's section prints, and it
   * prints them SHORT: the label and the first sentence of the value, cut
   * in code like the hero's. The home page is the summary and this page is
   * the reference; the six rows printed whole on both were the same
   * paragraphs on two pages. So a flagged value must also OPEN with a
   * sentence that is true by itself. Both programs flag the same labels,
   * and so does the Spanish row (programs.test.ts).
   *
   * `homeWhole: true` is the exception: the home page prints that value
   * WHOLE. It is for a row whose hedges may not be cut — Broward's filing
   * deadline, where the superseded 90 days is still on city websites and
   * the city's letter rules. Cut to its first sentence the home page said
   * "180 days" twice and nowhere that the letter governs.
   *
   * `filing: true` marks the ONE fact that is the filing deadline. The
   * service page's hero prints that fact — its label and the FIRST SENTENCE
   * of its value — so the first screen answers "by when?" without the
   * number being typed a second time. Only the two county programs flag
   * one, and the Spanish row flags the same one (site.test.ts checks both).
   *
   * So that value must OPEN with the deadline, as one whole sentence that
   * is true by itself, and carry what qualifies it in the sentences after:
   * the hero cuts at the first full stop (`firstSentence`, mp/text.tsx).
   * The whole value, hedges included, is printed once, in the row.
   */
  timing?: {
    checked: string;
    note: string;
    /**
     * What state law asks of a condominium or cooperative BOARD, as a short
     * list under `note` ("What the board must do"). It used to be the second
     * half of the note: one sentence of about a hundred words that no one
     * could act on. Its day counts are the statute's and stay in this block,
     * next to `checked`.
     */
    duties?: string[];
    rows: {
      jurisdiction: string;
      source: string;
      sourceUrl?: string;
      facts: { k: string; v: string; filing?: boolean; home?: boolean; homeWhole?: boolean }[];
    }[];
  };
  /**
   * "Who sent your notice?" — the two county programs only. The notice has
   * a city's name on it, and these two pages named no city at all: one row
   * per city, with the building office as that city's own page names it.
   *
   * A ROW NEVER LINKS OUT, and it carries no address. Each row used to
   * open its city's page. City and town websites answer crawlers unevenly —
   * 403 to one, no answer to the next — and the on-page check the owner
   * runs counted six of these links as broken on one crawl and thirteen on
   * the next, while every one of them opened in a browser. Which ones fail
   * depends on where the crawler connects from, so it can be neither
   * reproduced nor fixed from here. Decided on October 7, 2026: the names
   * stay, the links to city and town websites go. Do not link a city's
   * website again, and do not put its address back in this file — the content bundle
   * travels to the browser with every page that hands a service to a client
   * component. The addresses each name was read from are a record, in
   * `office-pages.ts`, which no page imports.
   *
   * Since October 9, 2026 a city may have a page of its own on THIS site
   * (`cities.ts`: /services/<program>/<city>). Where it does, the view
   * links the city's NAME in its row to that page — an internal link, joined
   * by the row's `city`, so nothing changes in this file and a row still
   * carries no address. How that office runs the program is on that page,
   * with where each line was read; a row stays the city and its office.
   *
   * What a row may and may not say:
   *   • The city and its office, nothing else. No fee, no deadline, no day
   *     count, no portal: a city's own numbers are the city's to state.
   *   • Nothing here says the firm has filed in a city. It is a list of
   *     offices, not of places worked.
   *   • The office is named as the city's OWN page names it (.gov or the
   *     city's domain; `office-pages.ts` says which page). Never guess one.
   *   • Office names stay in English in both languages: they are the
   *     offices' own names. The Spanish lede says so.
   *
   * `forms` is the ONE link of the block: the county-level authority's own
   * page, where a reader can see the document the report goes on. `checked`
   * is always `officeLinksChecked`.
   */
  offices?: {
    /** The section's h2. */
    title: string;
    /** One short paragraph. Promises no link: not every row has one. */
    lede: string;
    rows: { city: string; office: string }[];
    /** Under the list: what to do when the city is not on it. */
    note: string;
    forms: { text: string; label: string; url: string };
    checked: string;
  };
  /**
   * Other names people use for the service, for the Service markup's
   * `alternateName` only (never printed). On the two county programs that
   * includes "40-year": as a NAME, which is what an alias is.
   */
  alsoCalled?: string[];
  /**
   * The service-hero "Coverage" fact, e.g. 'Miami-Dade County, Florida'.
   * Only the two county programs set it; every other service falls back to
   * `contact.serviceAreaLabel` (both counties). In Spanish the other six
   * set a shorter form of that label — see `coverage` in site.es.ts.
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
   * The milestone page only. One heading per county that IS the link to that
   * county's page, with the sentence that says how the state inspection is
   * met there. This was a plain-text note that told the reader the deadline
   * "is on that county's page" and gave nothing to tap.
   */
  countyPages?: { slug: string; title: string; text: string }[];
  /**
   * The milestone page only: the four things a condominium board hears about
   * — the two county programs, the state milestone inspection and the
   * reserve study — answered under the same four labels. Text, not a
   * drawing, and NO age or deadline: those stay in each program's own row.
   * Every row has one value per label, in the labels' order.
   *
   * The reserve study (SIRS) is described here as what the law says it is.
   * Whether the firm prepares one is the owner's to state, and until he does
   * this site does not say.
   */
  comparison?: {
    title: string;
    labels: string[];
    rows: { name: string; values: string[] }[];
    /** The authorities, printed under the cards with `timing.checked`. */
    source: string;
  };
  /**
   * The home-page section of a county program. ONLY `building-recertification`
   * and `broward-bsip` carry one. The section's numbers are NOT here: it
   * reads `timing.rows[0]` (the facts flagged `home`) and `timing.checked`.
   * The one number a `program` holds is the filing deadline in its headline,
   * which must always equal the row's "Time to file".
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
    /** Solid button → /contact?service=<slug>. */
    cta: string;
    /**
     * One line under the button: what to send, with or without a notice.
     * TWO sentences, in that order. The program's page prints the line whole
     * under its hero button; the home section prints the second sentence
     * only (`afterFirstSentence`), so the line is not one paragraph on two
     * pages.
     */
    ctaNote: string;
    /**
     * Text link under the home section's rows → the whole table on the
     * program's page (/services/<slug>#when-it-applies). Names the county
     * and says what is there; no number.
     */
    timingLink: string;
    /** Text link → /services/<slug>. */
    detail: string;
  };
  /**
   * THE COMPLETE PACKAGE, PART BY PART — the two county programs only.
   * The one place on a program's page that lays out everything that county
   * asks for with the filing, and that the team delivers: one row per part,
   * its name and ONE plain sentence on what it is and when it applies.
   * Rendered under the two columns of "Scope & deliverables", right after
   * "What you receive" (ServiceDetailView): a definition list, and its
   * `label` a <p>. NOT headings — the page stands at its ceiling of 23
   * (pages.test.ts), and a part of a packet is not a section of the page.
   *
   * What a row may and may not say (the owner's decision of October 7, 2026
   * and the sources read that day; the header of this file has both):
   *   • Only parts verified for THIS county. Miami-Dade's parking-lot
   *     certificates and its thermography rule are never printed on the
   *     Broward page (complete-package.test.ts).
   *   • A conditional part states its condition in words — "where the
   *     building's electrical service requires it", "where it applies" —
   *     and never as a number: no amperes, no foot-candles, no distance.
   *   • What a certificate RECORDS, never that a building passes: the
   *     illumination form says the levels meet the standard or do not, and
   *     the guardrail form says whether the lot is beside water at all.
   *   • Nothing about who prepares, signs or seals a part, and no split
   *     between the firm and Precision Source: "our team", "one team".
   *   • `note` says what is true of the whole list and of no single row.
   * The two programs share no row (programs.test.ts), and the Spanish
   * mirror has the same rows in the same order.
   */
  packet?: {
    label: string;
    lede: string;
    parts: { k: string; v: string }[];
    note: string;
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
      'One team for the complete Miami-Dade recertification, from the notice to the amended report that closes it — the structural report, the electrical report and the certificates the county asks for with them.',
    card: {
      when: 'The notice has arrived, a courtesy notice says it is coming, or an earlier recertification is still open.',
      receive: 'Every report and certificate Miami-Dade asks for — structural, electrical and, where they apply, thermography and the parking-lot certificates — plus the repair scope where one is needed.',
      next: 'Start with the notice — a photo from your phone will do — or, if there is none yet, with the address and the year built.',
    },
    /* The first words under the H1 are the name most owners still use, so a
       visitor who searched "40-year recertification" knows this is the page.
       A name, never a trigger, and no number. Then what the owner asked
       the first screen to say (October 7, 2026): one team delivers it
       COMPLETE, and what that is in three words.

       MEASURE BEFORE LENGTHENING IT. The line sits between the H1 and the
       button, and every line of it pushes that button down a phone's first
       screen. It used to end "Send us the notice from your city or the
       county."; that sentence went, because the button right under it says
       "Send the Miami-Dade Notice" and with it the line ran six lines at
       390px where the old one ran three. As written it is four lines at
       360 and 390px (one more than before, 29px) and the same four as
       before at 320px. */
    heroSub:
      'Still called the 40-year recertification. One team delivers it complete: structural, electrical and the county’s certificates.',
    /* The page's own h2s, in the words a board searches with ("who has to
       recertify in Miami-Dade"). The ages and the day counts they lead to
       are in the row, never in the heading. */
    headings: {
      /* "…includes in Miami-Dade", the county last: with "Miami-Dade" in
         the middle the balanced heading broke inside the name, at its
         hyphen ("Miami-" / "Dade"). */
      whatsIncluded: 'What a complete recertification includes in Miami-Dade',
      whenItApplies: 'Who has to recertify in Miami-Dade, and when',
      howItRuns: 'How a recertification runs, step by step',
      faq: 'Questions boards ask about Miami-Dade recertification',
      considerations: 'Recertification reports, the county’s forms and the limits of an inspection.',
    },
    problemTitle: 'A notice arrives with a deadline.',
    /* Opens by saying what a recertification IS — the page assumed the
       reader knew (the Broward page always had this sentence). And "a
       structural engineer", once: it is the trade a board searches for, and
       the body of the page never said it. The last sentence used to end
       "…can carry the structural side of it": since October 7, 2026 it
       says the team delivers the whole of it (the header has the decision). */
    problem:
      'Building recertification is Miami-Dade County’s periodic safety inspection of older buildings, structural and electrical, reported in writing to your Building Official. The Notice of Required Inspection comes with forms and very little explanation of what actually has to happen. Boards and owners need a structural engineer whose team knows the county’s sequence and delivers the whole of it — the structural report, the electrical report and the certificates that go with them — from the first site visit to the report that closes the recertification.',
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
    capabilities: ['Notice review', 'Structural & electrical inspection', 'Thermography, where required', 'Parking-lot certificates', 'Reports on the county’s forms', 'Repair scope', 'Reinspection'],
    /* Scope = work the engineer does; deliverables = documents the client
       keeps. Four of six scope lines used to restate a deliverable. */
    /* Three of these lines were word for word the Broward page's. Each page
       now says them in its own program's terms — who sends the notice, which
       report, the words of its own process step — with the same meaning and
       nothing added (programs.test.ts: the two programs share no line). */
    scope: [
      'Review of the notice from your city or the county, the building’s records and prior reports',
      'Structural inspection on site — frame, slabs, balconies, facade, roof and foundations',
      'Electrical inspection on site — the service, the meter and electric rooms, panels, wiring and grounding, emergency lighting, exit signs and the fire alarm',
      'Infrared thermography of the electrical equipment, where the building’s electrical service requires it',
      'Light levels measured in the parking lot that serves the building, and the lot inspected for the county’s guardrail certification',
      'Classification of observed conditions by structural significance, for the recertification report',
      'Repair scope that states what has to be corrected, so contractors bid the same work',
      'Reinspection of completed repairs',
      'Answers to the reviewing office’s questions on the reports',
    ],
    /* The county's order, not the order the site used to publish: file the
       report first (even if it lists repairs), repair under permit, close
       with an amended report. Same six labels as the Broward page. */
    process: [
      { step: 'Notice review', detail: 'We read the notice and the building’s history, and confirm what the Building Official is asking for and by when.' },
      { step: 'Inspection', detail: 'Structural and electrical inspection on site — the frame, slabs, balconies, facade, roof and exposed foundations, and the building’s electrical systems — documented with photographs tied to their locations. Thermography and the parking-lot measurements are done where they apply.' },
      { step: 'Report filed', detail: 'The structural and electrical reports go on the county’s own forms, signed and sealed, with the certificates and attachments your building needs, and are filed even when they list repairs. The county asks for the reports first, not after the work.' },
      { step: 'Repairs under permit', detail: 'Where repairs are needed, we define what has to be corrected so contractors bid the same work. Repairs that need a permit wait for it, then follow its schedule.' },
      { step: 'Reinspection', detail: 'Completed repairs are reinspected and documented against the original findings.' },
      { step: 'Close-out', detail: 'An amended report states that the repairs are complete. That is what closes the recertification, until the next cycle.' },
    ],
    /* The first line is the whole package, named once; its parts, each with
       what it is and when it applies, are `packet`, printed right under
       this list. The photographs are one of those parts. */
    deliverables: [
      'The complete recertification package for your building: the structural and electrical reports on the county’s own forms, each signed and sealed, with the certificates and attachments set out below',
      'Written repair scope, where the reports list repairs',
      'Letter on whether the building can remain occupied during repairs, where required',
      'Amended report after repairs',
    ],
    nextStep:
      'Send the notice — a phone photo is enough — or the address and the year built. We confirm what your Building Official is asking for and reply with a proposal for the complete recertification: every report and certificate your building needs.',
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
         block's row source is the county's.

         The duties themselves are `duties` below: the same words, as three
         lines a board can tick off, instead of one 95-word sentence.

         They are the STATE's duties and the same in both counties, and they
         were the same three sentences on both pages. What differs now is
         only the name each page already gives the two documents the statute
         counts from: "the written notice from the local enforcement agency"
         (553.899(5)) is, here, the notice from your city or the county; and
         "the applicable inspection report" (553.899(9)) is the
         recertification report, which the sentence above says serves as the
         milestone inspection. The days, the acts and their order are the
         statute's and must not be reworded. */
      note: 'The notice comes from the Building Official of your city, or from the county in unincorporated areas, and the report is filed with that same office. For condominium and cooperative buildings of three habitable stories or more, the recertification report serves as the state milestone inspection, and the board’s duties to unit owners under state law (Florida Statute 553.899) remain.',
      duties: [
        'Within 14 days of receiving the notice from your city or the county, tell unit owners about the required inspection and the date it must be completed.',
        'Within 45 days of receiving the recertification report, send every owner the engineer’s summary and post it in a conspicuous place on the property.',
        'In those same 45 days, publish the recertification report and the summary on the association’s website, where the association is required to have one.',
      ],
      rows: [
        {
          jurisdiction: 'Miami-Dade County',
          source: 'Code of Miami-Dade County, Section 8-11(f)',
          /* The county code on Municode, where the county's own pages send
             readers for it. Opened 2026-10-07: "Sec. 8-11. - Existing
             buildings." */
          sourceUrl:
            'https://library.municode.com/fl/miami_-_dade_county/codes/code_of_ordinances?nodeId=PTIIICOOR_CH8BUCO_ARTIAD_S8-11EXBU',
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
            { k: 'First due', v: 'At 30 years — 25 for condominium and cooperative buildings of three or more stories within 3 miles of the coast. Age is counted from the year built on the Property Appraiser’s record.', home: true },
            { k: 'Then', v: 'Every 10 years, for the life of the structure.', home: true },
            { k: 'Time to file', v: '90 days from the Notice of Required Inspection. Courtesy notices should arrive two years and one year ahead; not receiving them does not move the deadline.', filing: true, home: true },
            { k: 'If repairs are needed', v: '150 days from the Notice to finish repairs that need no permit and to obtain permits for the rest. Permitted work then follows its permit, and an amended report closes the recertification.', home: true },
            { k: 'Condominiums & co-ops', v: 'The recertification serves as compliance with the state milestone inspection — no separate milestone report is filed.', home: true },
          ],
        },
      ],
    },
    /* QUESTIONS BOARDS ASK. Most of these answers are the caveats that sat
       under "Good to know" as statements: the same verified sentences, now
       under the question an owner actually types, and above the six steps
       instead of seven phone screens down. What moved here is no longer in
       `considerations`, so nothing is said twice.

       Every answer keeps the site's rules:
         • No age, day count or deadline is typed here. An answer points at
           the row of the table printed just above it, by the row's label in
           curly quotes; site.test.ts checks each quoted label exists.
         • "40-year" only as the name people still use.
         • A missed deadline: the mechanism the COUNTY publishes, attributed
           to it, with no amounts — cities set their own — and no promise
           about what an office will do.
         • An older building never recertified: the county's phase-in years
           and its catch-up date are NOT printed (phase-in years stay off
           this site). The answer says only that the date has passed.
         • Each question is THIS program's question. Nine of them were word
           for word the Broward page's ("We received the notice. What do we
           do first?"); each now names the recertification, the way a board
           member types it into a search box. No two questions are the same
           on the two pages (programs.test.ts).
       Held until the owner answers: cost, how long the work takes, who signs
       the electrical report, buildings of four or more stories, access to
       units, Spanish.
       Read on 2026-10-06 against miamidade.gov "Building Recertification"
       (its Common Questions), the text of Sec. 8-11(f) and F.S. 553.899.
       `regulatoryChecked` was left alone: that date stands for a full
       re-read of the rows, which this was not. */
    faq: [
      {
        q: 'Is this the 40-year recertification?',
        a: 'Yes. “40-year recertification” is the name most owners still use for Miami-Dade’s building recertification, from the years when the first inspection fell due at that age. The program is the same; the first inspection now falls due earlier, at the ages under “First due” in the table above.',
      },
      {
        q: 'We received a Miami-Dade recertification notice. What do we do first?',
        a: 'Send it to us — a phone photo of the letter is enough. We read the notice and the building’s history, confirm what your Building Official is asking for and by when, and reply with a proposal for the complete recertification, not only its structural report. In a condominium or cooperative of three habitable stories or more, the board also has duties to unit owners: see “What the board must do” above.',
      },
      {
        /* The owner's answer of October 7, 2026, as the question a board
           types. It took the place of "Who do we file the recertification
           report with?" — the page is at its ceiling of 23 headings, and
           that answer is said twice more, in the note beside the table and
           under "Who sent your notice?". Thermography carries its condition
           in words, the parking-lot certifications theirs ("where they
           apply"), and no part is said to be due for every building. */
        q: 'Does a Miami-Dade recertification include the electrical report, thermography and the parking-lot certificates?',
        a: 'Yes. The county asks for more than a structural report: an electrical report as well, an infrared thermography inspection where the building’s electrical service requires it, and its two parking-lot certifications, for illumination and for guardrails, where they apply. One team delivers all of it, so the board makes one call. Each part, and when it applies, is set out in the package list above.',
      },
      {
        q: 'How long do we have to recertify in Miami-Dade?',
        a: 'The “Time to file” row in the table above gives the time for the report, and “If repairs are needed” the time for what follows; both are counted from the Notice of Required Inspection. Send us the letter first: we confirm from it what your Building Official is asking for, and by when.',
      },
      {
        q: 'Does our building have to recertify, and which buildings are exempt?',
        a: 'Almost every building does. The “Applies to” row above lists the building types and the few that are outside the program, and “First due” gives the age at which the first recertification falls due, counted from the year built on the Property Appraiser’s record.',
      },
      {
        /* The code obliges the Building Official to send the courtesy
           notices and says that not receiving them excuses nothing; the
           duty itself comes from the building's age. */
        q: 'We never received a recertification notice. Are we exempt?',
        a: 'No. A building comes under the program because of its type and its age — the “Applies to” and “First due” rows above — not because a letter arrived. Courtesy notices should arrive ahead of time, and not receiving them does not move the deadline. No notice yet? Send the address and the year built.',
      },
      {
        /* The length of an extension is the one number this answer would
           need, and it is not in the row: it stays in the single sentence
           that states it, under "Good to know". */
        q: 'Can we get an extension on the recertification?',
        a: 'One can be requested, to file the report or to obtain permits, and it is the Building Official who grants it. The request comes from the engineer, signed and sealed, and states that the building can remain occupied. How long an extension may run is under “Good to know”, further down this page.',
      },
      {
        q: 'Does recertification require bringing the building up to today’s code?',
        a: 'No. The building is judged against the code in force when it was built. Recertification does not require bringing it up to today’s code.',
      },
      {
        q: 'Is recertification the same as the state milestone inspection?',
        a: 'For condominium and cooperative buildings of three habitable stories or more, the recertification report serves as the state milestone inspection, and no separate milestone report is filed. What state law adds for those buildings is the board’s duties to unit owners, listed under “What the board must do” above. Other buildings are outside the milestone law and answer only to the county’s program.',
      },
      {
        q: 'What if the recertification report lists repairs?',
        a: 'The report is filed anyway: the county asks for it first, not after the work. Where repairs are needed, we define what has to be corrected so contractors bid the same work; repairs that need a permit wait for it, and an amended report stating that the repairs are complete closes the recertification. The time allowed is in the “If repairs are needed” row above.',
      },
      {
        /* The county's own published answer (miamidade.gov, Common
           Questions), named as the county's. No amounts: the county prints
           its own, and a city's are its own. The last two sentences are for
           the owner who is already late — they say what we do first and
           nothing about what the office will do. */
        q: 'What happens if we miss the recertification deadline?',
        a: 'Miami-Dade County’s recertification page says that when a recertification is not obtained in time, a citation is issued without further notice and the case is referred for enforcement; penalties can then accumulate, and a lien can follow. Each city handles its own cases, so the office that sent your notice sets the steps and the amounts. Past the date on your notice? Send the notice and any citation; the first step is getting the inspection done and the report filed.',
      },
      {
        /* No age in the question and no year in the answer, on purpose —
           see the note above this array. */
        q: 'Our older building was never recertified. Are we late?',
        a: 'It may be. When the county shortened the schedule, it set a single catch-up date for the buildings that were already past the new ages, and that date has passed; buildings already recertified under the earlier schedule keep the one they were on. Send the address and the year built, and we confirm what applies to the building before we propose.',
      },
    ],
    /* What is left under "Good to know" once the questions above took their
       share: who prepares which report, the forms, the one sentence that
       states the length of an extension, who closes a file, and the limits
       of any report. The sentences are unchanged — but for the last two,
       which were word for word the Broward page's: each now names this
       page's own Building Official and report. Same meaning, and still no
       promise about how an office will act. */
    considerations: [
      /* Threshold buildings: neutral on purpose. It states the county's rule
         and what we do about it; it claims no credential either way. */
      'Buildings over three stories or 50 feet are “threshold buildings”, and their structural report must come from an engineer with the additional qualifications Miami-Dade County requires. We confirm this for your building before we propose.',
      'Only the county’s own forms are accepted for the structural and electrical reports — a firm’s own form is not — and each building on a property is reported separately.',
      /* What the two parking-lot forms ARE: a measurement and a finding, on
         the county's own sheets. Never "we certify that the lot complies". */
      'The parking-lot certifications record what was measured and found, not a promise that a lot passes: light levels that meet the county’s standard or do not, and whether a lot beside water has the guardrail the county requires. Where a guardrail is missing, the owner needs a permit to install one.',
      /* "Complete" is the package, never the outcome — see the header. */
      'A complete package is not yet a closed recertification. Where the reports list repairs, the repairs come first — under permit where one is needed — and the amended report is what closes it.',
      'The Building Official may grant an extension of up to 60 days to file the report or to obtain permits, on a signed and sealed request from the engineer stating that the building can remain occupied.',
      'The amended report that closes a recertification comes from the engineer or architect who filed the original report. If another firm filed yours, say so when you write — we confirm what closing it will take before we propose.',
      'A condition that puts life or property in danger is reported to the owner and to the Building Official of your city, or of the county in unincorporated areas; the engineer has a duty to do so.',
      'A recertification report documents observed conditions; concealed ones may need further investigation, and no engineer can guarantee how a reviewing office will act on it.',
    ],
    /* WHO SENT YOUR NOTICE. Each office is named as its city's own page
       names it (the county's, for the unincorporated area); every one of
       those pages was opened and read on 2026-10-07. miamidade.gov says it
       in one line: each municipality's building official has jurisdiction
       over its recertifications.

       The rows are TEXT. They were links to those pages until the on-page
       check counted thirteen of them as broken (see `offices` in the type
       above); the addresses are in `office-pages.ts`, with what was found
       at each. The one link left in the block is `forms`: the county's own
       page.

       Order: the cities first, the unincorporated area last. Not a ranking,
       and not every municipality: `note` says what to do for the others.
       No fees and no dates here, although several of the cities' pages
       print their own. */
    offices: {
      title: 'Who sent your notice?',
      lede: 'The notice comes from the building office of your own city, or from the county in unincorporated areas, and the report goes back to that same office. Find yours below.',
      rows: [
        { city: 'City of Miami', office: 'City of Miami Building Department, Unsafe Structures Section' },
        { city: 'Miami Beach', office: 'City of Miami Beach Building Department' },
        { city: 'Hialeah', office: 'City of Hialeah Building Division' },
        { city: 'Coral Gables', office: 'City of Coral Gables Building Division' },
        { city: 'Doral', office: 'City of Doral Building Department' },
        { city: 'North Miami', office: 'City of North Miami Building Department' },
        { city: 'North Miami Beach', office: 'City of North Miami Beach Building Department' },
        { city: 'Aventura', office: 'City of Aventura Building Division' },
        { city: 'Sunny Isles Beach', office: 'City of Sunny Isles Beach Building Department' },
        { city: 'Miami Gardens', office: 'City of Miami Gardens Building Services' },
        { city: 'Homestead', office: 'City of Homestead Development Services, Building Safety' },
        { city: 'Surfside', office: 'Town of Surfside Building Department' },
        { city: 'Key Biscayne', office: 'Village of Key Biscayne Building, Zoning and Planning Department' },
        { city: 'Unincorporated Miami-Dade', office: 'Miami-Dade County Regulatory and Economic Resources' },
      ],
      note: 'Your city is not on the list? Each Miami-Dade municipality handles its own recertifications, and the letter names the office that sent it. Questions about a notice go to that office. Send us the letter: we read it before we propose.',
      /* The county's recertification page: its guidelines and the report
         templates are under "General Guidelines and Form Templates". The
         one page this block links, and the county's own. */
      forms: {
        text: 'These are the forms the report goes on:',
        label: 'Miami-Dade County: recertification guidelines and report templates',
        url: 'https://www.miamidade.gov/global/economy/building/recertification.page',
      },
      checked: officeLinksChecked,
    },
    /* THE MIAMI-DADE PACKAGE. Read on October 7, 2026 at the county's
       recertification page, its upload guidelines (the packet's file list),
       the two report forms and the two parking-lot forms in force, the
       Board of Rules and Appeals' guidelines and Chapter 8C of the county
       code. What each row is careful about:
         • Thermography is an inspection whose written report is ATTACHED to
           the electrical report — not a certificate of its own — and it is
           conditional. The condition is a size of electrical service: said
           in words, never as the number.
         • Illumination: the county says "applicable"; the form reports
           measured levels and that they meet the standard OR DO NOT.
         • Guardrails: the form records, either way, whether the lot is
           beside water, and only then whether the guardrail is there.
         • The county's list is the county's. A city may ask for a different
           set (`note`), and no city's is stated here.
       Left out on purpose: the letter of qualifications that goes with a
       threshold building's structural report (it would say who signs —
       the neutral sentence under "Good to know" covers it), the county's
       review fee (no fees on this site) and structural glazing, which has
       a recertification of its own. */
    packet: {
      label: 'The Miami-Dade package, part by part',
      lede: 'What the county asks for with a recertification, and what our team delivers for your building. Some parts go in for every building, others only where the condition beside them is met — and a city may ask for a different set than the county’s.',
      parts: [
        { k: 'Structural report', v: 'The condition of the structure — foundations, frame, slabs, balconies, facade and roof — on the county’s structural form. Every building in the program files one.' },
        { k: 'Electrical report', v: 'The general condition of the building’s electrical systems, on the county’s electrical form. Every building in the program files one, as a file of its own.' },
        { k: 'Infrared thermography', v: 'An infrared inspection of the electrical equipment, with a written report that is attached to the electrical report. It applies where the building’s electrical service requires it, and never to the panels inside the units.' },
        { k: 'Parking-lot illumination certificate', v: 'The light levels measured in the parking lot that serves the building, and whether they meet the county’s standard for that type of building. Filed with the package where it applies.' },
        { k: 'Parking-lot guardrail certificate', v: 'The county’s form on whether the parking lot is next to a canal, a lake or another body of water and, if it is, whether parked vehicles are protected by the guardrail the county requires.' },
        { k: 'Cover letter', v: 'A letter that goes with each report and states its conclusion on the building’s continued occupancy.' },
        { k: 'Photographs', v: 'The photographs the county’s forms call for: the conditions each report describes, and every elevation of the building.' },
        { k: 'Site plan or survey', v: 'An aerial view that identifies the building goes with every structural report. Where a property has more than one building, a site plan or a copy of a survey shows which one the reports are for.' },
      ],
      note: 'We read your city’s letter first, and propose the package it asks for.',
    },
    alsoCalled: ['40-Year Recertification', 'Building Recertification'],
    crossLink: { text: 'Building in Broward?', label: 'See the BSIP', slug: 'broward-bsip' },
    program: {
      id: 'miami-dade',
      eyebrow: 'Miami-Dade County · Building Recertification',
      /* Parallel with the Broward headline: the accent falls on the filing
         deadline, the one thing a reader must not carry across counties.
         "90 days" must always equal the row's "Time to file". */
      titleLines: ['Miami-Dade recertification.', '90 days from the notice.'],
      accentWord: '90 days',
      lede: 'One team delivers the complete package — the structural and electrical reports on the county’s forms and the certificates that go with them — and stays through repairs to the amended report that closes the recertification. The program reaches almost every building other than single-family homes and duplexes. Send us the notice from your city or the county.',
      steps: ['Notice review', 'Inspection', 'Report filed', 'Repairs & close-out'],
      cta: 'Send the Miami-Dade Notice',
      ctaNote: 'A phone photo of the letter is enough. No notice yet? Send the address and the year built.',
      timingLink: 'All Miami-Dade Deadlines and Exemptions',
      detail: 'Recertification in Detail',
    },
    /* seo: no ages and no day counts. The numbers live in the timing row,
       with their authority and date; a meta description is where a stale
       number survives longest.

       "40-Year" IS in the title and the description, as the name the program
       used to have ("formerly", "still called") — never as a rule. It used
       to sit in the keywords only, which no search engine reads, while most
       owners still type it. Do not move it back, and do not drop "formerly".
       The title ends there. "— Structural Engineer" used to follow, and made
       it 687 px of the 580 a search result shows (seo.ts has the rule). */
    seo: {
      title: 'Miami-Dade Building Recertification (formerly 40-Year)',
      /* The description used to end "a Florida P.E. inspects and files on
         the county's form" — one person and one form. It now says what the
         page says: the complete package, with the parts people search for
         by name, and thermography with its condition. */
      description:
        'Complete Miami-Dade recertification, still called the 40-year recertification: structural and electrical reports, parking-lot certificates, thermography if required.',
      keywords: ['building recertification Miami-Dade', 'Miami-Dade recertification engineer', '40 year recertification Miami', '30 year recertification Miami', 'condo recertification Miami', 'structural recertification report', 'electrical recertification Miami-Dade', 'infrared thermography inspection Miami', 'parking lot illumination certification', 'parking lot guardrail certification'],
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
      'One team for the complete BSIP package, from the Notice of Required Inspection to the completion letter that closes the file — the structural and electrical inspections, the written report and the program’s two official forms.',
    card: {
      when: 'The certified letter has arrived, the building is close to its first inspection, or an earlier file is still open.',
      receive: 'The whole package — the written report, the program’s structural and electrical forms and color photographs — and the repair scope where one is needed.',
      next: 'Start with your city’s letter — a photo from your phone will do — or, if there is none yet, with the address and the year of the certificate of occupancy.',
    },
    /* The line under the H1: the name owners still use, as a name, and no
       number — "Broward’s BSIP", not the program's full name, which the H1
       right above spells out. Since October 7, 2026 it also says what the
       owner asked the first screen to say: one team delivers it COMPLETE —
       and what that is in Broward, structural and electrical. (It said "in
       one report" for a day: the policy also names "the Electrical Safety
       Inspection report", so the first screen gives no count.)
       "Reaches almost every building type, in every city" and "Send us the
       notice from your Building Official." gave way to it (the home
       section's lede still says the first, the button under this line the
       second). Measured like the Miami-Dade line: four lines at 360 and
       390px, where the old one ran five — this line may not grow. */
    heroSub:
      'Many owners still call Broward’s BSIP the 40-year recertification. One team delivers it complete: structural and electrical.',
    /* The page's own h2s — see the Miami-Dade block. No age and no day count
       in any of them. */
    headings: {
      whatsIncluded: 'What a complete Broward BSIP inspection covers',
      whenItApplies: 'Which buildings the Broward BSIP reaches',
      howItRuns: 'From the notice to the filed report',
      faq: 'Questions boards ask about the Broward BSIP',
      considerations: 'BSIP reports, the official forms and the limits of an inspection.',
    },
    /* Not "The letter says 180 days": what a given city's letter says was not
       verified, and a city may set its own dates. The number is in the row. */
    problemTitle: 'A certified letter with a deadline.',
    /* "40-year" here, in the line under the H1, in the first question and in
       the title: always as the name people still use, never as a trigger.
       "A structural engineer", once — see the Miami-Dade block, and for the
       last sentence too: it used to end "…who can carry the structural
       side". */
    problem:
      'Broward’s Building Safety Inspection Program (BSIP) is a countywide safety inspection of older buildings, structural and electrical, written by the Broward County Board of Rules and Appeals and enforced by your city’s Building Official. Many owners still call it the 40-year recertification, and much of what is written about it describes rules that have since changed. Boards and owners need a structural engineer whose team works from the current policy and delivers both halves of the program, the structural inspection and the electrical one, from the first site visit to the close-out.',
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
    capabilities: ['Notice review', 'Structural & electrical inspection', 'Written report & both official forms', 'Repair scope', 'Reinspection & close-out'],
    scope: [
      'Review of your city’s letter, the building’s records and prior reports',
      'Structural inspection on site — frame, slabs, balconies, stairs, guardrails, roof and foundations, and the parking garage where there is one',
      'Electrical inspection on site — the service and its equipment, electric rooms, wiring and grounding, emergency lighting, the fire alarm and exit lights, and the wiring at parking lots and garages',
      'Observed conditions classified by structural significance, for the BSIP report',
      'Repair work defined so contractors bid the same scope',
      'Reinspection of the repaired areas',
      'Answers to the Building Official’s questions on the report and its forms',
    ],
    /* Same six labels as the Miami-Dade page; Broward's own content. */
    process: [
      { step: 'Notice review', detail: 'We read your city’s letter first: the date it was received, the date it sets, and what the Building Official asks to be filed.' },
      { step: 'Inspection', detail: 'A systematic visual examination of the structure and of the electrical systems on site, with testing or opened finishes only where what we see calls for it.' },
      { step: 'Report filed', detail: 'A written narrative report with color photographs, plus the Board of Rules and Appeals’ official structural and electrical forms, signed and sealed. It is filed as soon as it is complete, even when it lists repairs.' },
      { step: 'Repairs under permit', detail: 'Where repairs are needed, we define the work so contractors bid the same scope, and issue the signed and sealed letter on whether the building can stay occupied meanwhile. Repairs wait for their permits.' },
      { step: 'Reinspection', detail: 'When the work is complete, the areas noted in the original report are reinspected.' },
      { step: 'Close-out', detail: 'An amended report and a signed and sealed completion letter go to the owner and to the Building Official. That closes the file, until the next cycle.' },
    ],
    /* The first line is the whole package, named once; its parts are
       `packet`, printed right under this list. */
    deliverables: [
      'The complete BSIP package: a written narrative report and the Board’s structural and electrical forms, each signed and sealed, with color photographs, set out part by part below',
      'Written repair scope where repairs are needed',
      'Signed and sealed letter on whether the building can remain occupied during repairs',
      'Amended report and completion letter after repairs',
    ],
    nextStep:
      'Send the notice — a phone photo is enough — or the address and the year of the certificate of occupancy. We read what your city is asking for and reply with a proposal for the complete BSIP inspection and report, structural and electrical.',
    timing: {
      checked: regulatoryChecked,
      /* Policy #05-05, Sec. I.E: the program "shall serve as compliance for
         both phase one and phase two milestone inspection requirements". The
         two duties to unit owners are the state's (F.S. 553.899(5) and (9))
         and stay with the board. They are `duties` below, as on the
         Miami-Dade page; the sentence about the city's letter moved to the
         front so the list follows the sentence that introduces it.

         The same three duties as on the Miami-Dade page, with this page's
         own names for the two documents the statute counts from: the notice
         is the Building Official's, and the report is the BSIP report, which
         the sentence above says serves as both phases. See the note there
         before rewording any of them. */
      note: 'Your city’s Building Official enforces the program, and your city’s letter states its own date — which is why we read it first. For condominium and cooperative buildings of three habitable stories or more, the BSIP report serves as phase one and phase two of the state milestone inspection, and the board’s duties to unit owners under state law (Florida Statute 553.899) remain.',
      duties: [
        'Within 14 days of receiving the notice from your Building Official, tell unit owners about the required inspection and the date it must be completed.',
        'Within 45 days of receiving the BSIP report, send every owner the engineer’s summary and post it in a conspicuous place on the property.',
        'In those same 45 days, publish the BSIP report and the summary on the association’s website, where the association is required to have one.',
      ],
      rows: [
        {
          jurisdiction: 'Broward County',
          source: 'Broward County Board of Rules and Appeals, Policy #05-05 · Florida Building Code, Broward County Amendments, Section 110.15',
          /* The Board's own "Forms and Contacts" page: under "Building
             Safety Inspection Program" it lists Policy 05-05 AND Section
             110.15, the two texts this row names. Opened 2026-10-07.
             Deliberately not a link to the PDF itself: the broward.org PDF
             addresses search engines still list return "not found", and
             the Board's old program page now redirects to its home. */
          sourceUrl: 'https://www.broward.org/codeappeals/FormsandContacts',
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
            { k: 'First due', v: 'At 25 years, counted from the certificate of occupancy.', home: true },
            { k: 'Then', v: 'Every 10 years.', home: true },
            { k: 'Time to file', v: '180 days from receiving the Notice of Required Inspection. Older guides still say 90 days; the policy in force since August 9, 2024 gives 180. Your city’s letter states its own date.', filing: true, home: true, homeWhole: true },
            { k: 'If repairs are needed', v: '180 days from the date of the report, under permit, unless the Building Official sets a different time. A reinspection, an amended report and a signed and sealed completion letter close the file.', home: true },
            { k: 'Condominiums & co-ops', v: 'The BSIP report serves as phase one and phase two of the state milestone inspection.', home: true },
          ],
        },
      ],
    },
    /* QUESTIONS BOARDS ASK — the same device, and the same rules, as the
       Miami-Dade page: the caveats that sat under "Good to know", under the
       question an owner types; no age, day count or deadline typed in an
       answer (it points at the row by its label); "40-year" as a name only;
       no amounts and no promise about what an office will do.

       Two answers are Broward's own:
         • A missed deadline: what Policy #05-05 itself says (III.H.2, and
           III.E.5 for the city's own timelines and penalties), named as the
           Board's policy.
         • A building inspected under the old program: the policy treats it
           as compliant (I.D). The answer gives the interval by pointing at
           the row and deliberately does NOT say which year it is counted
           from — two current official texts differ (see "Then" below) — and
           it never computes a year.
       Held until the owner answers: cost, how long the work takes, who signs
       the electrical report, buildings of four or more stories, access to
       units, Spanish.
       Read on 2026-10-06 against Policy #05-05 (effective August 9, 2024)
       and F.S. 553.899; `regulatoryChecked` was left alone, as on the
       Miami-Dade page. */
    faq: [
      {
        q: 'Is the BSIP the same as the 40-year recertification?',
        a: 'Yes. “40-year recertification” is the name many owners still use for Broward’s Building Safety Inspection Program, from the earlier version of the program. Much of what is written about it describes rules that have since changed; the ages and deadlines in force are in the table above.',
      },
      {
        q: 'We received a Broward BSIP notice. What do we do first?',
        a: 'Send it to us — a phone photo of the letter is enough. We read your city’s letter first: the date it was received, the date it sets, and what the Building Official asks to be filed; then we reply with a proposal for the complete inspection and report, structural and electrical. In a condominium or cooperative of three habitable stories or more, the board also has duties to unit owners: see “What the board must do” above.',
      },
      {
        /* The Broward form of the owner's answer of October 7, 2026 — see
           the Miami-Dade block. It took the place of "Who do we file the
           BSIP report with?", which the note beside the table and "Who sent
           your notice?" both answer. Broward's parts only: two inspections,
           one report, the Board's two forms, color photographs. */
        q: 'Does the Broward BSIP include an electrical inspection?',
        a: 'Yes. The program asks for two inspections, structural and electrical, reported together: one written report, with the Board of Rules and Appeals’ structural form, its electrical form and color photographs. One team delivers all of it, so the board makes one call. Each part is set out in the package list above.',
      },
      {
        q: 'How long do we have to file the BSIP report?',
        a: 'The “Time to file” row in the table above gives the time for the report, counted from the day the notice is received, and “If repairs are needed” the time for the work that follows. Your city’s letter states its own date, and that is the date we work to.',
      },
      {
        q: 'Does our building have to file, and which buildings are exempt?',
        a: 'Almost all building types do, in every Broward city and the unincorporated area. The “Applies to” row above lists the homes and minor structures outside the program, and “First due” gives the age at which the first inspection falls due. Also outside the program: federal and State of Florida buildings, buildings on sovereign tribal lands, Broward County School Board schools, and railroads.',
      },
      {
        q: 'We never received a BSIP notice. Are we exempt?',
        a: 'No. The Board of Rules and Appeals sends each city its list of buildings by June, and the Building Official mails the notices by certified mail from June through August. Not receiving one is no defense: the inspection, the report and any repairs are still due on time.',
      },
      {
        /* The length of an extension stays in the one sentence that states
           it, under "Good to know" — see the Miami-Dade block. */
        q: 'Can we get an extension on the BSIP report?',
        a: 'One can be requested to submit the report, and it is the Building Official who grants it. Ask before the date in your city’s letter. How long an extension may run is under “Good to know”, further down this page.',
      },
      {
        q: 'Does the BSIP require bringing the building up to today’s code?',
        a: 'No. The building is judged against the code in force when it was built. The program does not require bringing it up to today’s code.',
      },
      {
        /* "Serves as phase one and phase two", and no more: unlike
           Miami-Dade, nothing here says "no separate report" (see the note
           on the milestone page). */
        q: 'Is the BSIP the same as the state milestone inspection?',
        a: 'For condominium and cooperative buildings of three habitable stories or more, the BSIP report serves as phase one and phase two of the state milestone inspection. What state law adds for those buildings is the board’s duties to unit owners, listed under “What the board must do” above. Other buildings are outside the milestone law and answer only to the BSIP.',
      },
      {
        q: 'What if the BSIP report lists repairs?',
        a: 'The report is filed as soon as it is complete, even when it lists repairs. The repairs then follow under permit, and while they are underway the engineer issues a signed and sealed letter on whether the building can remain occupied. A reinspection, an amended report and a completion letter close the file; the time allowed is in the “If repairs are needed” row above.',
      },
      {
        q: 'What happens if we miss the BSIP deadline?',
        a: 'Policy #05-05 of the Board of Rules and Appeals says that when the report is not filed on time and no extension was requested, the Building Official takes the case to a hearing before a Special Magistrate or the Code Enforcement Board; where required repairs are not made, the building can be deemed unsafe and unfit for occupation. A city may set its own timelines and penalties, so the office that sent your notice sets the steps. Past the date on your notice? Send the notice and any citation; the first step is getting the inspection done and the report filed.',
      },
      {
        q: 'We filed under the old 40-year program. When is the next one?',
        a: 'A building inspected under the earlier 40-year program is treated as compliant, and its later inspections follow at the interval in the “Then” row above. The year yours falls due is not something to work out from a general rule: your city’s Building Official sends the Notice of Required Inspection, and its letter states the date. Send us the last report or the notice, and we read it first.',
      },
    ],
    /* What is left under "Good to know" once the questions above took their
       share. The sentences are unchanged; the list of buildings outside the
       program went to its question, and the sentence on what IS inspected
       stays here on its own. */
    considerations: [
      /* "An extension", never "one extension": the policy does not say
         whether more than one can be granted. */
      'The Building Official may grant an extension of up to 60 days to submit the report.',
      /* Threshold buildings: neutral on purpose, claims no credential. */
      'Buildings over three stories or 50 feet are “threshold buildings”, and their structural report must come from an engineer with the additional qualifications Broward County requires. We confirm this for your building before we propose.',
      'Only the Board of Rules and Appeals’ own structural and electrical forms are accepted — a firm’s own form is not — and they come in addition to a written narrative report with color photographs, not instead of it.',
      'The amended report and the completion letter come from the professional who inspected the building and issued the original report. If another firm issued yours, say so when you write — we confirm what closing the file will take before we propose.',
      'Parking garages, guardrails, and the balconies, elevated decks, docks and seawalls attached to or supporting a structure are part of the inspection.',
      /* "Complete" is the package, never the outcome — see the header. */
      'A complete package is not yet a closed file. Where the report lists repairs, they follow under permit, and the amended report with its completion letter is what closes it.',
      /* The last two are the Miami-Dade page's last two, in this page's
         terms: the Building Official is your city's, and the report is the
         BSIP report. */
      'A condition that puts life or property in danger is reported to the owner and to your city’s Building Official; the engineer has a duty to do so.',
      'A BSIP report documents observed conditions; concealed ones may need further investigation, and no engineer can guarantee how the Building Official will act on it.',
    ],
    /* WHO SENT YOUR NOTICE — the same block, and the same rules, as the
       Miami-Dade page: each office named as its city's own page names it
       (read on 2026-10-07), the rows as text, the cities' addresses in
       `office-pages.ts` and not here.

       No fees and no dates, although several of the cities' pages print
       theirs. */
    offices: {
      title: 'Who sent your notice?',
      lede: 'The program is written for the whole county, and each city’s Building Official sends the notices and receives the reports. Find your city below, next to its building office.',
      rows: [
        { city: 'Fort Lauderdale', office: 'City of Fort Lauderdale Development Services Department' },
        { city: 'Hollywood', office: 'City of Hollywood Building Division' },
        { city: 'Pompano Beach', office: 'City of Pompano Beach Building Department' },
        { city: 'Hallandale Beach', office: 'City of Hallandale Beach Building Division' },
        { city: 'Deerfield Beach', office: 'City of Deerfield Beach Building Division' },
        { city: 'Pembroke Pines', office: 'City of Pembroke Pines Building Department' },
        { city: 'Miramar', office: 'City of Miramar Building, Planning & Zoning Department' },
        { city: 'Plantation', office: 'City of Plantation Department of Building Safety' },
        { city: 'Sunrise', office: 'City of Sunrise Building Division' },
        { city: 'Davie', office: 'Town of Davie Building Division' },
      ],
      note: 'Your city is not on the list? The program reaches every Broward city, and the letter names the office that sent it. Questions about a notice go to that office. Send us the letter: we read it before we propose.',
      /* The same page as the row's source: the Board's structural and
         electrical forms are listed there, next to the policy. The one page
         this block links, and a county-level one. */
      forms: {
        text: 'These are the forms the report goes on:',
        label: 'Broward County Board of Rules and Appeals: Building Safety Inspection Program forms',
        url: 'https://www.broward.org/codeappeals/FormsandContacts',
      },
      checked: officeLinksChecked,
    },
    /* THE BROWARD PACKAGE. Read on October 7, 2026 in the Board of Rules
       and Appeals' current documents: Policy #05-05 (effective August 9,
       2024), its General Considerations & Guidelines and the two report
       forms (revised May 11, 2023). It is NOT Miami-Dade's list:
         • No parking-lot illumination certificate and no guardrail
           certificate exist in this program. Guardrails are an item of the
           structural form; parking lots and garages appear in the
           electrical form as wiring. Do not add either certificate here.
         • No thermography either. An earlier edition of the policy asked
           for it and is still hosted on other sites; the forms in force do
           not. `note` says so, as what the CURRENT policy asks, and says no
           more than the Board's own brochure did: it is used where an
           inspection calls for it.
         • What a city adds to the filing is the city's (`What your city
           adds`): named as a possibility, never as one city's rule.
       Re-read after the 9th Edition of the code takes effect. */
    packet: {
      label: 'The Broward BSIP package, part by part',
      lede: 'What the Board of Rules and Appeals asks for with a Building Safety Inspection, and what our team delivers for your building: two inspections, structural and electrical, in one written report.',
      parts: [
        { k: 'Written report', v: 'A detailed narrative report of the inspection, signed and sealed, that states whether the building is structurally and electrically safe or what repairs it needs.' },
        { k: 'Structural form', v: 'The Board’s own Structural Safety Inspection Report Form, completed for the building: foundations, walls, floors and roof, framing, windows and exterior doors. Guardrails are among its items, and a parking garage is inspected with the structure.' },
        { k: 'Electrical form', v: 'The Board’s own Electrical Safety Inspection Report Form: the electric service and its equipment, electric rooms, wiring and grounding, emergency lighting, the fire alarm, exit lights, and the wiring at parking lots and garages.' },
        { k: 'Color photographs', v: 'Included with the report to show the conditions observed, above all where defects were found.' },
        { k: 'Supporting data', v: 'Where there are any, drawings or sketches and, where the inspection called for testing, the test reports — listed on the structural form and attached to it.' },
        { k: 'Summary for unit owners', v: 'In a condominium or a cooperative, a summary of the report, prepared for the association to send to unit owners.' },
        { k: 'What your city adds', v: 'Some cities ask for a cover sheet or a submittal form of their own with the filing. Your city’s letter says what it wants, and we read it first.' },
      ],
      note: 'Infrared thermography: the Board’s current policy does not ask for it; it is used where the electrical inspection calls for it.',
    },
    alsoCalled: ['BSIP', 'Broward Building Safety Inspection Program', '40-Year Building Safety Inspection Program', '40-Year Recertification'],
    crossLink: { text: 'Building in Miami-Dade?', label: 'See Miami-Dade Recertification', slug: 'building-recertification' },
    program: {
      id: 'broward',
      eyebrow: 'Broward County · Building Safety Inspection Program (BSIP)',
      /* "180 days" must always equal the row's "Time to file". */
      titleLines: ['Broward BSIP.', '180 days from the notice.'],
      accentWord: '180 days',
      lede: 'One team delivers the complete BSIP package — both inspections, structural and electrical, the written report and the program’s official forms — and stays through repairs and close-out. Many owners still call the program the 40-year recertification; it reaches almost every building type, in every city. Send us the notice from your Building Official.',
      steps: ['Notice review', 'Inspection', 'Report filed', 'Repairs & close-out'],
      cta: 'Send the Broward Notice',
      ctaNote: 'A phone photo of the letter is enough. No notice yet? Send the address and the year of the certificate of occupancy.',
      timingLink: 'All Broward Deadlines and Exemptions',
      detail: 'BSIP in Detail',
    },
    /* seo.title leads with the words people type: the county, the acronym
       printed on the letter, and the name most owners still give the
       program — "formerly", never as a rule (see the Miami-Dade page; do not
       move it back to the keywords). The program's full name is the H1 and
       opens the description; the 71 characters it took in the title pushed
       everything else out of a search result. No ages and no day counts.
       The title ends at the former name, as Miami-Dade's does: with
       "— Structural Engineer" after it, it was 630 px of the 580 shown. */
    seo: {
      title: 'Broward BSIP (formerly 40-Year Recertification)',
      /* The description used to end "A Florida P.E. inspects and files the
         structural report": half the program, and one person. It now says
         both inspections and one team (the header has the decision). */
      description:
        'Broward’s Building Safety Inspection Program (BSIP), still called the 40-year recertification: one team for the structural and electrical inspection.',
      keywords: ['Broward BSIP engineer', 'building safety inspection program Broward', '25-year building inspection Broward', 'Broward BSIP', 'building safety inspection Broward', '40 year inspection Broward', 'BSIP structural and electrical report', 'electrical safety inspection Broward'],
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
    card: {
      when: 'The board is unsure which inspection the building owes, a report calls for further investigation, or there is a reason to look and no notice.',
      receive: 'An inspection report with findings in order of priority and, for condos and co-ops, a summary the board can send to unit owners.',
      next: 'Tell us where the building is, how old and how tall it is, and what prompted the question.',
    },
    /* The page's own first line: `summary` is the card's, on /services. It
       keeps "structural safety inspections", the half of the service's name
       the H1 leaves out.

       LENGTH MATTERS HERE, on this service and the five below: the line sits
       between the H1 and the page's one button, so every extra line of it
       pushes that button down a phone's first screen. Each of the six was
       measured at 320, 360 and 390 px against the `summary` it replaced and
       is no taller, bar one line at one width. Measure before lengthening
       one. */
    heroSub:
      'Which rules reach your building, how Florida’s milestone inspection is met in your county, and structural safety inspections when no notice has come.',
    /* The H1 names who it is for and where: a board searches "condo
       milestone inspection Broward", and the old H1 (the service's name,
       still `title` on cards and in the nav) had neither a place nor
       "condo". "Structural safety inspections" stays in the line under it,
       which is `heroSub`.

       The page has to say "condos" too: an H1 word found nowhere under it
       is what the on-page check reports, and this page said only
       "condominium(s)". The report step and the summary deliverable now
       say "condos and co-ops", the short form of both. The rows that state
       the law keep the statute's words, "condominium and cooperative". */
    headings: {
      h1: 'Florida Milestone Inspections for Condos in Miami-Dade & Broward',
      /* Each service names what its own "Good to know" list is about. The
         six of them used to open that list with one shared headline. */
      considerations: 'Which buildings the law reaches, and what an inspection can see.',
    },
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
      { step: 'Applicability', detail: 'We confirm which rules reach the building and what any notice in hand is asking for. Where a county program applies, the work runs as that program, and our team delivers the complete package that county asks for.' },
      { step: 'Records review', detail: 'Available drawings, prior reports and repair history reviewed before the site visit.' },
      { step: 'Field inspection', detail: 'Systematic visual inspection with photographic documentation and location mapping.' },
      { step: 'Evaluation', detail: 'Observations evaluated structurally — distinguishing cosmetic from structural, and urgent from monitorable. Where deterioration is substantial, the further investigation is scoped.' },
      { step: 'Report', detail: 'Findings issued with clear priorities and, for condos and co-ops, a separate summary the board can send to unit owners.' },
    ],
    deliverables: [
      'Inspection report with photographic record',
      'Condition findings organized by priority',
      'Summary of findings for unit owners, for condos and co-ops',
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
         the deadline a board answers to is the one on its county's page.

         The two county sentences are `countyPages` below, each under a
         heading that links to that county's page; this note keeps what is
         true of both. */
      note: 'In Miami-Dade and Broward the state milestone inspection is met through the county program — your county’s is just below. The board’s duties to unit owners apply in either county.',
      rows: [
        {
          jurisdiction: 'State of Florida — milestone inspection',
          source: 'Florida Statute 553.899',
          /* The Legislature's own site (Online Sunshine). Opened 2026-10-07. */
          sourceUrl:
            'https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599/0553/Sections/0553.899.html',
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
    /* One heading per county, and the heading is the link. Miami-Dade first,
       as everywhere on the site. Each sentence is the county's own rule as
       the two program pages state it: "no separate milestone report" is said
       for Miami-Dade only (see the note above `timing.note`). No deadline
       here — it is on the page the heading opens. */
    countyPages: [
      {
        slug: 'building-recertification',
        title: 'In Miami-Dade, the recertification report is your milestone inspection',
        text: 'Miami-Dade’s recertification serves as compliance with the state milestone inspection — no separate milestone report is filed there. The deadline on your notice is the county program’s, and it is on that page.',
      },
      {
        slug: 'broward-bsip',
        title: 'In Broward, the BSIP report is your milestone inspection',
        text: 'Broward’s BSIP report serves as phase one and phase two of the state milestone inspection. The deadline on your notice is the county program’s, and it is on that page.',
      },
    ],
    /* The four names a condominium board hears, under the same four labels.
       No age and no deadline in any cell. The two county rows restate
       nothing they could get wrong: for which buildings, they send the
       reader to the county's own page.

       The reserve study row is the statute's description (F.S. 718.112(2)(g)
       for condominiums, 719.106(1)(k) for cooperatives, read 2026-10-06). It
       says what the study is and where it goes — NOT whether this firm
       prepares one. That sentence waits for the owner. */
    comparison: {
      title: 'Recertification, BSIP, milestone inspection and SIRS, side by side',
      labels: ['Who requires it', 'Which buildings', 'What it produces', 'Where it is filed'],
      rows: [
        {
          name: 'Miami-Dade recertification',
          values: [
            'Miami-Dade County. The notice comes from the Building Official of your city, or from the county in unincorporated areas.',
            'Almost every building other than single-family homes and duplexes; the full list is on the Miami-Dade page.',
            'A structural report and an electrical report, each on the county’s own form, filed with the certificates and attachments the county asks for.',
            'With the Building Official who sent the notice.',
          ],
        },
        {
          name: 'Broward BSIP',
          values: [
            'Broward County, through its Board of Rules and Appeals. Your city’s Building Official enforces it.',
            'Almost all building types, in every Broward city; the homes and minor structures outside it are listed on the BSIP page.',
            'A written narrative report with the Board’s own structural and electrical forms and color photographs.',
            'With your city’s Building Official.',
          ],
        },
        {
          name: 'State milestone inspection',
          values: [
            'The State of Florida.',
            'Condominium and cooperative buildings of three habitable stories or more.',
            'A phase one inspection report and, only where phase one finds substantial structural deterioration, a phase two. In Miami-Dade and Broward the county report serves as it.',
            'With the association and the Building Official — in Miami-Dade and Broward, as the county program’s report.',
          ],
        },
        {
          name: 'Structural integrity reserve study (SIRS)',
          values: [
            'The State of Florida, under its condominium and cooperative laws.',
            'Residential condominium and cooperative buildings of three habitable stories or more.',
            'A reserve study, not an inspection report: what the roof, the structure and the other parts of the building the law lists will cost to repair or replace, and what the association should set aside each year.',
            'The association shares it with unit owners and tells the state’s condominium division that it was completed.',
          ],
        },
      ],
      source:
        'Code of Miami-Dade County, Section 8-11(f) · Broward County Board of Rules and Appeals, Policy #05-05 · Florida Statutes 553.899, 718.112 and 719.106',
    },
    /* "building safety inspection Broward" moved to the BSIP page with the
       slug rename: that query is about Broward's program, not this page.
       The title is "condo" and the two counties, which is how a board
       searches for it. Like the two program titles it used to end in the
       trade ("— Structural Engineer"), which no search result had room to
       show. The description was the one on the site over the 1000 px a
       result shows; "condo and co-op milestone inspections" says the same
       in fewer. */
    seo: {
      title: 'Condo Milestone Inspections in Miami-Dade & Broward',
      description:
        'Florida condo and co-op milestone inspections in Miami-Dade and Broward: how the county program meets them, phase two, and structural safety inspections.',
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
    card: {
      when: 'A report lists repairs, cracks or spalling have appeared, or you are buying or altering a building.',
      receive: 'An assessment report with the deterioration mapped and, when repairs are designed, drawings and specifications a contractor can price.',
      next: 'Start with photographs and any earlier report; we tell you whether a visit is needed.',
    },
    heroSub:
      'What the cracks, the spalling or the report in your hands actually mean — and repairs specified so every contractor prices the same work.',
    headings: {
      considerations: 'What an assessment settles, and what it leaves open.',
    },
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
    /* "South Florida", where the other service titles name the two
       counties: with them this one is 599 px, and a result shows 580. */
    seo: {
      title: 'Structural Assessments & Repair Design — South Florida',
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
    card: {
      when: 'A new building needs its structural set for permit, an architect needs the structure behind a design, or a contractor needs details that can be built.',
      receive: 'Permit-ready structural drawings with their calculations, general notes and typical details.',
      next: 'Start with the architectural drawings, at whatever stage they are, and the site location.',
    },
    heroSub:
      'Reinforced concrete for houses, mid-rises and commercial buildings — sized for hurricane wind and detailed so it can be built.',
    headings: {
      considerations: 'The soil report, the geometry and the permit review.',
    },
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
      /* "For permit submittal", as the last process step says: with the
         milestone page's wording this line was one sentence on two pages. */
      'Signed and sealed documents for permit submittal, where the scope requires it',
    ],
    nextStep:
      'Send the architectural drawings (any stage) and the site location. You receive a proposal with scope, deliverables and fee.',
    considerations: [
      'Foundation design depends on a geotechnical report; where none exists we will tell you what is needed before we start.',
      'Scope and fee change with irregularity — transfers, cantilevers, post-tensioning and unusual geometry are priced honestly, not absorbed silently.',
      'Permit review comments are part of the process; we respond to them, but no engineer can guarantee a jurisdiction’s decision.',
    ],
    /* seo.title: keyword + place, inside the 580 px a search result shows
       (seo.ts has the rule; the brand does not fit after any service
       title). seo.description: under 1000 px, no code names. */
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
    card: {
      when: 'Before you commit to a site or a concept, on a difficult lot, or when hurricane wind and lateral loads have to be resolved.',
      receive: 'The analysis results in a summary, the foundation design with its reactions, and the calculations behind both.',
      next: 'Start with the site and the concept; add the geotechnical report if there is one.',
    },
    heroSub:
      'The whole building in one model, roof to foundations — so you know whether a site or a concept works before you commit.',
    headings: {
      considerations: 'An analysis is only as good as its inputs.',
    },
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
    card: {
      when: 'The team models in Revit, the owner or the contractor asks for a federated model and clash reports, or services and structure keep clashing on the drawings.',
      receive: 'The structural model, the clash and issue reports, and drawings and schedules taken from the model.',
      next: 'Tell us the software, the level of detail and the coordination calendar.',
    },
    heroSub:
      'The structure modeled in Revit and checked against the other disciplines, so clashes are closed in design, not on site.',
    headings: {
      considerations: 'What a model can do, and what it cannot.',
    },
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
    card: {
      when: 'A lender or an insurer asks for an independent review, a set is about to be issued, or something in the structure worries you.',
      receive: 'A review report and a prioritized comment log, followed until every comment is closed.',
      next: 'Send the drawings and the calculations, and tell us what the review has to answer.',
    },
    heroSub:
      'An independent engineer reads your drawings and calculations against the governing code before they are issued, and stays until every comment is closed.',
    headings: {
      considerations: 'What a peer review is, and what it is not.',
    },
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
    /* "in", where the other service titles have a dash: this is the widest
       title on the site, and the dash put it within 9 px of the limit. */
    seo: {
      title: 'Structural Peer Review & Compliance in Miami-Dade & Broward',
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

/* The grid's own headline: the question its cards answer, and the one the
   lede under it picks up ("If your project is not on this list…"). It used
   to carry "From a single house to a mid-rise concrete frame.", which is
   the home page's headline (`newBuildings`, below) — the same h2 on two
   pages. The home page keeps the approved line; this section asks. */
export const typologiesSection = {
  eyebrow: 'What we design',
  title: 'Do we design your kind of building?',
  accentWord: 'your kind',
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

   The headline is the owner-approved "What we design" line, and this is now
   the only place it is printed: the typology grid on /services, which also
   carried it, has a headline of its own (`typologiesSection`). Owners and
   boards read the home page: no "federate", no "MEP", and no promise about
   what gets built.

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
  status: string;
};

/* Typical profiles, not jobs: every `location` is the service area, never a
   specific county, and every `status` carries the one Work label.

   02 names both county programs because its location is both counties:
   "recertification" alone is Miami-Dade's word. For the same reason its
   deliverable is "the complete package the county asks for" and not a list:
   the two counties ask for different packages, and each is on its own
   program's page. 03 is no longer called a "milestone" inspection — in both
   counties the milestone inspection is met through the county program,
   which is profile 02. */
export const engagements: Engagement[] = [
  { n: '01', title: 'Mid-rise residential frame', projectType: 'Residential — new construction', location: 'Miami-Dade or Broward', scope: 'Full structural design: gravity and lateral systems, foundations, detailing', structuralSystem: 'Reinforced concrete flat plate with shear-wall core', deliverables: 'Structural drawing set · Calculations · General notes', status: 'Typical engagement' },
  { n: '02', title: 'Condominium recertification or BSIP inspection', projectType: 'Existing building — county program', location: 'Miami-Dade or Broward', scope: 'Notice review, structural and electrical inspection, the reports on the official forms, repair scope, reinspection', structuralSystem: 'Reinforced concrete frame with cantilevered balconies', deliverables: 'The complete package the county asks for, on its official forms · Photographic record · Repair scope', status: 'Typical engagement' },
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
  /* Nothing from this block renders today. The code-name grid that used to
     sit here was the "Codes & Standards" band Juan rejected — do not bring it
     back. The sealing statement below is switched off: the owner asked on
     October 7, 2026 that the site not say who signs, and this sentence names
     the signer. The flag stays so the About page keeps one switch for it. */
  sealedDeliverables: false,
  sealingStatement:
    'Deliverables are signed and sealed by Juan Tercero, PE., M.Sc., Florida-licensed Professional Engineer, where the scope of work requires it.',
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
    /* Verified in the Florida DBPR registry on October 6, 2026: Professional
     Engineer 105256, "Current, Active", expires 02/28/2027. The registry has
     no stable per-licence URL, so the link opens its search page. */
  license: {
    number: 'PE 105256',
    url: 'https://www.myfloridalicense.com/wl11.asp?mode=0&SID=&brd=&typ=',
  } as { number: string; url: string } | null,
  linkedin: null as string | null,
  /** Home teaser: two sentences. */
  /** Home-teaser headline: the promise. The teaser names the engineer on its
      plate, beside this line — the headline itself still names no one. */
  teaserTitle: 'One engineer is responsible for the whole project.',
  /* No phone is published, so "first message", not "first call"; and the
     promise is the scope we deliver, not what gets built. */
  teaser:
    'Every project at Tercero Tablada Civil and Structural Engineering Inc. is led by one engineer, from the proposal to the final report. You deal directly with the engineer from your first message, and the scope you approve in the proposal is the scope we deliver.',
  bio: [
    'Juan Tercero is a Florida-licensed Professional Engineer and the founder of Tercero Tablada Civil and Structural Engineering Inc. A civil engineer by training (National University of Engineering) with a Master in Construction Project Management from the Universidad de Barcelona, he leads every engagement personally — from the first conversation with an owner, board or architect to the sealed drawing set or the submitted report.',
    'The practice covers both halves of structural work in South Florida: the design of new reinforced-concrete buildings, and the evaluation, recertification and repair of buildings already standing. Both are done with the same discipline — the reasoning behind every conclusion is written down, and nothing leaves the office that has not been checked line by line.',
  ],
  education: [
    'Master in Construction Project Management — Universidad de Barcelona',
    'Civil Engineer — National University of Engineering',
    'Licensed Professional Engineer (P.E.), State of Florida',
  ],
  focus: [
    'Miami-Dade recertification, Broward BSIP inspections and condition assessments',
    'Reinforced-concrete design for houses, mid-rise and commercial frames',
    'Structural BIM modeling and multi-discipline coordination',
    'Wind and lateral design for the High-Velocity Hurricane Zone',
  ],
  approach:
    'I would rather explain a structural decision in plain language than hide it behind a code reference. A board should be able to read a findings report and know what to do next; a contractor should be able to build from the drawing without calling; and a reviewer should be able to follow the calculation from load to detail.',
  forYou: [
    { k: 'Direct communication', v: 'You talk to the engineer who is doing the work — not to an account manager relaying questions.', teaser: 'Your questions go straight to the engineer on your building.' },
    { k: 'A scope you can read', v: 'Every proposal states what is included, what is not, what you receive and what it costs, before anything starts.', teaser: 'What is included, what is not and what it costs, in writing before work starts.' },
    { k: 'One engineer’s judgment', v: 'The engineer who studies your building or sets the design basis is the one who answers for the result, to you and to the reviewer.', teaser: 'The engineer who studies your building is the one who answers for the result.' },
  ],
  /** Rendered as facts on the typographic plate while there is no portrait. */
  plate: [
    { k: 'Name', v: 'Juan Tercero, PE., M.Sc.' },
    { k: 'Licensure', v: 'Professional Engineer, Florida' },
    { k: 'Role', v: 'Principal Engineer · Founder' },
    { k: 'Practice', v: 'Tercero Tablada Civil and Structural Engineering Inc.' },
    { k: 'Region', v: 'Miami-Dade & Broward' },
  ],
} as const;

/* THE H1 OF A PAGE NAMES WHAT THE PAGE IS ABOUT, AND WHERE, in plain words —
   here and on Services, Existing buildings and Typical engagements below. It
   is what a search engine, a link preview and a screen-reader user listing
   the headings take the page to be, and the line each of these four pages
   used to open with was a slogan that named neither ("A structural practice
   built around one accountable engineer.").

   The slogan is not gone: it opens `sub`, word for word, right under the
   H1, so the voice is still the first sentence read. Keep it there.

   `accentWord` stays one short phrase — it is set not to wrap (mp.css), so
   a long one runs off a phone screen. The two counties are never the
   accent: it would have to pick one of them. */
export const aboutPage = {
  eyebrow: 'About the practice',
  /* The H1 names the firm: "A South Florida structural engineering practice"
     said the same three words as the home page's headline and named neither
     the firm nor the engineer this page is about. The line under it opens
     with what is particular to the practice instead of repeating the H1. */
  titleLines: ['Tercero Tablada: a structural', 'engineering practice in South Florida.'],
  accentWord: 'Tercero Tablada',
  sub: 'Built around one accountable engineer. Tercero Tablada Civil and Structural Engineering Inc. designs new reinforced-concrete buildings and evaluates the ones already standing, across Miami-Dade and Broward — with the reasoning behind every conclusion written down and one Florida Professional Engineer responsible for all of it.',
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
  /* The subject and the place; the old H1 opens `sub` (see `aboutPage`). */
  titleLines: ['Structural engineering services', 'in Miami-Dade and Broward.'],
  accentWord: 'services',
  /* Existing buildings first — in the sub-line, the facts and the tracks —
     because the page now opens with them. The counts follow the `services`
     array (four and four); change them together. */
  sub: 'Organized by what you need, not by what we do. Eight services in two tracks. If you own or manage a building that is already standing, start with existing buildings. If you are building something, start with new projects. Each service says when you need it, what is included, what you receive and what to do next.',
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
  /* The subject and the place; the old H1 opens `sub` (see `aboutPage`).
     There it took the place of "…for buildings already in service", which
     said the same thing at the end of the list — so the lede is no longer
     than it was, and this page's two buttons stay where they were on a
     phone. */
  titleLines: ['Existing buildings', 'in Miami-Dade and Broward.'],
  accentWord: 'Existing',
  sub: 'The building is already standing. Miami-Dade recertification, Broward’s Building Safety Inspection Program (BSIP), milestone inspections, structural assessments and repair design. We document what is actually there, explain what it means structurally, and define the work that follows.',
  facts: [
    { k: 'For', v: 'Associations, owners, managers' },
    { k: 'Coverage', v: 'Miami-Dade & Broward' },
    { k: 'Output', v: 'Reports, repair scopes, reinspections' },
  ],
  /* THE HUB: four situations, each with the service that answers it.
     This page used to print the four existing-building services as the very
     cards /services prints — same summary, same four rows — under a list of
     four "moments" that led nowhere. The two are now one section: a card per
     situation, in the reader's words, with a line written for THIS page and
     one door, the service named by its `shortTitle`. The full cards live on
     /services only.

     One item per existing-building service, in the `services` order, so the
     grid closes on a straight edge (`slug` picks the photograph and the
     link). What a line may say: what the service's own page already says,
     shorter. No age, no day count and no deadline — "the program's page
     gives the ages and the deadline" is how a line points at them. */
  triggers: {
    eyebrow: 'When to call',
    title: 'Four moments that need an engineer.',
    lede: 'Find the one that is yours. Each leads to the service that answers it.',
    items: [
      { slug: 'building-recertification', k: 'A notice arrived in Miami-Dade.', v: 'That is Miami-Dade’s building recertification. Send us the letter: one team delivers the complete package the county asks for — structural, electrical and the certificates that go with them — from the first visit to the report that closes it. The program’s page gives the ages and the deadline that apply.' },
      { slug: 'broward-bsip', k: 'A notice arrived in Broward.', v: 'That is the Building Safety Inspection Program, the BSIP, and your city’s letter sets its own date. We start from that letter and deliver the whole package — the structural and electrical inspections, the written report and the program’s official forms — through to close-out.' },
      { slug: 'milestone-inspections', k: 'The board asks whether the milestone law reaches the building.', v: 'The state law and the county programs overlap. We tell you which rules reach your building and how they are met in your county — and we inspect when no notice has come but a purchase, a lender or visible distress gives a reason to look.' },
      { slug: 'structural-condition-assessments', k: 'A report lists repairs, or something worries you.', v: 'Before contractors price anything, an engineer says which conditions affect the structure and defines the repair, so every bid answers the same scope. The same assessment serves before you buy a building or alter one.' },
    ],
  },
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
     county without a door.

     This block speaks of BOTH counties at once, so it says "the complete
     package each county asks for" and names no certificate: Miami-Dade's
     parking-lot certifications and thermography are not Broward's (see the
     header, October 7, 2026). The lede used to end "We run the structural
     side". */
  timeline: {
    eyebrow: 'Recertification & BSIP',
    title: 'A clear path from the notice to close-out.',
    lede: 'Miami-Dade calls it building recertification; Broward calls it the Building Safety Inspection Program. The ages and the deadlines are different, and each county’s are on its own page. The sequence is the same: the report is filed first, repairs follow under permit, and a final report closes the file. One team delivers the complete package each county asks for, so the board makes one call and knows what happens next at every stage.',
    cta: { href: '/services/building-recertification', label: 'Miami-Dade Recertification in Detail' },
    ctaSecondary: { href: '/services/broward-bsip', label: 'Broward BSIP in Detail' },
    steps: [
      { n: '01', title: 'Notice review', detail: 'We read the notice and the building record, confirm what the Building Official is asking for, and set the schedule against the date on the letter.' },
      { n: '02', title: 'Inspection', detail: 'Inspection on site, structural and electrical — the frame, slabs, balconies, roof and exposed foundations, and the building’s electrical systems — documented in the field, with photographs tied to their locations.' },
      { n: '03', title: 'Report filed', detail: 'The reports, structural and electrical, go on the official forms the county requires, in language a board can act on, and are filed even when they list repairs.' },
      { n: '04', title: 'Repairs under permit', detail: 'Where repairs are required we define what must be corrected and to what standard, so the work can be bid fairly. Work that needs a permit waits for it.' },
      /* Its own sentence: this step used to be, word for word, the
         Miami-Dade page's step five. */
      { n: '05', title: 'Reinspection', detail: 'When the work is finished we return to the repaired areas and record them against what the first report found.' },
      { n: '06', title: 'Close-out', detail: 'An amended report — in Broward, with a signed and sealed completion letter — states that the repairs are complete. The file then stays closed until the next cycle.' },
    ],
  },
} as const;

export const workPage = {
  eyebrowReal: 'Selected work',
  /* One label for the profiles everywhere (hero, section, status): they are
     typical engagements, not past jobs, and nothing here says "anonymized". */
  /* The subject, and NO place; the old H1 opens both subs (see
     `aboutPage`). "Typical" is in the H1 for the reason it is in the nav
     label and the page title: rewrite the three together on the day there
     are real case studies.

     It read "…in South Florida." for half a day. With the place in this H1
     and in the page title, the on-page check listed /projects and the home
     page as competing for "South Florida" — and the home page is the one
     that should be found for it. So the H1 says what the page holds: the
     profiles, one per type of project ("Project type" is the first row of
     each). The place is still in the sub and in the Coverage fact; never a
     single county — the profiles must not read as jobs done in one. */
  titleLines: ['Typical structural engagements', 'by project type.'],
  accentWord: 'Typical',
  subReal: 'The frame behind the project. Structural engagements across South Florida — the building, the problem, the scope, our role and the documented result.',
  subRepresentative:
    'The frame behind the project. Typical engagement profiles: the structural system, the scope and the documents each kind of work produces. They describe what the firm takes on in South Florida, not specific past projects. Named case studies are published only with client permission.',
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
  /* The section under the form. /contact used to close with the home page's
     "Engineered for this coast" block, word for word — five blocks of text on
     two pages, and nothing in them for someone about to write. This is that
     reader's block: what to send, what comes back, the other ways in.

     Every sentence restates something the site already says elsewhere (the
     two programs' `ctaNote` and steps, `reach`, the principle "A scope you
     can read") in words of its own, so no block is shared with another page.
     NO number here: no age, no day count, no phone number (the page prints
     it from `contact.phone`), no office hours, no price. "Usually" is the
     owner's word for the reply time — see `reach`. */
  before: {
    eyebrow: 'How it works',
    title: 'What to send, and what happens next.',
    items: [
      { k: 'If you have the notice', v: 'A photo of the letter taken with your phone is enough to start. Attach it to the form above or send it by WhatsApp; there is no need to scan it or to type out what it says. What we look for first is which office sent it and the dates it gives.' },
      { k: 'If no notice has come yet', v: 'Send the address of the building and one date: in Miami-Dade, the year it was built; in Broward, the year of its certificate of occupancy. Each county counts a building’s age from that record, so with it we can tell you what applies to yours before a letter arrives.' },
      { k: 'For any other building or project', v: 'Say what the building is, where it is and what you need: an assessment, a repair design, the structure of a new building, or a second look at a design by others. Drawings, photographs and earlier reports are welcome, and none of them is required.' },
      { k: 'After you send it', v: 'When there is a notice, the engineer first reads what your Building Official is asking for. The answer is a set of questions or a written proposal that says what the work includes, what it leaves out, what you will receive and what it costs. Nothing begins until you have agreed to it.' },
      { k: 'By phone, WhatsApp or email', v: 'The form is not the only way in. Call the number on this page, write to it on WhatsApp and send the photo of the notice there, or put the same details in an email.' },
      { k: 'Where, and in which language', v: 'We work in Miami-Dade and Broward, in every city of both counties — from Miami, Hialeah and Coral Gables to Fort Lauderdale, Hollywood and Pompano Beach. Tell us the city, or that the building is outside city limits: that decides which office sends the notice and receives the report. The form and this site are in English and in Spanish; write in whichever is easier for you.' },
    ],
  },
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

/* THE PRIVACY PAGE WHILE GOOGLE ADS MEASUREMENT IS ON.

   `ADS.on` (ads.ts) is the one flag: the same value that makes the public
   shell print the script makes `legal.privacy`, below, print this text in
   place of the sentence that says the public pages set no cookies. Off — the
   state the site is in until the four variables are set — nothing here is
   printed and the page reads as it always has.

   Every statement was read against the tag itself, in a browser: on October
   7, 2026 with a test ID, and again on October 8 with the firm's own ID and
   the tag in its frame (ads.ts, "WHERE THE TAG RUNS"). Who gets it (a
   visitor whose landing address carries gclid, gbraid or wbraid, or who
   still holds a click cookie); what is loaded
   (www.googletagmanager.com/gtag/js); what is stored (cookies `_gcl_au`,
   `_gcl_aw` / `_gcl_ag` / `_gcl_gb`, `_gcl_gs`, local storage `_gcl_ls`,
   and Google's own `GCL_AW_P` on its three domains); what is sent and when
   (www.google.com/ccm/collect on each full page load, with the page's
   address, the click identifier and the `_gcl_au` number; on a conversion,
   www.googleadservices.com/pagead/conversion and /ccm/conversion and
   googleads.g.doubleclick.net/pagead/viewthroughconversion, with those plus
   the address of the page the visitor is on, the label, the screen size and
   the browser's client hints; none with the page's title, which the tag's
   frame does not have, and none with anything from the form). Google's own
   cookie was written on a
   gclid landing and not on a gbraid or wbraid one, hence "can". The 90 days are
   Google's published figure and the expiry the cookies were written with;
   the sentence prints it from ADS_COOKIE_DAYS. "Not used to personalize ads
   or to add you to remarketing lists" is what Google documents for the two
   settings the script applies (allow_ad_personalization_signals: false and
   restricted_data_processing: true). Sources are cited in ads.ts.

   "WHAT YOU WRITE IN THE FORM IS NOT PART OF IT" IS KEPT TRUE BY WHERE THE
   TAG RUNS, NOT BY A SETTING. With "Enhanced conversions" on in the Google
   Ads account — and this account had it on from its first day — the tag
   reads the e-mail field of the document it runs in: on October 8, 2026,
   with the tag in the page, it sent that address hashed, whatever the
   script asked. The tag is now loaded in a frame that holds no form
   (ads.ts), and the paragraph says so. If the tag ever goes back into the
   page, the sentence is false again that same day: ads.ts describes the
   check to run before and after any change.

   Same rules as the rest of `legal` (see the comment inside it): what the
   code does, in plain words — no claim of compliance, no retention period of
   the firm's own, and no link out (Google's pages are named as text; the
   site links six outside hosts and pages.test.ts keeps that list).
   The Spanish twin is `privacyAds` in site.es.ts; views/ads-pages.test.ts
   reads both, in both states of the switch. */
const privacyAds = {
  h: 'Cookies, analytics and advertising',
  /* Opens "What we collect" in place of "The only": with measurement on,
     the form is no longer the only thing that records anything. */
  collect:
    'Apart from what Google’s advertising tag records when a visitor arrives from one of our ads (described under “Cookies, analytics and advertising” below), the only',
  p: [
    'The public pages of this site run no analytics and no social-media scripts, and the form uses no outside verification service (CAPTCHA). Their scripts, fonts, photographs and video are served from this site’s own address, with one exception, which is also the only case in which these pages set cookies: a visitor who arrives by clicking one of our Google ads.',
    'An ad’s link carries a click identifier that Google adds to the address it opens. Only when the address you arrive at carries one do these pages load Google’s advertising tag, a script served from googletagmanager.com. A visitor who comes from an ordinary search result, from another link or by typing the address is not given the tag, unless an earlier visit through an ad left the cookies described next. We use it for one thing: to know which ad led to a call, a WhatsApp chat or a request sent through the form.',
    `The tag keeps the click identifier and a random number in your browser: in cookies under this site’s address whose names begin with “_gcl_”, and in one entry of the browser’s local storage. Google can also set a cookie of its own, carrying the same identifier, on its advertising addresses (google.com, googleadservices.com and doubleclick.net). The cookies are set to expire after ${ADS_COOKIE_DAYS} days, and your browser may shorten that. While they last, the tag is loaded again whenever you return to these pages.`,
    'Each time one of these pages is loaded in full, the tag sends Google the click identifier, the random number and the address of the page. When you tap a phone link, open the WhatsApp link or send the form, it sends them again with the address of the page you are on, a label that says which of the three happened and technical details of your browser and device, such as their versions and the screen size. As with any request a browser makes, Google also sees your internet address (IP). What you write in the form is not part of it: the tag runs in a frame of its own, apart from the page and its form, and we do not pass it your name, email address or phone number, your description or files, or the reference of your request.',
    'We have switched off, in the tag’s own settings, the use of these events to personalize ads and to build remarketing lists. Google receives them as the company that runs the ads and handles them under its own privacy policy and terms, which we do not control. To remove what the tag stored, clear this site’s cookies and site data in your browser; after that the tag is not loaded again unless you arrive from another of our ads. Google’s own controls for the ads it shows you are at myadcenter.google.com.',
  ],
};

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
  /* `title` is the page's short name: the breadcrumb, the section label and
     (in `links`, above) the footer. `h1` is the page's headline, which says
     what the policy covers. "Privacy Policy" and "Terms of Use" alone were
     14 and 12 characters, which the on-page check reports as too short to
     describe a page.

     A section's `p` is one paragraph, or a list of them (LegalView prints
     either). `contact` is the sentence that leads to the e-mail address
     under "Contact": each document has its own, because the two pages used
     to end in the same block of text.

     WHAT MAY BE WRITTEN HERE. Each statement about data describes what the
     code does, and was read against it on October 7, 2026: the fields the
     form sends (ContactForm.tsx), what the route stores and e-mails
     (api/contact/route.ts), where a file goes and when (ContactForm.tsx,
     api/contact/upload/route.ts, contact-attachments.ts), what a deletion
     removes (api/admin/submissions/route.ts), the request counter
     (rate-limit.ts), and that the public pages set no cookie and load
     nothing from another address (PublicShell.tsx, proxy.ts, package.json —
     and media.tsx for the one item kept in the browser). Change the code
     and these sentences have to follow; add analytics and "Cookies and
     analytics" is no longer true.

     ONE CHANGE IS ALREADY WIRED IN: Google Ads conversion measurement
     (ads.ts). While it is off, the page is the text below. When its
     variables are set, the same flag that prints the script swaps two
     things here — the opening of "What we collect", and the first paragraph
     and the heading of "Cookies and analytics" — for `privacyAds`, above.
     The terms of use need no twin: nothing in them speaks of cookies,
     scripts or advertising, and the Privacy text names Google's pages
     without linking them.

     What is NOT here, because only the owner can decide it: a governing law
     or venue, arbitration, a retention period in days, a deadline to answer
     or delete, a named privacy officer, a claim of compliance with any
     statute, a cap on liability, and which language version prevails. */
  privacy: {
    title: 'Privacy Policy',
    h1: 'Privacy Policy for This Website',
    sub: 'What we collect through this website, why we collect it, and what we do with it.',
    sections: [
      { h: 'What we collect', p: [
        `${ADS.on ? privacyAds.collect : 'The only'} personal information this website collects is what you submit through the proposal request form: your name, email address, optional phone number and company, the service you selected, the building address or project location, the description you write and any files you attach. With the request we also record which page of this site you arrived on and the address of the page that linked you here, so we know how people find us.`,
        'The form does not ask for payment details, personal identification numbers (a Social Security or driver’s license number, for example) or passwords, and a proposal does not need them. Please leave them out of your description and of the files you attach.',
      ] },
      { h: 'Why we collect it', p: 'We use it to respond to your request and to understand the engineering scope you are asking about. We do not sell it, rent it, or share it for advertising.' },
      { h: 'How it is stored', p: [
        'Submissions are stored in our project database and attachments in cloud file storage at an address that is never published or linked; a notification is emailed to the office through a transactional email provider so that we see your message, and a confirmation is emailed to you. Access is limited to the people who need it to reply to you.',
        'The notification that reaches the office carries the text of your request and a link to each file, not the files themselves. The confirmation sent to you gives a reference and names the service you chose; it never repeats what you wrote.',
        'To keep the form from being abused, the server counts how many requests arrive from one internet address (IP) over a short time. That count is held in memory and is not saved with your request. The site is delivered over an encrypted connection (HTTPS).',
      ] },
      /* Accurate to CONTACT_BLOB_ACCESS = 'public' (contact-attachments.ts):
         the address is secret, not locked. Say "private" here only on the
         day the store is. */
      { h: 'Files you attach', p: 'A file is uploaded when you add it to the form, before you send the request, and goes directly from your browser to the storage provider. It is kept at a long, random address that is not published or linked anywhere. Anyone who has that address can open the file, so we do not give it out: the office opens attachments from its own signed-in inbox. If you remove a file, or leave the page without sending, the copy already uploaded is attached to no request; write to us if you want it deleted.' },
      { h: 'How long we keep it', p: 'Requests are retained while they are commercially relevant and for as long as any resulting engagement requires. You may ask us to delete your request and its attachments at any time. When a request is deleted, the files attached to it are deleted from storage with it.' },
      /* The heading and the first paragraph are the ones that change with
         Google Ads measurement (`privacyAds`, above); the other two are true
         either way. */
      { h: ADS.on ? privacyAds.h : 'Cookies and analytics', p: [
        ...(ADS.on ? privacyAds.p : [
          'The public pages of this site set no cookies and run no analytics, advertising or social-media scripts. Their scripts, fonts, photographs and video are served from this site’s own address, and the form uses no outside verification service (CAPTCHA).',
        ]),
        'One preference is kept in your browser and is never sent to us: if you pause the background video, the site remembers it so that the video stays paused on the next page.',
        'Cookies may be used by the authenticated project-management area of this domain for sign-in purposes; those are strictly necessary to keep a session active and are not used to profile visitors to the public site.',
      ] },
      { h: 'Links that leave this site', p: 'Calling us, writing by WhatsApp and following a link to a county office, to the state license search or to another official source all happen outside this website. What you send or do there is handled by that service under its own privacy terms, which we do not control. The WhatsApp link opens a chat with a first line already written; nothing is sent until you send it.' },
      /* True of BeamCalculator.tsx: it makes no request with what is typed
         (the steel shape table is a static file of this site), and keeps the
         case in the fragment of the address, which no browser sends. Read
         against the code on October 10, 2026; a calculator that saves or
         sends anything makes this false. */
      { h: 'Calculators', p: 'The calculators under Resources do their work in your browser. The values you enter are not sent to us and are not stored by us. A calculator keeps them in the address of the page, after the # sign, which is the part of an address a browser does not send: that is how a reload, or a link you copy, opens the same case. Whoever you give that link to sees the values in it.' },
      { h: 'Your choices', p: 'You can ask us what we hold about you, ask for it to be corrected, or ask for it to be deleted. Write to the address below and we will respond. Tell us the email address you used on the form and, if you kept it, the reference from the confirmation: that is how we find your request.' },
      { h: 'Changes', p: 'If this policy changes we will update it on this page.' },
    ],
    contact: 'Questions about this policy, or a request about your own information, go to',
  },
  terms: {
    title: 'Terms of Use',
    h1: 'Terms of Use for This Website',
    sub: 'The basis on which the information published here is provided.',
    sections: [
      { h: 'General information only', p: 'The content on this website describes services in general terms. It is not an engineering opinion, a recommendation for a specific building, or a substitute for a site-specific evaluation. Nothing here should be relied on as the basis for a construction, repair or compliance decision.' },
      { h: 'No professional relationship', p: [
        'Visiting this site, reading it, or submitting the proposal request form does not create a professional engineering relationship. An engagement begins only when scope, fee and terms are agreed in writing.',
        'The same is true of a call, an email or a WhatsApp message, and of a notice sent by any of them: we read it and reply, and nothing is under way until you have accepted a written proposal. Asking for a proposal is free and commits you to nothing.',
      ] },
      /* That only the issuing office grants time is what both programs' own
         pages say ("it is the Building Official who grants it"). No day count
         here: those live in the timing rows. */
      { h: 'Notices and deadlines', p: 'Sending us a notice does not pause or extend the deadline it states. An extension is for the Building Official who issued the notice to grant, not for us. If anything on this site differs from the letter you received, go by the letter and by the office that sent it.' },
      { h: 'Regulatory outcomes', p: 'Requirements for inspection, recertification and permitting vary by jurisdiction, building age, construction type and scope. Ages and deadlines published here were verified on the date stated next to them and can change. Each table names the office or the code its figures come from, so you can read the source yourself. Descriptions of any process on this site are typical sequences, not guarantees. We do not promise approval by any building department or reviewing authority.' },
      { h: 'Sealed documents', p: 'Where a signed and sealed document is required, it is issued as a formal deliverable under an agreed scope of work. Content on this website is never a sealed deliverable.' },
      { h: 'Accuracy and availability', p: 'We keep this site current, but do not warrant that every statement is complete or free of error, or that the site will always be available. The reply time mentioned on this site is what is usual, not a commitment.' },
      { h: 'Links to other sites', p: 'This site links to county offices, to the Florida DBPR’s license search, to statutes and codes, and to WhatsApp. Those pages belong to whoever publishes them and are outside our control: they can change or move, and what they say and how they handle your information is theirs to answer for. City building offices are named, not linked; under each list of them we print the date the names were last checked.' },
      { h: 'Photographs and examples', p: 'The photographs and video on this site are licensed images that show kinds of buildings and of work. None of them shows a project of the firm, and none was chosen because a building in it received a notice. The profiles under Typical Engagements describe the work the firm takes on; they are not past projects.' },
      /* What each calculator page says of itself under "Before you rely on
         it", said once for all of them. No cap on liability and no warranty
         clause: those are the owner's to decide (see above). */
      { h: 'Calculators', p: 'The calculators under Resources are working aids for engineers and students. Each one states on its own page the method it uses, what it assumes and what it leaves out, and a result is only as good as the model and the values entered. Check it by independent means before you rely on it. A result is not a design, an engineering opinion or a sealed document, and using a calculator does not make us the engineer of your project.' },
      /* The site has no drawings, and every photo and video is licensed stock. */
      { h: 'Intellectual property', p: 'The text and the firm’s name and logo on this site belong to Tercero Tablada Civil and Structural Engineering Inc. and may not be reproduced without permission. Photographs, video and third-party software marks belong to their respective owners (see Image Credits).' },
    ],
    contact: 'Questions about these terms go to',
  },
  contactHeading: 'Contact',
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   BUNDLE — everything a page needs, typed once and mirrored in site.es.ts
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The ways to reach the engineer without filling in the form, and the two
 * facts the owner supplied on October 6, 2026 that sit next to them: the
 * proposal costs nothing, and a reply usually comes within two hours.
 * "Usually" is his word ("más o menos") — do not sharpen it into a promise.
 * The number itself lives in `contact.phone` / `contact.whatsapp`.
 */
export const reach = {
  /** aria-label of the bar on phones. */
  label: 'Contact the engineer',
  call: 'Call',
  whatsapp: 'WhatsApp',
  whatsappNotice: 'Send the notice by WhatsApp',
  form: 'Send the notice',
  /* Prefilled in the WhatsApp chat, so the first message already says why. */
  whatsappText: 'Hello, I received a building inspection notice.',
  free: 'The proposal is free.',
  reply: 'We usually reply within two hours.',
};

/**
 * The firm Tercero Tablada works with on recertifications: Precision Source,
 * a Florida-certified general and electrical contractor in Miami.
 *
 * What this block must keep true, whatever the wording becomes:
 *   - It is a SEPARATE company working as one team with the practice — never
 *     "our construction arm", and never a co-owner: on a licensed engineer's
 *     site "partner" can read as either.
 *   - No split of tasks is printed. The owner's call (2026-10-06): "somos un
 *     equipo" — and an earlier draft that had Precision Source doing the
 *     repair work was simply wrong. Each card says what the firm IS (its
 *     licences), not what it does on a job.
 *   - Nothing here says who signs which report. The owner's call
 *     (2026-10-06): "no es necesario que especifiques quién firma o no". A
 *     closing "Signed and sealed" line was written and removed the same day;
 *     do not bring it back, and do not add "both reports, one engineer".
 *   - "More than 30 years of combined experience" is the two firms TOGETHER,
 *     in the owner's words — never thirty years of the engineer alone.
 *   - Every license number is a link to the DBPR search (PartnerSection), and
 *     `verifyLead` says so in words, right under the cards.
 *
 * Licences verified against the Florida DBPR registry on October 6, 2026:
 * both "Current, Active", expiring 08/31/2028, and the only "Precision
 * Source" the registry holds. Re-check before that date.
 */
export const partner = {
  eyebrow: 'Who we work with',
  kicker: 'Two licensed firms',
  title: 'One team on your building.',
  lede:
    'We carry out Miami-Dade recertifications and Broward BSIP inspections together with Precision Source Inc., a Florida-certified general and electrical contractor based in Miami. Two licensed firms working as one team, from the notice to the final report, with more than 30 years of combined experience between them.',
  licensesLabel: 'Florida licenses',
  /* Printed under the two cards, followed by `ui.engineer.verifyHow` (what
     to do on that page). The registry has no per-license URL, so all three
     numbers open the same search form. */
  verifyLead: 'Each license number opens the Florida DBPR’s license search.',
  /* The engineering card takes its name, engineer, P.E. number and business
     registry from `company` and `leadership` — one source for each fact. */
  engineering: {
    role: 'Structural engineering',
    licenseLabel: 'Professional Engineer',
    registryLabel: 'Engineering Business',
  },
  construction: {
    role: 'General and electrical contractor',
    name: 'Precision Source Inc.',
    place: 'Miami, Florida',
    logo: { src: '/ttc/img/partners/precision-source.png', w: 640, h: 935 },
    licenses: [
      { label: 'Certified General Contractor', number: 'CGC061867' },
      { label: 'Certified Electrical Contractor', number: 'EC13010175' },
    ],
  },
  /* THE BLOCK IS PRINTED WHOLE ON THE HOME PAGE ONLY (`title`, `lede`, the
     two cards, `verifyLead`). It used to be printed whole on /about and on
     /existing-buildings too — the same lede, cards and note on three pages,
     and the first two entries of the on-page check's list of repeated text.
     Each of the other two pages now has a shorter block with a job of its
     own, in its own words, and every rule above still holds in both.

     `about` — /about, the page a board opens to check who the firms are:
     what each company IS, and the four registrations as one list. The three
     license numbers are still links to the DBPR search, as on the home page
     (the owner asked that both pages keep them); how to use that search is
     already printed on /about, under the engineer's own license.

     `brief` — /existing-buildings, right after the six steps: who the
     reader deals with while they run, and a link to the list on /about.
     It restates the one verified figure in a sentence of its own; the
     sentence the owner approved stays on the home page, in `lede`. */
  about: {
    title: 'Two firms, each under its own license.',
    body: 'On Miami-Dade recertifications and Broward BSIP inspections we work as one team with Precision Source Inc., a separate company: a Florida-certified general and electrical contractor based in Miami. Together the two firms have more than 30 years of combined experience. The three license numbers below open the state’s license search, where you can check them yourself.',
  },
  brief: {
    title: 'Two licensed firms, one team.',
    body: 'From the notice to close-out you deal with one team: this practice and Precision Source Inc., a Florida-certified general and electrical contractor in Miami that works with us on recertifications and BSIP inspections. Between the two firms: more than 30 years of combined experience.',
    link: { href: '/about#contractor', label: 'Both firms and their licenses' },
  },
};

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
  partner,
  reach,
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
