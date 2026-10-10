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
      'In the City of Miami the Unsafe Structures Section runs the recertification, and the documents are submitted online. One team delivers yours complete, on the city’s forms.',
    lede:
      'In the City of Miami the recertification runs through the Unsafe Structures Section of the Building Department. The city says it recertifies structures as per the Miami-Dade County Code, and its page has the owner hire an architect or engineer to inspect the property and then submit the documents online. What comes next is what Miami’s own pages say, one subject at a time.',
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
      'Miami Beach’s Building Department posts the recertification notice at the property and reviews the report. One team delivers the complete recertification, in the single report the city asks for.',
    lede:
      'In Miami Beach the recertification runs through the City of Miami Beach Building Department, in the unit its written procedure calls the Recertification Section. The department posts the notice at the building, receives a digitally signed report through its Citizen Self Service portal or by e-mail, and reviews it before the Building Official gives final approval. Its page still gives the program’s former name, the 40-year recertification.',
    local: [
      { k: 'The notice', v: 'The Building Department posts a notice at the property well ahead of the date the recertification is due. Reminders follow as that date approaches, the final one together with a notice posted on site. The recertification package asks the owner to arrange an electrical and a structural inspection of the building and to file a signed and sealed report with the Recertification Section.' },
      { k: 'Filing the report', v: 'The city asks for one completed inspection report that contains both the structural and the electrical reports. A digitally signed report can go in through the Citizen Self Service portal — CSS on the city’s pages — or by e-mail to the Building Recertification team. The city’s procedure adds that an e-mailed report should carry a digital signature and seal that a third party can verify.' },
      { k: 'In person', v: 'A report that is not digitally signed and sealed may be e-mailed as a scanned copy, the city’s procedure says, with the original signed and sealed report sent by mail or handed in at an in-person appointment at the Building Department. The department’s procedures also list Building Recertification among its appointment services, and the phone line has an option under the same name.' },
      { k: 'The city’s forms', v: 'Under “Required Building Recertification Reporting Forms” the city’s page lists a structural and an electrical inspection form, both under the Building Department’s name, a structural inspection guide, and two parking-lot forms — guardrails and illumination — that go in where they apply. The electrical form has a thermography section, with the thermography report attached where the building’s electrical service requires one.' },
      { k: 'After filing', v: 'The city’s procedure routes the report to the Chief Structural Engineer and the Chief Electrical Inspector for review. After both approvals the recertification goes to the Building Official for final approval. The city’s page says the Building Official then issues a Building Recertification approval letter, sent to the owner and to the engineer or architect of record.' },
      { k: 'Repairs', v: 'When the first report notes deficiencies that need permits, the city’s page has the owner submit an updated report once those permits have passed final inspection. The same paragraph requires a cover letter certifying that the building is structurally and electrically safe for its specified use and occupancy. The procedure says the department fast-tracks those repair permits; the recertification number goes on the permit application.' },
      { k: 'Extensions', v: 'The city’s procedure says an extension to obtain repair permits may be granted when the design professional who inspected the building finds it poses no harm to its occupants, states in writing that it can stay occupied and asks for the extension. The procedure sets its own length for it; the time for repairs now in force is the county’s, in the rows below.' },
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
      'Hialeah’s Building Division mails the recertification letters and receives the reports. One team delivers yours complete, on the forms the city lists.',
    lede:
      'In Hialeah the recertification runs through the Building Division. Each year the division mails a letter to the owners whose buildings are due, and it publishes its own set of forms and guidelines for the report. What follows is what the city’s own pages say, subject by subject.',
    local: [
      { k: 'The notice', v: 'The Building Division mails letters each year to the owners of the buildings that are due. The city’s report form asks for the date of that Notice of Required Inspection, so keep the letter: the deadlines are counted from it.' },
      { k: 'The city’s forms', v: 'Hialeah publishes its own fillable editions of the structural and electrical report forms, with the city’s name on them, and the guidelines that go with them. Its recertification page presents them as required forms.' },
      { k: 'What goes with them', v: 'The same list carries a parking-lot illumination form, a parking-lot guardrails affidavit and a sample letter of compliance, written on the professional’s letterhead and addressed to the Building Official. The two parking-lot documents go in where they apply to the property.' },
      { k: 'Electronic filing', v: 'The list also includes an affidavit that authorizes electronic submittal in place of signed and sealed hard copies. The city’s page does not say how a recertification report is delivered, so we confirm it with the Building Division before anything is filed.' },
      { k: 'Repairs', v: 'The city’s structural form is marked either as the initial report or as the amended report after the repairs are complete, and it asks whether the building can stay occupied while the recertification and the repairs are under way.' },
      { k: 'If it is late', v: 'Hialeah’s page says a building whose report is not in on time is deemed unsafe and non-compliant under the county code, that the case goes to a hearing before the city’s Special Magistrate, and that the Certificate of Occupancy may be revoked.' },
      { k: 'Older names', v: 'Some of the city’s documents still carry the program’s former name, the 40-year recertification — the guidelines and the sample letter among them. It is the same program; the ages now in force are in the rows further down.' },
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
      'Coral Gables’ Building Division mails the notices, and the reports are uploaded to the city’s permitting portal. One team delivers yours complete, on Miami-Dade’s templates.',
    lede:
      'In Coral Gables the City of Coral Gables Building Division mails the notices for the county’s building recertification. The completed report is prepared on Miami-Dade’s templates and uploaded to the city’s permitting web portal. What Coral Gables’ own pages and its Permit Requirements guide say follows, subject by subject.',
    local: [
      { k: 'The notice', v: 'The Building Division mails a Notice of Required Recertification to the owners of the buildings the program applies to; courtesy notices are also mailed ahead of it so that owners can prepare. Coral Gables’ program page also links, year by year, a Building Recertification List of the city properties required to recertify.' },
      { k: 'Filing the report', v: 'The completed report goes to the Building Official, uploaded electronically to what the program page calls the City’s permitting web portal. The Permit Requirements guide adds that the filing follows the city’s Electronic Submittal Guide, which covers digital signing and sealing and asks for PDF files.' },
      { k: 'The city’s forms', v: 'Coral Gables’ page asks for the report on Miami-Dade’s report templates. The Permit Requirements guide lists Miami-Dade County forms — the structural recertification, the building photos and the electrical recertification among them — and the program page points to guidelines for the structural component and for the electrical component of the report.' },
      { k: 'What goes with it', v: 'By Coral Gables’ page, a completed report includes the structural report, the electrical report and the professional’s cover letter or letters certifying that the electrical system and the building structure are safe for the intended use and occupancy. The same list has two parking-lot certification forms, one for guardrails and one for illumination, filed where they apply.' },
      { k: 'Additional files', v: 'With more than one building on the property, the city’s page asks for a site plan or survey that shows each building and clearly identifies the one the report covers. The Permit Requirements guide adds, if applicable, an infrared thermography inspection (which the guide ties to amperage), a Preliminary Inspection Report and a request for time extension.' },
      { k: 'After filing', v: 'Once the structure is in compliance, Coral Gables issues a Building Recertification letter. The program page does not describe the review before that letter. For permits in general, the city’s FAQ says reviewer comments are posted in the Citizen Self Service (CSS) Portal and corrections are also e-mailed; the Electronic Submittal Guide has corrections uploaded through a “Resubmit” button, with a note explaining them.' },
      { k: 'Extensions', v: 'The city’s page says the Building Official may grant extensions for good cause, provided affidavits are accepted stating that the building can stay occupied while it is undergoing recertification or waiting for a permit or repairs. That is all the page says about repairs; the county’s time for them is in the rows further down.' },
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
      'Doral’s Building Department runs the recertification: reports go in at City Hall or through the city’s permitting system. One team delivers it complete, on the county templates Doral accepts.',
    lede:
      'In Doral the recertification sits with the city’s Building Department, which lists it among its programs and publishes a guide of its own. The city’s page says that, in addition to its local ordinances, Doral follows and enforces the Code of Miami-Dade County. The city accepts the county’s document templates for the reports; what its pages say is set out here, topic by topic.',
    local: [
      { k: 'The notice', v: 'Doral’s page says the owners of the properties that require certification receive a Notice of Required Recertification, which starts the process, and that a record is created in the city’s permitting system. Doral’s pages do not say how the notice is delivered. For the portal account, the page sends every user to the city’s Videos and Tutorials page.' },
      { k: 'Filing the report', v: 'The Doral Building Department’s guide gives two routes. In person, the completed reports go to the solution center on the second floor of Doral City Hall. Online, the applicant creates a contact in the city’s permitting system — CSS, the Citizen Self-Service portal — searches for “Building Recertification” and selects apply. The program page adds a caution for an initial recertification; see the first question below.' },
      { k: 'Digital or paper', v: 'Doral’s page wants each page of the structural and electrical reports signed and sealed, unless the report is submitted electronically with a verifiable digital signature. Per the guide, digital signatures can only be transmitted electronically; a wet or hard seal must be submitted in person. The page’s tip: save the file as a PDF before the signature goes on, so the uploaded report is unlocked.' },
      { k: 'The city’s forms', v: 'Doral’s guide says Miami-Dade County’s document templates are accepted, and the program page points to the county’s page for the templates and forms. It also notes that the guidelines and report templates were revised, with the approval of the Board of Rules and Appeals. The complete recertification we deliver goes on those templates.' },
      { k: 'What goes with it', v: 'Among its minimum documents, Doral’s guide lists a structural and an electrical cover letter, each signed, sealed and dated, and, where the rating of the building’s electrical service requires it, a thermographic inspection report. Doral’s program page adds, for a property with more than one building, a site plan or survey that locates each and clearly identifies the one the report is about.' },
      { k: 'Extensions', v: 'Doral’s page says a one-time extension, of a length the page sets, is permissible provided the building is safe to occupy. The request is a signed and sealed letter from the professional of record, e-mailed to the Building Official. The letter must include, among other items, confirmation that the building is safe to occupy while the final report is issued, and whether repairs are needed.' },
      { k: 'If it is late', v: 'Doral’s page says that expired processes, and buildings that have failed to be recertified, will be referred to code compliance for immediate action. It does not say what that action is, and it names no hearing body. The time Doral’s owners have to file is the county’s, in the rows below.' },
      { k: 'Older names', v: 'Doral’s guide and its department directory still label the Building Recertification Program as the former 40-year recertification, and the city’s tutorials page sends owners to its “Building Milestone page” for the requirements to recertify a building. The program page also still carries dates that have already passed; the ages and days in force are the county’s, in the rows further down.' },
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
      'North Miami counts recertification among its Building Department’s services and posts the county-approved forms; on those forms, one team delivers the complete recertification.',
    lede:
      'The City of North Miami Building Department lists recertification among the services it provides, and the city keeps a page on the program. That page is brief: it says which buildings are covered, posts the county-approved forms, names a Building Officer as its contact and points to Miami-Dade County’s recertification page for guidance. Where it is silent, the rows below say so.',
    local: [
      { k: 'The notice', v: 'North Miami’s page does not say who sends the notice or how it arrives. It mentions the notice only under the exemptions: if one is received, it is the owner’s responsibility to request an exemption in writing from the Building Official. The structural form the city posts asks for the date of the Notice of Required Inspection, so keep the letter.' },
      { k: 'Who is exempt', v: 'North Miami’s page says all buildings and structures are covered except single-family residences and duplexes, agricultural exempt buildings, and minor buildings within both a floor-area limit and an occupancy limit. It adds that both conditions must apply, and that the occupancy counted is the potential load for the building’s use classification in the code.' },
      { k: 'The city’s forms', v: 'North Miami posts four documents under the heading “Miami-Dade County Approved forms for Report Submittal”. Two are the report forms — the structural and the electrical recertification inspection guidelines — and the structural one is marked “MDC Building Recertification Structural Report”; the other two are parking-lot certifications.' },
      { k: 'What goes with them', v: 'The two parking-lot documents are certifications of compliance, one for parking-lot guardrails and one for parking-lot illumination; North Miami lists both, and each goes in where it applies to the property. The electrical form the city posts also has a section for thermography results, filled in where the building’s electrical service requires that inspection.' },
      { k: 'Filing the report', v: 'North Miami’s page does not say how or where the report is filed, or what happens once it is in: it names no portal, no e-mail address and no counter for it. Its contact for the program is a Building Officer at the Building Department’s phone number. The letter and that office settle the way to file; we confirm it with the department first.' },
      { k: 'Repairs', v: 'North Miami’s recertification page says nothing about permits for repairs. The city’s guardrail certification does: where there is no complying guardrail, it records that the owner has been advised to obtain a permit to install one. Separately, the city’s online permitting page — which is about permits in general — says scopes of work outside its online list need an in-person application.' },
      { k: 'If it is late', v: 'North Miami’s page prints no deadline of its own, and it does not say how an extension is requested or what follows a late report. For guidance and questions it points to Miami-Dade County’s recertification page. The county’s times to file and to repair are in the rows below.' },
      { k: 'The program’s name', v: 'North Miami’s page is titled “Milestone Recertification”, followed by the cycle in years. It is the program still called the 40-year recertification: the page recounts its origin and says Miami-Dade has since shortened the inspection cycle. Its forms are the ones the county approves for the report; the ages in force are in the rows further down.' },
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
      'North Miami Beach’s Building Department gives notice by certified mail; its Governmental Compliance Section takes in the report. One team delivers the complete recertification on North Miami Beach’s own forms.',
    lede:
      'In North Miami Beach the recertification runs through the City of North Miami Beach Building Department. The department notifies the owner by certified mail, the completed report goes to its Governmental Compliance Section for review and approval, and the Building Official issues the approval letter. Below is what North Miami Beach’s recertification page, and the documents posted on it, say on each subject.',
    local: [
      { k: 'The notice', v: 'North Miami Beach’s owner-notification sheet says that when a building is due, the Building Department sends a notice to the owner or the owner’s representative by certified mail. The notice the city posts names a contact person, with a phone and an e-mail, for further information. Keep the letter: the same sheet counts the time to file from its receipt.' },
      { k: 'Filing the report', v: 'The city’s recertification page sends the completed report to the Governmental Compliance Section of the Building Department; one of the city’s sheets names the department’s Engineering Section instead. None of these pages says how the report is delivered: no portal, counter or e-mail is given for it. So we confirm it with North Miami Beach’s Building Department before the report goes in.' },
      { k: 'The city’s forms', v: 'North Miami Beach posts its own structural and electrical report forms, each under the Building Department’s heading. The guidelines North Miami Beach posts with them say the approved report forms provided must be used and that proprietary forms will not be accepted. The complete recertification we deliver goes on North Miami Beach’s forms.' },
      { k: 'What goes with them', v: 'The city’s owner-notification sheet says the report also includes an illumination survey for the parking areas, and that recertification reports bear an impressed seal and signature. North Miami Beach’s guidelines call for an infrared thermography inspection, with a written report, where the building’s electrical service reaches the size they set.' },
      { k: 'After filing', v: 'Once the reports are approved, the Building Official issues a Building Recertification approval letter, sent to the owner and to the professional of record; the city says to retain it as proof of approval. North Miami Beach’s guidelines add that reports may be audited, and the building inspected, at the Building Official’s discretion.' },
      { k: 'Repairs', v: 'North Miami Beach says the owner must hire a Florida-licensed contractor and obtain Building Department permits before any repair or modification. Once every permit has an approved final inspection, a signed and sealed report must state that the repairs are complete and the building is structurally and electrically safe for continued use; the time for the repairs is in the rows below.' },
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
      'Aventura’s Building Division administers the recertification and receives the documents online. One team delivers it complete, following the county guidelines the city’s page lists.',
    lede:
      'In Aventura the recertification is administered by the City of Aventura Building Division, in accordance with Miami-Dade County requirements. The notice comes from the city, which uses the county’s current guidelines, and the documents are filed electronically. Aventura also has ordinances of its own, on engineering reports and on yearly structural maintenance; the county’s deadlines are in the rows further down.',
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
      'Sunny Isles Beach’s Building Department lists what a recertification filing must contain and issues the repair permits. One team delivers the complete recertification, on the forms the department posts.',
    lede:
      'Sunny Isles Beach runs the recertification through its Building Department. The department’s page sets out what owners submit once the notice arrives, what happens when repairs are needed and how an extension is requested. It does not say where the package is handed in, so what follows marks both what the city has published and what it leaves open.',
    local: [
      { k: 'The notice', v: 'The city’s page says owners of properties that require recertification receive a Notice of Required Recertification, which starts the process; further on it writes Notice of Required Inspection. It does not say who sends it in Sunny Isles Beach, or how. Keep the letter: the page counts the owner’s time from its date, and the days in force are in the rows further down.' },
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
      'The city’s Building Services lists recertification among its services and posts its own report forms. One team delivers your Miami Gardens recertification complete, on those forms.',
    lede:
      'The city’s website has no page of its own that explains the recertification. What it has is this: City of Miami Gardens Building Services lists the program among its services, and its Documents and Forms page keeps a Recertification group with the city’s report forms, the county’s guidelines and an extension request. The county’s deadlines for a Miami Gardens building are in the rows below.',
    local: [
      { k: 'The notice', v: 'The city’s website does not say who sends the Notice of Required Inspection, or how it reaches the owner. On the site the notice appears only as a date to fill in: the city’s structural report form asks for the date of that notice, and its extension request has a line marked Notice Date. Keep the letter, so the date is at hand.' },
      { k: 'The city’s forms', v: 'Miami Gardens lists its own structural and electrical report forms — each titled with the city’s initials, CMG — in the Recertification group of its Documents and Forms page. The guidelines in that group are Miami-Dade County’s; they say the approved report forms must be used and that proprietary forms will not be accepted.' },
      { k: 'What goes with them', v: 'The city also posts two certifications for the parking lot — illumination and guardrails — which are filed where they apply to the property. The guidelines ask for a cover letter with each report, and the electrical form has a section for infrared thermography, where the building’s electrical service requires it, with the thermography report attached.' },
      { k: 'Filing the report', v: 'The page that lists these forms opens with one general instruction: building forms are to be completed and submitted as attachments to an online permit application in CSS, the city’s Citizen Self Service portal, as required. The site has no filing instruction written for the recertification report in particular, so we confirm with Building Services how yours is to be filed before anything goes in.' },
      { k: 'After filing', v: 'The city’s site does not describe its review or say how an owner learns the result. The county guidelines it posts say that recertification reports may be audited, that the building may be inspected at the discretion of the Building Official, and that the Building Official keeps the right to revoke an approved report.' },
      { k: 'Repairs', v: 'The guidelines Miami Gardens posts say that repairs the report identifies will most likely need permits, that proceeding without them may lead to a code violation, and that repairs under a permit afford additional time to comply. The city’s structural form has a box for the amended report, after completion of repairs, and asks whether the building can remain occupied while they are ongoing.' },
      { k: 'Extensions', v: 'The city has its own form, titled Recertification Extension Request. It is written as a letter from the owner, the owner’s agent or the contractor that gives the reasons for the request, and it is sworn before a notary. A line on it records the number of days granted; the site does not say where the form is sent.' },
      { k: 'Older names', v: 'The Building Services page still lists the program as “40 Year Re-Certifications”, and the city’s extension request still calls it the 40-year recertification. The report forms the city posts say building recertification, and that is the program meant. The ages and the days in force are the county’s, in the rows further down.' },
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
      'Homestead’s Building Safety office, within Development Services, publishes the county’s recertification ordinance and the report templates. One team delivers your recertification complete, on those templates.',
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
      'Surfside’s Building Department sends the notice by certified mail and takes applications through its CSS portal only. One team delivers your Surfside building’s complete recertification, on the approved report forms.',
    lede:
      'In Surfside the recertification runs through the Town of Surfside Building Department, which receives the reports for review and approval. Its program page explains how owners are notified and what a late report leads to; a separate sheet of instructions covers the filing, which goes only through the Town’s Customer Self Service portal, CSS. Where the Town Code adds something of its own, the rows below say so.',
    local: [
      { k: 'The notice', v: 'Surfside’s program page says the Building Department sends a notice by certified mail to the owner or the owner’s representative when a building is due. Keep that certified letter: the Town’s page counts the owner’s time from it. The Town Code provides for courtesy notices ahead of the recertification’s anniversary date, and says a failure to provide them does not release the owner from recertifying.' },
      { k: 'Filing the report', v: 'Surfside’s instructions say recertification applications are accepted through the Town’s CSS portal only, and hard copies are not. The application type those instructions name still carries the program’s former 40-year name. The same sheet asks applicants not to e-mail the Building Official or the Town Manager: the package may not be received or processed.' },
      { k: 'The city’s forms', v: 'The Building Recertification Package on the Town’s site opens with Miami-Dade County’s General Considerations and Guidelines, which say the approved report forms must be used and proprietary forms are not accepted. Surfside’s instructions begin with a permit application, printed and filled out, and the Building Department’s forms page says its forms are fillable online and electronic notarization is accepted.' },
      { k: 'The files', v: 'Surfside’s instructions ask for the recertification package in a separate PDF file, divided by discipline. Encrypted files and files with third-party signatures are not processed: plan reviewers must be able to mark them up. The program page asks for an impressed seal and signature; the Town’s site does not say how an uploaded PDF meets that, so we confirm it with the Building Department.' },
      { k: 'After filing', v: 'Once the application is processed, the Town’s permit technician e-mails a receipt that carries the application number. The report goes to the Building Department for review and approval, and after the package is reviewed the clerk contacts the applicant about the recertification letter, whose issuance is the last step in Surfside’s instructions. The Town’s site gives no review time.' },
      { k: 'Repairs', v: 'Surfside’s program page says repairs or modifications the inspection finds necessary are to comply with the Florida Building Code, and it counts the owner’s time for them from the notice of required inspection. What that time is for a Surfside building today is in the rows further down. That page is silent on permits for those repairs and on an amended report afterwards.' },
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
      'The Village of Key Biscayne sends the notice by certified mail, and its Building Official receives the report. One team delivers the complete recertification.',
    lede:
      'In Key Biscayne the recertification is handled by the Village itself, through the Village of Key Biscayne Building, Zoning and Planning Department. Its page says the Village follows the process set forth by Miami-Dade County, and that it follows the State and County building codes. Below is what the Village’s own pages say, one subject at a time.',
    local: [
      { k: 'The notice', v: 'The Village issues the notification itself and sends it by certified mail — “to ensure receipt”, its page says — to the ownership or management of the building. So the envelope may be addressed to the building’s management and not to its owners. The page prints no number of days for the report; the county’s deadlines are in the rows further down.' },
      { k: 'Filing the report', v: 'The Village’s page says the owner of the building must submit a written Recertification Report to the Building Official. It does not say by what route — on paper, by e-mail or through the Village’s Citizen Portal — so the notice or the Village Building Department settles that point.' },
      { k: 'What goes with it', v: 'The Village’s page asks that each page of the structural report and of the electrical report be signed and sealed. Where a property has more than one building, the report should include a site plan or a copy of a survey that shows where each building stands, with the building being recertified clearly identified on it.' },
      { k: 'The Village’s forms', v: 'The Village’s Forms and Resources page carries the minimum inspection guidelines for the structural recertification, the matching guidelines for the electrical recertification and a certification of compliance with parking-lot guardrails. The guardrails certification belongs in a Key Biscayne package only where it applies to the property.' },
      { k: 'After filing', v: 'Once the report is in, the Village audits it for compliance with the Miami-Dade County Code. If the report is acceptable, the Village issues what its page calls the recertification letter. The Village’s page does not say how long that audit takes.' },
      { k: 'Repairs', v: 'If the report’s findings identify non-compliance with the Miami-Dade or Florida building codes, the Village requires the owner or management to complete repairs. Its page says the engineer or architect they hired then re-inspects the work and provides an updated report, which the Village audits in turn.' },
      { k: 'If it is late', v: 'The Village’s page does not speak of a late report as such. It says that when the repairs and the updated report do not happen, the Village may report the structure to Miami-Dade County’s Unsafe Structures Board, and that the Village Building Official determines, case by case, whether a building the county defines as an unsafe structure is referred to that board.' },
      { k: 'Older names', v: 'The Village’s recertification page still describes the program on its earlier schedule, and its Citizen Portal still lists a record type called “40 Year Recertification” — the program’s former name. The ages and days in force in Key Biscayne are the county’s, in the rows further down.' },
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
      'Fort Lauderdale’s Building Official sends the notice by certified mail; the reports go in through the LauderBuild Plan Room, and one team delivers the complete BSIP inspection and report.',
    lede:
      'On Fort Lauderdale’s site, Broward’s Building Safety Inspection Program (BSIP) comes under the City of Fort Lauderdale Development Services Department, and the program page gives the Building Safety Program as the contact. The notice comes from the Building Official by certified mail, and the whole filing is electronic, through the LauderBuild Plan Room. Here is what Fort Lauderdale’s own pages say, step by step.',
    local: [
      { k: 'The notice', v: 'Fort Lauderdale’s page says the notice comes from the Building Official by certified mail, to the property owner, the association or both, in the year the building is due for inspection. Keep it: the city’s submittal form asks for the tracking number from that notification.' },
      { k: 'Filing the report', v: 'Fort Lauderdale takes the filing electronically only — its page says paper submissions are no longer accepted. The documents go in through the LauderBuild Plan Room, under the application the city calls the Building Safety Inspection Program Application (BSIP). Each one is uploaded as a separate file; the page says not to combine them.' },
      { k: 'The city’s forms', v: 'The city’s page lists the forms that must be completed and attached to the application: its own Building Safety Inspection Submittal Form, a structural inspection form and an electrical inspection form. The structural form it links is headed Broward County BORA, the county’s Board of Rules and Appeals. The Plan Room’s list of document types marks both inspection forms as requiring the digital sign and seal.' },
      { k: 'The submittal form', v: 'Fort Lauderdale’s submittal form asks for the property’s folio number and the building’s square footage. It is marked either as an initial submittal or as a Repairs Required Submittal, which also asks for the permit numbers of the repairs. Its checklist names the structural and the electrical report forms as part of the package.' },
      { k: 'Signatures and files', v: 'Fort Lauderdale requires every document to be digitally signed and sealed. The city’s Digital Signature Policy does not accept a self-signed signature, and it names the certification authorities it approves for digital certificates. The Plan Room’s general standards ask for PDF files and rule out encrypted or password-protected ones.' },
      { k: 'After filing', v: 'Once the application is in, Fort Lauderdale’s page mentions one step: an e-mail notification when it has been accepted. It does not say how the owner is told the result of the review or what document closes the case. Under the Plan Room’s general rules, once a package has been submitted for review, more documents cannot be uploaded without permission from City staff.' },
      { k: 'Repairs', v: 'When repairs are needed, Fort Lauderdale’s page calls for a written, signed and sealed letter to both the owner and the Building Official, stating whether the building can stay safely occupied while they are made. Once they are finished, it has the licensed professional who did the inspection re-inspect and provide an amended report, with a signed and sealed letter confirming that all repairs are complete.' },
      { k: 'If it is late', v: 'Fort Lauderdale’s program page does not say what happens when a report is late: it names no hearing body and describes no extension of the time to file. The one exception it mentions concerns repairs, whose time — in the rows further down — applies unless the Building Official specifies otherwise. For anything else, the notice and the Building Safety Program settle it.' },
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
      'Hollywood takes new BSIP reports only through its Accela Citizen Access portal, and its Building Division reviews them; one team delivers the complete BSIP inspection and report.',
    lede:
      'In Hollywood the Building Safety Inspection Program (BSIP) runs through the City of Hollywood Building Division. The Building Official issues the notice, the report goes in through the Accela Citizen Access (ACA) portal, and the city’s Plan Reviewers review what is filed. Here is what Hollywood’s own pages say, point by point; the county’s deadlines are in the rows further down.',
    local: [
      { k: 'The notice', v: 'Hollywood’s page says the Building Official issues a Notice of Required Inspection to the building’s owner or association. The Board of Rules and Appeals sends the city the lists of properties that are due, and Hollywood posts them on that same page as soon as it receives them.' },
      { k: 'Filing the report', v: 'Hollywood’s page says all new BSIP reports must be submitted through the City of Hollywood’s Accela Citizen Access (ACA) portal. It says hard copies and mailed submissions are no longer accepted, and that every required signature must be digital and validated through ACA — handwritten or scanned signatures are not accepted.' },
      { k: 'Before you file', v: 'Hollywood sets a step ahead of the filing. The engineer or architect responsible for the report must be registered in ACA and approved by the city’s intake staff before the report is submitted, and must be selected in ACA as the design professional for the application. If that professional does not appear in ACA, the page says the report cannot be submitted.' },
      { k: 'The city’s forms', v: 'The report packet the city hosts opens with Hollywood’s own Transmittal Checklist for the BSIP report. It asks for a current Broward County Building Safety Inspection structural report and electrical report, each indicating whether repairs are required or not. The checklist adds that several stand-alone building structures cannot be combined in one report.' },
      { k: 'What goes with it', v: 'For each building, Hollywood’s page asks for the completed BSIP report, which includes the structural and the electrical inspections, together with photos of the existing condition. If repairs are required, it also asks for a narrative or scope of work and for color photos, as a PDF, of the area that requires them.' },
      { k: 'After filing', v: 'Hollywood’s Building Division reviews the reports. Under its heading for buildings where no repairs are required, the city’s page says a Certificate will be issued if, on the Plan Reviewers’ review, the submitted documents are in compliance. The page does not say how the owner is told the result; that is a question for the Building Division.' },
      { k: 'Repairs', v: 'If the BSIP report identifies work that requires a building permit, Hollywood’s page says the city’s Plan Reviewer requests it after the report is submitted and reviewed, and the application also goes through ACA. The city’s checklist says a permit may be required depending on the extent of the repairs, and asks for the permit number when the report is submitted after the required repairs.' },
      { k: 'Older names', v: 'One section of Hollywood’s page still carries the program’s former name, the 40-year program, and the earlier schedule. The sample notice letter the city posts repeats that schedule and speaks of mailing or delivering the report. The ages and days in force are the county’s, in the rows further down; for filing, the page’s submission requirements name the ACA portal.' },
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
      'Pompano Beach’s Building Official sends the notices by certified mail and receives the reports. One team delivers the complete BSIP inspection and report, on the forms the city names.',
    lede:
      'In Pompano Beach the Building Safety Inspection Program (BSIP) runs through the Building Official, in the city’s Building Department. The city’s program page covers the notice, the report, repairs and extensions, and it lists a form of the city’s own, the Re-Inspection Affidavit. Here is what the city’s pages and that form say; the county’s deadlines are in the rows further down.',
    local: [
      { k: 'The notice', v: 'Pompano Beach’s page says the Building Official sends the Notice of Required Inspection by certified mail, to the owner or the association of each building due that calendar year. The notices go out each year, within the dates the page gives. The page counts the time to file from that notice; the time itself is in the rows below.' },
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
      'Hallandale Beach’s Building Division sends the notices and the report goes in through the city’s Self-Service Portal; one team delivers the complete BSIP inspection and report.',
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
      'Deerfield Beach’s Building Division says it follows Board of Rules and Appeals guidelines; the city posts the inspection forms. One team delivers the complete BSIP inspection and report on them.',
    lede:
      'Deerfield Beach has no page of its own for the Building Safety Inspection Program (BSIP). On the city’s site the program appears only as four documents on the Applications and Forms page; how permits are filed, and who handles them, is on the Building Services page. What follows sets out what those pages say, and what they leave to the letter and to the Building Division.',
    local: [
      { k: 'The city’s forms', v: 'The city’s Applications and Forms page lists the Board of Rules and Appeals (BORA) policy for the Building Safety Inspection Report, the Building Safety Inspection guidelines, a structural form and an electrical form. The electrical form carries the Board’s own heading, “Broward County BORA”. For a Deerfield Beach building, the complete BSIP inspection and report we deliver goes on those forms.' },
      { k: 'Filing the report', v: 'Deerfield Beach’s own pages do not say how a BSIP report is filed. What the Building Services page describes is permit filing: new permit applications and plans can be submitted online, through the “Online Permit Submittal” button, and can still be taken in person to the Building Division in City Hall. We confirm with the division how it takes the report before anything is sent.' },
      { k: 'The office', v: 'On its page, the Building Division says it complies with the guidelines of the Florida Building Commission and of the Broward County Board of Rules and Appeals. The same page says CAP Government “will be responsible for performing all duties related to the Florida Building Code”, among them permit applications, plan approvals, inspections and permit close-out; it does not say who reviews a BSIP report.' },
      { k: 'Repairs', v: 'The city’s own pages say nothing specific about repairs under the BSIP. Where a repair needs a permit, Deerfield Beach’s general permit rules come in: the forms page notes that all permit applications in the city require the owner’s signature, and the Building Services page says the DFB HOA Affidavit is required for all residential permits.' },
      { k: 'If it is late', v: 'Deerfield Beach’s own pages do not say what the city does when a BSIP report is late; the time to file is in the county’s rows below. The Building Services page says, in general terms, that the division is responsible for the identification and removal of unsafe structures in conjunction with the Unsafe Structure Board; it does not tie that to this program.' },
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
      'In Pembroke Pines the reports go to the city’s Building Department, in person or through the Development Hub, and one team delivers the complete BSIP inspection and report.',
    lede:
      'In Pembroke Pines the Building Safety Inspection Program (BSIP) goes through the city’s Building Department. A building that comes due is assigned a BSIP permit number; the letter cites it, and the city’s page asks for it again on the cover sheet, to link the Development Hub account and on a repair permit application. Here is what Pembroke Pines’ own pages say, step by step.',
    local: [
      { k: 'The notice', v: 'When a building is due under the program, a BSIP permit number is assigned to the property. The owner listed on the Broward County Property Appraiser website receives a notification letter in the mail that refers to that number. Keep it at hand: Pembroke Pines asks for the number on the cover sheet, to link the online account and on a repair permit application.' },
      { k: 'Filing the report', v: 'Once the inspection reports are ready they go to the Building Department, and the city’s page gives two options: an in-person submittal or an online one. The online option runs through the Development Hub, where you must have an account. The Building Department is in the Charles F. Dodge City Center.' },
      { k: 'In person', v: 'The page’s list of what to bring in person includes a cover sheet — it calls it a Transmittal Letter — showing the BSIP permit number, and the two report forms. It links the forms but no cover sheet. The department’s forms page lists a “Transmittal Letter Sheet” with a line for the permit number; the site never says it is the one meant for the BSIP.' },
      { k: 'The Development Hub', v: 'Pembroke Pines’ page lays out the online steps. With a Development Hub account in place, phone or e-mail the Building Department to have the account linked to the BSIP permit number. Once linked, log in and find the permit in the dashboard or with the search tool. Open it and upload the documents under the “Attachments” tab, each document separately.' },
      { k: 'The city’s forms', v: 'Pembroke Pines’ program page links two report forms: the Structural Safety Inspection Report Form and the Electrical Safety Inspection Report Form. Both files are marked “Broward County BORA”; the page links no edition under the city’s own name. The same two forms are named for the in-person submittal and for the online one.' },
      { k: 'Repairs', v: 'If repairs are required, Pembroke Pines’ page says you apply for the appropriate permit: structural repairs under “Structural Miscellaneous”, electrical repairs under “Electrical Miscellaneous”. The application is the most current Broward County Uniform Building Permit Application, and it shows the BSIP permit number so the repair permit is linked to it. The city’s permit page says permit applications are no longer accepted by e-mail.' },
      { k: 'Plans for the repairs', v: 'For a repair permit submitted in person, the page says all plans must be physically signed and sealed, and that digital signatures are not accepted for in-person submissions. For an online submittal the construction plans are digitally signed and sealed. Online, every required document must be uploaded at the time of submission; nothing more can be uploaded until the review cycle is complete.' },
      { k: 'After filing', v: 'Pembroke Pines’ page says follow-up inspections may be required. After a repair, an updated Safety Inspection Report Form goes to the BSIP permit number once the repair permit is complete; the page requires it to satisfy the program. It does not say who reviews a report, how the owner hears back or how more time is requested — the county’s deadlines are in the rows below.' },
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
      'Miramar’s Building Division issues the BSIP package, and every document is filed through the city’s permitting system. Here, one team delivers the complete BSIP inspection and report.',
    lede:
      'Miramar’s package for the Building Safety Inspection Program (BSIP) carries the letterhead of the Building Division of the City of Miramar Building, Planning & Zoning Department. The program page sets one way to file, the city’s permitting system, and says the review is based solely on the sealed report. Here is what Miramar’s own pages say, subject by subject, and what they leave open.',
    local: [
      { k: 'The notice', v: 'Miramar’s program page says property owners will receive a Notice of Required Inspection; it does not say who sends it or how. If you no longer own the property, it says the Broward County Property Appraiser’s records will be checked and updated if a new owner is listed. If they still list you as owner, you must contact the appraiser directly.' },
      { k: 'Filing the report', v: 'All BSIP documents must be submitted through the City of Miramar permitting system, the program page says, under the permit type BSIP: Residential BSIP or Commercial BSIP. It gives that system no other name; the city’s permitting page calls its online service E-Permitting or Citizen Self Service (CSS Portal). For assistance, the program page gives a BSIP e-mail contact.' },
      { k: 'The city’s forms', v: 'Miramar’s applications and forms page publishes the program’s package, under a title that begins “Recertification / BSIP”. Its cover lists what is attached: information about the program, inspection guidelines, and the structural and electrical report forms. Those are the Broward County Board of Rules and Appeals’ forms; the package also holds the Broward County Uniform Building Permit Application.' },
      { k: 'What goes with it', v: 'Miramar’s program page lists the required documents — a BSIP Submittal Form, the Structural Report, the Electrical Report and supporting documentation, if applicable — and says the reports must be signed and sealed. The page’s FAQ words the list differently — a BSIP Submittal coversheet, a Structural Packet and an Electrical Packet — and adds that the forms must include original signatures.' },
      { k: 'After filing', v: 'No Building Code Inspector comes out, Miramar’s FAQ says: the review is based solely on the sealed report, and the FAQ gives an approximate time for it. Asked whether owners receive written certification, it answers that an accepted file is closed and no notice is issued; it also asks filers to include an e-mail address to receive an approved copy.' },
      { k: 'Repairs', v: 'If deficiencies are identified, Miramar’s page says a status letter must be provided and a final certification report is required after the repairs are completed. No inspector returns: the FAQ says a new sealed report must be submitted. Its list of what to submit asks that “No Repairs Required” be checked; the time allowed for repairs is in the rows below.' },
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
      'Plantation’s Department of Building Safety sends the program’s letter by certified mail and takes every document electronically. One team delivers the complete BSIP inspection and report in Plantation.',
    lede:
      'In Plantation the Building Safety Inspection Program (BSIP) runs through the city’s Department of Building Safety. The department sends a certified letter that carries the assigned Record ID, and it takes every document electronically, through an account on its Accela Citizen Access portal. Its program page is brief: this is what it says, subject by subject, and what it leaves to the letter.',
    local: [
      { k: 'The notice', v: 'The City of Plantation Department of Building Safety sends the letter by certified mail. It may be addressed to the property owner, the association, the management company or a duly authorized representative. It carries the assigned Record ID — the BDCERT number — and tells you what steps to take next. Keep it: the filing steps ask for that number.' },
      { k: 'Filing the report', v: 'All of the program’s required documentation is submitted electronically, and Plantation’s page sets two steps, both required. First, register for an online account on Accela Citizen Access (ACA). Then forward the e-mail that confirms the registration to the program contact the page names, ask to have the account connected to the applicable Recertification record, and include the BDCERT number.' },
      { k: 'The portal account', v: 'Accela Citizen Access manages the city’s records; its home page is titled “Plantation E-Permit Online Portal”. The program page says the request to connect the account is required to access and upload the required documents. The city’s Electronic Plan Review page, written for permits on the same portal, notes that document submission is not supported on mobile devices and that Chrome is the recommended browser.' },
      { k: 'The city’s forms', v: 'Plantation’s program page carries no form of its own. For the complete details and to obtain the required forms, it sends owners to Broward County’s website. So the package for a Plantation building goes on the forms obtained there.' },
      { k: 'What goes with it', v: 'Alongside the Safety Inspection Reports, the page names one more document: the Narrative. Both must be digitally signed and sealed “in order to be validated”, in the page’s words. It lists nothing else for the package; for the complete details it points to Broward County’s website, and the letter sets out the steps to take.' },
      { k: 'Digital signatures', v: 'The city’s Electronic Plan Review page, written for permits, says documents prepared by design professionals must be signed and sealed with a digital signature, that self-signed documents are not accepted and that all files are submitted as PDF files. The city’s Digital Signature Policy adds that modifying a document after it was digitally signed invalidates the signature. Neither one mentions the BSIP.' },
      { k: 'Repairs', v: 'Plantation’s program page says nothing about repairs and gives no time for them; the county’s deadlines are in the rows below. The city’s permit pages give the general rule: a permit is required before the repair of any building structure or part of one, and new applications are accepted in digital format only, through the same ACA portal.' },
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
      'Sunrise’s Building Division takes the Building Safety Inspection Program reports in person or through its Customer Self-Service Portal; one team delivers the complete BSIP inspection and report.',
    lede:
      'In Sunrise the Building Safety Inspection Program (BSIP) goes through the city’s Building Division, which receives the reports. Each year the Broward County Board of Rules and Appeals sends the city the list of buildings that are due, and Sunrise publishes a submittal checklist and an application of its own. What follows comes from those documents, from the city’s pages and from the agendas of Sunrise’s Special Magistrate.',
    local: [
      { k: 'The notice', v: 'The city says the list of buildings due reaches Sunrise each year from the Broward County Board of Rules and Appeals, and that it rests on the construction year in the Broward County Property Appraiser’s records. Cases on the Special Magistrate’s agenda describe a formal notice issued by the Building Official, which sets the deadline.' },
      { k: 'Filing the report', v: 'The reports are submitted to the Building Division, in person or electronically through the city’s Customer Self-Service Portal, which asks for an account to be created first. Sunrise’s checklist asks for one application per building and, on the portal, a separate submission for each.' },
      { k: 'Paper or PDF', v: 'In person, Sunrise’s checklist asks for an original copy of each report with a seal and a wet signature. On the portal, each item of the checklist is a separate file in unprotected PDF and each report is digitally signed and sealed; a report the city’s Plans Examiners cannot digitally verify is not accepted.' },
      { k: 'The city’s forms', v: 'Sunrise has its own application for the program and asks that it be completely filled out, including the tracking number from the notification. The reports themselves go on the current Building Safety Inspection Report forms, which the city says can be downloaded from the county’s website. Document Central, on the city’s site, also lists a structural and an electrical BSIP inspection form.' },
      { k: 'What goes with it', v: 'Sunrise’s application lists two report forms for the package: the structural and the electrical. The checklist asks that each be completely filled out, with either “No Repairs Required” or “Repairs are Required” checked on its cover page. The application also has a Repairs Required Submittal box, which asks for the permit numbers of the repairs.' },
      { k: 'Repairs', v: 'When either report is marked “Repairs Required”, Sunrise’s plan reviewers decide whether permits are required, based on the repairs the report outlines. Once the permits are obtained and the repairs made, a new report marked “No Repairs Required” is submitted to the city. The city says that once it reviews and accepts that report, the building is in compliance with the program.' },
      { k: 'If it is late', v: 'Enforcement cases in Sunrise are heard before a Special Magistrate, and the hearing agenda has a block for the Building Safety Inspection Program under the Building Division. The properties listed there are described as having exceeded the deadline to comply with the program. The agendas also cite the requirement that the deficiencies found be repaired and re-inspected within a time counted from the report’s date.' },
      { k: 'Older names', v: 'Some older repair cases on one of the Special Magistrate’s agendas still call the report form “40 Year”, a name from the earlier schedule. The program is the one Sunrise now calls the Building Safety Inspection Program, and the ages and days in force are the county’s, in the rows further down.' },
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
      'The Town of Davie Building Division sends the BSIP notices and no longer accepts the reports on paper. One team delivers the complete BSIP inspection and report for your building.',
    lede:
      'In Davie the Building Safety Inspection Program (BSIP) runs through the Town’s Building Division. The Building Official sends the notice by certified mail, and the Town no longer accepts paper copies: its application form goes in through the OAS system, and the reports are then uploaded to Project Dox. This is what the Town’s own pages say, subject by subject; the county’s deadlines are in the rows further down.',
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
];
