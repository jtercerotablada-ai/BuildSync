/**
 * ─────────────────────────────────────────────────────────────────────────────
 * WHERE EACH LINE OF A CITY PAGE WAS READ — a record for whoever re-checks it
 * ─────────────────────────────────────────────────────────────────────────────
 * NOT CONTENT. No page, component or content file imports this module, and
 * none may: its only reader is cities.test.ts. (The same arrangement as
 * office-pages.ts, for the same reason: a city's web address must not travel
 * with a page, linked or not.)
 *
 * For every city page: the office's address and phone, and each row and
 * answer of the ENGLISH page (the Spanish page says the same), with the
 * exact words of the city's own website that it rests on and the address
 * they were read at. Several of these sites refuse scripts (403) and load
 * normally in a browser; every quote here was found again, mechanically, in
 * the text of its page on the day below.
 *
 * TO RE-CHECK a city: open each address in a browser, find the quote, and
 * compare it with the row in cities.en.ts and cities.es.ts. Then move
 * `citiesChecked` and `citiesCheckedISO` in cities.ts.
 */

/** The day every address below was opened and read. */
export const cityPagesRead = '2026-10-09';

export type CityQuote = { page: string; quote: string };

export const citySources: Record<string, { office: CityQuote[]; rows: Record<string, CityQuote[]> }> = {
  'building-recertification/miami': {
    office: [
      { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'You must visit the Unsafe Structures Section -Recertification Division, within the Building Department at: 444 SW 2nd Ave, 1st Floor, Miami, FL 33130' },
      { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Unsafe-Structures-Find-Your-Next-Step', quote: 'Unsafe Structures Customer Service: (305) 416-1177' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'You must visit the Unsafe Structures Section -Recertification Division, within the Building Department at: 444 SW 2nd Ave, 1st Floor, Miami, FL 33130' },
        { page: 'https://www.miami.gov/files/sharedassets/public/v/5/building/structural-recertification-report-template-fillable-2025-v2.0_remediated.pdf', quote: 'BUILDING DEPARTMENT - UNSAFE STRUCTURES' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'The City re-certifies structures to ensure they are safe for use and occupancy, as per the Miami-Dade County Code.' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'To get a building re-certification, you need to hire an architect or engineer to inspect your property.' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'Once the inspection is completed, you will apply and submit your documents online, which means they need to be properly named for our system.' },
      ],
      'heroSub': [
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'You must visit the Unsafe Structures Section -Recertification Division, within the Building Department at: 444 SW 2nd Ave, 1st Floor, Miami, FL 33130' },
        { page: 'https://www.miami.gov/files/sharedassets/public/v/5/building/structural-recertification-report-template-fillable-2025-v2.0_remediated.pdf', quote: 'BUILDING DEPARTMENT - UNSAFE STRUCTURES' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'The City re-certifies structures to ensure they are safe for use and occupancy, as per the Miami-Dade County Code.' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'Once the inspection is completed, you will apply and submit your documents online, which means they need to be properly named for our system.' },
        { page: 'https://www.miami.gov/files/sharedassets/public/v/5/building/structural-recertification-report-template-fillable-2025-v2.0_remediated.pdf', quote: 'BUILDING RECERTIFICATION INSPECTION REPORT FORM - STRUCTURAL' },
      ],
      'local 1: The notice': [
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'Did you receive a notification stating your building is due for recertification?' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: '(you will have received a letter about this)' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'If your building is due for recertification (you will have received a letter about this), you will see an option for "Architect/Engineer (Building Recertification)." If your building is not due, this option will not show.' },
      ],
      'local 2: Filing the report': [
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'Once the inspection is completed, you will apply and submit your documents online, which means they need to be properly named for our system.' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'You will need to create an account in iBuild. Make sure to use the email of the person who is going to upload the reports throughout the entire process. (Only one email address can be used for this entire process).' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'Go to Start application -- Select Building Permit Application' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'If your building is due for recertification (you will have received a letter about this), you will see an option for "Architect/Engineer (Building Recertification)." If your building is not due, this option will not show.' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'You will receive an email from ePlan/ProjectDox instructing you to log in. This will connect your account with your application.' },
        { page: 'https://www.miami.gov/Permits-Construction/Digital-Permitting/Standard-Naming-Convention-for-Drawings-Documents', quote: 'To ensure consistency and efficiency in the ePlan Review process, all files uploaded to ProjectDox must follow strict naming and formatting standards. Improperly named files may be rejected during Prescreen.' },
      ],
      'local 3: File names': [
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'To upload a report, it is necessary to scan it as a PDF format and Report must be saved in Pdf format within City of Miami Standard Naming Convention which are the following if a professional do both reports:' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'RC-S (for the structural report)' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'RC-E (for the electrical report, illumination letter and thermography report)' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'RC-C (for cover letters)' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'RC-PHO (for photos)' },
        { page: 'https://www.miami.gov/Permits-Construction/Digital-Permitting/Standard-Naming-Convention-for-Drawings-Documents', quote: 'To ensure consistency and efficiency in the ePlan Review process, all files uploaded to ProjectDox must follow strict naming and formatting standards. Improperly named files may be rejected during Prescreen.' },
      ],
      'local 4: The city’s forms': [
        { page: 'https://www.miami.gov/files/sharedassets/public/v/5/building/structural-recertification-report-template-fillable-2025-v2.0_remediated.pdf', quote: 'BUILDING RECERTIFICATION INSPECTION REPORT FORM - STRUCTURAL' },
        { page: 'https://www.miami.gov/files/sharedassets/public/v/5/building/structural-recertification-report-template-fillable-2025-v2.0_remediated.pdf', quote: 'BUILDING DEPARTMENT - UNSAFE STRUCTURES' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'Below, are the required documents your architect/engineer will need to complete.' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'TIP: These forms outline the minimum requirements needed. Your architect or engineer may want to include more.' },
      ],
      'local 5: What goes with it': [
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'NOTE: You will also need a Parking Lot Illumination Certificate (if applicable) and a cover letter signed, sealed, and dated by the professional engineer or architect with their recommendation.' },
        { page: 'https://www.miami.gov/files/sharedassets/public/v/2/planning/cert-of-compliance-parking-lot-illumination_remediated.pdf', quote: 'CERTIFICATION OF COMPLIANCE WITH PARKING LOT ILLUMINATION' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'If your documents are going to be digitally signed by a professional, they must use one of these digital signature providers.' },
      ],
      'local 6: After filing': [
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'You will either receive a letter stating your re-certification is complete or a notice with necessary changes within six weeks.' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'Applicant resubmit Task' },
      ],
      'local 7: Repairs': [
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'NOTE: You must submit the report available below before starting any repairs.' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'If repairs are needed, proper permitting procedures must be followed before the building can be re-certified.' },
        { page: 'https://www.miami.gov/files/sharedassets/public/v/5/building/structural-recertification-report-template-fillable-2025-v2.0_remediated.pdf', quote: 'Initial Inspection Report Amended Inspection Report after completion of repairs' },
      ],
      'local 8: If it is late': [
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'NOTE: If you\'re building is OVERDUE for recertification, you cannot do this process online.' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'You must visit the Unsafe Structures Section -Recertification Division, within the Building Department at: 444 SW 2nd Ave, 1st Floor, Miami, FL 33130' },
      ],
      'faq 1': [
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'Once the inspection is completed, you will apply and submit your documents online, which means they need to be properly named for our system.' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'You will need to create an account in iBuild. Make sure to use the email of the person who is going to upload the reports throughout the entire process. (Only one email address can be used for this entire process).' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'Go to Start application -- Select Building Permit Application' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'This is who will receive the link for uploading documents - no one else will receive this link.' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'You will receive an email from ePlan/ProjectDox instructing you to log in. This will connect your account with your application.' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'NOTE: If you\'re building is OVERDUE for recertification, you cannot do this process online.' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'You must visit the Unsafe Structures Section -Recertification Division, within the Building Department at: 444 SW 2nd Ave, 1st Floor, Miami, FL 33130' },
        { page: 'https://www.miami.gov/Permits-Construction/Digital-Permitting/Standard-Naming-Convention-for-Drawings-Documents', quote: 'To ensure consistency and efficiency in the ePlan Review process, all files uploaded to ProjectDox must follow strict naming and formatting standards. Improperly named files may be rejected during Prescreen.' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'Below, are the required documents your architect/engineer will need to complete.' },
      ],
      'faq 2': [
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'Your request for a ONE-TIME extension must be received before the recertification due date.' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'You may request an extension via email. Include the full property address and send to buildingrecertifications@miamigov.com.' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'You will hear back within four weeks.' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Unsafe-Structures-Find-Your-Next-Step', quote: 'Recertifications: Buildingrecertifications@miamigov.com' },
      ],
      'faq 3': [
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Appeal-an-Unsafe-Structures-Violation', quote: 'Did you receive a violation from Unsafe Structures, such as work without permit, 40/50 year recertification, or unsafe violation, and you would like to appeal?' },
        { page: 'https://www.miami.gov/files/assets/public/v/1/document-resources/pdf-docs/building/unsafe-structures/resources/unsafe-structures-public-information-guide-final_508.pdf', quote: '3. Recertification – First Impression Evidentiary Hearing' },
        { page: 'https://www.miami.gov/files/assets/public/v/1/document-resources/pdf-docs/building/unsafe-structures/resources/unsafe-structures-public-information-guide-final_508.pdf', quote: 'may provide time to comply or require demolition.' },
      ],
      'faq 4': [
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'Single-family homes, duplexes, or structures that are 2,000 square feet or less and have an occupancy load of ten or less are exempt from recertification.' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'If you feel you are exempt, please request an exemption via email by sending the full property address and your reasoning to buildingrecertifications@miamigov.com.' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'You will hear back within four weeks.' },
      ],
      'faq 5': [
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Appeal-an-Unsafe-Structures-Violation', quote: 'Did you receive a violation from Unsafe Structures, such as work without permit, 40/50 year recertification, or unsafe violation, and you would like to appeal?' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'The City re-certifies structures to ensure they are safe for use and occupancy, as per the Miami-Dade County Code.' },
      ],
      'nextStep': [
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: '(you will have received a letter about this)' },
        { page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification', quote: 'You must visit the Unsafe Structures Section -Recertification Division, within the Building Department at: 444 SW 2nd Ave, 1st Floor, Miami, FL 33130' },
      ],
    },
  },
  'building-recertification/miami-beach': {
    office: [
      { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: '1700 Convention Center Drive, Second Floor' },
      { page: 'https://www.miamibeachfl.gov/city-hall/building/building-recert/', quote: 'Please contact our existing Building Recertification team at 305.673.7610 and select the option for Building Recertification.' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'Two (2) years prior to the recertification due date, the Miami Beach Building Department posts a notice on site.' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'This recertification package includes a notice requesting the owner or owner’s representative to hire a Florida licensed design professional to perform an Electrical and Structural inspection for the building/structure and file a signed and sealed report with the Recertification Section for review and approval.' },
        { page: 'https://www.miamibeachfl.gov/city-hall/building/building-recert/', quote: 'Can be submitted via the Citizen Self Service (CSS) portal or emailed to BuildingRecertification@MiamiBeachfl.gov.' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'The report will be routed to the Chief Structural Engineer and Chief Electrical Inspector for review.' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'After Structural and Electrical approval, the Recertification requested will be sent to the Building Official for final approval.' },
      ],
      'heroSub': [
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'Two (2) years prior to the recertification due date, the Miami Beach Building Department posts a notice on site.' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'This recertification package includes a notice requesting the owner or owner’s representative to hire a Florida licensed design professional to perform an Electrical and Structural inspection for the building/structure and file a signed and sealed report with the Recertification Section for review and approval.' },
        { page: 'https://www.miamibeachfl.gov/city-hall/building/building-recert/', quote: 'A completed inspection report containing both the structural and electrical inspection reports must be submitted to the Building Department.' },
      ],
      'local 1: The notice': [
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'Two (2) years prior to the recertification due date, the Miami Beach Building Department posts a notice on site.' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'Reminders are sent one (1) year prior to the recertification due date as well as a final reminder at 90 days prior to the due date along with a notice posted on site.' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'This recertification package includes a notice requesting the owner or owner’s representative to hire a Florida licensed design professional to perform an Electrical and Structural inspection for the building/structure and file a signed and sealed report with the Recertification Section for review and approval.' },
      ],
      'local 2: Filing the report': [
        { page: 'https://www.miamibeachfl.gov/city-hall/building/building-recert/', quote: 'A completed inspection report containing both the structural and electrical inspection reports must be submitted to the Building Department.' },
        { page: 'https://www.miamibeachfl.gov/city-hall/building/building-recert/', quote: 'Can be submitted via the Citizen Self Service (CSS) portal or emailed to BuildingRecertification@MiamiBeachfl.gov.' },
        { page: 'https://www.miamibeachfl.gov/city-hall/building/building-recert/', quote: 'Please contact our existing Building Recertification team at 305.673.7610 and select the option for Building Recertification. You may also contact us via email at BuildingRecertification@miamibeachfl.gov.' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'Building recertification reports may be submitted digitally via e-mail to buildingrecertification@miamibeachfl.gov these reports should have a third party verifiable digital signature and seal.' },
      ],
      'local 3: In person': [
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'If a report is not digitally signed and sealed, then you may e-mail a scanned copy and submit the original signed and sealed report by mail or in-person appointment at:' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: '1700 Convention Center Drive, Second Floor' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2026/07/Building-SOP-4.16.2025.pdf', quote: 'such as Permit Process, Building Recertification, Violations, and disciplines from the Building,' },
        { page: 'https://www.miamibeachfl.gov/city-hall/building/building-recert/', quote: 'Please contact our existing Building Recertification team at 305.673.7610 and select the option for Building Recertification. You may also contact us via email at BuildingRecertification@miamibeachfl.gov.' },
      ],
      'local 4: The city’s forms': [
        { page: 'https://www.miamibeachfl.gov/city-hall/building/building-recert/', quote: 'Required Building Recertification Reporting Forms:' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2025/02/structural-recertification-form-1.16.2025-Final.pdf', quote: 'MINIMUM INSPECTION PROCEDURAL GUIDELINES FOR BUILDING STRUCTURAL RECERTIFICATION' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2025/02/electrical-recertification-form-1.20.2025.pdf', quote: 'Design Professional to summarize results below. Attach thermography report by certified thermographer.' },
      ],
      'local 5: After filing': [
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'The report will be routed to the Chief Structural Engineer and Chief Electrical Inspector for review.' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'After Structural and Electrical approval, the Recertification requested will be sent to the Building Official for final approval.' },
        { page: 'https://www.miamibeachfl.gov/city-hall/building/building-recert/', quote: 'When the recertification reports have been approved, the Building Official will issue a Building Recertification approval letter. This letter will be sent to the owner and the Professional Engineer and/or Architect of record.' },
      ],
      'local 6: Repairs': [
        { page: 'https://www.miamibeachfl.gov/city-hall/building/building-recert/', quote: 'If there are deficiencies that require permits noted on the initial report, and permits have been obtained and have passed final inspection, the owner must submit an updated report prepared by a Florida licensed design professional.' },
        { page: 'https://www.miamibeachfl.gov/city-hall/building/building-recert/', quote: 'A cover letter is required certifying that the building is structurally and electrically safe for the specified use and occupancy in conformity with the minimum inspection procedure as outlined by County and State law.' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'NOTE: To facilitate expeditious compliance, the building department will fast-track the repair/restoration permits required for the building recertification the building recertification number must be included on the permit application.' },
      ],
      'local 7: Extensions': [
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'A 30-day extension may be granted if the Engineer/Architect inspected the building and determines that it does not pose harm to the occupants, and provides a written statement allowing the continued occupancy, and submits a request for an extension to obtain permits for repairs.' },
      ],
      'local 8: If it is late': [
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'Note: If the engineer or architect report is not submitted to the Building Department in 60 days, then a 30-day reminder (Red- Tag) will be posted on site.' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'If the Recertification Report for a particular building is not submitted within the time limitation (90 days) established by the Miami-Dade County Ordinance, or an extension letter submitted, a building recertification violation will be issued' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'The Notice of Violation will be posted on the building, and pictures of the posting will be taken as proof of delivery.' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'After the posting of the Notice of Violation, a copy will be sent certifiedmail to the owner or owner’s representative.' },
      ],
      'faq 1': [
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'Two (2) years prior to the recertification due date, the Miami Beach Building Department posts a notice on site.' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'Miami Dade County provides a list of the buildings that require recertification. This list is reviewed prior to sending out notices of recertification.' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'This recertification package includes a notice requesting the owner or owner’s representative to hire a Florida licensed design professional to perform an Electrical and Structural inspection for the building/structure and file a signed and sealed report with the Recertification Section for review and approval.' },
      ],
      'faq 2': [
        { page: 'https://www.miamibeachfl.gov/city-hall/building/building-recert/', quote: 'In the drop-down search box next to “Permit Type”, select “Existing Building Recertification”.' },
      ],
      'faq 3': [
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'Building recertification cannot be approved if the property has open building violations and open or expired permits.' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'the recertification reports are approved, a Letter of Building Recertification is issued.' },
      ],
      'faq 4': [
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'If the Recertification Report for a particular building is not submitted within the time limitation (90 days) established by the Miami-Dade County Ordinance, or an extension letter submitted, a building recertification violation will be issued' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'Failure to comply with the requirements of the Building Recertification Violation within 30 days’ notice, the Building Recertification Violation will be forwarded to Miami Beach’s Special Master.' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'the case being escalated to the Miami-Dade County Unsafe Structure Board (USB) and may result in an order for demolition of the structure and the need to vacate the building.' },
        { page: 'https://www.miamibeachfl.gov/city-hall/building/violations/', quote: 'Please be notified that starting on May 2, 2024, all Special Magistrate hearings will take place in person at the Third Floor Commission Chamber in City Hall.' },
      ],
      'faq 5': [
        { page: 'https://www.miamibeachfl.gov/city-hall/building/building-recert/', quote: 'Need info on your mandatory annual maintenance log?' },
        { page: 'https://www.miamibeachfl.gov/city-hall/building/building-recert/annual-maintenance-log/', quote: 'Effective January 2, 2024 building owners shall submit by the deadlines corresponding with their building address, as follows:' },
        { page: 'https://www.miamibeachfl.gov/city-hall/building/building-recert/annual-maintenance-log/', quote: 'Logs should be submitted on the Citizen Self Service portal(CSS) at www.mbselfservice.com. Search for the Annual Maintenance Log application under the Apply section.' },
        { page: 'https://www.miamibeachfl.gov/city-hall/building/building-recert/annual-maintenance-log/', quote: 'Building owners of buildings less than five floors are not required to submit a yearly maintenance log on all routine structural repairs.' },
      ],
      'nextStep': [
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'Two (2) years prior to the recertification due date, the Miami Beach Building Department posts a notice on site.' },
        { page: 'https://www.miamibeachfl.gov/wp-content/uploads/2022/07/Existing-Building-Recertification-SOP-7.21.2022.pdf', quote: 'This recertification package includes a notice requesting the owner or owner’s representative to hire a Florida licensed design professional to perform an Electrical and Structural inspection for the building/structure and file a signed and sealed report with the Recertification Section for review and approval.' },
      ],
    },
  },
  'building-recertification/hialeah': {
    office: [
      { page: 'https://www.hialeahfl.gov/682/Contact-Us', quote: '501 Palm Avenue, 2nd Floor' },
      { page: 'https://www.hialeahfl.gov/682/Contact-Us', quote: 'Main Line: 305-883-5825' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms', quote: 'The Building Division mails letters to property owners whose buildings are due for re-certification each year.' },
        { page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms', quote: 'Required Forms and Guidelines/Electronic Affidavit' },
        { page: 'https://www.hialeahfl.gov/154/Building-Department', quote: 'Oversee Building Recertifications and Unsafe Structures.' },
      ],
      'heroSub': [
        { page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms', quote: 'The Building Division mails letters to property owners whose buildings are due for re-certification each year.' },
        { page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms', quote: 'Required Forms and Guidelines/Electronic Affidavit' },
      ],
      'local 1: The notice': [
        { page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms', quote: 'The Building Division mails letters to property owners whose buildings are due for re-certification each year.' },
        { page: 'https://www.hialeahfl.gov/DocumentCenter/View/20323/Structural-Recertification-Report-Template-FILLABLEpdf', quote: 'a. Date of Notice of Required Inspection:' },
      ],
      'local 2: The city’s forms': [
        { page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms', quote: 'Required Forms and Guidelines/Electronic Affidavit' },
        { page: 'https://www.hialeahfl.gov/DocumentCenter/View/20323/Structural-Recertification-Report-Template-FILLABLEpdf', quote: 'COH Building Recertification Structural Report Page 1 of 16' },
        { page: 'https://www.hialeahfl.gov/DocumentCenter/View/20320/Electrical-Recertification-Report-Template-FILLABLEpdf', quote: 'COH Building Recertification Electrical Report Page 1 of 10' },
        { page: 'https://www.hialeahfl.gov/DocumentCenter/View/14561/40-Year-General-Considerations--Guidelinespdf', quote: 'BORA Approved – Revised November 18, 2021' },
      ],
      'local 3: What goes with them': [
        { page: 'https://www.hialeahfl.gov/DocumentCenter/View/14564/Recertification-Letter-of-Compliance-Template-Sample--PDFpdf', quote: 'Letter of Compliance of a 40-Year Old or Older Building' },
        { page: 'https://www.hialeahfl.gov/DocumentCenter/View/14564/Recertification-Letter-of-Compliance-Template-Sample--PDFpdf', quote: 'building is structurally and electrically safe for continued use under present occupancy.' },
        { page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms', quote: 'Parking Lot Guardrails Affidavit.pdf' },
      ],
      'local 4: Electronic filing': [
        { page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms', quote: 'Affidavit Authorizing Electronic Submittal for Architect-Engineer' },
        { page: 'https://www.hialeahfl.gov/DocumentCenter/View/12647/Affidavit-Authorizing-Electronic-Submittal-for-Architect-Engineer', quote: 'authorize the electronic submittal of plans and construction documents in lieu of hardcopy signed and sealed plans' },
      ],
      'local 5: Repairs': [
        { page: 'https://www.hialeahfl.gov/DocumentCenter/View/20323/Structural-Recertification-Report-Template-FILLABLEpdf', quote: 'Initial Inspection Report Amended Inspection Report after completion of repairs' },
        { page: 'https://www.hialeahfl.gov/DocumentCenter/View/20323/Structural-Recertification-Report-Template-FILLABLEpdf', quote: 'f. Can the building continue to be occupied while recertification and repairs are ongoing? (YES/NO):' },
      ],
      'local 6: If it is late': [
        { page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms', quote: 'If the report is not submitted within the allotted time, the structure will be deemed unsafe and non-compliant in accordance with the Miami-Dade County Code.' },
        { page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms', quote: 'Non-compliance with the recertification requirement will result in a hearing with the City\'s Special Magistrate as well as other penalties outlined in the Code.' },
        { page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms', quote: 'The Certificate of Occupancy for the building may also be revoked.' },
      ],
      'local 7: Older names': [
        { page: 'https://www.hialeahfl.gov/DocumentCenter/View/14564/Recertification-Letter-of-Compliance-Template-Sample--PDFpdf', quote: 'Letter of Compliance of a 40-Year Old or Older Building' },
        { page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms', quote: 'Pursuant to Section 8-11(f) of the Miami-Dade County Code, the owner of any building that has been in existence for 30 years or longer is required to have the building inspected to assess the general condition of the structural elements and its electrical systems.' },
      ],
      'faq 1': [
        { page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms', quote: 'The Building Division mails letters to property owners whose buildings are due for re-certification each year.' },
        { page: 'https://www.hialeahfl.gov/154/Building-Department', quote: 'Oversee Building Recertifications and Unsafe Structures.' },
      ],
      'faq 2': [
        { page: 'https://www.hialeahfl.gov/DocumentCenter/View/20323/Structural-Recertification-Report-Template-FILLABLEpdf', quote: 'COH Building Recertification Structural Report Page 1 of 16' },
        { page: 'https://www.hialeahfl.gov/DocumentCenter/View/20320/Electrical-Recertification-Report-Template-FILLABLEpdf', quote: 'COH Building Recertification Electrical Report Page 1 of 10' },
        { page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms', quote: 'Parking Lot Guardrails Affidavit.pdf' },
        { page: 'https://www.hialeahfl.gov/DocumentCenter/View/14564/Recertification-Letter-of-Compliance-Template-Sample--PDFpdf', quote: 'Letter of Compliance of a 40-Year Old or Older Building' },
      ],
      'faq 3': [
        { page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms', quote: 'If the report is not submitted within the allotted time, the structure will be deemed unsafe and non-compliant in accordance with the Miami-Dade County Code.' },
        { page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms', quote: 'Non-compliance with the recertification requirement will result in a hearing with the City\'s Special Magistrate as well as other penalties outlined in the Code.' },
        { page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms', quote: 'The Certificate of Occupancy for the building may also be revoked.' },
      ],
      'faq 4': [
        { page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms', quote: 'If the report is not submitted within the allotted time, the structure will be deemed unsafe and non-compliant in accordance with the Miami-Dade County Code.' },
      ],
      'faq 5': [
        { page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms', quote: 'Pursuant to Section 8-11(f) of the Miami-Dade County Code, the owner of any building that has been in existence for 30 years or longer is required to have the building inspected to assess the general condition of the structural elements and its electrical systems.' },
        { page: 'https://www.hialeahfl.gov/DocumentCenter/View/14564/Recertification-Letter-of-Compliance-Template-Sample--PDFpdf', quote: 'Letter of Compliance of a 40-Year Old or Older Building' },
        { page: 'https://www.hialeahfl.gov/154/Building-Department', quote: 'Oversee Building Recertifications and Unsafe Structures.' },
      ],
      'nextStep': [
        { page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms', quote: 'The Building Division mails letters to property owners whose buildings are due for re-certification each year.' },
      ],
    },
  },
  'building-recertification/coral-gables': {
    office: [
      { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: '427 Biltmore Way' },
      { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: '305-460-5229' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'The City of Coral Gables Building Division mails Notices of Required Recertification to owners of applicable buildings that have been in existence for 30 years or longer.' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'Miami-Dade report templates must be completed and uploaded electronically to the City’s permitting web portal.' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'Miami-Dade report templates must be completed and uploaded electronically to the City’s permitting web portal.' },
        { page: 'https://www.coralgables.com/media/4228', quote: 'The submittal shall be uploaded to our City of Coral Gables Website and follow the Electronic Submittal Guide' },
      ],
      'heroSub': [
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'The City of Coral Gables Building Division mails Notices of Required Recertification to owners of applicable buildings that have been in existence for 30 years or longer.' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'Miami-Dade report templates must be completed and uploaded electronically to the City’s permitting web portal.' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'Miami-Dade report templates must be completed and uploaded electronically to the City’s permitting web portal.' },
      ],
      'local 1: The notice': [
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'The City of Coral Gables Building Division mails Notices of Required Recertification to owners of applicable buildings that have been in existence for 30 years or longer.' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'One- and Two-year Courtesy Notices of Required Recertification will also be mailed to property owners so they can prepare for the upcoming Building Recertification process.' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'City properties required to recertify in:' },
      ],
      'local 2: Filing the report': [
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'Upon receipt of the City\'s Recertification Notice, the property owner will have 90 days to submit a completed Recertification Report to the Building Official' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'Miami-Dade report templates must be completed and uploaded electronically to the City’s permitting web portal.' },
        { page: 'https://www.coralgables.com/media/4228', quote: 'The submittal shall be uploaded to our City of Coral Gables Website and follow the Electronic Submittal Guide' },
        { page: 'https://www.coralgables.com/department/development-services/electronic-submittal-guide', quote: 'Digital signing and sealing of drawings and documents requires the use of PDF software with a Digital ID installed from the following trusted agencies:' },
        { page: 'https://www.coralgables.com/department/development-services/electronic-submittal-guide', quote: 'All drawings and supporting documents in the plan package must be in PDF format.' },
      ],
      'local 3: The city’s forms': [
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'Miami-Dade report templates must be completed and uploaded electronically to the City’s permitting web portal.' },
        { page: 'https://www.coralgables.com/media/4228', quote: 'Miami-Dade County forms: Structural Recertification, Building Photos, Electrical Recertification' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'For guidelines in preparing a Recertification Report: structural component, and electrical component.' },
      ],
      'local 4: What goes with it': [
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'A completed Report includes the Building Structural Recertification Report, Building Electrical Recertification Report, Certification of Compliance with Parking Lot Guardrails Requirements Form, Certification of Compliance with Parking Lot Illumination Standards Form' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'cover letter(s) from the architect or engineer certifying the electrical system and building structure are safe for intended use and occupancy' },
      ],
      'local 5: Additional files': [
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'If there is more than one building on the property, submit a site plan or copy of a survey showing the location of each building.' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'The structure which is the subject of the Recertification Report must be clearly identified on the site plan or survey submitted.' },
        { page: 'https://www.coralgables.com/media/4228', quote: 'Additional files, if applicable: Infrared Thermography inspection (for 400 amps or grater)' },
        { page: 'https://www.coralgables.com/media/4228', quote: 'Preliminary Inspection Report, Request for time extension' },
        { page: 'https://www.coralgables.com/media/4228', quote: 'Preliminary Inspection Report, Request for time extension' },
      ],
      'local 6: After filing': [
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'Once the structure is in compliance, the City will issue a Building Recertification letter and recertification will be required every 10 years thereafter.' },
        { page: 'https://www.coralgables.com/department/development-services/development-services-faq', quote: 'Reviewer comments are posted in the Citizen Self Service (CSS) Portal under your permit record in the Reviews section. Corrections are also emailed to you directly.' },
        { page: 'https://www.coralgables.com/media/4228', quote: 'The submittal shall be uploaded to our City of Coral Gables Website and follow the Electronic Submittal Guide' },
        { page: 'https://www.coralgables.com/department/development-services/electronic-submittal-guide', quote: 'There will be a “Resubmit” button under the document that is being requested to upload (see image below). This will take you to the Corrections wizard.' },
        { page: 'https://www.coralgables.com/department/development-services/electronic-submittal-guide', quote: 'Provide narrative for corrections.' },
      ],
      'local 7: Extensions': [
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'The Building Official may grant extensions for good cause, provided applicable affidavits are accepted stating that the building can continue to be occupied while undergoing recertification or waiting for a permit or repairs.' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'The Building Official may grant extensions for good cause, provided applicable affidavits are accepted stating that the building can continue to be occupied while undergoing recertification or waiting for a permit or repairs.' },
      ],
      'local 8: If it is late': [
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'If the report is not submitted within the allotted time, the structure will be deemed unsafe and non-compliant in accordance with the Miami-Dade County Code.' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'Non-compliance with recertifying the structure will result in a hearing with the City\'s Construction Regulation Board' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'The Certificate of Occupancy of the building may also be revoked and the Building Official may order that utilities be disconnected.' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'The Certificate of Occupancy of the building may also be revoked and the Building Official may order that utilities be disconnected.' },
      ],
      'faq 1': [
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'One- and Two-year Courtesy Notices of Required Recertification will also be mailed to property owners so they can prepare for the upcoming Building Recertification process.' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'Upon receipt of the City\'s Recertification Notice, the property owner will have 90 days to submit a completed Recertification Report to the Building Official' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'The City of Coral Gables Building Division mails Notices of Required Recertification to owners of applicable buildings that have been in existence for 30 years or longer.' },
      ],
      'faq 2': [
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'Miami-Dade report templates must be completed and uploaded electronically to the City’s permitting web portal.' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'There is no application required to submit the completed Report.' },
        { page: 'https://www.coralgables.com/media/4228', quote: 'Apply for: Building Recertification – Recertification' },
        { page: 'https://www.coralgables.com/department/development-services/development-services-faq', quote: 'Your permit status is available 24/7 through the Citizen Self Service (CSS) Portal.' },
      ],
      'faq 3': [
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'Upon receipt of the City\'s Recertification Notice, the property owner will have 90 days to submit a completed Recertification Report to the Building Official' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'The Building Official may grant extensions for good cause, provided applicable affidavits are accepted stating that the building can continue to be occupied while undergoing recertification or waiting for a permit or repairs.' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'The Building Official may grant extensions for good cause, provided applicable affidavits are accepted stating that the building can continue to be occupied while undergoing recertification or waiting for a permit or repairs.' },
      ],
      'faq 4': [
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'The only structures exempt from this requirement are single family residences, duplexes and minor structures.' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'Sect. 8-11(f)(iii) of the Miami-Dade County Code clarifies that minor structures are those structures in any occupancy group having an occupant load of 10 or less, as determined by Table 1003.1 (FBC) Minimum Occupant Load of the Florida Building Code and having a gross area of 2,000 sq. ft. or less.' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'The City of Coral Gables Building Division mails Notices of Required Recertification to owners of applicable buildings that have been in existence for 30 years or longer.' },
      ],
      'faq 5': [
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'If the report is not submitted within the allotted time, the structure will be deemed unsafe and non-compliant in accordance with the Miami-Dade County Code.' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'Non-compliance with recertifying the structure will result in a hearing with the City\'s Construction Regulation Board' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'The Certificate of Occupancy of the building may also be revoked and the Building Official may order that utilities be disconnected.' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'The Certificate of Occupancy of the building may also be revoked and the Building Official may order that utilities be disconnected.' },
      ],
      'nextStep': [
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'The City of Coral Gables Building Division mails Notices of Required Recertification to owners of applicable buildings that have been in existence for 30 years or longer.' },
        { page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification', quote: 'One- and Two-year Courtesy Notices of Required Recertification will also be mailed to property owners so they can prepare for the upcoming Building Recertification process.' },
      ],
    },
  },
  'building-recertification/doral': {
    office: [
      { page: 'https://www.cityofdoral.com/Departments/Building-Department', quote: 'Building Department 8401 NW 53rd Terrace 33166' },
      { page: 'https://www.cityofdoral.com/Departments/Building-Department/Permit-Submittal-Guidelines', quote: 'please contact, the City of Doral Building Department by phone: 305-593-6700' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Directory', quote: 'Please click on Building Recertification page for more information about the program. For more specific questions or concerns, please email BDRecert@cityofdoral.com.' },
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'BD-30A 05/25 v2 (Former 40-year Building Recertification Program)' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'In addition to local ordinances, the city follows and enforces the Code of Miami-Dade County as well as Florida Statutes F.S. 553.899.' },
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'Miami-Dade County Document Templates accepted.' },
      ],
      'heroSub': [
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Directory', quote: 'Please click on Building Recertification page for more information about the program. For more specific questions or concerns, please email BDRecert@cityofdoral.com.' },
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'The Completed Recertification Certifications reports can be submitted in person, please visit the solution center' },
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'located on the second Floor of Doral City Hall, 8401 NW 53' },
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'Please create a contact in the permitting system at www.cityofdoral.com/permitting.' },
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'Miami-Dade County Document Templates accepted.' },
      ],
      'local 1: The notice': [
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'For those properties that require certification, the property owners receive a Notice of Required Recertification to commence the process.' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'A record will be created in the city’s permitting system.' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'All users should follow guidance on the Videos & Tutorials page for setting up a permitting portal account.' },
      ],
      'local 2: Filing the report': [
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'The Completed Recertification Certifications reports can be submitted in person, please visit the solution center' },
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'located on the second Floor of Doral City Hall, 8401 NW 53' },
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'Please create a contact in the permitting system at www.cityofdoral.com/permitting.' },
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'In the search bar, type Building Recertification – select apply.' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Videos-and-Tutorial-Guides', quote: 'Citizen Self-Service (CSS) Login Issues, User Names' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'The online permitting system will accept 10-year “renewal” recertification reports AFTER initial recertification. Do NOT apply for initial Building Milestone recertification through this work class.' },
      ],
      'local 3: Digital or paper': [
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'Each page of the electrical and structural report must be signed and sealed by the engineer or architect, unless submitted electronically using a verifiable digital signature.' },
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'Important: Digital signatures can only be transmitted electronically. Wet/hard seal must be submitted in person' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'BEFORE the Architect or Engineer signs/certifies the document, SAVE the file as a PDF Document using Printer: “Microsoft Print to PDF”.' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'Once saved, the design professional can now apply their electronic signature and upload the completed, unlocked, report to the permitting portal.' },
      ],
      'local 4: The city’s forms': [
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'Miami-Dade County Document Templates accepted.' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'Miami Dade Templates & Forms Available: https://www.miamidade.gov/global/economy/building/recertification.page' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'Approved by the Board of Rules and Appeals (BORA), the updated guidelines and report templates have been revised.' },
      ],
      'local 5: What goes with it': [
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'Structural Cover Letter Signed, Sealed, and dated by the Professional Engineer or Architect with their' },
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'Electrical Cover Letter Signed, Sealed and dated by the Professional Engineer or Architect with their' },
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'Thermographic Inspection shall be required for an electrical service rating of 400 amperes or higher.' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'In addition, if there is more than one building on the property, a site plan or copy of a survey showing the location of each building must be submitted.' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'The building that is the subject of the Recertification report must be clearly identified on the site plan or survey submitted.' },
      ],
      'local 6: Extensions': [
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'Please note that per Florida Statute & the Florida Building Code, a one-time extension of 60-days is permissible as long as the building is safe to occupy.' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'Signed and sealed letters from the professional of record may be submitted to BuildingOfficial@cityofdoral.com.' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'Confirm building is safe to occupy while final report is issued' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'Address / Folio & Building Number if applicable' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'Building Year Built or Certificate of Occupancy (CO) Date' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'Kindly submit a letter to request 60-days from the anniversary date (if your due date was 12/31/24, you may be granted an extension to March 1, 2025).' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'If repairs are needed, indicate same' },
      ],
      'local 7: If it is late': [
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'Expired processes or buildings that have failed to be recertified will be referred to code compliance for immediate action.' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'In addition to local ordinances, the city follows and enforces the Code of Miami-Dade County as well as Florida Statutes F.S. 553.899.' },
      ],
      'local 8: Older names': [
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'BD-30A 05/25 v2 (Former 40-year Building Recertification Program)' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Directory', quote: '(former 40-year Building Recertification Program)' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Videos-and-Tutorial-Guides', quote: 'When the building or structure hits its Recertification Age (as of 2023, this is 30 years old), please come back and visit our Building Milestone page for information and requirements on re-certifying your building for occupancy.' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'Kindly submit a letter to request 60-days from the anniversary date (if your due date was 12/31/24, you may be granted an extension to March 1, 2025).' },
      ],
      'faq 1': [
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'The online permitting system will accept 10-year “renewal” recertification reports AFTER initial recertification. Do NOT apply for initial Building Milestone recertification through this work class.' },
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'Please create a contact in the permitting system at www.cityofdoral.com/permitting.' },
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'In the search bar, type Building Recertification – select apply.' },
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'The Completed Recertification Certifications reports can be submitted in person, please visit the solution center' },
      ],
      'faq 2': [
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'Building Recertification (former 40-Year Recertification) Package – Parking Lot Lighting Requirements' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'Note: Parking Lot Guardrail requirement not required for City of Doral. Applicable to Unincorporated Miami Dade County only.' },
      ],
      'faq 3': [
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'Buildings with 10 occupant load or less and 2,000 square feet or less' },
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'Single-family fee simple residential homes or duplexes' },
        { page: 'https://www.cityofdoral.com/files/assets/city/v/5/departments/building/documents/2025-bd_building-recertification-program-v2.pdf', quote: 'If you feel you are exempt, please request an exemption via email by sending the full property address and you’re reasoning to BDRecert@cityofdoral.com.' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'For more specific questions or concerns, please email BDRecert@cityofdoral.com.' },
      ],
      'faq 4': [
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'IMPORTANT: The Building Recertification Program is now a 30-year/10-year program; your file names and letter body can simply reference “Building Recertification Program” or just “Building Recertification” as well as the ‘BDAD-YYMM-NNNN” number that is assigned to each building, if already in process.' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'For more specific questions or concerns, please email BDRecert@cityofdoral.com.' },
      ],
      'faq 5': [
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'If repairs are needed, indicate same' },
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'Confirm building is safe to occupy while final report is issued' },
      ],
      'nextStep': [
        { page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program', quote: 'For those properties that require certification, the property owners receive a Notice of Required Recertification to commence the process.' },
      ],
    },
  },
  'building-recertification/north-miami': {
    office: [
      { page: 'https://www.northmiamifl.gov/155/Building', quote: '12340 NE 8th Avenue' },
      { page: 'https://www.northmiamifl.gov/155/Building', quote: 'Phone: 305-895-9820' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.northmiamifl.gov/155/Building', quote: 'Provide property owners with inspection services to verify compliance with the Florida Building Code and required standards to protect lives and property in the disciplines of building, roofing, electrical, mechanical, structural, plumbing, re-occupancy inspections, and 30- year recertification.' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'All buildings and structures are covered, except;' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Miami-Dade County Approved forms for Report Submittal' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Building Officer' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Miami-Dade County Building Recertification Webpage for Q&A (Find guidance information, forms, links, Q&A, etc.) www.miamidade.gov/recertification' },
      ],
      'heroSub': [
        { page: 'https://www.northmiamifl.gov/155/Building', quote: 'Provide property owners with inspection services to verify compliance with the Florida Building Code and required standards to protect lives and property in the disciplines of building, roofing, electrical, mechanical, structural, plumbing, re-occupancy inspections, and 30- year recertification.' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Miami-Dade County Approved forms for Report Submittal' },
      ],
      'local 1: The notice': [
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'If a recertification notice is received, it is the owner’s responsibility to request an exemption in writing from the Building Official' },
        { page: 'https://www.northmiamifl.gov/DocumentCenter/View/22326/Recertification-Inspection-Guidelines-Structural-2025-PDF', quote: 'a. Date of Notice of Required Inspection:' },
      ],
      'local 2: Who is exempt': [
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'All buildings and structures are covered, except;' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Single family residences and duplexes; or' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Agricultural exempt buildings; or' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Minor buildings 2,000 square feet or less and having an occupancy load of 10 or less based on the building code classification' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Both conditions must apply (size and occupants)' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Occupancy is based on the potential occupancy load for the use classification in the code' },
      ],
      'local 3: The city’s forms': [
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Miami-Dade County Approved forms for Report Submittal' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Recertification Inspection Guidelines Structural 2025 (PDF)' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Recertification Inspection Guidelines Electrical 2025 (PDF)' },
        { page: 'https://www.northmiamifl.gov/DocumentCenter/View/22326/Recertification-Inspection-Guidelines-Structural-2025-PDF', quote: 'MDC Building Recertification Structural Report' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Recertification of CC Parking Lot- Guardrails (PDF)' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Recertification of CC Parking Lot- Illumination (PDF)' },
      ],
      'local 4: What goes with them': [
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Recertification of CC Parking Lot- Guardrails (PDF)' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Recertification of CC Parking Lot- Illumination (PDF)' },
        { page: 'https://www.northmiamifl.gov/DocumentCenter/View/22329/Recertification-of-CC-Parking-Lot--Guardrails-PDF', quote: 'CERTIFICATION OF COMPLIANCE WITH PARKING LOT GUARDRAILS' },
        { page: 'https://www.northmiamifl.gov/DocumentCenter/View/22328/Recertification-of-CC-Parking-Lot--Illumination-PDF', quote: 'CERTIFICATION OF COMPLIANCE WITH PARKING LOT ILLUMINATION' },
        { page: 'https://www.northmiamifl.gov/DocumentCenter/View/22327/Recertification-Inspection-Guidelines-Electrical-2025-PDF', quote: '15.THERMOGRAPHY INSPECTION RESULTS' },
      ],
      'local 5: Filing the report': [
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Building Officer' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Phone: 305-895-9820 Ext. 18007' },
        { page: 'https://www.northmiamifl.gov/155/Building', quote: 'Phone: 305-895-9820' },
      ],
      'local 6: Repairs': [
        { page: 'https://www.northmiamifl.gov/DocumentCenter/View/22329/Recertification-of-CC-Parking-Lot--Guardrails-PDF', quote: 'advised the property owner that he/she must obtain a permit for the installation of the guardrail and' },
        { page: 'https://www.northmiamifl.gov/1236/Online-Permitting-Guidelines', quote: '** For all other scopes of work, an in-person application is required**' },
      ],
      'local 7: If it is late': [
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Miami-Dade County Building Recertification Webpage for Q&A (Find guidance information, forms, links, Q&A, etc.) www.miamidade.gov/recertification' },
      ],
      'local 8: The program’s name': [
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Miami-Dade County Approved forms for Report Submittal' },
      ],
      'faq 1': [
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Miami-Dade County Approved forms for Report Submittal' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Building Officer' },
      ],
      'faq 2': [
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Miami-Dade County Approved forms for Report Submittal' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Recertification Inspection Guidelines Structural 2025 (PDF)' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Recertification Inspection Guidelines Electrical 2025 (PDF)' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Recertification of CC Parking Lot- Guardrails (PDF)' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Recertification of CC Parking Lot- Illumination (PDF)' },
      ],
      'faq 3': [
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'All buildings and structures are covered, except;' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Single family residences and duplexes; or' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Agricultural exempt buildings; or' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Minor buildings 2,000 square feet or less and having an occupancy load of 10 or less based on the building code classification' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Both conditions must apply (size and occupants)' },
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'If a recertification notice is received, it is the owner’s responsibility to request an exemption in writing from the Building Official' },
      ],
      'faq 4': [
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Miami-Dade County Building Recertification Webpage for Q&A (Find guidance information, forms, links, Q&A, etc.) www.miamidade.gov/recertification' },
      ],
      'faq 5': [
        { page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year', quote: 'Miami-Dade County Approved forms for Report Submittal' },
      ],
      'nextStep': [
        { page: 'https://www.northmiamifl.gov/155/Building', quote: 'Provide property owners with inspection services to verify compliance with the Florida Building Code and required standards to protect lives and property in the disciplines of building, roofing, electrical, mechanical, structural, plumbing, re-occupancy inspections, and 30- year recertification.' },
      ],
    },
  },
  'building-recertification/north-miami-beach': {
    office: [
      { page: 'https://www.citynmb.com/156/Building-Permits', quote: '17050 NE 19th Avenue 1st Floor North Miami Beach, FL 33162' },
      { page: 'https://www.citynmb.com/156/Building-Permits', quote: 'Phone 305-948-2965' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.citynmb.com/DocumentCenter/View/12635/Owner-Notification-and-Repair-Process', quote: 'When a building is due to submit a report for the 40/10 year recertification, the Building Department will send a notice to the Owner or Owner’s representative via certified mail.' },
        { page: 'https://www.citynmb.com/1581/Recertification', quote: 'submit a completed report of the inspection performed to the Governmental Compliance Section in the City of North Miami Beach Building Department for review and approval.' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12635/Owner-Notification-and-Repair-Process', quote: 'When the recertification reports have been approved, the Building Official will issue a Building Recertification approval letter that will be sent to the Owner' },
      ],
      'heroSub': [
        { page: 'https://www.citynmb.com/DocumentCenter/View/12635/Owner-Notification-and-Repair-Process', quote: 'When a building is due to submit a report for the 40/10 year recertification, the Building Department will send a notice to the Owner or Owner’s representative via certified mail.' },
        { page: 'https://www.citynmb.com/1581/Recertification', quote: 'submit a completed report of the inspection performed to the Governmental Compliance Section in the City of North Miami Beach Building Department for review and approval.' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12647/GENERAL-CONSIDERATIONS---GUIDELINES', quote: 'The approved report forms provided must be used, proprietary forms will not be accepted.' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12632/BUILDING-RECERTIFICATION', quote: 'BUILDING RECERTIFICATION INSPECTION REPORT FORM – STRUCTURAL' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12633/ELECTRICAL-RECERTIFICATION', quote: 'NMB Building Recertification Electrical Report' },
      ],
      'local 1: The notice': [
        { page: 'https://www.citynmb.com/DocumentCenter/View/12635/Owner-Notification-and-Repair-Process', quote: 'When a building is due to submit a report for the 40/10 year recertification, the Building Department will send a notice to the Owner or Owner’s representative via certified mail.' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12649/NOTICE-OF-REQUIRE-BUILDING-INSPECTIONpdf', quote: 'For further information, please Contact Beethova Loriston at (305)948-2965 ext 7838 or by email at Beethova.loriston@citynmb.com' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12635/Owner-Notification-and-Repair-Process', quote: 'shall furnish within ninety (90) days of the receipt of the Notification of Building Recertification a complete written report; which has to be submitted to the Building Official.' },
      ],
      'local 2: Filing the report': [
        { page: 'https://www.citynmb.com/1581/Recertification', quote: 'submit a completed report of the inspection performed to the Governmental Compliance Section in the City of North Miami Beach Building Department for review and approval.' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12636/VIOLATION-OF-RECERTIFICATION-PROCESS', quote: 'to the Building Department Engineering Section, certifying that the building is structurally and electrically safe' },
      ],
      'local 3: The city’s forms': [
        { page: 'https://www.citynmb.com/DocumentCenter/View/12632/BUILDING-RECERTIFICATION', quote: 'BUILDING RECERTIFICATION INSPECTION REPORT FORM – STRUCTURAL' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12633/ELECTRICAL-RECERTIFICATION', quote: 'NMB Building Recertification Electrical Report' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12647/GENERAL-CONSIDERATIONS---GUIDELINES', quote: 'The approved report forms provided must be used, proprietary forms will not be accepted.' },
      ],
      'local 4: What goes with them': [
        { page: 'https://www.citynmb.com/DocumentCenter/View/12635/Owner-Notification-and-Repair-Process', quote: 'Report will also include an Illumination Survey for the parking areas.' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12635/Owner-Notification-and-Repair-Process', quote: 'Building Re-certification reports shall bear the impressed seal and signature of the certifying Engineer and or Architect.' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12647/GENERAL-CONSIDERATIONS---GUIDELINES', quote: 'For electrical service systems with service entrance conductors rated at 400 amperes or greater in the aggregate, an infrared thermography inspection with a written report' },
      ],
      'local 5: After filing': [
        { page: 'https://www.citynmb.com/DocumentCenter/View/12635/Owner-Notification-and-Repair-Process', quote: 'When the recertification reports have been approved, the Building Official will issue a Building Recertification approval letter that will be sent to the Owner' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12636/VIOLATION-OF-RECERTIFICATION-PROCESS', quote: 'This letter will be sent to the Owner and the Professional Engineer and/or Architect of record.' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12635/Owner-Notification-and-Repair-Process', quote: 'Retain this letter as proof of approval.' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12647/GENERAL-CONSIDERATIONS---GUIDELINES', quote: 'Recertification reports may be audited, and the subject building may be inspected at the discretion of the Building Official.' },
      ],
      'local 6: Repairs': [
        { page: 'https://www.citynmb.com/DocumentCenter/View/12635/Owner-Notification-and-Repair-Process', quote: 'The Owner of the property must hire a State of Florida Licensed Contractor and obtain permits from the Building Department prior to performing any repairs or modifications.' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12635/Owner-Notification-and-Repair-Process', quote: 'Once all permits receive an approved final inspection from the electrical and/or structural inspectors, the Professional Engineer and/or the Registered Architect of record must submit a signed and sealed report stating that all repairs have been completed and the building is structurally and electrically safe for continued use.' },
      ],
      'local 7: Extensions': [
        { page: 'https://www.citynmb.com/DocumentCenter/View/12647/GENERAL-CONSIDERATIONS---GUIDELINES', quote: 'Additionally, repairs being conducted under a permit will afford additional time to comply with a complete recertification report.' },
      ],
      'local 8: If it is late': [
        { page: 'https://www.citynmb.com/DocumentCenter/View/12635/Owner-Notification-and-Repair-Process', quote: 'Failure to submit the required Building Recertification report within the maximum time limitation of (90 days) will result in the issuance of a Building Violation' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12636/VIOLATION-OF-RECERTIFICATION-PROCESS', quote: 'If the Building Recertification Process is not completed within the maximum time limitation that has been established by the Miami-Dade County Ordinance, a Notice of Violation shall be issued.' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12636/VIOLATION-OF-RECERTIFICATION-PROCESS', quote: 'The Notice of Violation will be posted on the building and mailed to the owner of record via certified mail.' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12636/VIOLATION-OF-RECERTIFICATION-PROCESS', quote: 'If the owner fails to respond to the Violation, the Violation will be referred to the Unsafe Structure Board for a hearing.' },
      ],
      'faq 1': [
        { page: 'https://www.citynmb.com/1581/Recertification', quote: 'submit a completed report of the inspection performed to the Governmental Compliance Section in the City of North Miami Beach Building Department for review and approval.' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12637/WHAT-IS-A-BUILDING-RECERTIFICATION-PDF', quote: 'To initiate this process or for more information about Recertification, contact Beethova Loriston by email Beethova.Loriston@citynmb.com or by phone at 305 948 2965 ext 7838.' },
        { page: 'https://www.citynmb.com/1588/Important-Notice', quote: 'CLIENTS ARE KINDLY REQUESTED TO SIGN INTO OUR Q-LESS SYSTEM BEFORE 3:00 PM IN ORDER TO ENSURE THEY ARE SEEN IN A TIMELY MANNER.' },
      ],
      'faq 2': [
        { page: 'https://www.citynmb.com/1581/Recertification', quote: 'all buildings, except single-family residences, duplexes, and minor structures, which are thirty (30) years or older must be recertified by the Building Official when the structure becomes 30 years old and then every 10 years after the first Recertification.' },
        { page: 'https://www.citynmb.com/1581/Recertification', quote: 'Minor Building are defined as any occupancy group having an occupant load of 10 or less and having a gross area of 2,000 square feet or less.' },
        { page: 'https://www.citynmb.com/1581/Recertification', quote: 'For buildings (condominiums and cooperative associations) 3-stories or taller located 3-miles within the coastline are required to be recertified 25 years and 10 years thereafter.' },
      ],
      'faq 3': [
        { page: 'https://www.citynmb.com/DocumentCenter/View/12635/Owner-Notification-and-Repair-Process', quote: 'Failure to submit the required Building Recertification report within the maximum time limitation of (90 days) will result in the issuance of a Building Violation' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12636/VIOLATION-OF-RECERTIFICATION-PROCESS', quote: 'If the Building Recertification Process is not completed within the maximum time limitation that has been established by the Miami-Dade County Ordinance, a Notice of Violation shall be issued.' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12636/VIOLATION-OF-RECERTIFICATION-PROCESS', quote: 'The Notice of Violation will be posted on the building and mailed to the owner of record via certified mail.' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12649/NOTICE-OF-REQUIRE-BUILDING-INSPECTIONpdf', quote: 'If the building is not recertified within 45 days of the issuance of the Notice of Violation the building shall be declared unsafe and vacated at the building owner’s expense.' },
      ],
      'faq 4': [
        { page: 'https://www.citynmb.com/DocumentCenter/View/12635/Owner-Notification-and-Repair-Process', quote: 'When a building is due to submit a report for the 40/10 year recertification, the Building Department will send a notice to the Owner or Owner’s representative via certified mail.' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12636/VIOLATION-OF-RECERTIFICATION-PROCESS', quote: 'If the Building Recertification Process is not completed within the maximum time limitation that has been established by the Miami-Dade County Ordinance, a Notice of Violation shall be issued.' },
        { page: 'https://www.citynmb.com/1581/Recertification', quote: 'submit a completed report of the inspection performed to the Governmental Compliance Section in the City of North Miami Beach Building Department for review and approval.' },
      ],
      'faq 5': [
        { page: 'https://www.citynmb.com/DocumentCenter/View/12647/GENERAL-CONSIDERATIONS---GUIDELINES', quote: 'Once the initial report is completed it should be immediately submitted to the local jurisdiction for processing, do not proceed to conduct repairs without permits.' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12647/GENERAL-CONSIDERATIONS---GUIDELINES', quote: 'Like a repair process identified by the report, legalizing an unpermitted addition would be a prerequisite to the completion of a successful recertification report.' },
        { page: 'https://www.citynmb.com/DocumentCenter/View/12635/Owner-Notification-and-Repair-Process', quote: 'The Owner of the property must hire a State of Florida Licensed Contractor and obtain permits from the Building Department prior to performing any repairs or modifications.' },
        { page: 'https://www.citynmb.com/1588/Important-Notice', quote: 'AS OF JANUARY 13, 2025, REGISTERED CONTRACTORS WILL BE ABLE TO SUBMIT ONLINE PERMIT APPLICATIONS OF ALL TYPES.' },
      ],
      'nextStep': [
        { page: 'https://www.citynmb.com/DocumentCenter/View/12635/Owner-Notification-and-Repair-Process', quote: 'When a building is due to submit a report for the 40/10 year recertification, the Building Department will send a notice to the Owner or Owner’s representative via certified mail.' },
      ],
    },
  },
  'building-recertification/aventura': {
    office: [
      { page: 'https://www.cityofaventura.com/167/Community-Development', quote: '19200 West Country Club Drive' },
      { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'Phone: 305-466-8937' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'The City of Aventura Building Division administers the Building Recertification Program in accordance with Miami-Dade County requirements.' },
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'Property owners who receive a Notice of Required Building Recertification from the City must have the required inspections performed by a qualified Florida-licensed engineer or architect and submit the required documentation to the City of Aventura' },
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'The City of Aventura utilizes the current Miami-Dade County Building Recertification Guidelines.' },
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'Recertification documents must be submitted electronically to the City of Aventura Building Division through our online application submittal process.' },
        { page: 'https://egov2.cityofaventura.com/Imaging/DocView.aspx?id=318600&dbid=0&repo=CityHall', quote: 'receives the report of a professional engineer or architect (collectively, the "Engineer\'s Report") concerning the structural, electrical, or life safety conditions of a building' },
        { page: 'https://www.cityofaventura.com/DocumentCenter/View/4257/Annual-Structural-Maintenance-Checklist', quote: 'CITY OF AVENTURA ORDINANCE #2023-06 REQUIRES ANNUAL CERTIFICATION THAT A BUILDING’S STRUCTURAL SYSTEMS HAVE BEEN MAINTAINED.' },
      ],
      'heroSub': [
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'The City of Aventura Building Division administers the Building Recertification Program in accordance with Miami-Dade County requirements.' },
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'Recertification documents must be submitted electronically to the City of Aventura Building Division through our online application submittal process.' },
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'The City of Aventura utilizes the current Miami-Dade County Building Recertification Guidelines.' },
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'Minimum Inspection Procedural Guidelines - Structural Recertification' },
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'Minimum Inspection Procedural Guidelines - Electrical Recertification' },
      ],
      'local 1: The notice': [
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'Property owners who receive a Notice of Required Building Recertification from the City must have the required inspections performed by a qualified Florida-licensed engineer or architect and submit the required documentation to the City of Aventura' },
      ],
      'local 2: The city’s forms': [
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'The City of Aventura utilizes the current Miami-Dade County Building Recertification Guidelines.' },
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'Minimum Inspection Procedural Guidelines - Structural Recertification' },
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'Minimum Inspection Procedural Guidelines - Electrical Recertification' },
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'Certification of Compliance with Parking Lot Illumination Standards' },
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'Certification of Compliance with Parking Lot Guardrails Requirements' },
        { page: 'https://www.cityofaventura.com/DocumentCenter/View/58/Building-Recertification-Packet-PDF', quote: 'The approved report forms provided must be used, proprietary forms will not be accepted.' },
      ],
      'local 3: Filing the report': [
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'Recertification documents must be submitted electronically to the City of Aventura Building Division through our online application submittal process.' },
        { page: 'https://www.cityofaventura.com/457/Submit-Application-Instructions', quote: 'Drop your Files in the box or click + Add Files. Make sure you are uploading all the required documentation between 1-5 BATCHES.' },
        { page: 'https://www.cityofaventura.com/457/Submit-Application-Instructions', quote: 'In the “From” section, please enter your email address. This will be the email address to which the ePermits system will send updates.' },
      ],
      'local 4: After filing': [
        { page: 'https://www.cityofaventura.com/457/Submit-Application-Instructions', quote: 'Within 2 working days, you will receive an email from the Building Division E-Permits team. It will confirm that your submittal has been accepted for review or request any additional items needed to start the review.' },
        { page: 'https://www.cityofaventura.com/DocumentCenter/View/58/Building-Recertification-Packet-PDF', quote: 'Recertification reports may be audited, and the subject building may be inspected at the discretion of the Building Official.' },
        { page: 'https://www.cityofaventura.com/DocumentCenter/View/58/Building-Recertification-Packet-PDF', quote: 'The Building Official reserves the right to rescind or revoke an approved recertification report.' },
      ],
      'local 5: Repairs': [
        { page: 'https://www.cityofaventura.com/DocumentCenter/View/58/Building-Recertification-Packet-PDF', quote: 'Once the initial report is completed it should be immediately submitted to the local jurisdiction for processing. Do not proceed to conduct repairs without permits.' },
        { page: 'https://www.cityofaventura.com/DocumentCenter/View/58/Building-Recertification-Packet-PDF', quote: 'Additionally, repairs being conducted under a permit will afford additional time to comply with a complete recertification report.' },
      ],
      'local 6: Engineering reports': [
        { page: 'https://egov2.cityofaventura.com/Imaging/DocView.aspx?id=318600&dbid=0&repo=CityHall', quote: 'who serves as the president (the "President") of a condominium association, homeowners association or cooperative owners association' },
        { page: 'https://egov2.cityofaventura.com/Imaging/DocView.aspx?id=318600&dbid=0&repo=CityHall', quote: 'The duties of this Section shall also apply to any person, firm, corporation or entity serving as a property manager (the "Property Manager") for a Community Association or as a property manager for any apartment complex of more than four (4) units.' },
        { page: 'https://egov2.cityofaventura.com/Imaging/DocView.aspx?id=318600&dbid=0&repo=CityHall', quote: 'receives the report of a professional engineer or architect (collectively, the "Engineer\'s Report") concerning the structural, electrical, or life safety conditions of a building' },
        { page: 'https://egov2.cityofaventura.com/Imaging/DocView.aspx?id=318600&dbid=0&repo=CityHall', quote: 'shall be filed with the City officials listed above within 48 hours of receipt of said Engineer\'s Report by the Responsible Person.' },
        { page: 'https://egov2.cityofaventura.com/Imaging/DocView.aspx?id=318600&dbid=0&repo=CityHall', quote: 'Filing shall be accomplished by hand delivery to the offices of the City\'s chief Building Official and City Manager at the Aventura Government Center and/or by email filing at the following link: engineeringreports@cityofaventura.com or other link provided for this purpose on the City\'s website.' },
        { page: 'https://egov2.cityofaventura.com/Imaging/DocView.aspx?id=318600&dbid=0&repo=CityHall', quote: 'If an Engineer\'s Report is hand delivered, it shall be hand delivered to the offices of the City\'s chief Building Official and City Manager in both digital format and hard copy for compliance with this Section.' },
      ],
      'local 7: Reports posted online': [
        { page: 'https://www.cityofaventura.com/453/Enhanced-Building-Safety-Inspections-Pro', quote: 'The engineering reports available at the link below are being added as they are received as of August 1, 2021.' },
        { page: 'https://www.cityofaventura.com/453/Enhanced-Building-Safety-Inspections-Pro', quote: 'Building recertification documents received prior to that date are maintained by the City’s Building Division and will be added to the online document center systematically over time.' },
        { page: 'https://www.cityofaventura.com/453/Enhanced-Building-Safety-Inspections-Pro', quote: 'If you have questions regarding the status of your building, please contact the Community Development Department.' },
      ],
      'local 8: Annual certification': [
        { page: 'https://www.cityofaventura.com/DocumentCenter/View/4257/Annual-Structural-Maintenance-Checklist', quote: 'CITY OF AVENTURA ORDINANCE #2023-06 REQUIRES ANNUAL CERTIFICATION THAT A BUILDING’S STRUCTURAL SYSTEMS HAVE BEEN MAINTAINED.' },
        { page: 'https://www.cityofaventura.com/453/Enhanced-Building-Safety-Inspections-Pro', quote: 'Annual Structural Maintenance Checklist' },
        { page: 'https://www.cityofaventura.com/DocumentCenter/View/4257/Annual-Structural-Maintenance-Checklist', quote: 'Submit completed form and supporting documents annually by December 15.' },
        { page: 'https://www.cityofaventura.com/DocumentCenter/View/4257/Annual-Structural-Maintenance-Checklist', quote: 'REPAIR OR REPLACEMENT IS NECESSARY. AN ENGINEERING REPORT REGARDING THESE FINDINGS IS ATTACHED.' },
      ],
      'faq 1': [
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'Recertification documents must be submitted electronically to the City of Aventura Building Division through our online application submittal process.' },
        { page: 'https://www.cityofaventura.com/457/Submit-Application-Instructions', quote: 'Drop your Files in the box or click + Add Files. Make sure you are uploading all the required documentation between 1-5 BATCHES.' },
        { page: 'https://www.cityofaventura.com/457/Submit-Application-Instructions', quote: 'In the “From” section, please enter your email address. This will be the email address to which the ePermits system will send updates.' },
      ],
      'faq 2': [
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'The City of Aventura utilizes the current Miami-Dade County Building Recertification Guidelines.' },
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'Minimum Inspection Procedural Guidelines - Structural Recertification' },
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'Minimum Inspection Procedural Guidelines - Electrical Recertification' },
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'Certification of Compliance with Parking Lot Illumination Standards' },
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'Certification of Compliance with Parking Lot Guardrails Requirements' },
        { page: 'https://www.cityofaventura.com/DocumentCenter/View/58/Building-Recertification-Packet-PDF', quote: 'The approved report forms provided must be used, proprietary forms will not be accepted.' },
      ],
      'faq 3': [
        { page: 'https://www.cityofaventura.com/DocumentCenter/View/4257/Annual-Structural-Maintenance-Checklist', quote: 'CITY OF AVENTURA ORDINANCE #2023-06 REQUIRES ANNUAL CERTIFICATION THAT A BUILDING’S STRUCTURAL SYSTEMS HAVE BEEN MAINTAINED.' },
        { page: 'https://www.cityofaventura.com/453/Enhanced-Building-Safety-Inspections-Pro', quote: 'Annual Structural Maintenance Checklist' },
        { page: 'https://www.cityofaventura.com/DocumentCenter/View/4257/Annual-Structural-Maintenance-Checklist', quote: 'EMAIL engineeringreports@cityofaventura.com HAND DELIVERY City of Aventura Government Center 19200 W. Country Club Drive, 4 th Floor' },
        { page: 'https://www.cityofaventura.com/DocumentCenter/View/4257/Annual-Structural-Maintenance-Checklist', quote: 'Hand-delivered submissions must include both a hard copy and digital copy in accordance with Ordinance No. 2023-06' },
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'The City of Aventura Building Division administers the Building Recertification Program in accordance with Miami-Dade County requirements.' },
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'Property owners who receive a Notice of Required Building Recertification from the City must have the required inspections performed by a qualified Florida-licensed engineer or architect and submit the required documentation to the City of Aventura' },
      ],
      'faq 4': [
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'The City of Aventura Building Division administers the Building Recertification Program in accordance with Miami-Dade County requirements.' },
        { page: 'https://www.cityofaventura.com/453/Enhanced-Building-Safety-Inspections-Pro', quote: 'The engineering reports available at the link below are being added as they are received as of August 1, 2021.' },
      ],
      'faq 5': [
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'The City of Aventura Building Division administers the Building Recertification Program in accordance with Miami-Dade County requirements.' },
        { page: 'https://www.cityofaventura.com/DocumentCenter/View/58/Building-Recertification-Packet-PDF', quote: 'Once the initial report is completed it should be immediately submitted to the local jurisdiction for processing. Do not proceed to conduct repairs without permits.' },
        { page: 'https://www.cityofaventura.com/DocumentCenter/View/58/Building-Recertification-Packet-PDF', quote: 'Additionally, repairs being conducted under a permit will afford additional time to comply with a complete recertification report.' },
      ],
      'nextStep': [
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'Property owners who receive a Notice of Required Building Recertification from the City must have the required inspections performed by a qualified Florida-licensed engineer or architect and submit the required documentation to the City of Aventura' },
        { page: 'https://www.cityofaventura.com/548/Building-Recertification', quote: 'The City of Aventura Building Division administers the Building Recertification Program in accordance with Miami-Dade County requirements.' },
      ],
    },
  },
  'building-recertification/sunny-isles-beach': {
    office: [
      { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'Government Center - 3rd Floor 18070 Collins Avenue Sunny Isles Beach, FL 33160' },
      { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'or call us at 305.947.2150' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department', quote: 'Working with associations and building owners to get all required building\'s re-certified to ensure continued safety of the occupants.' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'For inquiries about building recertification, email your questions to info.building@sibfl.net or call us at 305.947.2150.' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'For those properties that require certification, the property owners receive a Notice of Required Recertification to commence the process.' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'Structural inspection report according to the Minimum Inspection Guidelines for Building Safety as required by the Miami-Dade County Board of Rules and Appeals (signed, sealed, and with two copies).' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'The Owner of a property must hire a state of Florida Licensed Contractor and obtain permits from the Building Department prior to performing any repairs or modifications.' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'The Building Official may issue an extension of not more than 60 days to submit a recertification report or to obtain any necessary permits upon a written extension request from an engineer/architect.' },
      ],
      'heroSub': [
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'Structural inspection report according to the Minimum Inspection Guidelines for Building Safety as required by the Miami-Dade County Board of Rules and Appeals (signed, sealed, and with two copies).' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'Electrical inspection report according to the Minimum Inspection Guidelines for Building Safety as required by the Miami-Dade County Board of Rules and Appeals (signed, sealed, and with two copies).' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'The Owner of a property must hire a state of Florida Licensed Contractor and obtain permits from the Building Department prior to performing any repairs or modifications.' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Department-Documents', quote: 'Building Recertification Forms' },
      ],
      'local 1: The notice': [
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'For those properties that require certification, the property owners receive a Notice of Required Recertification to commence the process.' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'If repairs or modifications are necessary following the building recertification inspection, the Owner shall have a total of 150 days from the date of the Notice of Required Inspection to complete indicated repairs or modifications in compliance with all applicable Sections of the Florida Building Code.' },
      ],
      'local 2: Filing the report': [
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'Structural inspection report according to the Minimum Inspection Guidelines for Building Safety as required by the Miami-Dade County Board of Rules and Appeals (signed, sealed, and with two copies).' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'Electrical inspection report according to the Minimum Inspection Guidelines for Building Safety as required by the Miami-Dade County Board of Rules and Appeals (signed, sealed, and with two copies).' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'All forms with original signature.' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'All forms sealed/stamped by a Florida registered Architect or Engineer.' },
      ],
      'local 3: The city’s forms': [
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Department-Documents', quote: 'Building Recertification Forms' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Department-Documents', quote: 'Structural Recertification Form 2025(PDF, 816KB)' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Department-Documents', quote: 'Electrical Recertification Form 2025(PDF, 765KB)' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Department-Documents', quote: 'Building Recertification General Considerations & Guidelines 2025(PDF, 446KB)' },
        { page: 'https://www.sibfl.gov/files/assets/city/v/1/building-and-code/documents/building-department-forms/building-recertification-forms/general-consideration-guidelines-2025.pdf', quote: 'provided must be used, proprietary forms will not be accepted.' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'Structural inspection report according to the Minimum Inspection Guidelines for Building Safety as required by the Miami-Dade County Board of Rules and Appeals (signed, sealed, and with two copies).' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'Electrical inspection report according to the Minimum Inspection Guidelines for Building Safety as required by the Miami-Dade County Board of Rules and Appeals (signed, sealed, and with two copies).' },
      ],
      'local 4: What goes with it': [
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Department-Documents', quote: 'Recert. Building Parking Lot Guardrails 2025(PDF, 155KB)' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Department-Documents', quote: 'Recert. Building Parking Lot Illumination 2025(PDF, 155KB)' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'Part I: Provide a resume (self-qualification letter) indicating the engineer’s experience working with buildings equivalent to the building being certified.' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'Part II: Provide proof of the engineer’s state Department of Business and Professional Regulation structural specialization.' },
      ],
      'local 5: Repairs': [
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'The Owner of a property must hire a state of Florida Licensed Contractor and obtain permits from the Building Department prior to performing any repairs or modifications.' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Permits', quote: 'Our building permit process is fully digital. All permit applications must be submitted online through your portal account.' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'Once all permits receive an approved final inspection from the electrical and/or structural inspectors, the Professional Engineer and/or registered Architect of record must submit a signed and sealed report stating that all repairs have been completed and the building is structurally and electrically safe for continued use.' },
      ],
      'local 6: Extensions': [
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'The Building Official may issue an extension of not more than 60 days to submit a recertification report or to obtain any necessary permits upon a written extension request from an engineer/architect.' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'Such a request must contain a signed and sealed statement from the engineer/architect that the building may continue to be occupied while undergoing recertification.' },
      ],
      'local 7: If it is late': [
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'If the property owner fails to obtain the recertification within the timeframe required, the property is referred to the Unsafe Structures Section and an enforcement case is opened.' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'Unsafe Structures monitors the recertification process thereafter including posting the building unsafe; issuance of a Notice of Violation; referral to the Unsafe Structures Board; and review of Board Order timelines for compliance and repairs, orders to vacate, collections of enforcement cost and any other action deemed necessary.' },
      ],
      'local 8: A second notice': [
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'Under Section 2415.7.4 of the Florida Building Code, Building Volume, the owner of a threshold building containing an exterior façade of structural sealant glazing is required to have the building facade inspected for the purpose of determining the general structural condition of the glazing adhesive every five years after installation.' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'For those properties that require recertification, the property owner will receive a Notice of Required Recertification of Structural Glazing for Threshold Buildings to commence the process.' },
      ],
      'faq 1': [
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'For those properties that require certification, the property owners receive a Notice of Required Recertification to commence the process.' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'Structural inspection report according to the Minimum Inspection Guidelines for Building Safety as required by the Miami-Dade County Board of Rules and Appeals (signed, sealed, and with two copies).' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'Electrical inspection report according to the Minimum Inspection Guidelines for Building Safety as required by the Miami-Dade County Board of Rules and Appeals (signed, sealed, and with two copies).' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'If repairs or modifications are necessary following the building recertification inspection, the Owner shall have a total of 150 days from the date of the Notice of Required Inspection to complete indicated repairs or modifications in compliance with all applicable Sections of the Florida Building Code.' },
      ],
      'faq 2': [
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'Structural inspection report according to the Minimum Inspection Guidelines for Building Safety as required by the Miami-Dade County Board of Rules and Appeals (signed, sealed, and with two copies).' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'Electrical inspection report according to the Minimum Inspection Guidelines for Building Safety as required by the Miami-Dade County Board of Rules and Appeals (signed, sealed, and with two copies).' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Permits', quote: 'Our building permit process is fully digital. All permit applications must be submitted online through your portal account.' },
      ],
      'faq 3': [
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'If the property owner fails to obtain the recertification within the timeframe required, the property is referred to the Unsafe Structures Section and an enforcement case is opened.' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'Unsafe Structures monitors the recertification process thereafter including posting the building unsafe; issuance of a Notice of Violation; referral to the Unsafe Structures Board; and review of Board Order timelines for compliance and repairs, orders to vacate, collections of enforcement cost and any other action deemed necessary.' },
      ],
      'faq 4': [
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'The Building Official may issue an extension of not more than 60 days to submit a recertification report or to obtain any necessary permits upon a written extension request from an engineer/architect.' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'Such a request must contain a signed and sealed statement from the engineer/architect that the building may continue to be occupied while undergoing recertification.' },
      ],
      'faq 5': [
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: '1. All buildings built on or before 1982 that have already had an initial recertification inspection through Miami-Dade’s 40-Year program will continue to follow the established schedule.' },
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department', quote: 'Working with associations and building owners to get all required building\'s re-certified to ensure continued safety of the occupants.' },
      ],
      'nextStep': [
        { page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program', quote: 'For those properties that require certification, the property owners receive a Notice of Required Recertification to commence the process.' },
      ],
    },
  },
  'building-recertification/miami-gardens': {
    office: [
      { page: 'https://www.miamigardens-fl.gov/FAQ.aspx?TID=35', quote: 'The Building Services Division is located at 18605 NW 27th Avenue, Miami Gardens, FL 33056' },
      { page: 'https://www.miamigardens-fl.gov/190/Building-Services', quote: 'Phone: 305-622-8027 or 305-622-8000, Option 4' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.miamigardens-fl.gov/190/Building-Services', quote: '40 Year Re-Certifications' },
        { page: 'https://www.miamigardens-fl.gov/193/Documents-Forms', quote: 'CMG Building Recertification Inspection Report Form - Structural 2025' },
        { page: 'https://www.miamigardens-fl.gov/193/Documents-Forms', quote: 'CMG Building Recertification Inspection Report Form - Electrical 2025' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/7302/CMG-Building-Recertification-General-Consideration--Guidelines-2025-', quote: 'MIAMI-DADE COUNTY BUILDING RECERTIFICATION' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/545/CMG-Recertification-Extension-Request-Form', quote: 'RECERTIFICATION EXTENSION REQUEST' },
      ],
      'heroSub': [
        { page: 'https://www.miamigardens-fl.gov/190/Building-Services', quote: '40 Year Re-Certifications' },
        { page: 'https://www.miamigardens-fl.gov/193/Documents-Forms', quote: 'CMG Building Recertification Inspection Report Form - Structural 2025' },
        { page: 'https://www.miamigardens-fl.gov/193/Documents-Forms', quote: 'CMG Building Recertification Inspection Report Form - Electrical 2025' },
      ],
      'local 1: The notice': [
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/97/CMG-Building-Recertification-Inspection-Report-Form---Structural-2025', quote: 'a. Date of Notice of Required Inspection:' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/545/CMG-Recertification-Extension-Request-Form', quote: 'Notice Date:' },
      ],
      'local 2: The city’s forms': [
        { page: 'https://www.miamigardens-fl.gov/193/Documents-Forms', quote: 'CMG Building Recertification Inspection Report Form - Structural 2025' },
        { page: 'https://www.miamigardens-fl.gov/193/Documents-Forms', quote: 'CMG Building Recertification Inspection Report Form - Electrical 2025' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/7302/CMG-Building-Recertification-General-Consideration--Guidelines-2025-', quote: 'MIAMI-DADE COUNTY BUILDING RECERTIFICATION' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/7302/CMG-Building-Recertification-General-Consideration--Guidelines-2025-', quote: 'The approved report forms provided must be used, proprietary forms will not be accepted.' },
      ],
      'local 3: What goes with them': [
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/7302/CMG-Building-Recertification-General-Consideration--Guidelines-2025-', quote: 'Evaluation: Each report shall include a cover letter from the design professional with a statement' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/7301/CMG-Recertification-for-Parking-Lot-Illumination', quote: 'CERTIFICATION OF COMPLIANCE WITH PARKING LOT ILLUMINATION' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/7303/CMG-Recertification-for-Parking-Lot-Guardrails', quote: 'CERTIFICATION OF COMPLIANCE WITH PARKING LOT GUARDRAILS' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/96/CMG-Building-Recertification-Inspection-Report-Form---Electrical-2025', quote: 'Design Professional to summarize results below. Attach thermography report by certified thermographer.' },
      ],
      'local 4: Filing the report': [
        { page: 'https://www.miamigardens-fl.gov/193/Documents-Forms', quote: 'Below you will find a list of Building Forms to be completed and submitted as document attachments to your online CSS permit application as required.' },
        { page: 'https://www.miamigardens-fl.gov/941/CMG-Customer-Self-Service-CSS', quote: 'The Miami Gardens Citizen Self Service (CSS) portal is the next-generation service site for the City of Miami Gardens permitting, planning, business tax receipt, code compliance records, applications, and requests.' },
      ],
      'local 5: After filing': [
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/7302/CMG-Building-Recertification-General-Consideration--Guidelines-2025-', quote: 'reports may be au-dited, and the subject building may be inspected at the discretion of the' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/7302/CMG-Building-Recertification-General-Consideration--Guidelines-2025-', quote: 'The Building Official reserves the right to revoke an approved recertification report.' },
      ],
      'local 6: Repairs': [
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/7302/CMG-Building-Recertification-General-Consideration--Guidelines-2025-', quote: 'Repairs identified in the recertification report will most likely require permits.' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/7302/CMG-Building-Recertification-General-Consideration--Guidelines-2025-', quote: 'Proceeding without obtaining repair permits may lead to a violation of the code.' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/7302/CMG-Building-Recertification-General-Consideration--Guidelines-2025-', quote: 'Additionally, repairs being conducted under a permit will afford additional time to comply with a complete recertification report.' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/97/CMG-Building-Recertification-Inspection-Report-Form---Structural-2025', quote: 'Initial Inspection Report Amended Inspection Report after completion of repairs' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/97/CMG-Building-Recertification-Inspection-Report-Form---Structural-2025', quote: 'f. Can the building continue to be occupied while recertification and repairs are ongoing? (YES/NO):' },
      ],
      'local 7: Extensions': [
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/545/CMG-Recertification-Extension-Request-Form', quote: 'RECERTIFICATION EXTENSION REQUEST' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/545/CMG-Recertification-Extension-Request-Form', quote: 'This letter is to request and extension on the above reference 40 Year Recertification for the following' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/545/CMG-Recertification-Extension-Request-Form', quote: '(Owner/Owner\'s Agent or Contractor)' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/545/CMG-Recertification-Extension-Request-Form', quote: 'Sworn to and subscribed before me this day of' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/545/CMG-Recertification-Extension-Request-Form', quote: 'Extension Granted for: days' },
      ],
      'local 8: Older names': [
        { page: 'https://www.miamigardens-fl.gov/190/Building-Services', quote: '40 Year Re-Certifications' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/545/CMG-Recertification-Extension-Request-Form', quote: 'This letter is to request and extension on the above reference 40 Year Recertification for the following' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/97/CMG-Building-Recertification-Inspection-Report-Form---Structural-2025', quote: 'BUILDING RECERTIFICATION INSPECTION REPORT FORM - STRUCTURAL' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/96/CMG-Building-Recertification-Inspection-Report-Form---Electrical-2025', quote: 'BUILDING RECERTIFICATION INSPECTION REPORT FORM - ELECTRICAL' },
      ],
      'faq 1': [
        { page: 'https://www.miamigardens-fl.gov/190/Building-Services', quote: '40 Year Re-Certifications' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/97/CMG-Building-Recertification-Inspection-Report-Form---Structural-2025', quote: 'a. Date of Notice of Required Inspection:' },
      ],
      'faq 2': [
        { page: 'https://www.miamigardens-fl.gov/193/Documents-Forms', quote: 'Below you will find a list of Building Forms to be completed and submitted as document attachments to your online CSS permit application as required.' },
        { page: 'https://www.miamigardens-fl.gov/941/CMG-Customer-Self-Service-CSS', quote: 'The Miami Gardens Citizen Self Service (CSS) portal is the next-generation service site for the City of Miami Gardens permitting, planning, business tax receipt, code compliance records, applications, and requests.' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/7302/CMG-Building-Recertification-General-Consideration--Guidelines-2025-', quote: 'it should be immediately submitted to the local jurisdiction for processing' },
      ],
      'faq 3': [
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/545/CMG-Recertification-Extension-Request-Form', quote: 'RECERTIFICATION EXTENSION REQUEST' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/545/CMG-Recertification-Extension-Request-Form', quote: 'This letter is to request and extension on the above reference 40 Year Recertification for the following' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/545/CMG-Recertification-Extension-Request-Form', quote: '(Owner/Owner\'s Agent or Contractor)' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/545/CMG-Recertification-Extension-Request-Form', quote: 'Sworn to and subscribed before me this day of' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/545/CMG-Recertification-Extension-Request-Form', quote: 'Extension Granted for: days' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/545/CMG-Recertification-Extension-Request-Form', quote: 'Notice Date:' },
      ],
      'faq 4': [
        { page: 'https://www.miamigardens-fl.gov/190/Building-Services', quote: 'Unsafe Structure Hearings' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/545/CMG-Recertification-Extension-Request-Form', quote: 'RECERTIFICATION EXTENSION REQUEST' },
      ],
      'faq 5': [
        { page: 'https://www.miamigardens-fl.gov/190/Building-Services', quote: '40 Year Re-Certifications' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/545/CMG-Recertification-Extension-Request-Form', quote: 'This letter is to request and extension on the above reference 40 Year Recertification for the following' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/97/CMG-Building-Recertification-Inspection-Report-Form---Structural-2025', quote: 'BUILDING RECERTIFICATION INSPECTION REPORT FORM - STRUCTURAL' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/96/CMG-Building-Recertification-Inspection-Report-Form---Electrical-2025', quote: 'BUILDING RECERTIFICATION INSPECTION REPORT FORM - ELECTRICAL' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/97/CMG-Building-Recertification-Inspection-Report-Form---Structural-2025', quote: 'This report has been based upon the minimum inspection requirements of Miami-Dade County Code Sec. 8-11(f)' },
        { page: 'https://www.miamigardens-fl.gov/DocumentCenter/View/7302/CMG-Building-Recertification-General-Consideration--Guidelines-2025-', quote: 'MIAMI-DADE COUNTY BUILDING RECERTIFICATION' },
      ],
      'nextStep': [
        { page: 'https://www.miamigardens-fl.gov/190/Building-Services', quote: '40 Year Re-Certifications' },
      ],
    },
  },
  'building-recertification/homestead': {
    office: [
      { page: 'https://www.homesteadfl.gov/95/Building-Safety', quote: 'City of Homestead City Hall 100 Civic Court Homestead, FL 33030' },
      { page: 'https://www.homesteadfl.gov/95/Building-Safety', quote: 'For more information, call the Building Deaprtment at (305) 224-4500.' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.homesteadfl.gov/565/Building-Recertification', quote: 'For those properties that require certification, the property owners receive a Notice of Required Recertification to commence the process.' },
        { page: 'https://www.homesteadfl.gov/565/Building-Recertification', quote: 'Property owners must submit written recertification reports prepared by a Florida-registered professional engineer or architect, certifying each building or structure is structurally and electrically safe for the specified use for continued occupancy.' },
        { page: 'https://www.homesteadfl.gov/565/Building-Recertification', quote: 'Approved by the Board of Rules and Appeals (BORA), the updated guidelines and report templates have been revised and are available below.' },
        { page: 'https://www.homesteadfl.gov/95/Building-Safety', quote: 'For more information, call the Building Deaprtment at (305) 224-4500.' },
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/4055', quote: 'CITY OF HOMESTEAD DEVELOPMENT SERVICES 100 CIVIC COURT HOMESTEAD, FL 33030 TEL. 305-224-4500 FAX 305-224-4539 MIAMI-DADE COUNTY CODE ORDINANCE SECTION 8-11 (f) RECERTIFICATION OF BUILDINGS AND COMPONENTS' },
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/4055', quote: 'the responsible engineer or architect who has performed the recertification inspection shall provide the Building Official with a letter indicating whether the building or structure may continue to be safely occupied while the building or structure is undergoing repairs.' },
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/4055', quote: 'The Building Official may issue an extension of not more than 60 days to submit a recertification report or to obtain any necessary permits upon a written extension request from an engineer or architect.' },
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/4055', quote: 'the Building Official may order that electrical utilities be disconnected for that building or structure if the Building Official determines that such inaction creates uncertainty in the opinion of the Building Official as to whether the building or structure may continue to be safely occupied.' },
      ],
      'heroSub': [
        { page: 'https://www.homesteadfl.gov/565/Building-Recertification', quote: 'Approved by the Board of Rules and Appeals (BORA), the updated guidelines and report templates have been revised and are available below.' },
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/4055', quote: 'CITY OF HOMESTEAD DEVELOPMENT SERVICES 100 CIVIC COURT HOMESTEAD, FL 33030 TEL. 305-224-4500 FAX 305-224-4539 MIAMI-DADE COUNTY CODE ORDINANCE SECTION 8-11 (f) RECERTIFICATION OF BUILDINGS AND COMPONENTS' },
      ],
      'local 1: The notice': [
        { page: 'https://www.homesteadfl.gov/565/Building-Recertification', quote: 'For those properties that require certification, the property owners receive a Notice of Required Recertification to commence the process.' },
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/4055', quote: 'The Building Official shall provide the owner of the building or structure with a Notice of Required Inspection relating to the required recertification' },
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/4055', quote: 'In addition, the Building Official shall provide the owner with advance courtesy notices relating to their forthcoming building recertification two years and one year prior to their recertification anniversary year.' },
      ],
      'local 2: Filing the report': [
        { page: 'https://www.homesteadfl.gov/656/Applications-Fees', quote: 'The City of Homestead offers an online portal, EPL-B.U.I.L.D, for processing select applications. Please click here to view the current applications available online.' },
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/5860/EPL-Phase-1-Processes', quote: 'Building (Commercial) Building Recertification' },
        { page: 'https://www.homesteadfl.gov/740/Frequently-Asked-Questions', quote: 'Building Recertification, Sign, Paint, Building Canopy/Carport/Awning/Patio Cover, Driveway/Walkway/Patio, Fence, Gazebo/Pergola/Cover Terrace, and Pool' },
        { page: 'https://www.homesteadfl.gov/740/Frequently-Asked-Questions', quote: 'In Phase 1 starting October 1, 2025, a customer will be able to submit, search, monitor, or track the following types of requests.' },
      ],
      'local 3: The city’s forms': [
        { page: 'https://www.homesteadfl.gov/565/Building-Recertification', quote: 'Approved by the Board of Rules and Appeals (BORA), the updated guidelines and report templates have been revised and are available below.' },
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/4089', quote: 'REGULATORY AND ECONOMIC RESOURCES DEPARTMENT MIAMI-DADE COUNTY BUILDING RECERTIFICATION GENERAL CONSIDERATIONS & GUIDELINES' },
      ],
      'local 4: What goes with it': [
        { page: 'https://www.homesteadfl.gov/565/Building-Recertification', quote: 'PARKING LOT ILLUMINATION CERTIFICATION PARKING LOT GUARDRAILS CERTIFICATION' },
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/4055', quote: 'Such written report shall bear the impressed seal and signature of the responsible Engineer or Architect who has performed the inspection, unless submitted electronically with a verifiable digital signature as described in section 668.001, Florida Statutes.' },
      ],
      'local 5: After filing': [
        { page: 'https://www.homesteadfl.gov/746/All-Things-Electronic-Permitting-Licensi', quote: 'With this new system, users can submit applications, upload documents, and track progress all in one place—anytime, from anywhere.' },
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/4055', quote: 'The Building Official may revoke any recertifications if the Building Official determines that the written recertification report contains any misrepresentation of the actual conditions of the building or structure.' },
      ],
      'local 6: Repairs': [
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/4055', quote: 'the responsible engineer or architect who has performed the recertification inspection shall provide the Building Official with a letter indicating whether the building or structure may continue to be safely occupied while the building or structure is undergoing repairs.' },
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/4055', quote: 'the engineer(s) or architect(s) providing the initial recertification report must provide an amended report indicating that the building or structure has been recertified for continued use under the present occupancy.' },
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/4055', quote: 'Repairs or modifications requiring permits shall be executed in conformance with all applicable Sections of the Building Code and shall follow the timeline provided in the applicable active permit.' },
      ],
      'local 7: Extensions': [
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/4055', quote: 'The Building Official may issue an extension of not more than 60 days to submit a recertification report or to obtain any necessary permits upon a written extension request from an engineer or architect.' },
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/4055', quote: 'Such request must contain a signed and sealed statement from the engineer or architect that the building may continue to be occupied while undergoing recertification.' },
      ],
      'local 8: If it is late': [
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/4055', quote: 'the Building Official may order that electrical utilities be disconnected for that building or structure if the Building Official determines that such inaction creates uncertainty in the opinion of the Building Official as to whether the building or structure may continue to be safely occupied.' },
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/4055', quote: 'Before a Building Official may order electrical utilities to be disconnected under this subsection, the Building Official must provide notice to the owner of a building or structure via certified mail and posted or affixed in a conspicuous location on the building or structure.' },
      ],
      'faq 1': [
        { page: 'https://www.homesteadfl.gov/565/Building-Recertification', quote: 'For those properties that require certification, the property owners receive a Notice of Required Recertification to commence the process.' },
        { page: 'https://www.homesteadfl.gov/565/Building-Recertification', quote: 'Property owners must submit written recertification reports prepared by a Florida-registered professional engineer or architect, certifying each building or structure is structurally and electrically safe for the specified use for continued occupancy.' },
      ],
      'faq 2': [
        { page: 'https://www.homesteadfl.gov/656/Applications-Fees', quote: 'The City of Homestead offers an online portal, EPL-B.U.I.L.D, for processing select applications. Please click here to view the current applications available online.' },
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/5860/EPL-Phase-1-Processes', quote: 'Building (Commercial) Building Recertification' },
        { page: 'https://www.homesteadfl.gov/740/Frequently-Asked-Questions', quote: 'Building Recertification, Sign, Paint, Building Canopy/Carport/Awning/Patio Cover, Driveway/Walkway/Patio, Fence, Gazebo/Pergola/Cover Terrace, and Pool' },
        { page: 'https://www.homesteadfl.gov/740/Frequently-Asked-Questions', quote: 'Yes, customers are still welcome to come in for assistance by our teams. All application and documents/drawings will be required to be submitted online, however.' },
      ],
      'faq 3': [
        { page: 'https://www.homesteadfl.gov/565/Building-Recertification', quote: 'Note that the following types of residences do not go through the 40-year recertification process: single-family homes, duplexes, and buildings with a 10 occupant load or less and 2,000 square feet or less.' },
      ],
      'faq 4': [
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/4055', quote: 'the Building Official may order that electrical utilities be disconnected for that building or structure if the Building Official determines that such inaction creates uncertainty in the opinion of the Building Official as to whether the building or structure may continue to be safely occupied.' },
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/4055', quote: 'Before a Building Official may order electrical utilities to be disconnected under this subsection, the Building Official must provide notice to the owner of a building or structure via certified mail and posted or affixed in a conspicuous location on the building or structure.' },
      ],
      'faq 5': [
        { page: 'https://www.homesteadfl.gov/565/Building-Recertification', quote: 'Note that the following types of residences do not go through the 40-year recertification process: single-family homes, duplexes, and buildings with a 10 occupant load or less and 2,000 square feet or less.' },
        { page: 'https://www.homesteadfl.gov/DocumentCenter/View/4055', quote: 'CITY OF HOMESTEAD DEVELOPMENT SERVICES 100 CIVIC COURT HOMESTEAD, FL 33030 TEL. 305-224-4500 FAX 305-224-4539 MIAMI-DADE COUNTY CODE ORDINANCE SECTION 8-11 (f) RECERTIFICATION OF BUILDINGS AND COMPONENTS' },
      ],
      'nextStep': [
        { page: 'https://www.homesteadfl.gov/565/Building-Recertification', quote: 'For those properties that require certification, the property owners receive a Notice of Required Recertification to commence the process.' },
      ],
    },
  },
  'building-recertification/surfside': {
    office: [
      { page: 'https://www.townofsurfsidefl.gov/departments-services/building/about-building', quote: '9293 Harding Avenue, Surfside, FL 33154' },
      { page: 'https://www.townofsurfsidefl.gov/departments-services/building/about-building', quote: 'For information by telephone, call 305.861.4863.' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'submit a completed report of the inspection performed to the Governmental Compliance Section in the City of Town of Surfside Building Department for review and approval.' },
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'When a building is due to submit a report for the 40/10 year recertification, the Building Department will send a notice to the Owner or Owner’s representative via certified mail.' },
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'Failure to submit the required building re-certification report within the maximum time limitation of (90 days) will result in the issuance of a Building Violations.' },
        { page: 'https://www.townofsurfsidefl.gov/docs/default-source/default-document-library/building/building-recertification-instructions-(2).pdf?sfvrsn=5866e394_3', quote: 'We accept applications by CSS portal ONLY. We do not accept hard copies.' },
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/customer-self-service-(css)', quote: 'Welcome to the Town of Surfside’s online, Customer Self Service (CSS) permitting portal.' },
        { page: 'https://library.municode.com/fl/surfside/codes/code_of_ordinances?nodeId=PTIICO_CH14BUBURE', quote: 'Section 8-11, "Existing Buildings" of the Miami-Dade County Code of Ordinances, as may be amended from time to time, is hereby adopted and incorporated by reference, with the following modifications:' },
        { page: 'https://library.municode.com/fl/surfside/codes/code_of_ordinances?nodeId=PTIICO_CH14BUBURE', quote: 'Courtesy notices to building owners will be provided to building owners at least one year prior to the anniversary date of their recertification as well as providing an additional courtesy notice at least six months prior to the anniversary date of their recertification' },
        { page: 'https://library.municode.com/fl/surfside/codes/code_of_ordinances?nodeId=PTIICO_CH14BUBURE', quote: 'A six-month extension for building recertification may be granted by the building official, which may be renewed at the discretion of the building official.' },
      ],
      'heroSub': [
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'When a building is due to submit a report for the 40/10 year recertification, the Building Department will send a notice to the Owner or Owner’s representative via certified mail.' },
        { page: 'https://www.townofsurfsidefl.gov/docs/default-source/default-document-library/building/building-recertification-instructions-(2).pdf?sfvrsn=5866e394_3', quote: 'We accept applications by CSS portal ONLY. We do not accept hard copies.' },
        { page: 'https://www.townofsurfsidefl.gov/docs/default-source/default-document-library/building/building-recertification-package66d13e71-6264-47ec-9e0a-8edbb665eda0.pdf?sfvrsn=c6d61d94_1', quote: 'The approved report forms provided must be used, proprietary forms will not be accepted.' },
      ],
      'local 1: The notice': [
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'When a building is due to submit a report for the 40/10 year recertification, the Building Department will send a notice to the Owner or Owner’s representative via certified mail.' },
        { page: 'https://library.municode.com/fl/surfside/codes/code_of_ordinances?nodeId=PTIICO_CH14BUBURE', quote: 'Courtesy notices to building owners will be provided to building owners at least one year prior to the anniversary date of their recertification as well as providing an additional courtesy notice at least six months prior to the anniversary date of their recertification' },
        { page: 'https://library.municode.com/fl/surfside/codes/code_of_ordinances?nodeId=PTIICO_CH14BUBURE', quote: 'The failure to provide the courtesy notices does not waive or release the building owner\'s obligation to comply with building recertification requirements, in accordance with all applicable state, county and municipal laws.' },
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'the Owner shall have a total of 150 days from the date of the notice of required inspection in which to complete indicated repairs or modifications in compliance with all applicable sections of the Florida Building Code.' },
      ],
      'local 2: Filing the report': [
        { page: 'https://www.townofsurfsidefl.gov/docs/default-source/default-document-library/building/building-recertification-instructions-(2).pdf?sfvrsn=5866e394_3', quote: 'We accept applications by CSS portal ONLY. We do not accept hard copies.' },
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/customer-self-service-(css)', quote: 'Welcome to the Town of Surfside’s online, Customer Self Service (CSS) permitting portal.' },
        { page: 'https://www.townofsurfsidefl.gov/docs/default-source/default-document-library/building/building-recertification-instructions-(2).pdf?sfvrsn=5866e394_3', quote: 'Apply under 40 YRS Building Recertification' },
        { page: 'https://www.townofsurfsidefl.gov/docs/default-source/default-document-library/building/building-recertification-instructions-(2).pdf?sfvrsn=5866e394_3', quote: 'NOTE: Please do not email the Building Official or Town Manager. Your package may not be received and/or processed.' },
      ],
      'local 3: The city’s forms': [
        { page: 'https://www.townofsurfsidefl.gov/docs/default-source/default-document-library/building/building-recertification-package66d13e71-6264-47ec-9e0a-8edbb665eda0.pdf?sfvrsn=c6d61d94_1', quote: 'MIAMI-DADE COUNTY BUILDING RECERTIFICATION GENERAL CONSIDERATIONS & GUIDELINES' },
        { page: 'https://www.townofsurfsidefl.gov/docs/default-source/default-document-library/building/building-recertification-package66d13e71-6264-47ec-9e0a-8edbb665eda0.pdf?sfvrsn=c6d61d94_1', quote: 'The approved report forms provided must be used, proprietary forms will not be accepted.' },
        { page: 'https://www.townofsurfsidefl.gov/docs/default-source/default-document-library/building/building-recertification-instructions-(2).pdf?sfvrsn=5866e394_3', quote: 'Print and fill out the permit application. (all forms available online)' },
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/documents-and-forms', quote: 'Please make sure you complete all forms as required (fillable online). Electronic notarization is accepted.' },
      ],
      'local 4: The files': [
        { page: 'https://www.townofsurfsidefl.gov/docs/default-source/default-document-library/building/building-recertification-instructions-(2).pdf?sfvrsn=5866e394_3', quote: 'Submit the recertification package in another PDF file, segregated according to discipline. (Structural, Electrical)' },
        { page: 'https://www.townofsurfsidefl.gov/docs/default-source/default-document-library/building/building-recertification-instructions-(2).pdf?sfvrsn=5866e394_3', quote: 'No encrypted files or with third party signatures will be processed, plan reviewers must be able to do markups to the files' },
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'Building Re-certification reports shall bear the impressed seal and signature of the certifying Engineer and or Architect.' },
      ],
      'local 5: After filing': [
        { page: 'https://www.townofsurfsidefl.gov/docs/default-source/default-document-library/building/building-recertification-instructions-(2).pdf?sfvrsn=5866e394_3', quote: 'Once processed, the permit technician will email you a receipt for the charges.' },
        { page: 'https://www.townofsurfsidefl.gov/docs/default-source/default-document-library/building/building-recertification-instructions-(2).pdf?sfvrsn=5866e394_3', quote: 'The application number will be included in the receipt for your reference.' },
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'submit a completed report of the inspection performed to the Governmental Compliance Section in the City of Town of Surfside Building Department for review and approval.' },
        { page: 'https://www.townofsurfsidefl.gov/docs/default-source/default-document-library/building/building-recertification-instructions-(2).pdf?sfvrsn=5866e394_3', quote: 'After the recertification package is reviewed, the clerk will contact you for the fees and recertification letter.' },
        { page: 'https://www.townofsurfsidefl.gov/docs/default-source/default-document-library/building/building-recertification-instructions-(2).pdf?sfvrsn=5866e394_3', quote: 'STEP 5: Final Payment and issuance of recertification letter.' },
      ],
      'local 6: Repairs': [
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'the Owner shall have a total of 150 days from the date of the notice of required inspection in which to complete indicated repairs or modifications in compliance with all applicable sections of the Florida Building Code.' },
      ],
      'local 7: Extensions': [
        { page: 'https://library.municode.com/fl/surfside/codes/code_of_ordinances?nodeId=PTIICO_CH14BUBURE', quote: 'A six-month extension for building recertification may be granted by the building official, which may be renewed at the discretion of the building official.' },
      ],
      'local 8: If it is late': [
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'Failure to submit the required building re-certification report within the maximum time limitation of (90 days) will result in the issuance of a Building Violations.' },
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'The Notice of Violation will be posted on the building and mailed to the owner of record via certified mail.' },
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'If the owner fails to respond to the violation, the violation will be referred to The Town of Surfside Special Master for a hearing.' },
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'If the Building Official determines that the structure is unsafe, the matter will be forwarded to Miami Dade County Unsafe Structures Board.' },
      ],
      'faq 1': [
        { page: 'https://www.townofsurfsidefl.gov/docs/default-source/default-document-library/building/building-recertification-instructions-(2).pdf?sfvrsn=5866e394_3', quote: 'We accept applications by CSS portal ONLY. We do not accept hard copies.' },
        { page: 'https://www.townofsurfsidefl.gov/docs/default-source/default-document-library/building/building-recertification-instructions-(2).pdf?sfvrsn=5866e394_3', quote: 'NOTE: Please do not email the Building Official or Town Manager. Your package may not be received and/or processed.' },
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/customer-self-service-(css)', quote: 'The first step is registering and creating an account on the portal.' },
        { page: 'https://www.townofsurfsidefl.gov/docs/default-source/default-document-library/building/building-recertification-instructions-(2).pdf?sfvrsn=5866e394_3', quote: 'Apply under 40 YRS Building Recertification' },
        { page: 'https://www.townofsurfsidefl.gov/docs/default-source/default-document-library/building/building-recertification-instructions-(2).pdf?sfvrsn=5866e394_3', quote: 'Submit the recertification package in another PDF file, segregated according to discipline. (Structural, Electrical)' },
        { page: 'https://www.townofsurfsidefl.gov/docs/default-source/default-document-library/building/building-recertification-package66d13e71-6264-47ec-9e0a-8edbb665eda0.pdf?sfvrsn=c6d61d94_1', quote: 'The approved report forms provided must be used, proprietary forms will not be accepted.' },
      ],
      'faq 2': [
        { page: 'https://library.municode.com/fl/surfside/codes/code_of_ordinances?nodeId=PTIICO_CH14BUBURE', quote: 'Section 8-11, "Existing Buildings" of the Miami-Dade County Code of Ordinances, as may be amended from time to time, is hereby adopted and incorporated by reference, with the following modifications:' },
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'When a building is due to submit a report for the 40/10 year recertification, the Building Department will send a notice to the Owner or Owner’s representative via certified mail.' },
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'the Owner shall have a total of 150 days from the date of the notice of required inspection in which to complete indicated repairs or modifications in compliance with all applicable sections of the Florida Building Code.' },
        { page: 'https://library.municode.com/fl/surfside/codes/code_of_ordinances?nodeId=PTIICO_CH14BUBURE', quote: 'A six-month extension for building recertification may be granted by the building official, which may be renewed at the discretion of the building official.' },
      ],
      'faq 3': [
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'Failure to submit the required building re-certification report within the maximum time limitation of (90 days) will result in the issuance of a Building Violations.' },
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'The Notice of Violation will be posted on the building and mailed to the owner of record via certified mail.' },
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'If the owner fails to respond to the violation, the violation will be referred to The Town of Surfside Special Master for a hearing.' },
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'If the Building Official determines that the structure is unsafe, the matter will be forwarded to Miami Dade County Unsafe Structures Board.' },
      ],
      'faq 4': [
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'all buildings, except single-family residences, duplexes and minor structures which are forty (40) years or older must be recertified by the Building Official when the structure becomes 41 years old and then every 10 years after the first Recertification.' },
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'Click here for all the information regarding New Condo Recertification Rules adopted by Miami-Dade County.' },
        { page: 'https://library.municode.com/fl/surfside/codes/code_of_ordinances?nodeId=PTIICO_CH14BUBURE', quote: 'Section 8-11, "Existing Buildings" of the Miami-Dade County Code of Ordinances, as may be amended from time to time, is hereby adopted and incorporated by reference, with the following modifications:' },
      ],
      'faq 5': [
        { page: 'https://library.municode.com/fl/surfside/codes/code_of_ordinances?nodeId=PTIICO_CH14BUBURE', quote: 'Any owner of a multifamily building or the condominium association, as applicable, shall disseminate any report received from the engineer to all owners and residents of the building.' },
        { page: 'https://library.municode.com/fl/surfside/codes/code_of_ordinances?nodeId=PTIICO_CH14BUBURE', quote: 'The engineer(s) evaluating a building for recertification is required to submit any reports or comments to the building official with jurisdiction and to all owners and residents of the building upon issuance to the owner; and' },
      ],
      'nextStep': [
        { page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program', quote: 'When a building is due to submit a report for the 40/10 year recertification, the Building Department will send a notice to the Owner or Owner’s representative via certified mail.' },
      ],
    },
  },
  'building-recertification/key-biscayne': {
    office: [
      { page: 'https://aca-prod.accela.com/keybiscayne/Default.aspx', quote: 'Our Offices are at 88 W. McIntyre St., Suite 250.' },
      { page: 'https://keybiscayne.fl.gov/services/human_resources/staff_directory/building_zoning_planning.php', quote: 'For general BZP inquiries, please call 305-365-5512.' },
    ],
    rows: {
      'lede': [
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'The Village follows the process set forth by Miami-Dade County.' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'The Village of Key Biscayne follows the State and County building codes.' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'the Village issues notification of recertification to the ownership or management of a structure on its 40th anniversary using certified mail to ensure receipt.' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'Once the report by the engineer or architect is submitted, the Village audits the report for compliance per Ch. 8-11(f) of the Miami-Dade County Code.' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'For residents who would like to report something directly to the Village Building Department, please do so using the dedicated email address VKBrecert@keybiscayne.fl.gov' },
        { page: 'https://aca-prod.accela.com/keybiscayne/Default.aspx', quote: 'Our Offices are at 88 W. McIntyre St., Suite 250.' },
      ],
      'heroSub': [
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'the Village issues notification of recertification to the ownership or management of a structure on its 40th anniversary using certified mail to ensure receipt.' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'The owner of a building must submit a written Recertification Report to the Building Official.' },
      ],
      'local 1: The notice': [
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'the Village issues notification of recertification to the ownership or management of a structure on its 40th anniversary using certified mail to ensure receipt.' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'The Village follows the process set forth by Miami-Dade County.' },
      ],
      'local 2: Filing the report': [
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'The owner of a building must submit a written Recertification Report to the Building Official.' },
        { page: 'https://aca-prod.accela.com/keybiscayne/Default.aspx', quote: 'Welcome to the Building, Zoning and Planning Citizen Portal' },
      ],
      'local 3: What goes with it': [
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'Each page of the electrical and structural report must be signed and sealed by the engineer or architect.' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'In addition, if there is more than one building on the property, the report should include a site plan or copy of a survey showing the location of each building.' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'The building that is the subject of the recertification must be clearly identified on the site plan or survey submitted.' },
      ],
      'local 4: The Village’s forms': [
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/index.php', quote: 'Minimum Inspection Guidelines for Building Structural Recertification.pdf' },
        { page: 'https://keybiscayne.fl.gov/Documents/Services/Building%20Zoning%20and%20Planning/Resources/Forms%202025/Minimum%20Inspection%20Guidelines%20for%20Building%20Structural%20Recertification.pdf?t=202505010911550', quote: 'MINIMUM INSPECTION PROCEDURAL GUIDELINES FOR BUILDING STRUCTURAL RECERTIFICATION' },
        { page: 'https://keybiscayne.fl.gov/Documents/Services/Building%20Zoning%20and%20Planning/Resources/Forms%202025/Minimum%20Inspection%20Guidelines%20for%20Building%20Electrical%20Recertification.pdf?t=202505010911550', quote: 'MINIMUM INSPECTION PROCEDURAL GUIDELINES FOR BUILDING ELECTRICAL RECERTIFICATION' },
        { page: 'https://keybiscayne.fl.gov/Documents/Services/Building%20Zoning%20and%20Planning/Resources/Forms%202025/Cert%20of%20Compliance%20Parking%20Lot%20Guardrails.pdf?t=202505010911510', quote: 'CERTIFICATION OF COMPLIANCE WITH PARKING LOT GUARDRAILS' },
      ],
      'local 5: After filing': [
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'Once the report by the engineer or architect is submitted, the Village audits the report for compliance per Ch. 8-11(f) of the Miami-Dade County Code.' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'If acceptable, the Village issues the recertification letter for the 40th year.' },
      ],
      'local 6: Repairs': [
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'If the report findings identify non-compliance per the Miami-Dade or Florida building codes, the Village requires the structure’s owner or management to complete repairs for the structure to meet recertification requirements.' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'The engineer or architect hired by the structure’s owner or management then re-inspects the work or repairs to provide an updated report to the Village for audit.' },
      ],
      'local 7: If it is late': [
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'If this does not happen, the Village may report the structure to Miami-Dade County’s unsafe structure board.' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'Should a building fall into one of the above categories, the Village Building Official has the responsibility of determining its referral to the Unsafe Structures board. All scenarios are reviewed on a case-by-case basis.' },
      ],
      'local 8: Older names': [
        { page: 'https://aca-prod.accela.com/keybiscayne/Cap/CapHome.aspx?module=Building&TabName=Building', quote: '40 Year Recertification' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'If acceptable, the Village issues the recertification letter for the 40th year.' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'Miami-Dade County, which the Village of Key Biscayne is subject to, requires that all buildings, except single-family residences, duplexes, and minor structures* be recertified after 40 years or longer.' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'The Village follows the process set forth by Miami-Dade County.' },
      ],
      'faq 1': [
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'the Village issues notification of recertification to the ownership or management of a structure on its 40th anniversary using certified mail to ensure receipt.' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'The Village coordinates with and offers support to the structure’s owner or management throughout the recertification process by sending notifications as specified by the Miami-Dade County Code.' },
      ],
      'faq 2': [
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'The owner of a building must submit a written Recertification Report to the Building Official.' },
        { page: 'https://aca-prod.accela.com/keybiscayne/Default.aspx', quote: 'Welcome to the Building, Zoning and Planning Citizen Portal' },
        { page: 'https://aca-prod.accela.com/keybiscayne/Cap/CapHome.aspx?module=Building&TabName=Building', quote: '40 Year Recertification' },
        { page: 'https://aca-prod.accela.com/keybiscayne/Default.aspx', quote: 'The Building Department is now accepting electronic submittal of permit applications and construction plans.' },
        { page: 'https://aca-prod.accela.com/keybiscayne/Default.aspx', quote: 'The Village of Key Biscayne will continue its regular practice of accepting hardcopy (paper) submittal of applications and plans.' },
      ],
      'faq 3': [
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'Miami-Dade County, which the Village of Key Biscayne is subject to, requires that all buildings, except single-family residences, duplexes, and minor structures* be recertified after 40 years or longer.' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'Minor structures, for the Miami-Dade County code, are buildings or structures with an occupancy load of ten or less and as having a gross area of 2,000 sq. ft. or less.' },
      ],
      'faq 4': [
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'If the hired engineer or architect that was hired by the structure’s owner or management deems the building not safe for continued occupancy, the Village is required by the Florida Building Code to declare the building unsafe and evacuate the structure immediately.' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'If the report findings identify non-compliance per the Miami-Dade or Florida building codes, the Village requires the structure’s owner or management to complete repairs for the structure to meet recertification requirements.' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'The engineer or architect hired by the structure’s owner or management then re-inspects the work or repairs to provide an updated report to the Village for audit.' },
      ],
      'faq 5': [
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'Miami-Dade County, which the Village of Key Biscayne is subject to, requires that all buildings, except single-family residences, duplexes, and minor structures* be recertified after 40 years or longer.' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'The Village follows the process set forth by Miami-Dade County.' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'If acceptable, the Village issues the recertification letter for the 40th year.' },
      ],
      'nextStep': [
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'the Village issues notification of recertification to the ownership or management of a structure on its 40th anniversary using certified mail to ensure receipt.' },
        { page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php', quote: 'For residents who would like to report something directly to the Village Building Department, please do so using the dedicated email address VKBrecert@keybiscayne.fl.gov' },
      ],
    },
  },
  'broward-bsip/fort-lauderdale': {
    office: [
      { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: '954-828-5932 / 954-828-5082' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'If you encounter issues, please contact the Building Safety Program.' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'Between June 1 and August 31 each year, property owners and/or associations will receive a notice from the Building Official, by certified mail, when their building is due for inspection during that calendar year.' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'All documents must be digitally signed and sealed and submitted electronically using the Building Safety Inspection Program Application (BSIP) through the LauderBuild Plan Room (paper submissions are no longer accepted).' },
      ],
      'heroSub': [
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'Between June 1 and August 31 each year, property owners and/or associations will receive a notice from the Building Official, by certified mail, when their building is due for inspection during that calendar year.' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'All documents must be digitally signed and sealed and submitted electronically using the Building Safety Inspection Program Application (BSIP) through the LauderBuild Plan Room (paper submissions are no longer accepted).' },
      ],
      'local 1: The notice': [
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'Between June 1 and August 31 each year, property owners and/or associations will receive a notice from the Building Official, by certified mail, when their building is due for inspection during that calendar year.' },
        { page: 'https://www.fortlauderdale.gov/files/assets/public/v/1/development-services/documents/permitting-services/building-safety-inspection-ft-laud.pdf', quote: 'Tracking # from Notification' },
      ],
      'local 2: Filing the report': [
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'All documents must be digitally signed and sealed and submitted electronically using the Building Safety Inspection Program Application (BSIP) through the LauderBuild Plan Room (paper submissions are no longer accepted).' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'Each document must be uploaded separately (do not combine them into a single file).' },
      ],
      'local 3: The city’s forms': [
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'The following forms must be completed and attached with your application.' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'Building Safety Inspection Submittal Form(PDF, 336KB)' },
        { page: 'https://www.fortlauderdale.gov/files/assets/public/v/2/development-services/documents/permitting-services/structural-bsip-inspection-form.pdf', quote: 'Broward County BORA – Policy 05-05' },
        { page: 'https://www.fortlauderdale.gov/files/assets/public/v/1/development-services/documents/lpr_ss_docs_v41.pdf', quote: 'Building Safety Inspection Form - Structural Supporting Doc Yes' },
        { page: 'https://www.fortlauderdale.gov/files/assets/public/v/1/development-services/documents/lpr_ss_docs_v41.pdf', quote: 'Building Safety Inspection Form - Electrical Supporting Doc Yes' },
      ],
      'local 4: The submittal form': [
        { page: 'https://www.fortlauderdale.gov/files/assets/public/v/1/development-services/documents/permitting-services/building-safety-inspection-ft-laud.pdf', quote: 'Folio # Building Sq. Ft.' },
        { page: 'https://www.fortlauderdale.gov/files/assets/public/v/1/development-services/documents/permitting-services/building-safety-inspection-ft-laud.pdf', quote: 'Repairs Required Submittal:' },
        { page: 'https://www.fortlauderdale.gov/files/assets/public/v/1/development-services/documents/permitting-services/building-safety-inspection-ft-laud.pdf', quote: 'Permit Numbers for Repairs' },
        { page: 'https://www.fortlauderdale.gov/files/assets/public/v/1/development-services/documents/permitting-services/building-safety-inspection-ft-laud.pdf', quote: 'Please make sure your package includes the following with this application:' },
      ],
      'local 5: Signatures and files': [
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'All documents must be digitally signed and sealed and submitted electronically' },
        { page: 'https://www.fortlauderdale.gov/files/assets/public/v/2/development-services/documents/lpr_dsp_v42.pdf', quote: 'You cannot self‐sign your own digital signature.' },
        { page: 'https://www.fortlauderdale.gov/files/assets/public/v/2/development-services/documents/lpr_dsp_v42.pdf', quote: 'Professionals can obtain digital certificates from the following approved certification authorities.' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/LauderBuild', quote: 'All files must be submitted as PDF files' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/LauderBuild', quote: 'Do not use encrypted or password-protected files.' },
      ],
      'local 6: After filing': [
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'once your application has been accepted, you’ll receive an email notification with payment details' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/LauderBuild', quote: 'Once the application package has been submitted for review Neighbors will not be able to upload additional documents without permission from City staff.' },
      ],
      'local 7: Repairs': [
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'If repairs are necessary, the Licensed Professional who did the inspection will provide a written, signed, and sealed letter to both the owner and the Building Official.' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'This letter will state whether the building can stay safely occupied while repairs are being made.' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'Once all repairs are finished, the same Licensed Professional will return to re-inspect the building.' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'They will then provide an amended report with a signed and sealed letter confirming that all repairs are complete and that the building is certified safe for continued use.' },
      ],
      'local 8: If it is late': [
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'unless otherwise specified by the Building Official' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'If you encounter issues, please contact the Building Safety Program.' },
      ],
      'faq 1': [
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'Between June 1 and August 31 each year, property owners and/or associations will receive a notice from the Building Official, by certified mail, when their building is due for inspection during that calendar year.' },
        { page: 'https://www.fortlauderdale.gov/files/assets/public/v/1/development-services/documents/permitting-services/building-safety-inspection-ft-laud.pdf', quote: 'Tracking # from Notification' },
      ],
      'faq 2': [
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'All documents must be digitally signed and sealed and submitted electronically using the Building Safety Inspection Program Application (BSIP) through the LauderBuild Plan Room (paper submissions are no longer accepted).' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/LauderBuild', quote: 'Desktop Computer (application and document submission is not supported on mobile devices)' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/LauderBuild', quote: 'In order to be able to access the LauderBuild Plan Room (LPR) you must have a LauderBuild account AND your LauderBuild account contact must be a contact on the permit record.' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'The following forms must be completed and attached with your application.' },
      ],
      'faq 3': [
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'unless otherwise specified by the Building Official' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'Between June 1 and August 31 each year, property owners and/or associations will receive a notice from the Building Official, by certified mail, when their building is due for inspection during that calendar year.' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'If you encounter issues, please contact the Building Safety Program.' },
      ],
      'faq 4': [
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'Certain types of buildings, as follows, are not subject to this program:' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'Small residential buildings (up to four units and three stories or less)' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'Fee Simple townhouses' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'Small structures under 3,500 square feet' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'Federal and state government buildings' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'Buildings on sovereign tribal lands' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'School buildings managed by the Broward County School Board' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'Railroads and related facilities' },
      ],
      'faq 5': [
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'For resubmissions or corrections of reports created before January 1, 2024, please email the updated/correct report to Fritchey@fortlauderdale.gov or to the following address.' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'Please DO NOT submit a new application as this will result in duplicate records.' },
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/LauderBuild', quote: 'Once the application package has been submitted for review Neighbors will not be able to upload additional documents without permission from City staff.' },
      ],
      'nextStep': [
        { page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program', quote: 'Between June 1 and August 31 each year, property owners and/or associations will receive a notice from the Building Official, by certified mail, when their building is due for inspection during that calendar year.' },
      ],
    },
  },
  'broward-bsip/hollywood': {
    office: [
      { page: 'https://www.hollywoodfl.org/328/Building', quote: 'Development Services Hub - Second Floor Library City Hall Circle 2600 Hollywood Blvd Hollywood, FL 33020' },
      { page: 'https://www.hollywoodfl.org/328/Building', quote: 'Building - 954.921.3335 Opt.1' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'as determined by the Building Official, who shall at such time issue a Notice of Required Inspection to the building owner or association.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'All new 25-Year or Older Building Safety Inspection Program (BSIP) reports must be submitted through the City of Hollywood’s Accela Citizen Access (ACA) Portal.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'Based on the review from the Plan Reviewers, if the submitted documents are in compliance a Certificate will be issued.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'for the City of Hollywood Building Division to review the property owner\'s 3rd party reports' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'The City’s Plan Reviewer will request the required permit after the BSIP Report is submitted and reviewed.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'please contact the Development Services Building Division, Assistant Building Official Daniel Quintana Ph.754.329.0563; Permit Services Support Coordinator Veroncia Barnes Ph.754.329.0641' },
      ],
      'heroSub': [
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'All new 25-Year or Older Building Safety Inspection Program (BSIP) reports must be submitted through the City of Hollywood’s Accela Citizen Access (ACA) Portal.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'Hard copies and mailed submissions are no longer accepted.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'for the City of Hollywood Building Division to review the property owner\'s 3rd party reports' },
      ],
      'local 1: The notice': [
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'as determined by the Building Official, who shall at such time issue a Notice of Required Inspection to the building owner or association.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'In late June, BORA sends our three (3) lists that will have all the properties who are due for their Building Safety Inspection.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'That list is posted to this webpage as soon as it is received.' },
      ],
      'local 2: Filing the report': [
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'All new 25-Year or Older Building Safety Inspection Program (BSIP) reports must be submitted through the City of Hollywood’s Accela Citizen Access (ACA) Portal.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'Hard copies and mailed submissions are no longer accepted.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'All required signatures must be digitally signed and validated through ACA portal. Handwritten or scanned signatures will not be accepted.' },
      ],
      'local 3: Before you file': [
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'The responsible Professional Engineer (PE) or Registered Architect (RA) must be registered and approved in ACA before the report is submitted.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'Intake staff must approve the PE or RA registration, prior to the report submittal.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'The Professional Engineer (PE) or Registered Architect (RA) responsible for preparing and signing the report must be selected in ACA as the design professional for the application.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'If the Professional Engineer (PE) or Registered Architect (RA) does not appear in ACA, the report cannot be submitted.' },
      ],
      'local 4: The city’s forms': [
        { page: 'https://www.hollywoodfl.org/DocumentCenter/View/89/Building-Safety-Inspection-Program-Report-Packet?bidId=', quote: 'TRANSMITTAL CHECKLIST FOR THE BUILDING SAFETY INSPECTION PROGRAM REPORT 1st submittal 2nd submittal' },
        { page: 'https://www.hollywoodfl.org/DocumentCenter/View/89/Building-Safety-Inspection-Program-Report-Packet?bidId=', quote: 'A current Broward County Building Safety Inspection Structural report was submitted indicating if repairs are required* or not required.' },
        { page: 'https://www.hollywoodfl.org/DocumentCenter/View/89/Building-Safety-Inspection-Program-Report-Packet?bidId=', quote: 'A current Broward County Building Safety Inspection Electrical report was submitted indicating if repairs are required* or not required.' },
        { page: 'https://www.hollywoodfl.org/DocumentCenter/View/89/Building-Safety-Inspection-Program-Report-Packet?bidId=', quote: 'Multiple stand-alone building structures cannot be combined in one report.' },
      ],
      'local 5: What goes with it': [
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'Completed Building Safety Inspection Program report, which includes structural and electrical inspections.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'Submit the completed BSIP Report, the photos of the existing condition' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'If repairs are required, provide a narrative or scope of work and include colored photos(pdf) of the area that requires repairs.' },
      ],
      'local 6: After filing': [
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'Based on the review from the Plan Reviewers, if the submitted documents are in compliance a Certificate will be issued.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'for the City of Hollywood Building Division to review the property owner\'s 3rd party reports' },
      ],
      'local 7: Repairs': [
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'If the BSIP Report identifies work that requires a building permit, the permit application must also be submitted through ACA.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'The City’s Plan Reviewer will request the required permit after the BSIP Report is submitted and reviewed.' },
        { page: 'https://www.hollywoodfl.org/DocumentCenter/View/89/Building-Safety-Inspection-Program-Report-Packet?bidId=', quote: 'Building Safety Inspection Report submittal after the required repairs have been corrected - please indicate the Permit#:' },
        { page: 'https://www.hollywoodfl.org/DocumentCenter/View/89/Building-Safety-Inspection-Program-Report-Packet?bidId=', quote: 'A permit may be required pending on the extent of the repairs.' },
      ],
      'local 8: Older names': [
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'Identifying a Building Division staff member who will be dedicated to monitoring the newly established 40-Year Recertification email where property owners can submit their recertification packets: BuildingReCertification@hollywoodfl.org' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'a notice is sent by the City to inform the building owner of record to have a structural inspection performed' },
        { page: 'https://www.hollywoodfl.org/DocumentCenter/View/18772/First-Notice-Letter', quote: 'Please mail or deliver your completed inspection report with fee to the above address and include your phone number and email address for further assistance.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'All new 25-Year or Older Building Safety Inspection Program (BSIP) reports must be submitted through the City of Hollywood’s Accela Citizen Access (ACA) Portal.' },
      ],
      'faq 1': [
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'All new 25-Year or Older Building Safety Inspection Program (BSIP) reports must be submitted through the City of Hollywood’s Accela Citizen Access (ACA) Portal.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'Hard copies and mailed submissions are no longer accepted.' },
        { page: 'https://www.hollywoodfl.org/1545/Permits', quote: 'Effective August 4, 2026, the City has transitioned to the ACA for all new permit applications.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'The responsible Professional Engineer (PE) or Registered Architect (RA) must be registered and approved in ACA before the report is submitted.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'Intake staff must approve the PE or RA registration, prior to the report submittal.' },
      ],
      'faq 2': [
        { page: 'https://www.hollywoodfl.org/DocumentCenter/View/19009/Broward-Building-Safety-Inspection-Program-FAQs', quote: 'You must contact the city or county building official where the property is located to complete an inspection before its scheduled time, to postpone an inspection or to extend the period for repairs.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'as determined by the Building Official, who shall at such time issue a Notice of Required Inspection to the building owner or association.' },
      ],
      'faq 3': [
        { page: 'https://www.hollywoodfl.org/DocumentCenter/View/18772/First-Notice-Letter', quote: 'This notice is for informational purposes only to notify you that your building is due for the Building Safety Inspection Program. Please contact your property manager or Condominium Association Board regarding inspections of your unit and/or common areas of your building.' },
      ],
      'faq 4': [
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'Non-compliant buildings could be posted with a “Notice of Violation”.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'If a property owner fails to respond to the posted Notice of Violation they could be referred to the Special Magistrate' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'If the building is determined to be unsafe, the matter could be forwarded to the Broward County Unsafe Structures Board.' },
      ],
      'faq 5': [
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'Identifying a Building Division staff member who will be dedicated to monitoring the newly established 40-Year Recertification email where property owners can submit their recertification packets: BuildingReCertification@hollywoodfl.org' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'All new 25-Year or Older Building Safety Inspection Program (BSIP) reports must be submitted through the City of Hollywood’s Accela Citizen Access (ACA) Portal.' },
      ],
      'nextStep': [
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'as determined by the Building Official, who shall at such time issue a Notice of Required Inspection to the building owner or association.' },
        { page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program', quote: 'for the City of Hollywood Building Division to review the property owner\'s 3rd party reports' },
      ],
    },
  },
  'broward-bsip/pompano-beach': {
    office: [
      { page: 'https://www.pompanobeachfl.gov/government/building-inspections', quote: 'Pompano City Hall - 3rd Floor 100 West Atlantic Boulevard, Pompano Beach, Florida 33060' },
      { page: 'https://www.pompanobeachfl.gov/government/building-inspections/contact-information', quote: 'Main Support Line 954-786-4669' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'Between June 1st and August 31st of each year, the Building Official shall send out a Notice of Required Inspection by certified mail to the owner or association of all Buildings that are due for their Building Inspection during that calendar year.' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'submit a written report including the Broward County Board of Rules and Appeals Structural and Electrical Safety Inspection Report Form to the Building Official' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'Building Safety Inspection Program Re-Inspection Affidavit' },
        { page: 'https://cdn.pompanobeachfl.gov/city/pages/building_inspections/BUILDING-SAFETY-PROGRAM-REINSPECTION-LETTERS-AFFIDAVIT-v.3_2023-08-21-214558.pdf', quote: 'Department of Development Services Building Inspections Division' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'the responsible Engineer or Architect who performed the Building Safety Inspection and issued the report shall provide the Building Owner and Building Official with a signed and sealed letter indicating whether the Building or Structure may continue to be safely occupied while the Building or Structure is undergoing repairs.' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'The Building Official may issue an extension of not more than 60 days to submit a Building Safety Inspection Report, or to obtain necessary permits, upon a written extension request from a Licensed Professional Engineer or Registered Architect qualified for the type of building or structure in question.' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/contact-information', quote: 'Jay Olsen Building Official 954.786.4672' },
      ],
      'heroSub': [
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'Between June 1st and August 31st of each year, the Building Official shall send out a Notice of Required Inspection by certified mail to the owner or association of all Buildings that are due for their Building Inspection during that calendar year.' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'submit a written report including the Broward County Board of Rules and Appeals Structural and Electrical Safety Inspection Report Form to the Building Official' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'a written report including the Broward County Board of Rules and Appeals Structural and Electrical Safety Inspection Report Form' },
      ],
      'local 1: The notice': [
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'Between June 1st and August 31st of each year, the Building Official shall send out a Notice of Required Inspection by certified mail to the owner or association of all Buildings that are due for their Building Inspection during that calendar year.' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'submit a written report including the Broward County Board of Rules and Appeals Structural and Electrical Safety Inspection Report Form to the Building Official' },
      ],
      'local 2: Filing the report': [
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'submit a written report including the Broward County Board of Rules and Appeals Structural and Electrical Safety Inspection Report Form to the Building Official' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'a written report including the Broward County Board of Rules and Appeals Structural and Electrical Safety Inspection Report Form' },
      ],
      'local 3: The city’s forms': [
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'a written report including the Broward County Board of Rules and Appeals Structural and Electrical Safety Inspection Report Form' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'Building Safety Inspection Program Re-Inspection Affidavit' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/applications-and-forms', quote: 'Prepared by an Engineer or Architect when re-inspecting a Building undergoing a required Safety Inspection process.' },
        { page: 'https://cdn.pompanobeachfl.gov/city/pages/building_inspections/BUILDING-SAFETY-PROGRAM-REINSPECTION-LETTERS-AFFIDAVIT-v.3_2023-08-21-214558.pdf', quote: 'Department of Development Services Building Inspections Division' },
      ],
      'local 4: After filing': [
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'Click Here to view Case Status and Pay Fees' },
        { page: 'https://c2g.pompanobeachfl.gov/Click2GovCE/index.html', quote: 'This service enables citizens and inspectors to perform case inquires and view case-related data online, including the case status and next course of action related to a case.' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/contact-information', quote: 'Charles Rizzuto Chief Building (Safety) Inspector 954.786.5559' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/contact-information', quote: 'Victoria Johnson Building Safety Compliance Secretary 954.545.7807' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/contact-information', quote: 'Hermine Lanauze Building Safety Compliance Officer 954.786.7831' },
      ],
      'local 5: Repairs': [
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'the responsible Engineer or Architect who performed the Building Safety Inspection and issued the report shall provide the Building Owner and Building Official with a signed and sealed letter indicating whether the Building or Structure may continue to be safely occupied while the Building or Structure is undergoing repairs.' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'This letter shall be valid for no more than 180 days, and a new letter issued if repairs or modifications remain ongoing.' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'shall re-inspect the areas noted on the original report and provide the Building Owner and Building Official an amended report with a signed and sealed letter stating that all of the required repairs and corrections have been completed and that the Building or Structure has been certified for continued use.' },
      ],
      'local 6: The Re-Inspection Affidavit': [
        { page: 'https://cdn.pompanobeachfl.gov/city/pages/building_inspections/BUILDING-SAFETY-PROGRAM-REINSPECTION-LETTERS-AFFIDAVIT-v.3_2023-08-21-214558.pdf', quote: 'Please submit this affidavit to the Building Official (either electronically with electronic signature/seal, or hand delivered if mechanically signed with embossed or wet seal)' },
        { page: 'https://cdn.pompanobeachfl.gov/city/pages/building_inspections/BUILDING-SAFETY-PROGRAM-REINSPECTION-LETTERS-AFFIDAVIT-v.3_2023-08-21-214558.pdf', quote: 'I have re-inspected the areas noted on the original Broward County Building Safety Inspection Report, COPB Permit / Case #' },
        { page: 'https://cdn.pompanobeachfl.gov/city/pages/building_inspections/BUILDING-SAFETY-PROGRAM-REINSPECTION-LETTERS-AFFIDAVIT-v.3_2023-08-21-214558.pdf', quote: 'Report have been successfully completed by the work detailed in the referenced Restoration Permit Number(s).' },
        { page: 'https://cdn.pompanobeachfl.gov/city/pages/building_inspections/BUILDING-SAFETY-PROGRAM-REINSPECTION-LETTERS-AFFIDAVIT-v.3_2023-08-21-214558.pdf', quote: 'Report were minor in nature, did not require permit, and were successfully completed.' },
      ],
      'local 7: Extensions': [
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'The Building Official may issue an extension of not more than 60 days to submit a Building Safety Inspection Report, or to obtain necessary permits, upon a written extension request from a Licensed Professional Engineer or Registered Architect qualified for the type of building or structure in question.' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'Such a request shall contain a signed and sealed statement from the Engineer or Architect that the Building may continue to be occupied while undergoing the Building Safety Inspection and Certification process.' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'For deficiencies that cannot be corrected within 180 days, the time frame may be extended when a new time frame is specified by the responsible Licensed Professional Engineer or Registered Architect and approved by the Building Official.' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'Such extension shall be contingent on maintaining an active Building Permit for repairs.' },
      ],
      'local 8: Who is exempt': [
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'Single-family, two-family, three-family, and four-family dwellings with three or fewer habitable stories above ground.' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'Minor Structures, defined as buildings or structures in any occupancy group having a building area less than three thousand five hundred (3,500) square feet.' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'Fee Simple Townhouses as defined in the Florida Building Code' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'U.S. Government Buildings State of Florida Buildings Buildings built on sovereign tribal lands School Buildings under the jurisdiction of the Broward County School Board' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'Railroads and ancillary facilities associated with the railroad.' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'Structures to be included in the Safety Inspection Program are elevated decks, balconies, docks, and seawalls if attached to or supporting any structure. Parking garages, guardrails, and as such, are not exempt from this program.' },
      ],
      'faq 1': [
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'Between June 1st and August 31st of each year, the Building Official shall send out a Notice of Required Inspection by certified mail to the owner or association of all Buildings that are due for their Building Inspection during that calendar year.' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'submit a written report including the Broward County Board of Rules and Appeals Structural and Electrical Safety Inspection Report Form to the Building Official' },
      ],
      'faq 2': [
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'submit a written report including the Broward County Board of Rules and Appeals Structural and Electrical Safety Inspection Report Form to the Building Official' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'a written report including the Broward County Board of Rules and Appeals Structural and Electrical Safety Inspection Report Form' },
        { page: 'https://cdn.pompanobeachfl.gov/city/pages/building_inspections/BUILDING-SAFETY-PROGRAM-REINSPECTION-LETTERS-AFFIDAVIT-v.3_2023-08-21-214558.pdf', quote: 'Please submit this affidavit to the Building Official (either electronically with electronic signature/seal, or hand delivered if mechanically signed with embossed or wet seal)' },
      ],
      'faq 3': [
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'a written report including the Broward County Board of Rules and Appeals Structural and Electrical Safety Inspection Report Form' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'Building Safety Inspection Program Re-Inspection Affidavit' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/applications-and-forms', quote: 'Prepared by an Engineer or Architect when re-inspecting a Building undergoing a required Safety Inspection process.' },
        { page: 'https://cdn.pompanobeachfl.gov/city/pages/building_inspections/BUILDING-SAFETY-PROGRAM-REINSPECTION-LETTERS-AFFIDAVIT-v.3_2023-08-21-214558.pdf', quote: 'Department of Development Services Building Inspections Division' },
        { page: 'https://cdn.pompanobeachfl.gov/city/pages/building_inspections/BUILDING-SAFETY-PROGRAM-REINSPECTION-LETTERS-AFFIDAVIT-v.3_2023-08-21-214558.pdf', quote: 'I have re-inspected the areas noted on the original Broward County Building Safety Inspection Report, COPB Permit / Case #' },
        { page: 'https://cdn.pompanobeachfl.gov/city/pages/building_inspections/BUILDING-SAFETY-PROGRAM-REINSPECTION-LETTERS-AFFIDAVIT-v.3_2023-08-21-214558.pdf', quote: 'Report have been successfully completed by the work detailed in the referenced Restoration Permit Number(s).' },
      ],
      'faq 4': [
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'The Building Official may issue an extension of not more than 60 days to submit a Building Safety Inspection Report, or to obtain necessary permits, upon a written extension request from a Licensed Professional Engineer or Registered Architect qualified for the type of building or structure in question.' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'Such a request shall contain a signed and sealed statement from the Engineer or Architect that the Building may continue to be occupied while undergoing the Building Safety Inspection and Certification process.' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'For deficiencies that cannot be corrected within 180 days, the time frame may be extended when a new time frame is specified by the responsible Licensed Professional Engineer or Registered Architect and approved by the Building Official.' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'Such extension shall be contingent on maintaining an active Building Permit for repairs.' },
      ],
      'faq 5': [
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'Between June 1st and August 31st of each year, the Building Official shall send out a Notice of Required Inspection by certified mail to the owner or association of all Buildings that are due for their Building Inspection during that calendar year.' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'submit a written report including the Broward County Board of Rules and Appeals Structural and Electrical Safety Inspection Report Form to the Building Official' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'the responsible Engineer or Architect who performed the Building Safety Inspection and issued the report shall provide the Building Owner and Building Official with a signed and sealed letter indicating whether the Building or Structure may continue to be safely occupied while the Building or Structure is undergoing repairs.' },
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'The Building Official may issue an extension of not more than 60 days to submit a Building Safety Inspection Report, or to obtain necessary permits, upon a written extension request from a Licensed Professional Engineer or Registered Architect qualified for the type of building or structure in question.' },
      ],
      'nextStep': [
        { page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program', quote: 'Between June 1st and August 31st of each year, the Building Official shall send out a Notice of Required Inspection by certified mail to the owner or association of all Buildings that are due for their Building Inspection during that calendar year.' },
      ],
    },
  },
  'broward-bsip/hallandale-beach': {
    office: [
      { page: 'https://www.hallandalebeachfl.gov/1036/Building-Division', quote: 'Physical Address 400 South Federal Highway Hallandale Beach, FL 33009' },
      { page: 'https://www.hallandalebeachfl.gov/1036/Building-Division', quote: 'Phone: (954) 457-2220 Dial OPTION 2' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.hallandalebeachfl.gov/1479/Building-Safety-Inspection-Program', quote: 'By June of each year, the Broward County Board of Rules and Appeals (BORA) will provide each local jurisdiction with a list of buildings and structures due for a Building Safety Inspection.' },
        { page: 'https://www.hallandalebeachfl.gov/1479/Building-Safety-Inspection-Program', quote: 'From June through August, the building official will notify the building owner or association by certified mail return receipt that their properties are due for an inspection.' },
        { page: 'https://www.hallandalebeachfl.gov/DocumentCenter/View/26591', quote: 'The City of Hallandale Beach Building Division sends out notifications to all properties on our 40 year certification or subsequent 10 year recertification list.' },
        { page: 'https://www.hallandalebeachfl.gov/1479/Building-Safety-Inspection-Program', quote: 'CLICK HERE TO SUBMIT YOUR BUILDING SAFETY INSPECTION REPORT' },
        { page: 'https://hallandalefl-energovpub.tylerhost.net/Apps/SelfService#/home', quote: 'Welcome to the Hallandale Beach Self-Service Portal' },
      ],
      'heroSub': [
        { page: 'https://www.hallandalebeachfl.gov/DocumentCenter/View/26591', quote: 'The City of Hallandale Beach Building Division sends out notifications to all properties on our 40 year certification or subsequent 10 year recertification list.' },
        { page: 'https://www.hallandalebeachfl.gov/1479/Building-Safety-Inspection-Program', quote: 'CLICK HERE TO SUBMIT YOUR BUILDING SAFETY INSPECTION REPORT' },
        { page: 'https://hallandalefl-energovpub.tylerhost.net/Apps/SelfService#/home', quote: 'Welcome to the Hallandale Beach Self-Service Portal' },
      ],
      'local 1: The notice': [
        { page: 'https://www.hallandalebeachfl.gov/1479/Building-Safety-Inspection-Program', quote: 'By June of each year, the Broward County Board of Rules and Appeals (BORA) will provide each local jurisdiction with a list of buildings and structures due for a Building Safety Inspection.' },
        { page: 'https://www.hallandalebeachfl.gov/1479/Building-Safety-Inspection-Program', quote: 'From June through August, the building official will notify the building owner or association by certified mail return receipt that their properties are due for an inspection.' },
        { page: 'https://www.hallandalebeachfl.gov/DocumentCenter/View/26591', quote: 'The City of Hallandale Beach Building Division sends out notifications to all properties on our 40 year certification or subsequent 10 year recertification list.' },
      ],
      'local 2: Filing the report': [
        { page: 'https://www.hallandalebeachfl.gov/1479/Building-Safety-Inspection-Program', quote: 'CLICK HERE TO SUBMIT YOUR BUILDING SAFETY INSPECTION REPORT' },
        { page: 'https://hallandalefl-energovpub.tylerhost.net/Apps/SelfService#/home', quote: 'Welcome to the Hallandale Beach Self-Service Portal' },
        { page: 'https://hallandalefl-energovpub.tylerhost.net/Apps/SelfService#/home', quote: 'Login to an existing or create a new account. You can also find help if you forgot your login information.' },
      ],
      'local 3: The city’s forms': [
        { page: 'https://www.hallandalebeachfl.gov/1296/Inspections', quote: 'The Florida Licensed Professional shall issue a written report, including the BORA structural and electrical safety inspection report forms, to the Building Official and the owner or association.' },
        { page: 'https://www.hallandalebeachfl.gov/1271/Applications-Forms', quote: 'Building Safety Inspection Program STRUCTURAL Inspection Form PDF' },
        { page: 'https://www.hallandalebeachfl.gov/1271/Applications-Forms', quote: 'Building Safety Inspection Program ELECTRICAL Inspection Form PDF' },
        { page: 'https://www.hallandalebeachfl.gov/1271/Applications-Forms', quote: 'Building Safety Inspection Program General Considerations Guidelines (Policy 05-05) PDF' },
        { page: 'https://www.hallandalebeachfl.gov/DocumentCenter/View/35782/Building-Safety-Inspection-Program-Board-Policy-05-05', quote: 'Effective Date: August 9, 2024' },
        { page: 'https://www.hallandalebeachfl.gov/1271/Applications-Forms', quote: 'Effective 10/1/22, third-party verification will be required for ALL digitally signed and sealed documents. Plans will be rejected if the signature isn’t verifiable.' },
      ],
      'local 4: After filing': [
        { page: 'https://www.hallandalebeachfl.gov/1479/Building-Safety-Inspection-Program', quote: 'Once the report is reviewed and any repairs made, the building will be certified safe for continued occupancy for the next ten years.' },
        { page: 'https://hallandalebeachfl.gov/FAQ.aspx?TID=48', quote: 'View our list of properties that have had inspections and whether or not the property passed by visiting our webpage at www.CoHB.org/SafetyInspection' },
      ],
      'local 5: Repairs': [
        { page: 'https://www.hallandalebeachfl.gov/1479/Building-Safety-Inspection-Program', quote: 'The report produced will identify any deficiencies, which will necessitate a repair permit.' },
        { page: 'https://www.hallandalebeachfl.gov/DocumentCenter/View/26587', quote: 'All repairs or modifications shall be completed in conformance with all applicable sections of the Florida Existing Building Code and the National Electrical Code.' },
        { page: 'https://www.hallandalebeachfl.gov/DocumentCenter/View/26587', quote: 'Repairs or modifications of deficient conditions that are incidental and non-life threatening shall be completed within a time frame as specified by the inspecting Professional Engineer or Registered Architect and approved by the Building Official.' },
        { page: 'https://www.hallandalebeachfl.gov/DocumentCenter/View/26587', quote: 'Date: 6/30/2021' },
      ],
      'local 6: Extensions': [
        { page: 'https://hallandalebeachfl.gov/FAQ.aspx?TID=48', quote: 'If a property did not meet the 180-day deadline, an extension must be requested. Extensions are granted by the Building Official depending on the situation and complexity of the required work.' },
        { page: 'https://www.hallandalebeachfl.gov/DocumentCenter/View/26587', quote: 'For deficiencies that cannot be corrected within 180 days, the time frame may be extended when a time frame is specified by the Professional Engineer or Registered Architect and approved by the Building Official.' },
        { page: 'https://www.hallandalebeachfl.gov/DocumentCenter/View/26587', quote: 'Such extension shall be contingent on maintaining an active building permit as specified in Florida Building Code Section 105.11.2.3 (Broward County Administrative Provisions).' },
      ],
      'local 7: If it is late': [
        { page: 'https://hallandalebeachfl.gov/FAQ.aspx?TID=48', quote: 'If the report finds critical safety concerns, or if the property is non-compliant (no efforts to apply for permits), the Building Official can recommend the structure be deemed unsafe to the Unsafe Structures Board.' },
        { page: 'https://www.hallandalebeachfl.gov/DocumentCenter/View/26587', quote: 'Failure to recertify buildings that are 40 years old or older shall cause unsafe structure proceedings in accordance with Florida Building Code Section 116 (Broward County Administrative Provisions).' },
      ],
      'local 8: Who is exempt': [
        { page: 'https://www.hallandalebeachfl.gov/1479/Building-Safety-Inspection-Program', quote: 'One and two-family dwellings, U.S Government, State of Florida buildings, schools under the jurisdiction of the Broward County School Boards and buildings built on Indian Reservations are exempt from this program.' },
        { page: 'https://www.hallandalebeachfl.gov/1479/Building-Safety-Inspection-Program', quote: 'The Broward program also excludes all buildings under 3,500 square feet.' },
        { page: 'https://hallandalebeachfl.gov/FAQ.aspx?TID=48', quote: 'The inspection will not be waived unless the ENTIRE building was demolished.' },
      ],
      'faq 1': [
        { page: 'https://www.hallandalebeachfl.gov/1479/Building-Safety-Inspection-Program', quote: 'CLICK HERE TO SUBMIT YOUR BUILDING SAFETY INSPECTION REPORT' },
        { page: 'https://hallandalefl-energovpub.tylerhost.net/Apps/SelfService#/home', quote: 'Welcome to the Hallandale Beach Self-Service Portal' },
        { page: 'https://www.hallandalebeachfl.gov/1036/Building-Division', quote: 'Please note: All permit-related documents must be submitted through our online portal. Documents sent by email to bldgpermitsupport@cohb.org will not be processed.' },
        { page: 'https://www.hallandalebeachfl.gov/1036/Building-Division', quote: 'While walk-ins are welcome, appointments are preferred. We strongly encourage you to make an in-person, appointment by contacting us at (954) 457-2220 dial OPTION 2' },
      ],
      'faq 2': [
        { page: 'https://hallandalebeachfl.gov/FAQ.aspx?TID=48', quote: 'No. The City’s review is based totally on the engineer’s report. Their seal certifies the integrity of the report. Repairs will be required as stated by the architect/engineer.' },
        { page: 'https://hallandalebeachfl.gov/FAQ.aspx?TID=48', quote: 'The licensed professional engineer or registered architect will use their discretion to determine how many units will be inspected.' },
        { page: 'https://hallandalebeachfl.gov/FAQ.aspx?TID=48', quote: 'The purpose of the inspection is to address structural and electrical life, health, and safety issues; not aesthetic changes.' },
      ],
      'faq 3': [
        { page: 'https://www.hallandalebeachfl.gov/DocumentCenter/View/26587', quote: 'If you feel that we have mis-classified your building and it falls within these exemptions, please notify us in writing.' },
        { page: 'https://hallandalebeachfl.gov/FAQ.aspx?TID=48', quote: 'If you are aware that a building, 40 years or older has not been certified, is not listed, or shows signs of severe damage, please notify us on MyHB App or email us at buildingsafety@cohb.org' },
      ],
      'faq 4': [
        { page: 'https://cohb.org/1432/Condominium-Registration', quote: 'Condominium Associations, Multi-Family Homeowner, and Cooperative Apartment Associations operating their property within the City of Hallandale Beach are required to complete an annual registration in accordance to Section 9-9 and 9-10 of the City\'s Code of Ordinances.' },
        { page: 'https://cohb.org/1432/Condominium-Registration', quote: 'The status of recertification. Association will indicate either:' },
        { page: 'https://cohb.org/1432/Condominium-Registration', quote: 'A copy of any report of a professional engineer or architect concerning the structural, electrical or life safety conditions of a building within the control of the association issued within the previous year.' },
      ],
      'faq 5': [
        { page: 'https://www.hallandalebeachfl.gov/DocumentCenter/View/26591', quote: 'The City of Hallandale Beach Building Division sends out notifications to all properties on our 40 year certification or subsequent 10 year recertification list.' },
        { page: 'https://www.hallandalebeachfl.gov/DocumentCenter/View/26587', quote: 'Date: 6/30/2021' },
        { page: 'https://www.hallandalebeachfl.gov/DocumentCenter/View/26587', quote: 'Failure to recertify buildings that are 40 years old or older shall cause unsafe structure proceedings in accordance with Florida Building Code Section 116 (Broward County Administrative Provisions).' },
      ],
      'nextStep': [
        { page: 'https://www.hallandalebeachfl.gov/1479/Building-Safety-Inspection-Program', quote: 'From June through August, the building official will notify the building owner or association by certified mail return receipt that their properties are due for an inspection.' },
        { page: 'https://www.hallandalebeachfl.gov/DocumentCenter/View/26591', quote: 'The City of Hallandale Beach Building Division sends out notifications to all properties on our 40 year certification or subsequent 10 year recertification list.' },
      ],
    },
  },
  'broward-bsip/deerfield-beach': {
    office: [
      { page: 'https://www.deerfield-beach.com/294/Building-Services', quote: 'Building Services 150 N.E. 2nd Ave. Deerfield Beach, FL 33441' },
      { page: 'https://www.deerfield-beach.com/294/Building-Services', quote: 'For assistance with permit applications, requirements, or submission information, please contact the Building Department directly at 954-250-4060.' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.deerfield-beach.com/1012/Applications-Forms', quote: 'Building Safety Inspection Report BORA Policy 05-05' },
        { page: 'https://www.deerfield-beach.com/1012/Applications-Forms', quote: 'Building Safety Inspection Guidelines Policy 05-05' },
        { page: 'https://www.deerfield-beach.com/1012/Applications-Forms', quote: 'Building Safety Inspection Form - Structural' },
        { page: 'https://www.deerfield-beach.com/1012/Applications-Forms', quote: 'Building Safety Inspection Form - Electrical' },
        { page: 'https://www.deerfield-beach.com/294/Building-Services', quote: 'CAP Government will be responsible for performing all duties related to the Florida Building Code (FBC) including permit applications, plan approvals, inspections and permit close-out.' },
        { page: 'https://www.deerfield-beach.com/294/Building-Services', quote: 'Starting on December 15th 2025, all new permit applications and plans can be submitted online by clicking the “Online Permit Submittal” button below.' },
      ],
      'heroSub': [
        { page: 'https://www.deerfield-beach.com/294/Building-Services', quote: 'The division complies with guidelines established by the Florida Building Commission and Broward County Board of Rules & Appeals and is responsible for the identification and removal of unsafe structures in conjunction with the Unsafe Structure Board.' },
        { page: 'https://www.deerfield-beach.com/1012/Applications-Forms', quote: 'Building Safety Inspection Form - Structural' },
        { page: 'https://www.deerfield-beach.com/1012/Applications-Forms', quote: 'Building Safety Inspection Form - Electrical' },
      ],
      'local 1: The city’s forms': [
        { page: 'https://www.deerfield-beach.com/1012/Applications-Forms', quote: 'Building Safety Inspection Report BORA Policy 05-05' },
        { page: 'https://www.deerfield-beach.com/1012/Applications-Forms', quote: 'Building Safety Inspection Guidelines Policy 05-05' },
        { page: 'https://www.deerfield-beach.com/1012/Applications-Forms', quote: 'Building Safety Inspection Form - Structural' },
        { page: 'https://www.deerfield-beach.com/1012/Applications-Forms', quote: 'Building Safety Inspection Form - Electrical' },
        { page: 'https://www.deerfield-beach.com/DocumentCenter/View/20074/ELECTRICAL---Building-Safety-Inspection-Form', quote: 'Rev. May 11, 2023 (v2) Broward County BORA – Policy 05-05 ELECTRICAL SAFETY INSPECTION REPORT FORM' },
      ],
      'local 2: Filing the report': [
        { page: 'https://www.deerfield-beach.com/294/Building-Services', quote: 'Starting on December 15th 2025, all new permit applications and plans can be submitted online by clicking the “Online Permit Submittal” button below.' },
        { page: 'https://www.deerfield-beach.com/294/Building-Services', quote: 'In person, permit applications and plans can still be accommodated by visiting the Building Division in City Hall.' },
      ],
      'local 3: The office': [
        { page: 'https://www.deerfield-beach.com/294/Building-Services', quote: 'The division complies with guidelines established by the Florida Building Commission and Broward County Board of Rules & Appeals and is responsible for the identification and removal of unsafe structures in conjunction with the Unsafe Structure Board.' },
        { page: 'https://www.deerfield-beach.com/294/Building-Services', quote: 'CAP Government will be responsible for performing all duties related to the Florida Building Code (FBC) including permit applications, plan approvals, inspections and permit close-out.' },
      ],
      'local 4: Repairs': [
        { page: 'https://www.deerfield-beach.com/1012/Applications-Forms', quote: 'Please note - all permit applications require the owner\'s signature in Deerfield Beach.' },
        { page: 'https://www.deerfield-beach.com/294/Building-Services', quote: 'Submittal of the DFB HOA Affidavit is required for all residential permits.' },
      ],
      'local 5: If it is late': [
        { page: 'https://www.deerfield-beach.com/294/Building-Services', quote: 'The division complies with guidelines established by the Florida Building Commission and Broward County Board of Rules & Appeals and is responsible for the identification and removal of unsafe structures in conjunction with the Unsafe Structure Board.' },
      ],
      'local 6: Not on the city’s pages': [
        { page: 'https://www.deerfield-beach.com/294/Building-Services', quote: 'For assistance with permit applications, requirements, or submission information, please contact the Building Department directly at 954-250-4060.' },
      ],
      'faq 1': [
        { page: 'https://www.deerfield-beach.com/1012/Applications-Forms', quote: 'Building Safety Inspection Report BORA Policy 05-05' },
        { page: 'https://www.deerfield-beach.com/1012/Applications-Forms', quote: 'Building Safety Inspection Guidelines Policy 05-05' },
        { page: 'https://www.deerfield-beach.com/1012/Applications-Forms', quote: 'Building Safety Inspection Form - Structural' },
        { page: 'https://www.deerfield-beach.com/1012/Applications-Forms', quote: 'Building Safety Inspection Form - Electrical' },
      ],
      'faq 2': [
        { page: 'https://www.deerfield-beach.com/294/Building-Services', quote: 'Starting on December 15th 2025, all new permit applications and plans can be submitted online by clicking the “Online Permit Submittal” button below.' },
        { page: 'https://www.deerfield-beach.com/294/Building-Services', quote: 'In person, permit applications and plans can still be accommodated by visiting the Building Division in City Hall.' },
        { page: 'https://deerfieldbeach.geocivix.com/secure/', quote: 'DEERFIELD BEACH BUILDING SERVICES DIGITAL PERMITTING PORTAL' },
      ],
      'faq 3': [
        { page: 'https://www.deerfield-beach.com/1012/Applications-Forms', quote: 'Building Safety Inspection Report BORA Policy 05-05' },
        { page: 'https://www.deerfield-beach.com/294/Building-Services', quote: 'The division complies with guidelines established by the Florida Building Commission and Broward County Board of Rules & Appeals and is responsible for the identification and removal of unsafe structures in conjunction with the Unsafe Structure Board.' },
      ],
      'faq 4': [
        { page: 'https://www.deerfield-beach.com/1012/Applications-Forms', quote: 'Building Safety Inspection Report BORA Policy 05-05' },
      ],
      'faq 5': [
        { page: 'https://www.deerfield-beach.com/1012/Applications-Forms', quote: 'Building Safety Inspection Report BORA Policy 05-05' },
        { page: 'https://www.deerfield-beach.com/DocumentCenter/View/20073/BORA-Board-Policy-05-05---Building-Safety-Inspection-Report', quote: 'Effective Date: August 9, 2024' },
      ],
      'nextStep': [
        { page: 'https://www.deerfield-beach.com/294/Building-Services', quote: 'The division complies with guidelines established by the Florida Building Commission and Broward County Board of Rules & Appeals and is responsible for the identification and removal of unsafe structures in conjunction with the Unsafe Structure Board.' },
      ],
    },
  },
  'broward-bsip/pembroke-pines': {
    office: [
      { page: 'https://www.ppines.com/164/The-Building-Department', quote: '601 City Center Way, 2nd Floor' },
      { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Contact the Building Department at (954) 435-6502' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Once your inspection reports are ready, you can submit them to the Building Department using one of the options below:' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'If your building is due for inspection under the Building Safety Inspection Program (BSIP), a BSIP permit number will be assigned to your property.' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'The property owner listed on the Broward County Property Appraiser (BCPA) website will receive a notification letter in the mail regarding the Building Safety Inspection Program referencing your assigned BSIP permit number.' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Cover Sheet (Transmittal Letter) including your BSIP permit number' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Contact the Building Department at (954) 435-6502 or email ppinessafetyprogram@cgasolutions.com to link your account to your BSIP permit number' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Be sure to include your BSIP permit number on your application so your repair permit can be properly linked to your Building Safety Inspection Program permit number.' },
      ],
      'heroSub': [
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Once your inspection reports are ready, you can submit them to the Building Department using one of the options below:' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'In-Person Submittal' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'To submit online, you must have an account with the Development Hub.' },
      ],
      'local 1: The notice': [
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'If your building is due for inspection under the Building Safety Inspection Program (BSIP), a BSIP permit number will be assigned to your property.' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'The property owner listed on the Broward County Property Appraiser (BCPA) website will receive a notification letter in the mail regarding the Building Safety Inspection Program referencing your assigned BSIP permit number.' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Cover Sheet (Transmittal Letter) including your BSIP permit number' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Contact the Building Department at (954) 435-6502 or email ppinessafetyprogram@cgasolutions.com to link your account to your BSIP permit number' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Be sure to include your BSIP permit number on your application so your repair permit can be properly linked to your Building Safety Inspection Program permit number.' },
      ],
      'local 2: Filing the report': [
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Once your inspection reports are ready, you can submit them to the Building Department using one of the options below:' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'In-Person Submittal' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'To submit online, you must have an account with the Development Hub.' },
        { page: 'https://www.ppines.com/164/The-Building-Department', quote: 'Charles F. Dodge City Center' },
      ],
      'local 3: In person': [
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'In-Person Submittal' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Cover Sheet (Transmittal Letter) including your BSIP permit number' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Structural Safety Inspection Report Form' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Electrical Safety Inspection Report Form' },
        { page: 'https://www.ppines.com/1665/Information-Forms', quote: 'Transmittal Letter Sheet' },
        { page: 'https://www.ppines.com/DocumentCenter/View/26313/Transmittal-Letter-Sheet', quote: 'TRANSMITTAL LETTER' },
        { page: 'https://www.ppines.com/DocumentCenter/View/26313/Transmittal-Letter-Sheet', quote: 'Permit Number: Date:' },
      ],
      'local 4: The Development Hub': [
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'To submit online, you must have an account with the Development Hub.' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Contact the Building Department at (954) 435-6502 or email ppinessafetyprogram@cgasolutions.com to link your account to your BSIP permit number' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Once linked, log in and locate your permit in your dashboard (or use the search tool)' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Open the permit and upload your documents under the “Attachments” tab:' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Upload each document separately' },
      ],
      'local 5: The city’s forms': [
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Structural Safety Inspection Report Form' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Electrical Safety Inspection Report Form' },
        { page: 'https://www.ppines.com/DocumentCenter/View/26542', quote: 'Broward County BORA – Policy 05-05' },
        { page: 'https://www.ppines.com/DocumentCenter/View/26541', quote: 'Broward County BORA – Policy 05-05' },
      ],
      'local 6: Repairs': [
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'If repairs are required as part of the Building Safety Inspection Program (BSIP), you will need to apply for the appropriate permit:' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Structural Repairs: Apply under Structural Miscellaneous' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Electrical Repairs: Apply under Electrical Miscellaneous' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Be sure to include your BSIP permit number on your application so your repair permit can be properly linked to your Building Safety Inspection Program permit number.' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'The most current Broward County Uniform Building Permit Application referencing your BSIP permit number (no white-out allowed)' },
        { page: 'https://www.ppines.com/1827/Apply-For-a-Building-Permit', quote: 'As of April 25, 2022, the City no longer accepts permit applications by email.' },
      ],
      'local 7: Plans for the repairs': [
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'All plans must be physically signed and sealed. Digital signatures will not be accepted for in-person submissions.' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Construction plans that are digitally signed and sealed' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'All required documents must be uploaded at the time of submission' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Once submitted, you will not be able to upload additional documents until the review cycle is complete' },
      ],
      'local 8: After filing': [
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Follow-up inspections may be required to ensure compliance' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'If a repair is required, once the repair permit is complete an updated Safety Inspection Report Form must be submitted to your BSIP permit number in order to satisfy the Building Safety Inspection Program' },
      ],
      'faq 1': [
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'If your building is due for inspection under the Building Safety Inspection Program (BSIP), a BSIP permit number will be assigned to your property.' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'The property owner listed on the Broward County Property Appraiser (BCPA) website will receive a notification letter in the mail regarding the Building Safety Inspection Program referencing your assigned BSIP permit number.' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Cover Sheet (Transmittal Letter) including your BSIP permit number' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Contact the Building Department at (954) 435-6502 or email ppinessafetyprogram@cgasolutions.com to link your account to your BSIP permit number' },
      ],
      'faq 2': [
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Once your inspection reports are ready, you can submit them to the Building Department using one of the options below:' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'In-Person Submittal' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Cover Sheet (Transmittal Letter) including your BSIP permit number' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'To submit online, you must have an account with the Development Hub.' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Contact the Building Department at (954) 435-6502 or email ppinessafetyprogram@cgasolutions.com to link your account to your BSIP permit number' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Open the permit and upload your documents under the “Attachments” tab:' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Upload each document separately' },
      ],
      'faq 3': [
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Structural Safety Inspection Report Form' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Electrical Safety Inspection Report Form' },
        { page: 'https://www.ppines.com/DocumentCenter/View/26542', quote: 'Broward County BORA – Policy 05-05' },
        { page: 'https://www.ppines.com/DocumentCenter/View/26541', quote: 'Broward County BORA – Policy 05-05' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Cover Sheet (Transmittal Letter) including your BSIP permit number' },
      ],
      'faq 4': [
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Structural Repairs: Apply under Structural Miscellaneous' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Electrical Repairs: Apply under Electrical Miscellaneous' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Be sure to include your BSIP permit number on your application so your repair permit can be properly linked to your Building Safety Inspection Program permit number.' },
        { page: 'https://www.ppines.com/1665/Information-Forms', quote: 'Additionally, if your property use is listed as “04 – Condominium” on the Broward County Property Appraiser website, a Condominium Approval Letter must be provided as part of your permit submittal.' },
        { page: 'https://www.ppines.com/1665/Information-Forms', quote: 'This letter must be signed and notarized by a registered agent listed with Sunbiz confirming the condominium association is aware of the proposed work.' },
        { page: 'https://www.ppines.com/1665/Information-Forms', quote: 'When applying for a building permit with the City of Pembroke Pines, a Homeowner\'s Association Affidavit of Awareness (HOA) form is required with every permit submittal, regardless of whether your property is located in an HOA community.' },
      ],
      'faq 5': [
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Property owners are responsible for completing inspections on time and ensuring their building remains in compliance with all safety requirements.' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'For assistance regarding The Building Safety Inspection Program please contact us via email at ppinessafetyprogram@cgasolutions.com' },
      ],
      'nextStep': [
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'The property owner listed on the Broward County Property Appraiser (BCPA) website will receive a notification letter in the mail regarding the Building Safety Inspection Program referencing your assigned BSIP permit number.' },
        { page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program', quote: 'Once your inspection reports are ready, you can submit them to the Building Department using one of the options below:' },
      ],
    },
  },
  'broward-bsip/miramar': {
    office: [
      { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'City of Miramar – Building, Planning & Zoning 2200 Civic Center Place, Miramar, FL 33025' },
      { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Phone: (954) 602-3200' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.miramarfl.gov/files/assets/public/v/2/buildingplanningzoning/documents/application-and-forms/recertification-bsip-requirements-and-forms.pdf', quote: 'City of |Miramar Building Division Building, Planning & Zoning Department 2200 Civic Center Place | Miramar, Florida 33025 Tel: 954.602.3200 | Fax: 954.602.3635' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/Applications-Forms', quote: 'Recertification / BSIP – Requirements & Forms(PDF, 844KB)' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'All BSIP documents must be submitted through the City of Miramar permitting system:' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Will a Building Code Inspector come out? No. Review is based solely on the licensed architect/engineer’s sealed report.' },
      ],
      'heroSub': [
        { page: 'https://www.miramarfl.gov/files/assets/public/v/2/buildingplanningzoning/documents/application-and-forms/recertification-bsip-requirements-and-forms.pdf', quote: 'City of |Miramar Building Division Building, Planning & Zoning Department 2200 Civic Center Place | Miramar, Florida 33025 Tel: 954.602.3200 | Fax: 954.602.3635' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/Applications-Forms', quote: 'Recertification / BSIP – Requirements & Forms(PDF, 844KB)' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'All BSIP documents must be submitted through the City of Miramar permitting system:' },
      ],
      'local 1: The notice': [
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Property owners will receive a Notice of Required Inspection' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'BCPA records will be checked and updated if a new owner is listed. If BCPA still lists you as owner, you must contact them directly.' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'What if the building is not 25 years old? The Building Division will verify the age with the Broward County Property Appraiser’s Office.' },
      ],
      'local 2: Filing the report': [
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'All BSIP documents must be submitted through the City of Miramar permitting system:' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Permit Type: BSIP → Residential BSIP or Commercial BSIP' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/Permitting-Information', quote: 'E-Permitting / Citizen Self Service (CSS Portal) Submit permit applications, upload required documents, pay fees, request inspections, and view permit and inspection status online.' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'For assistance: bsip@miramarfl.gov' },
      ],
      'local 3: The city’s forms': [
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/Applications-Forms', quote: 'Recertification / BSIP – Requirements & Forms(PDF, 844KB)' },
        { page: 'https://www.miramarfl.gov/files/assets/public/v/2/buildingplanningzoning/documents/application-and-forms/recertification-bsip-requirements-and-forms.pdf', quote: 'Detailed information about the program Guidelines for buildings to be inspected by design professionals hired by private building owners Structural and electrical report forms' },
        { page: 'https://www.miramarfl.gov/files/assets/public/v/2/buildingplanningzoning/documents/application-and-forms/recertification-bsip-requirements-and-forms.pdf', quote: 'BROWARD COUNTY UNIFORM BUILDING PERMIT APPLICATION' },
        { page: 'https://www.miramarfl.gov/files/assets/public/v/2/buildingplanningzoning/documents/application-and-forms/recertification-bsip-requirements-and-forms.pdf', quote: 'Broward County BORA – Policy 05-05 ELECTRICAL SAFETY INSPECTION REPORT FORM' },
        { page: 'https://www.miramarfl.gov/files/assets/public/v/2/buildingplanningzoning/documents/application-and-forms/recertification-bsip-requirements-and-forms.pdf', quote: 'Broward County BORA – Policy 05-05 STRUCTURAL SAFETY INSPECTION REPORT FORM' },
        { page: 'https://www.miramarfl.gov/files/assets/public/v/2/buildingplanningzoning/documents/application-and-forms/recertification-bsip-requirements-and-forms.pdf', quote: 'Broward County Board of Rules and Appeals Policy #05-05 Subject: Broward County Board of Rules and Appeals – Building Safety Inspection Program' },
      ],
      'local 4: What goes with it': [
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'BSIP Submittal Form Structural Report Electrical Report Supporting documentation (if applicable)' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Reports must be signed and sealed' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'What do I need to submit? BSIP Submittal coversheet' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Structural Packet: Minimum Inspection Guideline for Building Safety Electrical Packet: Minimum Inspection Guideline for Building Safety' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Forms sealed/stamped by a Florida-registered Architect or Engineer Forms must include original signatures' },
      ],
      'local 5: After filing': [
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Will a Building Code Inspector come out? No. Review is based solely on the licensed architect/engineer’s sealed report.' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'How long does the review take? Approximately four to six weeks.' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Will I receive written certification when compliant? If accepted, your file is closed and no notice is issued.' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Include email address to receive an approved copy' },
      ],
      'local 6: Repairs': [
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'If repairs are needed, you will have 180 days to complete them and resubmit.' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'If deficiencies are identified: Repairs must be completed within 180 days (unless otherwise directed) A status letter must be provided' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'A final certification report is required after repairs are completed' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Will an inspector return after repairs? No. A new sealed report from your architect/engineer must be submitted.' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Architect/Engineer must check “No Repairs Required”' },
      ],
      'local 7: Repair permits': [
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'What is required for repair permits? Permit application by licensed and insured contractor' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Two sets of repair documentation and locations Structural calculations may be required' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'How do I know if a permit is required? Ask your architect/engineer or contractor.' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Must the building be brought up to current code? Not fully. The inspection ensures existing electrical and structural systems are safe. Repair work may require adherence to current code.' },
      ],
      'local 8: If it is late': [
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Extensions must be requested in writing.' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Without extension, code enforcement may begin, including fines or building being deemed unsafe.' },
        { page: 'https://www.miramarfl.gov/files/assets/public/v/2/buildingplanningzoning/documents/application-and-forms/recertification-bsip-requirements-and-forms.pdf', quote: 'The Building Official shall enforce the building safety inspection Program.' },
      ],
      'faq 1': [
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'All BSIP documents must be submitted through the City of Miramar permitting system:' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Permit Type: BSIP → Residential BSIP or Commercial BSIP' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections', quote: 'Building Permit Applications must be submitted via our online web portal. It is open 24 hours a day.' },
        { page: 'https://miramarfl-energovweb.tylerhost.net/apps/SelfService#/home', quote: 'Welcome to the City of Miramar\'s Development HUB' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'BSIP Submittal Form Structural Report Electrical Report Supporting documentation (if applicable)' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'What do I need to submit? BSIP Submittal coversheet' },
      ],
      'faq 2': [
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'To verify if your property is included, refer to Broward County BSIP property lists.' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'What if the building is not 25 years old? The Building Division will verify the age with the Broward County Property Appraiser’s Office.' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'I performed interior demolition/renovation. Am I exempt? No. Exterior structural and electrical inspections are still required. Only full building demolition qualifies for exemption.' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Do I need inspections if demolishing in six months? Yes, particularly if still occupied. Exception requests must be submitted in writing.' },
      ],
      'faq 3': [
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Will a Building Code Inspector come out? No. Review is based solely on the licensed architect/engineer’s sealed report.' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Will an inspector return after repairs? No. A new sealed report from your architect/engineer must be submitted.' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Can the City recommend Architects or Engineers? No, due to conflict of interest.' },
      ],
      'faq 4': [
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Extensions must be requested in writing.' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Without extension, code enforcement may begin, including fines or building being deemed unsafe.' },
      ],
      'faq 5': [
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/Applications-Forms', quote: 'Recertification / BSIP – Requirements & Forms(PDF, 844KB)' },
        { page: 'https://www.miramarfl.gov/files/assets/public/v/2/buildingplanningzoning/documents/application-and-forms/recertification-bsip-requirements-and-forms.pdf', quote: 'Detailed information about the program Guidelines for buildings to be inspected by design professionals hired by private building owners Structural and electrical report forms' },
        { page: 'https://www.miramarfl.gov/files/assets/public/v/2/buildingplanningzoning/documents/application-and-forms/recertification-bsip-requirements-and-forms.pdf', quote: 'Broward County Board of Rules and Appeals Policy #05-05 Subject: Broward County Board of Rules and Appeals – Building Safety Inspection Program' },
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Extensions must be requested in writing.' },
      ],
      'nextStep': [
        { page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP', quote: 'Property owners will receive a Notice of Required Inspection' },
        { page: 'https://www.miramarfl.gov/files/assets/public/v/2/buildingplanningzoning/documents/application-and-forms/recertification-bsip-requirements-and-forms.pdf', quote: 'City of |Miramar Building Division Building, Planning & Zoning Department 2200 Civic Center Place | Miramar, Florida 33025 Tel: 954.602.3200 | Fax: 954.602.3635' },
      ],
    },
  },
  'broward-bsip/plantation': {
    office: [
      { page: 'https://www.plantation.org/government/departments/building-safety/permit-services/electronic-plan-review', quote: 'Department of Building Safety 401 NW 70 Terrace Plantation, FL 33317' },
      { page: 'https://www.plantation.org/government/departments/building-safety/permit-services/electronic-plan-review', quote: 'Phone: 954-797-2765' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'the City of Plantation Department of Building Safety will send the property owner, association, management company and/or duly authorized representative a letter via certified mail' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'a letter via certified mail, which will include the Record ID (BDCERT*) # assigned.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'The letter will provide information on what steps to take thereafter.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'Please be aware that all required documentation for this program is to be submitted electronically' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'Register for an online account; please visit Accela Citizen Access (ACA) and click Register (located at the top right of the screen) to get started.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'This will be required in order for you to access and upload the required documents for this program.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/permit-services', quote: 'Accela Citizen Access (ACA) portal manages our records and is where our citizens, businesses, and general public are able to access government services online, 24/7.' },
      ],
      'heroSub': [
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'the City of Plantation Department of Building Safety will send the property owner, association, management company and/or duly authorized representative a letter via certified mail' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'Please be aware that all required documentation for this program is to be submitted electronically' },
      ],
      'local 1: The notice': [
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'the City of Plantation Department of Building Safety will send the property owner, association, management company and/or duly authorized representative a letter via certified mail' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'If/when the Building Safety Inspection Program affects your property, the City of Plantation Department of Building Safety will send the property owner, association, management company and/or duly authorized representative a letter via certified mail' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'a letter via certified mail, which will include the Record ID (BDCERT*) # assigned.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'The letter will provide information on what steps to take thereafter.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'Once you receive the email that you have successfully registered, please forward said email to Pamela Ellis at pellis@plantation.org requesting to connect said account to the applicable Recertification record; be sure to include the assigned BDCERT #.' },
      ],
      'local 2: Filing the report': [
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'Please be aware that all required documentation for this program is to be submitted electronically' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'In order to submit your documents, you shall complete BOTH steps below:' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'Register for an online account; please visit Accela Citizen Access (ACA) and click Register (located at the top right of the screen) to get started.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'Once you receive the email that you have successfully registered, please forward said email to Pamela Ellis at pellis@plantation.org requesting to connect said account to the applicable Recertification record; be sure to include the assigned BDCERT #.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'For more information regarding the Building Safety Inspection Program, please email pellis@plantation.org or call 954-414-7840.' },
      ],
      'local 3: The portal account': [
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'This will be required in order for you to access and upload the required documents for this program.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/permit-services', quote: 'Accela Citizen Access (ACA) portal manages our records and is where our citizens, businesses, and general public are able to access government services online, 24/7.' },
        { page: 'https://aca.plantation.org/CitizenAccess/Default.aspx', quote: 'Plantation E-Permit Online Portal' },
        { page: 'https://www.plantation.org/government/departments/building-safety/permit-services/electronic-plan-review', quote: 'NOTE: *Application and document submission is not supported on mobile devices and Chrome is the recommended browser.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/permit-services/electronic-plan-review', quote: 'As of November 14, 2022, all new applications are accepted in digital format ONLY and shall be submitted thru the Accela Citizen Access (ACA) portal' },
      ],
      'local 4: The city’s forms': [
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'For complete details and/or to obtain the required forms, please visit https://www.broward.org/CodeAppeals/Pages/SafetyInspectionProgram.aspx' },
      ],
      'local 5: What goes with it': [
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'the Narrative and Safety Inspection Reports shall be digitally Signed & Sealed in order to be validated.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'the Narrative and Safety Inspection Reports shall be digitally Signed & Sealed in order to be validated.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'For complete details and/or to obtain the required forms, please visit https://www.broward.org/CodeAppeals/Pages/SafetyInspectionProgram.aspx' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'The letter will provide information on what steps to take thereafter.' },
      ],
      'local 6: Digital signatures': [
        { page: 'https://www.plantation.org/government/departments/building-safety/permit-services/electronic-plan-review', quote: 'Documents prepared by design professionals, such as architects or engineers, are required to be signed and sealed using a digital signature.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/permit-services/electronic-plan-review', quote: 'The CA that issued the certificate with which these signatures were signed is not trusted by the agency because it does not meet the professional board rules security standards. Self-signed documents are not accepted.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/permit-services/electronic-plan-review', quote: 'All files must be submitted as PDF files' },
        { page: 'https://www.plantation.org/home/showpublisheddocument/5838/638040150941730000', quote: 'If the document has been modified since it was digitally signed the verification process will invalidate the signature file.' },
      ],
      'local 7: Repairs': [
        { page: 'https://www.plantation.org/government/departments/building-safety/permit-services/permit-submittal', quote: 'A permit is required prior to the construction, enlargement, alteration or repair of any building structure or part thereof (FBC 105.1).' },
        { page: 'https://www.plantation.org/government/departments/building-safety/permit-services/electronic-plan-review', quote: 'As of November 14, 2022, all new applications are accepted in digital format ONLY and shall be submitted thru the Accela Citizen Access (ACA) portal' },
      ],
      'local 8: After filing': [
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'For more information regarding the Building Safety Inspection Program, please email pellis@plantation.org or call 954-414-7840.' },
        { page: 'https://www.plantation.org/government/departments/building-safety', quote: 'Need assistance? 954-797-2765 | helpmebuilding@plantation.org' },
      ],
      'faq 1': [
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'the City of Plantation Department of Building Safety will send the property owner, association, management company and/or duly authorized representative a letter via certified mail' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'If/when the Building Safety Inspection Program affects your property, the City of Plantation Department of Building Safety will send the property owner, association, management company and/or duly authorized representative a letter via certified mail' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'a letter via certified mail, which will include the Record ID (BDCERT*) # assigned.' },
      ],
      'faq 2': [
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'Please be aware that all required documentation for this program is to be submitted electronically' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'In order to submit your documents, you shall complete BOTH steps below:' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'Register for an online account; please visit Accela Citizen Access (ACA) and click Register (located at the top right of the screen) to get started.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'Once you receive the email that you have successfully registered, please forward said email to Pamela Ellis at pellis@plantation.org requesting to connect said account to the applicable Recertification record; be sure to include the assigned BDCERT #.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'This will be required in order for you to access and upload the required documents for this program.' },
      ],
      'faq 3': [
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'For complete details and/or to obtain the required forms, please visit https://www.broward.org/CodeAppeals/Pages/SafetyInspectionProgram.aspx' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'the Narrative and Safety Inspection Reports shall be digitally Signed & Sealed in order to be validated.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'the Narrative and Safety Inspection Reports shall be digitally Signed & Sealed in order to be validated.' },
      ],
      'faq 4': [
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'The letter will provide information on what steps to take thereafter.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'For more information regarding the Building Safety Inspection Program, please email pellis@plantation.org or call 954-414-7840.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/contacts', quote: 'Ellis, Pam Administrative Assistant to Assistant Building Official Building (954) 414-7840' },
      ],
      'faq 5': [
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'requesting to connect said account to the applicable Recertification record; be sure to include the assigned BDCERT #.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'a letter via certified mail, which will include the Record ID (BDCERT*) # assigned.' },
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'The Broward County Administrative Provisions of the Florida Building Code has established a Building Safety Inspection Program for buildings 25 years old or older' },
      ],
      'nextStep': [
        { page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program', quote: 'the City of Plantation Department of Building Safety will send the property owner, association, management company and/or duly authorized representative a letter via certified mail' },
      ],
    },
  },
  'broward-bsip/sunrise': {
    office: [
      { page: 'https://www.sunrisefl.gov/departments-services/community-development/building', quote: '10770 W. Oakland Park Boulevard Sunrise, FL 33351' },
      { page: 'https://www.sunrisefl.gov/departments-services/community-development/building', quote: 'Phone: (954) 572-2354' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'The Building Safety Inspection Reports must be submitted to the Building Division. The reports can be submitted in person or electronically via our Customer Self-Service Portal.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'A list of buildings due for a Building Safety Inspection are sent to each city throughout Broward County each year by the Broward County Board of Rules and Appeals.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'Each item in the checklist below must be a separate file and in PDF (unprotected) format.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'Please make sure the application is completely filled out, including the tracking number from the Building Safety Inspection notification previously received.' },
        { page: 'https://www.sunrisefl.gov/our-city/advanced-components/document-central/-folder-334', quote: 'BSIP Inspection Form - ELECTRICAL BSIP Inspection Form - STRUCTURAL' },
        { page: 'https://www.sunrisefl.gov/departments-services/community-development/code-enforcement', quote: 'In accordance with Florida Statutes Chapter 162, enforcement cases in the City of Sunrise are heard before a Special Magistrate.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/11742/639155836652082742', quote: 'SPECIAL MAGISTRATE HEARING AGENDA June 8, 2026 2:30 PM CALL TO ORDER IMPOSITIONS OF FINE – BUILDING SAFETY INSPECTION PROGRAM – BUILDING DIVISION' },
      ],
      'heroSub': [
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'The Building Safety Inspection Reports must be submitted to the Building Division. The reports can be submitted in person or electronically via our Customer Self-Service Portal.' },
      ],
      'local 1: The notice': [
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'A list of buildings due for a Building Safety Inspection are sent to each city throughout Broward County each year by the Broward County Board of Rules and Appeals.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'The list is based off of the actual construction year of the building according to the Broward County Property Appraiser records.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/11742/639155836652082742', quote: 'A formal notice was issued by the Building Official on August 29, 2025, establishing a deadline of February 28, 2026.' },
      ],
      'local 2: Filing the report': [
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'The Building Safety Inspection Reports must be submitted to the Building Division. The reports can be submitted in person or electronically via our Customer Self-Service Portal.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'To submit electronically please visit our Customer Self-Service (CSS) portal at http://sunrisefl.gov/openforbusiness and create an account.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'Each building requires its own application and separate submission.' },
      ],
      'local 3: Paper or PDF': [
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'An original copy must be submitted with a seal and wet signature from the architect or engineer.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'Each item in the checklist below must be a separate file and in PDF (unprotected) format.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'The report must be digitally signed and sealed by an architect or engineer. If the report cannot be digitally verified by our Plans Examiners, the report will not be accepted.' },
      ],
      'local 4: The city’s forms': [
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'Please make sure the application is completely filled out, including the tracking number from the Building Safety Inspection notification previously received.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'The inspection reports must be filled out on the current Building Safety Inspection Report forms. The current forms can be downloaded at: https://www.broward.org/CodeAppeals/Pages/SafetyInspectionProgram.aspx.' },
        { page: 'https://www.sunrisefl.gov/our-city/advanced-components/document-central/-folder-334', quote: 'BSIP Inspection Form - ELECTRICAL BSIP Inspection Form - STRUCTURAL' },
      ],
      'local 5: What goes with it': [
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'Please make sure your package includes the following with this application: □ Building Safety Inspection Report Form – Structural □ Building Safety Inspection Report Form – Electrical' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'Please make sure the report is completely filled out including checking either “No Repairs Required” or “Repairs are Required” on the cover page.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'Repairs Required Submittal: Tracking # from Notification Permit Numbers for Repairs' },
      ],
      'local 6: Repairs': [
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'If either or both the structural or electrical report(s) are marked indicating “Repairs Required”, the plan reviewer(s) will determine if permits are required based on the required repairs outlined in the report.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'Once all required permits have been obtained and all repairs have been made, your architect or engineer will need to submit a new Building Safety Inspection Report(s) to the City indicating “No Repairs Required”.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'Once the City reviews and accepts the new report(s), your building will be in compliance with the Building Safety Inspection Program.' },
      ],
      'local 7: If it is late': [
        { page: 'https://www.sunrisefl.gov/departments-services/community-development/code-enforcement', quote: 'In accordance with Florida Statutes Chapter 162, enforcement cases in the City of Sunrise are heard before a Special Magistrate.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/11742/639155836652082742', quote: 'SPECIAL MAGISTRATE HEARING AGENDA June 8, 2026 2:30 PM CALL TO ORDER IMPOSITIONS OF FINE – BUILDING SAFETY INSPECTION PROGRAM – BUILDING DIVISION' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/11742/639155836652082742', quote: 'has exceeded the 180-day deadline to comply with the Broward County Board of Rules & Appeals (BORA) Building Safety Inspection Program. This program requires property owners to submit Building Safety Inspection Certification Forms to the Building Official.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/11519/639083208746400000', quote: 'which requires the deficiencies identified in the 25 Year and older Safety Inspection Certification Form(s) to be repaired and re-inspected by a professional engineer or registered architect within 180 days of the Building Safety Inspection Report date.' },
      ],
      'local 8: Older names': [
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/11519/639083208746400000', quote: 'which requires the deficiencies identified in the 25 Year and older Safety Inspection Certification Form(s) to be repaired and re-inspected by a professional engineer or registered architect within 180 days of the Building Safety Inspection Report date.' },
      ],
      'faq 1': [
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/11742/639155836652082742', quote: 'A formal notice was issued by the Building Official on August 29, 2025, establishing a deadline of February 28, 2026.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'A list of buildings due for a Building Safety Inspection are sent to each city throughout Broward County each year by the Broward County Board of Rules and Appeals.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'Please make sure the application is completely filled out, including the tracking number from the Building Safety Inspection notification previously received.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'Building Safety Inspections must be performed in the year they are due. The City will only accept Building Safety Inspection Reports for buildings that have been notified that a report is due.' },
      ],
      'faq 2': [
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'The Building Safety Inspection Reports must be submitted to the Building Division. The reports can be submitted in person or electronically via our Customer Self-Service Portal.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'To submit electronically please visit our Customer Self-Service (CSS) portal at http://sunrisefl.gov/openforbusiness and create an account.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'Each building requires its own application and separate submission.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'An original copy must be submitted with a seal and wet signature from the architect or engineer.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'Each item in the checklist below must be a separate file and in PDF (unprotected) format.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'The report must be digitally signed and sealed by an architect or engineer. If the report cannot be digitally verified by our Plans Examiners, the report will not be accepted.' },
      ],
      'faq 3': [
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'If you feel there has been an error and your building should not be due for a Building Safety Inspection, please call (954) 572-2363.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'The list is based off of the actual construction year of the building according to the Broward County Property Appraiser records.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'One- and two-family dwellings, U.S. Government, State of Florida buildings, schools under the jurisdiction of the Broward County School Board, all buildings under 3,500 square feet, and buildings built on Indian Reservations are exempt from this program.' },
      ],
      'faq 4': [
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'If either or both the structural or electrical report(s) are marked indicating “Repairs Required”, the plan reviewer(s) will determine if permits are required based on the required repairs outlined in the report.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'Once all required permits have been obtained and all repairs have been made, your architect or engineer will need to submit a new Building Safety Inspection Report(s) to the City indicating “No Repairs Required”.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'Repairs Required Submittal: Tracking # from Notification Permit Numbers for Repairs' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'Once the City reviews and accepts the new report(s), your building will be in compliance with the Building Safety Inspection Program.' },
      ],
      'faq 5': [
        { page: 'https://www.sunrisefl.gov/departments-services/community-development/code-enforcement', quote: 'In accordance with Florida Statutes Chapter 162, enforcement cases in the City of Sunrise are heard before a Special Magistrate.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/11742/639155836652082742', quote: 'SPECIAL MAGISTRATE HEARING AGENDA June 8, 2026 2:30 PM CALL TO ORDER IMPOSITIONS OF FINE – BUILDING SAFETY INSPECTION PROGRAM – BUILDING DIVISION' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/11742/639155836652082742', quote: 'has exceeded the 180-day deadline to comply with the Broward County Board of Rules & Appeals (BORA) Building Safety Inspection Program. This program requires property owners to submit Building Safety Inspection Certification Forms to the Building Official.' },
        { page: 'https://www.sunrisefl.gov/departments-services/community-development/code-enforcement', quote: 'For additional information, contact the Clerk to the Special Magistrate at (954) 572-2347.' },
      ],
      'nextStep': [
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/11742/639155836652082742', quote: 'A formal notice was issued by the Building Official on August 29, 2025, establishing a deadline of February 28, 2026.' },
        { page: 'https://www.sunrisefl.gov/home/showpublisheddocument/7539/638949135289070000', quote: 'The Building Safety Inspection Reports must be submitted to the Building Division. The reports can be submitted in person or electronically via our Customer Self-Service Portal.' },
      ],
    },
  },
  'broward-bsip/davie': {
    office: [
      { page: 'https://www.davie-fl.gov/206/Building', quote: 'Physical Address 8800 SW 36th Street Building A Davie, FL 33328' },
      { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '*If you have issues with the uploading process, please contact the Town of Davie Building Division @ 954-797-1111*' },
    ],
    rows: {
      'lede': [
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'the Building Official will send out a Notice of Required Building Safety Inspection via certified mail' },
        { page: 'https://www.davie-fl.gov/Search?searchPhrase=Building%20Safety%20Inspection%20Program&pageNumber=1&perPage=10&departmentId=-1', quote: 'YOU CAN FIND THE CASE NUMBER IN THE NOTICE RECEIVED FROM THE TOWN OF DAVIE BUILDING DIVISION.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '*If you have issues with the uploading process, please contact the Town of Davie Building Division @ 954-797-1111*' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'We no longer accept paper copies. All reports must be digitally signed, sealed, and submitted.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'Submit the application using OAS at the OAS website' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'After the payment is confirmed, you will receive an email asking you to create an account in Project Dox and upload the documents.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '-Electrical report folder. Upload only the electrical report.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '-Structure report folder. Upload only the structure report.' },
      ],
      'heroSub': [
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'the Building Official will send out a Notice of Required Building Safety Inspection via certified mail' },
        { page: 'https://www.davie-fl.gov/Search?searchPhrase=Building%20Safety%20Inspection%20Program&pageNumber=1&perPage=10&departmentId=-1', quote: 'YOU CAN FIND THE CASE NUMBER IN THE NOTICE RECEIVED FROM THE TOWN OF DAVIE BUILDING DIVISION.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'We no longer accept paper copies. All reports must be digitally signed, sealed, and submitted.' },
      ],
      'local 1: The notice': [
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'the Building Official will send out a Notice of Required Building Safety Inspection via certified mail' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'Between June 1st and August 31st of each year, the Building Official will send out a Notice of Required Building Safety Inspection' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'to the owner on record and managing association of all properties due for their Building Safety Inspection during that calendar year.' },
        { page: 'https://www.davie-fl.gov/Search?searchPhrase=Building%20Safety%20Inspection%20Program&pageNumber=1&perPage=10&departmentId=-1', quote: 'YOU CAN FIND THE CASE NUMBER IN THE NOTICE RECEIVED FROM THE TOWN OF DAVIE BUILDING DIVISION.' },
        { page: 'https://www.davie-fl.gov/Search?searchPhrase=Building%20Safety%20Inspection%20Program&pageNumber=1&perPage=10&departmentId=-1', quote: 'APPLICATION WILL NOT BE ACCEPTED IF THE CASE NUMBER IS NOT PROVIDED.' },
      ],
      'local 2: Filing the report': [
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'We no longer accept paper copies. All reports must be digitally signed, sealed, and submitted.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'Complete the “Building Safety Inspection Program” application. See the application form above.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'Submit the application using OAS at the OAS website' },
        { page: 'https://www.davie-fl.gov/206/Building', quote: 'A new permitting submission system will be available named Online Application Submittal (OAS) starting January 12th 2026. This new process with be the required method for submitting permits and all other Building Department service requests.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'After the payment is confirmed, you will receive an email asking you to create an account in Project Dox and upload the documents.' },
      ],
      'local 3: The Project Dox upload': [
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'After the building department staff review the application, you will receive a notification to process the payment.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'After the payment is confirmed, you will receive an email asking you to create an account in Project Dox and upload the documents.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '*Please note that each item must be uploaded individually. For example:' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '-Permit application folder: Upload the Building Safety Inspection Application.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '-Electrical report folder. Upload only the electrical report.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '-Structure report folder. Upload only the structure report.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '-Documents folder. Upload the Electronic signature affidavit, Photos, Cover letter, sketches, drawings, etc.' },
      ],
      'local 4: The Town’s forms': [
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'The following forms are required to be completed at the time of the submission:' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'Building Safety Inspection Application Form' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'Building Safety Inspection Form - Structural' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'Building Safety Inspection Form - Electrical' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'prepared by a qualified Florida licensed Professional Engineer or Florida Registered Architect on the designated Broward County Board of Rules and Appeals Safety Inspection Report Form.' },
        { page: 'https://www.davie-fl.gov/1301/Building-Forms', quote: 'Building Safety Inspection Application 05-27-2025' },
      ],
      'local 5: What goes with it': [
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'Each report must be accompanied by colored photos, and a signed and sealed letter stating the current condition of the property (ex. repairs or no repairs) and if it is safe to occupy under the current occupancy (or safe to occupy during repairs)' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '-Documents folder. Upload the Electronic signature affidavit, Photos, Cover letter, sketches, drawings, etc.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'Electronic Signature Affidavit' },
      ],
      'local 6: After filing': [
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'for the Town of Davie Building Department to review the reports.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '*If you have issues with the uploading process, please contact the Town of Davie Building Division @ 954-797-1111*' },
        { page: 'https://www.davie-fl.gov/1220/Contact-Us', quote: 'Permit Examiner / Prescreen and BSIP' },
      ],
      'local 7: Repairs': [
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'A building permit for any and all repairs related to the BSIP inspection report is required.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'shall provide the Building Owner and Building Official with a signed and sealed letter indicating whether the Building or Structure may continue to be safely occupied while the Building or Structure is undergoing repairs.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'This letter shall be valid for no more than 180 days, and a new letter will be issued if repairs or modifications remain ongoing.' },
      ],
      'local 8: Who is exempt': [
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '-U.S. Government Buildings' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '-State of Florida Buildings' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '-Buildings built on sovereign tribal lands' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '-Single-family, two-family, three-family, and four-family dwellings with three or fewer habitable stories above ground.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '-Minor structures are defined as buildings or structures in any occupancy group with an area of less than three thousand five hundred (3,500) square feet.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '*If you believe your building should be on the Broward County list for inspection, please contact the Broward County Building Code Services Division.' },
      ],
      'faq 1': [
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'the Building Official will send out a Notice of Required Building Safety Inspection via certified mail' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'Between June 1st and August 31st of each year, the Building Official will send out a Notice of Required Building Safety Inspection' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'to the owner on record and managing association of all properties due for their Building Safety Inspection during that calendar year.' },
        { page: 'https://www.davie-fl.gov/Search?searchPhrase=Building%20Safety%20Inspection%20Program&pageNumber=1&perPage=10&departmentId=-1', quote: 'YOU CAN FIND THE CASE NUMBER IN THE NOTICE RECEIVED FROM THE TOWN OF DAVIE BUILDING DIVISION.' },
        { page: 'https://www.davie-fl.gov/Search?searchPhrase=Building%20Safety%20Inspection%20Program&pageNumber=1&perPage=10&departmentId=-1', quote: 'APPLICATION WILL NOT BE ACCEPTED IF THE CASE NUMBER IS NOT PROVIDED.' },
      ],
      'faq 2': [
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'We no longer accept paper copies. All reports must be digitally signed, sealed, and submitted.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'Submit the application using OAS at the OAS website' },
        { page: 'https://www.davie-fl.gov/206/Building', quote: 'A new permitting submission system will be available named Online Application Submittal (OAS) starting January 12th 2026. This new process with be the required method for submitting permits and all other Building Department service requests.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'After the building department staff review the application, you will receive a notification to process the payment.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'After the payment is confirmed, you will receive an email asking you to create an account in Project Dox and upload the documents.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '*Please note that each item must be uploaded individually. For example:' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '-Permit application folder: Upload the Building Safety Inspection Application.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '-Electrical report folder. Upload only the electrical report.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '-Structure report folder. Upload only the structure report.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: '-Documents folder. Upload the Electronic signature affidavit, Photos, Cover letter, sketches, drawings, etc.' },
      ],
      'faq 3': [
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'A building permit for any and all repairs related to the BSIP inspection report is required.' },
        { page: 'https://www.davie-fl.gov/206/Building', quote: 'You may request a Building Permit through OAS by filling out a Building Permit request via our OAS webpage, listed below.' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'shall re-inspect the areas noted on the original report and provide the Building Owner and Building Official an amended report with a signed and sealed letter stating that all of the required repairs and corrections have been completed and that the Building or Structure has been certified for continued use.' },
        { page: 'https://www.davie-fl.gov/206/Building', quote: 'A new permitting submission system will be available named Online Application Submittal (OAS) starting January 12th 2026. This new process with be the required method for submitting permits and all other Building Department service requests.' },
      ],
      'faq 4': [
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'The owner or association will have 180 days from the date of the Notice, to submit to the Building Official a signed and sealed Structural and Electrical Safety Inspection Report' },
        { page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program', quote: 'the Building Official will send out a Notice of Required Building Safety Inspection via certified mail' },
      ],
      'faq 5': [
        { page: 'https://www.davie-fl.gov/CivicSend/ViewMessage/Message/208154', quote: 'The Town of Davie’s Building Division has commenced disseminating notices to commercial building owners as part of the State of Florida and the Broward County Board of Rules and Appeals’ newly rebranded Broward Safety Inspection Program (BSIP), previously known as the 40/50 Year Safety Inspection Program.' },
      ],
      'nextStep': [
        { page: 'https://www.davie-fl.gov/Search?searchPhrase=Building%20Safety%20Inspection%20Program&pageNumber=1&perPage=10&departmentId=-1', quote: 'YOU CAN FIND THE CASE NUMBER IN THE NOTICE RECEIVED FROM THE TOWN OF DAVIE BUILDING DIVISION.' },
      ],
    },
  },
};
