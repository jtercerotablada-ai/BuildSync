import type { CityPage } from './cities';

/**
 * CITY PAGES — ENGLISH. The rules for this text are in the header of
 * cities.ts; where every row and answer was read is in city-sources.ts.
 * cities.es.ts mirrors this list row for row.
 *
 * Read on the cities' own websites on October 9, 2026 (`citiesChecked`).
 * A city's page moves or changes without notice: re-read the record before
 * editing a row, and move the date when you have.
 */
export const cityPagesEn: readonly CityPage[] = [
  {
    slug: 'miami',
    program: 'building-recertification',
    city: 'City of Miami',
    place: 'the City of Miami',
    office: {
      name: 'City of Miami Building Department, Unsafe Structures Section',
      address: ['444 SW 2nd Ave, 1st Floor', 'Miami, FL 33130'],
      phone: '(305) 416-1177',
    },
    description:
      'Building recertification in the City of Miami: the letter, filing in iBuild and ProjectDox, the city’s forms, and what one team delivers complete.',
    heroSub:
      'In the City of Miami the Unsafe Structures Section runs the recertification, and the documents are submitted online. Already late? One team still delivers yours complete, on the city’s forms.',
    lede:
      'In the City of Miami the recertification runs through the Unsafe Structures Section of the Building Department. The city says it recertifies structures as per the Miami-Dade County Code, and its page has the owner hire an architect or engineer to inspect the property and then submit the documents online.',
    local: [
      { k: 'The notice', v: 'The city’s recertification page speaks to owners who have received a notification that their building is due, and adds that they will have received a letter about it. Miami’s page does not say who sends that letter or how it arrives. In iBuild, the recertification option shows only when the building is due.' },
      { k: 'Filing the report', v: 'The City of Miami takes the application and the documents online. Its page has the applicant create an account in iBuild, start a Building Permit Application and look for the option “Architect/Engineer (Building Recertification)”. An e-mail from ePlan/ProjectDox then asks the applicant to log in, and the files are uploaded in ProjectDox.' },
      { k: 'File names', v: 'The reports go up as PDF files saved under the City of Miami Standard Naming Convention: RC-S for the structural report and RC-E for the electrical report, with the cover letters and the photos in separate files under names of their own. The city’s naming page warns that improperly named files may be rejected during Prescreen.' },
      { k: 'The city’s forms', v: 'Miami publishes its own edition of the structural report form, under the heading of the Building Department’s Unsafe Structures unit. The recertification page presents the documents it links as the required ones and adds a tip: the forms outline the minimum requirements, and the architect or engineer may want to include more.' },
      { k: 'What goes with it', v: 'Besides the reports, Miami’s page asks for a Parking Lot Illumination Certificate, if applicable — the city posts its own form for it — and a signed, sealed and dated cover letter carrying the professional’s recommendation. Where documents are digitally signed, the page requires one of the signature providers the city lists.' },
      { k: 'After filing', v: 'Miami’s page says the applicant then receives one of two things — a letter stating that the recertification is complete, or a notice with the changes needed — and it gives a time for that reply. The ProjectDox steps on the same page name an “Applicant resubmit Task” among the upload tasks.' },
      { k: 'Repairs', v: 'Miami’s page sets the order: the report is submitted before any repairs are started. Where repairs are needed, it says the proper permitting procedures must be followed before the building can be recertified. The City of Miami’s structural form has one box for the initial report and another for the amended report after completion of repairs.' },
      { k: 'If it is late', v: 'Miami’s page says an overdue building cannot use the online process: the owner must visit the Recertification Division of the Unsafe Structures Section, within the Building Department, in person. Whether a building counts as overdue is for the letter and that office to settle.' },
    ],
    faq: [
      {
        q: 'How do we submit a recertification report to the City of Miami?',
        a: 'Online, unless the building is overdue — then Miami’s page requires a visit in person. Otherwise the applicant opens an account in iBuild, applies there and uploads the documents in ProjectDox. Only one e-mail address can be used for the whole process, and the upload link goes to that address alone — so settle who files before the account is opened. The complete recertification we deliver goes on the forms that Miami’s page lists.',
      },
      {
        q: 'Can we ask the City of Miami for more time to recertify?',
        a: 'Once, yes. Miami’s page speaks of a one-time extension and says the request must be received before the recertification due date. It is sent by e-mail to the city’s recertification mailbox, with the full property address, and the page gives a time for the answer, though not the length of the extension.',
      },
      {
        q: 'What happens in the City of Miami if the recertification is not filed on time?',
        a: 'Miami’s pages do not spell out each step. They show that Unsafe Structures issues recertification violations, and the city’s hearing guide lists a recertification hearing before the Unsafe Structures Panel, which may give time to comply or require demolition where it finds a violation. Send us what you received — a phone photo is enough — and we confirm what Unsafe Structures is asking for and by when.',
      },
      {
        q: 'Is our building exempt from recertification in the City of Miami?',
        a: 'Miami’s page lists single-family homes, duplexes and small structures within a set size and occupancy load as exempt. An owner who feels a building is exempt requests the exemption by e-mail, with the full property address and the reasoning, and the page gives a time for the reply. Not sure where yours falls? Send the letter and we read what Miami’s office is asking of your building.',
      },
      {
        q: 'Is the City of Miami’s recertification the same as the 40-year recertification?',
        a: 'Yes. One of the city’s own pages, on appealing an Unsafe Structures violation, still calls it by the former 40-year name. The program is Miami-Dade County’s building recertification, which the City of Miami says it carries out as the county code provides; the ages and the days now in force are the county’s, in the rows above.',
      },
    ],
    nextStep:
      'Send the letter about your building in the City of Miami — a phone photo is enough — or, with no letter yet, the address and the year built. We read what the Unsafe Structures Section is asking for and by when, and reply with a proposal for the complete recertification.',
  },
  {
    slug: 'miami-beach',
    program: 'building-recertification',
    city: 'Miami Beach',
    place: 'Miami Beach',
    office: {
      name: 'City of Miami Beach Building Department',
      address: ['1700 Convention Center Drive, Second Floor', 'Miami Beach, FL 33139'],
      phone: '(305) 673-7610',
    },
    description:
      'Building recertification in Miami Beach: how the Building Department gives notice, how the report is filed and what one team delivers, complete.',
    heroSub:
      'Miami Beach’s Building Department posts the recertification notice at the property and reviews the report. Already late? One team still delivers the complete recertification, in the single report the city asks for.',
    lede:
      'In Miami Beach the recertification runs through the City of Miami Beach Building Department, in the unit its written procedure calls the Recertification Section. The department posts the notice at the building, receives a digitally signed report through its Citizen Self Service portal or by e-mail, and reviews it before the Building Official gives final approval. Its page still gives the program’s former name, the 40-year recertification.',
    local: [
      { k: 'The notice', v: 'The Building Department posts a notice at the property well ahead of the date the recertification is due. Reminders follow as that date approaches, the final one together with a notice posted on site. The recertification package asks the owner to arrange an electrical and a structural inspection of the building and to file a signed and sealed report with the Recertification Section.' },
      { k: 'Filing the report', v: 'The city asks for one completed inspection report that contains both the structural and the electrical reports. A digitally signed report can go in through the Citizen Self Service portal — CSS on the city’s pages — or by e-mail to the Building Recertification team. The city’s procedure adds that an e-mailed report should carry a digital signature and seal that a third party can verify.' },
      { k: 'In person', v: 'A report that is not digitally signed and sealed may be e-mailed as a scanned copy, the city’s procedure says, with the original signed and sealed report sent by mail or handed in at an in-person appointment at the Building Department. The department’s procedures also list Building Recertification among its appointment services, and the phone line has an option under the same name.' },
      { k: 'The city’s forms', v: 'Under “Required Building Recertification Reporting Forms” the city’s page lists a structural and an electrical inspection form, both under the Building Department’s name, a structural inspection guide, and two parking-lot forms — guardrails and illumination — that go in where they apply. The electrical form has a thermography section, with the thermography report attached where the building’s electrical service requires one.' },
      { k: 'After filing', v: 'The city’s procedure routes the report to the Chief Structural Engineer and the Chief Electrical Inspector for review. After both approvals the recertification goes to the Building Official for final approval. The city’s page says the Building Official then issues a Building Recertification approval letter, sent to the owner and to the engineer or architect of record.' },
      { k: 'Repairs', v: 'When the first report notes deficiencies that need permits, the city’s page has the owner submit an updated report once those permits have passed final inspection. The same paragraph requires a cover letter certifying that the building is structurally and electrically safe for its specified use and occupancy. The procedure says the department fast-tracks those repair permits; the recertification number goes on the permit application.' },
      { k: 'Extensions', v: 'The city’s procedure says an extension to obtain repair permits may be granted when the design professional who inspected the building finds it poses no harm to its occupants, states in writing that it can stay occupied and asks for the extension. The procedure sets its own length for it; the time for repairs now in force is the county’s, in the rows above.' },
      { k: 'If it is late', v: 'The procedure describes a reminder posted on site — it calls it a Red Tag — when the report has not reached the Building Department by a set point. If neither the report nor an extension letter is in on time, it says, a recertification violation is issued: the Notice of Violation is posted on the building and a copy goes to the owner by certified mail.' },
    ],
    faq: [
      {
        q: 'Who sends the recertification notice in Miami Beach?',
        a: 'The City of Miami Beach Building Department. Its procedure says Miami-Dade County provides the list of buildings that require recertification and that the list is reviewed before the notices go out. The report goes back to the department’s Recertification Section. A phone photo of the notice posted at your building is enough for us to confirm what it asks for and by when.',
      },
      {
        q: 'How do we check the recertification status of a building in Miami Beach?',
        a: 'On the city’s Citizen Self Service portal. The recertification page explains the search: look under permits, choose “Existing Building Recertification” as the permit type and enter the building’s address. That record is part of the building’s history we read, along with the notice, before we reply with a proposal for the complete recertification.',
      },
      {
        q: 'Can a building in Miami Beach be recertified with open permits or violations?',
        a: 'Not under the city’s procedure. It says a building recertification cannot be approved if the property has open building violations and open or expired permits. The procedure’s Letter of Building Recertification is issued when, among other conditions, none of those remain and the reports are approved. That is one reason we read the building’s history before proposing anything.',
      },
      {
        q: 'What does Miami Beach do when a recertification report is not filed on time?',
        a: 'The city’s procedure says a building recertification violation is issued and, if it is not complied with within the notice period, forwarded to Miami Beach’s Special Master. It adds that non-compliance sends the case on to the Miami-Dade County Unsafe Structure Board and may end in an order to demolish the structure and the need to vacate the building. The city’s violations page says Special Magistrate hearings are held in person at City Hall.',
      },
      {
        q: 'What is the annual maintenance log that Miami Beach asks building owners for?',
        a: 'It is a yearly log of routine structural repairs. Miami Beach’s recertification page links to what it calls the mandatory annual maintenance log. The log’s page says owners submit it by a deadline that depends on the building’s address, on the Citizen Self Service portal under the Annual Maintenance Log application, and that not every building has to file.',
      },
    ],
    nextStep:
      'Send us the notice from Miami Beach’s Building Department — a phone photo is enough — or, with no notice yet, the building’s address and the year built. We confirm what the Recertification Section is asking for and by when, and reply with a proposal for the complete recertification.',
  },
  {
    slug: 'hialeah',
    program: 'building-recertification',
    city: 'Hialeah',
    place: 'Hialeah',
    office: {
      name: 'City of Hialeah Building Division',
      address: ['501 Palm Avenue, 2nd Floor', 'Hialeah, FL 33010'],
      phone: '(305) 883-5825',
    },
    description:
      'Building recertification in Hialeah: how the city’s Building Division notifies owners, the forms it publishes and what one team delivers, complete.',
    heroSub:
      'Hialeah’s Building Division mails the recertification letters and receives the reports. Already late? One team still delivers yours complete, on the forms the city lists.',
    lede:
      'In Hialeah the recertification runs through the Building Division. Each year the division mails a letter to the owners whose buildings are due, and it publishes its own set of forms and guidelines for the report.',
    local: [
      { k: 'The notice', v: 'The Building Division mails letters each year to the owners of the buildings that are due. The city’s report form asks for the date of that Notice of Required Inspection, so keep the letter: the deadlines are counted from it.' },
      { k: 'The city’s forms', v: 'Hialeah publishes its own fillable editions of the structural and electrical report forms, with the city’s name on them, and the guidelines that go with them. Its recertification page presents them as required forms.' },
      { k: 'What goes with them', v: 'The same list carries a parking-lot illumination form, a parking-lot guardrails affidavit and a sample letter of compliance, written on the professional’s letterhead and addressed to the Building Official. The two parking-lot documents go in where they apply to the property.' },
      { k: 'Electronic filing', v: 'The list also includes an affidavit that authorizes electronic submittal in place of signed and sealed hard copies. The city’s page does not say how a recertification report is delivered, so we confirm it with the Building Division before anything is filed.' },
      { k: 'Repairs', v: 'The city’s structural form is marked either as the initial report or as the amended report after the repairs are complete, and it asks whether the building can stay occupied while the recertification and the repairs are under way.' },
      { k: 'If it is late', v: 'Hialeah’s page says a building whose report is not in on time is deemed unsafe and non-compliant under the county code, that the case goes to a hearing before the city’s Special Magistrate, and that the Certificate of Occupancy may be revoked.' },
      { k: 'Older names', v: 'Some of the city’s documents still carry the program’s former name, the 40-year recertification — the guidelines and the sample letter among them. It is the same program; the ages now in force are in the rows above.' },
    ],
    faq: [
      {
        q: 'Who sends the recertification notice in Hialeah?',
        a: 'The City of Hialeah’s Building Division. It mails letters each year to the owners of the buildings that are due, and the report goes back to that same office. Send us the letter — a phone photo is enough — and we confirm what it asks for and by when.',
      },
      {
        q: 'Does Hialeah have its own recertification forms?',
        a: 'Yes. The city posts fillable structural and electrical report forms under its own name, together with the guidelines, the two parking-lot documents and a sample letter of compliance. The complete package we deliver goes on the forms the city’s page lists.',
      },
      {
        q: 'What happens in Hialeah if the recertification report is late?',
        a: 'The city’s page says the building is deemed unsafe and non-compliant, that the owner is called to a hearing before the city’s Special Magistrate, and that the Certificate of Occupancy may be revoked. Already past the date on your letter? Send it anyway: the first step is the inspection and the report.',
      },
      {
        q: 'How long do we have to recertify a building in Hialeah?',
        a: 'The time is the county’s, counted from the notice: it is in the rows above, under the time to file and the time for repairs. Hialeah’s own page gives no number of days — it speaks of “the allotted time” — so the date on your letter is the one to go by.',
      },
      {
        q: 'Is Hialeah’s recertification the same as the 40-year recertification?',
        a: 'Yes. Several of the city’s documents still use that name. The program is Miami-Dade County’s building recertification, which Hialeah’s Building Division administers inside the city; the first inspection now falls due earlier than the old name says.',
      },
    ],
    nextStep:
      'Send the letter from Hialeah’s Building Division — a phone photo is enough — or, with no letter yet, the address and the year built. We read what the city is asking for and reply with a proposal for the complete recertification.',
  },
  {
    slug: 'coral-gables',
    program: 'building-recertification',
    city: 'Coral Gables',
    place: 'Coral Gables',
    office: {
      name: 'City of Coral Gables Building Division',
      address: ['427 Biltmore Way', 'Coral Gables, FL 33134'],
      phone: '(305) 460-5229',
    },
    description:
      'Building recertification in Coral Gables: the Building Division’s notices, filing through the city’s portal and what one team delivers, complete.',
    heroSub:
      'Coral Gables’ Building Division mails the notices, and the reports are uploaded to the city’s permitting portal. Already late? One team still delivers yours complete, on Miami-Dade’s templates.',
    lede:
      'In Coral Gables the City of Coral Gables Building Division mails the notices for the county’s building recertification. The completed report is prepared on Miami-Dade’s templates and uploaded to the city’s permitting web portal.',
    local: [
      { k: 'The notice', v: 'The Building Division mails a Notice of Required Recertification to the owners of the buildings the program applies to; courtesy notices are also mailed ahead of it so that owners can prepare. Coral Gables’ program page also links, year by year, a Building Recertification List of the city properties required to recertify.' },
      { k: 'Filing the report', v: 'The completed report goes to the Building Official, uploaded electronically to what the program page calls the City’s permitting web portal. The Permit Requirements guide adds that the filing follows the city’s Electronic Submittal Guide, which covers digital signing and sealing and asks for PDF files.' },
      { k: 'The city’s forms', v: 'Coral Gables’ page asks for the report on Miami-Dade’s report templates. The Permit Requirements guide lists Miami-Dade County forms — the structural recertification, the building photos and the electrical recertification among them — and the program page points to guidelines for the structural component and for the electrical component of the report.' },
      { k: 'What goes with it', v: 'By Coral Gables’ page, a completed report includes the structural report, the electrical report and the professional’s cover letter or letters certifying that the electrical system and the building structure are safe for the intended use and occupancy. The same list has two parking-lot certification forms, one for guardrails and one for illumination, filed where they apply.' },
      { k: 'Additional files', v: 'With more than one building on the property, the city’s page asks for a site plan or survey that shows each building and clearly identifies the one the report covers. The Permit Requirements guide adds, if applicable, an infrared thermography inspection (which the guide ties to amperage), a Preliminary Inspection Report and a request for time extension.' },
      { k: 'After filing', v: 'Once the structure is in compliance, Coral Gables issues a Building Recertification letter. The program page does not describe the review before that letter. For permits in general, the city’s FAQ says reviewer comments are posted in the Citizen Self Service (CSS) Portal and corrections are also e-mailed; the Electronic Submittal Guide has corrections uploaded through a “Resubmit” button, with a note explaining them.' },
      { k: 'Extensions', v: 'The city’s page says the Building Official may grant extensions for good cause, provided affidavits are accepted stating that the building can stay occupied while it is undergoing recertification or waiting for a permit or repairs. That is all the page says about repairs; the county’s time for them is in the rows above.' },
      { k: 'If it is late', v: 'Coral Gables’ page says that when the report is not submitted within the allotted time, the structure is deemed unsafe and non-compliant under the Miami-Dade County Code, and that not recertifying leads to a hearing with the City’s Construction Regulation Board. It adds that the Certificate of Occupancy may be revoked and that the Building Official may order the utilities disconnected.' },
    ],
    faq: [
      {
        q: 'What is the courtesy notice of required recertification that Coral Gables sent us?',
        a: 'Coral Gables’ page says courtesy notices are also mailed to property owners, ahead of time, so they can prepare for the recertification that is coming. It counts the time to file from receipt of the City’s Recertification Notice. Send us the one you are holding — a phone photo is enough — and we confirm what Coral Gables’ Building Division is asking for and by when.',
      },
      {
        q: 'How do we submit a recertification report in Coral Gables?',
        a: 'Electronically. The city’s page says the completed report is uploaded to the City’s permitting web portal — for permits, the city’s FAQ names the Citizen Self Service (CSS) Portal — and that no application is required to submit it. The Permit Requirements guide, though, has the line “Apply for: Building Recertification – Recertification”. Before anything is uploaded, we confirm with the Building Division which of the two it expects.',
      },
      {
        q: 'How long do we have to recertify a building in Coral Gables?',
        a: 'Coral Gables’ page counts the time from receipt of the City’s Recertification Notice (the number of days is the county’s, in the rows above), so keep the notice and note the day it arrived. The page also says the Building Official may grant extensions for good cause, provided affidavits are accepted stating that the building can stay occupied.',
      },
      {
        q: 'Which buildings in Coral Gables are exempt from recertification?',
        a: 'Coral Gables’ page says the only structures exempt are single-family residences, duplexes and minor structures; a note defines minor structures by the county code’s limits on occupant load and gross area. One caution when you read that page: the line under its title still gives the earlier age and the text below it another, while the ages in force are the county’s, in the rows above.',
      },
      {
        q: 'What happens in Coral Gables if we do not file the recertification report on time?',
        a: 'The city’s page says the structure is then deemed unsafe and non-compliant and that a hearing with the City’s Construction Regulation Board follows; the Certificate of Occupancy may be revoked and the Building Official may order the utilities disconnected. If the date on your Coral Gables notice has passed, send it to us all the same: we read it with the building’s history and reply with a proposal for the complete recertification.',
      },
    ],
    nextStep:
      'Send the notice from the City of Coral Gables Building Division — a courtesy notice too; a phone photo is enough — or, with no notice yet, the address and the year built. We confirm what Coral Gables asks for and by when, and reply with a proposal for the complete recertification.',
  },
  {
    slug: 'doral',
    program: 'building-recertification',
    city: 'Doral',
    place: 'Doral',
    office: {
      name: 'City of Doral Building Department',
      address: ['8401 NW 53rd Terrace', 'Doral, FL 33166'],
      phone: '(305) 593-6700',
    },
    description:
      'Building recertification in Doral: how the Building Department takes the reports, what must go with them and what one team delivers, complete.',
    heroSub:
      'Doral’s Building Department runs the recertification: reports go in at City Hall or through the city’s permitting system. Already late? One team still delivers it complete, on the county templates Doral accepts.',
    lede:
      'In Doral the recertification sits with the city’s Building Department, which lists it among its programs and publishes a guide of its own. The city’s page says that, in addition to its local ordinances, Doral follows and enforces the Code of Miami-Dade County. The city accepts the county’s document templates for the reports.',
    local: [
      { k: 'The notice', v: 'Doral’s page says the owners of the properties that require certification receive a Notice of Required Recertification, which starts the process, and that a record is created in the city’s permitting system. Doral’s pages do not say how the notice is delivered. For the portal account, the page sends every user to the city’s Videos and Tutorials page.' },
      { k: 'Filing the report', v: 'The Doral Building Department’s guide gives two routes. In person, the completed reports go to the solution center on the second floor of Doral City Hall. Online, the applicant creates a contact in the city’s permitting system — CSS, the Citizen Self-Service portal — searches for “Building Recertification” and selects apply. The program page adds a caution for an initial recertification; see the first question below.' },
      { k: 'Digital or paper', v: 'Doral’s page wants each page of the structural and electrical reports signed and sealed, unless the report is submitted electronically with a verifiable digital signature. Per the guide, digital signatures can only be transmitted electronically; a wet or hard seal must be submitted in person. The page’s tip: save the file as a PDF before the signature goes on, so the uploaded report is unlocked.' },
      { k: 'The city’s forms', v: 'Doral’s guide says Miami-Dade County’s document templates are accepted, and the program page points to the county’s page for the templates and forms. It also notes that the guidelines and report templates were revised, with the approval of the Board of Rules and Appeals. The complete recertification we deliver goes on those templates.' },
      { k: 'What goes with it', v: 'Among its minimum documents, Doral’s guide lists a structural and an electrical cover letter, each signed, sealed and dated, and, where the rating of the building’s electrical service requires it, a thermographic inspection report. Doral’s program page adds, for a property with more than one building, a site plan or survey that locates each and clearly identifies the one the report is about.' },
      { k: 'Extensions', v: 'Doral’s page says a one-time extension, of a length the page sets, is permissible provided the building is safe to occupy. The request is a signed and sealed letter from the professional of record, e-mailed to the Building Official. The letter must include, among other items, confirmation that the building is safe to occupy while the final report is issued, and whether repairs are needed.' },
      { k: 'If it is late', v: 'Doral’s page says that expired processes, and buildings that have failed to be recertified, will be referred to code compliance for immediate action. It does not say what that action is, and it names no hearing body. The time Doral’s owners have to file is the county’s, in the rows above.' },
      { k: 'Older names', v: 'Doral’s guide and its department directory still label the Building Recertification Program as the former 40-year recertification, and the city’s tutorials page sends owners to its “Building Milestone page” for the requirements to recertify a building. The program page also still carries dates that have already passed; the ages and days in force are the county’s, in the rows above.' },
    ],
    faq: [
      {
        q: 'Can we file our first recertification report online in Doral?',
        a: 'Doral’s pages leave that open. The guide describes an online application, but the program page says the permitting system accepts “renewal” recertification reports, after an initial recertification, and tells applicants not to apply for an “initial Building Milestone recertification” through that work class. The guide’s other route is in person, at Doral City Hall. Send us the letter and we confirm with the Building Department which route your building takes.',
      },
      {
        q: 'Does Doral ask for the parking-lot documents in a recertification?',
        a: 'In part. Doral’s guide lists the parking-lot lighting requirements among its minimum documents, so that part goes in where it applies to the property. The guardrail document is another matter: the city’s page says the parking-lot guardrail requirement is not required for the City of Doral and applies to unincorporated Miami-Dade County only. We confirm with the Building Department what your property’s package must carry.',
      },
      {
        q: 'Which buildings in Doral do not go through recertification?',
        a: 'Doral’s pages list single-family homes, duplexes and buildings within the occupant-load and floor-area limits they give. Per the guide, an owner who believes a building is exempt requests the exemption by e-mail to the program’s address, with the full property address and the reasoning.',
      },
      {
        q: 'What happens after we file the recertification report in Doral?',
        a: 'Doral’s pages do not describe the review: who reads the report, how the owner hears back or what closes the case. What they give is a reference: each building in process is assigned a number that begins with “BDAD”. The page says file names and letters can carry it, with the words “Building Recertification”. Questions go to the e-mail address Doral gives for the program.',
      },
      {
        q: 'What does Doral say about repairs after the recertification report?',
        a: 'Doral’s recertification page has no section on repairs. Its one mention is in the extension request: the letter must indicate whether repairs are needed and confirm that the building is safe to occupy while the final report is issued. The time allowed for repairs in Doral is the county’s and is in the rows above. What the Building Department asks for the repairs themselves, we confirm with the office.',
      },
    ],
    nextStep:
      'Send the Notice of Required Recertification for your Doral building — a phone photo is enough — or, with no notice yet, the address and the year built. We read it, confirm what Doral’s Building Department is asking for and by when, and reply with a proposal for the complete recertification.',
  },
  {
    slug: 'north-miami',
    program: 'building-recertification',
    city: 'North Miami',
    place: 'North Miami',
    office: {
      name: 'City of North Miami Building Department',
      address: ['12340 NE 8th Avenue', 'North Miami, FL 33161'],
      phone: '(305) 895-9820',
    },
    description:
      'Building recertification in North Miami: what the city’s page says, the county-approved forms it posts and what one team delivers, complete.',
    heroSub:
      'North Miami counts recertification among its Building Department’s services and posts the county-approved forms. Already late? On those forms, one team still delivers the complete recertification.',
    lede:
      'The City of North Miami Building Department lists recertification among the services it provides, and the city keeps a page on the program. That page is brief: it says which buildings are covered, posts the county-approved forms, names a Building Officer as its contact and points to Miami-Dade County’s recertification page for guidance.',
    local: [
      { k: 'The notice', v: 'North Miami’s page does not say who sends the notice or how it arrives. It mentions the notice only under the exemptions: if one is received, it is the owner’s responsibility to request an exemption in writing from the Building Official. The structural form the city posts asks for the date of the Notice of Required Inspection, so keep the letter.' },
      { k: 'Who is exempt', v: 'North Miami’s page says all buildings and structures are covered except single-family residences and duplexes, agricultural exempt buildings, and minor buildings within both a floor-area limit and an occupancy limit. It adds that both conditions must apply, and that the occupancy counted is the potential load for the building’s use classification in the code.' },
      { k: 'The city’s forms', v: 'North Miami posts four documents under the heading “Miami-Dade County Approved forms for Report Submittal”. Two are the report forms — the structural and the electrical recertification inspection guidelines — and the structural one is marked “MDC Building Recertification Structural Report”; the other two are parking-lot certifications.' },
      { k: 'What goes with them', v: 'The two parking-lot documents are certifications of compliance, one for parking-lot guardrails and one for parking-lot illumination; North Miami lists both, and each goes in where it applies to the property. The electrical form the city posts also has a section for thermography results, filled in where the building’s electrical service requires that inspection.' },
      { k: 'Filing the report', v: 'North Miami’s page does not say how or where the report is filed, or what happens once it is in: it names no portal, no e-mail address and no counter for it. Its contact for the program is a Building Officer at the Building Department’s phone number. The letter and that office settle the way to file; we confirm it with the department first.' },
      { k: 'Repairs', v: 'North Miami’s recertification page says nothing about permits for repairs. The city’s guardrail certification does: where there is no complying guardrail, it records that the owner has been advised to obtain a permit to install one. Separately, the city’s online permitting page — which is about permits in general — says scopes of work outside its online list need an in-person application.' },
      { k: 'If it is late', v: 'North Miami’s page prints no deadline of its own, and it does not say how an extension is requested or what follows a late report. For guidance and questions it points to Miami-Dade County’s recertification page. The county’s times to file and to repair are in the rows above.' },
      { k: 'The program’s name', v: 'North Miami’s page is titled “Milestone Recertification”, followed by the cycle in years. It is the program still called the 40-year recertification: the page recounts its origin and says Miami-Dade has since shortened the inspection cycle. Its forms are the ones the county approves for the report; the ages in force are in the rows above.' },
    ],
    faq: [
      {
        q: 'How do we file a recertification report in North Miami?',
        a: 'North Miami’s page does not say. It posts the forms and names a Building Officer as its contact, but it gives no portal, e-mail address or counter for the report. Your letter and the Building Department settle it, and we confirm the way to file with that office before the complete recertification goes in.',
      },
      {
        q: 'Does North Miami have its own recertification forms?',
        a: 'It posts four, and they are county-approved forms: the city’s page lists them as “Miami-Dade County Approved forms for Report Submittal”. They are the structural and the electrical report forms and two parking-lot certifications, for guardrails and for illumination, which go in where they apply. The complete recertification we deliver goes on the forms North Miami lists.',
      },
      {
        q: 'Which buildings in North Miami are exempt from recertification?',
        a: 'North Miami’s page says all buildings and structures are covered except three groups: single-family residences and duplexes, agricultural exempt buildings, and minor buildings within both a floor-area limit and an occupancy limit. The page adds that if a recertification notice is received, it is the owner’s responsibility to request an exemption in writing from the Building Official.',
      },
      {
        q: 'What is the deadline for recertification in North Miami?',
        a: 'North Miami’s page prints none: for guidance it points to Miami-Dade County’s recertification page, and it does not say what follows a late report. The county’s times to file and to repair are in the rows above; the date that counts is the one on your own letter. If that date has passed, send us the letter all the same and we ask the Building Department what it now expects.',
      },
      {
        q: 'Is North Miami’s “Milestone Recertification” the same as the 40-year recertification?',
        a: 'Yes. North Miami’s page tells the county program’s history, from its origin to the changes Miami-Dade adopted, which shortened the inspection cycle; the first inspection now comes due sooner than the old name suggests. The forms North Miami posts are the ones the county approves for the report, and the ages in force are in the rows above.',
      },
    ],
    nextStep:
      'Send us your recertification letter — a phone photo is enough — or, with no letter yet, the address and the year built. We read it, confirm with North Miami’s Building Department what it asks for and by when, and reply with a proposal for the complete recertification.',
  },
  {
    slug: 'north-miami-beach',
    program: 'building-recertification',
    city: 'North Miami Beach',
    place: 'North Miami Beach',
    office: {
      name: 'City of North Miami Beach Building Department',
      address: ['17050 NE 19th Avenue, 1st Floor', 'North Miami Beach, FL 33162'],
      phone: '(305) 948-2965',
    },
    description:
      'Building recertification in North Miami Beach: how the city notifies owners, where the report is filed and what one team delivers, complete.',
    heroSub:
      'North Miami Beach’s Building Department gives notice by certified mail; its Governmental Compliance Section takes in the report. Already late? One team still delivers the complete recertification on North Miami Beach’s own forms.',
    lede:
      'In North Miami Beach the recertification runs through the City of North Miami Beach Building Department. The department notifies the owner by certified mail, the completed report goes to its Governmental Compliance Section for review and approval, and the Building Official issues the approval letter.',
    local: [
      { k: 'The notice', v: 'North Miami Beach’s owner-notification sheet says that when a building is due, the Building Department sends a notice to the owner or the owner’s representative by certified mail. The notice the city posts names a contact person, with a phone and an e-mail, for further information. Keep the letter: the same sheet counts the time to file from its receipt.' },
      { k: 'Filing the report', v: 'The city’s recertification page sends the completed report to the Governmental Compliance Section of the Building Department; one of the city’s sheets names the department’s Engineering Section instead. None of these pages says how the report is delivered: no portal, counter or e-mail is given for it. So we confirm it with North Miami Beach’s Building Department before the report goes in.' },
      { k: 'The city’s forms', v: 'North Miami Beach posts its own structural and electrical report forms, each under the Building Department’s heading. The guidelines North Miami Beach posts with them say the approved report forms provided must be used and that proprietary forms will not be accepted. The complete recertification we deliver goes on North Miami Beach’s forms.' },
      { k: 'What goes with them', v: 'The city’s owner-notification sheet says the report also includes an illumination survey for the parking areas, and that recertification reports bear an impressed seal and signature. North Miami Beach’s guidelines call for an infrared thermography inspection, with a written report, where the building’s electrical service reaches the size they set.' },
      { k: 'After filing', v: 'Once the reports are approved, the Building Official issues a Building Recertification approval letter, sent to the owner and to the professional of record; the city says to retain it as proof of approval. North Miami Beach’s guidelines add that reports may be audited, and the building inspected, at the Building Official’s discretion.' },
      { k: 'Repairs', v: 'North Miami Beach says the owner must hire a Florida-licensed contractor and obtain Building Department permits before any repair or modification. Once every permit has an approved final inspection, a signed and sealed report must state that the repairs are complete and the building is structurally and electrically safe for continued use; the time for the repairs is in the rows above.' },
      { k: 'Extensions', v: 'North Miami Beach’s pages describe no form or procedure for asking for more time. The guidelines the city posts say only that repairs being conducted under a permit afford additional time to comply with a complete recertification report. How that applies to a given building is a question for the North Miami Beach Building Department.' },
      { k: 'If it is late', v: 'The city’s sheets say a report not filed within the time limit brings a Building Violation, and that the Notice of Violation is posted on the building and mailed to the owner of record by certified mail. North Miami Beach’s Violation of Recertification Process sheet adds that if the owner does not respond, the violation is referred to the Unsafe Structure Board for a hearing.' },
    ],
    faq: [
      {
        q: 'Where do we file the recertification report in North Miami Beach?',
        a: 'North Miami Beach’s recertification page sends the completed report to the Governmental Compliance Section of its Building Department; the page does not say whether that is done online, by e-mail or at the counter. A city sheet names a contact, by e-mail or phone, to start the process. The department’s Important Notice page asks clients to sign into its Q-Less system to be seen in a timely manner — a general notice, not one about recertification.',
      },
      {
        q: 'Does our building in North Miami Beach have to be recertified?',
        a: 'The city’s recertification page covers all buildings except single-family residences, duplexes and minor structures, and it defines a minor building by a maximum occupant load and gross area. It treats condominium and cooperative buildings near the coastline, from a set height up, as a separate group with an earlier first recertification. North Miami Beach’s page gives ages for both groups; the ones in force are in the rows above.',
      },
      {
        q: 'What happens in North Miami Beach if the recertification report is late?',
        a: 'The city says a late report brings a Building Violation, with a Notice of Violation posted on the building and mailed to the owner of record by certified mail. Its Notice of Required Building Inspection goes further: a building not recertified within the time it gives after the Notice of Violation is declared unsafe and vacated at the owner’s expense. If your date has passed, send us the North Miami Beach notice all the same.',
      },
      {
        q: 'Is North Miami Beach’s recertification the same as the 40-year recertification?',
        a: 'Yes. The owner-notification sheet the city posts still calls the program by that former name. It is Miami-Dade County’s building recertification, run inside the city by the City of North Miami Beach Building Department; where a city sheet and the rows above differ on an age or a deadline, the rows above are the ones in force.',
      },
      {
        q: 'Do repairs for a North Miami Beach recertification need a permit?',
        a: 'The guidelines North Miami Beach posts say the initial report should be submitted as soon as it is complete and that repairs must not go ahead without permits; they also make legalizing an unpermitted addition a prerequisite to a successful recertification report. The permits come from the Building Department, whose Important Notice page says registered contractors can file permit applications of all types online.',
      },
    ],
    nextStep:
      'Send us the notice from the North Miami Beach Building Department — a phone photo is enough — or, with no notice yet, the address and the year built. We confirm what North Miami Beach is asking for and by when, and reply with a proposal for the complete recertification.',
  },
  {
    slug: 'aventura',
    program: 'building-recertification',
    city: 'Aventura',
    place: 'Aventura',
    office: {
      name: 'City of Aventura Building Division',
      address: ['19200 West Country Club Drive, 4th Floor', 'Aventura, FL 33180'],
      phone: '(305) 466-8937',
    },
    description:
      'Building recertification in Aventura: online filing with the Building Division, the forms the city lists and its own ordinance on engineering reports.',
    heroSub:
      'Aventura’s Building Division administers the recertification and receives the documents online. Already late? One team still delivers it complete, following the county guidelines the city’s page lists.',
    lede:
      'In Aventura the recertification is administered by the City of Aventura Building Division, in accordance with Miami-Dade County requirements. The notice comes from the city, which uses the county’s current guidelines, and the documents are filed electronically. Aventura also has ordinances of its own, on engineering reports and on yearly structural maintenance.',
    local: [
      { k: 'The notice', v: 'The letter comes from the City of Aventura, and the city’s page calls it a Notice of Required Building Recertification. An owner who receives one, the page says, must have the required inspections performed and submit the required documentation to the city. Aventura’s page does not say how or when the notice is sent.' },
      { k: 'The city’s forms', v: 'Aventura’s page says the city uses the current Miami-Dade County Building Recertification Guidelines, and it shows no form of the city’s own. Its list carries the county’s inspection guidelines, structural and electrical, and two parking-lot certifications, illumination and guardrails, which go in where they apply. The recertification packet in Aventura’s Document Center says the approved report forms must be used.' },
      { k: 'Filing the report', v: 'Aventura’s page says recertification documents must be submitted electronically to the Building Division, through the city’s online application submittal process. The instructions it links to are written for permit applications: the sender enters an e-mail address and drops the files into an upload box, and the city’s ePermits system sends its updates to that address.' },
      { k: 'After filing', v: 'The same instructions, written for permit applications, say the Building Division’s E-Permits team replies by e-mail, to confirm the submittal was accepted for review or to ask for what is missing. Aventura’s recertification packet adds that reports may be audited, that the building may be inspected at the Building Official’s discretion, and that the Building Official may rescind or revoke an approved report.' },
      { k: 'Repairs', v: 'Aventura’s recertification packet says the initial report should be submitted as soon as it is completed, and that repairs are not to proceed without permits. Aventura’s packet adds that repairs carried out under a permit afford additional time to comply with a complete recertification report.' },
      { k: 'Engineering reports', v: 'An ordinance of Aventura’s own says that when the president or property manager of a condominium, homeowners or cooperative association receives an engineer’s or architect’s report on a building’s structural, electrical or life safety conditions, it must be filed with the city by a deadline the ordinance sets. It goes in by e-mail, or by hand in both digital format and hard copy.' },
      { k: 'Reports posted online', v: 'Aventura’s Enhanced Building Safety Inspections Program page links to an online document center where the engineering reports the city receives are added as they come in. Earlier recertification documents are kept by the Building Division and will be added to it over time. Questions about a building’s status go to the Community Development Department.' },
      { k: 'Annual certification', v: 'Beside the county’s program, an Aventura ordinance requires an annual certification that a building’s structural systems have been maintained. The city’s form for it is the Annual Structural Maintenance Checklist, due each year by the date printed on it. Where an element needs repair or replacement, not just maintenance, an engineering report on those findings is attached.' },
    ],
    faq: [
      {
        q: 'How do we file a recertification report in Aventura?',
        a: 'Electronically. Aventura’s page says recertification documents must be submitted to the Building Division through the city’s online application submittal process. The instructions it links to were written for permit applications and say nothing specific to a recertification, so we confirm with the Building Division what the upload must contain before the package goes in.',
      },
      {
        q: 'Does Aventura have its own recertification forms?',
        a: 'Its recertification page shows none. Aventura says it uses the current Miami-Dade County Building Recertification Guidelines, and the page lists the county’s structural and electrical inspection guidelines together with the Certification of Compliance with Parking Lot Illumination Standards and the one for Parking Lot Guardrails Requirements, where they apply. The complete recertification we deliver goes on the approved forms; Aventura’s packet says proprietary ones will not be accepted.',
      },
      {
        q: 'Is Aventura’s annual structural maintenance certification the same as the recertification?',
        a: 'No. An Aventura ordinance asks for a certification, every year, that a building’s structural systems have been maintained, on the city’s Annual Structural Maintenance Checklist. It goes in by e-mail or by hand at the Aventura Government Center — by hand, with a hard copy and a digital copy. The recertification is the program the Building Division administers under Miami-Dade County requirements, for owners who receive the city’s notice.',
      },
      {
        q: 'Is Aventura’s building recertification the same as the 40-year recertification?',
        a: 'Yes: Aventura’s Enhanced Building Safety Inspections Program page, where the engineering reports are linked, still calls the county’s rule by its former name, the 40-year recertification code. It is the same program: the current page calls it the Building Recertification Program, which the Building Division administers in accordance with Miami-Dade County requirements. The current page prints no ages: the ones in force are the county’s, in the rows above.',
      },
      {
        q: 'How long do we have to recertify a building in Aventura?',
        a: 'The deadlines are the county’s and they are in the rows above; Aventura’s recertification page prints none of its own, so the letter itself is what to go by. Aventura’s packet says the initial report should be submitted as soon as it is completed, and that repairs done under a permit afford additional time to comply with a complete report. Aventura’s pages do not say what follows a late recertification report.',
      },
    ],
    nextStep:
      'Send the Notice of Required Building Recertification from the City of Aventura — a phone photo is enough — or, with no notice yet, the address and the year built. We confirm what the Building Division is asking for and by when, and reply with a proposal for the complete recertification.',
  },
  {
    slug: 'sunny-isles-beach',
    program: 'building-recertification',
    city: 'Sunny Isles Beach',
    place: 'Sunny Isles Beach',
    office: {
      name: 'City of Sunny Isles Beach Building Department',
      address: ['Government Center, 3rd Floor', '18070 Collins Avenue', 'Sunny Isles Beach, FL 33160'],
      phone: '(305) 947-2150',
    },
    description:
      'Building recertification in Sunny Isles Beach: the notice, what the Building Department asks for, repairs, extensions. One team delivers it complete.',
    heroSub:
      'Sunny Isles Beach’s Building Department lists what a recertification filing must contain and issues the repair permits. Already late? One team still delivers the complete recertification, on the forms the department posts.',
    lede:
      'Sunny Isles Beach runs the recertification through its Building Department. The department’s page sets out what owners submit once the notice arrives, what happens when repairs are needed and how an extension is requested. It does not say where the package is handed in.',
    local: [
      { k: 'The notice', v: 'The city’s page says owners of properties that require recertification receive a Notice of Required Recertification, which starts the process; further on it writes Notice of Required Inspection. It does not say who sends it in Sunny Isles Beach, or how. Keep the letter: the page counts the owner’s time from its date, and the days in force are in the rows above.' },
      { k: 'Filing the report', v: 'The city’s list of what to submit names a structural inspection report and an electrical inspection report, each signed and sealed, with copies, and asks that every form carry an original signature and a seal. The page names no portal or counter for the package, so we confirm with Sunny Isles Beach’s Building Department how it wants it delivered.' },
      { k: 'The city’s forms', v: 'The Building Department’s documents page has a section headed Building Recertification Forms, with a structural form, an electrical form and a general considerations and guidelines document. Those guidelines say the forms provided must be used and that proprietary forms are not accepted. The city ties both reports to the minimum inspection guidelines required by the Miami-Dade County Board of Rules and Appeals.' },
      { k: 'What goes with it', v: 'The same section posts two parking-lot documents, one on guardrails and one on illumination; each belongs in the package only where it applies to the property.' },
      { k: 'Repairs', v: 'Before any repair, the city’s page says, the owner hires a Florida licensed contractor and obtains permits from the Building Department; its permits page says every application is filed online, through a portal account. Once every permit passes final inspection, the recertification page calls for a signed and sealed report stating that the repairs are complete and the building is safe for continued use.' },
      { k: 'Extensions', v: 'The city’s page says the Building Official may grant an extension, up to a limit it states, to submit the report or to obtain the permits. It takes a written request from the professional, with a signed and sealed statement that the building may continue to be occupied while it undergoes recertification. Sunny Isles Beach’s page does not say where that request is sent.' },
      { k: 'If it is late', v: 'Sunny Isles Beach’s page says a property whose recertification is not obtained in time is referred to the Unsafe Structures Section and an enforcement case is opened. That section then monitors the process, and the page lists posting the building unsafe, a Notice of Violation, referral to the Unsafe Structures Board and orders to vacate among its steps.' },
      { k: 'A second notice', v: 'The same city page covers the recertification of structural glazing: owners of threshold buildings with an exterior façade of structural sealant glazing must have that façade inspected at intervals, and they receive a notice with its own name, the Notice of Required Recertification of Structural Glazing for Threshold Buildings. Read the title on your letter to see which of the two you hold.' },
    ],
    faq: [
      {
        q: 'What do we do first with a Notice of Required Recertification in Sunny Isles Beach?',
        a: 'The city’s page says that notice is what starts the process; what it asks owners to submit is a structural inspection report and an electrical one. How long you have is in the rows above, counted from the date on the notice. A phone photo of the letter is enough for us to read it and confirm what Sunny Isles Beach’s Building Department is asking for, and by when.',
      },
      {
        q: 'How do we file the recertification report in Sunny Isles Beach?',
        a: 'The city’s page lists what goes in but not where or how to hand it in: it names no portal, counter or mailbox for a recertification report, although permit applications in the city are filed through an online portal account. Nor does the Sunny Isles Beach page describe the review that follows. We confirm the route with the city’s Building Department before the package goes in.',
      },
      {
        q: 'What happens in Sunny Isles Beach if the recertification is late?',
        a: 'The city’s page says the property is referred to the Unsafe Structures Section and an enforcement case is opened. It names what that can include: the building posted as unsafe, a Notice of Violation, referral to the Unsafe Structures Board, orders to vacate. Is the date on your Sunny Isles Beach notice already behind you? Send it all the same; the page says the recertification process goes on under that section’s watch.',
      },
      {
        q: 'Can we ask Sunny Isles Beach for more time to file the recertification report?',
        a: 'The city’s page allows for it, within a limit it sets: the Building Official may grant an extension to submit the report or to obtain the permits. The request is made in writing by the professional and must include a signed and sealed statement that the building may continue to be occupied while it undergoes recertification. A letter from the board alone is not what the Sunny Isles Beach page describes.',
      },
      {
        q: 'Is Sunny Isles Beach’s recertification the same as the 40-year recertification?',
        a: 'Yes: the 40-year recertification is the former name of the program Sunny Isles Beach’s Building Department runs today. The city’s page uses that name when it speaks of earlier inspections: it says buildings built up to a cut-off year that already had a first inspection through “Miami-Dade’s 40-Year program” continue on their established schedule. For a Sunny Isles Beach building today, the ages in force are the county’s, in the rows above.',
      },
    ],
    nextStep:
      'Send us your Notice of Required Recertification — a phone photo is enough — or, with no notice yet, the building’s address and the year built. We confirm what the City of Sunny Isles Beach Building Department is asking for and by when, and reply with a proposal for the complete recertification.',
  },
  {
    slug: 'miami-gardens',
    program: 'building-recertification',
    city: 'Miami Gardens',
    place: 'Miami Gardens',
    office: {
      name: 'City of Miami Gardens Building Services',
      address: ['18605 NW 27th Avenue', 'Miami Gardens, FL 33056'],
      phone: '(305) 622-8027',
    },
    description:
      'Building recertification in Miami Gardens: the city’s own report forms, its extension request, the CSS portal and what one team delivers, complete.',
    heroSub:
      'The city’s Building Services lists recertification among its services and posts its own report forms. Already late? One team still delivers your Miami Gardens recertification complete, on those forms.',
    lede:
      'The city’s website has no page of its own that explains the recertification. What it has is this: City of Miami Gardens Building Services lists the program among its services, and its Documents and Forms page keeps a Recertification group with the city’s report forms, the county’s guidelines and an extension request.',
    local: [
      { k: 'The notice', v: 'The city’s website does not say who sends the Notice of Required Inspection, or how it reaches the owner. On the site the notice appears only as a date to fill in: the city’s structural report form asks for the date of that notice, and its extension request has a line marked Notice Date. Keep the letter, so the date is at hand.' },
      { k: 'The city’s forms', v: 'Miami Gardens lists its own structural and electrical report forms — each titled with the city’s initials, CMG — in the Recertification group of its Documents and Forms page. The guidelines in that group are Miami-Dade County’s; they say the approved report forms must be used and that proprietary forms will not be accepted.' },
      { k: 'What goes with them', v: 'The city also posts two certifications for the parking lot — illumination and guardrails — which are filed where they apply to the property. The guidelines ask for a cover letter with each report, and the electrical form has a section for infrared thermography, where the building’s electrical service requires it, with the thermography report attached.' },
      { k: 'Filing the report', v: 'The page that lists these forms opens with one general instruction: building forms are to be completed and submitted as attachments to an online permit application in CSS, the city’s Citizen Self Service portal, as required. The site has no filing instruction written for the recertification report in particular, so we confirm with Building Services how yours is to be filed before anything goes in.' },
      { k: 'After filing', v: 'The city’s site does not describe its review or say how an owner learns the result. The county guidelines it posts say that recertification reports may be audited, that the building may be inspected at the discretion of the Building Official, and that the Building Official keeps the right to revoke an approved report.' },
      { k: 'Repairs', v: 'The guidelines Miami Gardens posts say that repairs the report identifies will most likely need permits, that proceeding without them may lead to a code violation, and that repairs under a permit afford additional time to comply. The city’s structural form has a box for the amended report, after completion of repairs, and asks whether the building can remain occupied while they are ongoing.' },
      { k: 'Extensions', v: 'The city has its own form, titled Recertification Extension Request. It is written as a letter from the owner, the owner’s agent or the contractor that gives the reasons for the request, and it is sworn before a notary. A line on it records the number of days granted; the site does not say where the form is sent.' },
      { k: 'Older names', v: 'The Building Services page still lists the program as “40 Year Re-Certifications”, and the city’s extension request still calls it the 40-year recertification. The report forms the city posts say building recertification, and that is the program meant. The ages and the days in force are the county’s, in the rows above.' },
    ],
    faq: [
      {
        q: 'Who sends the recertification notice in Miami Gardens?',
        a: 'The city’s website does not say who sends it or how. It does show that City of Miami Gardens Building Services lists recertification among its services, and that the city’s report form asks for the date of the Notice of Required Inspection. Your letter settles the question: a phone photo of it is enough for us to read what it asks for and by when.',
      },
      {
        q: 'How do we file a recertification report in Miami Gardens?',
        a: 'The site gives no instruction of its own for the recertification report. The city’s forms page says its building forms are to be submitted as attachments to an online permit application in CSS — the Miami Gardens Citizen Self Service portal — and the county guidelines posted there say the initial report should go to the local jurisdiction as soon as it is completed. We confirm the route with Building Services before the complete recertification goes in.',
      },
      {
        q: 'How do we request a recertification extension in Miami Gardens?',
        a: 'The city has a form for it, titled Recertification Extension Request. It is a letter from the owner, the owner’s agent or the contractor that states the reasons, has a line marked Notice Date and is sworn before a notary. The form also has a line for the days granted; the site does not say how long an extension runs or where the form is delivered, so that is a question for Building Services.',
      },
      {
        q: 'What happens in Miami Gardens if the recertification report is late?',
        a: 'The city’s website does not say. What the city does publish is a form to request an extension. If the date on your letter has passed, send the letter anyway — the work starts with the inspection and the report either way.',
      },
      {
        q: 'Is Miami Gardens’ recertification the same as the 40-year recertification?',
        a: 'Yes. The Building Services page still lists it as “40 Year Re-Certifications”, and the city’s extension request still uses that name, while the report forms the city posts carry the title Building Recertification Inspection Report Form. It is Miami-Dade County’s program, with the county’s guidelines posted among the city’s forms; the ages in force today are in the rows above.',
      },
    ],
    nextStep:
      'Send the letter about your Miami Gardens building — a phone photo is enough — or, with no letter yet, the address and the year built. We read it, confirm what Building Services is asking for and by when, and reply with a proposal for the complete recertification.',
  },
  {
    slug: 'homestead',
    program: 'building-recertification',
    city: 'Homestead',
    place: 'Homestead',
    office: {
      name: 'City of Homestead Development Services, Building Safety',
      address: ['100 Civic Court', 'Homestead, FL 33030'],
      phone: '(305) 224-4500',
    },
    description:
      'Building recertification in Homestead: the notice, the city’s online portal, the report templates it lists and what one team delivers, complete.',
    heroSub:
      'Homestead’s Building Safety office, within Development Services, publishes the county’s recertification ordinance and the report templates. Already late? One team still delivers your recertification complete, on those templates.',
    lede:
      'Homestead keeps its recertification page under City of Homestead Development Services, Building Safety, which the city’s other pages call the Building Department. The page says how the process starts and what owners must submit, and links the report templates approved by the Board of Rules and Appeals. For repairs, extensions and late reports, what the city publishes is the county ordinance, on its own letterhead.',
    local: [
      { k: 'The notice', v: 'Homestead’s page says owners receive a Notice of Required Recertification, and that the notice starts the process. The county ordinance, in the copy the city publishes, calls it the Notice of Required Inspection, says the Building Official provides it, and adds advance courtesy notices ahead of the recertification anniversary year.' },
      { k: 'Filing the report', v: 'Homestead’s recertification page does not say how the report is filed. Elsewhere the city names its online portal, EPL-B.U.I.L.D, and lists Building Recertification among the requests customers can submit and track there. We confirm the route with Homestead’s Building Department before the package goes in.' },
      { k: 'The city’s forms', v: 'Homestead’s page offers the guidelines and report templates approved by the Board of Rules and Appeals (BORA), and says they have been revised. The general guidelines it links are Miami-Dade County’s own document. The complete package goes on the templates that page lists.' },
      { k: 'What goes with it', v: 'The same list on Homestead’s page carries a parking-lot illumination certification and a parking-lot guardrails certification; they go in where they apply to the property. Homestead’s copy of the county ordinance says the report bears an impressed seal and signature unless it is submitted electronically with a verifiable digital signature.' },
      { k: 'After filing', v: 'Homestead’s recertification page does not describe how a report is reviewed or how the owner hears the result. Of its portal, the city says users can upload documents and track progress in one place. Homestead’s copy of the ordinance adds that the Building Official may revoke a recertification on determining that the report misrepresents the building’s actual conditions.' },
      { k: 'Repairs', v: 'The ordinance copy on Homestead’s letterhead says the Building Official is given a letter stating whether the building may continue to be safely occupied while it is under repair, and calls for an amended report stating that the building has been recertified. Repairs that need permits, it says, follow the Building Code and the timeline in the active permit.' },
      { k: 'Extensions', v: 'Homestead’s copy of the county ordinance says the Building Official may issue an extension, limited in length, to submit the report or to obtain the necessary permits, on a written request. The request must contain a signed and sealed statement that the building may continue to be occupied while it undergoes recertification.' },
      { k: 'If it is late', v: 'Homestead’s own page does not say what follows a late report. The county ordinance the city republishes says the Building Official may order a building’s electrical utilities disconnected on finding that the inaction leaves it uncertain whether the building may continue to be safely occupied — and must first notify the owner by certified mail and post a notice on the building.' },
    ],
    faq: [
      {
        q: 'What does a Notice of Required Recertification from Homestead mean?',
        a: 'It starts the process. The city’s page says owners of the properties that require certification receive that notice, and that they must submit written reports certifying each building is structurally and electrically safe for continued occupancy. How long Homestead owners have to file is the county’s rule, in the rows above. A phone photo of the notice is enough for us to confirm what the city asks for and by when.',
      },
      {
        q: 'How do we file a recertification report in Homestead?',
        a: 'Homestead’s recertification page does not say. The city’s pages about its online portal, EPL-B.U.I.L.D, list Building Recertification among the requests handled there, and the portal’s questions page says in general terms that applications and documents must be submitted online, though customers are still welcome to come in for assistance. Send us the notice and we confirm the route with the Building Department first.',
      },
      {
        q: 'Which buildings in Homestead do not go through recertification?',
        a: 'Homestead’s page names them: single-family homes, duplexes, and small buildings that stay within both an occupant-load limit and a floor-area limit printed on that page. For Homestead buildings that do go through it, the ages are the county’s, in the rows above. Not sure which group yours is in? Send the address and the year built, and we read the building’s history before we reply.',
      },
      {
        q: 'What happens in Homestead if the recertification report is late?',
        a: 'Homestead’s own page does not say. The county ordinance the city republishes says the Building Official may order the electrical utilities disconnected on determining that the inaction creates uncertainty about whether the building may continue to be safely occupied, and only after notice by certified mail and a notice posted on the building. If the date on your Homestead notice has already passed, send it all the same — a phone photo is enough.',
      },
      {
        q: 'Is Homestead’s recertification the same as the 40-year recertification?',
        a: 'Yes. Homestead’s recertification page still calls it the 40-year recertification process and still carries the earlier schedule. It is the same program — Miami-Dade County’s, under the ordinance the city republishes on its letterhead. The ages and the days in force today are the county’s, in the rows above; go by those and by the date on your notice.',
      },
    ],
    nextStep:
      'Have a Notice of Required Recertification from Homestead? Photograph it with your phone and send it to us; without one, the address and the year built will do. We check what the Building Department wants and by when, then answer with a proposal for the complete recertification.',
  },
  {
    slug: 'surfside',
    program: 'building-recertification',
    city: 'Surfside',
    place: 'Surfside',
    office: {
      name: 'Town of Surfside Building Department',
      address: ['9293 Harding Avenue', 'Surfside, FL 33154'],
      phone: '(305) 861-4863',
    },
    description:
      'Building recertification in Surfside: the certified-mail notice, the Town’s CSS portal, repairs, late reports. One team delivers it complete.',
    heroSub:
      'Surfside’s Building Department sends the notice by certified mail and takes applications through its CSS portal only. Already late? One team still delivers your Surfside building’s complete recertification, on the approved report forms.',
    lede:
      'In Surfside the recertification runs through the Town of Surfside Building Department, which receives the reports for review and approval. Its program page explains how owners are notified and what a late report leads to; a separate sheet of instructions covers the filing, which goes only through the Town’s Customer Self Service portal, CSS.',
    local: [
      { k: 'The notice', v: 'Surfside’s program page says the Building Department sends a notice by certified mail to the owner or the owner’s representative when a building is due. Keep that certified letter: the Town’s page counts the owner’s time from it. The Town Code provides for courtesy notices ahead of the recertification’s anniversary date, and says a failure to provide them does not release the owner from recertifying.' },
      { k: 'Filing the report', v: 'Surfside’s instructions say recertification applications are accepted through the Town’s CSS portal only, and hard copies are not. The application type those instructions name still carries the program’s former 40-year name. The same sheet asks applicants not to e-mail the Building Official or the Town Manager: the package may not be received or processed.' },
      { k: 'The city’s forms', v: 'The Building Recertification Package on the Town’s site opens with Miami-Dade County’s General Considerations and Guidelines, which say the approved report forms must be used and proprietary forms are not accepted. Surfside’s instructions begin with a permit application, printed and filled out, and the Building Department’s forms page says its forms are fillable online and electronic notarization is accepted.' },
      { k: 'The files', v: 'Surfside’s instructions ask for the recertification package in a separate PDF file, divided by discipline. Encrypted files and files with third-party signatures are not processed: plan reviewers must be able to mark them up. The program page asks for an impressed seal and signature; the Town’s site does not say how an uploaded PDF meets that, so we confirm it with the Building Department.' },
      { k: 'After filing', v: 'Once the application is processed, the Town’s permit technician e-mails a receipt that carries the application number. The report goes to the Building Department for review and approval, and after the package is reviewed the clerk contacts the applicant about the recertification letter, whose issuance is the last step in Surfside’s instructions. The Town’s site gives no review time.' },
      { k: 'Repairs', v: 'Surfside’s program page says repairs or modifications the inspection finds necessary are to comply with the Florida Building Code, and it counts the owner’s time for them from the notice of required inspection. What that time is for a Surfside building today is in the rows above. That page is silent on permits for those repairs and on an amended report afterwards.' },
      { k: 'Extensions', v: 'Surfside’s program page and its filing instructions say nothing about extensions. The Town Code does: the Building Official may grant an extension of a set length for building recertification, and may renew it at the Building Official’s discretion. The Town’s site does not describe how to ask for one, so that is a question for the Building Department.' },
      { k: 'If it is late', v: 'Surfside’s program page says a late report brings a building violation. The Notice of Violation is posted on the building and mailed to the owner by certified mail; if the owner does not respond, it goes to the Town’s Special Master for a hearing. If the Building Official finds the structure unsafe, the matter goes to the Miami-Dade County Unsafe Structures Board.' },
    ],
    faq: [
      {
        q: 'How do we file a recertification report in Surfside?',
        a: 'Through the Town’s CSS portal, and only there: Surfside’s instructions say hard copies are not accepted, and ask applicants not to e-mail the Building Official or the Town Manager. The first step on the portal is registering an account; the application then goes under the building recertification type, with the package in a separate PDF file. The complete recertification we deliver for a Surfside building goes on the report forms the Town’s site calls for.',
      },
      {
        q: 'How long do we have to file the recertification report in Surfside?',
        a: 'For a Surfside building the days are the county’s, and they are in the rows above. The Town’s program page counts the owner’s time from the notice the Building Department sends by certified mail, so keep that letter and its date. The Town Code also lets the Building Official grant an extension and renew it at the Building Official’s discretion; the Town’s site does not say how to ask for one.',
      },
      {
        q: 'What happens in Surfside if the recertification report is late?',
        a: 'The Town’s program page says a building violation is issued: the Notice of Violation is posted on the building and mailed to the owner. If the owner does not respond, it goes to the Town of Surfside Special Master for a hearing; if the Building Official finds the structure unsafe, the matter goes to the county’s Unsafe Structures Board. If the date on your Surfside notice has passed, send it to us all the same.',
      },
      {
        q: 'Is Surfside’s recertification the same as the 40-year recertification?',
        a: 'Yes. The Town’s page is still titled the 40-Year Recertification Program, and its text keeps the earlier age for the first recertification. At its top, the same page links to the new condominium recertification rules adopted by Miami-Dade County. For a Surfside building today the ages in force are the county’s, in the rows above — not the one printed on the Town’s page.',
      },
      {
        q: 'Does a condominium board in Surfside have to share the recertification report with residents?',
        a: 'The Town Code says so. The owner of a multifamily building, or the condominium association, is to pass any report received from the engineer to all owners and residents of the building. The same section has the engineer’s reports and comments go to the Building Official and to all owners and residents when they are issued to the owner. That provision is in Surfside’s own Code, not on its program page.',
      },
    ],
    nextStep:
      'Send us the certified letter from Surfside’s Building Department — a phone photo is enough — or, with no letter yet, the building’s address and the year built. We read what the Town of Surfside is asking for and by when, and reply with a proposal for the complete recertification.',
  },
  {
    slug: 'key-biscayne',
    program: 'building-recertification',
    city: 'Key Biscayne',
    place: 'Key Biscayne',
    office: {
      name: 'Village of Key Biscayne Building, Zoning and Planning Department',
      address: ['88 W. McIntyre St., Suite 250', 'Key Biscayne, FL 33149'],
      phone: '(305) 365-5512',
    },
    description:
      'Building recertification in Key Biscayne: how the Village notifies owners, what its page asks of the report and what one team delivers, complete.',
    heroSub:
      'The Village of Key Biscayne sends the notice by certified mail, and its Building Official receives the report. Already late? One team still delivers the complete recertification.',
    lede:
      'In Key Biscayne the recertification is handled by the Village itself, through the Village of Key Biscayne Building, Zoning and Planning Department. Its page says the Village follows the process set forth by Miami-Dade County, and that it follows the State and County building codes.',
    local: [
      { k: 'The notice', v: 'The Village issues the notification itself and sends it by certified mail — “to ensure receipt”, its page says — to the ownership or management of the building. So the envelope may be addressed to the building’s management and not to its owners. The page prints no number of days for the report; the county’s deadlines are in the rows above.' },
      { k: 'Filing the report', v: 'The Village’s page says the owner of the building must submit a written Recertification Report to the Building Official. It does not say by what route — on paper, by e-mail or through the Village’s Citizen Portal — so the notice or the Village Building Department settles that point.' },
      { k: 'What goes with it', v: 'The Village’s page asks that each page of the structural report and of the electrical report be signed and sealed. Where a property has more than one building, the report should include a site plan or a copy of a survey that shows where each building stands, with the building being recertified clearly identified on it.' },
      { k: 'The Village’s forms', v: 'The Village’s Forms and Resources page carries the minimum inspection guidelines for the structural recertification, the matching guidelines for the electrical recertification and a certification of compliance with parking-lot guardrails. The guardrails certification belongs in a Key Biscayne package only where it applies to the property.' },
      { k: 'After filing', v: 'Once the report is in, the Village audits it for compliance with the Miami-Dade County Code. If the report is acceptable, the Village issues what its page calls the recertification letter. The Village’s page does not say how long that audit takes.' },
      { k: 'Repairs', v: 'If the report’s findings identify non-compliance with the Miami-Dade or Florida building codes, the Village requires the owner or management to complete repairs. Its page says the engineer or architect they hired then re-inspects the work and provides an updated report, which the Village audits in turn.' },
      { k: 'If it is late', v: 'The Village’s page does not speak of a late report as such. It says that when the repairs and the updated report do not happen, the Village may report the structure to Miami-Dade County’s Unsafe Structures Board, and that the Village Building Official determines, case by case, whether a building the county defines as an unsafe structure is referred to that board.' },
      { k: 'Older names', v: 'The Village’s recertification page still describes the program on its earlier schedule, and its Citizen Portal still lists a record type called “40 Year Recertification” — the program’s former name. The ages and days in force in Key Biscayne are the county’s, in the rows above.' },
    ],
    faq: [
      {
        q: 'Who sends the recertification notice in Key Biscayne?',
        a: 'The Village of Key Biscayne does. Its page says it issues the notification to the ownership or management of the building by certified mail, and that it offers them support throughout the process by sending notifications as the Miami-Dade County Code specifies. Send us the notice — a phone photo is enough — and we confirm what the Village is asking for and by when.',
      },
      {
        q: 'How do we file the recertification report in Key Biscayne?',
        a: 'The Village’s page says only that the written report is submitted to the Building Official. Its Building, Zoning and Planning Citizen Portal takes electronic permit applications and construction plans, and paper is still accepted for those, but neither the portal nor the page says a recertification report is filed that way. We confirm the route with the Village Building Department before the package goes in.',
      },
      {
        q: 'Which buildings in Key Biscayne have to be recertified?',
        a: 'The Village’s page says the county’s requirement, which Key Biscayne is subject to, covers all buildings except single-family residences, duplexes and minor structures — a term the page defines by occupancy load and gross area. The age at which a Key Biscayne building comes due is in the rows above. Not sure about yours? Send its address and the year it was built.',
      },
      {
        q: 'What happens in Key Biscayne if the inspection finds our building is not safe?',
        a: 'If the engineer or architect hired by the owner or management deems the building not safe for continued occupancy, the Village’s page says the Florida Building Code requires the Village to declare the building unsafe and evacuate it immediately. Where the findings are of non-compliance with the building codes, the Village requires repairs and then audits an updated report.',
      },
      {
        q: 'Is Key Biscayne’s recertification the same as the 40-year recertification?',
        a: 'Yes. “40-year recertification” is the program’s former name, and the Village’s page still uses it. The same page says Key Biscayne is subject to Miami-Dade County’s requirement and follows the process the county sets forth, so the ages and deadlines that apply are the county’s — the ones in the rows above.',
      },
    ],
    nextStep:
      'Send the Village of Key Biscayne’s notice — a phone photo is enough — or, with no notice yet, the address and the year built. We confirm what the Village Building Department expects of your building and reply with a proposal for the complete recertification.',
  },
  {
    slug: 'bay-harbor-islands',
    program: 'building-recertification',
    city: 'Bay Harbor Islands',
    place: 'Bay Harbor Islands',
    office: {
      name: 'Town of Bay Harbor Islands Building Department',
      address: ['1045 95th Street, Trailer 3', 'Bay Harbor Islands, FL 33154'],
      phone: '(305) 993-1786',
    },
    description:
      'Building recertification in Bay Harbor Islands: the Town’s rule on engineers’ reports, its Special Master cases and one team for the complete package.',
    heroSub:
      'In Bay Harbor Islands the Building Department takes recertification cases to the Town’s Special Master, and a Town ordinance has associations hand it every engineer’s report. Already late? One team still delivers your complete recertification.',
    lede:
      'The Town of Bay Harbor Islands keeps no web page on the recertification itself. What its site does hold is a condo workshop on recertification and inspections that the Chief Building Official co-presented, the Town ordinance on filing engineers’ reports, and Special Master agendas with recertification cases.',
    local: [
      { k: 'Who handles it', v: 'Recertification matters in the Town go to the Building Department, whose page carries the Building & Zoning Department heading. The Chief Building Official presented the Town’s condo workshop on the program together with a council member, and appears as the presenter of the recertification cases on the Town’s Special Master agenda.' },
      { k: 'Engineers’ reports to the Town', v: 'A Town ordinance, summarized in the workshop slides, has each condominium, cooperative or homeowners’ association, and each apartment complex above the size it sets, designate a Responsible Person. That person files with the Town any engineer’s or architect’s report on the building’s structural, electrical or life-safety conditions, within the short count of business days the ordinance gives.' },
      { k: 'How that filing works', v: 'Filing, in the ordinance’s words as the slides give them, means hand delivery to the Town’s Chief Building Official, or to the Building Department when that official is absent. The report goes in on paper and, where a digital copy exists, in digital form as well — so a recertification report reaches the Town under this rule too.' },
      { k: 'Association registration', v: 'The same ordinance asks condominium and cooperative associations, multifamily owners and commercial and residential buildings to register with the Town’s Code Compliance unit on a Town form, and to update the registration each year. The slides list what it asks for, from the property manager to the officers, directors and insurance agent.' },
      { k: 'Repairs need permits', v: 'Several citations on the Town’s posted Special Master agenda read “Apply and obtain permit(s) for all repairs as indicated on your engineer’s report.” In Bay Harbor Islands, then, the repairs a recertification report lists are done under permit, and leaving them unpermitted can turn into a code case of its own.' },
      { k: 'If it is late', v: 'On that agenda, a building whose recertification report had not been turned in was cited under the Town Code chapter on minimum standards for buildings, and the department recommended a daily penalty until the building came into compliance. For another case, its recommendation was simply to submit the required engineering report to complete the recertification process.' },
      { k: 'Older names', v: 'The Town’s citation for a missing report still calls it by the building’s decade of age, the way the program’s former 40-year name did. For a Bay Harbor Islands building today the ages and days that count are Miami-Dade County’s, printed in the rows above.' },
    ],
    faq: [
      {
        q: 'Who handles building recertification in Bay Harbor Islands?',
        a: 'The Town’s Building Department. Its Chief Building Official co-presented the Town’s condo workshop on recertification, inspections and reserve studies, and is named as presenter on the recertification cases of the Town’s Special Master agenda. Send us the letter or citation the building received and we read what the Town is asking for.',
      },
      {
        q: 'Does a condo association in Bay Harbor Islands have to give the Town its engineer’s report?',
        a: 'Yes, under the Town ordinance the workshop slides summarize. The association’s Responsible Person files any engineer’s or architect’s report on structural, electrical or life-safety conditions with the Town, by hand delivery to the Chief Building Official or the Building Department, on paper and digitally where available, within days of receiving it.',
      },
      {
        q: 'What happens in Bay Harbor Islands if the repairs in the report go unpermitted?',
        a: 'The Special Master agenda the Town posted shows citations telling owners to apply for and obtain permits for every repair the engineer’s report indicates, with the case heard before the Town’s Special Master. The complete recertification we deliver sets out those repairs plainly, so the permits can be applied for from the start.',
      },
      {
        q: 'How long do we have to file the recertification report in Bay Harbor Islands?',
        a: 'The time is Miami-Dade County’s, shown in the rows above under “Time to file” and “If repairs are needed”. The Town’s workshop slides add that the county now counts a building’s age from the year it was built, and that early notices go out ahead of the recertification anniversary so owners can prepare.',
      },
      {
        q: 'Is the recertification in Bay Harbor Islands the same as the 40-year recertification?',
        a: 'Yes — “40-year” is the program’s former name, and the Town’s own citations still number the report by the building’s decade. The workshop slides explain that the county’s ordinance brought the first recertification earlier; for a Bay Harbor Islands building the ages in force are the county’s, in the rows above.',
      },
    ],
    nextStep:
      'Send the notice or citation from the Town of Bay Harbor Islands — a photo of the page is enough — or the building’s address and the year it was built. We read what the Building Department is asking for and come back with a proposal for the complete recertification.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'cutler-bay',
    program: 'building-recertification',
    city: 'Cutler Bay',
    place: 'Cutler Bay',
    office: {
      name: 'Town of Cutler Bay Building Division',
      address: ['10720 Caribbean Blvd., Suite 110', 'Cutler Bay, FL 33189'],
      phone: '(305) 234-4193',
    },
    description:
      'Building recertification in Cutler Bay: the county report forms the Town posts, what its guidelines ask of a report, and one team for the package.',
    heroSub:
      'Cutler Bay’s Building Division posts Miami-Dade’s recertification report forms and guidelines on its own forms page. Already late? One team still delivers your Cutler Bay building’s complete recertification on those forms.',
    lede:
      'In Cutler Bay the recertification sits with the Town’s Building Division, the office that also assesses potentially dangerous structures and posts unsafe notices. The Town has no page that walks through the program; its Building Forms page carries the county’s report forms, the two parking-lot certifications and the county’s general guidelines.',
    local: [
      { k: 'The Town’s forms', v: 'The Building Forms page lists a structural and an electrical Building Recertification Inspection Report Form. Both carry the header of Miami-Dade’s Regulatory and Economic Resources Department, so a Cutler Bay report is written on the county’s own templates, each marked as the initial report or as the amended report once repairs are complete.' },
      { k: 'Parking-lot forms', v: 'Next to them, the Town’s list carries a certification of compliance with parking-lot guardrails and another with parking-lot illumination, both county forms. The guardrail form starts by asking whether the lot abuts a canal, lake or other body of water; each certification belongs in the package where it applies to the property.' },
      { k: 'The guidelines', v: 'The Town also posts the county’s General Considerations and Guidelines. They say the approved report forms must be used and proprietary ones are refused, that photos must be in color with enough resolution to show the conditions, and that each report carries the design professional’s cover letter stating the building is not unsafe for continued occupancy.' },
      { k: 'Larger electrical services', v: 'Where a building’s electrical service is large enough to reach the threshold in those guidelines, they call for an infrared thermography inspection with a written report on switchgear, panelboards, disconnects, transformers and the other listed equipment, carried out by a certified thermographer.' },
      { k: 'Repairs and permits', v: 'The guidelines on the Town’s site tell owners to hand in the initial report to the local jurisdiction right away and not to begin repairs without permits; work done under a permit earns more time to complete the recertification. Unpermitted additions the inspection finds must be named in the report even when they were built properly.' },
      { k: 'After filing', v: 'By those guidelines, the Building Official may audit a recertification report, inspect the building, and revoke a report already approved. The Building Division’s own page adds that it assesses potentially dangerous structures and posts unsafe notices as needed.' },
      { k: 'How it is filed', v: 'Cutler Bay’s pages do not say how a recertification report is delivered. Permits, inspections and plan reviews are handled at Town Hall by the Town’s contractor, CAP Government, and permit and inspection status can be followed online, so the route is a point we settle with the Building Division before the report goes in.' },
    ],
    faq: [
      {
        q: 'Who receives the recertification report in Cutler Bay?',
        a: 'The Town of Cutler Bay Building Division, at the Town Center, which runs permits, inspections and plan review through the Town’s contractor, CAP Government. The county guidelines it posts say the initial report goes to the local jurisdiction for processing; the Town’s pages describe no special route, so we confirm it with the division.',
      },
      {
        q: 'Which forms does Cutler Bay use for the recertification?',
        a: 'Miami-Dade’s. The Town’s Building Forms page links the county’s structural and electrical recertification report forms and its two parking-lot certifications, and the county guidelines on that page say proprietary forms are not accepted. The complete package we deliver for a Cutler Bay building is prepared on those forms.',
      },
      {
        q: 'What if the inspection finds work done without a permit in Cutler Bay?',
        a: 'The guidelines the Town posts call unpermitted additions found during recertification an unsafe situation that must be identified in the report, even if properly built, and make legalizing them a step before a successful report. They also suggest looking into code compliance cases on file, since earlier violations can affect the recertification.',
      },
      {
        q: 'How long do we have to recertify a building in Cutler Bay?',
        a: 'The days are Miami-Dade County’s, counted from the notice, and they sit in the rows above under “Time to file” and “If repairs are needed”. Cutler Bay’s own pages publish no timetable of their own, so keep the notice that reached the building and write down the day it arrived.',
      },
      {
        q: 'Is Cutler Bay’s building recertification the same as the state milestone inspection?',
        a: 'The county guidelines on the Town’s forms page describe Miami-Dade’s recertification as synonymous with the state’s milestone inspection program, folding both of its phases into one inspection and going beyond the state minimum. For a condominium or cooperative in Cutler Bay, the row above on condominiums says how the two relate.',
      },
    ],
    nextStep:
      'Send the recertification notice for your Cutler Bay building, or just its address and the year it was built, and we check what the Town of Cutler Bay Building Division will expect. You receive a proposal for the complete recertification, prepared on the county’s forms.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'el-portal',
    program: 'building-recertification',
    city: 'El Portal',
    place: 'El Portal',
    office: {
      name: 'Village of El Portal Building Department',
      address: ['500 NE 87th Street', 'El Portal, FL 33138'],
      phone: '(305) 795-7880',
    },
    description:
      'Building recertification in El Portal: the Village’s own inspection guidelines, how its Building Department takes filings, one team for the package.',
    heroSub:
      'El Portal’s Building Department posts its own recertification guidelines and accepts applicants’ submissions by appointment or through its electronic portal, and no other way. Already late? One team still delivers your El Portal building’s complete recertification.',
    lede:
      'In El Portal the recertification goes through the Village of El Portal Building Department, which shares a page with the Village’s code enforcement. Among its forms the Village posts a guidelines document printed on its own Building & Zoning Department letterhead, with the outline for the structural and electrical reports.',
    local: [
      { k: 'The Village’s guidelines', v: 'The Village’s list of Code Enforcement and Building Department forms includes a file titled “40-Year Certification Guidelines”, after the program’s former name. It sets out minimum procedural guidelines for a building’s structural and electrical recertification, on Village letterhead that carries Village Hall’s address.' },
      { k: 'What the report covers', v: 'The structural outline asks for a description of the building, its folio number and occupancy classification, then works through the foundation, masonry walls, floor and roof systems, steel and concrete framing, windows and wood framing. A closing item leaves room for anything else the architect or engineer requires.' },
      { k: 'The electrical part', v: 'The electrical section asks about the service and its amperage, the meter and electric rooms, branch circuits and conduit raceways, and whether emergency lighting, exit lighting and the fire alarm are in good working order. Both the structural and the electrical part state whether repairs are required and describe them.' },
      { k: 'The notice date', v: 'Each part of the Village’s outline asks for the date of the notice of required inspection, beside the dates the inspection actually took place. So the notice the building received is a document the report itself refers to — keep it with its envelope.' },
      { k: 'How filings are made', v: 'The Building Department’s page accepts applicants’ submissions either as a hard copy dropped off at its office by appointment, or through electronic plan review on its web portal, and in no other form. It asks that plans and documents not be e-mailed, which it says slows the review; portal users get status updates automatically.' },
      { k: 'Which forms it takes', v: 'The Village’s outline asks for a statement that the building is structurally safe, unsafe, safe with qualifications, or deemed safe by restrictive interpretation. The page does not say whether the Village takes this outline or the county’s current report forms, so we settle that with the Building Department before anything is filed.' },
    ],
    faq: [
      {
        q: 'Who handles building recertification in El Portal?',
        a: 'The Village of El Portal Building Department, which is reached through Village Hall. It shares a page with the Village’s code enforcement, and its Building Official and inspectors are listed there. Send us whatever notice the building received and we read what the Village is asking for.',
      },
      {
        q: 'Does El Portal have its own recertification guidelines?',
        a: 'Yes. It posts its own guidelines, on Village letterhead, with an outline for the structural and the electrical report. The Village’s page does not say whether that outline or the county’s current report forms are to be used, so we settle it with the Building Department; the complete package we deliver goes on whichever the Village expects.',
      },
      {
        q: 'How do we hand documents to the El Portal Building Department?',
        a: 'By appointment, as a hard copy dropped off at the department’s office, or through its electronic plan review portal — the page calls those the only acceptable options and warns that e-mailed plans or documents delay the review. It speaks of applicants in general, so we confirm with the department that a recertification report travels the same way.',
      },
      {
        q: 'How long do we have to recertify a building in El Portal?',
        a: 'The time is Miami-Dade County’s, in the rows above under “Time to file” and “If repairs are needed”. The Village’s guidelines print no number of days; what they ask for is the date of the notice of required inspection, which is one more reason to hold on to that notice.',
      },
      {
        q: 'Is El Portal’s recertification the same as the 40-year certification?',
        a: 'Yes. The Village’s guidelines still carry the title “40-Year Certification”, the program’s former name. The program is Miami-Dade County’s building recertification, and the ages that now apply to an El Portal building are the county’s, in the rows above.',
      },
    ],
    nextStep:
      'Send the notice your El Portal building received — a picture taken with a phone will do — or its address and the year it was built. We check what the Village of El Portal Building Department expects and reply with a proposal for the complete recertification.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'florida-city',
    program: 'building-recertification',
    city: 'Florida City',
    place: 'Florida City',
    office: {
      name: 'City of Florida City Building Department',
      address: ['404 West Palm Drive', 'Florida City, FL 33034'],
      phone: '(305) 247-8222',
    },
    description:
      'Building recertification in Florida City: the county guidelines the City posts, its eTRAKiT portal and one team delivering the complete package.',
    heroSub:
      'Florida City’s Building Department lists the county’s recertification guidelines among its documents and takes new applications through eTRAKiT. Already late? The complete recertification of a Florida City building still comes from one team, start to finish.',
    lede:
      'In Florida City the recertification falls to the Building Department, the part of the City’s Community Development Department that administers permitting, plan review, inspections and enforcement of the building codes. The City keeps no page on the program itself: its documents page carries one file on it, and its online portal is where new applications go.',
    local: [
      { k: 'The City’s document', v: 'Florida City’s Community Development Documents page lists a file titled “40 Year Certification”, after the program’s former name. Inside are the county Board of Rules and Appeals’ general considerations for the structural and electrical inspections, followed by an outline for each report.' },
      { k: 'What the outlines ask', v: 'Both outlines ask for the owner, the folio number, the occupancy classification and the date of the notice of required inspection. The electrical checklist then runs item by item — service, panels, smoke detectors, exit lights, emergency generator, garage wiring, pool wiring — marking each as good or as needing repairs.' },
      { k: 'Parking-lot lighting form', v: 'The same City file includes a certification of compliance with the county’s parking-lot illumination standards, in which the engineer or architect records measuring the light in the lots that serve the building. It belongs in a package where the property has such a lot.' },
      { k: 'The file’s edition', v: 'Every page of that file carries a Board of Rules and Appeals revision date from years back, and its electrical checklist still refers to buildings by the former 40-year name. Before anything is filed, we confirm with the Building Department whether it expects these outlines or the county’s current report forms.' },
      { k: 'Online applications', v: 'Florida City now requires every new application to be registered in its eTRAKiT online services portal, where plans and supporting documents are submitted electronically and status is tracked; projects already under way stay on the legacy system. The City’s pages do not list recertification among the portal’s applications, so that is checked with the department too.' },
      { k: 'Code cases', v: 'Florida City’s Code Enforcement Department investigates violations of City ordinances and refers the unresolved ones to the Special Magistrate. The City’s pages do not describe what follows a late recertification report in particular; the county’s timing for it is in the rows above.' },
    ],
    faq: [
      {
        q: 'Who handles building recertification in Florida City?',
        a: 'The City of Florida City Building Department, inside the Community Development Department at City Hall. Its phone line is the City’s main number, with a menu option for the Building Department. Send us the notice the building received and we read what the City is asking for.',
      },
      {
        q: 'How do we submit documents to Florida City’s Building Department?',
        a: 'Through eTRAKiT: the City says every new application must be registered there, and the portal takes plans and supporting documents electronically, with inspection scheduling and payments in the same place. Its pages do not name a recertification report among the portal’s applications, so the route is something we confirm with the Building Department first.',
      },
      {
        q: 'Which forms does Florida City use for the recertification?',
        a: 'Florida City’s documents page has one file on the program, titled “40 Year Certification” after the program’s former name: county guidelines, structural and electrical report outlines and a parking-lot illumination certification. Because the file carries an old revision date, we check with the Building Department which forms it takes; the complete package goes on those.',
      },
      {
        q: 'How long do we have to file the recertification report in Florida City?',
        a: 'The time is set by Miami-Dade County and is in the rows above under “Time to file” and “If repairs are needed”. The City’s file gives no number of days; it asks for the date of the notice of required inspection, so keep the notice and note when it arrived.',
      },
      {
        q: 'Does a building in Florida City need a parking-lot illumination certificate for recertification?',
        a: 'Where the building has a parking lot, the City’s file includes a county form for it: a certification that the lighting in the lot meets the minimum for the building’s occupancy classification, once the engineer or architect has measured it. Not sure whether it applies to yours? Send the address and we check.',
      },
    ],
    nextStep:
      'Send what the City of Florida City sent you about the building — a quick photo works — or the address and the year it was built. We check what the Building Department expects and reply with a proposal for the complete recertification.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'medley',
    program: 'building-recertification',
    city: 'Medley',
    place: 'Medley',
    office: {
      name: 'Town of Medley Building Department',
      address: ['7777 NW 72nd Ave', 'Medley, FL 33166'],
      phone: '(305) 887-6913',
    },
    description:
      'Building recertification in Medley: the Town’s own submittal form, the owner’s notarized affidavit, and one team for the complete recertification.',
    heroSub:
      'Medley’s Building Department has a cover form of its own for the recertification report, with an affidavit the owner swears before a notary. Already late? One team still prepares the complete recertification that goes with it.',
    lede:
      'In Medley the recertification is filed with the Town of Medley Building Department. The Town’s building page carries no text about the program, but its list of building forms includes a Recertification Report Submittal Form, and its other documents show how the department keeps track of each building.',
    local: [
      { k: 'The submittal form', v: 'The Town’s Recertification Report Submittal Form identifies the filing: the property address and folio number, the owner’s name and mailing address, the architect or engineer and a contact person. It also has boxes to mark which recertification cycle the building is in, with room for one the form does not name.' },
      { k: 'The owner’s affidavit', v: 'At the foot of the form the property owner certifies, under penalties of perjury, that the whole application has been read and is correct. The statement is sworn before a notary, who either knows the owner personally or records the identification shown, so the owner’s notarized signature is part of a Medley filing.' },
      { k: 'Approval by trade', v: 'The bottom of the form is the department’s own: an approval or a disapproval, each with its date, for the electrical review, the structural review and the Building Official. Each part of a Medley report is thus marked on its own, with a line of its own for the Building Official.' },
      { k: 'One building, one application', v: 'The Town’s schedule of charges counts recertification per building, for every application the Miami-Dade County Code requires. A property with several buildings on it files an application for each of them.' },
      { k: 'Extensions', v: 'The same schedule lists an extension application for the later recertification cycles. Neither the schedule nor the form says how long an extension runs or when it has to be requested, so that question goes to the Building Department early, not on the last day.' },
      { k: 'Your building’s record', v: 'The Town’s Liens and Information Request, its estoppel letter form, has a section for official use that records the year built and, cycle by cycle, when the recertification is due and whether it was complied with. Asking for that letter is one way to see what the Town has on file for a building.' },
    ],
    faq: [
      {
        q: 'Does Medley have its own recertification form?',
        a: 'Yes. The Town of Medley Building Department lists a Recertification Report Submittal Form among its building forms. It names the property, the owner and the architect or engineer, carries the owner’s notarized affidavit and leaves room for the department’s approval of each trade. The complete recertification we prepare goes in with that form completed.',
      },
      {
        q: 'Who signs the recertification submittal form in Medley?',
        a: 'The affidavit on Medley’s form belongs to the property owner, who certifies under penalties of perjury that the application is correct, before a notary. For an association or a company that owns the building, settle early who appears as the owner, because the notary needs that person in front of them with identification or already known to them.',
      },
      {
        q: 'How long do we have to recertify a building in Medley?',
        a: 'Medley’s documents print no number of days of their own. The county’s time to file is under “Time to file in Medley” above, and the time for repairs under “If repairs are needed in Medley”. The date that binds a given building is the one on the notice it received.',
      },
      {
        q: 'How do we find out whether a building in Medley is up to date on recertification?',
        a: 'Through the Town’s Liens and Information Request. Its official-use section, filled in by the Building & Zoning Department, records the year built and, for each cycle, the due date and whether the building complied. Send us the address too: we look at the building’s history before we propose anything.',
      },
      {
        q: 'Is Medley’s recertification the same as the 40-year recertification?',
        a: 'Yes. The Town’s schedule of charges still calls it the Forty Year Building re-certification program, the program’s former name, while the submittal form already has boxes for other cycles. Both rest on the Miami-Dade County Code, so the ages in force are the county’s, in the rows above.',
      },
    ],
    nextStep:
      'Send the Medley property’s address and year built, together with any notice it has received — a photo from a phone works. We work out what the Town of Medley Building Department will need, the notarized owner affidavit included, and reply with a proposal for the complete recertification.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'miami-lakes',
    program: 'building-recertification',
    city: 'Miami Lakes',
    place: 'Miami Lakes',
    office: {
      name: 'Town of Miami Lakes Building Department',
      address: ['6601 Main Street', 'Miami Lakes, FL 33014'],
      phone: '(305) 827-4015',
    },
    description:
      'Building recertification in Miami Lakes: the Town’s notice, the report forms its Building Department posts, and one team for the complete package.',
    heroSub:
      'The Town of Miami Lakes gives the recertification a section of its building page and a short page of forms. Already late? One team still prepares the complete recertification for a Miami Lakes building.',
    lede:
      'In Miami Lakes the recertification is handled by the Town’s own Building Department, the office that reviews, inspects and permits work on every structure in the Town. Its pages walk through the program in order: the notice to the owner, the written reports on the structure and the electrical system, and the county code both rest on.',
    local: [
      { k: 'How it starts', v: 'Each year, the Town’s page explains, more properties reach the county’s ages, and their owners receive a Notice of Required Recertification to commence the process. The page counts the time for the reports from the date of that notice, so the letter itself is the document to keep at hand.' },
      { k: 'What the reports certify', v: 'After the notice, the owners submit written reports certifying that each building is structurally and electrically safe for its specified use and for continued occupancy. The Town’s page asks for a design professional with proven training and experience in the field that each report covers, structural or electrical.' },
      { k: 'The Town’s forms', v: 'Under its Forms heading the Town links two files that still carry the program’s former 40-year name, one electrical and one structural. Both open Miami-Dade County’s own report forms, issued by its Department of Regulatory and Economic Resources, so a Miami Lakes report is written on the county template.' },
      { k: 'Revised templates', v: 'The Town’s page notes that the county strengthened the program to inspect more building components and take a closer look at existing buildings. It adds that the Board of Rules and Appeals approved updated guidelines and report templates, which the page says it makes available below that note.' },
      { k: 'What the form asks', v: 'The structural form linked from Miami Lakes opens with a choice between the initial report and the amended report filed after repairs are complete. It then has the inspection marked on a scale that runs from passed, through maintenance needed, to a dangerous condition the Building Official must be told about, and it has a box for unpermitted work.' },
      { k: 'Who is exempt', v: 'The Town lists the kinds of residences that do not go through the process: single-family homes, duplexes, and small buildings within a set occupant load and floor area. Any other building in the Town that reaches the county’s age is covered.' },
      { k: 'Condominiums and state law', v: 'The Town’s page explains that a state law created milestone inspections for condominium and cooperative association buildings of three stories and more, and that the county amended its ordinance alongside it. It says the two together affect every existing building in Miami-Dade County.' },
      { k: 'Each application', v: 'The Building Department’s schedule of charges treats every recertification as an application it processes under the county code — the first one a building files and each later one alike. It sits in the same schedule as the department’s permits.' },
    ],
    faq: [
      {
        q: 'Who sends the recertification notice in Miami Lakes?',
        a: 'The Town’s page calls it a Notice of Required Recertification and says the owners of a property receive it when the building comes due; it does not say which office puts it in the mail. The reports then go to the Town of Miami Lakes Building Department. If the notice has already arrived, a picture of it taken with a phone lets us confirm what it asks and the date it counts from.',
      },
      {
        q: 'Which recertification forms does Miami Lakes use?',
        a: 'The two the Town links from its building page: Miami-Dade County’s structural and electrical report forms, in the edition the county revised when it widened the inspection. The Town has no form of its own name for the report. The complete recertification we prepare is written on those same county templates.',
      },
      {
        q: 'How long do we have to file the recertification in Miami Lakes?',
        a: 'The Town’s page counts the time from the date of the notice. The days are the county’s: they are under “Time to file in Miami Lakes” above, and the time to repair is under “If repairs are needed in Miami Lakes”. The Town’s page prints its own figures as well; this page keeps the county row as the reference.',
      },
      {
        q: 'Does a condominium in Miami Lakes also need the state milestone inspection?',
        a: 'The Town’s page ties the two together: it describes the state law on milestone inspections for condominium and cooperative buildings and the county ordinance amended with it. How the county’s recertification answers for the state requirement is set out under “Condominiums & co-ops in Miami Lakes” above. Unsure whether your association’s building is due? Send the address and the year built.',
      },
      {
        q: 'Is the Miami Lakes recertification the same as the 40-year recertification?',
        a: 'Yes. The Town’s two report links are still titled with that former name. Its page even calls it Miami-Dade’s 40-Year program when it speaks of buildings that already went through a first inspection. It is the county’s building recertification, administered in the Town by its Building Department; the ages in force now are in the rows above.',
      },
    ],
    nextStep:
      'Send the Notice of Required Recertification for your Miami Lakes building — a picture taken with a phone will do — or, if none has come yet, the address and the year it was built. We read what the Town of Miami Lakes Building Department expects and reply with a proposal for the complete recertification.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'miami-springs',
    program: 'building-recertification',
    city: 'Miami Springs',
    place: 'Miami Springs',
    office: {
      name: 'City of Miami Springs Building Department',
      address: ['201 Westward Drive, Second Floor', 'Miami Springs, FL 33166'],
      phone: '(305) 805-5030',
    },
    description:
      'Building recertification in Miami Springs: reports filed in person at City Hall, the forms the Building Department posts, and one team for all of it.',
    heroSub:
      'Miami Springs takes recertification reports in person, at the Building Department on the second floor of City Hall. Already late? One team still prepares the complete recertification on the forms the city posts.',
    lede:
      'In Miami Springs the recertification goes through the City of Miami Springs Building Department, the office that issues every building permit in the city. Its forms page for the program asks for the reports to be brought to the office in person and lists the documents that make up the filing.',
    local: [
      { k: 'Filing in person', v: 'The city’s recertification page puts it plainly: reports must be submitted into the office in person. The Building Department sits on the second floor of City Hall, at the address shown on this page, and the page offers no online route for a recertification.' },
      { k: 'The city’s list', v: 'Under supporting documents the page lists recertification guidelines, a general considerations guideline, an electrical recertification form, a structural recertification form and a parking-lot illumination certificate. The page adds that the same files can also be retrieved from Miami-Dade County.' },
      { k: 'County templates', v: 'Every file the city links is a Miami-Dade County document, headed by the county’s Department of Regulatory and Economic Resources. A recertification filed in Miami Springs is therefore written on the county’s structural and electrical report forms, not on a city edition of its own.' },
      { k: 'Where there is parking', v: 'The illumination certificate on the city’s list is the county’s statement of compliance with the parking-lot lighting standards in its code. It joins a Miami Springs package only where the property has a parking lot those standards apply to.' },
      { k: 'One inspection, two phases', v: 'The guidelines the city posts say the county’s recertification is synonymous with the state’s milestone inspection program, folds the state’s first and second phases into a single inspection, and meets and exceeds the state minimum.' },
      { k: 'Initial and amended', v: 'Both report forms the city posts are marked either as the initial inspection report or as the amended report after completion of repairs. A building that needs work therefore comes back to the Building Department with a second report once the repairs are done.' },
      { k: 'Processing and the board', v: 'The schedule of charges the city posts, issued under the name of its Building Processing Department, treats each recertification as an application the City processes. The same schedule has a separate line for filing a case with the Unsafe Structures Board, with that board’s own costs billed on top.' },
    ],
    faq: [
      {
        q: 'Can we submit the recertification report online in Miami Springs?',
        a: 'Not according to the city’s recertification page, which says the reports must be submitted into the office in person. That office is the Building Department, on the second floor of City Hall. The complete package we prepare is assembled with that delivery at the counter in mind, with each form from the city’s list in place.',
      },
      {
        q: 'Where are the recertification forms for Miami Springs?',
        a: 'On the Building Department’s page for the program, which lists the guidelines, the structural and electrical report forms and the parking-lot illumination certificate. The page also says the files can be retrieved from Miami-Dade County, since they are the county’s own. The complete recertification is written on those forms.',
      },
      {
        q: 'How long do we have to recertify a building in Miami Springs?',
        a: 'The city’s recertification page prints no number of days. The time is the county’s: it is under “Time to file in Miami Springs” above, and the repair period is under “If repairs are needed in Miami Springs”. What governs your building is the date on the notice it receives.',
      },
      {
        q: 'Does a condominium in Miami Springs need a separate milestone inspection?',
        a: 'The county guidelines on the city’s page call the recertification synonymous with the state’s milestone inspection program and say it combines both state phases into one inspection. How that applies to condominium and cooperative buildings is under “Condominiums & co-ops in Miami Springs” above. Send the address if you are unsure about your association’s building.',
      },
      {
        q: 'Is the recertification in Miami Springs the same as the 40-year recertification?',
        a: 'Yes. The city still titles its forms page Forty Year or older Recertification Forms, and its schedule of charges still calls the application a forty year certification — both are the program’s former name. The ages in force today are Miami-Dade County’s, in the rows above.',
      },
    ],
    nextStep:
      'Send what you have for the Miami Springs building — the notice if one came, or else the address and the year built. We check what the City of Miami Springs Building Department expects at its counter and reply with a proposal for the complete recertification.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'north-bay-village',
    program: 'building-recertification',
    city: 'North Bay Village',
    place: 'North Bay Village',
    office: {
      name: 'North Bay Village Building and Zoning Department',
      address: ['1666 Kennedy Causeway, Suite 101', 'North Bay Village, FL 33141'],
      phone: '(305) 754-6740',
    },
    description:
      'Building recertification in North Bay Village: the Village’s permit records, building audit and own enforcement, and one team for the complete package.',
    heroSub:
      'North Bay Village records each recertification as a permit of its own and enforces the requirement under its own code. Already late? One team still prepares the complete recertification for a building in the Village.',
    lede:
      'In North Bay Village the recertification runs through the North Bay Village Building and Zoning Department, which issues the Village’s permits and reviews each building’s records. The Village’s site has no page on the program by itself; its building audit page, its permit reports and its hearing agendas show how the requirement is handled.',
    local: [
      { k: 'A permit of its own', v: 'The Village’s yearly permit reports list Building Recertification as a permit type of its own, with its own numbering, beside building, electrical, plumbing and demolition permits. In North Bay Village a building’s recertification is therefore a record in the Village’s permit system.' },
      { k: 'Repairs under permit', v: 'Repairs that come out of a report appear in those same reports as building permits, with descriptions such as concrete repair as per the 40-year inspection report — the program’s former name — or minor concrete repairs as per the recertification report.' },
      { k: 'Digital applications', v: 'The Village’s building page says the Building Department accepts applications digitally only, with every document sent as a PDF by e-mail to the Building Clerk. The page speaks of permits and does not say whether a recertification report takes the same route, so we confirm it with the department first.' },
      { k: 'The building audit', v: 'After the Surfside tragedy the Village began a Building Audit Process: its Building Department visits and reviews the records of all multi-family and commercial buildings, including each one’s recertification history. Buildings due for recertification were among those it said it would visit first. The page was last updated in the year the process began.' },
      { k: 'Engineering reports', v: 'Where a visit by the Village’s Chief Building Official finds deficiencies, the audit page says a structural engineering report is requested within a specified timeframe, and the building must then follow the engineer’s recommendations for repairs.' },
      { k: 'If it is late', v: 'The Village cites the requirement under its own code. Its Special Magistrate agendas list cases for failure to obtain recertification of buildings and components, brought by its code enforcement officers, and the agenda the Village posts holds those hearings by video conference.' },
      { k: 'Unsafe buildings', v: 'In one case the Village published, an engineer retained by a condominium association to perform the recertification reported serious conditions, and the Village’s building officials deemed the building not safe for occupancy and ordered residents to evacuate.' },
      { k: 'Help with assessments', v: 'The Village’s Condominium Special Assessment Program offers eligible condominium owners a zero percent interest loan toward special assessments that arise from repairs the recertification requires. Its application asks the owner to describe the improvements, the recertification among them.' },
    ],
    faq: [
      {
        q: 'Who enforces the recertification requirement in North Bay Village?',
        a: 'The Village itself, under a section of its own code titled failure to obtain recertification of buildings and components; those cases are heard by the Village’s Special Magistrate. The engineering reports the Village requests go to its Building Department. Send us what the Village sent you — a phone photo is plenty — and we confirm what it asks for and by when.',
      },
      {
        q: 'How is a recertification recorded in North Bay Village?',
        a: 'As a permit. The Village’s permit reports carry Building Recertification as its own type, and the repair permits that follow a report name that report in their description. A public records request is the route the audit page gives for historical data on a building, which is also where its recertification history sits.',
      },
      {
        q: 'Was our North Bay Village building part of the Village’s building audit?',
        a: 'The audit page lists the buildings the Chief Building Official has visited and says each of them then gets a follow-up on any outstanding issues. It points residents to their condominium association or property manager for details of the visit. If the Village asked your building for an engineering report, send us that request with the address.',
      },
      {
        q: 'How long does a building in North Bay Village have to file?',
        a: 'The Village’s documents print no days of their own for the report. The county’s time is under “Time to file in North Bay Village” above, and the repair time under “If repairs are needed in North Bay Village”. Where the Village has requested an engineering report after an audit visit, the time is the one set in that request.',
      },
      {
        q: 'Is the North Bay Village recertification the same as the 40-year recertification?',
        a: 'Yes. The Village’s audit page and its permit reports still call it the 40-year recertification, the program’s former name, and one Village press release speaks of a building’s required certification at a later age. It is Miami-Dade County’s program; the ages in force are in the rows above.',
      },
    ],
    nextStep:
      'Send the address of the building in North Bay Village and the year it was built, with any letter or request the Village has sent. We read what the North Bay Village Building and Zoning Department is asking of the building and reply with a proposal for the complete recertification.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'opa-locka',
    program: 'building-recertification',
    city: 'Opa-locka',
    place: 'Opa-locka',
    office: {
      name: 'City of Opa-locka Building and Licensing Department',
      address: ['780 Fisherman Street', 'Opa-locka, FL 33054'],
      phone: '(305) 953-2868',
    },
    description:
      'Opa-locka building recertification: who issues the notice, who reviews the report, how repair permits move, and what one team delivers complete.',
    heroSub:
      'Opa-locka’s Building and Licensing Department issues the recertification notices and reviews the consultants’ reports. Already late? One team still takes your Opa-locka building through the complete recertification.',
    lede:
      'In Opa-locka the recertification sits with the City of Opa-locka Building and Licensing Department, the office that also issues the city’s building permits and certificates of occupancy. Its page gives the program two lines — sending the notices and reviewing the reports — and no more; whatever the city does not publish is confirmed with the department.',
    local: [
      { k: 'The notice', v: 'Among the department’s responsibilities, Opa-locka’s page lists issuing notices to building owners to comply with the structural and electrical inspection for recertification. The page does not say how the notice is delivered or what it encloses, so hold on to it: the county’s time to file runs from it.' },
      { k: 'The review', v: 'The same list puts the review of the consultants’ reports for recertification in the department’s hands, next to plan review and permitting. Opa-locka publishes no filing route, form or review time for those reports; each of the three is a question for the Building and Licensing Department before anything is handed in.' },
      { k: 'Repair permits', v: 'Opa-locka’s permit questions say every building permit application is turned in complete at the intake counter, checked for sufficiency, sent to the Zoning Department and then to plans examination for compliance with the Florida Building Code. The permit is issued in the name of whoever does the work, a licensed contractor or an owner-builder.' },
      { k: 'Small repairs', v: 'The same questions quote the Florida Building Code on repairs: altering or repairing any part of a building needs a permit first. Even maintenance small enough to go without a permit, the page adds, may not be carried out without the building official’s approval beforehand.' },
      { k: 'Older names', v: 'The department’s page still describes the program by its former name, speaking of 40-year-old buildings. It is Miami-Dade County’s building recertification, and the ages and days in force in Opa-locka are the county’s, in the rows above.' },
    ],
    faq: [
      {
        q: 'Who sends the recertification notice in Opa-locka?',
        a: 'The City of Opa-locka Building and Licensing Department; its page lists issuing those notices among the department’s duties. Nothing on the page says how the notice travels, so a photo of whatever reached you is the quickest way for us to read what Opa-locka expects of the building and by when.',
      },
      {
        q: 'Who reviews the recertification report in Opa-locka?',
        a: 'The same department. Opa-locka’s page names the review of consultants’ reports for recertification as one of its duties. Its forms list carries permit applications but no recertification form, so before the complete package goes in we ask the department which forms and which route it expects.',
      },
      {
        q: 'How long do we have to recertify a building in Opa-locka?',
        a: 'Opa-locka’s page gives no count of its own. The county’s time starts from the notice — it is in the “Time to file” row above — and the time for repairs is under “If repairs are needed”. Keep the Opa-locka notice and the day it arrived; those two set the calendar.',
      },
      {
        q: 'Do repairs found in an Opa-locka recertification need permits?',
        a: 'Opa-locka’s permit questions quote the Florida Building Code: repairing any part of a building takes a permit from the building official, and even minor work that needs none still needs the building official’s prior approval. The application goes in complete at the department’s intake counter and passes through zoning and plans examination.',
      },
      {
        q: 'Is Opa-locka’s recertification the same as the 40-year recertification?',
        a: 'Yes. The department’s page still uses that former name, describing notices to owners of 40-year-old buildings. The program is Miami-Dade County’s, and the ages that apply now are under “First due” and “Then” above, earlier than the old name suggests.',
      },
    ],
    nextStep:
      'Got a recertification notice from the City of Opa-locka Building and Licensing Department? Send a phone photo of it, or the address and the year built if nothing has arrived. We check with the department what it expects and reply with a proposal for the complete recertification.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'pinecrest',
    program: 'building-recertification',
    city: 'Pinecrest',
    place: 'Pinecrest',
    office: {
      name: 'Village of Pinecrest Building Department',
      address: ['12645 Pinecrest Parkway', 'Pinecrest, FL 33156'],
      phone: '(305) 234-2121',
    },
    description:
      'Pinecrest recertification: the Village’s courtesy and certified-mail notices, filing in eTRAKiT, repairs under permit and the complete package.',
    heroSub:
      'The Village of Pinecrest Building Department mails the recertification notice, takes the reports online and issues the approval letter. Already late? One team still assembles your Pinecrest building’s complete recertification, item by item from the Village’s list.',
    lede:
      'In Pinecrest the recertification runs through the Village of Pinecrest Building Department, under the section of the Miami-Dade County Code its page cites. The Village warns owners early with courtesy notices, takes the reports electronically through its eTRAKiT permitting system and closes the file with an approval letter.',
    local: [
      { k: 'Courtesy notices', v: 'Pinecrest’s page says the Village provides advance courtesy notices of required recertifications where applicable — two of them, spaced ahead of the final notice. The point, it explains, is to give owners and building managers time to hire an engineer or architect and to budget for any repairs the codes may call for.' },
      { k: 'The formal notice', v: 'Pinecrest’s formal notice travels by certified mail, addressed by the Building Department to the owner or to whoever represents the owner. The Village’s page counts the owner’s time from receipt of what it calls the Notification of Building Recertification, so the day that envelope arrives is the date worth writing down.' },
      { k: 'Filing the report', v: 'Pinecrest accepts the reports electronically, through eTRAKiT, the Village’s online permitting system. Its page lists what to send: the structural and electrical recertification reports, the parking-lot illumination and guardrail documents, and the Pinecrest Building Recertification Submittal Form. It adds that all reports must be digitally signed and sealed.' },
      { k: 'Guidelines and scope', v: 'Under Recertification Resources, the Village links the recommended minimum inspection procedural guidelines meant for the architect or engineer, opening with the general considerations on the scope of structural inspections. Pinecrest’s page ties the reports to the guidelines of Miami-Dade County’s Board of Rules and Appeals and says they include an illumination survey of the parking areas.' },
      { k: 'Repairs', v: 'If the inspection shows that repairs or modifications are needed, Pinecrest’s page has the owner hire a contractor licensed by the State of Florida and pull permits from the Building Department before any work begins. After every permit passes its final inspection, the professional of record files a report stating that the repairs are complete and the building is safe for continued use.' },
      { k: 'Extensions', v: 'The Village’s page lets the Building Official grant an extension, for a limited period, either to file the report or to obtain the permits. The request is made in writing by the engineer or architect, and it must state that the building can stay occupied while the recertification is under way.' },
      { k: 'Approval', v: 'The reports go to the Building Department’s Governmental Compliance Section. Once they are approved, the Building Official issues a Building Recertification approval letter, sent to the owner and to the engineer or architect of record; Pinecrest’s page tells owners to keep that letter as proof of approval.' },
      { k: 'If it is late', v: 'Pinecrest’s page says that a report not in by the deadline leads to a Building Violation being issued against the property. It describes nothing beyond that — no hearing, no referral — so a building already past its date is a case to settle with the Building Department, notice in hand.' },
    ],
    faq: [
      {
        q: 'How does Pinecrest tell owners their building is due for recertification?',
        a: 'By certified mail, from the Building Department to the owner or the owner’s representative. Before that formal notice, Pinecrest’s page says the Village sends courtesy notices where applicable, so a building can hear about its cycle well in advance. Photograph whichever Pinecrest notice you hold and send it; the time it starts is the one under “Time to file” above.',
      },
      {
        q: 'Can the recertification report be filed online in Pinecrest?',
        a: 'Yes. The Village’s page says the reports may be submitted electronically through eTRAKiT, and it requires every report to be digitally signed and sealed. For a Pinecrest building, the complete recertification we deliver includes each item that page lists, the Village’s own submittal form among them.',
      },
      {
        q: 'Who can ask Pinecrest for more time to recertify?',
        a: 'The engineer or architect, in writing. Pinecrest’s page lets the Building Official extend, for a limited period, the deadline to file the report or to obtain permits, when the request states that the building may remain occupied during the recertification. The ordinary times are the county’s, under “Time to file” and “If repairs are needed” above.',
      },
      {
        q: 'Which buildings in Pinecrest are exempt from recertification?',
        a: 'Pinecrest’s page names single-family residences, duplexes and minor structures, and it defines a minor building by a ceiling on occupant load combined with a ceiling on gross area. Every other building comes due at the age under “First due” above and again under “Then”. If you cannot tell which side of that line a Pinecrest building falls on, its address and year built let us check.',
      },
      {
        q: 'Is Pinecrest’s recertification still called the 40-year recertification?',
        a: 'Only by its former name. Pinecrest’s page asks when the program changed from what it calls the 40 year Recertification process, and answers with the state’s milestone law for condominium and cooperative buildings and Miami-Dade County’s broader program that followed it. The ages that apply today are under “First due” above.',
      },
    ],
    nextStep:
      'Holding a courtesy notice or a certified letter from the Village of Pinecrest Building Department? Send a phone photo of it — or, if nothing has come, the address and the year built — and we answer with what Pinecrest expects and a proposal for the complete recertification.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'sweetwater',
    program: 'building-recertification',
    city: 'Sweetwater',
    place: 'Sweetwater',
    office: {
      name: 'City of Sweetwater Building and Zoning Department',
      address: ['1695 NW 110 Ave, Unit 109', 'Sweetwater, FL 33172'],
      phone: '(305) 485-4526',
    },
    description:
      'Sweetwater building recertification: the city’s memorandum, filing the report by e-mail, the review that follows, and the complete package from one team.',
    heroSub:
      'Sweetwater’s Building and Zoning Department publishes its own memorandum and filing instructions for the recertification, and takes the report by e-mail. Already late? One team still prepares the complete package for your Sweetwater building to match them.',
    lede:
      'In Sweetwater the recertification is handled by the City of Sweetwater Building and Zoning Department. Its forms page gathers two documents under the program’s former 40-year name: a Building Department Memorandum explaining what the county code requires of the owner, and a sheet of electronic submittal instructions on how the report reaches the city and how it is reviewed.',
    local: [
      { k: 'The memorandum', v: 'Sweetwater’s Building Department Memorandum tells the owner that a written Recertification Report goes to the Building Official, certifying that each building is structurally and electrically safe for continued occupancy. The memorandum still repeats the county code on its earlier schedule; the ages and days in force are the county’s, in the rows above.' },
      { k: 'Filing by e-mail', v: 'The city’s instructions begin with a permit application, signed by the owner and the engineer, that obtains a permit number for the recertification. The report documents ride in that same e-mail as PDF files, on the structural and electrical certification formats; if the submission is accepted, the department e-mails a receipt back.' },
      { k: 'The review', v: 'Sweetwater’s instructions say the report is reviewed by the city’s engineer and by every applicable trade. The applicant then gets a phone call on the status of the permit: either it is ready to be picked up, or there are comments that still have to be answered before it can be.' },
      { k: 'What the report carries', v: 'The memorandum wants every page of the structural and electrical reports to carry the engineer’s or architect’s signature and seal. When a lot holds several buildings, it also wants a site plan or survey copy marking each one, with the building under recertification plainly singled out.' },
      { k: 'Lot certificates', v: 'The city’s memorandum also asks for documents certifying that the parking lot meets the county’s illumination standards and guardrail requirements, and it encloses the county chapter that sets them. It notes that those standards were made retroactive when the county adopted them.' },
      { k: 'Claiming an exemption', v: 'If a building is exempt, has not reached the age or has been demolished, Sweetwater’s memorandum asks the owner to tell the office and send whatever documentation exists. An exemption claimed for a building still standing also needs dated photographs of its front and its rear.' },
      { k: 'If it is late', v: 'The memorandum warns that no report means a Civil Violation Notice or ticket, issued without further notice, and a referral to the Unsafe Structures Unit to start condemnation proceedings. Once an unsafe structures Notice of Violation is issued, it says, the building must be vacated and may end up being demolished.' },
      { k: 'Two street addresses', v: 'The memorandum and the recertification instructions print a street address for the department that differs from the one on its Building and Zoning page. The address on this page is the Building and Zoning page’s; confirm it with the department before anything goes out on paper.' },
    ],
    faq: [
      {
        q: 'How is a recertification report filed in Sweetwater?',
        a: 'By e-mail. Sweetwater’s instructions open with a permit application signed by the owner and the engineer, sent to the city’s submittals mailbox together with the report documents as PDF files. The city’s general submittal sheet adds that permit applications are taken by e-mail only and that hard copies are not accepted at the office. The complete package we deliver for a Sweetwater building is put together for that route.',
      },
      {
        q: 'Who reviews the recertification report in Sweetwater?',
        a: 'The city’s own engineer, along with every trade the report touches, according to Sweetwater’s instructions. When that review is done the department phones the applicant, either to say the permit can be picked up or to pass on comments that need an answer. Neither of the city’s documents gives a review time.',
      },
      {
        q: 'How long does a Sweetwater owner have to file the recertification report?',
        a: 'The days are the county’s, in the “Time to file” row above, and the time for repairs is under “If repairs are needed”. Sweetwater’s memorandum still prints the counts from an earlier version of the county code, so the date on your notice and the rows above are what to go by.',
      },
      {
        q: 'What happens in Sweetwater if the recertification report is never filed?',
        a: 'Sweetwater’s memorandum lists the steps: a Civil Violation Notice or ticket, with no further notice, and the case sent to the Unsafe Structures Unit for condemnation proceedings. After an unsafe structures violation the building has to be emptied, it adds, and demolition can follow. Already past the date on your Sweetwater notice? Send it all the same.',
      },
      {
        q: 'Is Sweetwater’s recertification the same as the 40-year recertification?',
        a: 'Yes. The city’s forms page still files it under the 40-Year Recertification name, and the memorandum uses that name throughout. It is Miami-Dade County’s building recertification; the ages in force now are under “First due” and “Then” above, not the one printed in the memorandum.',
      },
    ],
    nextStep:
      'Received the memorandum or a notice from Sweetwater’s Building and Zoning Department? A phone photo of it is all it takes — or, without one, the address and the year the building went up. From it we work out what Sweetwater’s department wants, and our answer is a proposal covering the complete recertification.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'west-miami',
    program: 'building-recertification',
    city: 'West Miami',
    place: 'West Miami',
    office: {
      name: 'City of West Miami Building Department',
      address: ['901 SW 62 Avenue', 'West Miami, FL 33144'],
      phone: '(305) 266-4214',
    },
    description:
      'West Miami building recertification: the Building Department’s notification letter, its own report forms, mailing the report, and the complete package.',
    heroSub:
      'West Miami’s Building Department writes to the owner with a letter of notification and asks for the report by mail, on forms it posts itself. Already late? One team still delivers the complete recertification of your West Miami building, parking-lot certifications included where they apply.',
    lede:
      'In West Miami the recertification runs through the City of West Miami Building Department, which reviews, issues and inspects the city’s building permits. Its letter of notification, posted on the city’s site with the report forms, tells the owner what to file, where to send it and what follows if nothing arrives.',
    local: [
      { k: 'The letter', v: 'West Miami’s letter of notification says the Building Department hears from the Property Appraiser’s Office about the building’s age and then writes to the owner. The template the city posts still describes the county rule on the earlier schedule; for a West Miami building the ages and days in force are the county’s, in the rows above.' },
      { k: 'Sending the report', v: 'The letter asks for the completed Recertification Report to be mailed to the City of West Miami Building Department, to the department’s own attention. The city runs a permit portal for its permits, but nothing on its site says a recertification report is filed there, so the route is confirmed with the department before the package goes out.' },
      { k: 'The city’s forms', v: 'West Miami posts its own set: the letter of notification, a structural form under the Building Department’s heading, electrical inspection guidelines, general considerations guidelines and the parking-lot certification forms, each still labelled with the program’s former 40-year name. The letter says the forms are PDFs the architect or engineer fills in and then prints.' },
      { k: 'Paper copies', v: 'An owner who would rather work from paper can call the Building Department and ask for a hard copy of the forms, the letter says. Its closing line sends further questions to the Billing and Collection Unit Supervisor, on the department’s main line.' },
      { k: 'What the report carries', v: 'West Miami’s letter wants the electrical and the structural report signed and sealed on every page by the engineer or architect. Where the lot has two buildings or more, a site plan or a copy of the survey has to show where each one sits and point out which one is being recertified.' },
      { k: 'The lot certificates', v: 'The city’s letter encloses the county’s parking-lot illumination and guardrail chapter and requires the certifications of compliance with both as part of the submission. The city’s guardrail form adds that, where a lot abuts a canal, lake or other water without a compliant guardrail, the owner must get a permit to install one.' },
      { k: 'Claiming an exemption', v: 'Where the building is exempt, younger than the letter assumes or already torn down, West Miami asks the owner to tell the office and send the documents on hand; a claim for a building that still stands goes with dated photos of the front and the back.' },
      { k: 'If it is late', v: 'West Miami’s letter says a missing report brings a Civil Violation Notice or ticket with no further warning, and a referral to the Unsafe Structures Unit to open condemnation proceedings. After an unsafe structures Notice of Violation the building must be emptied, the letter goes on, and demolition can be where it ends.' },
    ],
    faq: [
      {
        q: 'Who sends the recertification letter in West Miami?',
        a: 'The City of West Miami Building Department. Its letter of notification says the department acts on word from the Property Appraiser’s Office about the building’s age, and the letter closes over the Building Official’s title. A phone photo of the West Miami letter lets us confirm what the department wants and by when.',
      },
      {
        q: 'How do we send the recertification report to West Miami?',
        a: 'West Miami’s letter has it mailed to the City of West Miami Building Department, at the address shown on this page. The city also runs an online permit portal, but nothing on its site says recertification reports go through it, so we confirm the route with the department first. Whatever the route, the complete recertification we prepare is filled in on West Miami’s own posted forms.',
      },
      {
        q: 'How long does an owner in West Miami have to file the report?',
        a: 'Count it the county’s way: the days are under “Time to file” above, and repairs run under “If repairs are needed”. West Miami’s letter prints its own count from the date of the notice, written on the earlier schedule, so read the date on your letter against the rows above.',
      },
      {
        q: 'Which buildings in West Miami are exempt from recertification?',
        a: 'The letter lists single-family homes, duplexes and buildings that stay under both an occupant-load limit and an area limit, plus non-residential farm buildings on farms. An owner who believes the building is exempt tells the Building Department, with documentation and dated photos of the front and rear. Unsure about a West Miami building? Its address and year of construction are enough to start.',
      },
      {
        q: 'Is West Miami’s recertification the same as the 40-year recertification?',
        a: 'Yes. Every recertification form West Miami posts is still titled with the 40-year name, and the letter cites the county code that governs the program today. The ages in force are the county’s, under “First due” and “Then” above, not the age printed in the letter.',
      },
    ],
    nextStep:
      'Send the letter from the City of West Miami Building Department — a photo taken with a phone will do — or, if none has come yet, the address and the year built. Our reply sets out what West Miami wants and the date that matters, with a proposal for the complete recertification attached.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'fort-lauderdale',
    program: 'broward-bsip',
    city: 'Fort Lauderdale',
    place: 'Fort Lauderdale',
    office: {
      name: 'City of Fort Lauderdale Development Services Department',
      phone: '(954) 828-5932',
    },
    description:
      'Building Safety Inspection Program (BSIP) in Fort Lauderdale: the certified notice, filing through LauderBuild and what one team delivers, complete.',
    heroSub:
      'Fort Lauderdale’s Building Official sends the notice by certified mail; the reports go in through the LauderBuild Plan Room. Already late? One team still delivers the complete BSIP inspection and report.',
    lede:
      'On Fort Lauderdale’s site, Broward’s Building Safety Inspection Program (BSIP) comes under the City of Fort Lauderdale Development Services Department, and the program page gives the Building Safety Program as the contact. The notice comes from the Building Official by certified mail, and the whole filing is electronic, through the LauderBuild Plan Room.',
    local: [
      { k: 'The notice', v: 'Fort Lauderdale’s page says the notice comes from the Building Official by certified mail, to the property owner, the association or both, in the year the building is due for inspection. Keep it: the city’s submittal form asks for the tracking number from that notification.' },
      { k: 'Filing the report', v: 'Fort Lauderdale takes the filing electronically only — its page says paper submissions are no longer accepted. The documents go in through the LauderBuild Plan Room, under the application the city calls the Building Safety Inspection Program Application (BSIP). Each one is uploaded as a separate file; the page says not to combine them.' },
      { k: 'The city’s forms', v: 'The city’s page lists the forms that must be completed and attached to the application: its own Building Safety Inspection Submittal Form, a structural inspection form and an electrical inspection form. The structural form it links is headed Broward County BORA, the county’s Board of Rules and Appeals. The Plan Room’s list of document types marks both inspection forms as requiring the digital sign and seal.' },
      { k: 'The submittal form', v: 'Fort Lauderdale’s submittal form asks for the property’s folio number and the building’s square footage. It is marked either as an initial submittal or as a Repairs Required Submittal, which also asks for the permit numbers of the repairs. Its checklist names the structural and the electrical report forms as part of the package.' },
      { k: 'Signatures and files', v: 'Fort Lauderdale requires every document to be digitally signed and sealed. The city’s Digital Signature Policy does not accept a self-signed signature, and it names the certification authorities it approves for digital certificates. The Plan Room’s general standards ask for PDF files and rule out encrypted or password-protected ones.' },
      { k: 'After filing', v: 'Once the application is in, Fort Lauderdale’s page mentions one step: an e-mail notification when it has been accepted. It does not say how the owner is told the result of the review or what document closes the case. Under the Plan Room’s general rules, once a package has been submitted for review, more documents cannot be uploaded without permission from City staff.' },
      { k: 'Repairs', v: 'When repairs are needed, Fort Lauderdale’s page calls for a written, signed and sealed letter to both the owner and the Building Official, stating whether the building can stay safely occupied while they are made. Once they are finished, it has the licensed professional who did the inspection re-inspect and provide an amended report, with a signed and sealed letter confirming that all repairs are complete.' },
      { k: 'If it is late', v: 'Fort Lauderdale’s program page does not say what happens when a report is late: it names no hearing body and describes no extension of the time to file. The one exception it mentions concerns repairs, whose time — in the rows above — applies unless the Building Official specifies otherwise. For anything else, the notice and the Building Safety Program settle it.' },
    ],
    faq: [
      {
        q: 'Who sends the BSIP notice in Fort Lauderdale, and how does it arrive?',
        a: 'Fort Lauderdale’s Building Official, by certified mail. The city’s page says owners and associations receive it in the year their building is due for inspection, and the city’s submittal form later asks for the tracking number from that notification. A phone photo of the notice is enough for us to read it and confirm what Fort Lauderdale is asking for and by when.',
      },
      {
        q: 'How do we file a BSIP report in Fort Lauderdale?',
        a: 'Through the LauderBuild Plan Room; Fort Lauderdale no longer accepts paper. LauderBuild’s page lists a desktop computer as a minimum requirement — submission is not supported on mobile devices — and its FAQ, written for permit records, says the Plan Room opens a record only to a LauderBuild account whose contact is listed on it. The complete BSIP inspection and report we deliver goes on the forms Fort Lauderdale’s page lists.',
      },
      {
        q: 'How long do we have to file the BSIP report in Fort Lauderdale?',
        a: 'Both times are Broward’s and sit in the rows above: the time to file the report and the time for repairs. On repairs, Fort Lauderdale’s page adds that the time applies unless the Building Official specifies otherwise. The page describes no way to ask for more time to file, so the certified notice and the Building Safety Program settle what applies to your building.',
      },
      {
        q: 'Which buildings are exempt from the BSIP in Fort Lauderdale?',
        a: 'Fort Lauderdale’s page lists what is not subject to the program: federal and state government buildings, buildings on sovereign tribal lands, school buildings managed by the Broward County School Board, small residential buildings and small structures (the page sets their size limits), certain townhouses, defined by their form of ownership, and railroads and related facilities. If Fort Lauderdale’s notice reached a building you believe is on that list, send it to us with the address.',
      },
      {
        q: 'How do we correct a BSIP report already filed in Fort Lauderdale?',
        a: 'For resubmissions or corrections of older reports — Fort Lauderdale’s page gives the cut-off date — the corrected report goes by e-mail to the addresses printed there, not through a new application, which the page says results in duplicate records. The page gives no instruction for a report created after that date; under the Plan Room’s general rules, a package already submitted for review takes further uploads only with permission from City staff.',
      },
    ],
    nextStep:
      'Send the certified notice from Fort Lauderdale’s Building Official — a phone photo is enough — or, with none yet, the address and the year of the certificate of occupancy. We confirm what the city asks for and by when, and reply with a proposal for the complete BSIP inspection and report.',
  },
  {
    slug: 'hollywood',
    program: 'broward-bsip',
    city: 'Hollywood',
    place: 'Hollywood',
    office: {
      name: 'City of Hollywood Building Division',
      address: ['Development Services Hub, Second Floor Library', 'City Hall Circle, 2600 Hollywood Blvd', 'Hollywood, FL 33020'],
      phone: '(954) 921-3335',
    },
    description:
      'Building Safety Inspection Program (BSIP) in Hollywood: the city’s notice, filing through the ACA portal, and what one team delivers, complete.',
    heroSub:
      'Hollywood takes new BSIP reports only through its Accela Citizen Access portal, and its Building Division reviews them. Already late? The complete BSIP inspection and report still come from one team.',
    lede:
      'In Hollywood the Building Safety Inspection Program (BSIP) runs through the City of Hollywood Building Division. The Building Official issues the notice, the report goes in through the Accela Citizen Access (ACA) portal, and the city’s Plan Reviewers review what is filed.',
    local: [
      { k: 'The notice', v: 'Hollywood’s page says the Building Official issues a Notice of Required Inspection to the building’s owner or association. The Board of Rules and Appeals sends the city the lists of properties that are due, and Hollywood posts them on that same page as soon as it receives them.' },
      { k: 'Filing the report', v: 'Hollywood’s page says all new BSIP reports must be submitted through the City of Hollywood’s Accela Citizen Access (ACA) portal. It says hard copies and mailed submissions are no longer accepted, and that every required signature must be digital and validated through ACA — handwritten or scanned signatures are not accepted.' },
      { k: 'Before you file', v: 'Hollywood sets a step ahead of the filing. The engineer or architect responsible for the report must be registered in ACA and approved by the city’s intake staff before the report is submitted, and must be selected in ACA as the design professional for the application. If that professional does not appear in ACA, the page says the report cannot be submitted.' },
      { k: 'The city’s forms', v: 'The report packet the city hosts opens with Hollywood’s own Transmittal Checklist for the BSIP report. It asks for a current Broward County Building Safety Inspection structural report and electrical report, each indicating whether repairs are required or not. The checklist adds that several stand-alone building structures cannot be combined in one report.' },
      { k: 'What goes with it', v: 'For each building, Hollywood’s page asks for the completed BSIP report, which includes the structural and the electrical inspections, together with photos of the existing condition. If repairs are required, it also asks for a narrative or scope of work and for color photos, as a PDF, of the area that requires them.' },
      { k: 'After filing', v: 'Hollywood’s Building Division reviews the reports. Under its heading for buildings where no repairs are required, the city’s page says a Certificate will be issued if, on the Plan Reviewers’ review, the submitted documents are in compliance. The page does not say how the owner is told the result; that is a question for the Building Division.' },
      { k: 'Repairs', v: 'If the BSIP report identifies work that requires a building permit, Hollywood’s page says the city’s Plan Reviewer requests it after the report is submitted and reviewed, and the application also goes through ACA. The city’s checklist says a permit may be required depending on the extent of the repairs, and asks for the permit number when the report is submitted after the required repairs.' },
      { k: 'Older names', v: 'One section of Hollywood’s page still carries the program’s former name, the 40-year program, and the earlier schedule. The sample notice letter the city posts repeats that schedule and speaks of mailing or delivering the report. The ages and days in force are the county’s, in the rows above; for filing, the page’s submission requirements name the ACA portal.' },
    ],
    faq: [
      {
        q: 'How do we submit a BSIP report in Hollywood?',
        a: 'Through the City of Hollywood’s Accela Citizen Access (ACA) portal: the city’s page says hard copies and mailed submissions are no longer accepted. The city’s Permits page says Hollywood has moved to ACA for all new permit applications as well. Before the report goes in, the engineer or architect responsible for it has to be registered and approved in ACA.',
      },
      {
        q: 'Can we ask Hollywood for more time on the BSIP?',
        a: 'Hollywood’s own page sets out no procedure for it. A question-and-answer sheet from the Board of Rules and Appeals, linked from that page, says to contact the city or county building official where the property is located to postpone an inspection or to extend the period for repairs. For a building in Hollywood, that is the city’s Building Official.',
      },
      {
        q: 'What do we do with the BSIP notice if we own a unit in a Hollywood condominium?',
        a: 'The sample notice letter Hollywood posts carries a note addressed to individual unit owners. It says the notice is for informational purposes only, to tell them their building is due for the Building Safety Inspection Program, and asks them to contact their property manager or condominium association board about inspections of their unit and the common areas. If you sit on that board in Hollywood, send us the letter.',
      },
      {
        q: 'What happens in Hollywood if the BSIP report is not filed on time?',
        a: 'Hollywood’s page puts it in terms of non-compliant buildings, not late reports. In a list of steps it says the city is taking, it says such buildings could be posted with a Notice of Violation, and that an owner who fails to respond to the posted notice could be referred to the Special Magistrate. If the building is determined to be unsafe, the matter could be forwarded to the Broward County Unsafe Structures Board.',
      },
      {
        q: 'Is Hollywood’s BSIP the same as the 40-year recertification?',
        a: 'Yes. One section of Hollywood’s page still calls the program by its former 40-year name, while its section on submitting reports calls it the Building Safety Inspection Program, or BSIP. If your Hollywood letter uses the old name, send it to us — a phone photo is enough — and we confirm what the Building Division is asking for and by when.',
      },
    ],
    nextStep:
      'Send your Hollywood Notice of Required Inspection — a phone photo is enough — or, with no notice yet, the address and the year of the certificate of occupancy. We confirm what Hollywood’s Building Division asks for and by when, and reply with a proposal for the complete BSIP inspection and report.',
  },
  {
    slug: 'pompano-beach',
    program: 'broward-bsip',
    city: 'Pompano Beach',
    place: 'Pompano Beach',
    office: {
      name: 'City of Pompano Beach Building Department',
      address: ['Pompano City Hall, 3rd Floor', '100 West Atlantic Boulevard', 'Pompano Beach, FL 33060'],
      phone: '(954) 786-4669',
    },
    description:
      'Building Safety Inspection Program (BSIP) in Pompano Beach: the certified-mail notice, where the report goes and the city’s own affidavit.',
    heroSub:
      'Pompano Beach’s Building Official sends the notices by certified mail and receives the reports. Already late? One team still delivers the complete BSIP inspection and report, on the forms the city names.',
    lede:
      'In Pompano Beach the Building Safety Inspection Program (BSIP) runs through the Building Official, in the city’s Building Department. The city’s program page covers the notice, the report, repairs and extensions, and it lists a form of the city’s own, the Re-Inspection Affidavit.',
    local: [
      { k: 'The notice', v: 'Pompano Beach’s page says the Building Official sends the Notice of Required Inspection by certified mail, to the owner or the association of each building due that calendar year. The notices go out each year, within the dates the page gives. The page counts the time to file from that notice; the time itself is in the rows above.' },
      { k: 'Filing the report', v: 'Pompano Beach’s program page says the written report is submitted to the Building Official and includes the Broward County Board of Rules and Appeals Structural and Electrical Safety Inspection Report Form. It names no portal, e-mail or file format for that report, so we confirm with the Building Department how to deliver it before it is filed.' },
      { k: 'The city’s forms', v: 'With the report, Pompano Beach’s page asks for the Board of Rules and Appeals’ structural and electrical report form. Its program page also lists a form of the city’s own: the Building Safety Inspection Program Re-Inspection Affidavit, on the letterhead of its Building Inspections Division. The department’s forms page describes it as the form for re-inspecting a building going through a required safety inspection.' },
      { k: 'After filing', v: 'Pompano Beach’s page does not describe how a report is reviewed or what closes the case. It does link to case status in the city’s online Code Compliance service, which shows a case and its next course of action. The Building Department’s contact page lists a Building Safety Compliance group, with a chief inspector, a compliance officer and a secretary.' },
      { k: 'Repairs', v: 'When repairs are needed, Pompano Beach’s page asks for a signed and sealed letter to the owner and the Building Official on whether the building may stay safely occupied meanwhile. That letter is valid for a limited time; a new one is issued if repairs go on. After the repairs, the areas noted in the original report are re-inspected and an amended report follows.' },
      { k: 'The Re-Inspection Affidavit', v: 'Pompano Beach’s affidavit records the re-inspection after the repairs. It cites the original report by its city permit or case number and marks the repairs as completed under the restoration permits it references, or as minor work that needed no permit. It goes to the Building Official electronically, with an electronic signature and seal, or by hand with an embossed or wet seal.' },
      { k: 'Extensions', v: 'Pompano Beach’s page says the Building Official may extend, up to a limit, the time to submit the report or to obtain permits. The request comes in writing from the licensed professional, with a signed and sealed statement that the building may stay occupied. Repairs that need longer can get a new time frame, with the Building Official’s approval, while the repair permit stays active.' },
      { k: 'Who is exempt', v: 'Pompano Beach’s page lists as exempt federal and State of Florida buildings, buildings on sovereign tribal lands, Broward County School Board schools, railroads, certain townhouses and, within limits the page gives, small dwellings and minor structures. It adds that elevated decks, balconies, docks and seawalls are part of the program when they are attached to a structure or support one.' },
    ],
    faq: [
      {
        q: 'Who sends the Building Safety Inspection Program notice in Pompano Beach?',
        a: 'The city’s Building Official. Pompano Beach’s page says the Notice of Required Inspection travels by certified mail to the owner or the association, and that the report comes back to the Building Official. A phone photo of that notice is all we need to read it and confirm what the Building Official is asking for, and by when.',
      },
      {
        q: 'How do we file the BSIP report in Pompano Beach?',
        a: 'Pompano Beach’s page says the report is submitted to the Building Official, with the Board of Rules and Appeals’ structural and electrical report form. It gives no portal, e-mail or file format for it. The city’s Re-Inspection Affidavit does carry a delivery instruction — electronically or by hand — but it speaks of that affidavit, not of the report. So we ask the Building Department how it wants the report before anything is filed.',
      },
      {
        q: 'Does Pompano Beach have its own forms for the BSIP?',
        a: 'It has one for the re-inspection that follows repairs: the Re-Inspection Affidavit, listed on the city’s program page and carrying the letterhead of its Building Inspections Division. For the report itself, Pompano Beach’s page names the Broward County Board of Rules and Appeals’ structural and electrical report form. The complete BSIP inspection and report we deliver goes on the forms that page names.',
      },
      {
        q: 'Can we get more time for the BSIP report or the repairs in Pompano Beach?',
        a: 'Pompano Beach’s page provides for it. The Building Official may issue an extension, capped on the page, to submit the report or to obtain permits when the licensed professional asks in writing and states, signed and sealed, that the building may stay occupied. For repairs that cannot be finished in time, a new time frame may be approved while a repair permit stays active. The county’s times are in the rows above.',
      },
      {
        q: 'What happens in Pompano Beach if the BSIP report is late?',
        a: 'Pompano Beach’s program page does not say. It covers the notice, the report, repairs and extensions, and says nothing on what follows a late report. Is the date on your notice already past? Send it to us all the same, and we read what the Building Official is asking for.',
      },
    ],
    nextStep:
      'Send the notice from Pompano Beach’s Building Official — a phone photo is enough — or, with no notice yet, the address and the year of the certificate of occupancy. We read what Pompano Beach asks for and by when, then reply with a proposal for the complete BSIP inspection and report.',
  },
  {
    slug: 'hallandale-beach',
    program: 'broward-bsip',
    city: 'Hallandale Beach',
    place: 'Hallandale Beach',
    office: {
      name: 'City of Hallandale Beach Building Division',
      address: ['400 South Federal Highway', 'Hallandale Beach, FL 33009'],
      phone: '(954) 457-2220',
    },
    description:
      'BSIP in Hallandale Beach: how the Building Division notifies owners, how the report is submitted online and what one team delivers, complete.',
    heroSub:
      'Hallandale Beach’s Building Division sends the notices and the report goes in through the city’s Self-Service Portal. Already late? One team still delivers the BSIP inspection and report, complete.',
    lede:
      'In Hallandale Beach the Building Safety Inspection Program (BSIP) runs through the City of Hallandale Beach Building Division. Each year the Broward County Board of Rules and Appeals gives each jurisdiction its list of buildings that are due; the Building Official then writes to the owner or association, and the report goes back through the city’s online portal.',
    local: [
      { k: 'The notice', v: 'The program page says the Broward County Board of Rules and Appeals gives each jurisdiction, every year, the list of buildings due for inspection. The Building Official then notifies the owner or the association by certified mail, return receipt. An e-mail notice linked from that page says the Building Division sends out the notifications to the properties on its list.' },
      { k: 'Filing the report', v: 'The program page has a button to submit the Building Safety Inspection report. It opens the Hallandale Beach Self-Service Portal, whose home page has a step to log in to an existing account or create a new one. The program page names no other way to hand the report in.' },
      { k: 'The city’s forms', v: 'Hallandale Beach’s Inspections page says the written report includes the structural and electrical report forms of the Board of Rules and Appeals. The Building Division’s forms page posts the program’s two inspection forms, its guidelines and the Board’s policy. It adds a general rule, not one written for the BSIP: third-party verification is required for all digitally signed and sealed documents.' },
      { k: 'After filing', v: 'Once the report is reviewed and any repairs are made, the program page says, the building is certified safe for continued occupancy. The city’s FAQ points to a list on the city’s website of the properties that have had inspections and whether or not each passed. Hallandale Beach’s pages do not say how the owner is told the result.' },
      { k: 'Repairs', v: 'The program page says the report identifies any deficiencies, and that these call for a repair permit. The notice template posted on that page adds that repairs follow the Florida Existing Building Code and the National Electrical Code, and that incidental, non-life-threatening ones are finished within a time frame specified by the inspecting professional and approved by the Building Official.' },
      { k: 'Extensions', v: 'The city’s FAQ says a property that did not meet the deadline must request an extension, which the Building Official grants depending on the situation and complexity of the work. For repairs, the notice template says the time may be extended when the inspecting professional specifies a time frame, the Building Official approves it and a building permit stays active. Neither says how to ask.' },
      { k: 'If it is late', v: 'The city’s FAQ says that when a report finds critical safety concerns, or a property is non-compliant — no effort to apply for permits — the Building Official can recommend to the Unsafe Structures Board that the structure be deemed unsafe. The notice template says a building that is not certified faces unsafe structure proceedings under the Florida Building Code.' },
      { k: 'Who is exempt', v: 'The program page lists as exempt one- and two-family dwellings, United States Government and State of Florida buildings, schools under the Broward County School Board and buildings on Indian reservations, and it leaves out buildings under a floor area it states. The city’s FAQ adds that the inspection is not waived unless the entire building was demolished.' },
    ],
    faq: [
      {
        q: 'Can we hand in the BSIP report in person or by e-mail in Hallandale Beach?',
        a: 'The program page names one route: its submit button, which opens the Hallandale Beach Self-Service Portal. The Building Division’s page says permit-related documents must go through its online portal, and that those e-mailed to its support address are not processed. For visits it welcomes walk-ins but prefers appointments, made by phone. We confirm with Hallandale Beach’s Building Division how it wants your report before anything is submitted.',
      },
      {
        q: 'Will a City of Hallandale Beach inspector come to inspect our building?',
        a: 'No, the city’s FAQ says: its review is based totally on the report, and repairs are required as the architect or engineer states them. The same FAQ says the inspecting professional uses their discretion to decide how many units are inspected, and that the inspection addresses structural and electrical life, health and safety issues, not aesthetic changes.',
      },
      {
        q: 'What if our building in Hallandale Beach is on the BSIP list by mistake, or is missing from it?',
        a: 'The notice template on the program page tells owners who think their building was misclassified, and falls within the exemptions, to notify the city in writing. For a building that has not been certified, is not listed or shows signs of severe damage, the city’s FAQ asks people to report it on the MyHB App or by e-mail. Send us your Hallandale Beach letter and we read it against the building’s history.',
      },
      {
        q: 'What does Hallandale Beach’s condominium registration have to do with the BSIP?',
        a: 'Hallandale Beach’s program page points owners to their building’s condominium registration documents. The city requires condominium, multi-family homeowner and cooperative apartment associations to register every year. The registration page asks for the status of recertification — the city’s word there — and a copy of any engineer’s or architect’s report, issued within the previous year, on the building’s structural, electrical or life-safety conditions.',
      },
      {
        q: 'Is Hallandale Beach’s BSIP the same as the 40-year inspection?',
        a: 'Yes. That older name is still on several Hallandale Beach documents: the e-mail notice linked from the program page speaks of a 40-year certification, and the notice template posted there dates from an earlier year. Some pages also print the earlier schedule, so go by the letter you receive. The ages and days in force in Hallandale Beach are the county’s, in the rows above.',
      },
    ],
    nextStep:
      'Send the Building Official’s certified letter — a phone photo is enough — or, with no letter yet, the address and the year of the certificate of occupancy. We confirm what Hallandale Beach’s Building Division asks for and by when, and reply with a proposal for the complete BSIP inspection and report.',
  },
  {
    slug: 'deerfield-beach',
    program: 'broward-bsip',
    city: 'Deerfield Beach',
    place: 'Deerfield Beach',
    office: {
      name: 'City of Deerfield Beach Building Division',
      address: ['150 N.E. 2nd Ave.', 'Deerfield Beach, FL 33441'],
      phone: '(954) 250-4060',
    },
    description:
      'Building Safety Inspection Program (BSIP) in Deerfield Beach: what the city posts, what its pages leave out, and one team that delivers it complete.',
    heroSub:
      'Deerfield Beach’s Building Division says it follows Board of Rules and Appeals guidelines; the city posts the inspection forms. Already late? One team still delivers the complete BSIP inspection and report on them.',
    lede:
      'Deerfield Beach has no page of its own for the Building Safety Inspection Program (BSIP). On the city’s site the program appears only as four documents on the Applications and Forms page; how permits are filed, and who handles them, is on the Building Services page.',
    local: [
      { k: 'The city’s forms', v: 'The city’s Applications and Forms page lists the Board of Rules and Appeals (BORA) policy for the Building Safety Inspection Report, the Building Safety Inspection guidelines, a structural form and an electrical form. The electrical form carries the Board’s own heading, “Broward County BORA”. For a Deerfield Beach building, the complete BSIP inspection and report we deliver goes on those forms.' },
      { k: 'Filing the report', v: 'Deerfield Beach’s own pages do not say how a BSIP report is filed. What the Building Services page describes is permit filing: new permit applications and plans can be submitted online, through the “Online Permit Submittal” button, and can still be taken in person to the Building Division in City Hall. We confirm with the division how it takes the report before anything is sent.' },
      { k: 'The office', v: 'On its page, the Building Division says it complies with the guidelines of the Florida Building Commission and of the Broward County Board of Rules and Appeals. The same page says CAP Government “will be responsible for performing all duties related to the Florida Building Code”, among them permit applications, plan approvals, inspections and permit close-out; it does not say who reviews a BSIP report.' },
      { k: 'Repairs', v: 'The city’s own pages say nothing specific about repairs under the BSIP. Where a repair needs a permit, Deerfield Beach’s general permit rules come in: the forms page notes that all permit applications in the city require the owner’s signature, and the Building Services page says the DFB HOA Affidavit is required for all residential permits.' },
      { k: 'If it is late', v: 'Deerfield Beach’s own pages do not say what the city does when a BSIP report is late; the time to file is in the county’s rows above. The Building Services page says, in general terms, that the division is responsible for the identification and removal of unsafe structures in conjunction with the Unsafe Structure Board; it does not tie that to this program.' },
      { k: 'Not on the city’s pages', v: 'The city’s own pages do not say who sends the notice in Deerfield Beach or when, what follows once a report is filed, or how an extension is requested. The Building Services page gives the Building Department’s telephone for help with permit applications, requirements or submission information; it names no BSIP contact. In Deerfield Beach the letter and the Building Division settle the rest.' },
    ],
    faq: [
      {
        q: 'Where do we find the BSIP forms for Deerfield Beach?',
        a: 'On the city’s Applications and Forms page, which lists a structural and an electrical Building Safety Inspection form together with the Board of Rules and Appeals policy and its guidelines. The site shows no cover sheet, affidavit or checklist of the city’s own for the program, so we confirm with the Building Division what it wants filed with the report.',
      },
      {
        q: 'How do we file the BSIP report in Deerfield Beach?',
        a: 'Deerfield Beach’s own pages do not say. Its online portal is titled the Deerfield Beach Building Services Digital Permitting Portal, and the Building Services page presents online submittal and the visit to the Building Division in City Hall for permit applications and plans; it says nothing of BSIP reports. We ask the division how the report must reach it before the package goes in.',
      },
      {
        q: 'What happens in Deerfield Beach if the BSIP report is late?',
        a: 'The city’s own pages do not say: they post the Board of Rules and Appeals policy as a document, and the Building Division’s page speaks in general terms of unsafe structures and the Unsafe Structure Board, with no mention of a late report. If the date on your Deerfield Beach letter has passed, send it all the same: we read it and confirm with the division what it now asks for.',
      },
      {
        q: 'How long do we have to file the BSIP report in Deerfield Beach?',
        a: 'The time to file in Deerfield Beach is the county’s, and it is in the rows above. The city’s own pages print no deadline for the report: what the city posts is the Board of Rules and Appeals policy, as a document on its forms page. Go by the date on the letter you received for your Deerfield Beach building.',
      },
      {
        q: 'Is the BSIP in Deerfield Beach what we still call the 40-year recertification?',
        a: 'It is the program that took its place: the copy of the Board of Rules and Appeals policy on the city’s site gives “40 Year Building Safety Inspection Program” as the name of the prior program. Deerfield Beach’s own pages do not use that former name. The ages and days that apply in Deerfield Beach now are the county’s, in the rows above.',
      },
    ],
    nextStep:
      'Send your Deerfield Beach letter — a phone photo is enough — or, with no letter yet, the address and the year of the certificate of occupancy. We confirm with the City of Deerfield Beach Building Division what is asked, and reply with a proposal for the complete BSIP inspection and report.',
  },
  {
    slug: 'pembroke-pines',
    program: 'broward-bsip',
    city: 'Pembroke Pines',
    place: 'Pembroke Pines',
    office: {
      name: 'City of Pembroke Pines Building Department',
      address: ['601 City Center Way, 2nd Floor', 'Pembroke Pines, FL 33025'],
      phone: '(954) 435-6502',
    },
    description:
      'Building Safety Inspection Program (BSIP) in Pembroke Pines: the BSIP permit number, filing in person or online, and one team delivering it complete.',
    heroSub:
      'In Pembroke Pines the reports go to the city’s Building Department, in person or through the Development Hub. Already late? The BSIP inspection and report still come complete, from one team.',
    lede:
      'In Pembroke Pines the Building Safety Inspection Program (BSIP) goes through the city’s Building Department. A building that comes due is assigned a BSIP permit number; the letter cites it, and the city’s page asks for it again on the cover sheet, to link the Development Hub account and on a repair permit application.',
    local: [
      { k: 'The notice', v: 'When a building is due under the program, a BSIP permit number is assigned to the property. The owner listed on the Broward County Property Appraiser website receives a notification letter in the mail that refers to that number. Keep it at hand: Pembroke Pines asks for the number on the cover sheet, to link the online account and on a repair permit application.' },
      { k: 'Filing the report', v: 'Once the inspection reports are ready they go to the Building Department, and the city’s page gives two options: an in-person submittal or an online one. The online option runs through the Development Hub, where you must have an account. The Building Department is in the Charles F. Dodge City Center.' },
      { k: 'In person', v: 'The page’s list of what to bring in person includes a cover sheet — it calls it a Transmittal Letter — showing the BSIP permit number, and the two report forms. It links the forms but no cover sheet. The department’s forms page lists a “Transmittal Letter Sheet” with a line for the permit number; the site never says it is the one meant for the BSIP.' },
      { k: 'The Development Hub', v: 'Pembroke Pines’ page lays out the online steps. With a Development Hub account in place, phone or e-mail the Building Department to have the account linked to the BSIP permit number. Once linked, log in and find the permit in the dashboard or with the search tool. Open it and upload the documents under the “Attachments” tab, each document separately.' },
      { k: 'The city’s forms', v: 'Pembroke Pines’ program page links two report forms: the Structural Safety Inspection Report Form and the Electrical Safety Inspection Report Form. Both files are marked “Broward County BORA”; the page links no edition under the city’s own name. The same two forms are named for the in-person submittal and for the online one.' },
      { k: 'Repairs', v: 'If repairs are required, Pembroke Pines’ page says you apply for the appropriate permit: structural repairs under “Structural Miscellaneous”, electrical repairs under “Electrical Miscellaneous”. The application is the most current Broward County Uniform Building Permit Application, and it shows the BSIP permit number so the repair permit is linked to it. The city’s permit page says permit applications are no longer accepted by e-mail.' },
      { k: 'Plans for the repairs', v: 'For a repair permit submitted in person, the page says all plans must be physically signed and sealed, and that digital signatures are not accepted for in-person submissions. For an online submittal the construction plans are digitally signed and sealed. Online, every required document must be uploaded at the time of submission; nothing more can be uploaded until the review cycle is complete.' },
      { k: 'After filing', v: 'Pembroke Pines’ page says follow-up inspections may be required. After a repair, an updated Safety Inspection Report Form goes to the BSIP permit number once the repair permit is complete; the page requires it to satisfy the program. It does not say who reviews a report, how the owner hears back or how more time is requested — the county’s deadlines are in the rows above.' },
    ],
    faq: [
      {
        q: 'Who receives the BSIP notice in Pembroke Pines?',
        a: 'The property owner listed on the Broward County Property Appraiser website, by mail. The letter is about the Building Safety Inspection Program and refers to the BSIP permit number assigned to the property, which the city’s page asks for again when the report is filed. Send us that letter — a phone photo is enough — and we confirm what Pembroke Pines’ Building Department is asking for and by when.',
      },
      {
        q: 'How do we file the BSIP report in Pembroke Pines?',
        a: 'With the Building Department, in one of the two ways the city’s page lists. In person, with a cover sheet that shows the BSIP permit number. Or online, through a Development Hub account that the department has linked to that permit number: the documents are then uploaded under the permit’s “Attachments” tab, each one separately.',
      },
      {
        q: 'Does Pembroke Pines have its own BSIP forms?',
        a: 'For the reports, its program page links none of its own. The two forms it does link — the Structural Safety Inspection Report Form and the Electrical Safety Inspection Report Form — are marked “Broward County BORA”. What the city adds for an in-person submittal is a cover sheet, which its page calls a Transmittal Letter. For a Pembroke Pines building, the complete BSIP inspection and report we deliver goes on the forms that page links.',
      },
      {
        q: 'What does a condominium in Pembroke Pines need for a BSIP repair permit?',
        a: 'The repair permit goes in under “Structural Miscellaneous” or “Electrical Miscellaneous”, with the BSIP permit number on the application. The department’s forms page, written for permits in general, adds two documents. Where the Property Appraiser lists the property’s use as a condominium, a Condominium Approval Letter, signed and notarized by a registered agent listed with Sunbiz, must be part of the submittal. A Homeowner’s Association Affidavit of Awareness is required with every permit submittal.',
      },
      {
        q: 'What happens in Pembroke Pines if the BSIP report is late?',
        a: 'Pembroke Pines’ program page is silent on it: no penalty, no hearing and no number of days appear there; the time to file is the county’s, in the rows above. What the page does say is that property owners are responsible for completing inspections on time, and it gives an e-mail contact for help with the program. If you think your Pembroke Pines building is already late, send us the letter anyway.',
      },
    ],
    nextStep:
      'Send the letter with your BSIP permit number — a phone photo is enough — or, with no letter yet, the address and the year of the certificate of occupancy. We read what Pembroke Pines’ Building Department asks for and reply with a proposal for the complete BSIP inspection and report.',
  },
  {
    slug: 'miramar',
    program: 'broward-bsip',
    city: 'Miramar',
    place: 'Miramar',
    office: {
      name: 'City of Miramar Building, Planning & Zoning Department',
      address: ['2200 Civic Center Place', 'Miramar, FL 33025'],
      phone: '(954) 602-3200',
    },
    description:
      'Building Safety Inspection Program (BSIP) in Miramar: filing through the city’s permitting system, the forms, and one team that delivers it complete.',
    heroSub:
      'Miramar’s Building Division issues the BSIP package, and every document is filed through the city’s permitting system. Already late? One team still delivers the complete inspection and report.',
    lede:
      'Miramar’s package for the Building Safety Inspection Program (BSIP) carries the letterhead of the Building Division of the City of Miramar Building, Planning & Zoning Department. The program page sets one way to file, the city’s permitting system, and says the review is based solely on the sealed report.',
    local: [
      { k: 'The notice', v: 'Miramar’s program page says property owners will receive a Notice of Required Inspection; it does not say who sends it or how. If you no longer own the property, it says the Broward County Property Appraiser’s records will be checked and updated if a new owner is listed. If they still list you as owner, you must contact the appraiser directly.' },
      { k: 'Filing the report', v: 'All BSIP documents must be submitted through the City of Miramar permitting system, the program page says, under the permit type BSIP: Residential BSIP or Commercial BSIP. It gives that system no other name; the city’s permitting page calls its online service E-Permitting or Citizen Self Service (CSS Portal). For assistance, the program page gives a BSIP e-mail contact.' },
      { k: 'The city’s forms', v: 'Miramar’s applications and forms page publishes the program’s package, under a title that begins “Recertification / BSIP”. Its cover lists what is attached: information about the program, inspection guidelines, and the structural and electrical report forms. Those are the Broward County Board of Rules and Appeals’ forms; the package also holds the Broward County Uniform Building Permit Application.' },
      { k: 'What goes with it', v: 'Miramar’s program page lists the required documents — a BSIP Submittal Form, the Structural Report, the Electrical Report and supporting documentation, if applicable — and says the reports must be signed and sealed. The page’s FAQ words the list differently — a BSIP Submittal coversheet, a Structural Packet and an Electrical Packet — and adds that the forms must include original signatures.' },
      { k: 'After filing', v: 'No Building Code Inspector comes out, Miramar’s FAQ says: the review is based solely on the sealed report, and the FAQ gives an approximate time for it. Asked whether owners receive written certification, it answers that an accepted file is closed and no notice is issued; it also asks filers to include an e-mail address to receive an approved copy.' },
      { k: 'Repairs', v: 'If deficiencies are identified, Miramar’s page says a status letter must be provided and a final certification report is required after the repairs are completed. No inspector returns: the FAQ says a new sealed report must be submitted. Its list of what to submit asks that “No Repairs Required” be checked; the time allowed for repairs is in the rows above.' },
      { k: 'Repair permits', v: 'For a repair permit, Miramar’s FAQ asks for an application by a licensed and insured contractor, with the repair documentation and locations; structural calculations may be required. Whether a permit is required is a question it sends to your architect, engineer or contractor. The building need not be brought fully up to current code, it adds, though repair work may have to follow it.' },
      { k: 'If it is late', v: 'Miramar’s FAQ says extensions must be requested in writing. Without an extension, it says, code enforcement may begin and the building may be deemed unsafe. The program page names no hearing body; the cover of the city’s BSIP package says the Building Official shall enforce the program.' },
    ],
    faq: [
      {
        q: 'How do we file the BSIP report in Miramar?',
        a: 'Through the City of Miramar permitting system: the program page says all BSIP documents must be submitted there, as a Residential BSIP or a Commercial BSIP. The portal the city links to for permit applications opens with “Welcome to the City of Miramar’s Development HUB”. The program page links neither its submittal form nor its coversheet, so we confirm with the Building Division which document it expects.',
      },
      {
        q: 'How do we know whether our Miramar building falls under the BSIP?',
        a: 'To verify whether a property is included, Miramar’s page refers owners to Broward County’s BSIP property lists. Asked about a building that is not old enough, its FAQ says the Building Division will verify the age with the Broward County Property Appraiser’s Office. Interior demolition or renovation does not exempt a building, it says: only full building demolition qualifies. A building to be demolished within months still needs the inspections, it adds, particularly if still occupied.',
      },
      {
        q: 'Does Miramar send an inspector to our building for the BSIP?',
        a: 'No. Miramar’s FAQ says no Building Code Inspector comes out: the review is based solely on the sealed report. None returns after repairs either — a new sealed report must be submitted. The city also says it cannot recommend architects or engineers, because of conflict of interest.',
      },
      {
        q: 'What happens in Miramar if the BSIP report is late?',
        a: 'Miramar’s FAQ says extensions must be requested in writing and that, without one, code enforcement may begin and the building may be deemed unsafe. It does not say who receives the request or how long an extension lasts. If the date on the notice for your Miramar building has already passed, send it to us anyway: we confirm with the Building Division what it is asking for and by when.',
      },
      {
        q: 'Is the BSIP in Miramar the same as the 40-year recertification?',
        a: 'Yes. Miramar’s own documents use more than one name for it: on the forms page the title of the program’s package begins “Recertification / BSIP”, and the package’s cover still speaks of a “40-year inspection”, the program’s former name. One of the program page’s FAQ questions also prints a different number of days from the page’s own timeline; the ages and days in force are the county’s, in the rows above.',
      },
    ],
    nextStep:
      'Send the notice for your Miramar building — a phone photo is enough — or, with no letter yet, the address and the year of the certificate of occupancy. We read what Miramar’s Building Division asks for and reply with a proposal for the complete BSIP inspection and report.',
  },
  {
    slug: 'plantation',
    program: 'broward-bsip',
    city: 'Plantation',
    place: 'Plantation',
    office: {
      name: 'City of Plantation Department of Building Safety',
      address: ['401 NW 70 Terrace', 'Plantation, FL 33317'],
      phone: '(954) 797-2765',
    },
    description:
      'Building Safety Inspection Program (BSIP) in Plantation: the certified letter, the two-step online filing and what one team delivers, complete.',
    heroSub:
      'Plantation’s Department of Building Safety sends the program’s letter by certified mail and takes every document electronically. Already late? One team still delivers the complete BSIP inspection and report in Plantation.',
    lede:
      'In Plantation the Building Safety Inspection Program (BSIP) runs through the city’s Department of Building Safety. The department sends a certified letter that carries the assigned Record ID, and it takes every document electronically, through an account on its Accela Citizen Access portal.',
    local: [
      { k: 'The notice', v: 'The City of Plantation Department of Building Safety sends the letter by certified mail. It may be addressed to the property owner, the association, the management company or a duly authorized representative. It carries the assigned Record ID — the BDCERT number — and tells you what steps to take next. Keep it: the filing steps ask for that number.' },
      { k: 'Filing the report', v: 'All of the program’s required documentation is submitted electronically, and Plantation’s page sets two steps, both required. First, register for an online account on Accela Citizen Access (ACA). Then forward the e-mail that confirms the registration to the program contact the page names, ask to have the account connected to the applicable Recertification record, and include the BDCERT number.' },
      { k: 'The portal account', v: 'Accela Citizen Access manages the city’s records; its home page is titled “Plantation E-Permit Online Portal”. The program page says the request to connect the account is required to access and upload the required documents. The city’s Electronic Plan Review page, written for permits on the same portal, notes that document submission is not supported on mobile devices and that Chrome is the recommended browser.' },
      { k: 'The city’s forms', v: 'Plantation’s program page carries no form of its own. For the complete details and to obtain the required forms, it sends owners to Broward County’s website. So the package for a Plantation building goes on the forms obtained there.' },
      { k: 'What goes with it', v: 'Alongside the Safety Inspection Reports, the page names one more document: the Narrative. Both must be digitally signed and sealed “in order to be validated”, in the page’s words. It lists nothing else for the package; for the complete details it points to Broward County’s website, and the letter sets out the steps to take.' },
      { k: 'Digital signatures', v: 'The city’s Electronic Plan Review page, written for permits, says documents prepared by design professionals must be signed and sealed with a digital signature, that self-signed documents are not accepted and that all files are submitted as PDF files. The city’s Digital Signature Policy adds that modifying a document after it was digitally signed invalidates the signature. Neither one mentions the BSIP.' },
      { k: 'Repairs', v: 'Plantation’s program page says nothing about repairs and gives no time for them; the county’s deadlines are in the rows above. The city’s permit pages give the general rule: a permit is required before the repair of any building structure or part of one, and new applications are accepted in digital format only, through the same ACA portal.' },
      { k: 'After filing', v: 'Here Plantation’s page goes quiet. It does not say who reviews the reports, how the owner hears back, how an extension is requested or what follows a late report. For more information it gives the program a contact of its own — an e-mail address and a phone number that are not the department’s general assistance line.' },
    ],
    faq: [
      {
        q: 'Who sends the BSIP notice in Plantation?',
        a: 'The City of Plantation Department of Building Safety, by certified mail. In the page’s words, the letter goes out if and when the program affects your property, and it includes the assigned Record ID. Send us that letter — a phone photo is enough — and we confirm what Plantation’s department is asking for and by when.',
      },
      {
        q: 'How do we file the BSIP report in Plantation?',
        a: 'Electronically, and only after two steps the city requires. You register an account on Accela Citizen Access, the city’s portal, and forward the registration e-mail to the program contact, asking to have the account connected to the applicable Recertification record. The page says this is required in order to access and upload the documents. It mentions no paper or in-person alternative: all of it is to be submitted electronically.',
      },
      {
        q: 'Does Plantation have its own BSIP forms?',
        a: 'Not on its program page. For the required forms, and for the complete details, the page points owners to Broward County’s website. What Plantation’s page does state is how the documents are filed: the Narrative and the Safety Inspection Reports must be digitally signed and sealed. For a Plantation building, the complete BSIP inspection and report we deliver goes on those forms.',
      },
      {
        q: 'What happens in Plantation if the BSIP report is late?',
        a: 'Plantation’s program page does not say. It names no penalty and no hearing, and the time to file is the county’s, in the rows above. The letter itself sets out the steps to take, and the page gives a program contact at the Department of Building Safety for more information. If you have had your Plantation letter for some time, send it to us all the same.',
      },
      {
        q: 'Is Plantation’s recertification the same thing as the BSIP?',
        a: 'On the city’s own page they are one case under two names. Plantation presents the Broward County Building Safety Inspection Program, and the same page calls the record your account is connected to a “Recertification record”, with a BDCERT number. The page says the program was established by Broward County’s provisions of the Florida Building Code; the ages and deadlines in force are in the rows above.',
      },
    ],
    nextStep:
      'Send the certified letter from Plantation’s Department of Building Safety — a phone photo is enough — or, with no letter yet, the address and the year of the certificate of occupancy. We read what the department asks for and reply with a proposal for the complete BSIP inspection and report.',
  },
  {
    slug: 'sunrise',
    program: 'broward-bsip',
    city: 'Sunrise',
    place: 'Sunrise',
    office: {
      name: 'City of Sunrise Building Division',
      address: ['10770 W. Oakland Park Boulevard', 'Sunrise, FL 33351'],
      phone: '(954) 572-2354',
    },
    description:
      'BSIP in Sunrise: how the Building Division receives the reports, in person or on its Customer Self-Service Portal, and what one team delivers.',
    heroSub:
      'Sunrise’s Building Division takes the Building Safety Inspection Program reports in person or through its Customer Self-Service Portal. Already late? One team still delivers the complete inspection and report for the BSIP.',
    lede:
      'In Sunrise the Building Safety Inspection Program (BSIP) goes through the city’s Building Division, which receives the reports. Each year the Broward County Board of Rules and Appeals sends the city the list of buildings that are due, and Sunrise publishes a submittal checklist and an application of its own.',
    local: [
      { k: 'The notice', v: 'The city says the list of buildings due reaches Sunrise each year from the Broward County Board of Rules and Appeals, and that it rests on the construction year in the Broward County Property Appraiser’s records. Cases on the Special Magistrate’s agenda describe a formal notice issued by the Building Official, which sets the deadline.' },
      { k: 'Filing the report', v: 'The reports are submitted to the Building Division, in person or electronically through the city’s Customer Self-Service Portal, which asks for an account to be created first. Sunrise’s checklist asks for one application per building and, on the portal, a separate submission for each.' },
      { k: 'Paper or PDF', v: 'In person, Sunrise’s checklist asks for an original copy of each report with a seal and a wet signature. On the portal, each item of the checklist is a separate file in unprotected PDF and each report is digitally signed and sealed; a report the city’s Plans Examiners cannot digitally verify is not accepted.' },
      { k: 'The city’s forms', v: 'Sunrise has its own application for the program and asks that it be completely filled out, including the tracking number from the notification. The reports themselves go on the current Building Safety Inspection Report forms, which the city says can be downloaded from the county’s website. Document Central, on the city’s site, also lists a structural and an electrical BSIP inspection form.' },
      { k: 'What goes with it', v: 'Sunrise’s application lists two report forms for the package: the structural and the electrical. The checklist asks that each be completely filled out, with either “No Repairs Required” or “Repairs are Required” checked on its cover page. The application also has a Repairs Required Submittal box, which asks for the permit numbers of the repairs.' },
      { k: 'Repairs', v: 'When either report is marked “Repairs Required”, Sunrise’s plan reviewers decide whether permits are required, based on the repairs the report outlines. Once the permits are obtained and the repairs made, a new report marked “No Repairs Required” is submitted to the city. The city says that once it reviews and accepts that report, the building is in compliance with the program.' },
      { k: 'If it is late', v: 'Enforcement cases in Sunrise are heard before a Special Magistrate, and the hearing agenda has a block for the Building Safety Inspection Program under the Building Division. The properties listed there are described as having exceeded the deadline to comply with the program. The agendas also cite the requirement that the deficiencies found be repaired and re-inspected within a time counted from the report’s date.' },
      { k: 'Older names', v: 'Some older repair cases on one of the Special Magistrate’s agendas still call the report form “40 Year”, a name from the earlier schedule. The program is the one Sunrise now calls the Building Safety Inspection Program, and the ages and days in force are the county’s, in the rows above.' },
    ],
    faq: [
      {
        q: 'Who sends the BSIP notice in Sunrise?',
        a: 'Sunrise’s Building Official: the Special Magistrate’s agenda describes a formal notice issued by the Building Official, which sets the deadline. The list of buildings due reaches the city each year from the Broward County Board of Rules and Appeals. Keep the notification: the city’s application asks for its tracking number, and Sunrise only accepts reports for buildings that have been notified that a report is due.',
      },
      {
        q: 'How do we file the BSIP report in Sunrise?',
        a: 'With the Building Division, in person or electronically through the Customer Self-Service Portal after creating an account. Either way, each building has its own application. Sunrise’s checklist sets the format: originals with a seal and a wet signature in person; on the portal, separate unprotected PDF files, with each report digitally signed and sealed. The complete BSIP package we deliver goes on the forms Sunrise asks for.',
      },
      {
        q: 'What if our building in Sunrise should not be on the BSIP list?',
        a: 'The city’s questions and answers give a telephone number to call if you believe there has been an error. They explain that the list rests on the construction year in the Broward County Property Appraiser’s records, and they name what is exempt: one- and two-family dwellings, federal and State of Florida buildings, Broward County School Board schools, buildings under the floor area the city gives, and buildings on Indian Reservations.',
      },
      {
        q: 'What happens in Sunrise when the BSIP report says repairs are required?',
        a: 'The city’s plan reviewers decide whether permits are required, based on the repairs the report outlines. Once the permits are obtained and the repairs made, a new report marked “No Repairs Required” goes to the city; Sunrise’s application has a Repairs Required Submittal box that asks for the permit numbers. The city says the building is in compliance once it reviews and accepts that report.',
      },
      {
        q: 'What happens in Sunrise if the BSIP report is late?',
        a: 'Late-report cases appear on the agenda of Sunrise’s Special Magistrate: it has a block for the Building Safety Inspection Program under the Building Division, and it describes the properties there as having exceeded the deadline to comply. The same agenda states what the program requires of the owner: the Building Safety Inspection Certification Forms, submitted to the Building Official. For more on a hearing, the city refers people to the Clerk to the Special Magistrate.',
      },
    ],
    nextStep:
      'Send the notice from Sunrise’s Building Official — a phone photo is enough — or, with no notice yet, the address and the year of the certificate of occupancy. We confirm what the Building Division asks for and by when, and reply with a proposal for the complete BSIP inspection and report.',
  },
  {
    slug: 'davie',
    program: 'broward-bsip',
    city: 'Davie',
    place: 'Davie',
    office: {
      name: 'Town of Davie Building Division',
      address: ['8800 SW 36th Street, Building A', 'Davie, FL 33328'],
      phone: '(954) 797-1111',
    },
    description:
      'Building Safety Inspection Program (BSIP) in Davie: the Town’s notice, filing through OAS and Project Dox, and what one team delivers, complete.',
    heroSub:
      'The Town of Davie Building Division sends the BSIP notices and no longer accepts the reports on paper. Already late? One team still delivers the complete BSIP inspection and report for your building.',
    lede:
      'In Davie the Building Safety Inspection Program (BSIP) runs through the Town’s Building Division. The Building Official sends the notice by certified mail, and the Town no longer accepts paper copies: its application form goes in through the OAS system, and the reports are then uploaded to Project Dox.',
    local: [
      { k: 'The notice', v: 'The Building Official sends the Notice of Required Building Safety Inspection by certified mail, each year, to the owner on record and to the managing association of every property due for its inspection that year. The Town’s application form says the case number is found in that notice and that the application is not accepted without it — so keep the letter at hand.' },
      { k: 'Filing the report', v: 'Davie no longer accepts paper copies, its page says: every report must be digitally signed, sealed and submitted. Filing starts with the Town’s application, sent through OAS — Online Application Submittal, the system the Building Division’s page describes as the required method for permits and its other service requests. The reports go up later, in Project Dox.' },
      { k: 'The Project Dox upload', v: 'The upload does not come first. Staff review the application, and later in the Town’s steps an e-mail asks you to create a Project Dox account and upload the documents. Each item goes up separately: the application in the Permit application folder, the electrical report and the structural report each alone in its own folder, and the rest under Documents.' },
      { k: 'The Town’s forms', v: 'Davie’s program page lists the forms that must be completed at the time of submission: the Town’s own Building Safety Inspection Application Form, and the Building Safety Inspection forms, structural and electrical. It says the report must be on the Safety Inspection Report Form designated by the Broward County Board of Rules and Appeals.' },
      { k: 'What goes with it', v: 'Davie asks that each report come with color photos and a signed and sealed letter stating the property’s current condition — repairs or no repairs — and whether it is safe to occupy. The Documents folder takes the Electronic Signature Affidavit, which the page offers among its resources, along with the photos, the cover letter, sketches and drawings.' },
      { k: 'After filing', v: 'The Town reviews the reports; its program page does not say how the owner learns the result or how a correction is handled. For trouble with the upload it sends you to the Building Division’s phone line, and the Division’s Contact Us page lists a permit examiner whose title includes the BSIP.' },
      { k: 'Repairs', v: 'Davie’s page requires a building permit for any repair that comes out of the BSIP report. When repairs are needed it also asks for a signed and sealed letter, given to the owner and the Building Official, on whether the building may stay safely occupied meanwhile. That letter is valid for a limited time, and a new one is issued if the work goes on.' },
      { k: 'Who is exempt', v: 'The list of exempt buildings on Davie’s page includes federal and State of Florida buildings, buildings on sovereign tribal lands and — within limits the page spells out — houses, small multi-family dwellings and the buildings it calls minor structures. If you believe your building should be on the county’s list for inspection, the page sends you to the Broward County Building Code Services Division.' },
    ],
    faq: [
      {
        q: 'Who sends the BSIP notice in Davie, and how does it arrive?',
        a: 'Davie’s Building Official sends it, by certified mail, to the owner on record and to the managing association. The Town’s page gives the months of each year in which the notices go out. The letter carries the case number the Town’s application asks for, so a phone photo of it is enough: we read it and confirm what the Building Division is asking for and by when.',
      },
      {
        q: 'How do we file the BSIP report in Davie?',
        a: 'Not on paper — the Town’s page says it no longer accepts paper copies. The application goes in through OAS, the Town’s Online Application Submittal system. Once staff have reviewed it, and further along in the process, an e-mail invites you to create a Project Dox account and upload the reports and what goes with them, each item separately, in the folder the page assigns to it. The reports must be digitally signed and sealed.',
      },
      {
        q: 'Do BSIP repairs in Davie need a permit?',
        a: 'Yes. The Town’s program page says a building permit is required for any and all repairs related to the BSIP inspection report, and the Building Division’s page says building permits are requested through OAS. Once the repairs are complete, the program page asks for a re-inspection of the areas noted in the original report and an amended report, with a signed and sealed letter stating that the required repairs and corrections are done.',
      },
      {
        q: 'What happens in Davie if the BSIP report is late, and can we ask for more time?',
        a: 'Davie’s program page answers neither question. It counts the time to file from the date of the notice, but it describes no way to ask for more time and says nothing about a late report. The time itself is the county’s, in the rows above. If your date is close or already past, send us the notice now, so we can confirm with the Building Division what it is asking for and by when.',
      },
      {
        q: 'Is Davie’s BSIP the same as the 40-year inspection?',
        a: 'Yes. A Town newsletter announcing the Building Division’s notices described the BSIP as the new name of the program formerly known by its 40-year label. The Town’s program page still links an FAQ with the 40-year name in its title. It is one program, and the ages in force today are in the rows above.',
      },
    ],
    nextStep:
      'Send the notice from the Town of Davie Building Division — a phone photo is enough — or, with no notice yet, the address and the year of the certificate of occupancy. We read what Davie is asking for and reply with a proposal for the complete BSIP inspection and report.',
  },
  {
    slug: 'cooper-city',
    program: 'broward-bsip',
    city: 'Cooper City',
    place: 'Cooper City',
    office: {
      name: 'City of Cooper City Building Division',
      address: ['9090 SW 50 Place', 'Cooper City, FL 33328'],
      phone: '(954) 434-4300',
    },
    description:
      'Cooper City and Broward’s BSIP: the Building Division’s own inspection form, what it records at review, and one team’s complete inspection package.',
    heroSub:
      'Cooper City’s Building Division keeps a Building Safety Inspection Program form of its own among its permitting forms. Already late? One team still delivers the full BSIP inspection package for your building.',
    lede:
      'In Cooper City the program belongs to the Building Division, part of the Community Development Department. The city’s website has no page given over to the BSIP; what it publishes is a one-page form for the program, filed with the division’s applications and submittal forms.',
    local: [
      { k: 'The city’s form', v: 'The division’s list of applications and submittal forms includes one titled Commercial Building Safety Inspection Program. The form itself, headed by the Community Development Department and its Building Division, opens with a project number, the site address, the property or building name and the folio number.' },
      { k: 'The building’s cycle', v: 'Next to the actual year built, Cooper City’s form leaves a blank for each due year of the building’s inspections, so the whole cycle sits on one sheet. The ages and the interval behind those years are Broward’s, in the rows above.' },
      { k: 'Two professionals named', v: 'The form names a structural engineer or architect and an electrical engineer or architect on separate lines, each with a license number, an e-mail and a phone, and adds a contact person for the building with a phone and an e-mail of their own.' },
      { k: 'The city’s review', v: 'The office section shows how the division reviews a filing: the structural and the electrical reports are each reviewed and dated by name, and the reviewer marks whether a structural repair permit, an electrical repair permit or a second structural or electrical report is required, with room for comments.' },
      { k: 'Permits and the portal', v: 'Repair permits go through the division’s permitting, which its page says is now handled in Accela Citizen Access, from applications and plan review to inspections and document uploads. The page does not say whether the BSIP reports themselves are uploaded there, so we confirm the route with the Building Division first.' },
    ],
    faq: [
      {
        q: 'Does Cooper City have a web page for the BSIP?',
        a: 'Not one we found on the city’s site. The Building Division’s page covers permits, inspections and forms, and the program appears in the division’s list of forms as the Commercial Building Safety Inspection Program form. For questions, the division’s page gives its phone line and an e-mail address.',
      },
      {
        q: 'What does the Cooper City form ask us to fill in?',
        a: 'The building’s identity — project number, site address, name and folio number — its actual year built and due years, a contact person, and the structural and the electrical engineer or architect with their license numbers. The lower part is for the Building Division’s own use and stays blank.',
      },
      {
        q: 'What happens after the Cooper City Building Division reviews the reports?',
        a: 'The form records the outcome in three questions: whether a structural repair permit is required, whether an electrical repair permit is required, and whether a second structural or electrical report is required. The time for repairs is Broward’s, in the row “If repairs are needed”; the form does not restate it.',
      },
      {
        q: 'How do we get BSIP repair permits in Cooper City?',
        a: 'Through the city’s Accela Citizen Access portal, which the Building Division’s page says now handles permitting, inspections and plan review; first-time users create an account. For a permit opened before the switch, the page asks the holder to create an account and then call or write to the division to have the permit connected to it.',
      },
    ],
    nextStep:
      'Send the notice Cooper City’s Building Division sent you — a picture of it is all we need — or, with none in hand, the address and the year construction ended. We ask the division what it needs and propose the complete BSIP inspection package in reply.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'coral-springs',
    program: 'broward-bsip',
    city: 'Coral Springs',
    place: 'Coral Springs',
    office: {
      name: 'City of Coral Springs Building Department',
      address: ['9500 West Sample Road', 'Coral Springs, FL 33065'],
      phone: '(954) 344-1025',
    },
    description:
      'BSIP in Coral Springs: the city’s required submittal form, one PDF per document in eTRAKiT, the Board’s report forms and one team for all of it.',
    heroSub:
      'Coral Springs runs Broward’s BSIP through its Building Department, which takes the reports online in eTRAKiT under a submittal form of its own. Already late? One team still prepares the complete inspection package for your building.',
    lede:
      'In Coral Springs the Building Safety Inspection Program is handled by the City of Coral Springs Building Department. Its page sends readers to the Board of Rules and Appeals’ policy for the detailed rules, and keeps the filing in the city’s hands: a required Coral Springs submittal form, the county’s structural and electrical report forms, and an upload through eTRAKiT.',
    local: [
      { k: 'The program page', v: 'The Building Department’s page says the program took effect in Broward County long before its requirements were changed, and that it now calls for structural and electrical safety inspections once a building reaches the county’s first age, then again at a fixed interval. For the details it points to the Board of Rules and Appeals’ policy, which the city also posts while the Board’s own website is down.' },
      { k: 'The notice', v: 'The city’s submittal form refers to the owner’s Notice of Required Building Safety Inspection by name, so keep that letter with the file. Coral Springs’ pages do not say how or when the letter is delivered; if a neighbour’s building got one and yours did not, the Building Department is the office to ask.' },
      { k: 'Filing the report', v: 'Coral Springs takes BSIP reports electronically, in eTRAKiT, its online permitting system. The city’s step-by-step page has the filer log in to a public or contractor account, enter the project number and select the project, then attach the documents with the paper-clip icon. It also says payment comes first, before anything is uploaded.' },
      { k: 'Separate PDF files', v: 'Every piece goes up on its own. The city’s instructions say the reports and the submittal form must be separate PDF files, each named as the page lists them: Submittal Form, Structural Inspection Report, Electrical Inspection Report and Inspection Photos.' },
      { k: 'The city’s submittal form', v: 'The Building Department marks its Building Safety Inspection Program Submittal Form as required. It asks for the project number, the job address, present use, subdivision, lot, block, zoning and square footage, and for up to two engineers or architects with their license numbers, a phone and an e-mail address being mandatory for each. It must be filled in with black or blue ink, or typed.' },
      { k: 'Three kinds of submittal', v: 'The form is marked as one of three submittals: the initial required inspection, the inspection after repairs, or a recheck. For a recheck it asks for the permit numbers of the repairs, so the repair permits and the new report reach the city together.' },
      { k: 'The county’s report forms', v: 'Behind the city’s cover sheet, the package carries the Broward County Building Safety Inspection Report Forms, structural and electrical. Because the Board of Rules and Appeals’ website is unavailable, Coral Springs posts copies of those forms, the Board’s policy and its general guidelines on a page of its own.' },
      { k: 'When repairs stay open', v: 'Coral Springs’ Special Magistrate dockets list code cases headed Building Safety Inspection Program Repairs, brought in the name of the Chief Building Official. That is where the city takes buildings whose repairs remain open; the dockets do not describe what comes before a case is filed.' },
    ],
    faq: [
      {
        q: 'Where does a Coral Springs BSIP report get uploaded?',
        a: 'In eTRAKiT, the city’s online permitting system, under the building’s project. It starts with an account: citizens register under the Public Login section, and a contractor who has already done business with the Building Department activates the account it has on file. Once logged in, the filer finds the project by its number and attaches each document as a PDF of its own.',
      },
      {
        q: 'Does Coral Springs want its own form on top of the county’s report forms?',
        a: 'Yes. The Building Department lists the City of Coral Springs Submittal Form as required, and its upload instructions name it first among the attachments. The county’s structural and electrical report forms go behind it. The complete BSIP inspection package we deliver is assembled on both, the city’s cover sheet and the Board’s forms.',
      },
      {
        q: 'How do we find our building’s BSIP project in Coral Springs?',
        a: 'The Building Department’s page links a BSIP Project Search to eTRAKiT’s records search, and the city’s account page notes that most eTRAKiT searches need no login; paying, applying or scheduling does. The upload steps start from the project number, so if it cannot be found, the Building Department’s permitting line is where to ask.',
      },
      {
        q: 'What does Coral Springs do when BSIP repairs are not finished?',
        a: 'Its Special Magistrate dockets show it: code cases titled Building Safety Inspection Program Repairs, presented by the Chief Building Official. The time Broward gives for repairs is in the row “If repairs are needed”. If repairs on your building are still open, send us the report and whatever the city has sent, and we read where the file stands.',
      },
      {
        q: 'Does Coral Springs hold workshops on the BSIP?',
        a: 'Its Building Department’s page invites readers to register for its Permitting & Building Safety Inspection Program Workshops, through a sign-up form linked there, and to subscribe to the department’s updates. The page prints no schedule, so registering is the way to hear about the next session.',
      },
    ],
    nextStep:
      'Send us the Coral Springs notice — any clear picture of the letter works — or, if none has come, where the building stands and roughly when it went up. We look the building up in the city’s BSIP project search and send back a proposal covering the whole inspection package.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'dania-beach',
    program: 'broward-bsip',
    city: 'Dania Beach',
    place: 'Dania Beach',
    office: {
      name: 'City of Dania Beach Building Division',
      phone: '(954) 924-6805',
    },
    description:
      'Dania Beach’s Building Safety Inspection Program (BSIP): the city’s notice, its submittal form, how the review works, and one team for the full package.',
    heroSub:
      'Dania Beach’s Building Official issues the Notice of Required Inspection, and the city’s Building Division reviews whatever reports come back. Already late? A single team still handles the whole BSIP inspection package, on the city’s submittal form.',
    lede:
      'Dania Beach runs Broward’s Building Safety Inspection Program through the Building Division of its Community Development department. The city’s page says the program follows the Florida Building Code and the Board of Rules and Appeals’ guidelines, and adds a note of its own: where the Board’s policy and a state Senate bill differ, the Board’s policy takes precedence. A submittal form and a sheet of questions and answers fill in how the review works.',
    local: [
      { k: 'The notice', v: 'Dania Beach’s page says the Building Official notifies the building owner or the association with a Notice of Required Inspection, and that the building’s age is counted from when its certificate of occupancy was issued. The notice tells the owner that a structural and an electrical inspection must be carried out.' },
      { k: 'Submitting to the city', v: 'The reports go back to the city: Dania Beach’s question sheet says the documents are submitted to the City’s Building Official, and each building needs its own package — the completed submittal form with the structural and electrical report forms. The city’s pages name no upload portal for it, so we confirm the delivery with the Building Division before filing.' },
      { k: 'The submittal form', v: 'The city’s Building Safety Inspection Program Submittal Form asks for the property owner, the job address and its present use, and one engineer or architect with a registration number. It is checked either as an initial building safety inspection or as a re-inspection in a later cycle.' },
      { k: 'What the reports carry', v: 'The city’s sheet asks for report forms that are properly sealed and bear an original signature, and for one of two boxes to be checked on them: Repairs Required or No Repairs Required. That box decides what the Building Official writes on the submittal form afterwards.' },
      { k: 'How the review works', v: 'Nobody from the city comes out to look. Dania Beach’s sheet says its review rests entirely on the architect’s or engineer’s report, and gives an approximate time for it. For the same reason the city hands out no names of professionals: it reviews their reports, and calls a referral list a conflict of interest.' },
      { k: 'After the review', v: 'If the reports find the building safe, Dania Beach’s page says the owner can request a certificate of completion for the program. The Building Official’s section of the submittal form records the outcome: report complete with no repairs, or repairs required, with or without permits.' },
      { k: 'Repairs', v: 'Repairs that come out of the report are permitted work: the city’s sheet says a licensed and insured contractor of the right trade completes the permit application, with documents showing the scope and the location of the repairs. No city inspector re-checks the BSIP items afterwards; an updated report closes them, and city inspections follow only an active permit.' },
      { k: 'Who is exempt', v: 'Dania Beach’s page lists as exempt one- and two-family dwellings below a size it gives, U.S. government and State of Florida buildings, Broward County School Board schools and buildings on Indian reservations. Its sheet adds that gutting and rebuilding the inside does not take a building out of the program; only full demolition and a new structure does.' },
    ],
    faq: [
      {
        q: 'Our Dania Beach building was gutted and renovated inside — is it still in the BSIP?',
        a: 'Yes, by the city’s own answer. Dania Beach’s sheet says a complete interior demolition or renovation does not exempt a property, because the inspection covers the electrical and structural exterior of the whole building. It is waived only where the entire building was torn down and a new structure built.',
      },
      {
        q: 'What if Dania Beach has the wrong owner or the wrong age for our building?',
        a: 'The city works from the Broward County Property Appraiser’s records. Its sheet says a new owner is verified there and the city’s database changed, while an owner the Appraiser still lists must have that record corrected directly. If you believe the building is younger than the age in the row “First due”, the city asks you to contact its Building Department, which researches the age with the same office.',
      },
      {
        q: 'Must a Dania Beach building be brought up to today’s code for the BSIP?',
        a: 'No, says the city: the program is a safety inspection of the current condition of the structural and electrical systems. Repairs, where the report calls for them, must meet the current code. Emergency lights and fire alarms are left to the annual inspection of the building by the City of Dania Beach Fire Department.',
      },
      {
        q: 'We plan to demolish our Dania Beach building — does it still need the inspection?',
        a: 'Dania Beach’s answer is yes, especially while the building is occupied or in use. An exception has to be asked for in writing, addressed to the Building Official. Until the city answers such a request, plan around the date on the notice; the time Broward allows is in the row “Time to file”.',
      },
      {
        q: 'How long do we have to file the BSIP reports in Dania Beach?',
        a: 'Dania Beach’s page still prints an older, shorter time to file. The time in force is Broward’s, in the row “Time to file”, and the notice states its own date — read that one first. Repairs run on the time in “If repairs are needed”, and the city’s form expects an updated report once they are complete.',
      },
    ],
    nextStep:
      'Send the Notice of Required Inspection from Dania Beach’s Building Official — a clear photo of it is plenty — or, without one, the street address and the certificate of occupancy’s year. We check with the Building Division what it expects and when, then send a proposal that covers the whole package.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'hillsboro-beach',
    program: 'broward-bsip',
    city: 'Hillsboro Beach',
    place: 'Hillsboro Beach',
    office: {
      name: 'Town of Hillsboro Beach Building Department',
      address: ['1210 Hillsboro Mile', 'Hillsboro Beach, FL 33062'],
      phone: '(954) 427-4011',
    },
    description:
      'Hillsboro Beach and Broward’s BSIP: the town’s building safety program, its public log of reports, how to get copies, and one team’s complete package.',
    heroSub:
      'The Town of Hillsboro Beach Building Department keeps a published log of every building’s safety reports. Already late? One team still prepares the full BSIP inspection package for your building.',
    lede:
      'In Hillsboro Beach the program runs through the Town of Hillsboro Beach Building Department, which the town says is powered by Calvin, Giordano & Associates. The town’s page on the program explains the change from the older schedule, links Broward County’s program page and publishes a log of the reports submitted for each building.',
    local: [
      { k: 'The town’s program page', v: 'The town’s page names it a building safety program for buildings at the county’s first age or older, and explains that the Board of Rules and Appeals revised what was formerly known as the 40-Year Inspection Program to match state law, moving the first inspection earlier. For the rest of the rules it sends readers to Broward County’s program page.' },
      { k: 'A town ordinance', v: 'The program is also written into the town’s own code. A public notice on the town’s site announced the second reading of an ordinance creating a section titled Building Safety Inspection Program, in the chapter of the code of ordinances on buildings and building regulations.' },
      { k: 'The log of reports', v: 'Hillsboro Beach publishes a list of the buildings in the program — the town calls it its log report list — with each building’s name and address, the year built, the year due, a status and notes. The notes follow each file: reports submitted or approved, repair permits applied for, letters received from engineers.' },
      { k: 'Searching past reports', v: 'To search the reports already submitted to the town, Hillsboro Beach’s page points to its Forerunner floodplain information website, the same place the town uses for its flood information.' },
      { k: 'Copies of a report', v: 'A copy of the safety report on any building in Hillsboro Beach is requested from the Town Clerk through a public records request. The town’s request form adds that such a request does not have to be in writing, though it asks requesters to consider using the form, which goes by fax or to the town’s mailing address.' },
      { k: 'Questions on the program', v: 'The town’s program page names two contacts for questions: the Building Official and the Permit Administrator. The Building Department’s page also lists a general voicemail and an e-mail address for inspections and general questions, and a separate line for permitting.' },
      { k: 'Repairs and permits', v: 'The log’s notes show repairs moving through permits — concrete restoration and electrical work applied for, issued and finaled. The Building Department’s page sends permit holders to Community Core, its permitting portal, to schedule inspections, view plan review comments and check inspection results, behind a login.' },
    ],
    faq: [
      {
        q: 'Can we see our building’s past safety reports in Hillsboro Beach?',
        a: 'Yes, two ways. The town’s page points to its Forerunner floodplain information website to search the reports submitted to the town, and for a copy of a safety report it asks for a public records request to the Town Clerk. The town’s log report list also shows where each building stands.',
      },
      {
        q: 'Why does the Hillsboro Beach list still use the 40-year label?',
        a: 'Because the list kept the program’s former name: one of its columns is still headed with the 40-year label. The town’s program page explains that the Board of Rules and Appeals revised that program, and the first inspection now comes at the age in the row “First due”.',
      },
      {
        q: 'Does Hillsboro Beach have its own form for the BSIP?',
        a: 'The town’s pages show none. Its building applications and forms page lists no BSIP form, and its program page sends owners to Broward County’s page for the program. We confirm with the Building Department which forms it expects before the complete inspection package is filed.',
      },
      {
        q: 'What happens in Hillsboro Beach while repairs are still open?',
        a: 'The town’s log shows how it follows them: notes on repair permits applied for or issued, follow-up messages to engineers, and engineers’ letters stating there are no life safety issues while repairs go on. Broward’s repair time is the row “If repairs are needed”; past it, the Building Official is the one to ask.',
      },
      {
        q: 'Who runs the Hillsboro Beach Building Department?',
        a: 'The town’s page says the Town of Hillsboro Beach Building Department is powered by Calvin, Giordano & Associates, Inc. Its Building Official and its Permit Administrator are the contacts the program page names for questions about the building safety program.',
      },
    ],
    nextStep:
      'Send the notice from the Town of Hillsboro Beach Building Department — a photo works — or, if none has reached you, the address and when the building went up. We find the building on the town’s log and write back with a proposal for the full BSIP package.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'lauderdale-lakes',
    program: 'broward-bsip',
    city: 'Lauderdale Lakes',
    place: 'Lauderdale Lakes',
    office: {
      name: 'City of Lauderdale Lakes Building Division',
      address: ['3521 NW 43rd Avenue', 'Lauderdale Lakes, FL 33319'],
      phone: '(954) 535-2480',
    },
    description:
      'Lauderdale Lakes and the BSIP: the certified letter, the city’s program packet, engineer registration, and the complete package prepared by one team.',
    heroSub:
      'Lauderdale Lakes sends a certified letter when the BSIP reaches a building, and asks the engineer or architect filing the report to register with the city first. Already late? One team still assembles the complete inspection package.',
    lede:
      'In Lauderdale Lakes the Building Safety Inspection Program sits with the Building Division of the Development Services Department. The city gathers what owners need in one Building Safety Program Packet: a yearly calendar, a summary, its own application, a registration form for engineers and architects, and the county’s policy and report forms.',
    local: [
      { k: 'The certified letter', v: 'The city’s summary says an owner whose property the program affects receives a certified letter explaining what to do. The packet’s yearly calendar puts the notices in summer: the Board of Rules and Appeals passes each city building data from the Property Appraiser, and the Building Officials notify the owners due in the coming calendar year.' },
      { k: 'Engineer registration', v: 'Before an engineer or architect can submit a report in Lauderdale Lakes, the packet says they must register with the city, sending a copy of their current state license with a notarized application. Faxed copies are not accepted, only originals, and the registration is renewed every year before the city’s new fiscal year begins.' },
      { k: 'The city’s application', v: 'The Building Safety Inspection Application in the packet asks for the site name, address, legal description and subdivision, the owner’s contact details, and the engineer’s or architect’s state number and Certificate of Competency number. It is notarized, and its office section records a pass or a fail for each report, structural and electrical, on its own line.' },
      { k: 'Forms with the filing', v: 'The packet’s summary lists the forms to complete at submittal: the Building Safety Inspection Submittal Form and the Building Safety Inspection Forms, structural and electrical. The county’s two report forms are printed in the packet itself, after the Board of Rules and Appeals’ policy.' },
      { k: 'Where to send it', v: 'The packet describes no upload or portal for the reports. Every page carries the Building Division’s street address and its permits mailbox, and the summary tells owners to write to that mailbox or call the division with questions — so we confirm with the division how it wants the package delivered.' },
      { k: 'Permits for repairs', v: 'The application warns that a separate building permit is needed if the Building Official deems it necessary after reading the report, and that a licensed and insured contractor must obtain it. The city’s summary counts the repair period from the date of the report; the period itself is the county’s, shown higher on this page.' },
      { k: 'Milestone inspections', v: 'The packet adds a note for buildings that also owe the state’s milestone inspection: in Lauderdale Lakes, the building safety inspection counts as compliance with both of its phases. Associations do not need a second, separate report for the state.' },
      { k: 'Who is exempt', v: 'The city’s summary exempts U.S. Government and State of Florida buildings, buildings on Indian reservations, Broward County School Board schools, one- and two-family dwellings, certain townhouses as the Florida Building Code defines them, and minor structures below the floor area it states.' },
    ],
    faq: [
      {
        q: 'Our engineer is not registered in Lauderdale Lakes — can the report still be filed?',
        a: 'Not under the city’s packet. It says an engineer or architect must register with the City of Lauderdale Lakes in order to submit a Building Safety Inspection Report, and the registration form needs a notarized signature and original documents. The registration lapses with the city’s fiscal year, so it is worth checking before the report is finished.',
      },
      {
        q: 'What does the Lauderdale Lakes certified letter mean for our building?',
        a: 'That the city’s Building Official has the building on that year’s list. The summary says the letter carries information about what you need to do, and the packet’s calendar shows the lists reaching the city from the Board of Rules and Appeals, built from Property Appraiser data. With the letter in hand, we can tell you what Lauderdale Lakes expects of your building and how much time is left.',
      },
      {
        q: 'Why does the Lauderdale Lakes packet show a different time to file?',
        a: 'The packet’s calendar prints a period to return the reports that is shorter than the one now in force. The period that applies is Broward’s — see “Time to file” — while repairs follow “If repairs are needed”. Work from the date on your certified letter.',
      },
      {
        q: 'Does the Lauderdale Lakes city code still call it the 40-year inspection?',
        a: 'Its code enforcement does. Lauderdale Lakes’ Special Magistrate dockets cite a section of the city code that has owners conduct a 40-year structural and electrical safety inspection — the program’s former name — while the Building Division’s packet calls it the Building Safety Inspection Program. It is one program either way, with the ages shown in the row “First due”.',
      },
      {
        q: 'What happens in Lauderdale Lakes if the BSIP is ignored?',
        a: 'Cases go before the city’s Special Magistrate. A docket on the city’s site lists a first-time hearing on a property cited under the city code’s safety-inspection section. The packet does not describe the steps before a hearing. A building already past its date should not wait: the letter, and anything else the city has mailed, is what we need to see first.',
      },
    ],
    nextStep:
      'Send the certified letter from Lauderdale Lakes — a photo is enough for us to start — or, if nothing has arrived, the street address and when the building was finished. We check what the Building Division wants, the engineer registration included, and answer with a proposal for every part of the BSIP package.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'lauderhill',
    program: 'broward-bsip',
    city: 'Lauderhill',
    place: 'Lauderhill',
    office: {
      name: 'City of Lauderhill Building Division',
      address: ['Ken Thurston Inverrary Community Center', '3300 Inverrary Blvd.', 'Lauderhill, FL 33319'],
      phone: '(954) 730-3060',
    },
    description:
      'Building Safety Inspection Program (BSIP) in Lauderhill: the city’s inspection packet, what the filing holds, where it goes, and one team for all of it.',
    heroSub:
      'Lauderhill’s Building Division keeps an inspection packet that lists what a BSIP filing contains. Already late? One team still delivers the complete BSIP inspection and report, structural and electrical, for your building.',
    lede:
      'In Lauderhill the Building Safety Inspection Program (BSIP) runs through the City of Lauderhill Building Division, part of the Development Services Department. Among the city’s building forms is an inspection packet that opens with Lauderhill’s own instructions and then reprints the county’s program pages; a newer sheet tells condominium associations what to expect.',
    local: [
      { k: 'Why the city enforces it', v: 'The first page of Lauderhill’s packet says the inspection is mandated by the Broward County Administrative Code and the county’s Board of Rules and Appeals, and that the Lauderhill Building Department is required to enforce the County Code. The pages after it reproduce the county’s program summary and the Board’s policy.' },
      { k: 'The notice', v: 'Lauderhill’s packet describes a yearly sequence. The Board of Rules and Appeals draws a list of the buildings that meet the program’s requirements from the Property Appraiser’s records and provides it to the Building Officials; the city building department then administers the program, and a notification letter is sent.' },
      { k: 'What the filing holds', v: 'The packet’s instructions list three pieces: the Broward County program application, which the packet says also serves the later inspections, a written report on the structural elements of the property, and a written report on its electrical elements. Each report is by a Florida-registered architect or professional engineer.' },
      { k: 'Where it goes', v: 'Lauderhill’s packet says the application may be submitted at the City of Lauderhill Business Center, on West Oakland Park Boulevard, and it names no portal. The Development Services contact page places the department, with its Building Division, at the Ken Thurston Inverrary Community Center behind City Hall, so we confirm with the Building Division where the filing goes today.' },
      { k: 'The review', v: 'According to the packet, the Building Department reviews the reports to verify that the inspecting professional has found the structural and electrical systems safe. Where a deficiency is noted, the department follows the Board of Rules and Appeals’ policy, a copy of which the packet attaches.' },
      { k: 'Repairs', v: 'Under the policy reprinted in Lauderhill’s packet, deficiencies that threaten life safety come first. The professional then re-inspects the areas noted in the original report and gives the owner a signed and sealed letter that the corrections are complete, and the owner submits it to the Building Official. Incidental, non-life-threatening repairs follow a time frame the professional specifies and the Building Official approves.' },
      { k: 'If it is not filed', v: 'The same policy says that when an owner fails to submit the report, the governing authority holds a hearing on it before either a Special Magistrate or a Code Enforcement Board. A building whose required repairs are not made may be deemed unsafe and unfit for occupation, and the matter can go on to the Unsafe Structures Board.' },
      { k: 'An older packet', v: 'Lauderhill’s packet still calls the program by its former 40-year name, and its county pages carry an earlier edition of the policy with the deadlines of that time. The ages and days in force are the county’s current ones, in the rows above; where the packet and your notice differ, ask the Building Division before filing.' },
    ],
    faq: [
      {
        q: 'Who sends the BSIP notice in Lauderhill?',
        a: 'Lauderhill’s packet describes a notification letter that follows the yearly list of buildings the Board of Rules and Appeals provides to the Building Officials; from there the city building department administers the program. Keep that letter. A photo of it from your phone lets us read what Lauderhill wants and by when.',
      },
      {
        q: 'How do we file the BSIP report in Lauderhill?',
        a: 'With the Broward County program application and the two written reports, structural and electrical, by a Florida-registered architect or professional engineer — the pieces the city’s packet lists. The packet names the City of Lauderhill Business Center as the place to submit; because the department’s contact page lists another address, we check with the Building Division before anything goes in. The complete BSIP inspection and report we deliver follows that list.',
      },
      {
        q: 'Is Lauderhill’s inspection packet the same program as the BSIP?',
        a: 'Yes. The packet is titled with the program’s former 40-year name and a later anniversary besides, and its instructions say a single county application serves both. It is one Broward program; the ages in force are the ones in “First due” and “Then”, not those in the packet’s older pages.',
      },
      {
        q: 'What happens in Lauderhill if the BSIP report is not filed?',
        a: 'The policy page in Lauderhill’s packet says the governing authority holds a hearing on the failure, before a Special Magistrate or a Code Enforcement Board. A building left without its required repairs may be found unsafe and unfit for occupation. If the date on your Lauderhill letter is near or already past, send it to us now.',
      },
      {
        q: 'What does Lauderhill tell condominium associations about milestone inspections?',
        a: 'A Building Division sheet on the new condominium and community association requirements says architects and engineers bidding on milestone inspections must disclose in writing whether they intend to bid on the related repairs. It adds that city ordinances will be amended to include inspection and enforcement language, and that condominium milestone reports must be submitted to the City each year.',
      },
    ],
    nextStep:
      'Send the notification letter from Lauderhill — a phone photo will do — or, without one, the address and the year of the certificate of occupancy. We set it against the city’s packet and the county’s current rules, then send a proposal for the complete BSIP inspection and report.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'lighthouse-point',
    program: 'broward-bsip',
    city: 'Lighthouse Point',
    place: 'Lighthouse Point',
    office: {
      name: 'Lighthouse Point Building Department',
      address: ['3701 NE 22 Avenue', 'Lighthouse Point, FL 33064'],
      phone: '(954) 943-6509',
    },
    description:
      'Building Safety Inspection Program (BSIP) in Lighthouse Point: which buildings it reaches, the city’s warning about firms’ notices, and one team.',
    heroSub:
      'Lighthouse Point’s Building Department takes questions on Broward’s Building Safety Inspection, and the city warns that firms are sending out notices of their own. Already late? One team still delivers the complete BSIP inspection and report.',
    lede:
      'In Lighthouse Point the Building Safety Inspection Program (BSIP) is Broward County’s requirement, and the city’s Building & Zoning page sends every question about it to the Lighthouse Point Building Department. The page is brief: it says which buildings are exempt and cautions owners about notices from private firms.',
    local: [
      { k: 'Whose requirement it is', v: 'Lighthouse Point’s page presents the inspection as a Broward County requirement, under a heading that says so, and applies it to buildings past the county’s age and above a floor area the page gives. The age itself is printed in “First due”, higher on this page.' },
      { k: 'Who is exempt', v: 'Single-family homes, duplexes and every building below that floor area are exempt, Lighthouse Point’s page says, and it tells those owners plainly that they are not required to have the inspection. For any other building, the age and the size together decide whether the program reaches it.' },
      { k: 'Notices from private firms', v: 'The city says it is aware that engineering and architectural firms are sending out notices about the Building Safety Inspection requirements. Lighthouse Point reminds owners who get one that their property may not be subject to the requirement at all, and states that it endorses none of the firms sending them.' },
      { k: 'Questions and permits', v: 'Questions about the inspection go to the Lighthouse Point Building Department, the page says. The department accepts new permit applications online, through its Building Department Public Portal, and in person; the page does not say how the inspection reports themselves are filed, so we ask the department before anything is submitted.' },
    ],
    faq: [
      {
        q: 'A firm sent us a Building Safety Inspection notice — does it apply to our Lighthouse Point building?',
        a: 'Not necessarily. Lighthouse Point’s page says engineering and architectural firms are sending notices about the requirement, that a property receiving one may not be subject to it, and that the city endorses none of those firms. If you are unsure what you have, send it to us with the address, or ask the Building Department, where the page directs every question on the inspection.',
      },
      {
        q: 'Which buildings in Lighthouse Point need the Building Safety Inspection?',
        a: 'Those past the county’s age and above the floor area the city’s page gives; the age is the one in “First due”. Single-family homes, duplexes and smaller buildings are exempt, the page says, so the owner of a house in Lighthouse Point does not need this inspection.',
      },
      {
        q: 'How do we file the BSIP report in Lighthouse Point?',
        a: 'The city’s page does not say. It sends questions about the inspection to the Lighthouse Point Building Department, and it says the department accepts permit applications online and in person, with a public portal that also shows application statuses and inspection results. We confirm with the department how it wants the reports before the complete BSIP package goes in.',
      },
      {
        q: 'Is the Lighthouse Point inspection the same as the 40-year recertification?',
        a: 'Yes. A building permit schedule the city posts still lists it under its former name, the 40-year inspection program required by Broward County, while the Building & Zoning page calls it the Building Safety Inspection. It is one county program, and the ages in force are those in “First due” and “Then”.',
      },
    ],
    nextStep:
      'Send the notice you received in Lighthouse Point — from the city or from a firm, a phone photo is enough — or the address and the year the building was completed. We tell you whether the county program reaches it and, if it does, propose the complete BSIP inspection and report.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'margate',
    program: 'broward-bsip',
    city: 'Margate',
    place: 'Margate',
    office: {
      name: 'City of Margate Building Department',
      address: ['901 NW 66th Avenue', 'Margate, FL 33063'],
      phone: '(954) 970-3004',
    },
    description:
      'Building Safety Inspection Program (BSIP) in Margate: the certified letter, ProjectDox uploads, why reports fail and the city’s incidental repair form.',
    heroSub:
      'Margate’s Building Department tells affected owners by certified letter and takes the engineers’ reports through ProjectDox. Already late? One team still delivers the complete BSIP inspection and report, structural and electrical.',
    lede:
      'In Margate the Building Safety Inspection Program (BSIP) is handled by the City of Margate Building Department, which reviews each report it receives. The city’s program page explains the letter and the review and links the ProjectDox upload, and it hosts two documents of Margate’s own: a question sheet on failed reports and an agreement for incidental repairs.',
    local: [
      { k: 'The notice', v: 'Margate’s program page says that an owner whose property the program affects will receive a certified letter with information about what has to be done. The page names no other way the city announces that a building is due, so the letter is the document to keep at hand.' },
      { k: 'Filing the report', v: 'The reports reach the city electronically. Margate’s program page links ProjectDox as the place to apply and to upload the structural and electrical engineer reports, and the city’s ProjectDox page says an account is created there, or an existing one used, before anything is sent.' },
      { k: 'The forms', v: 'Margate’s question sheet puts a report filed on something other than the Broward County form first among the usual reasons a report fails. The structural and electrical report forms are on the city’s permit forms page; the structural one says it rests on the minimum inspection guidelines of the Broward County Board of Rules and Appeals.' },
      { k: 'Common reasons it fails', v: 'After the wrong form, Margate’s sheet lists boxes left unchecked, and a seal that is not clear or comes without an original signature. Those are cured with a corrected page uploaded through ProjectDox. A report that records structural or electrical deficiencies also counts as failed until the repairs are made.' },
      { k: 'After review', v: 'Margate’s page says the Building Department reviews the reports. A building found safe needs no other Building Safety Inspection until its next cycle; when the report shows structural or electrical deficiencies, the owner obtains the permits and finishes the repairs within the time given in “If repairs are needed”.' },
      { k: 'Repairs and permits', v: 'Margate’s sheet insists on permits. The owner hires a licensed contractor, who applies for them — the owner cannot pull the permit and do the work, and a handyman may not repair a roof, stucco or rotted door frames without one. Once the permits for the repairs pass final inspection, a new report goes up through ProjectDox stating that no repairs are required.' },
      { k: 'Incidental repairs', v: 'For repairs that are incidental and not life-threatening, Margate has its own Incidental Repair Agreement. The architect or engineer gives a completion date, the owner signs to acknowledge it, the Building Official approves the time frame, and the form is notarized. When those are the only repairs, the report filed with it must still state that no repairs are required.' },
      { k: 'Site visit and close-out', v: 'Once repairs are done, Margate’s sheet says the Building Department visits the site to make sure the work was completed in accordance with the Florida Building Code. A final report from the architect or engineer is then required to complete what the sheet calls the Safety Inspection Certification.' },
    ],
    faq: [
      {
        q: 'Who tells a Margate owner that the BSIP applies to the building?',
        a: 'The city does, by certified letter: Margate’s page says the owner of an affected property receives one, with information on what to do. Questions about the program go to the Building Department, whose page lists a chief structural inspector among the contacts it names for it. Send us the letter — a photo from your phone works — and we read what the city wants and by when.',
      },
      {
        q: 'How do we file the BSIP reports in Margate?',
        a: 'Online, through ProjectDox: Margate’s program page links it as the place to apply and upload the structural and electrical engineer reports, and the city’s question sheet sends corrected pages the same way. The reports go on Broward County’s structural and electrical forms, which the city’s permit forms page carries; the sheet says a letter in their place will not be adequate.',
      },
      {
        q: 'Why would Margate treat a BSIP report as failed?',
        a: 'Margate’s question sheet gives the usual reasons: the Broward County form was not used, boxes were left unchecked, the seal is unclear or the original signature is missing, or the report lists structural or electrical deficiencies. The first three are corrected with a new page uploaded to ProjectDox; the last only with permitted repairs and a new report.',
      },
      {
        q: 'Does Margate make a building meet today’s code during the BSIP?',
        a: 'No, according to the city’s sheet: the program is a safety inspection of the condition of the structure and of the electrical system, to establish that what exists is safe. The same answer warns that certain repairs may have to be made to the current code. Emergency lights and fire alarms, it adds, are settled at the Margate Fire Department’s annual inspection.',
      },
      {
        q: 'How long does a Margate owner have for BSIP repairs?',
        a: 'Margate’s page counts the repair time from the date of the report and covers both obtaining the permits and finishing the work; the time itself is the county’s, in “If repairs are needed”. Repairs the professional rates as incidental and not life-threatening may follow the later date written into the city’s Incidental Repair Agreement, once the Building Official approves it.',
      },
    ],
    nextStep:
      'Send us Margate’s certified letter — a picture taken with your phone will do — or, if none has come yet, the building’s address and the year on its certificate of occupancy. We check it against what the Building Department’s pages ask for and come back with a proposal for the complete BSIP inspection and report.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'oakland-park',
    program: 'broward-bsip',
    city: 'Oakland Park',
    place: 'Oakland Park',
    office: {
      name: 'City of Oakland Park Building and Permitting Division',
      address: ['Sky South Building', '1100 Park Lane East, 1st Floor', 'Oakland Park, FL 33334'],
      phone: '(954) 630-4350',
    },
    description:
      'Building Safety Inspection Program (BSIP) in Oakland Park: the city’s submittal cover sheet, the latest county forms and the online report portal.',
    heroSub:
      'Oakland Park takes the BSIP package under its own submittal cover sheet, on the latest county forms only. Already late? Both inspections, structural and electrical, still come complete from one team, with the report.',
    lede:
      'In Oakland Park the Building Safety Inspection Program (BSIP) is run by the Building & Permitting Division, which keeps a staff position for it. The city publishes a submittal form of its own that lists what goes into the package and where reports are submitted online, and it posts the county’s report forms beside it.',
    local: [
      { k: 'The city’s submittal form', v: 'Oakland Park asks for its own Building Safety Inspection Submittal Form as the cover sheet of the package. It takes the site address, the year built, the present use and the square footage, with the owner’s details and those of the engineer or architect; a box marked for official use records the building’s place on the Board of Rules and Appeals list.' },
      { k: 'What the package holds', v: 'Under that cover sheet, Oakland Park’s form lists Broward County’s structural and electrical inspection report forms — only the latest forms of the Board of Rules and Appeals will be approved, it says — and a written letter from the Florida-licensed engineer or architect stating that each building is structurally and electrically safe for continued occupancy.' },
      { k: 'Filing the report', v: 'The submittal form points to the city’s online self-service portal as the site for submitting reports online. Oakland Park’s Building & Permitting page also receives permit applications in person at the division’s office, and the division’s FAQ lists an online submissions help desk next to the program’s own phone line.' },
      { k: 'The report forms', v: 'Oakland Park’s Building Permit Applications & Forms page carries the Building Safety Inspection forms, structural and electrical, and the Building & Permitting page links both too. The structural form says the report is based on the minimum inspection guidelines of the Broward County Board of Rules and Appeals, and it has the inspector mark whether repairs are required.' },
      { k: 'Who runs it', v: 'On the city’s side the program belongs to the Building & Permitting Division. The staff directory lists an administrative assistant whose title names the Building Safety Inspections Program, and a city budget message explained that position: the volume of these inspections had increased considerably.' },
      { k: 'If it is not filed', v: 'Oakland Park has brought building safety inspection cases before its Special Magistrate. Hearing agendas have carried a section titled with the program’s former 40-year name, listing property after property under the county code section for the program. The division’s FAQ also lists a contact for building safety inspection orders imposing a penalty or lien.' },
      { k: 'Older names', v: 'Oakland Park’s documents use more than one name. The current submittal form has a box for each inspection age the program now reaches, while older hearing agendas and the budget message still call it the 40-year program. The ages in force are the county’s, in “First due” and “Then”.' },
    ],
    faq: [
      {
        q: 'How do we file the BSIP report in Oakland Park?',
        a: 'With the city’s Building Safety Inspection Submittal Form on top, then Broward County’s structural and electrical report forms and the professional’s letter on the building’s safety. Oakland Park’s form gives its self-service portal as the site for submitting reports online. The complete BSIP inspection and report we deliver comes in the order that form lists.',
      },
      {
        q: 'Which BSIP report forms does Oakland Park accept?',
        a: 'Only the latest inspection forms of the Broward County Board of Rules and Appeals, the city’s submittal form says, for both the structural and the electrical report. Oakland Park posts both on its Building Permit Applications & Forms page, next to the submittal form itself, so a copy saved from an earlier cycle is not the one to reuse.',
      },
      {
        q: 'Who answers BSIP questions in Oakland Park?',
        a: 'The city’s submittal form sends every inquiry about the Building Safety Inspection Program to a phone line of its own, and the staff directory lists an administrative assistant assigned to the program in the Building & Permitting Division. For general permit matters, the division’s main number is the one printed with the office on this page.',
      },
      {
        q: 'What happens in Oakland Park if the BSIP report is never filed?',
        a: 'The city’s pages do not list the steps, but its records show where such cases go: Special Magistrate agendas have listed building safety inspection matters property by property, and the Building & Permitting FAQ gives a contact for orders imposing a penalty or lien under the program. If the date on your Oakland Park notice has passed, send it to us without waiting.',
      },
      {
        q: 'How long does an Oakland Park owner have to file the BSIP report?',
        a: 'The time is the county’s and is printed in “Time to file”; Oakland Park’s own pages do not restate it or describe a way to extend it. If the inspection turns up repairs, “If repairs are needed” gives the time for those. The city’s submittal form records the date the package goes in, so keep a copy of it with the filing.',
      },
    ],
    nextStep:
      'Send what Oakland Park sent you — a phone photo works — or, with nothing yet, the address and the year built. We read it against the city’s submittal form and the county’s rows, and return a proposal for the complete BSIP inspection and report.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'pembroke-park',
    program: 'broward-bsip',
    city: 'Pembroke Park',
    place: 'Pembroke Park',
    office: {
      name: 'Town of Pembroke Park Building Department',
      address: ['3150 SW 52nd Avenue', 'Pembroke Park, FL 33023'],
      phone: '(954) 966-4600',
    },
    description:
      'Building Safety Inspection Program (BSIP) in Pembroke Park: the Town’s submittal application, its checklist, and how the package reaches the Town today.',
    heroSub:
      'Pembroke Park has a BSIP submittal application of its own, with a checklist of what goes with it. Already late? One team still delivers the complete BSIP inspection and report, put together the way the Town’s packet lists it.',
    lede:
      'In Pembroke Park the Building Safety Inspection Program (BSIP) runs through the Town of Pembroke Park Building Department, at Town Hall. The Town’s program page is a set of documents: a master packet, the Town’s own submittal application, the county’s uniform permit application, a Property Appraiser report, the Board of Rules and Appeals’ policy and the two inspection forms.',
    local: [
      { k: 'The Town’s application', v: 'Pembroke Park’s Building Safety Inspection Report Submittal Application asks for the property’s folio number and the building’s square footage, the owner or association and its agent, and the licensed professionals on the job — a structural engineer or architect first, a second engineer or architect after. Its application type marks the inspection cycle, or a Repairs Required Submittal.' },
      { k: 'Its checklist', v: 'At its top, the Town’s application lists what the package must include: the Broward County Uniform Building Permit Application, the structural and the electrical Building Safety Inspection Report Forms, the Broward County Property Appraiser’s report and a cover letter from the architect or structural engineer, with repair recommendations where they are required.' },
      { k: 'The notice number', v: 'The Town’s application has a line for the tracking number from the notification, so the letter is worth keeping. Pembroke Park’s program page does not say who sends it; the Board’s policy posted there has the Building Official notify the owner or association by certified mail, return receipt, once the county’s yearly list arrives.' },
      { k: 'The master packet', v: 'The BSIP Master Packet on the Town’s page starts with the submittal application and continues with pages that mark where each piece goes, among them one headed for the Property Appraiser report to be inserted. Filed in that order, the package reaches the Building Department the way the Town lays it out.' },
      { k: 'Sending it now', v: 'The Town says it is moving its permitting from Gov-Easy to a new online system with CivicPlus, and the old system is offline for self-submissions. Until the change is complete, its Online Permitting System page has applications, forms and required documents e-mailed to the Building Department, each with a Building Department Transmittal Form; without one, a submission is returned.' },
      { k: 'Repairs', v: 'When the report calls for repairs, the Town’s application has a Repairs Required Submittal type, with room for the permit numbers of the repairs, and its checklist asks for the repair recommendations in the cover letter where required. The program page says nothing more about repairs, so the Building Department sets the steps after them.' },
      { k: 'The policy posted', v: 'The Board of Rules and Appeals’ policy on Pembroke Park’s page is the edition in force for the county. The times in the rows above come from it; the page itself adds no time of its own and describes no extension.' },
    ],
    faq: [
      {
        q: 'What does Pembroke Park ask for with a BSIP report?',
        a: 'The Town’s own submittal application, plus the Broward County Uniform Building Permit Application, both Building Safety Inspection Report Forms, the Property Appraiser’s report and a cover letter from the architect or structural engineer, carrying repair recommendations where required. The complete BSIP inspection and report we deliver is assembled against that checklist.',
      },
      {
        q: 'How do we send a BSIP package to Pembroke Park right now?',
        a: 'By e-mail to the Building Department, with a Building Department Transmittal Form, while the Town moves from Gov-Easy to its new CivicPlus system; its page says a submission without that form is returned without further processing. The transmittal form itself also offers hand delivery and mail, so we confirm with the Town which route it wants for the BSIP.',
      },
      {
        q: 'Who sends the BSIP notice in Pembroke Park?',
        a: 'The Town’s program page does not say. The Board’s policy it posts has the Building Official notify the owner or association by certified mail, return receipt, after the county’s yearly list arrives, and the Town’s application asks for the tracking number from that notification. A picture of the letter taken with a phone is all we need to read it.',
      },
      {
        q: 'How long do we have to file the BSIP report in Pembroke Park?',
        a: 'The times are Broward’s, shown above under “Time to file” and “If repairs are needed”, and they come from the Board’s policy that the Town posts. Pembroke Park’s page adds no extension procedure of its own. If the date on your Pembroke Park letter is close, send it to us without waiting.',
      },
      {
        q: 'Is the Pembroke Park BSIP what used to be called the 40-year recertification?',
        a: 'Yes. The Town’s own application still offers the 40-year label as one of its inspection types, beside the first inspection and the later cycles, and the program page calls the form a recertification application. It is one program; the ages that apply now are listed in the rows above.',
      },
    ],
    nextStep:
      'Send the notice addressed to your Pembroke Park building — a picture will do — or, if none has come, the address and the year of the certificate of occupancy. We confirm with the Town of Pembroke Park Building Department how it wants the package and answer with a proposal for the complete BSIP inspection and report.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'tamarac',
    program: 'broward-bsip',
    city: 'Tamarac',
    place: 'Tamarac',
    office: {
      name: 'City of Tamarac Building Department',
      address: ['6011 Nob Hill Road, First Floor', 'Tamarac, FL 33321-6200'],
      phone: '(954) 597-3420',
    },
    description:
      'Building Safety Inspection Program (BSIP) in Tamarac: the Building Official’s notice, the permit application, the number sent back and the county forms.',
    heroSub:
      'Tamarac opens each BSIP case with a Broward County uniform permit application and follows it by the number the city assigns. Already late? One team still delivers your building’s complete BSIP inspection and report.',
    lede:
      'In Tamarac the Building Safety Inspection Program (BSIP) belongs to the City of Tamarac Building Department, which files it with its flood and safety information. The Building Official issues the notice; the process then starts with a building permit application and a current ownership record from the county’s Property Appraiser, and the number the application receives goes back to the department by e-mail.',
    local: [
      { k: 'The notice', v: 'Tamarac’s page says the Building Official issues a Notice of Required Inspection to the building owner or association once the property becomes due. Behind that notice is a county list: each June, the page says, the Broward County Board of Rules and Appeals names the properties due, both those reaching their first inspection and those due again.' },
      { k: 'Opening the application', v: 'The first document Tamarac asks for is the Building Permit Application, and the copy its program page links is the Broward County Uniform Building Permit Application. On that copy the description of work is already printed as a building safety inspection engineer report, with blanks left for the inspection cycle and the year.' },
      { k: 'Proof of ownership', v: 'Along with the application, Tamarac wants current ownership documentation from the Broward County Property Appraiser for the property under review, and its page links the Property Appraiser’s records for it. An old printout kept in the association’s files does not meet that word “current”.' },
      { k: 'The application number', v: 'Once the application is in and the city has assigned it a number, Tamarac’s page asks that the number be e-mailed to the Building Department, at the program address the page gives, so the department can track compliance. The page lays this out as three plain steps: submit the application, keep the number, send it.' },
      { k: 'The report forms', v: 'Tamarac does not host the report forms. Its page sends owners to the Broward County Board of Rules and Appeals for the official forms, checklists and supporting documentation, and says the inspections must conform to the Board’s minimum guidelines, General Considerations & Guidelines for Building Safety Inspections.' },
      { k: 'Whose rules apply', v: 'A policy notice on Tamarac’s page states that the Board of Rules and Appeals’ policy for the program supersedes a State of Florida Senate bill as to the requirements that apply within Broward County. For a Tamarac building, then, the county program governs; its ages and times are the ones in the rows above.' },
      { k: 'What the page omits', v: 'Tamarac’s program page does not say where the reports themselves are uploaded, how they are reviewed, what follows a late filing or how repairs are permitted. The department’s Online Services page describes ePermits and Electronic Plan Review for submitting documents in general, so we confirm the route for the reports with the Building Department before they go in.' },
    ],
    faq: [
      {
        q: 'Who sends the BSIP notice in Tamarac?',
        a: 'Tamarac’s Building Official. The city’s page says the Notice of Required Inspection goes to the building owner or association when the property becomes due, after the Board of Rules and Appeals hands over its yearly list. Send us that notice — a picture taken with a phone will do — and we read what Tamarac is asking for and by when.',
      },
      {
        q: 'What do we file first for the BSIP in Tamarac?',
        a: 'A building permit application, on the Broward County uniform form that Tamarac’s page links, with current ownership documentation from the Broward County Property Appraiser. When the application receives its number, the page asks that the number be e-mailed to the Building Department for compliance tracking. The inspection reports follow on the Board’s forms.',
      },
      {
        q: 'Where are the BSIP report forms for a Tamarac building?',
        a: 'With the Broward County Board of Rules and Appeals: Tamarac’s page sends owners to the Board for the official forms, the required checklists and the supporting documentation. The complete BSIP inspection and report we deliver is prepared on those forms, following the Board’s guidelines that the city’s page names.',
      },
      {
        q: 'How long do we have to file the BSIP report in Tamarac?',
        a: 'The times are Broward’s and appear above, under “Time to file” and “If repairs are needed”. Tamarac’s page adds that the Board’s policy for the program governs within Broward County over a State of Florida Senate bill. The page describes no extension, so the date in your notice is the one to plan around.',
      },
      {
        q: 'Is Tamarac’s BSIP the program people still call the 40-year inspection?',
        a: 'Yes. The uniform permit application Tamarac links still prints the 40-year label first among the cycles in its description of work, next to the current first inspection and the later ones. It is a single program, and the ages that apply today are the county’s, shown in the rows above.',
      },
    ],
    nextStep:
      'Send the notice from Tamarac’s Building Official, or a phone picture of it; with no notice yet, send the address and the year the certificate of occupancy was issued. We check what the City of Tamarac Building Department expects and answer with a proposal for the complete BSIP inspection and report.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'weston',
    program: 'broward-bsip',
    city: 'Weston',
    place: 'Weston',
    office: {
      name: 'City of Weston Building Code Services',
      address: ['Administrative Services Center', '17250 Royal Palm Boulevard', 'Weston, FL 33326'],
      phone: '(954) 385-0500',
    },
    description:
      'Building Safety Inspection Program (BSIP) in Weston: one permit application per building, the reports uploaded to ePermits, and what repairs require.',
    heroSub:
      'Weston takes BSIP reports online, through its ePermits portal, under a uniform permit application that names each building. Already late? One team still delivers the complete BSIP inspection and report, ready for that upload.',
    lede:
      'In Weston the Building Safety Inspection Program (BSIP) is handled by City of Weston Building Code Services, whose program page describes the county’s new regulations for older buildings. The reports go in online, through the city’s ePermits portal, and the page lists what the review needs for each building.',
    local: [
      { k: 'The program’s name', v: 'Weston’s page announces that the Broward County Board of Rules and Appeals adopted new regulations for building inspections, formerly known as the 40-year inspection program, and revised them to be consistent with Florida law. The main change it names is an earlier first inspection; the age in force is the county’s, in the rows above.' },
      { k: 'Filing the report', v: 'Weston’s page says building inspection reports can be submitted online, in the city’s ePermits portal. An account is created there to upload all the documents, and the page points to the city’s owner-builder guide for the steps: registering the account, associating a license and uploading what is required.' },
      { k: 'The permit application', v: 'Each filing rests on a Uniform Building Permit Application with the correct folio, address and building number of each building, found under the city’s Permitting Services. Weston’s page warns that wrong information on it delays the review, allows one application for the required reports, and makes the owner responsible for submitting the report.' },
      { k: 'What goes with it', v: 'For every building, Weston asks for one structural report and one electrical report, along with a photo of the building in which its building number and address can be read. For permits in general, the Building Code Services page says plans go in electronically, digitally signed and sealed, for online review.' },
      { k: 'After filing', v: 'When no work is required, Weston’s page says the file is closed out and archived. Once the ePermits account exists, it invites owners to contact the Building Department, by phone or e-mail, for help. The page does not describe how the result of the review reaches the owner.' },
      { k: 'Repairs', v: 'If repairs are required, Weston’s page calls for a building permit for each discipline separately, applied for by a licensed general contractor and by an electrical contractor, under all the provisions of the Florida Building Code. The page says nothing of an amended report after the work; Building Code Services settles what closes the file.' },
      { k: 'Who runs the office', v: 'Building Code Services enforces the Florida Building Code and Broward County regulations in Weston, under the city’s Building Official, and its contact page says the services are provided by C.A.P. Government, Inc. The offices sit inside the city’s Administrative Services Center.' },
      { k: 'The notice', v: 'Weston’s program page does not describe the notice — who sends it or how it arrives — and twice sends readers to the Broward County Board of Rules and Appeals’ website for more on the program. For a Weston building, the letter itself is the best guide to what is being asked.' },
    ],
    faq: [
      {
        q: 'How do we submit a BSIP report in Weston?',
        a: 'Online, through Weston’s ePermits portal: an account is created there, and the reports, the uniform permit application and the building photo are uploaded to it. The city’s owner-builder guide walks through registering, associating a license and uploading. The complete BSIP inspection and report we deliver is organised for that upload, building by building.',
      },
      {
        q: 'Does each building in a Weston community need its own BSIP reports?',
        a: 'Yes. Weston’s page asks for one structural and one electrical report per building, and for the application to carry the folio, address and building number of each one, although one application can serve the required reports. For a community with several buildings, send us the list of addresses and building numbers with the notice.',
      },
      {
        q: 'What happens in Weston if the BSIP inspection finds repairs?',
        a: 'Weston’s page requires a building permit for each discipline separately, applied for by a licensed general contractor and a licensed electrical contractor, under the Florida Building Code. If no work is required, the page says the file is closed out and archived. The county’s time for the work is the row “If repairs are needed” above.',
      },
      {
        q: 'How long do we have to file the BSIP report in Weston?',
        a: 'Weston’s page does not state a time of its own; the county’s applies, under “Time to file” in the rows above. For the rest of the program the page refers readers to the Broward County Board of Rules and Appeals. If the date on your Weston letter is close, send it to us now so the inspection can be planned in time.',
      },
      {
        q: 'Is Weston’s BSIP the program formerly known as the 40-year recertification?',
        a: 'Yes, under new rules. Weston’s page says the Board of Rules and Appeals adopted new regulations for building inspections, formerly known as the 40-year inspection program, to match Florida law, and that the first inspection now comes earlier. The ages in force are the county’s, in the rows above.',
      },
    ],
    nextStep:
      'Send the letter your Weston building received, or a photo of it; if none has arrived, the address and the year of the certificate of occupancy are enough to begin. We check what City of Weston Building Code Services asks for and come back with a proposal for the complete BSIP inspection and report.',
    checkedISO: '2026-10-17',
  },
  {
    slug: 'wilton-manors',
    program: 'broward-bsip',
    city: 'Wilton Manors',
    place: 'Wilton Manors',
    office: {
      name: 'Community Development Services Department',
      address: ['2020 Wilton Drive', 'Wilton Manors, FL 33305'],
      phone: '(954) 390-2180',
    },
    description:
      'Building Safety Inspection Program (BSIP) in Wilton Manors: the documents the city posts, online permit filing, and the cases its Special Magistrate hears.',
    heroSub:
      'Wilton Manors keeps its BSIP documents among its building permit forms and takes permit applications online. Already late? One team still delivers the complete BSIP inspection and report, on the Board’s forms the city lists.',
    lede:
      'In Wilton Manors, building permits and inspections come under the city’s Community Development Services Department, which has contracted building services assistance to Calvin, Giordano & Associates, a SAFEBUILT company. The city has no separate page for the Building Safety Inspection Program (BSIP): its building permit applications page carries a short section of documents for it.',
    local: [
      { k: 'Where the documents are', v: 'On the city’s building permit applications page, after the list of permit forms, a heading for the Building Safety Inspection Program holds four files: the county code section that sets up the program, a BSIP structural inspection form, a BSIP electrical inspection form and the Board of Rules and Appeals’ policy for the program.' },
      { k: 'The code section', v: 'The code section Wilton Manors posts comes from Broward County’s amendments to the Florida Building Code. It says the Board of Rules and Appeals created the program, that the Board’s written policy holds its minimum requirements, and that the Building Official shall enforce it. The city’s page lists its Building Official among the contracted firm’s staff.' },
      { k: 'The report forms', v: 'Both inspection forms on the city’s list are the Board’s fillable forms. The structural one opens with a choice between “No Repairs Required” and repairs required as outlined in the attached inspection report, and it states that the report rests on the minimum inspection guidelines in the Board’s policy.' },
      { k: 'Filing online', v: 'Wilton Manors says building permit applications and inspection requests are now accepted online, through the Building Permits link on its Online Services page, and its construction services page says all permits are submitted and can be monitored online. The BSIP section does not say how a report itself is delivered.' },
      { k: 'Digital signatures', v: 'The same page that carries the BSIP section lists a Digital Signature Affidavit among the city’s permit forms. The BSIP section itself does not say whether a report filed with digital signatures needs that affidavit, so we put the question to Community Development Services before the report goes in.' },
      { k: 'Code compliance', v: 'A building out of step with the program can reach the city’s Special Magistrate. An agenda of a hearing held by the city’s Code Compliance Unit lists a property cited under the Florida Building Code section for the program, still called there by its 40-year name, next to other violations at the same address.' },
      { k: 'An older policy copy', v: 'The copy of the Board’s policy on the city’s list is an earlier edition: its reporting section still gives a shorter time to complete the inspection than the county applies today. The times in force are the county’s, in the rows above, and the Building Official’s notice states the date for your building.' },
      { k: 'Who is exempt', v: 'The county code section that Wilton Manors posts exempts U.S. Government and State of Florida buildings, buildings on Indian reservations, schools under the Broward County School Board, one- and two-family dwellings, certain townhouses as the Florida Building Code defines them, and the minor structures it defines by floor area.' },
    ],
    faq: [
      {
        q: 'Where are the BSIP forms for a Wilton Manors building?',
        a: 'On the city’s building permit applications page, under its Building Safety Inspection Program heading: a structural and an electrical inspection form, the county code section and the Board of Rules and Appeals’ policy. The complete BSIP inspection and report we deliver uses both of those Board forms, for every building named on the notice.',
      },
      {
        q: 'How is a BSIP report filed in Wilton Manors?',
        a: 'Wilton Manors takes building permit applications online, through the Building Permits link on its Online Services page, and says all permits are now submitted online. The BSIP section names no portal or e-mail address for the report itself, so we ask Community Development Services how it wants the report before anything is filed.',
      },
      {
        q: 'Who reviews BSIP reports in Wilton Manors?',
        a: 'The county code section the city posts says the Building Official enforces the program. Wilton Manors has contracted its building services assistance to Calvin, Giordano & Associates, a SAFEBUILT company, and the city’s page lists the Building Official and the plan reviewers, discipline by discipline, among that firm’s staff.',
      },
      {
        q: 'What happens if a Wilton Manors building falls behind on the BSIP?',
        a: 'The city’s pages set out no procedure, but an agenda of the Code Compliance Unit’s Special Magistrate hearing shows a property cited under the program’s code section, along with other violations. The county’s times are above, under “Time to file” and “If repairs are needed”; if your date is near or past, send us the notice now.',
      },
      {
        q: 'Is the Wilton Manors BSIP the program known as the 40-year inspection?',
        a: 'Yes, under its current name. The Board’s policy that the city posts says buildings inspected under the prior program, known as the 40-year Building Safety Inspection Program, are deemed compliant with state law and continue with the later inspections. Today’s ages are the county’s, listed in the rows above.',
      },
    ],
    nextStep:
      'Send the Building Official’s notice for your Wilton Manors building, or a photo of it; if nothing has come yet, the address and the year of its certificate of occupancy are enough to start. We check with Community Development Services what it expects and reply with a proposal for the complete BSIP inspection and report.',
    checkedISO: '2026-10-17',
  },
];
