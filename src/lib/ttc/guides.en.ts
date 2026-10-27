import type { Guide, GuideLabels, GuidesIndex } from './guides';

/**
 * The guides in English. Read the header of guides.ts before editing: no
 * number typed (the rows print them), nothing about who signs, no fee, no
 * promise about an office, and no block of six words that another page of
 * the site already prints (guides.test.ts). Spanish twin: guides.es.ts,
 * same slugs, same sections, same questions, in the same order.
 */

export const labels: GuideLabels = {
  eyebrow: 'Guide',
  reviewed: 'Last reviewed',
  rowsOf: (jurisdiction) => `From the ${jurisdiction} row`,
  factLabel: (county, label) => `${county} — ${label}`,
  questionsLabel: 'Questions',
  more: 'Where to go from here.',
  addressCta: 'Send the Address',
  costLink: 'What the work costs',
  allGuides: 'All guides',
  forProgram: 'Guides for owners',
  shortLabel: 'The short answer',
  serviceLabel: 'The service behind this guide',
  proposalCta: 'Request a Proposal',
};

export const index: GuidesIndex = {
  seo: {
    title: 'Guides for Building Owners in Florida',
    description:
      'Plain answers for Florida building owners and boards: county notices, milestone and threshold rules, balcony repairs, buying a building and peer review.',
  },
  crumb: 'Guides',
  eyebrow: 'Guides',
  /* The six services, for the whole state (2026-10-26): the guides were the
     two county programs' alone, and the title said so. */
  titleLines: ['Guides for Florida’s', 'building owners.'],
  accentWord: 'building owners.',
  sub: 'Short, plain answers to the questions owners, boards and managers ask — a county notice, the milestone law, a tall building, a cracked balcony, a purchase, a design to review — each one leading to the service that answers it.',
  listLabel: 'The guides',
  listTitle: 'Pick the question you have today.',
  groups: [
    { label: 'Recertification & BSIP', lede: 'The two county programs: the letter, the clock it starts, the names owners use, and what happens when a report lists repairs.', services: ['building-recertification', 'broward-bsip'] },
    { label: 'Milestone inspections', lede: 'What the state law asks of a condominium or co-op board, and how the county report answers it.', services: ['milestone-inspections'] },
    { label: 'Threshold buildings', lede: 'When height or a large assembly room puts a building past the threshold, and what the county asks for then.', services: ['threshold-inspections'] },
    { label: 'Assessments & repairs', lede: 'Cracks, spalling, and a building you are about to buy: what to look at, and when an engineer should look with you.', services: ['structural-condition-assessments'] },
    { label: 'Peer review', lede: 'When a structural design needs an independent second read before the permit, and what that read covers.', services: ['peer-review'] },
  ],
  howLabel: 'Your letter',
  howTitle: 'Your letter sets the date. Send it, and we read it for you.',
  /* Three short paragraphs where there were five (2026-10-26): the
     programs, what to send, what follows. */
  how: [
    'Miami-Dade and Broward each run a program of their own — its own ages, its own clock, its own forms — and a date missed in either one goes to the county’s enforcement. A rule from one county never applies to a building in the other.',
    'Send a phone photo of the notice and we tell you which program it belongs to, what the office wants and by when, with a fixed-fee proposal for the complete package. No letter yet? Send the address instead, and we read the record the county counts the building’s age from.',
    'Once the proposal is approved, the inspection is booked for a day the building can be opened, and the complete package follows three to four days after that visit, or one to two when the date is close. A report that lists repairs still goes in on time.',
  ],
};

export const guides: Guide[] = [
  /* ── 1. The notice ─────────────────────────────────────────────────── */
  {
    slug: 'recertification-notice',
    service: 'building-recertification',
    programs: ['building-recertification', 'broward-bsip'],
    seo: {
      title: 'Got a Recertification Notice? What to Do First',
      description:
        'A recertification or BSIP notice arrived in Miami-Dade or Broward. The first five things to do, the clock it starts, and what to send an engineer.',
    },
    name: 'Got a notice? First steps',
    h1: 'You received a recertification notice. Here is what to do first.',
    heroSub:
      'A letter from your building department starts a clock. Read it the same day, then follow these five steps — in Miami-Dade or in Broward.',
    card: 'For the board or owner holding the letter today: the first five steps, in order, and the clock it starts.',
    short: ["This letter starts your county’s deadline to file, which Broward counts from the day the letter is received.", "The week it arrives, get the letter to an engineer, even as a phone photo, with any drawings and past reports.", "The report goes in on time even when it lists repairs, and the repairs follow afterward under permit."],
    sections: [
      {
        title: 'First, read what the letter actually says',
        paras: [
          'The notice is short and written for the office that sends it, not for the owner who opens it. Before anything else, find three things on it: which office sent it, the date on the letter or the date your building received it, and the date by which the office expects the report.',
          'In Miami-Dade the program is the county’s building recertification, and the letter comes from your city’s building office, or from the county where the building is in an unincorporated area. In Broward the program is the Building Safety Inspection Program, the BSIP, and the letter comes from your city’s Building Official. Owners call both of them “the 40-year recertification”, a name left over from older rules — the clock on the letter is the current one.',
        ],
        list: [
          'Who sent it: the office named in the letterhead is the office the report goes back to.',
          'When it arrived: keep the envelope. In Broward the time to file counts from the day the notice is received.',
          'The date it sets: where your city states a date of its own, that is the date to plan around.',
        ],
      },
      {
        title: 'How much time the notice gives you',
        paras: [
          'The two counties run different clocks, and they must never be read against each other. Below is the time each county’s rules give to file the report, as verified on the county program pages; the time for repairs that follow is in the guide on failed recertifications. The date printed on your own letter is the one that counts. Already past it? It can still be resolved.',
        ],
        facts: [
          { service: 'building-recertification', keys: ['Time to file'] },
          { service: 'broward-bsip', keys: ['Time to file'] },
        ],
      },
      {
        title: 'Five steps, in this order',
        paras: [
          'Most of the trouble with a recertification comes from the weeks lost at the start. Nothing on this list takes long, and every step shortens the next one.',
        ],
        list: [
          'Send the letter to an engineer the week it arrives. A photo taken with your phone is enough to get a proposal started.',
          'Find the original drawings and the last inspection report, if the building has one. They shorten the inspection and make the proposal more exact.',
          'In a condominium or co-op of three habitable stories or more, tell unit owners: state law gives the board duties of its own, listed on each county program’s page.',
          'Plan one day of access: roof, garage, electrical rooms, and the units the engineer asks to see.',
          'Put money aside for repairs before you know their size. The report is filed first; repairs, if any, come after it, under permit.',
        ],
      },
      {
        title: 'What happens after you call',
        paras: [
          'We read the letter and the building’s history, confirm what your office is asking for and by when, and reply with a fixed-fee proposal for the complete package your county asks for — the structural and electrical inspections and every document that goes with them. The inspection is scheduled around the day you can open the building.',
          'The report is filed even when it lists repairs: both counties want it first, not after the work. Where repairs are needed, the scope is written so contractors bid the same work, and an amended report closes the file once the repairs are done.',
        ],
      },
    ],
    faqTitle: 'What boards ask once the letter is open',
    faq: [
      {
        q: 'Can we wait until closer to the date on the notice?',
        a: 'You can, but it costs time you will want later. An inspection booked late leaves no room if the report lists repairs, and repairs under permit move at the pace of the permit, not of the deadline.',
      },
      {
        q: 'The letter came to the management company, not to the board. Does the clock still run?',
        a: 'Assume it does. The office sent the notice to the address it has on record for the building; pass it to the board the same day and keep the date it arrived.',
      },
      {
        q: 'Do we need anything before we ask for a proposal?',
        a: 'Only the letter. The address and the age of the building tell us which county’s rules apply; drawings and the last report help, but they are not needed to start.',
      },
      {
        q: 'Is the notice the same thing as a violation?',
        a: 'No. A notice says the building has reached the age at which an inspection is required. Enforcement only starts when the report is not filed in time.',
      },
    ],
  },

  /* ── 2. The Broward notice ─────────────────────────────────────────── */
  {
    slug: 'broward-bsip-notice',
    service: 'broward-bsip',
    programs: ['broward-bsip'],
    seo: {
      title: 'Broward BSIP Notice: What It Means, Who Files',
      description:
        'What a Broward Building Safety Inspection Program notice means, which buildings must file, which are exempt, and what the owner has to deliver.',
    },
    name: 'Broward BSIP notice explained',
    h1: 'The Broward BSIP notice: what it means and who has to file',
    heroSub:
      'A certified letter about the Building Safety Inspection Program means your building has reached inspection age in Broward. Here is what it asks of you.',
    card: 'For a Broward building that received the certified letter: what it asks of the owner, and which buildings are outside the program.',
    short: ["The certified letter means your building is on Broward’s list for this year, so it needs structural and electrical inspections.", "Almost every building type is in, and the few exceptions, such as minor structures and small homes, are listed below.", "What gets filed is a narrative report with color photos, on the county’s official forms, never a firm’s own."],
    sections: [
      {
        title: 'What the letter is',
        paras: [
          'Broward’s Building Safety Inspection Program is written for the whole county by the Broward County Board of Rules and Appeals, and each city’s Building Official runs it. Every year the Board gives each city the list of buildings that reach inspection age, and the city mails the notices by certified mail. The letter is that notice: it says your building is on this year’s list and has to be inspected, structurally and electrically, with a report filed with the city.',
          'Many owners still call it the 40-year recertification, a name from an older version of the program. The ages and the time to file changed, and older articles online still describe the earlier rules. The rows below give the ages in force; the time to file is in the guide on what to do when a notice arrives, and on the BSIP page.',
        ],
        facts: [{ service: 'broward-bsip', keys: ['First due', 'Then'] }],
      },
      {
        title: 'Who has to file',
        paras: [
          'The obligation sits with the owner of the building. In a condominium or a cooperative that means the association, acting through its board; in a rental, commercial or mixed-use building, the owner of record. A property manager can run the process, but the filing is made for the owner.',
          'Almost every type of building is in the program, in every Broward city and in the unincorporated area. The exceptions are narrow, and the row below lists them as the Board’s policy states them. Buildings owned by the federal government or the State of Florida, schools of the county school board, railroads and buildings on sovereign tribal lands are also outside it.',
        ],
        facts: [{ service: 'broward-bsip', keys: ['Applies to'] }],
      },
      {
        title: 'What has to be delivered',
        paras: [
          'Broward asks for two inspections, a structural one and an electrical one, written up as a narrative report with the Board’s own structural and electrical forms and color photographs. A firm’s own forms are not accepted in place of the Board’s.',
          'The Board’s current policy does not ask for parking-lot certificates or thermography as separate documents; guardrails and parking garages are inspected as part of the structure. Some cities add a cover sheet or a submittal form of their own, and the letter says so when they do.',
        ],
        list: [
          'Send us the letter, with the date your building received it.',
          'We read what your city asks for and reply with a fixed-fee proposal for the complete BSIP package.',
          'The report is filed as soon as it is complete, even when it lists repairs; an amended report and a completion letter close the file after them.',
        ],
      },
    ],
    faqTitle: 'Questions about the BSIP letter',
    faq: [
      {
        q: 'Does a townhouse community have to file?',
        a: 'Fee-simple townhouses are outside the program, as the “Applies to” row says. Where townhouses are owned some other way, the answer depends on the building: send us the address and we check.',
      },
      {
        q: 'Our building was inspected under the old program. Does that count?',
        a: 'Yes. A building inspected under the earlier version is treated as compliant, and the next inspection follows the interval in the “Then” row. The city’s letter states the year.',
      },
      {
        q: 'Is a BSIP notice the same as the state milestone inspection?',
        a: 'For condominium and cooperative buildings of three habitable stories or more, the BSIP report also meets the state milestone inspection, both of its phases. The board’s duties to unit owners under state law still apply.',
      },
      {
        q: 'Who answers questions about the letter itself?',
        a: 'The office that sent it. For what the inspection and the report involve, send us the letter and we read it first.',
      },
    ],
  },

  /* ── 3. Is the building due? ───────────────────────────────────────── */
  {
    slug: 'is-my-building-due',
    service: 'building-recertification',
    programs: ['building-recertification', 'broward-bsip'],
    heroAction: 'address',
    seo: {
      title: 'Is My Building Due for Recertification?',
      description:
        'How to tell whether a Miami-Dade or Broward building is due for recertification or the BSIP: the record that sets its age, the list and the letter.',
    },
    name: 'Is my building due?',
    h1: 'How to check whether your building is due for inspection',
    heroSub:
      'No letter yet, or not sure it applies to you? The age that counts is on a public record you can check yourself, and each county reads it differently.',
    card: 'No letter yet? Where the age that counts is recorded, county by county, so you can check before the notice comes.',
    short: ["First check the county, not the city, because each county takes the age from a different public record.", "Miami-Dade relies on the year built in the Property Appraiser’s file, and Broward on the certificate of occupancy date.", "If the building is at or near inspection age, send us the address, so any repairs can be planned early."],
    sections: [
      {
        title: 'Start with the county the building is in',
        paras: [
          'Miami-Dade and Broward count a building’s age from different records, so the first question is the county, not the city. A building in Aventura answers to Miami-Dade’s program; one across the county line in Hallandale Beach answers to Broward’s.',
          'Then find the age the county counts from, and compare it with that county’s rows below. If the building is past that age, or close to it, a notice is coming or already late, whether or not a letter has arrived; and if it is late, that can still be resolved.',
        ],
      },
      {
        title: 'In Miami-Dade: the year built on the Property Appraiser’s record',
        paras: [
          'Miami-Dade counts from the year built that the county Property Appraiser shows for the property. You can look the building up by address on the Property Appraiser’s public search and read that year on the property’s record. A renovation does not change it.',
          'The county’s rules ask the building office to send courtesy notices ahead of the formal one. They help, but not receiving them changes nothing: the building comes under the program because of its type and its age. The types are in the row below; the ages, in the “First due” row of the guide on the program’s three names.',
        ],
        facts: [{ service: 'building-recertification', keys: ['Applies to'] }],
      },
      {
        title: 'In Broward: the certificate of occupancy',
        paras: [
          'Broward counts from the date of the certificate of occupancy, which is in your city’s building records — not from the year the Property Appraiser shows, which can be a different year.',
          'Each year the Board of Rules and Appeals sends each city its list of the buildings that reach inspection age, and the city mails the notices by certified mail in the summer. Your city’s building office can tell you whether the building is on its list; we can read the record for you before we propose.',
          'The age Broward counts to, and the interval after it, are printed with their source in the guide on the Broward notice.',
        ],
      },
      {
        title: 'When it is not clear',
        paras: [
          'Some cases need a closer look: a property with several buildings built in different years, an addition, a building that was recertified under an earlier schedule, or one bought recently whose seller never mentioned an open file.',
        ],
        list: [
          'Send us the address and, if you have it, the year built or the date of the certificate of occupancy.',
          'Tell us whether the building was ever inspected under the program, and when.',
          'We confirm which program reaches the building and where it stands before we propose anything.',
        ],
      },
    ],
    faqTitle: 'When the age is not the whole answer',
    faq: [
      {
        q: 'We never received a letter. Can we start anyway?',
        a: 'Yes, and it is the calm way to do it. An inspection done before the notice leaves time to plan repairs instead of rushing them.',
      },
      {
        q: 'Does a single-family home need a recertification?',
        a: 'No, in either county. The rows on each county’s program page list the small residential buildings outside each program.',
      },
      {
        q: 'We are buying a building. How do we know if a recertification is open?',
        a: 'Ask the seller for the last report and any notice, and ask the city’s building office whether a file is open on the address. We can review what you receive before closing.',
      },
    ],
  },

  /* ── 4. 30 vs 40 vs 50-year ────────────────────────────────────────── */
  {
    slug: 'recertification-30-40-50-year',
    service: 'building-recertification',
    programs: ['building-recertification'],
    seo: {
      title: '30, 40 or 50-Year Recertification in Miami-Dade?',
      description:
        'Owners search for the 30-year, 40-year and 50-year recertification. In Miami-Dade they are names for one program; what each name means today.',
    },
    name: '30, 40 and 50-year names',
    h1: '“30-year”, “40-year”, “50-year”: one Miami-Dade program with three names',
    heroSub:
      'The names count the age of the building at an inspection. There is one program, Miami-Dade’s building recertification, and it repeats for the life of the building.',
    card: 'For a Miami-Dade board unsure which name applies: one program, three names owners search for, and what each one means now.',
    short: ["The names owners search for count the building’s age at one inspection, and in Miami-Dade all of them mean one program.", "The best-known name is out of date, since the first inspection is now due sooner, at the ages printed below.", "In Broward the same names point to a separate program, the BSIP, which has its own ages and deadlines."],
    sections: [
      {
        title: 'Where the names come from',
        paras: [
          'For decades Miami-Dade’s first recertification fell due at the age in its name, so owners called the program the “40-year recertification”. The name stuck, and it is still printed on letters, contracts and condominium budgets.',
          'The county has since moved the first inspection to an earlier age, and owners began to search for the “30-year recertification” too. A building already through its first inspection meets the next one later in its life, which is why some owners call that one the “50-year recertification”. Each name is the age of the building at one inspection; the program behind all three names is the same.',
        ],
      },
      {
        title: 'What the county’s rules say today',
        paras: [
          'Two rows decide it: the age at which the first recertification falls due, and the interval after that. They are printed here from the county program’s verified row, with its source.',
        ],
        facts: [{ service: 'building-recertification', keys: ['First due', 'Then'] }],
      },
      {
        title: 'What changes between the first inspection and the later ones',
        paras: [
          'Very little in the paperwork: every cycle asks for the same complete package on the county’s forms — the structural and electrical reports, and the certificates that apply to the building. What changes is what the inspection finds. A building at its first cycle often has deferred maintenance; at its later cycles, the earlier reports show what was repaired and what was left to watch.',
          'That is why the last report matters. It shows the engineer where the building stood, shortens the inspection, and lets the board see whether a condition is new or one that was already being watched.',
        ],
        list: [
          'Keep every recertification report and amended report the building has filed.',
          'Keep the repair permits and their final inspections with them.',
          'Send the most recent one with your request for a proposal.',
        ],
      },
      {
        title: 'And in Broward?',
        paras: [
          'Broward’s owners use the same names for a different program, the Building Safety Inspection Program, with its own ages and its own clock. Never read a Broward building against Miami-Dade’s rows, or the other way round.',
        ],
      },
    ],
    faqTitle: 'What owners ask about the names',
    faq: [
      {
        q: 'Is the “40-year recertification” still a thing?',
        a: 'As a name, yes: owners and lenders still use it. As a rule, the age that triggers the first inspection is the one in the county’s “First due” row.',
      },
      {
        q: 'Our building was recertified under the old schedule. Do we start over?',
        a: 'No. A building already recertified under the earlier schedule keeps the cycle it was on. Send us the last report and we confirm when the next one falls due.',
      },
      {
        q: 'Does the coastal rule apply to every building near the beach?',
        a: 'No. It reaches only the condominium and cooperative buildings the “First due” row describes; other buildings near the coast follow the general age.',
      },
    ],
  },

  /* ── 5. Milestone vs recertification vs SIRS ───────────────────────── */
  {
    slug: 'milestone-recertification-sirs',
    service: 'milestone-inspections',
    programs: ['building-recertification', 'broward-bsip'],
    seo: {
      title: 'Milestone Inspection vs Recertification vs SIRS',
      description:
        'Florida’s milestone inspection, the county recertification or BSIP, and the reserve study (SIRS): which a condo board owes, and how they fit together.',
    },
    name: 'Milestone vs recertification vs SIRS',
    h1: 'Milestone inspection, recertification and SIRS: what a condo board owes',
    heroSub:
      'Three names, two laws, one building. In Miami-Dade and Broward, the county inspection and the state milestone inspection are one report — the reserve study is something else.',
    card: 'For a condo board in either county: three names it hears, which two of them are one report, and which one plans the money.',
    short: ["When a condo or co-op has at least three habitable stories, its Miami-Dade or Broward report doubles as the milestone inspection.", "The board must still tell each unit owner about the inspection and send the engineer’s summary, within the days state law sets.", "The reserve study, or SIRS, is a separate duty that plans the money for repairs and replacements, not an inspection report."],
    sections: [
      {
        title: 'The state milestone inspection',
        paras: [
          'After the Surfside collapse, Florida added a milestone inspection for condominium and cooperative buildings of three habitable stories or more. It has two phases: a visual first phase, and a second phase only where the first finds substantial structural deterioration. The state row below is the statute’s.',
        ],
        facts: [{ service: 'milestone-inspections', keys: ['Applies to', 'Phase two'] }],
      },
      {
        title: 'In Miami-Dade and Broward, the county report meets it',
        paras: [
          'Both counties already had programs for older buildings, and the state inspection is met through them. A board in either county owes no milestone inspection on top of its county report; the county report is the milestone inspection.',
        ],
        facts: [
          { service: 'building-recertification', keys: ['Condominiums & co-ops'] },
          { service: 'broward-bsip', keys: ['Condominiums & co-ops'] },
        ],
        list: [
          'What state law adds is the board’s duties to unit owners: telling them about the inspection, and sharing the engineer’s summary once the report arrives.',
          'Those duties, with their days, are on each county program’s page under “What the board must do”.',
          'Buildings that are not condominiums or co-ops answer only to the county program.',
        ],
      },
      {
        title: 'The structural integrity reserve study (SIRS)',
        paras: [
          'The reserve study is a different obligation under Florida’s condominium and cooperative laws, and it is not an inspection report. It estimates what the roof, the structure and the other components the law lists will cost to repair or replace over their life, and how much the association should set aside each year to pay for it.',
          'The two are connected: what an inspection finds is what a reserve study has to budget for. A board that has a recent recertification or BSIP report in hand gives the people preparing its reserve study a far better picture of the building.',
        ],
      },
      {
        title: 'Which one is due first?',
        paras: [
          'For the inspection, the date is the one on your county’s notice. For the reserve study, the association follows the state’s condominium and cooperative laws and its own counsel. When the board does not know where the building stands on the first, that is where we start: send the address and any letter, and we confirm which inspection reaches the building and when.',
        ],
      },
    ],
    faqTitle: 'Questions condo boards ask about the three',
    faq: [
      {
        q: 'Do we file a milestone report and a recertification report?',
        a: 'Not in Miami-Dade or Broward. The county report serves as the milestone inspection; in Miami-Dade the county says outright that no separate milestone report is filed.',
      },
      {
        q: 'Our apartment building is a rental, not a condominium. Does the milestone law reach it?',
        a: 'No. The milestone law reaches condominium and cooperative buildings; a rental building still answers to the county program, which covers almost every building type.',
      },
      {
        q: 'Does a recertification replace the reserve study?',
        a: 'No. They answer different questions: one says what condition the building is in, the other plans the money to keep it there.',
      },
    ],
  },

  /* ── 6. A failed recertification ───────────────────────────────────── */
  {
    slug: 'failed-recertification',
    service: 'building-recertification',
    programs: ['building-recertification', 'broward-bsip'],
    seo: {
      title: 'What If a Building Fails Recertification?',
      description:
        'When a recertification or BSIP report lists repairs, or is not filed in time: what happens next in Miami-Dade and Broward, and how the file is closed.',
    },
    name: 'When a building fails recertification',
    h1: 'What happens when a building “fails” its recertification',
    heroSub:
      'Most buildings that “fail” have a report that lists repairs, and what happens next has a set path to close it. A report that is never filed is the case that gets expensive.',
    card: 'For a building whose report lists repairs, or was never filed: two very different cases, and how each one is closed.',
    short: ["When a building is said to fail, the report usually just lists repairs, and it is still filed on time.", "Each county allows a period for the repair work, printed below, and the file is closed only after the repairs are done.", "The case to avoid is a report never filed: Miami-Dade moves it to enforcement, and Broward takes it to a hearing."],
    sections: [
      {
        title: 'There is no pass or fail on the form',
        paras: [
          'A recertification or BSIP report does not grade a building. It records what was observed and states whether the building is safe for continued use as it stands, or what has to be repaired first. What owners call “failing” is usually the second case: the report lists repairs.',
          'That report is filed anyway, and on time. Both counties ask for the report first and the repairs after it, under permit. A report held back until the repairs are done is a late report.',
        ],
      },
      {
        title: 'When the report lists repairs',
        paras: [
          'Each county gives a period for the work that follows the report. The rows below are the county rules as verified; your Building Official can set a different time for your file.',
        ],
        facts: [
          { service: 'building-recertification', keys: ['If repairs are needed'] },
          { service: 'broward-bsip', keys: ['If repairs are needed'] },
        ],
        list: [
          'A written repair scope, so every contractor bids the same work.',
          'Permits for the repairs that need them, pulled by the contractor.',
          'Where it is asked for, a letter on whether the building can stay occupied while the work goes on.',
          'Reinspection of the repaired areas, then an amended report — in Broward with a completion letter — that closes the file.',
        ],
      },
      {
        title: 'When the report is not filed',
        paras: [
          'Missing the date is the case to avoid. Miami-Dade’s published process moves a late recertification to enforcement, with penalties that can grow and a lien that can follow. Broward’s policy sends a late file to a hearing before a Special Magistrate or the Code Enforcement Board, and a building whose required repairs are not made can be declared unsafe. Each city sets its own steps and amounts.',
          'If you are already past the date, the way out is the same as the way in: get the inspection done and the report filed, and tell the office that sent the notice that it is under way. Send us the notice and any citation first.',
        ],
      },
      {
        title: 'When the engineer finds a danger',
        paras: [
          'Rarely, an inspection finds a condition that puts people or property at risk. The engineer then has a duty to report it at once, to the owner and to the Building Official, without waiting for the report. What follows for the occupants is decided by that office. Shoring, closing a balcony or a garage level, and emergency repairs are the usual first steps.',
        ],
      },
    ],
    faqTitle: 'After a report that lists repairs',
    faq: [
      {
        q: 'Do we have to fix everything before we file?',
        a: 'No. The report is filed first, with the repairs it lists; the repairs then follow under permit within the period your county or city allows.',
      },
      {
        q: 'Who closes the file after the repairs?',
        a: 'The professional who filed the original report issues the amended report. If another firm filed yours, tell us when you write and we confirm what closing it will take.',
      },
      {
        q: 'Do the repairs have to bring the building up to today’s code?',
        a: 'No. Repairs restore what the report found deficient; the building is judged against the code in force when it was built.',
      },
      {
        q: 'Can the repair period be extended?',
        a: 'The Building Official who has your file can set a different time. Ask that office before the period ends, not after it.',
      },
    ],
  },

  /* ── 7. Parking-lot certificates ───────────────────────────────────── */
  {
    slug: 'parking-lot-illumination-guardrail',
    service: 'building-recertification',
    programs: ['building-recertification'],
    seo: {
      title: 'Parking Lot Illumination & Guardrail Certificates',
      description:
        'The two parking-lot certifications Miami-Dade asks for with a recertification: what the illumination and guardrail forms record, and where they apply.',
    },
    name: 'Parking-lot illumination and guardrails',
    h1: 'Miami-Dade’s parking-lot certificates: illumination and guardrails',
    heroSub:
      'A Miami-Dade recertification is more than a structural and an electrical report. Where they apply, two parking-lot certifications go in with it.',
    card: 'For a Miami-Dade property with a parking lot: the two parking-lot forms that go in with a recertification, and what each records.',
    short: ["Where they apply, Miami-Dade, unlike Broward, adds two parking-lot forms to a recertification: one on lighting, one on guardrails.", "Light levels are measured at night against the county standard, and a guardrail is required only where the lot borders water.", "Low light often comes from failed fixtures or trees grown over the poles, and a missing guardrail is installed under permit."],
    sections: [
      {
        title: 'Two forms that go with the reports',
        paras: [
          'With the structural and electrical reports, Miami-Dade County asks for two certifications about the parking that serves the building, where they apply: one on illumination, one on guardrails. They are filed with the rest of the recertification package, on the county’s own forms.',
          'Neither one is a promise that a lot passes. Each form records what was measured or found, and the board learns from it whether anything has to be corrected before the recertification can close.',
        ],
      },
      {
        title: 'The illumination certification',
        paras: [
          'Light levels are measured on site, at night, in the parking lot that serves the building, and compared with the county’s standard for that type of building. The form records the measured levels and whether they meet that standard or do not.',
          'Where they do not, the usual fixes are electrical: failed fixtures, poles or photocells, or lamps that were swapped for weaker ones. Once corrected, the lot is measured again for the record.',
          'Trees that have grown over the light poles since the lot was built are a common cause, and the cheapest one to correct: trimming them is often all it takes.',
        ],
      },
      {
        title: 'The guardrail certification',
        paras: [
          'This form first answers a simple question: is the parking lot next to a canal, a lake or another body of water? If it is not, the form says so. If it is, it records whether parked vehicles are protected by the guardrail the county requires along the water.',
          'Where a guardrail is missing or damaged, the owner needs a permit to install or repair it, and the certification is completed once it is in place.',
          'The question is about the lot, not the building: a property set back from a canal can still have a row of parking spaces that runs along the bank. It is easy to miss, so walk the edge of the lot before the inspection day.',
        ],
      },
      {
        title: 'Broward is different',
        paras: [
          'The Broward Board of Rules and Appeals’ current policy asks for no separate parking-lot certificate. In Broward, guardrails and parking garages are items of the structural inspection, and the wiring at parking lots is part of the electrical one. A Broward building does not file Miami-Dade’s parking-lot forms.',
        ],
      },
    ],
    faqTitle: 'Questions about the two parking-lot forms',
    faq: [
      {
        q: 'Does every Miami-Dade building file both certificates?',
        a: 'No. They are filed where they apply to the building and its parking; we read your notice and confirm which ones your package needs.',
      },
      {
        q: 'Does a parking garage count as a parking lot?',
        a: 'A garage is a structure, and it is inspected for the structural report. The certifications concern the lot that serves the building; we confirm what applies to yours.',
      },
      {
        q: 'Do these certificates add a lot to the cost?',
        a: 'They are part of the complete package and priced in the same fixed proposal. Repairs they lead to, such as new fixtures or a guardrail, are quoted apart.',
      },
    ],
  },
  /* ── Since 2026-10-26: one guide for each service the guides did not reach ── */
  {
    slug: "threshold-building",
    service: "threshold-inspections",
    programs: ["building-recertification", "broward-bsip"],
    seo: {
      title: "What Makes a Threshold Building in Florida",
      description: "How Florida decides a threshold building: stories, height or a large assembly room, and what then changes in the Miami-Dade and Broward inspections.",
    },
    name: "Is it a threshold building?",
    h1: "Is your building a threshold building? How to tell, and what changes",
    heroSub: "Florida’s threshold law draws its line by stories, by height or by a large assembly room. Past that line, the same county inspection in Miami-Dade or Broward asks more of the people who prepare it.",
    card: "For boards and owners of tall buildings: the three tests of Florida’s threshold law, and what each county then asks.",
    short: ["Florida treats a building as threshold above three stories or fifty feet, or with a large assembly room at any height.", "A threshold building keeps its county program and dates, but the rules for who prepares its structural report are stricter.", "Special inspection while a tall building goes up is a different requirement, tied to construction, not to the county program."],
    sections: [
      {
        title: "Where Florida draws the threshold line",
        paras: [
          "Florida’s threshold law gives three ways past the line, and meeting one is enough. Two are about size: more than three stories, or more than fifty feet of height, for any use, from a condominium tower to a parking garage. The third is about a crowd: a space the Florida Building Code classes as assembly, over five thousand square feet and with an occupant content above five hundred people, makes it a threshold building at any height.",
          "Both counties use the state’s line. Broward’s program and Miami-Dade’s code repeat the definition, and Miami-Dade’s page words the story test as four stories or taller. In neither county is it a separate program: it changes what the county file must carry.",
        ],
      },
      {
        title: "What changes in the county inspection",
        paras: [
          "Being a threshold building does not move the age at which a building comes due, the notice it receives or the time it has to file. The difference lies in who may prepare the report, and each county writes that rule in its own words.",
          "The self-qualification letter is Miami-Dade’s requirement; Broward’s program texts do not ask for it. Broward’s structural form asks instead whether the building is a threshold building and whether the professional preparing the structural portion is a certified Special Inspector.",
        ],
        list: [
          "Miami-Dade, structural: an engineer specializing in structural design, whose report carries a self-qualification letter with proof of the state’s structural specialization.",
          "Miami-Dade, electrical: an engineer specializing in electrical design.",
          "Broward, structural: a Florida-licensed professional specializing in structural engineering and holding a Special Inspector license as well.",
          "Broward, electrical: a Florida-licensed professional specializing in electrical design, the same rule as for every building in the program.",
        ],
      },
      {
        title: "A façade held by structural sealant",
        paras: [
          "In a structural glazing façade, the glass is bonded to its frame with a structural sealant instead of being held by metal on every edge. Where the building is a threshold building in Miami-Dade, that façade owes a recertification of its own every five years, apart from the building’s report.",
          "Miami-Dade runs that cycle under published guidelines: the county sends a façade notice, the report is due within ninety days, and the inspector must be certified by the state as a Special Inspector for threshold buildings. In Broward, the program’s structural form asks whether a threshold building has structural glazing, when the system was last inspected and what condition it is in.",
          "Not every glass wall is structural glazing; the façade drawings show how the glass is held.",
        ],
      },
      {
        title: "How to tell, before the notice arrives",
        paras: [
          "Most of the answer is on the drawings. The threshold law counts stories, while the milestone law counts only habitable ones, so a floor of parking or shops is not left out of the threshold count merely because no one lives on it.",
          "When a test is close, as with a level partly below ground or a mezzanine, send us the address and what each floor holds, and we read it against your county’s rule.",
        ],
        list: [
          "Stories: more than three, counting every floor the code counts as a story.",
          "Height: more than fifty feet, which makes a building of three stories or fewer threshold too.",
          "Assembly: a space classed as assembly, over five thousand square feet and for more than five hundred people.",
          "Miami-Dade’s wording: four stories or taller, the same line as the state’s.",
          "The façade: in Miami-Dade, glass held by structural sealant has a cycle of its own.",
        ],
      },
    ],
    faqTitle: "What boards of tall buildings ask",
    faq: [
      { q: "Our building has three floors of homes over a parking level. Does that make it a threshold building?", a: "It does, if the parking level counts as a story. The threshold law asks for stories, not habitable ones, so with that level the building has four, past the line in both counties. A level partly below ground is the case to confirm on the drawings." },
      { q: "Is a hotel or a church a threshold building?", a: "By the same tests as any other building. A hotel over three stories or fifty feet is one. A church, or a low hotel with a ballroom, is one at any height when that room is classed as assembly and passes five thousand square feet and five hundred people." },
      { q: "Does threshold mean special inspection during construction?", a: "Only while a building is going up or its structure is being altered. During new construction, or a repair that modifies the structure or the loads it carries, the state requires a certified special inspector on the structural work. That is separate from the county program and we do not offer it; this guide is about a building already standing." },
      { q: "Our report was sent back over its author’s qualification. What now?", a: "Read the office’s comment against your county’s rule in the list above, because Miami-Dade and Broward do not ask for the same thing. Then send us the comment and the report, and we tell you what the file needs before it goes back." },
    ],
  },
  {
    slug: "balcony-spalling-cracks",
    service: "structural-condition-assessments",
    programs: [],
    seo: {
      title: "Balcony Spalling & Cracks: When to Call an Engineer",
      description: "Concrete breaking off a balcony, rust stains, a loose railing: what the signs usually mean, what cannot wait, and what a structural assessment gives you.",
    },
    name: "Balcony spalling and cracks",
    h1: "Balcony spalling, rust and cracks: what they mean and when to call an engineer",
    heroSub: "Concrete coming off a balcony edge is a sign to read, neither to ignore nor to panic over. Here is what it usually means in salt air, what to close off today, and what a board can plan.",
    card: "For a board, manager or owner looking at a spalling balcony: what the signs mean, what cannot wait, and what comes next.",
    short: ["Concrete breaking off a balcony usually means the steel inside is rusting and swelling, and that does not stop by itself.", "Loose pieces over a walkway, a railing that moves or a slab that sags: keep people away and call an engineer today.", "An assessment sorts the cosmetic from the structural, and a repair design gives every contractor the same work to bid on."],
    sections: [
      {
        title: "What the signs on the balcony mean",
        paras: [
          "Many South Florida balconies are concrete slabs reaching out past the wall, with their main steel close to the top. When concrete comes away, salt and moisture have most often reached that steel: rust takes up more room than sound steel, so it swells and pushes the concrete off.",
          "Not every mark points to the steel. Hairline cracks in paint, tile or stucco often stay in the finish; a crack that runs along the line of a bar, or that bleeds rust, usually involves the steel.",
        ],
        list: [
          "Concrete missing at the edge or underneath: usually steel rusting behind it.",
          "Brown or orange stains: rust carried out by water, often before anything falls.",
          "A crack along the edge or at a railing post: often corrosion starting out of sight.",
          "A railing loose or rusted at its base: the post, or the concrete around it, may be deteriorating.",
          "Water marks under the slab: water working into the concrete, on its way to the steel.",
        ],
      },
      {
        title: "What cannot wait, and what can be planned",
        paras: [
          "Three signs are about safety today: loose concrete above a walkway, an entrance, a pool deck or parked cars; a railing that wobbles or leans; a slab that sags or tilts outward. Keep everyone off that balcony and out of the area below it, and call an engineer the same day.",
          "Other signs usually leave time to plan, though not to forget: corrosion keeps working, and a small repair left alone tends to grow. Fannie Mae’s condominium guidelines even count balconies among the critical repairs that make a project ineligible for the loans it buys. The conditions below can usually wait for the board’s calendar, once an engineer has seen them.",
        ],
        list: [
          "Rust stains where no concrete is loose yet.",
          "Small spalls away from where people walk, sit or park.",
          "Hairline cracks in a finish, with no rust and no movement.",
          "Dry water marks under the slab.",
        ],
      },
      {
        title: "What an assessment and a repair design give you",
        paras: [
          "The assessment starts with the building’s records, then turns to the balconies themselves. Concrete is sounded, usually with a hammer, since concrete that has separated from its steel sounds hollow before it falls; railings are checked by hand at their bases.",
          "Each condition is classified by what it means for the structure, not by how it looks. The repair design then sets where concrete comes out, what is done to the steel, and how edges, railing anchors and waterproofing are rebuilt. On a balcony held only at the wall, even removing concrete can weaken it, so the drawings set the order of the work and any shoring.",
        ],
        list: [
          "A map of every balcony seen, with each condition photographed where it sits.",
          "Each condition ranked by structural significance, and what comes first.",
          "Drawings and specifications, so each bid answers to the same work.",
          "The documents the building department reviews to permit the repair.",
        ],
      },
      {
        title: "How it fits the county programs and the milestone law",
        paras: [
          "When a building is due, Miami-Dade’s recertification looks at its balconies with the rest of the structure, and Broward’s BSIP takes in the balconies attached to a building. A report that lists balcony repairs is filed by its date all the same; the repairs follow, under permit, in the time the county or city allows.",
          "Statewide, buildings of at least three habitable stories held as residential condominiums or cooperatives come under the milestone law once they reach the age it sets: a visual first phase, then a second only if the first turns up substantial structural deterioration. Both Miami-Dade and Broward count the county report as compliance with it. An assessment in between replaces neither, but lets the board reach its next report with the balcony repairs designed, or done.",
        ],
      },
    ],
    faqTitle: "Questions boards ask about their balconies",
    faq: [
      { q: "Can a contractor just patch the broken concrete?", a: "Usually not for long. A patch closes the surface, but over steel that keeps rusting it tends to crack again, hiding the problem meanwhile; the lasting repair removes the damaged concrete, treats or replaces the steel and rebuilds the section, from drawings and with the permit it needs." },
      { q: "Do we need to check every balcony?", a: "Not always at first. Where the balconies are alike, a representative set, including the ones showing signs and the ones above walkways, shows the pattern; if the deterioration turns out to be widespread, the rest are sounded before the repairs are designed." },
      { q: "Will an assessment trigger a county inspection?", a: "Not by itself. The county programs and the milestone law reach a building by its age and type, not by a study the board orders. The assessment changes what the board knows: anything that puts people at risk is dealt with at once, and the repairs reach the building department through their permit." },
      { q: "How long does the assessment take?", a: "It depends on how many balconies there are and how soon the units can be opened, since most balconies are reached through one. Anything urgent is told to the board during the visit; the report follows once the findings are mapped." },
    ],
  },
  {
    slug: "buying-a-building",
    service: "structural-condition-assessments",
    programs: [],
    seo: {
      title: "Buying a Building in Florida: The Structural Check",
      description: "Buying a building in Florida: the reports to ask the seller for, what they leave out, and the structural assessment to do before the purchase closes.",
    },
    name: "Before you buy a building",
    h1: "Buying a building: the structural check before you close",
    heroSub: "A condo unit, an apartment building, an office, a shop or a warehouse in Florida: before the purchase closes, learn what the structure needs and what the paperwork leaves out.",
    card: "For a buyer, investor or lender in Florida: the papers to ask the seller for, and the structural check before closing.",
    short: ["Ask the seller for the latest recertification or BSIP report, open permits and, for a condo, the milestone inspection and reserve study.", "Those papers show what was seen and filed, not the condition of the structure on the day you buy.", "A structural assessment during the contract’s inspection period sorts what it finds and outlines the repairs, by priority, for the negotiation."],
    sections: [
      {
        title: "Before buying: what to ask the seller for",
        paras: [
          "Start with the papers the seller and the building office already hold. In Miami-Dade, a building past the county’s inspection age should have a recertification file; in Broward, a file under the county’s Building Safety Inspection Program, or BSIP. The local building office keeps it, and the seller should be able to hand over a copy.",
          "That office can also tell you whether a recertification file, or a permit on the property, is still open.",
        ],
        list: [
          "The last recertification or BSIP report, and the notice that called for it.",
          "Proof the file was closed: where the report listed repairs, the amended report and, in Broward, the completion letter.",
          "Permits that are open or expired, and repairs under way or only planned.",
          "Where the building is a condo or co-op with at least three habitable stories: the milestone inspection, which in Miami-Dade and Broward is the county report, and the latest structural integrity reserve study, the SIRS.",
        ],
      },
      {
        title: "What the documents tell you, and what they do not",
        paras: [
          "A recertification or BSIP report records one inspection: what was seen that day, where access allowed, and whether the building could stay in use or needed repairs first. A leak, a storm or a repair put off since then is not in it, and what hides behind finishes shows only where something was opened.",
          "The reserve study is not an inspection but the association’s plan for the money: what the roof, the structure, the waterproofing, the windows and the other items the law lists will need over their remaining life, and what should be set aside each year for them. Read next to the inspection, it lets a buyer see whether what the inspection found is budgeted for.",
          "A lender may read these papers too. Under Fannie Mae’s selling rules, a condominium project that needs critical repairs is not eligible for the loans Fannie Mae buys, and the items it names include balconies, the foundation, parking structures, sea walls and other load-bearing structures. The lender must review any structural inspection done within the last three years and, where repairs were made, an engineer’s report on whether they resolved the concerns.",
        ],
      },
      {
        title: "The structural check before you close",
        paras: [
          "A pre-purchase structural assessment answers what the papers cannot: the condition of the structure today. It starts from the original drawings, the permits and the last reports, and compares the building as designed with the building as it stands; where drawings are missing, more is checked on site.",
          "Book it early in the inspection or due-diligence period your contract allows, while there is still time to act on the findings. In a condominium, the roof, the garage and the other common areas are opened through the association or its manager.",
        ],
        list: [
          "The structure walked and photographed: roof, beams and columns, slabs, balconies, garage, visible foundations.",
          "Every condition sorted: cosmetic or structural, urgent or one to watch.",
          "Alterations evaluated: an opening cut in a slab or wall, an added floor, a change of use or a heavier load.",
          "The repairs it points to, in order of priority, as a basis for the talk with the seller.",
          "Anything left in doubt, marked as open, with the test or exploratory opening that would answer it.",
        ],
      },
      {
        title: "When the building is due soon",
        paras: [
          "A building near its next recertification or BSIP inspection brings that inspection with it, along with whatever repairs the report then lists. After closing they are the new owner’s to answer, or the association’s in a condominium.",
          "The age each county counts from is on public record: in Miami-Dade, it is the year built as the Property Appraiser records it; in Broward, the date its certificate of occupancy was issued. Send us the address during the inspection period, and we say which inspection the building owes next, and by when.",
        ],
      },
    ],
    faqTitle: "Questions buyers ask before closing",
    faq: [
      { q: "Is a home inspection enough for a building?", a: "A home inspection is a visual look at one home; in a condominium, that home is the unit. The frame, the slabs, the balconies and the garage of the building as a whole are a structural question, and call for an engineer’s assessment." },
      { q: "The seller’s report is recent. Do we still need an assessment?", a: "Perhaps not a full one. A recent report whose repairs are closed is a strong start; we read it first and say whether anything in it, or anything since, calls for a visit." },
      { q: "The building is due for recertification next year. Who pays for it?", a: "The inspection goes with the building: after closing it is the buyer’s to answer, or the association’s in a condominium; whether the seller takes on part of it is for buyer and seller to agree in the purchase contract. Before that talk, we can say what is due and when, what the inspection involves, and whether the last report left repairs open." },
      { q: "Can you look at a warehouse or an office?", a: "Yes, anywhere in Florida. The assessment is tied to no program, so it reaches warehouses, offices, shops and apartment buildings as readily as a condo tower. In Miami-Dade and Broward most of them also come under the county program: ask the seller for that report too." },
    ],
  },
  {
    slug: "structural-peer-review-florida",
    service: "peer-review",
    programs: [],
    seo: {
      title: "Structural Peer Review in Florida: When It Is Required",
      description: "Florida’s permit law asks for no peer review, but Coral Gables, the City of Miami and Miami-Dade County do for some buildings. Where, and what it covers.",
    },
    name: "When peer review is required",
    h1: "When a structural design needs a peer review in Florida",
    heroSub: "The state’s permit law does not call for one, yet some local building officials make it a condition of the permit. Here is where a review is required, what it covers and when to begin.",
    card: "For a developer, owner or lender holding a structural design: where a peer review is a permit condition, and what it delivers.",
    short: ["Florida’s law on building permits does not call for a peer review, but some local building departments make one a permit condition.", "Coral Gables, the City of Miami and Miami-Dade County each publish their own list of the buildings that need one.", "An independent engineer reads the design, ideally before it goes in for permit, and the engineer of record stays responsible for it."],
    sections: [
      {
        title: "Why a design gets a second engineer’s read",
        paras: [
          "A structural design is checked by the team that produced it, and by the building department before the permit. A peer review adds a reader from outside the design team, with no stake in its choices, who follows how the structure carries its loads down to the ground.",
          "The value is in the timing: a mistake found on the drawings is settled with an answer and a corrected sheet, while the same mistake found on site can mean shoring, a field repair and lost weeks. A building official can make the review a condition of the permit; an owner, a lender or the design team itself can also ask for one.",
        ],
      },
      {
        title: "Where a building official requires one",
        paras: [
          "Florida’s statute on building permits never mentions peer review. The requirements listed below come from local building departments, each one a condition of the permits that department issues, with criteria of its own, so the same design can need a review in one city and not in the next.",
          "No county-wide requirement was found in Broward when this guide was written, so there the office that will issue the permit has the answer: ask it directly. The same goes for any place this guide does not name, and anywhere in the state the owner, the lender or the insurer may still ask for a review.",
        ],
        list: [
          "Miami-Dade County, on the buildings it permits in its unincorporated area: ten stories or one hundred feet, whichever comes first; essential facilities that are not low-rise; half a million square feet or more on any single story; and more than three stories where the wind-resisting system is light-gauge steel or wood.",
          "The City of Miami: residential and commercial buildings above three stories, or above fifty feet in height; essential facilities; more than a quarter of a million square feet of floor area in all; and buildings whose floors and walls are framed in light-gauge steel.",
          "Coral Gables: threshold buildings, as state law defines them; essential facilities; slender buildings, with an aspect ratio of seven or more; buildings of more than a million square feet; any element that supports, in total, more than fifteen percent of the building’s area; and designs that rely on nonlinear or progressive-loading analysis.",
          "In all three, the building official can also require one for a project outside these lists, such as an unusual or complex structure.",
        ],
      },
      {
        title: "What the reviewer checks and hands back",
        paras: [
          "The reviewer reads the drawings and calculations against the code that governs the project, and runs independent calculations on a representative part of the structure. Coral Gables writes that method into its rules, and gives the reviewer the designer’s own calculations for reference only.",
          "What comes back is a review report with a log of comments, ranked by weight, each naming the sheet, the concern and its consequence for the structure. The design team answers, the reviewer reads each answer, and a comment closes only once it is settled.",
          "The review does not redesign the building. The engineer of record keeps sole responsibility for the design; the reviewer gives an independent opinion on it.",
        ],
        list: [
          "The loads and the load path, from the roof to the foundations.",
          "The analysis model and the assumptions behind it.",
          "Details and connections, and whether they can be built as drawn.",
        ],
      },
      {
        title: "When to start, and what to send",
        paras: [
          "Start once the structural system is settled and before the set goes in for permit. Miami-Dade County wants the comments resolved before the permit application is submitted, so a review started late holds up the submittal itself.",
          "The drawings and calculations are enough for us to start. We check whether the office that will issue the permit asks for a review, and under which of its criteria, and then send a proposal sized to the review the project needs.",
        ],
        list: [
          "The structural drawings, in their latest issue.",
          "The calculations, and the analysis model if there is one.",
          "The geotechnical report, for the foundations.",
          "The address, and the date the set should go in for permit.",
        ],
      },
    ],
    faqTitle: "What owners and design teams ask about it",
    faq: [
      { q: "Does every new building in Florida need a peer review?", a: "No. The state’s permit law does not ask for one, and the local rules in this guide reach only the buildings they describe, or a project the building official singles out. Any owner, lender or insurer can still ask for a review." },
      { q: "Our project is in Broward. Will the permit office ask for one?", a: "No county-wide requirement turned up while this guide was prepared, so put the question to the building office that will issue your permit. Whatever it answers, an owner or a lender can still request a review." },
      { q: "Who chooses the reviewer?", a: "In Miami-Dade County, the owner retains an independent professional engineer licensed in Florida. The City of Miami has the owner propose up to three Florida structural engineers, and the final choice is made by mutual consent with the building official." },
      { q: "Is a peer review the same thing as threshold special inspection?", a: "No. Florida’s threshold law calls for a special inspector who inspects the structure while it is built, or while a repair or restoration changes its structural system or its loading; a peer review reads the design itself, on paper." },
    ],
  },
];
