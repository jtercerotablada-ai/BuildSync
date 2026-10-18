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
  moreLabel: 'Keep reading',
  costLink: 'What the work costs',
  allGuides: 'All guides',
  forProgram: 'Guides for owners',
};

export const index: GuidesIndex = {
  seo: {
    title: 'Recertification & BSIP Guides for Owners',
    description:
      'Plain answers for owners and boards in Miami-Dade and Broward: the notice, which program applies, milestone vs recertification, repairs and parking lots.',
  },
  crumb: 'Guides',
  eyebrow: 'Guides',
  titleLines: ['Recertification and BSIP,', 'explained for owners.'],
  accentWord: 'explained for owners.',
  sub: 'Short guides for boards, owners and managers in Miami-Dade and Broward. Each answers one question that comes up when a building reaches inspection age, and each points to the verified county rules.',
  listLabel: 'The guides',
  listTitle: 'Pick the question you have today.',
  howTitle: 'How to read these guides',
  how: [
    'Start with the county. Miami-Dade and Broward run separate programs, with their own ages, their own clocks and their own forms, and a rule from one county never applies to a building in the other. Every guide says which county it is talking about, and when it covers both, it keeps them apart.',
    'The ages and deadlines in each guide are not typed by hand. They are printed from the same verified rows as the program pages, with the authority they come from and the date they were last checked, so a guide cannot drift from the rules it explains.',
    'A guide explains how a program works in general; your letter is what governs your building. If a date on your notice differs from what you read here, the notice wins. Send us a photo of it and we will tell you, in plain words, what it asks for and what comes next.',
    'Boards, owners and property managers use these pages to prepare a meeting, answer unit owners or compare proposals. They are free to share, and each one links to the full program page and to what the work costs.',
  ],
};

export const guides: Guide[] = [
  /* ── 1. The notice ─────────────────────────────────────────────────── */
  {
    slug: 'recertification-notice',
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
    card: 'The letter arrived. The first five steps, and the clock it starts.',
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
          'The two counties run different clocks, and they must never be read against each other. Below is the time each county’s rules give to file the report, as verified on the county program pages; the time for repairs that follow is in the guide on failed recertifications. The date printed on your own letter is the one that counts.',
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
    card: 'What the certified letter asks of the owner, and which buildings are outside the program.',
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
    programs: ['building-recertification', 'broward-bsip'],
    seo: {
      title: 'Is My Building Due for Recertification?',
      description:
        'How to tell whether a Miami-Dade or Broward building is due for recertification or the BSIP: the record that sets its age, the list and the letter.',
    },
    name: 'Is my building due?',
    h1: 'How to check whether your building is due for inspection',
    heroSub:
      'No letter yet, or not sure it applies to you? The age that counts is on a public record you can check yourself, and each county reads it differently.',
    card: 'No letter yet? Where the age that counts is recorded, county by county.',
    sections: [
      {
        title: 'Start with the county the building is in',
        paras: [
          'Miami-Dade and Broward count a building’s age from different records, so the first question is the county, not the city. A building in Aventura answers to Miami-Dade’s program; one across the county line in Hallandale Beach answers to Broward’s.',
          'Then find the age the county counts from, and compare it with that county’s rows below. If the building is past that age, or close to it, a notice is coming or already late, whether or not a letter has arrived.',
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
    card: 'One program, three names owners search for, and what each one means now.',
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
    card: 'Three names a condo board hears, and which of them is one report.',
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
    card: 'A report that lists repairs, and a report never filed: two very different cases.',
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
    card: 'The two parking-lot forms in a Miami-Dade recertification, and what each records.',
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
];
