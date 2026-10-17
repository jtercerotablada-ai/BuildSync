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

/** `read`: the day this record was read, where it is not `cityPagesRead` —
    the pages added on October 17, 2026 (cities.ts, `checkedISO`). */
export const citySources: Record<string, { read?: string; office: CityQuote[]; rows: Record<string, CityQuote[]> }> = {
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
      { page: 'https://www.miamibeachfl.gov/city-hall/building/', quote: '1700 Convention Center Drive, Miami Beach, FL, 33139' },
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
      { page: 'https://www.hialeahfl.gov/682/Contact-Us', quote: 'Hialeah, FL 33010' },
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
      { page: 'https://www.coralgables.com/department/development-services/development-services-faq', quote: 'Development Services is located at 427 Biltmore Way, Coral Gables, FL 33134.' },
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
      { page: 'https://www.northmiamifl.gov/155/Building', quote: 'North Miami, FL 33161' },
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
      { page: 'https://www.cityofaventura.com/167/Community-Development', quote: '4th Floor' },
      { page: 'https://www.cityofaventura.com/167/Community-Development', quote: 'Aventura, FL 33180' },
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
      { page: 'https://keybiscayne.fl.gov/services/index.php', quote: "The Village of Key Biscayne's Village Hall is located at 88 W. McIntyre Street, Key Biscayne, Florida 33149" },
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
      { page: 'https://www.ppines.com/164/The-Building-Department', quote: 'Pembroke Pines, FL 33025' },
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
  'building-recertification/bay-harbor-islands': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.bayharborislands-fl.gov/149/Building-Department', quote: 'Building Department Physical Address 1045 95th Street, Trailer 3 Bay Harbor Islands, FL 33154 Phone: 305-993-1786' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2447/09292022-Special-Master-Hearing', quote: 'TOWN OF BAY HARBOR ISLANDS SPECIAL MASTER HEARING' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2447/09292022-Special-Master-Hearing', quote: 'Submit the required engineering report to complete the recertification process.' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'The Responsible Person must file with the Town any report ("Engineer\'s Report") of a professional engineer or architect concerning the structural, electrical or life safety conditions of the building' },
      ],
      'lede': [
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'RECERTIFICATION, INSPECTIONS, RESERVE STUDIES AND REGISTRATION' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'BUILDING OFFICIAL MIKE MESA' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'Engineering reports also must be provided:' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2447/09292022-Special-Master-Hearing', quote: 'Submit the required engineering report to complete the recertification process.' },
      ],
      'local 1: Who handles it': [
        { page: 'https://www.bayharborislands-fl.gov/149/Building-Department', quote: 'Building & Zoning Department' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'COUNCIL MEMBER ROBERT YAFFE & CHIEF BUILDING OFFICIAL MIKE MESA' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2447/09292022-Special-Master-Hearing', quote: 'Presenter: Mike Mesa' },
      ],
      'local 2: Engineers’ reports to the Town': [
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'Each condominium, cooperative or homeowner\'s association or apartment complex of more than four (4) units must designate a Responsible Person (the contact person for the association).' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'The Responsible Person must file with the Town any report ("Engineer\'s Report") of a professional engineer or architect concerning the structural, electrical or life safety conditions of the building within five (5) business days of receipt of the Engineer\'s Report.' },
      ],
      'local 3: How that filing works': [
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'Filing means hand delivery of the Engineer\'s Report to the Town\'s Chief Building Official or to the Building Department in the absence of the CBO.' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'The report is to be filed in both digital, if available, and hard copy formats.' },
      ],
      'local 4: Association registration': [
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'Requires all condominium associations, multifamily homeowners, cooperative apartment associations and commercial and residential buildings within the Town to file with the Code Compliance unit a registration of a form provided' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'The registration must be updated on or before January 30 of each year following the initial registration.' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'Contact information for association\'s insurance agent, if any' },
      ],
      'local 5: Repairs need permits': [
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2447/09292022-Special-Master-Hearing', quote: 'Violation: Apply and obtain permit(s) for all repairs as indicated on your engineer\'s report.' },
      ],
      'local 6: If it is late': [
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2447/09292022-Special-Master-Hearing', quote: 'Violation: Submit Engineers 40, 50, 60.... Year Re-Certification Report' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2447/09292022-Special-Master-Hearing', quote: 'Code Section: 24-3 The intent and purpose of this chapter is to protect the public health, safety, morals and welfare of all of the people of the town by establishing minimum standards governing the condition, occupancy and maintenance of all buildings and premises' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2447/09292022-Special-Master-Hearing', quote: 'Impose a fine of $50.00 per day until compliance is met.' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2447/09292022-Special-Master-Hearing', quote: 'Submit the required engineering report to complete the recertification process.' },
      ],
      'local 7: Older names': [
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2447/09292022-Special-Master-Hearing', quote: 'Violation: Submit Engineers 40, 50, 60.... Year Re-Certification Report' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'Recertification mandate is shortened to 30 years instead of 40 years.' },
      ],
      'faq 1': [
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'COUNCIL MEMBER ROBERT YAFFE & CHIEF BUILDING OFFICIAL MIKE MESA' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'RECERTIFICATION, INSPECTIONS, RESERVE STUDIES AND REGISTRATION' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2447/09292022-Special-Master-Hearing', quote: 'Presenter: Mike Mesa' },
      ],
      'faq 2': [
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'The Responsible Person must file with the Town any report ("Engineer\'s Report") of a professional engineer or architect concerning the structural, electrical or life safety conditions of the building within five (5) business days of receipt of the Engineer\'s Report.' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'Filing means hand delivery of the Engineer\'s Report to the Town\'s Chief Building Official or to the Building Department in the absence of the CBO.' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'The report is to be filed in both digital, if available, and hard copy formats.' },
      ],
      'faq 3': [
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2447/09292022-Special-Master-Hearing', quote: 'Violation: Apply and obtain permit(s) for all repairs as indicated on your engineer\'s report.' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2447/09292022-Special-Master-Hearing', quote: 'Type of Hearing: Special Master Hearing' },
      ],
      'faq 4': [
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'Time frames are calculated by Building Age' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: '(dated when built) rather than from issuance of' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'Early Notification of Recertification' },
      ],
      'faq 5': [
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2447/09292022-Special-Master-Hearing', quote: 'Violation: Submit Engineers 40, 50, 60.... Year Re-Certification Report' },
        { page: 'https://www.bayharborislands-fl.gov/DocumentCenter/View/2673/Condo-Workshop-PowerPoint-Presentation', quote: 'Recertification mandate is shortened to 30 years instead of 40 years.' },
      ],
      'nextStep': [
        { page: 'https://www.bayharborislands-fl.gov/149/Building-Department', quote: 'Please contact the Building Department for more information' },
      ],
    },
  },
  'building-recertification/cutler-bay': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.cutlerbay-fl.gov/com-dev/page/building-division', quote: 'Building Permits are available in the Building Department located in the Town of Cutler Bay Town Center at 10720 Caribbean Blvd., Suite 110' },
      { page: 'https://www.cutlerbay-fl.gov/com-dev/page/building-division', quote: 'Cutler Bay, FL 33189' },
      { page: 'https://www.cutlerbay-fl.gov/com-dev/page/permits-and-inspections', quote: 'please contact the Building Department at (305) 234-4193.' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.cutlerbay-fl.gov/com-dev/page/building-forms', quote: 'Building Recertification Inspection Report Form - Electrical' },
        { page: 'https://www.cutlerbay-fl.gov/com-dev/page/building-forms', quote: 'Building Recertification Inspection Report Form - Structural' },
        { page: 'https://www.cutlerbay-fl.gov/com-dev/page/building-forms', quote: 'General Considerations and Guidelines' },
      ],
      'lede': [
        { page: 'https://www.cutlerbay-fl.gov/com-dev/page/building-division', quote: 'The Building Division reviews building plans and conducts required building inspections, assesses potentially dangerous structures, and posts unsafe notices as needed.' },
        { page: 'https://www.cutlerbay-fl.gov/com-dev/page/building-forms', quote: 'Certification of Compliance with Parking Lot Guardrails' },
        { page: 'https://www.cutlerbay-fl.gov/com-dev/page/building-forms', quote: 'Certification of Compliance with Parking Lot Illumination' },
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/general-consideration-guidelines-2025.pdf', quote: 'MIAMI-DADE COUNTY BUILDING RECERTIFICATION GENERAL CONSIDERATIONS & GUIDELINES' },
      ],
      'local 1: The Town’s forms': [
        { page: 'https://www.cutlerbay-fl.gov/com-dev/page/building-forms', quote: 'Building Recertification Inspection Report Form - Structural' },
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/min-inspection-structural-recertification.pdf', quote: 'REGULATORY AND ECONOMIC RESOURCES DEPARTMENT' },
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/min-inspection-structural-recertification.pdf', quote: 'Initial Inspection Report' },
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/min-inspection-structural-recertification.pdf', quote: 'Amended Inspection Report after completion of repairs' },
      ],
      'local 2: Parking-lot forms': [
        { page: 'https://www.cutlerbay-fl.gov/com-dev/page/building-forms', quote: 'Certification of Compliance with Parking Lot Guardrails' },
        { page: 'https://www.cutlerbay-fl.gov/com-dev/page/building-forms', quote: 'Certification of Compliance with Parking Lot Illumination' },
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/cert-of-compliance-parking-lot-guardrails.pdf', quote: 'The parking lot(s) is not adjacent to or abutting a canal, lake, or other body of water.' },
      ],
      'local 3: The guidelines': [
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/general-consideration-guidelines-2025.pdf', quote: 'The approved report forms provided must be used, proprietary forms will not be accepted.' },
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/general-consideration-guidelines-2025.pdf', quote: 'Where required, photos must be in color and with sufficient resolution to detail the conditions being shown.' },
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/general-consideration-guidelines-2025.pdf', quote: 'Each report shall include a cover letter from the design professional with a statement to the effect that the building or structure is structurally or electrically not unsafe as defined by the Florida Building Code, for continued occupancy.' },
      ],
      'local 4: Larger electrical services': [
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/general-consideration-guidelines-2025.pdf', quote: 'For electrical service systems with service entrance conductors rated at 400 amperes or greater in the aggregate, an infrared thermography inspection with a written report of the following electrical equipment must be provided as applicable' },
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/general-consideration-guidelines-2025.pdf', quote: 'Level-II or higher certified infrared thermographer' },
      ],
      'local 5: Repairs and permits': [
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/general-consideration-guidelines-2025.pdf', quote: 'it should be immediately submitted to the local jurisdiction for processing, do not proceed to conduct repairs without permits.' },
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/general-consideration-guidelines-2025.pdf', quote: 'Additionally, repairs being conducted under a permit will afford additional time to comply with a complete recertification report.' },
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/general-consideration-guidelines-2025.pdf', quote: 'Unpermitted additions found by the recertification process present an unsafe situation and must be identified in the report, even if found to be properly built.' },
      ],
      'local 6: After filing': [
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/general-consideration-guidelines-2025.pdf', quote: 'reports may be au-dited, and the subject building may be inspected at the discretion of the Building Official. The Building Official reserves the right to revoke an approved recertification report.' },
        { page: 'https://www.cutlerbay-fl.gov/com-dev/page/building-division', quote: 'assesses potentially dangerous structures, and posts unsafe notices as needed.' },
      ],
      'local 7: How it is filed': [
        { page: 'https://www.cutlerbay-fl.gov/com-dev/page/building-division', quote: 'Citizens and contractors who need permits, inspections and plan reviews can visit Town Hall for complete service, courtesy of the Town\'s contractor, CAP Government, Inc.' },
        { page: 'https://www.cutlerbay-fl.gov/com-dev/page/permits-and-inspections', quote: 'The Town\'s Permit and Inspections Online Services provides instant access to information on the status of permits, plans and inspections on commercial and residential properties.' },
      ],
      'faq 1': [
        { page: 'https://www.cutlerbay-fl.gov/com-dev/page/building-division', quote: 'Building Permits are available in the Building Department located in the Town of Cutler Bay Town Center at 10720 Caribbean Blvd., Suite 110' },
        { page: 'https://www.cutlerbay-fl.gov/com-dev/page/building-division', quote: 'courtesy of the Town\'s contractor, CAP Government, Inc.' },
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/general-consideration-guidelines-2025.pdf', quote: 'it should be immediately submitted to the local jurisdiction for processing' },
      ],
      'faq 2': [
        { page: 'https://www.cutlerbay-fl.gov/com-dev/page/building-forms', quote: 'Building Recertification Inspection Report Form - Electrical' },
        { page: 'https://www.cutlerbay-fl.gov/com-dev/page/building-forms', quote: 'Certification of Compliance with Parking Lot Guardrails' },
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/general-consideration-guidelines-2025.pdf', quote: 'The approved report forms provided must be used, proprietary forms will not be accepted.' },
      ],
      'faq 3': [
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/general-consideration-guidelines-2025.pdf', quote: 'Unpermitted additions found by the recertification process present an unsafe situation and must be identified in the report, even if found to be properly built.' },
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/general-consideration-guidelines-2025.pdf', quote: 'legaliz-ing an unpermitted addition would be a prerequisite to the completion of a successful recertification report.' },
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/general-consideration-guidelines-2025.pdf', quote: 'Violations through the local jurisdiction\'s code compliance division should be investigated.' },
      ],
      'faq 4': [
        { page: 'https://www.cutlerbay-fl.gov/com-dev/page/building-forms', quote: 'Building Recertification Inspection Report Form - Structural' },
      ],
      'faq 5': [
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/general-consideration-guidelines-2025.pdf', quote: 'The Miami-Dade Recertification Program, which is synonymous with the State of Florida Milestone Inspection Program, combines both Phase 1 and Phase 2 inspections into a single inspection.' },
        { page: 'https://www.cutlerbay-fl.gov/sites/default/files/fileattachments/community_development/page/4671/general-consideration-guidelines-2025.pdf', quote: 'The Miami-Dade Recertification Program meets and exceeds the minimum requirements of the State of Florida Milestone Inspection Program' },
      ],
      'nextStep': [
        { page: 'https://www.cutlerbay-fl.gov/com-dev/page/building-division', quote: 'The purpose of the Building Division is to assure compliance with the Florida Building Code, which regulates all building construction activities within the Town of Cutler Bay.' },
      ],
    },
  },
  'building-recertification/el-portal': {
    read: '2026-10-17',
    office: [
      { page: 'https://elportalvillage.com/code-enforcement-building-department/', quote: 'Village Hall 500 NE 87th Street El Portal, Florida 33138' },
      { page: 'https://elportalvillage.com/code-enforcement-building-department/', quote: 'The Building Department can be reached by calling Village Hall at 305-795-7880.' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://elportalvillage.com/code-enforcement-building-department/', quote: '40-Year Certification Guidelines' },
        { page: 'https://elportalvillage.com/code-enforcement-building-department/', quote: 'PROCESS OPTION 1, HARD COPY DROP OFF VIA APPOINTMENT ONLY TO VILLAGE OF EL PORTAL – BUILDING DEPARTMENT OFFICE. PROCESS OPTION 2, ELECTRONIC PLAN REVIEW SUBMISSION VIA WEB PORTAL.' },
      ],
      'lede': [
        { page: 'https://elportalvillage.com/code-enforcement-building-department/', quote: 'Code Enforcement & Building Department' },
        { page: 'https://elportalvillage.com/code-enforcement-building-department/', quote: 'Code Enforcement/Building Dept. Forms' },
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: 'BUILDING & ZONING DEPARTMENT' },
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: 'MINIMUM INSPECTION PROCEDURAL GUIDELINES FOR' },
      ],
      'local 1: The Village’s guidelines': [
        { page: 'https://elportalvillage.com/code-enforcement-building-department/', quote: '40-Year Certification Guidelines' },
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: '40-year Certification' },
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: 'BUILDING\'S STRUCTURAL/ELECTRICAL RECERTIFICATION' },
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: '500 NE 87 SREET' },
      ],
      'local 2: What the report covers': [
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: 'f. Folio Number of Building:' },
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: 'g. Building Code Occupancy Classification:' },
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: '4. FOUNDATION' },
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: '5. MASONRY BEARING WALL' },
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: '6. FLOOR AND ROOF SYSTEM' },
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: '11. OTHER (As required by Architect/Engineer)' },
      ],
      'local 3: The electrical part': [
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: '14. ELECTRICAL SERVICE' },
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: '15. METER AND ELECTRIC ROOMS' },
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: '16. BRANCH CIRCUITS' },
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: '17. CONDUIT RACEWAYS' },
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: 'Exit signs lighting and emergency lighting, along with a functional fire alarm system must all be in good working condition.' },
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: 'e. Electrical repair note appropriate line:' },
      ],
      'local 4: The notice date': [
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: 'a. Date of notice of required inspection' },
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: 'b. Date(s) of actual inspection' },
      ],
      'local 5: How filings are made': [
        { page: 'https://elportalvillage.com/code-enforcement-building-department/', quote: 'PROCESS OPTION 1, HARD COPY DROP OFF VIA APPOINTMENT ONLY TO VILLAGE OF EL PORTAL – BUILDING DEPARTMENT OFFICE. PROCESS OPTION 2, ELECTRONIC PLAN REVIEW SUBMISSION VIA WEB PORTAL.' },
        { page: 'https://elportalvillage.com/code-enforcement-building-department/', quote: 'PLEASE DO NOT E-MAIL ANY PLANS OR SUBMISSION DOCUMENTS AS IT WILL DELAY YOUR REVIEW PROCESS.' },
        { page: 'https://elportalvillage.com/code-enforcement-building-department/', quote: 'Once submitted you will be automatically and periodically updated on the status of your electronic review process.' },
      ],
      'local 6: Which forms it takes': [
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: 'EVALUATION: Each report shall include a statement to the effect that the building is structurally safe, unsafe, safe with qualifications, or has been deemed safe by restrictive interpretation of such statements.' },
      ],
      'faq 1': [
        { page: 'https://elportalvillage.com/code-enforcement-building-department/', quote: 'The Building Department can be reached by calling Village Hall at 305-795-7880.' },
        { page: 'https://elportalvillage.com/code-enforcement-building-department/', quote: 'Code Enforcement & Building Department' },
        { page: 'https://elportalvillage.com/code-enforcement-building-department/', quote: 'Building Official: Pedro J Martinez' },
      ],
      'faq 2': [
        { page: 'https://elportalvillage.com/code-enforcement-building-department/', quote: '40-Year Certification Guidelines' },
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: 'STRUCTURAL INSPECTION' },
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: 'ELECTRICAL INSPECTION' },
      ],
      'faq 3': [
        { page: 'https://elportalvillage.com/code-enforcement-building-department/', quote: 'ATTENTION TO ALL APPLICANTS, ONLY TWO FORMAT SUBMISSION PROCESS OPTIONS WILL BE ACCEPTABLE BY THE VILLAGE OF EL PORTAL – BUILDING DEPARTMENT.' },
        { page: 'https://elportalvillage.com/code-enforcement-building-department/', quote: 'PLEASE DO NOT E-MAIL ANY PLANS OR SUBMISSION DOCUMENTS AS IT WILL DELAY YOUR REVIEW PROCESS.' },
      ],
      'faq 4': [
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: 'a. Date of notice of required inspection' },
      ],
      'faq 5': [
        { page: 'https://elportalvillage.com/code-enforcement-building-department/', quote: '40-Year Certification Guidelines' },
        { page: 'https://elportalvillage.com/wp-content/uploads/2020/09/40-year-cerfication-guidelines-el-portal.pdf', quote: '40-year Certification' },
      ],
      'nextStep': [
        { page: 'https://elportalvillage.com/code-enforcement-building-department/', quote: 'The Building Department can be reached by calling Village Hall at 305-795-7880.' },
      ],
    },
  },
  'building-recertification/florida-city': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.floridacityfl.gov/166/Community-Development', quote: 'City of Florida City 404 West Palm Drive Florida City, FL 33034' },
      { page: 'https://www.floridacityfl.gov/166/Community-Development', quote: 'For assistance, contact the Building Department at 305-247-8222 (option 2).' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.floridacityfl.gov/167/Community-Development-Documents', quote: '40 Year Certification (PDF)' },
        { page: 'https://www.floridacityfl.gov/166/Community-Development', quote: 'NEW ONLINE SERVICES- EFFECTIVE JANUARY 1, 2026 ALL NEW APPLICATIONS ARE REQUIRED TO REGISTER ON eTRAKIT:' },
      ],
      'lede': [
        { page: 'https://www.floridacityfl.gov/166/Community-Development', quote: 'Building Department – Administers permitting, plan review, inspections, and enforcement of applicable building codes to help ensure safe and compliant construction.' },
        { page: 'https://www.floridacityfl.gov/167/Community-Development-Documents', quote: '40 Year Certification (PDF)' },
        { page: 'https://www.floridacityfl.gov/166/Community-Development', quote: 'NEW ONLINE SERVICES- EFFECTIVE JANUARY 1, 2026 ALL NEW APPLICATIONS ARE REQUIRED TO REGISTER ON eTRAKIT:' },
      ],
      'local 1: The City’s document': [
        { page: 'https://www.floridacityfl.gov/167/Community-Development-Documents', quote: '40 Year Certification (PDF)' },
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/154/40-Year-Certification-PDF', quote: 'GENERAL CONSIDERATIONS' },
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/154/40-Year-Certification-PDF', quote: 'BORA Approved - Revised September 17, 2015' },
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/154/40-Year-Certification-PDF', quote: 'STRUCTURAL RECERTIFICATION' },
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/154/40-Year-Certification-PDF', quote: 'ELECTRICAL RECERTIFICATION' },
      ],
      'local 2: What the outlines ask': [
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/154/40-Year-Certification-PDF', quote: 'Date of notice of required inspection' },
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/154/40-Year-Certification-PDF', quote: 'OWNER\'S MAILING ADDRESS' },
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/154/40-Year-Certification-PDF', quote: 'FOLIO NUMBER OF BUILDING:' },
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/154/40-Year-Certification-PDF', quote: 'BUILDING CODE OCCUPANCY CLASSIFICATION:' },
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/154/40-Year-Certification-PDF', quote: 'ELECTRIC SERVICE:' },
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/154/40-Year-Certification-PDF', quote: 'WIRJNG TO MECHANICAL EQUIPMENT: GOOD ( ): REPAIRS REQUIRED' },
      ],
      'local 3: Parking-lot lighting form': [
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/154/40-Year-Certification-PDF', quote: 'CERTIFICATION OF COMPLIANCE WITH PARKING LOT ILLUMINATION' },
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/154/40-Year-Certification-PDF', quote: 'I measured the level of illumination in the' },
      ],
      'local 4: The file’s edition': [
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/154/40-Year-Certification-PDF', quote: 'BORA Approved - Revised September 17, 2015' },
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/154/40-Year-Certification-PDF', quote: 'MINIMUM GUIDELINES AND INFORMATION FOR RECERTIFICATION OF ELECTRICAL' },
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/154/40-Year-Certification-PDF', quote: 'SYSTEMS OF FORTY (40} YEARS STRUCTURES' },
      ],
      'local 5: Online applications': [
        { page: 'https://www.floridacityfl.gov/166/Community-Development', quote: 'NEW ONLINE SERVICES- EFFECTIVE JANUARY 1, 2026 ALL NEW APPLICATIONS ARE REQUIRED TO REGISTER ON eTRAKIT:' },
        { page: 'https://www.floridacityfl.gov/166/Community-Development', quote: 'Legacy system for existing projects prior to Jan. 1, 2026:' },
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/119/Introduction-to-eTRAKiT-Online-Services-Portal-PDF', quote: 'Submit plans and supporting documents electronically' },
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/119/Introduction-to-eTRAKiT-Online-Services-Portal-PDF', quote: 'Track application and permit status in real time' },
      ],
      'local 6: Code cases': [
        { page: 'https://www.floridacityfl.gov/166/Community-Development', quote: 'The Department conducts inspections, responds to complaints, works with property owners to achieve compliance, and refers unresolved violations to the Special Magistrate for further action.' },
      ],
      'faq 1': [
        { page: 'https://www.floridacityfl.gov/166/Community-Development', quote: 'For assistance, contact the Building Department at 305-247-8222 (option 2).' },
        { page: 'https://www.floridacityfl.gov/166/Community-Development', quote: 'Our department includes:' },
      ],
      'faq 2': [
        { page: 'https://www.floridacityfl.gov/166/Community-Development', quote: 'NEW ONLINE SERVICES- EFFECTIVE JANUARY 1, 2026 ALL NEW APPLICATIONS ARE REQUIRED TO REGISTER ON eTRAKIT:' },
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/119/Introduction-to-eTRAKiT-Online-Services-Portal-PDF', quote: 'Submit plans and supporting documents electronically' },
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/119/Introduction-to-eTRAKiT-Online-Services-Portal-PDF', quote: 'Schedule and cancel inspections' },
      ],
      'faq 3': [
        { page: 'https://www.floridacityfl.gov/167/Community-Development-Documents', quote: '40 Year Certification (PDF)' },
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/154/40-Year-Certification-PDF', quote: 'CERTIFICATION OF COMPLIANCE WITH PARKING LOT ILLUMINATION' },
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/154/40-Year-Certification-PDF', quote: 'BORA Approved - Revised September 17, 2015' },
      ],
      'faq 4': [
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/154/40-Year-Certification-PDF', quote: 'Date of notice of required inspection' },
      ],
      'faq 5': [
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/154/40-Year-Certification-PDF', quote: 'meets the minimum' },
        { page: 'https://www.floridacityfl.gov/DocumentCenter/View/154/40-Year-Certification-PDF', quote: 'standards for the occupancy classification of the building as established in' },
      ],
      'nextStep': [
        { page: 'https://www.floridacityfl.gov/166/Community-Development', quote: 'For assistance, contact the Building Department at 305-247-8222 (option 2).' },
      ],
    },
  },
  'building-recertification/medley': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.townofmedley.com/building-and-zoning-department', quote: 'Town of Medley Building Department 7777 NW 72nd Ave Medley, FL 33166 Phone: 305-887-6913' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Recertification Report Submittal Form' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'certify under penalties of perjury, that I have read the' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: '(Notary\'s signature and stamp)' },
      ],
      'lede': [
        { page: 'https://www.townofmedley.com/building-and-zoning-department', quote: 'Building Permit Applications/Forms' },
        { page: 'https://www.townofmedley.com/building-and-zoning-department', quote: 'Recertification Form' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Recertification Report Submittal Form' },
        { page: 'https://www.townofmedley.com/forms/Liens%20&%20Information%20request.pdf', quote: '40 Year Recertification Due:' },
      ],
      'local 1: The submittal form': [
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Recertification Report Submittal Form' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Property Address:' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Folio Number :' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Property Owner Name:' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Mailing Address:' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Architect / Engineer Name' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Contact Name:' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Other (specify):' },
      ],
      'local 2: The owner’s affidavit': [
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'certify under penalties of perjury, that I have read the' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'entire application and the above is correct.' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: '(property owner\'s signature)' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Sworn to and Subscribed before me this' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Personally known to me:' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Or Produced Identification Type:' },
      ],
      'local 3: Approval by trade': [
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Approved/Date' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Disapproved/Date' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Electrical' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Structural' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Building Official' },
      ],
      'local 4: One building, one application': [
        { page: 'https://www.townofmedley.com/documents/Town%20of%20Medley%20-%20Building%20and%20Zoning%20Fee%20Schedule.pdf', quote: '17. RECERTIFICATION (40 YEAR-10 YEAR)' },
        { page: 'https://www.townofmedley.com/documents/Town%20of%20Medley%20-%20Building%20and%20Zoning%20Fee%20Schedule.pdf', quote: 'building, for every Forty (40) Year Building re-certification program' },
        { page: 'https://www.townofmedley.com/documents/Town%20of%20Medley%20-%20Building%20and%20Zoning%20Fee%20Schedule.pdf', quote: 'application as required under the Miami-Dade County Code' },
      ],
      'local 5: Extensions': [
        { page: 'https://www.townofmedley.com/documents/Town%20of%20Medley%20-%20Building%20and%20Zoning%20Fee%20Schedule.pdf', quote: 'extension application for subsequent Ten (10) Year re-certification' },
      ],
      'local 6: Your building’s record': [
        { page: 'https://www.townofmedley.com/forms/Liens%20&%20Information%20request.pdf', quote: 'Liens and Information Request' },
        { page: 'https://www.townofmedley.com/forms/Liens%20&%20Information%20request.pdf', quote: 'Estoppel letter' },
        { page: 'https://www.townofmedley.com/forms/Liens%20&%20Information%20request.pdf', quote: 'OFFICIAL USE ONLY' },
        { page: 'https://www.townofmedley.com/forms/Liens%20&%20Information%20request.pdf', quote: 'Year Built:' },
        { page: 'https://www.townofmedley.com/forms/Liens%20&%20Information%20request.pdf', quote: '40 Year Recertification Due:' },
        { page: 'https://www.townofmedley.com/forms/Liens%20&%20Information%20request.pdf', quote: 'Complied:' },
      ],
      'faq 1': [
        { page: 'https://www.townofmedley.com/building-and-zoning-department', quote: 'Recertification Form' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Recertification Report Submittal Form' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: '(Notary\'s signature and stamp)' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Approved/Date' },
      ],
      'faq 2': [
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: '(property owner\'s signature)' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'certify under penalties of perjury, that I have read the' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Personally known to me:' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Or Produced Identification Type:' },
      ],
      'faq 3': [
        { page: 'https://www.townofmedley.com/documents/Town%20of%20Medley%20-%20Building%20and%20Zoning%20Fee%20Schedule.pdf', quote: 'application as required under the Miami-Dade County Code' },
      ],
      'faq 4': [
        { page: 'https://www.townofmedley.com/forms/Liens%20&%20Information%20request.pdf', quote: 'Building & Zoning Department' },
        { page: 'https://www.townofmedley.com/forms/Liens%20&%20Information%20request.pdf', quote: 'Liens and Information Request' },
        { page: 'https://www.townofmedley.com/forms/Liens%20&%20Information%20request.pdf', quote: '40 Year Recertification Due:' },
        { page: 'https://www.townofmedley.com/forms/Liens%20&%20Information%20request.pdf', quote: 'Complied:' },
      ],
      'faq 5': [
        { page: 'https://www.townofmedley.com/documents/Town%20of%20Medley%20-%20Building%20and%20Zoning%20Fee%20Schedule.pdf', quote: 'building, for every Forty (40) Year Building re-certification program' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Other (specify):' },
        { page: 'https://www.townofmedley.com/documents/Town%20of%20Medley%20-%20Building%20and%20Zoning%20Fee%20Schedule.pdf', quote: 'application as required under the Miami-Dade County Code' },
      ],
      'nextStep': [
        { page: 'https://www.townofmedley.com/building-and-zoning-department', quote: 'Town of Medley Building Department 7777 NW 72nd Ave Medley, FL 33166 Phone: 305-887-6913' },
        { page: 'https://www.townofmedley.com/forms/Recertification%20Form.pdf', quote: 'Sworn to and Subscribed before me this' },
      ],
    },
  },
  'building-recertification/miami-lakes': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.miamilakes-fl.gov/building-recertification/', quote: '6601 Main Street Miami Lakes, FL 33014' },
      { page: 'https://www.miamilakes-fl.gov/building-recertification/', quote: '(305) 827-4015' },
      { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'The Town of Miami Lakes Building Department has implemented an Early Start Request Program' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'Changes effective June 2022' },
        { page: 'https://www.miamilakes-fl.gov/building-recertification/', quote: '40 Year Recertification-Structural' },
        { page: 'https://www.miamilakes-fl.gov/building-recertification/', quote: '40 Year Recertification-Electrical' },
      ],
      'lede': [
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'The Building Department is responsible for the review, inspection and permitting of new construction and/or alterations to any structures within the Town' },
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'For those properties that require certification, the property owners receive a Notice of Required Recertification to commence the process.' },
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'Property owners must submit written recertification reports prepared by a Florida-registered professional engineer or architect, certifying each building or structure is structurally and electrically safe for the specified use for continued occupancy.' },
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'pursuant to Section 8-11(f) of the Code of Miami-Dade County' },
      ],
      'local 1: How it starts': [
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'Each year, new properties become subject to the recertification process at 30 years and every 10-year interval thereafter for the life of the structure, pursuant to Section 8-11(f) of the Code of Miami-Dade County.' },
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'For those properties that require certification, the property owners receive a Notice of Required Recertification to commence the process.' },
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'The recertification reports must be submitted within 90 days from the date of notice.' },
      ],
      'local 2: What the reports certify': [
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'Property owners must submit written recertification reports prepared by a Florida-registered professional engineer or architect, certifying each building or structure is structurally and electrically safe for the specified use for continued occupancy.' },
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'The design professional must have proven qualifications by training and experience in the specific technical field covered in the inspection report (structural and/or electrical) as per the Miami-Dade County Code.' },
      ],
      'local 3: The Town’s forms': [
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'Forty (40) Year Recertification (Electrical)' },
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'Forty (40) Year Recertification (Structural)' },
        { page: 'https://www.miamilakes-fl.gov/wp-content/uploads/2025/10/min-inspection-structural-recert-2025.pdf', quote: 'REGULATORY AND ECONOMIC RESOURCES DEPARTMENT' },
        { page: 'https://www.miamilakes-fl.gov/wp-content/uploads/2025/10/min-inspection-structural-recert-2025.pdf', quote: 'BUILDING RECERTIFICATION INSPECTION REPORT FORM - STRUCTURAL' },
        { page: 'https://www.miamilakes-fl.gov/wp-content/uploads/2025/10/min-inspection-guidelines-electrical-2025.pdf', quote: 'BUILDING RECERTIFICATION INSPECTION REPORT FORM - ELECTRICAL' },
      ],
      'local 4: Revised templates': [
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'The recertification program in Miami-Dade County has been strengthened to include inspecting additional building components and providing a more detailed look into existing buildings.' },
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'Approved by the Board of Rules and Appeals (BORA), the updated guidelines and report templates have been revised and are available below.' },
      ],
      'local 5: What the form asks': [
        { page: 'https://www.miamilakes-fl.gov/wp-content/uploads/2025/10/min-inspection-structural-recert-2025.pdf', quote: 'Initial Inspection Report' },
        { page: 'https://www.miamilakes-fl.gov/wp-content/uploads/2025/10/min-inspection-structural-recert-2025.pdf', quote: 'Amended Inspection Report after completion of repairs' },
        { page: 'https://www.miamilakes-fl.gov/wp-content/uploads/2025/10/min-inspection-structural-recert-2025.pdf', quote: 'Passed the Inspection' },
        { page: 'https://www.miamilakes-fl.gov/wp-content/uploads/2025/10/min-inspection-structural-recert-2025.pdf', quote: 'Maintenance needed but does not rise to the level of Substantial Deterioration or Dangerous' },
        { page: 'https://www.miamilakes-fl.gov/wp-content/uploads/2025/10/min-inspection-structural-recert-2025.pdf', quote: 'Dangerous Condition Observed. Notify Building Official within 10 days' },
        { page: 'https://www.miamilakes-fl.gov/wp-content/uploads/2025/10/min-inspection-structural-recert-2025.pdf', quote: 'Check box if unpermitted work has been identified as per Sec. 1804.1 FBC, EB' },
      ],
      'local 6: Who is exempt': [
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'Note that the following types of residences do not go through the recertification process:' },
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'Buildings with 10 occupant load or less and 2,000 square feet or less' },
      ],
      'local 7: Condominiums and state law': [
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'The new state law, which went into effect on May 26, 2022, created new requirements for milestone inspections of condominium and cooperative association buildings that are three stories and taller.' },
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'The integration of the new law together with the amended Miami-Dade ordinance has the following impacts to all existing buildings in Miami-Dade County.' },
      ],
      'local 8: Each application': [
        { page: 'https://www.miamilakes-fl.gov/wp-content/uploads/2023/09/Building-Department-FEE-SCHEDULE.pdf', quote: 'For every application for 40-year Re-certification under Chapter 8 of the Miami-Dade County' },
        { page: 'https://www.miamilakes-fl.gov/wp-content/uploads/2023/09/Building-Department-FEE-SCHEDULE.pdf', quote: 'Code there shall be paid to the Building Department for the processing of each application:' },
        { page: 'https://www.miamilakes-fl.gov/wp-content/uploads/2023/09/Building-Department-FEE-SCHEDULE.pdf', quote: 'For every application for subsequent Re-certification at 10 year intervals thereafter, there shall' },
      ],
      'faq 1': [
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'For those properties that require certification, the property owners receive a Notice of Required Recertification to commence the process.' },
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'Property owners must submit written recertification reports prepared by a Florida-registered professional engineer or architect, certifying each building or structure is structurally and electrically safe for the specified use for continued occupancy.' },
      ],
      'faq 2': [
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'Forty (40) Year Recertification (Electrical)' },
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'Forty (40) Year Recertification (Structural)' },
        { page: 'https://www.miamilakes-fl.gov/wp-content/uploads/2025/10/min-inspection-structural-recert-2025.pdf', quote: 'REGULATORY AND ECONOMIC RESOURCES DEPARTMENT' },
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'Approved by the Board of Rules and Appeals (BORA), the updated guidelines and report templates have been revised and are available below.' },
      ],
      'faq 3': [
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'The recertification reports must be submitted within 90 days from the date of notice.' },
      ],
      'faq 4': [
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'The new state law, which went into effect on May 26, 2022, created new requirements for milestone inspections of condominium and cooperative association buildings that are three stories and taller.' },
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'Miami-Dade County has had a building recertification program since 1975, which was amended on June 1, 2022.' },
      ],
      'faq 5': [
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'Forty (40) Year Recertification (Structural)' },
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'All buildings built on or before 1982 that have already had an initial recertification inspection through Miami-Dade’s 40-Year program will continue to follow the established schedule.' },
      ],
      'nextStep': [
        { page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/', quote: 'For those properties that require certification, the property owners receive a Notice of Required Recertification to commence the process.' },
      ],
    },
  },
  'building-recertification/miami-springs': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.miamisprings-fl.gov/building/page/building-overview', quote: 'City Hall Building Department Second Floor' },
      { page: 'https://www.miamisprings-fl.gov/building/page/building-overview', quote: '201 Westward Drive Miami Springs, FL 33166' },
      { page: 'https://www.miamisprings-fl.gov/building/page/building-overview', quote: '(305)805-5030' },
      { page: 'https://www.miamisprings-fl.gov/building/page/building-overview', quote: 'The City of Miami Springs Building Department strives to achieve superiority in all facets of building, roofing, mechanical, electrical and plumbing inspections' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.miamisprings-fl.gov/building/page/forty-year-40-yr-or-older-recertification-forms', quote: 'Reports must be submitted into our office in person.' },
        { page: 'https://www.miamisprings-fl.gov/building/page/building-overview', quote: 'City Hall Building Department Second Floor' },
        { page: 'https://www.miamisprings-fl.gov/building/page/forty-year-40-yr-or-older-recertification-forms', quote: 'Structural Recertification form' },
      ],
      'lede': [
        { page: 'https://www.miamisprings-fl.gov/building/page/building-overview', quote: 'This department is responsible for issuing all building permits in the City.' },
        { page: 'https://www.miamisprings-fl.gov/building/page/forty-year-40-yr-or-older-recertification-forms', quote: 'Reports must be submitted into our office in person.' },
        { page: 'https://www.miamisprings-fl.gov/building/page/forty-year-40-yr-or-older-recertification-forms', quote: 'Supporting Documents' },
      ],
      'local 1: Filing in person': [
        { page: 'https://www.miamisprings-fl.gov/building/page/forty-year-40-yr-or-older-recertification-forms', quote: 'Reports must be submitted into our office in person.' },
        { page: 'https://www.miamisprings-fl.gov/building/page/building-overview', quote: 'City Hall Building Department Second Floor' },
        { page: 'https://www.miamisprings-fl.gov/building/page/building-overview', quote: '201 Westward Drive Miami Springs, FL 33166' },
      ],
      'local 2: The city’s list': [
        { page: 'https://www.miamisprings-fl.gov/building/page/forty-year-40-yr-or-older-recertification-forms', quote: 'Recertification Guidelines' },
        { page: 'https://www.miamisprings-fl.gov/building/page/forty-year-40-yr-or-older-recertification-forms', quote: 'Recertification Parking lot illumination' },
        { page: 'https://www.miamisprings-fl.gov/building/page/forty-year-40-yr-or-older-recertification-forms', quote: 'General Considerations Guidelines' },
        { page: 'https://www.miamisprings-fl.gov/building/page/forty-year-40-yr-or-older-recertification-forms', quote: 'Electrical recertification' },
        { page: 'https://www.miamisprings-fl.gov/building/page/forty-year-40-yr-or-older-recertification-forms', quote: 'Structural Recertification form' },
        { page: 'https://www.miamisprings-fl.gov/building/page/forty-year-40-yr-or-older-recertification-forms', quote: 'The files can also be retrieved via Miami-Dade County' },
      ],
      'local 3: County templates': [
        { page: 'https://www.miamisprings-fl.gov/media/41006', quote: 'REGULATORY AND ECONOMIC RESOURCES DEPARTMENT' },
        { page: 'https://www.miamisprings-fl.gov/media/41006', quote: 'BUILDING RECERTIFICATION INSPECTION REPORT FORM - STRUCTURAL' },
        { page: 'https://www.miamisprings-fl.gov/media/41001', quote: 'BUILDING RECERTIFICATION INSPECTION REPORT FORM - ELECTRICAL' },
        { page: 'https://www.miamisprings-fl.gov/media/40986', quote: 'MIAMI-DADE COUNTY BUILDING RECERTIFICATION GENERAL CONSIDERATIONS & GUIDELINES' },
        { page: 'https://www.miamisprings-fl.gov/media/40991', quote: 'Department of Regulatory and Economic Resources' },
      ],
      'local 5: One inspection, two phases': [
        { page: 'https://www.miamisprings-fl.gov/media/40986', quote: 'The Miami-Dade Recertification Program, which is synonymous with the State of Florida Milestone Inspection Program, combines both Phase 1 and Phase 2 inspections into a single inspection.' },
        { page: 'https://www.miamisprings-fl.gov/media/40986', quote: 'The Miami-Dade Recertification Program meets and exceeds the minimum requirements of the State of Florida Milestone Inspection Program adopted in 553.899, Florida Statutes' },
      ],
      'local 6: Initial and amended': [
        { page: 'https://www.miamisprings-fl.gov/media/41006', quote: 'Amended Inspection Report after completion of repairs' },
        { page: 'https://www.miamisprings-fl.gov/media/41001', quote: 'Amended Inspection Report after completion of repairs' },
        { page: 'https://www.miamisprings-fl.gov/media/41006', quote: 'Initial Inspection Report' },
      ],
      'local 7: Processing and the board': [
        { page: 'https://www.miamisprings-fl.gov/media/56676', quote: 'Building Processing Department' },
        { page: 'https://www.miamisprings-fl.gov/media/56676', quote: 'For every application for forty year certification under section 104.9, Florida Building Code, there shall be paid to the City, for the processing of each application' },
        { page: 'https://www.miamisprings-fl.gov/media/56676', quote: 'Unsafe Structures Board Filing' },
        { page: 'https://www.miamisprings-fl.gov/media/56676', quote: 'plus costs (as billed by the Unsafe Structures Board)' },
      ],
      'faq 1': [
        { page: 'https://www.miamisprings-fl.gov/building/page/forty-year-40-yr-or-older-recertification-forms', quote: 'Reports must be submitted into our office in person.' },
        { page: 'https://www.miamisprings-fl.gov/building/page/building-overview', quote: 'City Hall Building Department Second Floor' },
      ],
      'faq 2': [
        { page: 'https://www.miamisprings-fl.gov/building/page/forty-year-40-yr-or-older-recertification-forms', quote: 'Recertification Guidelines' },
        { page: 'https://www.miamisprings-fl.gov/building/page/forty-year-40-yr-or-older-recertification-forms', quote: 'Recertification Parking lot illumination' },
        { page: 'https://www.miamisprings-fl.gov/building/page/forty-year-40-yr-or-older-recertification-forms', quote: 'The files can also be retrieved via Miami-Dade County' },
        { page: 'https://www.miamisprings-fl.gov/media/41006', quote: 'REGULATORY AND ECONOMIC RESOURCES DEPARTMENT' },
      ],
      'faq 3': [
        { page: 'https://www.miamisprings-fl.gov/building/page/forty-year-40-yr-or-older-recertification-forms', quote: 'Reports must be submitted into our office in person.' },
      ],
      'faq 4': [
        { page: 'https://www.miamisprings-fl.gov/media/40986', quote: 'The Miami-Dade Recertification Program, which is synonymous with the State of Florida Milestone Inspection Program, combines both Phase 1 and Phase 2 inspections into a single inspection.' },
      ],
      'faq 5': [
        { page: 'https://www.miamisprings-fl.gov/building/page/forty-year-40-yr-or-older-recertification-forms', quote: 'Forty Year (40 YR) or older Recertification Forms' },
        { page: 'https://www.miamisprings-fl.gov/media/56676', quote: 'Forty year certification fee.' },
      ],
      'nextStep': [
        { page: 'https://www.miamisprings-fl.gov/building/page/forty-year-40-yr-or-older-recertification-forms', quote: 'Reports must be submitted into our office in person.' },
      ],
      'local 4: Where there is parking': [
        { page: 'https://www.miamisprings-fl.gov/media/40991', quote: 'CERTIFICATION OF COMPLIANCE WITH PARKING LOT ILLUMINATION STANDARDS IN CHAPTER 8C-3 OF THE CODE OF MIAMI-DADE COUNTY' },
        { page: 'https://www.miamisprings-fl.gov/building/page/forty-year-40-yr-or-older-recertification-forms', quote: 'Recertification Parking lot illumination' },
      ],
    },
  },
  'building-recertification/north-bay-village': {
    read: '2026-10-17',
    office: [
      { page: 'https://northbayvillage-fl.gov/building-department/', quote: '1666 Kennedy Causeway Suite 101 North Bay Village, FL 33141' },
      { page: 'https://northbayvillage-fl.gov/building-department/', quote: '(305) 754-6740' },
      { page: 'https://northbayvillage-fl.gov/building-department/', quote: 'North Bay Village Building and Zoning Department is responsible for ensuring that all work done in the Village meets the Village’s code as well as the Florida Building Code' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2025/06/FY-24-PERMITS-ISSUED-REPORT.pdf', quote: 'PERMITS ISSUED FOR BUILDING RECERTIFICATION:' },
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2024/08/08-15-2024-Virtual-Special-Magistrate-Hearing-Agenda.pdf', quote: 'Section 151.20(A) of the North Bay Village code of ordinances. Failure to obtain recertification of buildings and components.' },
      ],
      'lede': [
        { page: 'https://northbayvillage-fl.gov/building-department/', quote: 'North Bay Village Building and Zoning Department is responsible for ensuring that all work done in the Village meets the Village’s code as well as the Florida Building Code' },
        { page: 'https://northbayvillage-fl.gov/buildingaudit/', quote: 'Record review of a building’s re-certification history by the Village Building Department' },
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2025/06/FY-24-PERMITS-ISSUED-REPORT.pdf', quote: 'PERMITS ISSUED FOR BUILDING RECERTIFICATION:' },
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2024/08/08-15-2024-Virtual-Special-Magistrate-Hearing-Agenda.pdf', quote: 'NORTH BAY VILLAGE SPECIAL MAGISTRATE HEARING AGENDA' },
      ],
      'local 1: A permit of its own': [
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2025/06/FY-24-PERMITS-ISSUED-REPORT.pdf', quote: 'PERMITS ISSUED FOR BUILDING RECERTIFICATION:' },
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2025/06/FY-22-PERMITS-ISSUED-REPORT.pdf', quote: 'RECERT-000479-2022 Building' },
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2025/06/FY-24-PERMITS-ISSUED-REPORT.pdf', quote: 'PERMITS ISSUED BY TYPE (10/01/2023 TO 09/30/2024)' },
      ],
      'local 2: Repairs under permit': [
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2025/06/FY-22-PERMITS-ISSUED-REPORT.pdf', quote: 'REPAIR CONCRETE AS PER 40-YEAR INSPECTION REPORT' },
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2025/06/FY-22-PERMITS-ISSUED-REPORT.pdf', quote: 'MINOR CONCRETE REPAIRS AS PER RECERTIFICATION REPORT' },
      ],
      'local 3: Digital applications': [
        { page: 'https://northbayvillage-fl.gov/building-department/', quote: 'the Building Department will only be accepting applications digitally.' },
        { page: 'https://northbayvillage-fl.gov/building-department/', quote: 'When ready, email all required permitting documents to the Building Clerk,' },
        { page: 'https://northbayvillage-fl.gov/building-department/', quote: '*Note: PDFs only.' },
      ],
      'local 4: The building audit': [
        { page: 'https://northbayvillage-fl.gov/buildingaudit/', quote: 'The BAP was initiated in light of the Surfside tragedy, which occurred on June 24, 2021.' },
        { page: 'https://northbayvillage-fl.gov/buildingaudit/', quote: 'As part of the BAP, the NBV Building Department is conducting on-site visits and record reviews of all multi-family and commercial buildings located in the Village.' },
        { page: 'https://northbayvillage-fl.gov/buildingaudit/', quote: 'Record review of a building’s re-certification history by the Village Building Department' },
        { page: 'https://northbayvillage-fl.gov/buildingaudit/', quote: 'Are due for a building re-certification (for the 40-year recertification and every 10 years after)' },
        { page: 'https://northbayvillage-fl.gov/buildingaudit/', quote: '*Last Updated: 11/23/2021' },
      ],
      'local 5: Engineering reports': [
        { page: 'https://northbayvillage-fl.gov/buildingaudit/', quote: 'If any deficiencies are identified, a structural engineering report will be requested to be submitted to the Village Building Department within a specified timeframe.' },
        { page: 'https://northbayvillage-fl.gov/buildingaudit/', quote: 'Following such reports, buildings must comply with the engineering recommendations for repairs.' },
      ],
      'local 6: If it is late': [
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2024/08/08-15-2024-Virtual-Special-Magistrate-Hearing-Agenda.pdf', quote: 'Section 151.20(A) of the North Bay Village code of ordinances. Failure to obtain recertification of buildings and components.' },
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2024/08/08-15-2024-Virtual-Special-Magistrate-Hearing-Agenda.pdf', quote: 'Code Enforcement Officer' },
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2024/08/08-15-2024-Virtual-Special-Magistrate-Hearing-Agenda.pdf', quote: 'Video conference' },
      ],
      'local 7: Unsafe buildings': [
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2023/04/NBV-Majestic-Isle-Press-Release.pdf', quote: 'North Bay Village Building Officials deem Majestic Isle Condominium not safe for occupancy and orders residents to evacuate' },
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2023/04/NBV-Majestic-Isle-Press-Release.pdf', quote: 'building engineer retained by the Majestic Isle Condominium Association to perform a building recertification' },
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2023/04/NBV-Majestic-Isle-Press-Release.pdf', quote: 'The building engineer shared a report raising serious concerns with the current conditions of the building' },
      ],
      'local 8: Help with assessments': [
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2025/07/Condo-Special-Assessment-Application-6-25-25-1.pdf', quote: 'rehabilitation and repairs due to applicable building integrity recertification requirements. The assistance is provided as a zero percent interest loan.' },
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2025/07/Condo-Special-Assessment-Application-6-25-25-1.pdf', quote: 'Describe Improvements including the 40-year certification and any other recertifications (if applicable) for Special' },
      ],
      'faq 1': [
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2024/08/08-15-2024-Virtual-Special-Magistrate-Hearing-Agenda.pdf', quote: 'Section 151.20(A) of the North Bay Village code of ordinances. Failure to obtain recertification of buildings and components.' },
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2024/08/08-15-2024-Virtual-Special-Magistrate-Hearing-Agenda.pdf', quote: 'NORTH BAY VILLAGE SPECIAL MAGISTRATE HEARING AGENDA' },
        { page: 'https://northbayvillage-fl.gov/buildingaudit/', quote: 'If any deficiencies are identified, a structural engineering report will be requested to be submitted to the Village Building Department within a specified timeframe.' },
      ],
      'faq 2': [
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2025/06/FY-24-PERMITS-ISSUED-REPORT.pdf', quote: 'PERMITS ISSUED FOR BUILDING RECERTIFICATION:' },
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2025/06/FY-22-PERMITS-ISSUED-REPORT.pdf', quote: 'MINOR CONCRETE REPAIRS AS PER RECERTIFICATION REPORT' },
        { page: 'https://northbayvillage-fl.gov/buildingaudit/', quote: 'To submit a public record request on historical data for your building, please visit the “Contact Us” section at the bottom of this page.' },
      ],
      'faq 3': [
        { page: 'https://northbayvillage-fl.gov/buildingaudit/', quote: 'Once a property has been visited, our CBO follows up with each building and informs them if there are any outstanding issues to be addressed.' },
        { page: 'https://northbayvillage-fl.gov/buildingaudit/', quote: 'We encourage residents to reach out to their Condominium Associations or Property Managers for more details on their BAP visit.' },
        { page: 'https://northbayvillage-fl.gov/buildingaudit/', quote: 'Further below, you will find a list of buildings that have received a visit from the Village Chief Building Official (CBO) as part of the BAP.' },
      ],
      'faq 4': [
        { page: 'https://northbayvillage-fl.gov/buildingaudit/', quote: 'If any deficiencies are identified, a structural engineering report will be requested to be submitted to the Village Building Department within a specified timeframe.' },
      ],
      'faq 5': [
        { page: 'https://northbayvillage-fl.gov/buildingaudit/', quote: 'Are due for a building re-certification (for the 40-year recertification and every 10 years after)' },
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2025/06/FY-22-PERMITS-ISSUED-REPORT.pdf', quote: 'REPAIR CONCRETE AS PER 40-YEAR INSPECTION REPORT' },
        { page: 'https://northbayvillage-fl.gov/wp-content/uploads/2023/04/NBV-Majestic-Isle-Press-Release.pdf', quote: 'in anticipation of the required 60-year building certification' },
      ],
      'nextStep': [
        { page: 'https://northbayvillage-fl.gov/building-department/', quote: '1666 Kennedy Causeway Suite 101 North Bay Village, FL 33141' },
      ],
    },
  },
  'building-recertification/opa-locka': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.opalockafl.gov/faq.aspx?TID=14', quote: 'City of Opa-locka Building and Licensing Department 780 Fisherman Street Opa-locka, FL 33054' },
      { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: '780 Fisherman St. Opa-Locka , FL 33054 Phone: (305) 953-2868 (option #4)' },
      { page: 'https://www.opalockafl.gov/faq.aspx?TID=14', quote: 'If you need a new or reissued permit, contact the Building and Licensing Department at (305) 953-2868.' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'Issuing notices to owners of 40-year-old buildings to comply with the structural and electrical inspection for building recertification' },
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'Reviewing consultants’ reports for 40-year-old building recertification' },
      ],
      'lede': [
        { page: 'https://www.opalockafl.gov/faq.aspx?TID=14', quote: 'City of Opa-locka Building and Licensing Department 780 Fisherman Street Opa-locka, FL 33054' },
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'The Building and Licensing Department issues:' },
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'Building, electrical, mechanical, roofing, and plumbing permits' },
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'Certificates of occupancy' },
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'Issuing notices to owners of 40-year-old buildings to comply with the structural and electrical inspection for building recertification' },
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'Reviewing consultants’ reports for 40-year-old building recertification' },
      ],
      'local 1: The notice': [
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'The department is responsible for:' },
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'Issuing notices to owners of 40-year-old buildings to comply with the structural and electrical inspection for building recertification' },
      ],
      'local 2: The review': [
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'Reviewing consultants’ reports for 40-year-old building recertification' },
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'Reviewing building plans' },
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'PERMIT APPLICATION' },
      ],
      'local 3: Repair permits': [
        { page: 'https://www.opalockafl.gov/faq.aspx?TID=14', quote: 'First, all building permit applications must be submitted in a complete form at the intake counter.' },
        { page: 'https://www.opalockafl.gov/faq.aspx?TID=14', quote: 'Once the application is reviewed for sufficiency, it is given a process number and routed to the Zoning Department.' },
        { page: 'https://www.opalockafl.gov/faq.aspx?TID=14', quote: 'Once Zoning approves the application, it is routed to the plans examination review, where it is reviewed for compliance with the Florida Building Code.' },
        { page: 'https://www.opalockafl.gov/faq.aspx?TID=14', quote: 'Building permits are issued in the name of the person performing the work. Only licensed contractors or owners / builders may obtain a permit.' },
      ],
      'local 4: Small repairs': [
        { page: 'https://www.opalockafl.gov/faq.aspx?TID=14', quote: 'It shall be unlawful to construct, enlarge, alter, repair, move, remove, or demolish any building structure or any part thereof;' },
        { page: 'https://www.opalockafl.gov/faq.aspx?TID=14', quote: 'However, no repairs maybe made without prior approval of the building official.' },
      ],
      'local 5: Older names': [
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'Issuing notices to owners of 40-year-old buildings to comply with the structural and electrical inspection for building recertification' },
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'Reviewing consultants’ reports for 40-year-old building recertification' },
      ],
      'faq 1': [
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'The department is responsible for:' },
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'Issuing notices to owners of 40-year-old buildings to comply with the structural and electrical inspection for building recertification' },
      ],
      'faq 2': [
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'Reviewing consultants’ reports for 40-year-old building recertification' },
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'PERMIT APPLICATION' },
      ],
      'faq 3': [
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'Issuing notices to owners of 40-year-old buildings to comply with the structural and electrical inspection for building recertification' },
      ],
      'faq 4': [
        { page: 'https://www.opalockafl.gov/faq.aspx?TID=14', quote: 'It shall be unlawful to construct, enlarge, alter, repair, move, remove, or demolish any building structure or any part thereof;' },
        { page: 'https://www.opalockafl.gov/faq.aspx?TID=14', quote: 'However, no repairs maybe made without prior approval of the building official.' },
        { page: 'https://www.opalockafl.gov/faq.aspx?TID=14', quote: 'First, all building permit applications must be submitted in a complete form at the intake counter.' },
        { page: 'https://www.opalockafl.gov/faq.aspx?TID=14', quote: 'Once the application is reviewed for sufficiency, it is given a process number and routed to the Zoning Department.' },
        { page: 'https://www.opalockafl.gov/faq.aspx?TID=14', quote: 'Once Zoning approves the application, it is routed to the plans examination review, where it is reviewed for compliance with the Florida Building Code.' },
      ],
      'faq 5': [
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'Issuing notices to owners of 40-year-old buildings to comply with the structural and electrical inspection for building recertification' },
      ],
      'nextStep': [
        { page: 'https://www.opalockafl.gov/73/Building-Licenses', quote: 'Issuing notices to owners of 40-year-old buildings to comply with the structural and electrical inspection for building recertification' },
        { page: 'https://www.opalockafl.gov/faq.aspx?TID=14', quote: 'City of Opa-locka Building and Licensing Department 780 Fisherman Street Opa-locka, FL 33054' },
      ],
    },
  },
  'building-recertification/pinecrest': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.pinecrest-fl.gov/Government/Building', quote: 'Pinecrest Municipal Center 12645 Pinecrest Parkway Pinecrest, FL 33156' },
      { page: 'https://www.pinecrest-fl.gov/Government/Building', quote: 'Phone 305.234.2121' },
      { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'submit a completed report of the inspection performed to the Village of Pinecrest Building Department for review and approval.' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'the Building Department will send a notice to the Owner or Owner’s representative via certified mail.' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'Yes, reports may be submitted electronically at: https://pine-trk.aspgov.com/eTRAKiT/ .' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'When the recertification reports have been approved, the Building Official will issue a Building Recertification approval letter that will be sent to the Owner and the Professional Engineer and/or Architect of record. Retain this letter as proof of approval.' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'Please make sure to submit the following:' },
      ],
      'lede': [
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'submit a completed report of the inspection performed to the Village of Pinecrest Building Department for review and approval.' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'In accordance with the Miami Dade County Code, section 8-11 (f), all buildings, except single-family residences, duplexes, and minor structures,' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'As of January 2022, The Village of Pinecrest will provide, where applicable, advance courtesy noticing of required recertifications.' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'Yes, reports may be submitted electronically at: https://pine-trk.aspgov.com/eTRAKiT/ .' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building', quote: 'Online Permitting System (eTRAKiT)' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'When the recertification reports have been approved, the Building Official will issue a Building Recertification approval letter that will be sent to the Owner and the Professional Engineer and/or Architect of record. Retain this letter as proof of approval.' },
      ],
      'local 1: Courtesy notices': [
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'As of January 2022, The Village of Pinecrest will provide, where applicable, advance courtesy noticing of required recertifications.' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'Advance courtesy noticing will begin two-years before the required recertification cycle, followed by another notice one-year prior to the final 90-day notice of required recertification.' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'Early noticing helps property owners and building managers in planning for the hiring of an engineer or architect and budgeting for any repairs required to maintain compliance with the applicable codes.' },
      ],
      'local 2: The formal notice': [
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'the Building Department will send a notice to the Owner or Owner’s representative via certified mail.' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'shall furnish within ninety (90) days of the receipt of the Notification of Building Recertification a complete written report; which has to be submitted to the Building Official.' },
      ],
      'local 3: Filing the report': [
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'Yes, reports may be submitted electronically at: https://pine-trk.aspgov.com/eTRAKiT/ .' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building', quote: 'Online Permitting System (eTRAKiT)' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'Please make sure to submit the following:' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'Structural Recertification Report' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'Electrical Recertification Report' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'Parking Lot Illumination Standards' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'Parking Lot Guardrails (Certificate of Compliance)' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'Pinecrest Building Recertification Submittal Form' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'All reports must be digitally signed and sealed.' },
      ],
      'local 4: Guidelines and scope': [
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'The Recommended Minimum Inspection Procedural Guidelines for Building Recertification to be utilized by your architect or engineer are available online at the following link(s):' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'General Considerations & Guidelines - Scope of Structural Inspections' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'in conformity with the minimum inspection procedural guidelines as issued by the Miami Dade County Board of Rules and Appeals.' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'Report will also include an Illumination Survey for the parking areas.' },
      ],
      'local 5: Repairs': [
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'In the event that repairs or modifications are found to be necessary resulting from the building recertification inspection,' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'The Owner of the property must hire a State of Florida Licensed Contractor and obtain permits from the Building Department prior to performing any repairs or modifications.' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'Once all permits receive an approved final inspection from the electrical and/or structural inspectors, the Professional Engineer and/or the Registered Architect of record must submit a signed and sealed report stating that all repairs have been completed and the building is structurally and electrically safe for continued use.' },
      ],
      'local 6: Extensions': [
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'The Building Official may issue an extension of not more than 60 days from the recertification deadline to submit a recertification report or to obtain any necessary permits upon a written extension request from an engineer or architect.' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'Such a request must contain a signed and sealed statement from the engineer or architect that the building may continue to be occupied while undergoing recertification.' },
      ],
      'local 7: Approval': [
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'to the Building Department Governmental Compliance Section, certifying that the building is structurally and electrically safe for the specified use and occupancy in conformity with the minimum inspection procedure.' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'When the recertification reports have been approved, the Building Official will issue a Building Recertification approval letter that will be sent to the Owner and the Professional Engineer and/or Architect of record. Retain this letter as proof of approval.' },
      ],
      'local 8: If it is late': [
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'will result in the issuance of a Building Violation' },
      ],
      'faq 1': [
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'the Building Department will send a notice to the Owner or Owner’s representative via certified mail.' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'As of January 2022, The Village of Pinecrest will provide, where applicable, advance courtesy noticing of required recertifications.' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'shall furnish within ninety (90) days of the receipt of the Notification of Building Recertification a complete written report; which has to be submitted to the Building Official.' },
      ],
      'faq 2': [
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'Yes, reports may be submitted electronically at: https://pine-trk.aspgov.com/eTRAKiT/ .' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'All reports must be digitally signed and sealed.' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'Please make sure to submit the following:' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'Pinecrest Building Recertification Submittal Form' },
      ],
      'faq 3': [
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'The Building Official may issue an extension of not more than 60 days from the recertification deadline to submit a recertification report or to obtain any necessary permits upon a written extension request from an engineer or architect.' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'Such a request must contain a signed and sealed statement from the engineer or architect that the building may continue to be occupied while undergoing recertification.' },
      ],
      'faq 4': [
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'In accordance with the Miami Dade County Code, section 8-11 (f), all buildings, except single-family residences, duplexes, and minor structures,' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'Minor Buildings are defined as any occupancy group having an occupant load of 10 or less, and having a gross area of 2,000 square feet or less.' },
      ],
      'faq 5': [
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'When did this change from a 40 year Recertification process?' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'The new state law, which went into effect on May 26, 2022, created new requirements for milestone inspections of condominium and cooperative association buildings that are three stories and taller.' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'The changes of the Miami-Dade County recertification program became effective on June 01, 2022, and have been enhanced to include inspections of additional building components and a more detailed look at existing buildings.' },
      ],
      'nextStep': [
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'As of January 2022, The Village of Pinecrest will provide, where applicable, advance courtesy noticing of required recertifications.' },
        { page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification', quote: 'the Building Department will send a notice to the Owner or Owner’s representative via certified mail.' },
      ],
    },
  },
  'building-recertification/sweetwater': {
    read: '2026-10-17',
    office: [
      { page: 'https://cityofsweetwater.fl.gov/158/Building-Zoning', quote: '1695 NW 110 Ave Unit 109 Sweetwater FL 33172' },
      { page: 'https://cityofsweetwater.fl.gov/158/Building-Zoning', quote: 'Phone: 305-485-4526' },
      { page: 'https://cityofsweetwater.fl.gov/158/Building-Zoning', quote: 'The City of Sweetwater Building and Zoning Department is dedicated to promoting safe, sustainable, and well-planned community growth by ensuring compliance with the Florida Building Code, zoning regulations, and land-use policies.' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: 'City of Sweetwater Building Department Memorandum' },
        { page: 'https://cityofsweetwater.fl.gov/159/Important-Forms-Building-Zoning', quote: '40-Year Certification Instructions (PDF)' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/134/40-Year-Certification-Instructions-PDF', quote: 'Step 2- Attach in the same email the engineer Report documents in PDF format.' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/774/Electronic-submittals-Instructions', quote: 'Email the documents to SUBMITTALS@CITYOFSWEETWATER.FL.GOV.' },
      ],
      'lede': [
        { page: 'https://cityofsweetwater.fl.gov/158/Building-Zoning', quote: 'The City of Sweetwater Building and Zoning Department is dedicated to promoting safe, sustainable, and well-planned community growth by ensuring compliance with the Florida Building Code, zoning regulations, and land-use policies.' },
        { page: 'https://cityofsweetwater.fl.gov/159/Important-Forms-Building-Zoning', quote: '40-Year Recertification' },
        { page: 'https://cityofsweetwater.fl.gov/159/Important-Forms-Building-Zoning', quote: '40-Year Memorandum (PDF)' },
        { page: 'https://cityofsweetwater.fl.gov/159/Important-Forms-Building-Zoning', quote: '40-Year Certification Instructions (PDF)' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: 'City of Sweetwater Building Department Memorandum' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/134/40-Year-Certification-Instructions-PDF', quote: '40 Year Recertification -Electronic submittal instructions' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/134/40-Year-Certification-Instructions-PDF', quote: 'Step 4- Once the report is reviewed by our Engineer and by all applicable trades, you will receive a call advising the status of the permit, if it is ready for pick up' },
      ],
      'local 1: The memorandum': [
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: 'City of Sweetwater Building Department Memorandum' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: 'you must submit a written Recertification Report to the Building Official, prepared by a Florida registered professional engineer or architect*, certifying each building or structure is structurally and electrically safe for the specified use for continued occupancy.' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: 'Under Section 8-11(f) of the Miami-Dade County Code, the owner of a building which has been in existence for forty (40) years or longer is required to have the building inspected' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: 'within ninety (90) days of Notice of Required Inspection' },
      ],
      'local 2: Filing by e-mail': [
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/134/40-Year-Certification-Instructions-PDF', quote: 'Step 1 - Submit a permit application signed by owner and engineer in order to obtain a permit number,' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/134/40-Year-Certification-Instructions-PDF', quote: 'Step 2- Attach in the same email the engineer Report documents in PDF format.' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/134/40-Year-Certification-Instructions-PDF', quote: 'Following the 40 year Structural and Electric Certification formats.' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/134/40-Year-Certification-Instructions-PDF', quote: 'Step 3- If accepted, we will email back with the receipt' },
      ],
      'local 3: The review': [
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/134/40-Year-Certification-Instructions-PDF', quote: 'Step 4- Once the report is reviewed by our Engineer and by all applicable trades, you will receive a call advising the status of the permit, if it is ready for pick up' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/134/40-Year-Certification-Instructions-PDF', quote: 'or if you have comments that needs to be addressed.' },
      ],
      'local 4: What the report carries': [
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: 'Each page of the electrical and structural report must be signed and sealed by the engineer or architect.' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: 'In addition, if there is more than one building on the property, please submit a site plan or copy of a survey showing the location of each building. The building which is the subject of the 40-Year Recertification report must be clearly identified on the site plan or survey submitted.' },
      ],
      'local 5: Lot certificates': [
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: 'you are required to submit the enclosed documents certifying compliance with the parking lot illumination standards and guardrail requirements signed and sealed by your architect or professional engineer.' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: 'Also included in this package is a copy of Chapter 8C of the Code of Miami-Dade County relating to parking lot illumination and guardrails.' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: 'the minimum prescribed standards for parking lot illumination and guardrails contained in Sections 8C-3 and 8C-6 were made retroactive upon adoption.' },
      ],
      'local 6: Claiming an exemption': [
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: 'If the building which is the subject of this notice is exempt for any of the above reasons, the building is not forty (40) years old or older or the building has been demolished, please notify this office and submit any available documentation. If you are claiming an exemption for an existing building, please submit dated pictures showing the front and rear of the building.' },
      ],
      'local 7: If it is late': [
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: 'Failure to submit the required Recertification Report will result in the issuance of a Civil Violation Notice or ticket without further notice to you and referral of this matter to the Unsafe Structures Unit for the initiation of condemnation proceedings.' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: 'Further, upon issuance of an unsafe structures Notice of Violation, the building must be vacated and you may ultimately have to demolish the building.' },
      ],
      'local 8: Two street addresses': [
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: '1701 N.W. 112 Ave #102 Sweetwater, Florida 33172' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/134/40-Year-Certification-Instructions-PDF', quote: 'Building and Zoning Department 1701 NW 112 Ave, # 102 Sweetwater, FL. 33172' },
        { page: 'https://cityofsweetwater.fl.gov/158/Building-Zoning', quote: '1695 NW 110 Ave Unit 109 Sweetwater FL 33172' },
      ],
      'faq 1': [
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/134/40-Year-Certification-Instructions-PDF', quote: 'Step 1 - Submit a permit application signed by owner and engineer in order to obtain a permit number,' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/134/40-Year-Certification-Instructions-PDF', quote: 'Step 2- Attach in the same email the engineer Report documents in PDF format.' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/774/Electronic-submittals-Instructions', quote: 'Email the documents to SUBMITTALS@CITYOFSWEETWATER.FL.GOV.' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/774/Electronic-submittals-Instructions', quote: 'We accept your permit applications by email only. We do not accept hard copies at our office.' },
      ],
      'faq 2': [
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/134/40-Year-Certification-Instructions-PDF', quote: 'Step 4- Once the report is reviewed by our Engineer and by all applicable trades, you will receive a call advising the status of the permit, if it is ready for pick up' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/134/40-Year-Certification-Instructions-PDF', quote: 'or if you have comments that needs to be addressed.' },
      ],
      'faq 3': [
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: 'within ninety (90) days of Notice of Required Inspection' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: 'as determined by the Building Official, who shall at such time issue a Notice of Required Inspection to the building owner.' },
      ],
      'faq 4': [
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: 'Failure to submit the required Recertification Report will result in the issuance of a Civil Violation Notice or ticket without further notice to you and referral of this matter to the Unsafe Structures Unit for the initiation of condemnation proceedings.' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: 'Further, upon issuance of an unsafe structures Notice of Violation, the building must be vacated and you may ultimately have to demolish the building.' },
      ],
      'faq 5': [
        { page: 'https://cityofsweetwater.fl.gov/159/Important-Forms-Building-Zoning', quote: '40-Year Recertification' },
        { page: 'https://cityofsweetwater.fl.gov/159/Important-Forms-Building-Zoning', quote: '40-Year Memorandum (PDF)' },
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: 'Under Section 8-11(f) of the Miami-Dade County Code, the owner of a building which has been in existence for forty (40) years or longer is required to have the building inspected' },
      ],
      'nextStep': [
        { page: 'https://cityofsweetwater.fl.gov/DocumentCenter/View/133/40-Year-Memorandum-PDF', quote: 'City of Sweetwater Building Department Memorandum' },
        { page: 'https://cityofsweetwater.fl.gov/158/Building-Zoning', quote: 'The City of Sweetwater Building and Zoning Department is dedicated to promoting safe, sustainable, and well-planned community growth by ensuring compliance with the Florida Building Code, zoning regulations, and land-use policies.' },
      ],
    },
  },
  'building-recertification/west-miami': {
    read: '2026-10-17',
    office: [
      { page: 'https://cityofwestmiami.gov/index.asp?SEC=DBC123E0-8D93-4518-8D26-284545C66EE0', quote: 'Located at City of West Miami Building Department 901 SW 62 Avenue West Miami, FL 33144' },
      { page: 'https://cityofwestmiami.gov/index.asp?SEC=DBC123E0-8D93-4518-8D26-284545C66EE0', quote: 'Building Department Number 305-266-4214' },
      { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'CITY OF WEST MIAMI BUILDING DEPARTMENT 901 SW 62 Avenue West Miami, Florida 33144 Phone: 305-266-4214' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'The City of West Miami Building Department has received notification from the Property Appraiser\'s Office that the building on the property located at' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'Please mail the report' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'Attention: City of West Miami Building Department 901 SW 62 Avenue' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_STRUCTURAL_REVIEW_FORM.pdf', quote: 'CITY OF WEST MIAMI BUILDING DEPARTMENT' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'As part of your submission for the 40 Year Recertification, you are required to submit the enclosed documents certifying compliance with the parking lot illumination standards and guardrail requirements signed and sealed by your architect or professional engineer.' },
      ],
      'lede': [
        { page: 'https://cityofwestmiami.gov/index.asp?SEC=DBC123E0-8D93-4518-8D26-284545C66EE0', quote: 'Located at City of West Miami Building Department 901 SW 62 Avenue West Miami, FL 33144' },
        { page: 'https://cityofwestmiami.gov/index.asp?SEC=DBC123E0-8D93-4518-8D26-284545C66EE0', quote: 'The Building Department provides customer-friendly services including review, processing, issuance and inspection of building permits and assurance that construction in the City of West Miami complies with the provisions of City, County and Florida Building Code.' },
        { page: 'https://cityofwestmiami.gov/index.asp?SEC=BDCBD8E0-DEC4-4C85-836A-C44A5457F1A6&Type=B_BASIC', quote: '40 YEAR LETTER OF NOTIFICATION.pdf' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'you must submit a written Recertification Report to the Building Official' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'Please mail the report' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'Failure to submit the required Recertification Report will result in the issuance of a Civil Violation Notice or ticket without further notice to you and referral of this matter to the Unsafe Structures Unit for the initiation of condemnation proceedings.' },
      ],
      'local 1: The letter': [
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'The City of West Miami Building Department has received notification from the Property Appraiser\'s Office that the building on the property located at' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'Under Section 8-11(f) of the Miami-Dade County Code, the owner of a building which has been in existence for forty (40) years or longer is required to have the building inspected' },
      ],
      'local 2: Sending the report': [
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'Please mail the report' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'Attention: City of West Miami Building Department 901 SW 62 Avenue' },
        { page: 'https://cityofwestmiami.gov/index.asp?SEC=DBC123E0-8D93-4518-8D26-284545C66EE0', quote: 'Permit Portal' },
      ],
      'local 3: The city’s forms': [
        { page: 'https://cityofwestmiami.gov/index.asp?SEC=BDCBD8E0-DEC4-4C85-836A-C44A5457F1A6&Type=B_BASIC', quote: '40 YEAR CERTIFICATION OF COMPLIANCE FORMS.pdf' },
        { page: 'https://cityofwestmiami.gov/index.asp?SEC=BDCBD8E0-DEC4-4C85-836A-C44A5457F1A6&Type=B_BASIC', quote: '40 YEAR ELECTRICAL INSPECTION GUIDELINES.pdf' },
        { page: 'https://cityofwestmiami.gov/index.asp?SEC=BDCBD8E0-DEC4-4C85-836A-C44A5457F1A6&Type=B_BASIC', quote: '40 YEAR GENERAL CONSIDERATIONS GUIDELINES.pdf' },
        { page: 'https://cityofwestmiami.gov/index.asp?SEC=BDCBD8E0-DEC4-4C85-836A-C44A5457F1A6&Type=B_BASIC', quote: '40 YEAR LETTER OF NOTIFICATION.pdf' },
        { page: 'https://cityofwestmiami.gov/index.asp?SEC=BDCBD8E0-DEC4-4C85-836A-C44A5457F1A6&Type=B_BASIC', quote: '40 YEAR STRUCTURAL REVIEW FORM.pdf' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_STRUCTURAL_REVIEW_FORM.pdf', quote: 'CITY OF WEST MIAMI BUILDING DEPARTMENT' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_STRUCTURAL_REVIEW_FORM.pdf', quote: 'MINIMUM INSPECTION PROCEDURAL GUIDELINES FOR BUILDING STRUCTURAL RECERTIFICATION' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'The forms which are in PDF(Portable Document Format) can be filled out by your architect or engineer and then printed. If you prefer, you can obtain a hard copy of the forms by contacting our office at (305) 266-4214.' },
      ],
      'local 4: Paper copies': [
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'The forms which are in PDF(Portable Document Format) can be filled out by your architect or engineer and then printed. If you prefer, you can obtain a hard copy of the forms by contacting our office at (305) 266-4214.' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'For further information, please contact the Billing and Collection Unit Supervisor at (305) 266-4214.' },
      ],
      'local 5: What the report carries': [
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'Each page of the electrical and structural report must be signed and sealed by the engineer or architect.' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'In addition, if there is more than one building on the property, please submit a site plan or copy of a survey showing the location of each building. The building which is the subject of the 40-Year Recertification report must be clearly identified on the site plan or survey submitted.' },
      ],
      'local 6: The lot certificates': [
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'Included with this package is a copy of Chapter 8C of the Code of Miami-Dade County relating to parking lot illumination and guardrails.' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'As part of your submission for the 40 Year Recertification, you are required to submit the enclosed documents certifying compliance with the parking lot illumination standards and guardrail requirements signed and sealed by your architect or professional engineer.' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_CERTIFICATION_OF_COMPLIANCE_FORMS.pdf', quote: 'The parking lot(s) is adjacent to or abutting a canal, lake or other body of water and parked vehicles are not protected by a guardrail that complies with Section 8C-6 of the Miami-Dade County Code. I have advised the property owner that he/she must obtain a permit for the installation of the guardrail and obtain all required inspection approvals to avoid enforcement action.' },
      ],
      'local 7: Claiming an exemption': [
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'If the building which is the subject of this notice is exempt for any of the above reasons, the building is not forty (40) years old or older or the building has been demolished, please notify this office and submit any available documentation. If you are claiming an exemption for an existing building, please submit dated pictures showing the front and rear of the building.' },
      ],
      'local 8: If it is late': [
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'Failure to submit the required Recertification Report will result in the issuance of a Civil Violation Notice or ticket without further notice to you and referral of this matter to the Unsafe Structures Unit for the initiation of condemnation proceedings.' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'Further, upon issuance of an unsafe structures Notice of Violation, the building must be vacated and you may ultimately have to demolish the building.' },
      ],
      'faq 1': [
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'The City of West Miami Building Department has received notification from the Property Appraiser\'s Office that the building on the property located at' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'Building Official' },
      ],
      'faq 2': [
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'Please mail the report' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'Attention: City of West Miami Building Department 901 SW 62 Avenue' },
        { page: 'https://cityofwestmiami.gov/index.asp?SEC=DBC123E0-8D93-4518-8D26-284545C66EE0', quote: 'Permit Portal' },
        { page: 'https://cityofwestmiami.gov/index.asp?SEC=BDCBD8E0-DEC4-4C85-836A-C44A5457F1A6&Type=B_BASIC', quote: '40 YEAR STRUCTURAL REVIEW FORM.pdf' },
      ],
      'faq 3': [
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'You are required to submit the completed Recertification Report within ninety (90) days from the date of this notice.' },
      ],
      'faq 4': [
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'Please note that single family homes, duplexes and all other buildings with an occupant load of ten (10) or less and two thousand (2,000) square feet or less in area are exempt from recertification requirements. Non-residential farm buildings on farms are also exempt from recertification requirements.' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'If the building which is the subject of this notice is exempt for any of the above reasons, the building is not forty (40) years old or older or the building has been demolished, please notify this office and submit any available documentation. If you are claiming an exemption for an existing building, please submit dated pictures showing the front and rear of the building.' },
      ],
      'faq 5': [
        { page: 'https://cityofwestmiami.gov/index.asp?SEC=BDCBD8E0-DEC4-4C85-836A-C44A5457F1A6&Type=B_BASIC', quote: '40 YEAR CERTIFICATION OF COMPLIANCE FORMS.pdf' },
        { page: 'https://cityofwestmiami.gov/index.asp?SEC=BDCBD8E0-DEC4-4C85-836A-C44A5457F1A6&Type=B_BASIC', quote: '40 YEAR ELECTRICAL INSPECTION GUIDELINES.pdf' },
        { page: 'https://cityofwestmiami.gov/index.asp?SEC=BDCBD8E0-DEC4-4C85-836A-C44A5457F1A6&Type=B_BASIC', quote: '40 YEAR GENERAL CONSIDERATIONS GUIDELINES.pdf' },
        { page: 'https://cityofwestmiami.gov/index.asp?SEC=BDCBD8E0-DEC4-4C85-836A-C44A5457F1A6&Type=B_BASIC', quote: '40 YEAR LETTER OF NOTIFICATION.pdf' },
        { page: 'https://cityofwestmiami.gov/index.asp?SEC=BDCBD8E0-DEC4-4C85-836A-C44A5457F1A6&Type=B_BASIC', quote: '40 YEAR STRUCTURAL REVIEW FORM.pdf' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'Under Section 8-11(f) of the Miami-Dade County Code, the owner of a building which has been in existence for forty (40) years or longer is required to have the building inspected' },
      ],
      'nextStep': [
        { page: 'https://cityofwestmiami.gov/index.asp?SEC=DBC123E0-8D93-4518-8D26-284545C66EE0', quote: 'Located at City of West Miami Building Department 901 SW 62 Avenue West Miami, FL 33144' },
        { page: 'https://cityofwestmiami.gov/vertical/sites/%7B43D8A331-4B65-45FE-843C-E0F6FE3CD0E8%7D/uploads/40_YEAR_LETTER_OF_NOTIFICATION_2017_v2021.pdf', quote: 'The City of West Miami Building Department has received notification from the Property Appraiser\'s Office that the building on the property located at' },
      ],
    },
  },
  'broward-bsip/cooper-city': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.coopercity.gov/page/building-division', quote: 'The Building Division\'s lobby is located within City Hall. 9090 SW 50 Place Cooper City, FL 33328' },
      { page: 'https://www.coopercity.gov/page/building-division', quote: 'Phone 954-434-4300 #4' },
      { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: '(954) 434-4300' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.coopercity.gov/documents/departments/community-development/building-division/applications-%26-submittal-forms-(permitting)/823554', quote: 'Form - Commercial Building Safety Inspection Program' },
        { page: 'https://www.coopercity.gov/documents/departments/community-development/building-division/applications-%26-submittal-forms-(permitting)/823554', quote: 'Applications & Submittal Forms (Permitting)' },
      ],
      'lede': [
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'CITY OF COOPER CITY COMMUNITY DEVELOPMENT DEPARTMENT BUILDING DIVISION' },
        { page: 'https://www.coopercity.gov/documents/departments/community-development/building-division/applications-%26-submittal-forms-(permitting)/823554', quote: 'Form - Commercial Building Safety Inspection Program' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Building Safety Inspection Program' },
      ],
      'local 1: The city’s form': [
        { page: 'https://www.coopercity.gov/documents/departments/community-development/building-division/applications-%26-submittal-forms-(permitting)/823554', quote: 'Form - Commercial Building Safety Inspection Program' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'CITY OF COOPER CITY COMMUNITY DEVELOPMENT DEPARTMENT BUILDING DIVISION' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Project #:' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Site Address:' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Property Name/Bldg.:' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Folio #:' },
      ],
      'local 2: The building’s cycle': [
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Actual Year Built:' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: '25-Year Due:' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: '35-Year Due:' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: '45-Year Due:' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: '55-Year Due:' },
      ],
      'local 3: Two professionals named': [
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Structural Engineer/Architect:' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Electrical Engineer/Architect:' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'License #:' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Contact Name:' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Contact Email:' },
      ],
      'local 4: The city’s review': [
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'For Office Use Only:' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Structural Reviewed by:' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Electrical Reviewed by:' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Structural Repair Permit Required?' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Electrical Repair Permit Required?' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: '2nd Structural/Electrical Report Required' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Additional Comments:' },
      ],
      'local 5: Permits and the portal': [
        { page: 'https://www.coopercity.gov/page/building-division', quote: 'Permitting, inspections and plan review are now handled through Accela Citizen Access.' },
        { page: 'https://www.coopercity.gov/page/building-division', quote: 'From there, you can view your permit, upload documents, schedule inspections, and make payments online, any time.' },
      ],
      'faq 1': [
        { page: 'https://www.coopercity.gov/page/building-division', quote: 'Notices & Announcements' },
        { page: 'https://www.coopercity.gov/page/building-division', quote: 'Permitting & Inspections' },
        { page: 'https://www.coopercity.gov/documents/departments/community-development/building-division/applications-%26-submittal-forms-(permitting)/823554', quote: 'Form - Commercial Building Safety Inspection Program' },
        { page: 'https://www.coopercity.gov/page/building-division', quote: 'Phone 954-434-4300 #4 Email Building@CooperCity.gov' },
      ],
      'faq 2': [
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Project #:' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Folio #:' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Actual Year Built:' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Contact Name:' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Structural Engineer/Architect:' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'For Office Use Only:' },
      ],
      'faq 3': [
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Structural Repair Permit Required?' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Electrical Repair Permit Required?' },
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: '2nd Structural/Electrical Report Required' },
      ],
      'faq 4': [
        { page: 'https://www.coopercity.gov/page/building-division', quote: 'Permitting, inspections and plan review are now handled through Accela Citizen Access.' },
        { page: 'https://www.coopercity.gov/page/building-division', quote: 'All first-time users of the online permitting portal will need to create an account to get started.' },
        { page: 'https://www.coopercity.gov/page/building-division', quote: 'If your permit was created prior to September 15, 2025, create your account and we will connect your existing permit to it so you can manage everything in one place.' },
        { page: 'https://www.coopercity.gov/page/building-division', quote: 'Contact us to connect your permit. Please call the Building Division at 954-434-4300 #4 or email Building@CooperCity.gov with three items:' },
      ],
      'nextStep': [
        { page: 'https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/5674/Ccc/191cbeaf-5f8b-47ec-a31b-9f0776b9221e/Form_Commercial_Building_Safety_Inspection_Pro.pdf', quote: 'Building Safety Inspection Program' },
      ],
    },
  },
  'broward-bsip/coral-springs': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.coralsprings.gov/Government/Departments/Building/Building-Safety-Inspection-Electronic-Submittal', quote: 'Phone 954-344-1025 Email buildingpermits@coralsprings.gov Location 9500 West Sample Road Coral Springs 33065' },
      { page: 'https://www.coralsprings.gov/Government/Departments/Building', quote: 'City Hall 9500 West Sample Road Coral Springs, FL 33065' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.coralsprings.gov/Government/Departments/Building', quote: 'The Building Department provides customer friendly plan review, issues building permits, performs field inspections, and issues certificates of occupancy' },
        { page: 'https://www.coralsprings.gov/Government/Departments/Building/Building-Safety-Inspection-Electronic-Submittal', quote: 'Building Safety Inspection Electronic Submittal' },
        { page: 'https://www.coralsprings.gov/Government/Departments/Building', quote: 'City of Coral Springs Submittal Form (Required)' },
      ],
      'lede': [
        { page: 'https://www.coralsprings.gov/Government/Departments/Building', quote: 'Please review the Broward County Board of Rules and Appeals (BORA) Policy # 05-05 for detailed program requirements.' },
        { page: 'https://www.coralsprings.gov/Government/Departments/Building', quote: 'City of Coral Springs Submittal Form (Required) Broward County Required Inspection Forms Instructions for Electronic Submittal of Inspection Reports' },
        { page: 'https://www.coralsprings.gov/Government/Departments/Building/Building-Safety-Inspection-Electronic-Submittal', quote: 'Please note that reports and submittal form must be uploaded as separate PDF files.' },
      ],
      'local 1: The program page': [
        { page: 'https://www.coralsprings.gov/Government/Departments/Building', quote: 'The Building Safety Inspection Program became effective in Broward County in January 2006. In 2023, the program requirements changed. The current program requires structural and electrical safety inspections for buildings 25 years old and then every ten years thereafter.' },
        { page: 'https://www.coralsprings.gov/Government/Departments/Building/Broward-County-Board-of-Rules-and-Appeals-BORA', quote: 'The Broward County Board of Rules and Appeals (BORA) website is currently unavailable. For your convenience, the applicable BORA policies, guidelines, and required inspection forms are provided below for access while the website is down.' },
      ],
      'local 2: The notice': [
        { page: 'https://www.coralsprings.gov/files/assets/public/documents/building/building-forms/040.0-40-year-building-safety-inspection-submittal-form-ada.pdf', quote: '(Refer to your NOTICE OF REQUIRED BUILDING SAFETY INSPECTION letter for applicable fees)' },
      ],
      'local 3: Filing the report': [
        { page: 'https://www.coralsprings.gov/Government/Departments/Building/Building-Safety-Inspection-Electronic-Submittal', quote: 'Log-in to your public or contractor account.' },
        { page: 'https://www.coralsprings.gov/Government/Departments/Building/Building-Safety-Inspection-Electronic-Submittal', quote: 'Enter your project number & select your project.' },
        { page: 'https://www.coralsprings.gov/Government/Departments/Building/Building-Safety-Inspection-Electronic-Submittal', quote: 'Fees must be paid first.' },
        { page: 'https://www.coralsprings.gov/Government/Departments/Building/Building-Safety-Inspection-Electronic-Submittal', quote: 'Click on attachment (paper clip icon upper left-hand corner) & upload your reports with the submittal form.' },
        { page: 'https://www.coralsprings.gov/Government/Departments/Building', quote: 'Online Permitting (eTrakit)' },
      ],
      'local 4: Separate PDF files': [
        { page: 'https://www.coralsprings.gov/Government/Departments/Building/Building-Safety-Inspection-Electronic-Submittal', quote: 'Please note that reports and submittal form must be uploaded as separate PDF files.' },
        { page: 'https://www.coralsprings.gov/Government/Departments/Building/Building-Safety-Inspection-Electronic-Submittal', quote: 'Each attachment must be uploaded separately and named as follows: Submittal Form Structural Inspection Report Electrical Inspection Report Inspection Photos' },
      ],
      'local 5: The city’s submittal form': [
        { page: 'https://www.coralsprings.gov/Government/Departments/Building', quote: 'City of Coral Springs Submittal Form (Required)' },
        { page: 'https://www.coralsprings.gov/files/assets/public/documents/building/building-forms/040.0-40-year-building-safety-inspection-submittal-form-ada.pdf', quote: 'Building Safety Inspection Program Submittal Form' },
        { page: 'https://www.coralsprings.gov/files/assets/public/documents/building/building-forms/040.0-40-year-building-safety-inspection-submittal-form-ada.pdf', quote: '(ALL FORMS MUST BE COMPLETED IN BLACK/BLUE INK OR TYPED)' },
        { page: 'https://www.coralsprings.gov/files/assets/public/documents/building/building-forms/040.0-40-year-building-safety-inspection-submittal-form-ada.pdf', quote: 'Job Address: Subdivision Square Feet Eng/Arch 1: Eng/Arch 1 Address: Phone (Required) Eng/Arch 2: Eng/Arch 2 Address: Phone (Required)' },
        { page: 'https://www.coralsprings.gov/files/assets/public/documents/building/building-forms/040.0-40-year-building-safety-inspection-submittal-form-ada.pdf', quote: 'Email Address (Required)' },
        { page: 'https://www.coralsprings.gov/files/assets/public/documents/building/building-forms/040.0-40-year-building-safety-inspection-submittal-form-ada.pdf', quote: 'Present Use:' },
      ],
      'local 6: Three kinds of submittal': [
        { page: 'https://www.coralsprings.gov/files/assets/public/documents/building/building-forms/040.0-40-year-building-safety-inspection-submittal-form-ada.pdf', quote: 'POST REPAIRS INSPECTION RECHECK' },
        { page: 'https://www.coralsprings.gov/files/assets/public/documents/building/building-forms/040.0-40-year-building-safety-inspection-submittal-form-ada.pdf', quote: '(For RECHECK ONLY, please list the permit numbers for repairs)' },
      ],
      'local 7: The county’s report forms': [
        { page: 'https://www.coralsprings.gov/files/assets/public/documents/building/building-forms/040.0-40-year-building-safety-inspection-submittal-form-ada.pdf', quote: 'Please make sure your package includes the following with this cover sheet:' },
        { page: 'https://www.coralsprings.gov/files/assets/public/documents/building/building-forms/040.0-40-year-building-safety-inspection-submittal-form-ada.pdf', quote: 'Broward County Building Safety Inspection Report Forms' },
        { page: 'https://www.coralsprings.gov/Government/Departments/Building/Broward-County-Board-of-Rules-and-Appeals-BORA', quote: 'Board Policy 05-05(PDF, 208KB) General Considerations & Guidelines (Policy 05-05)(PDF, 200KB) Broward County Required Inspection Form Structural - BSIP Inspection(PDF, 991KB) Electrical - BSIP Inspection(PDF, 905KB)' },
      ],
      'local 8: When repairs stay open': [
        { page: 'https://www.coralsprings.gov/files/assets/public/v/193/documents/development-services/code-compliance/special-magistrate/september-24-2026-docket.pdf', quote: 'SPECIAL MAGISTRATE HEARING' },
        { page: 'https://www.coralsprings.gov/files/assets/public/v/193/documents/development-services/code-compliance/special-magistrate/september-24-2026-docket.pdf', quote: 'BUILDING SAFETY INSPECTION PROGRAM REPAIRS' },
        { page: 'https://www.coralsprings.gov/files/assets/public/v/193/documents/development-services/code-compliance/special-magistrate/september-24-2026-docket.pdf', quote: 'CHIEF BUILDING OFFICIAL' },
      ],
      'faq 1': [
        { page: 'https://www.coralsprings.gov/Government/Departments/Building/Online-Permitting-eTrakit/Create-an-Online-Account', quote: 'You will need to register as a new user under the Public Login section.' },
        { page: 'https://www.coralsprings.gov/Government/Departments/Building/Online-Permitting-eTrakit/Create-an-Online-Account', quote: 'If you are a contractor who has previously transacted business with the Building Department and have an active account, you are already in eTRAKiT.' },
        { page: 'https://www.coralsprings.gov/Government/Departments/Building/Building-Safety-Inspection-Electronic-Submittal', quote: 'Enter your project number & select your project.' },
        { page: 'https://www.coralsprings.gov/Government/Departments/Building/Building-Safety-Inspection-Electronic-Submittal', quote: 'Please note that reports and submittal form must be uploaded as separate PDF files.' },
      ],
      'faq 2': [
        { page: 'https://www.coralsprings.gov/Government/Departments/Building', quote: 'City of Coral Springs Submittal Form (Required)' },
        { page: 'https://www.coralsprings.gov/Government/Departments/Building/Building-Safety-Inspection-Electronic-Submittal', quote: 'Each attachment must be uploaded separately and named as follows: Submittal Form' },
        { page: 'https://www.coralsprings.gov/files/assets/public/documents/building/building-forms/040.0-40-year-building-safety-inspection-submittal-form-ada.pdf', quote: 'Broward County Building Safety Inspection Report Forms' },
      ],
      'faq 3': [
        { page: 'https://www.coralsprings.gov/Government/Departments/Building', quote: 'BSIP Project Search' },
        { page: 'https://www.coralsprings.gov/Government/Departments/Building/Online-Permitting-eTrakit/Create-an-Online-Account', quote: 'Before you begin, please note that most searches are available in eTRAKiT with no login.' },
        { page: 'https://www.coralsprings.gov/Government/Departments/Building/Online-Permitting-eTrakit/Create-an-Online-Account', quote: 'If you need to make payment, apply for a permit or schedule an inspection, then you will need to login to eTRAKiT.' },
        { page: 'https://www.coralsprings.gov/Government/Departments/Building/Building-Safety-Inspection-Electronic-Submittal', quote: 'Enter your project number & select your project.' },
      ],
      'faq 4': [
        { page: 'https://www.coralsprings.gov/files/assets/public/v/193/documents/development-services/code-compliance/special-magistrate/september-24-2026-docket.pdf', quote: 'BUILDING SAFETY INSPECTION PROGRAM REPAIRS' },
        { page: 'https://www.coralsprings.gov/files/assets/public/v/193/documents/development-services/code-compliance/special-magistrate/september-24-2026-docket.pdf', quote: 'CHIEF BUILDING OFFICIAL' },
      ],
      'faq 5': [
        { page: 'https://www.coralsprings.gov/Government/Departments/Building', quote: 'Register for Permitting & Building Safety Inspection Program Workshops' },
        { page: 'https://www.coralsprings.gov/Government/Departments/Building', quote: 'Interested in receiving important Building Department updates? Subscribe today to stay informed.' },
      ],
      'nextStep': [
        { page: 'https://www.coralsprings.gov/files/assets/public/documents/building/building-forms/040.0-40-year-building-safety-inspection-submittal-form-ada.pdf', quote: 'NOTICE OF REQUIRED BUILDING SAFETY INSPECTION' },
        { page: 'https://www.coralsprings.gov/Government/Departments/Building', quote: 'BSIP Project Search' },
      ],
    },
  },
  'broward-bsip/dania-beach': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.daniabeachfl.gov/3220/Building-Safety-Inspection-Program', quote: 'For more information, please email the Building Official or call 954-924-6805.' },
      { page: 'https://www.daniabeachfl.gov/building-division', quote: 'Building Division 954 924-6805, dial 4.' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.daniabeachfl.gov/3220/Building-Safety-Inspection-Program', quote: 'The Building Official will notify the building owner or association with a Notice of Required Inspection.' },
        { page: 'https://www.daniabeachfl.gov/3220/Building-Safety-Inspection-Program', quote: 'After the reports are reviewed:' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e0b1e222-1173-4b23-8a0b-250ddef61c67', quote: 'BUILDING SAFETY INSPECTION PROGRAM SUBMITTAL FORM' },
      ],
      'lede': [
        { page: 'https://www.daniabeachfl.gov/3220/Building-Safety-Inspection-Program', quote: 'Home Our City Departments Community Development Building Division' },
        { page: 'https://www.daniabeachfl.gov/3220/Building-Safety-Inspection-Program', quote: 'This program is dedicated to ensuring the safety and integrity of buildings within the community, adhering to the Florida Building Code and the guidelines established by the Broward County Board of Rules and Appeals (BORA).' },
        { page: 'https://www.daniabeachfl.gov/3220/Building-Safety-Inspection-Program', quote: 'Important Note: BORA Policy #05-05 takes precedence over Florida Senate Bill 154.' },
        { page: 'https://www.daniabeachfl.gov/3220/Building-Safety-Inspection-Program', quote: 'Building Safety Inspection Program Submittal Form (PDF)' },
        { page: 'https://www.daniabeachfl.gov/3220/Building-Safety-Inspection-Program', quote: 'Safety Inspection Frequently Asked Questions (PDF)' },
      ],
      'local 1: The notice': [
        { page: 'https://www.daniabeachfl.gov/3220/Building-Safety-Inspection-Program', quote: 'This date is based on when the certificate of occupancy was issued. The Building Official will notify the building owner or association with a Notice of Required Inspection.' },
        { page: 'https://www.daniabeachfl.gov/3220/Building-Safety-Inspection-Program', quote: 'The City will send a notice to the property owner, informing them that they must conduct a structural inspection by a certified architect or engineer, as well as an electrical inspection by a licensed electrical contractor.' },
      ],
      'local 2: Submitting to the city': [
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e8cd6b8f-fa93-40c5-8847-68f86aa691b0', quote: 'Applicants must submit the following documents to the City\'s Building Official:' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e0b1e222-1173-4b23-8a0b-250ddef61c67', quote: 'Each building is required to submit a Submittal Package that include the following documents:' },
        { page: 'https://www.daniabeachfl.gov/3220/Building-Safety-Inspection-Program', quote: 'Owners have 90 days from receiving the notice to complete the inspections and submit the reports to the City.' },
      ],
      'local 3: The submittal form': [
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e0b1e222-1173-4b23-8a0b-250ddef61c67', quote: 'Property Owner\'s Name:' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e0b1e222-1173-4b23-8a0b-250ddef61c67', quote: 'Present Use:' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e0b1e222-1173-4b23-8a0b-250ddef61c67', quote: 'Engineer/Architect:' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e0b1e222-1173-4b23-8a0b-250ddef61c67', quote: 'Reg #:' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e0b1e222-1173-4b23-8a0b-250ddef61c67', quote: 'Initial Building Safety Inspection' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e0b1e222-1173-4b23-8a0b-250ddef61c67', quote: '10 Year Re-Inspection' },
      ],
      'local 4: What the reports carry': [
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e8cd6b8f-fa93-40c5-8847-68f86aa691b0', quote: 'Forms must be properly sealed/stamped by a Florida Registered Architect or Engineer.' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e8cd6b8f-fa93-40c5-8847-68f86aa691b0', quote: 'Forms must have an original signature.' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e8cd6b8f-fa93-40c5-8847-68f86aa691b0', quote: 'The Architect/Engineer is required to check the correct box for either "Repairs Required" or "No Repairs Required".' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e0b1e222-1173-4b23-8a0b-250ddef61c67', quote: 'BUILDING OFFICIAL USE ONLY' },
      ],
      'local 5: How the review works': [
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e8cd6b8f-fa93-40c5-8847-68f86aa691b0', quote: 'No. The City\'s review is based totally on the architect\'s/engineer\'s report.' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e8cd6b8f-fa93-40c5-8847-68f86aa691b0', quote: 'How long does it take for the review to be completed once submitted?' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e8cd6b8f-fa93-40c5-8847-68f86aa691b0', quote: 'Unfortunately, we are not able to provide that information. Because we review the reports that are prepared by an architect or engineer, it would be a conflict of interest for us to provide a referral list.' },
      ],
      'local 6: After the review': [
        { page: 'https://www.daniabeachfl.gov/3220/Building-Safety-Inspection-Program', quote: 'If deemed safe, the property owner can request a certificate of completion for the Building Safety Inspection Program.' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e0b1e222-1173-4b23-8a0b-250ddef61c67', quote: 'Report complete, repairs not required per report' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e0b1e222-1173-4b23-8a0b-250ddef61c67', quote: 'Permit(s) required for repairs' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e0b1e222-1173-4b23-8a0b-250ddef61c67', quote: 'Permit(s) not required for repairs' },
      ],
      'local 7: Repairs': [
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e8cd6b8f-fa93-40c5-8847-68f86aa691b0', quote: 'A building permit application completed by a licensed and insured contractor for the appropriate discipline.' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e8cd6b8f-fa93-40c5-8847-68f86aa691b0', quote: 'detailing the scope of the repairs required by the report and indicating the the location of the repairs.' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e8cd6b8f-fa93-40c5-8847-68f86aa691b0', quote: 'No. The architect or engineer will prepare an updated Safety Inspection Report once the repairs have been completed. A city building inspector will only perform inspections relating to an active building permit.' },
      ],
      'local 8: Who is exempt': [
        { page: 'https://www.daniabeachfl.gov/3220/Building-Safety-Inspection-Program', quote: 'One- and two-family dwellings under 3,500 square feet U.S. government buildings State of Florida buildings Schools under the Broward County School Board Buildings located on Indian reservations' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e8cd6b8f-fa93-40c5-8847-68f86aa691b0', quote: 'The inspection will not be waived unless the ENTIRE building was demolished, and a new structure was built.' },
      ],
      'faq 1': [
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e8cd6b8f-fa93-40c5-8847-68f86aa691b0', quote: 'I did a complete interior demolition/renovation of my property. Am I exempt from the program?' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e8cd6b8f-fa93-40c5-8847-68f86aa691b0', quote: 'No. An Inspection is needed to ensure the electrical and structural exterior of the entire building is in compliance with the Building Safety Inspection Program.' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e8cd6b8f-fa93-40c5-8847-68f86aa691b0', quote: 'The inspection will not be waived unless the ENTIRE building was demolished, and a new structure was built.' },
      ],
      'faq 2': [
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e8cd6b8f-fa93-40c5-8847-68f86aa691b0', quote: 'We will verify through the Broward County Property Appraiser\'s Office that there is a new owner and will make changes in our database. If the BCPA still shows you are listed as property owner, you will need to contact them directly to have it changed.' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e8cd6b8f-fa93-40c5-8847-68f86aa691b0', quote: 'If you believe the building is not 25 years old, you will need to contact the City\'s Building Department and we will research further with the Broward County Property Appraiser\'s office to verify the age.' },
      ],
      'faq 3': [
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e8cd6b8f-fa93-40c5-8847-68f86aa691b0', quote: 'No. This is a safety inspection of the current condition of the building\'s structural and electrical system. If repairs are required, the repairs will have to meet the current building code.' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e8cd6b8f-fa93-40c5-8847-68f86aa691b0', quote: 'This will be determined during the buildings annual inspection by the City of Dania Beach Fire Department.' },
      ],
      'faq 4': [
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e8cd6b8f-fa93-40c5-8847-68f86aa691b0', quote: 'Yes, especially if it is being occupied or still in use. Requests for an exception must be submitted in writing to the Building Official.' },
      ],
      'faq 5': [
        { page: 'https://www.daniabeachfl.gov/3220/Building-Safety-Inspection-Program', quote: 'Owners have 90 days from receiving the notice to complete the inspections and submit the reports to the City.' },
        { page: 'https://content.civicplus.com/api/assets/fl-daniabeach/e0b1e222-1173-4b23-8a0b-250ddef61c67', quote: 'Repairs required per report. New report updated by architect/engineer must be' },
      ],
      'nextStep': [
        { page: 'https://www.daniabeachfl.gov/3220/Building-Safety-Inspection-Program', quote: 'The Building Official will notify the building owner or association with a Notice of Required Inspection.' },
        { page: 'https://www.daniabeachfl.gov/3220/Building-Safety-Inspection-Program', quote: 'This date is based on when the certificate of occupancy was issued.' },
      ],
    },
  },
  'broward-bsip/hillsboro-beach': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.townofhillsborobeach.com/196/Building-Department', quote: 'Building Department Email Physical Address View Map 1210 Hillsboro Mile Hillsboro Beach, FL 33062' },
      { page: 'https://www.townofhillsborobeach.com/196/Building-Department', quote: 'For permitting questions contact Ivan Wong at wwong@cgasolutions.com or Ivelisse Cruz at icruz@cgasolutions.com or via phone at 954-427-4011' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.townofhillsborobeach.com/511/Broward-County-Building-Safety-Program-I', quote: 'The Town of Hillsboro Beach 25/40 Year Log Report List' },
      ],
      'lede': [
        { page: 'https://www.townofhillsborobeach.com/196/Building-Department', quote: 'The Town of Hillsboro Beach Building Department is powered by Calvin, Giordano & Associates, Inc (CGA).' },
        { page: 'https://www.townofhillsborobeach.com/511/Broward-County-Building-Safety-Program-I', quote: 'For additional program information please click the following link: Broward County Building Safety Inspection Program' },
        { page: 'https://www.townofhillsborobeach.com/511/Broward-County-Building-Safety-Program-I', quote: 'The Town of Hillsboro Beach 25/40 Year Log Report List' },
      ],
      'local 1: The town’s program page': [
        { page: 'https://www.townofhillsborobeach.com/511/Broward-County-Building-Safety-Program-I', quote: '25 Year or Older Building Safety Program' },
        { page: 'https://www.townofhillsborobeach.com/511/Broward-County-Building-Safety-Program-I', quote: 'The Broward County Board of Rules and Appeals (BORA) adopted new regulations for Building Inspections (formerly known as the 40-Year Inspection Program). Per BORA, the Program was revised to be consistent with the requirements of Florida law, F.S.553.899. The major change to the program is that buildings will now be required to have that initial inspection at 25 years of age instead of 40.' },
        { page: 'https://www.townofhillsborobeach.com/511/Broward-County-Building-Safety-Program-I', quote: 'For additional program information please click the following link: Broward County Building Safety Inspection Program' },
      ],
      'local 2: A town ordinance': [
        { page: 'https://www.townofhillsborobeach.com/187/Public-Notices', quote: 'PUBLIC NOTICE - ORD 2023-02 Bldg Safety Program 25yr Inspections (2nd Reading)' },
        { page: 'https://www.townofhillsborobeach.com/DocumentCenter/View/5606/PUBLIC-NOTICE---ORD-2023-02--Bldg-Safety-Program-25yr-Inspections--2nd-Reading', quote: 'AMENDING THE TOWN\'S CODE OF ORDINANCES BY AMENDING CHAPTER 4 ENTITLED "BUILDINGS AND BUILDING REGULATIONS"' },
        { page: 'https://www.townofhillsborobeach.com/DocumentCenter/View/5606/PUBLIC-NOTICE---ORD-2023-02--Bldg-Safety-Program-25yr-Inspections--2nd-Reading', quote: 'BY CREATING SECTION 4-9 TO BE ENTITLED "BUILDING SAFETY INSPECTION PROGRAM"' },
      ],
      'local 3: The log of reports': [
        { page: 'https://www.townofhillsborobeach.com/511/Broward-County-Building-Safety-Program-I', quote: 'The Town of Hillsboro Beach 25/40 Year Log Report List' },
        { page: 'https://www.townofhillsborobeach.com/DocumentCenter/View/5302', quote: 'BUILDING NAME' },
        { page: 'https://www.townofhillsborobeach.com/DocumentCenter/View/5302', quote: 'YEAR BUILT' },
        { page: 'https://www.townofhillsborobeach.com/DocumentCenter/View/5302', quote: '40 Year Due' },
        { page: 'https://www.townofhillsborobeach.com/DocumentCenter/View/5302', quote: 'STATUS' },
        { page: 'https://www.townofhillsborobeach.com/DocumentCenter/View/5302', quote: 'NOTES' },
        { page: 'https://www.townofhillsborobeach.com/DocumentCenter/View/5302', quote: 'Reports submitted' },
        { page: 'https://www.townofhillsborobeach.com/DocumentCenter/View/5302', quote: 'Concrete Restoration Applied For' },
        { page: 'https://www.townofhillsborobeach.com/DocumentCenter/View/5302', quote: 'Letter from Engineer dated 10/28/25 Building has no Life Safety Issues while repairs are being done.' },
      ],
      'local 4: Searching past reports': [
        { page: 'https://www.townofhillsborobeach.com/511/Broward-County-Building-Safety-Program-I', quote: 'To search 25/40 Reports submitted to the town check it out at Forerunner- Floodplain Information Website' },
      ],
      'local 5: Copies of a report': [
        { page: 'https://www.townofhillsborobeach.com/511/Broward-County-Building-Safety-Program-I', quote: 'If you are requesting a copy of a Safety Report on any building in the Town of Hillsboro Beach, please submit a Public Records Request with the town clerk' },
        { page: 'https://www.townofhillsborobeach.com/DocumentCenter/View/5093', quote: 'Public records request do not have to be in writing. However, to insure accuracy, transparency and to promote efficiency, please consider completing this public records request form.' },
        { page: 'https://www.townofhillsborobeach.com/DocumentCenter/View/5093', quote: 'Fax to (954) 427-4834, Physical Mailing Address: 1210 Hillsboro Mile Hillsboro Beach, FL 33062' },
      ],
      'local 6: Questions on the program': [
        { page: 'https://www.townofhillsborobeach.com/511/Broward-County-Building-Safety-Program-I', quote: 'If there are any questions, please contact:' },
        { page: 'https://www.townofhillsborobeach.com/511/Broward-County-Building-Safety-Program-I', quote: 'Building Official- George Folles' },
        { page: 'https://www.townofhillsborobeach.com/511/Broward-County-Building-Safety-Program-I', quote: 'Permit Administrator- Mariana El-Sayed' },
        { page: 'https://www.townofhillsborobeach.com/196/Building-Department', quote: 'For scheduling inspections or general questions contact the Building Department General Voicemail at 954-766-2766 or via email building@townofhillsborobeach.com' },
        { page: 'https://www.townofhillsborobeach.com/196/Building-Department', quote: 'For permitting questions contact' },
      ],
      'local 7: Repairs and permits': [
        { page: 'https://www.townofhillsborobeach.com/DocumentCenter/View/5302', quote: 'Concrete Restoration Applied For' },
        { page: 'https://www.townofhillsborobeach.com/DocumentCenter/View/5302', quote: 'Electrical permits submitted for repairs' },
        { page: 'https://www.townofhillsborobeach.com/DocumentCenter/View/5302', quote: 'Concrete restoration permit final' },
        { page: 'https://www.townofhillsborobeach.com/196/Building-Department', quote: 'We encourage you to visit Community Core Permitting Website (Community Core-Hillsboro Beach) for the most current information and to pay permit fees, schedule inspections, view plan review comments, or check inspection results.' },
        { page: 'https://www.townofhillsborobeach.com/196/Building-Department', quote: 'Community Core will require a login to the website\'s portal.' },
      ],
      'faq 1': [
        { page: 'https://www.townofhillsborobeach.com/511/Broward-County-Building-Safety-Program-I', quote: 'To search 25/40 Reports submitted to the town check it out at Forerunner- Floodplain Information Website' },
        { page: 'https://www.townofhillsborobeach.com/511/Broward-County-Building-Safety-Program-I', quote: 'If you are requesting a copy of a Safety Report on any building in the Town of Hillsboro Beach, please submit a Public Records Request with the town clerk' },
      ],
      'faq 2': [
        { page: 'https://www.townofhillsborobeach.com/DocumentCenter/View/5302', quote: '40 Year Due' },
        { page: 'https://www.townofhillsborobeach.com/511/Broward-County-Building-Safety-Program-I', quote: 'The Broward County Board of Rules and Appeals (BORA) adopted new regulations for Building Inspections (formerly known as the 40-Year Inspection Program).' },
      ],
      'faq 3': [
        { page: 'https://www.townofhillsborobeach.com/235/Building-Applications-Forms', quote: 'Building Applications & Forms' },
        { page: 'https://www.townofhillsborobeach.com/511/Broward-County-Building-Safety-Program-I', quote: 'For additional program information please click the following link: Broward County Building Safety Inspection Program' },
      ],
      'faq 4': [
        { page: 'https://www.townofhillsborobeach.com/DocumentCenter/View/5302', quote: 'Concrete Restoration Applied For' },
        { page: 'https://www.townofhillsborobeach.com/DocumentCenter/View/5302', quote: 'Emails sent on 10/23 & 10/27' },
        { page: 'https://www.townofhillsborobeach.com/DocumentCenter/View/5302', quote: 'Letter from Engineer dated 10/28/25 Building has no Life Safety Issues while repairs are being done.' },
        { page: 'https://www.townofhillsborobeach.com/511/Broward-County-Building-Safety-Program-I', quote: 'Building Official- George Folles' },
      ],
      'faq 5': [
        { page: 'https://www.townofhillsborobeach.com/196/Building-Department', quote: 'The Town of Hillsboro Beach Building Department is powered by Calvin, Giordano & Associates, Inc (CGA).' },
        { page: 'https://www.townofhillsborobeach.com/511/Broward-County-Building-Safety-Program-I', quote: 'If there are any questions, please contact:' },
      ],
      'nextStep': [
        { page: 'https://www.townofhillsborobeach.com/511/Broward-County-Building-Safety-Program-I', quote: 'The Town of Hillsboro Beach 25/40 Year Log Report List' },
      ],
    },
  },
  'broward-bsip/lauderdale-lakes': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'DEVELOPMENT SERVICES DEPARTMENT BUILDING DIVISION 3521 NW 43rd Avenue, Lauderdale Lakes, FL 33319 | (954) 535-2480' },
      { page: 'https://www.lauderdalelakes.org/160/Building', quote: 'Building Development Services 3521 NW 43rd Avenue Lauderdale Lakes, FL 33319 Ph: 954-535-2480' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'If the Building Safety Inspection Program affects your property, you will receive a certified letter with information about what you need to do.' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'In order for an Engineer/Architect to submit a Building Safety Inspection Report, they must register with the City of Lauderdale Lakes.' },
      ],
      'lede': [
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'DEVELOPMENT SERVICES DEPARTMENT BUILDING DIVISION' },
        { page: 'https://www.lauderdalelakes.org/313/Building-Documents', quote: 'Building Safety Program Packet' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'Building Safety Inspection Program: Yearly Schedule' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'Engineer\'s/Architect\'s Registration Application' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'Building Safety Inspection Report Form' },
      ],
      'local 1: The certified letter': [
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'If the Building Safety Inspection Program affects your property, you will receive a certified letter with information about what you need to do.' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'JUNE (Preceding the specified calendar year) Board of Rules and Appeals obtains building data from Property Appraisers Office and forwards it to each city.' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'Building Officials must notify property owners whose buildings are subject to the Safety Inspection Program for the specified calendar year.' },
      ],
      'local 2: Engineer registration': [
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'In order for an Engineer/Architect to submit a Building Safety Inspection Report, they must register with the City of Lauderdale Lakes. A copy of the Engineer\'s/Architect\'s Current State License must accompany this completed application to register.' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'All applications require the engineer\'s/architect\'s notarized signature.' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'Fax copies of requirements are not acceptable. Originals must be submitted' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'Registrations must be renewed annually on or before September 30th for the following fiscal year.' },
      ],
      'local 3: The city’s application': [
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'BUILDING SAFETY INSPECTION APPLICATION' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'SITE NAME Address Legal Description Subdivision' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'Certificate of Competency #' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'State Engineer\'s/Architect\'s #' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'FOR OFFICIAL USE ONLY' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'Notary Signature' },
      ],
      'local 4: Forms with the filing': [
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'The following forms are required to be completed at the time of submittal: Building Safety Inspection Submittal Form Building Safety Inspection Form - Structural Building Safety Inspection Form - Electrical' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'Broward County Board of Rules and Appeals Policy # 05-05' },
      ],
      'local 5: Where to send it': [
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: '3521 NW 43rd Avenue, Lauderdale Lakes, FL 33319 | (954) 535-2480 | Fax (954) 731-5309 | permits@lauderdalelakes.org' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'For more information regarding the Building Safety Inspection Program, please send an email to permits@lauderdalelakes.org or call 954-535-2480.' },
      ],
      'local 6: Permits for repairs': [
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'Note: A separate building permit must be obtained if the Building Official deems it necessary after reviewing the Engineer\'s or Architect\'s Report. A licensed and insured contractor must obtain the Permit.' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'days from the date of the report to obtain the required permit(s) and complete all necessary repairs.' },
      ],
      'local 7: Milestone inspections': [
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'PLEASE NOTE: Buildings or structures that must perform a phase one and/or phase two milestone inspection as defined under F.S. 553.899, this building safety inspection shall serve as compliance for both milestone inspection requirements.' },
      ],
      'local 8: Who is exempt': [
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'Exempt from this program are:' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'Fee Simple Townhouses as defined in the Florida Building Code' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'Minor Structures, defined as buildings or structures in any occupancy group having a gross floor area less than three thousand five hundred (3,500) square feet.' },
      ],
      'faq 1': [
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'In order for an Engineer/Architect to submit a Building Safety Inspection Report, they must register with the City of Lauderdale Lakes.' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'All applications require the engineer\'s/architect\'s notarized signature.' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'Registrations must be renewed annually on or before September 30th for the following fiscal year.' },
      ],
      'faq 2': [
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'If the Building Safety Inspection Program affects your property, you will receive a certified letter with information about what you need to do.' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'Board of Rules and Appeals obtains building data from Property Appraisers Office and forwards it to each city.' },
      ],
      'faq 3': [
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: '90 day period for property owners to return structural and electrical check list to the City/County' },
      ],
      'faq 4': [
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/7020/Special-Magistrate-Case-Docket', quote: 'Owners of buildings or structures shall conduct a 40' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/7020/Special-Magistrate-Case-Docket', quote: 'year structural and electrical safety inspection in' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'BUILDING SAFETY INSPECTION PROGRAM' },
      ],
      'faq 5': [
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/7020/Special-Magistrate-Case-Docket', quote: 'SPECIAL MAGISTRATE' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/7020/Special-Magistrate-Case-Docket', quote: 'FIRST TIME HEARING' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/7020/Special-Magistrate-Case-Docket', quote: 'Sec. 18-3 (a) Safety' },
      ],
      'nextStep': [
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'you will receive a certified letter with information about what you need to do.' },
        { page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet', quote: 'they must register with the City of Lauderdale Lakes.' },
      ],
    },
  },
  'broward-bsip/lauderhill': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.lauderhill-fl.gov/departments/development-services/contact-us', quote: 'Ken Thurston Inverrary Community Center' },
      { page: 'https://www.lauderhill-fl.gov/departments/development-services/contact-us', quote: '3300 Inverrary Blvd.' },
      { page: 'https://www.lauderhill-fl.gov/departments/development-services/contact-us', quote: 'Lauderhill, FL 33319' },
      { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/32848/638899132500130000', quote: 'Development Services Department / Building Division' },
      { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/32848/638899132500130000', quote: 'Phone: 954.730.3060' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.lauderhill-fl.gov/community-services/online-forms/-folder-309', quote: '40 or 50 Year Building and Safety Inspection Packet' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: '40 or 50 year Building and Safety Inspection Application and Instructions' },
      ],
      'lede': [
        { page: 'https://www.lauderhill-fl.gov/departments/development-services/building', quote: 'Welcome to the City of Lauderhill Building Division.' },
        { page: 'https://www.lauderhill-fl.gov/departments/development-services/contact-us', quote: 'Development Services Department' },
        { page: 'https://www.lauderhill-fl.gov/community-services/online-forms/-folder-309', quote: '40 or 50 Year Building and Safety Inspection Packet' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'The Lauderhill Building Department is required to enforce the County Code.' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/32848/638899132500130000', quote: 'What to Expect from the City of Lauderhill' },
      ],
      'local 1: Why the city enforces it': [
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: '40 or 50 year Building and Safety Inspection are mandated by the Broward County Administrative Code and the' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'The Lauderhill Building Department is required to enforce the County Code.' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'Subject: Broward County Board of Rules and Appeals – Building Safety Inspection Program' },
      ],
      'local 2: The notice': [
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'a list of buildings meeting the program requirements' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'are provided to Building Officials from a database that the Board of Rules and Appeals obtains from the County' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'The program is then to be administrated by the City Building Department or the' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'County Building Department and a notification letter is sent.' },
      ],
      'local 3: What the filing holds': [
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'Complete the Broward County 40 year Building Safety Inspection Program Application.' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'The same application is used for 50 year Safety Inspections.' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'Written report by a Florida Registered Architect or a Professional Engineer evaluating the' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'structural elements of the property.' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'electrical elements of the property' },
      ],
      'local 4: Where it goes': [
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'Application may be submitted at:' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'City of Lauderhill Business Center' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: '5581 W. Oakland Park Boulevard Lauderhill, FL 33313' },
        { page: 'https://www.lauderhill-fl.gov/departments/development-services/contact-us', quote: 'Ken Thurston Inverrary Community Center' },
        { page: 'https://www.lauderhill-fl.gov/departments/development-services/contact-us', quote: 'Located behind City Hall' },
      ],
      'local 5: The review': [
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'The Building Department will review the reports submitted to verify that if the inspecting agency has deemed' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'the structural and electrical systems as safe. If any deficiency is noted, the building department shall follow' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'the guidelines of Policy #05-05 (copy attached).' },
      ],
      'local 6: Repairs': [
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'to correct the structural and electrical deficiencies that pose an immediate threat to life, health, safety or where failure of a' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'shall re-inspect the areas noted on the original report and shall provide the building owner a signed and sealed letter stating the' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'corrections have all been completed. The building owner shall submit that letter to the Building Official.' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'Repairs or modifications of deficient conditions that are incidental and non-life threatening shall be completed within a time' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'frame as specified by the inspecting Professional Engineer or Registered Architect and approved by the Building Official.' },
      ],
      'local 7: If it is not filed': [
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'In the event an owner fails to submit the 40 year Inspection Report the governing authority shall elect the choice of either' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'a Special Magistrate or Code Enforcement Board' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'the structure may be deemed to be unsafe and unfit for occupation.' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'Unsafe Structures Board, as appropriate.' },
      ],
      'local 8: An older packet': [
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'Revised June 2015' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'Amended Effective10/20/14' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'furnish within 90 days the required Safety Inspection' },
      ],
      'faq 1': [
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'are provided to Building Officials from a database that the Board of Rules and Appeals obtains from the County' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'County Building Department and a notification letter is sent.' },
      ],
      'faq 2': [
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'Complete the Broward County 40 year Building Safety Inspection Program Application.' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'Written report by a Florida Registered Architect or a Professional Engineer evaluating the' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'City of Lauderhill Business Center' },
        { page: 'https://www.lauderhill-fl.gov/departments/development-services/contact-us', quote: '3300 Inverrary Blvd.' },
      ],
      'faq 3': [
        { page: 'https://www.lauderhill-fl.gov/community-services/online-forms/-folder-309', quote: '40 or 50 Year Building and Safety Inspection Packet' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'The same application is used for 50 year Safety Inspections.' },
      ],
      'faq 4': [
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'In the event an owner fails to submit the 40 year Inspection Report the governing authority shall elect the choice of either' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'the structure may be deemed to be unsafe and unfit for occupation.' },
      ],
      'faq 5': [
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/32848/638899132500130000', quote: 'New Condominium & Community Association Requirements (HB 913)' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/32848/638899132500130000', quote: 'Architects/engineers bidding on milestone inspections must disclose in writing if they intend to bid on' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/32848/638899132500130000', quote: 'City ordinances will be amended to include inspection and enforcement language.' },
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/32848/638899132500130000', quote: 'Required milestone inspection reports for condos must be submitted to the City by' },
      ],
      'nextStep': [
        { page: 'https://www.lauderhill-fl.gov/home/showpublisheddocument/21570/638474060306630000', quote: 'County Building Department and a notification letter is sent.' },
      ],
    },
  },
  'broward-bsip/lighthouse-point': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: '3701 NE 22 Avenue Lighthouse Point FL 33064' },
      { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'Phone: 954-943-6509' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'If you have questions regarding Building Safety Inspections, contact the Lighthouse Point Building Department.' },
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'The City is aware that engineering and architectural firms are sending out notices regarding the Building Safety Inspection requirements.' },
      ],
      'lede': [
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'Broward County Building Safety Inspection Requirement' },
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'If you have questions regarding Building Safety Inspections, contact the Lighthouse Point Building Department.' },
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'Single-family homes, duplexes, and all buildings under 3,500 square feet are exempt from this requirement.' },
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'The City is aware that engineering and architectural firms are sending out notices regarding the Building Safety Inspection requirements.' },
      ],
      'local 1: Whose requirement it is': [
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'Broward County Building Safety Inspection Requirement' },
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'Broward County requires Building Safety Inspections on all buildings over 25 years old and over 3,500 square feet.' },
      ],
      'local 2: Who is exempt': [
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'Single-family homes, duplexes, and all buildings under 3,500 square feet are exempt from this requirement.' },
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'you are not required to have this inspection.' },
      ],
      'local 3: Notices from private firms': [
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'The City is aware that engineering and architectural firms are sending out notices regarding the Building Safety Inspection requirements.' },
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'If you receive one of their notices, remember your property may not be subject to the requirements.' },
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'The City does not endorse any of the firms sending out the notices.' },
      ],
      'local 4: Questions and permits': [
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'If you have questions regarding Building Safety Inspections, contact the Lighthouse Point Building Department.' },
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'New permit applications can be accepted online and in person.' },
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'Building Department Public Portal' },
      ],
      'faq 1': [
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'The City is aware that engineering and architectural firms are sending out notices regarding the Building Safety Inspection requirements.' },
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'If you receive one of their notices, remember your property may not be subject to the requirements.' },
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'The City does not endorse any of the firms sending out the notices.' },
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'If you have questions regarding Building Safety Inspections, contact the Lighthouse Point Building Department.' },
      ],
      'faq 2': [
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'Broward County requires Building Safety Inspections on all buildings over 25 years old and over 3,500 square feet.' },
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'Single-family homes, duplexes, and all buildings under 3,500 square feet are exempt from this requirement.' },
      ],
      'faq 3': [
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'If you have questions regarding Building Safety Inspections, contact the Lighthouse Point Building Department.' },
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'New permit applications can be accepted online and in person.' },
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'Now you can submit your permit application and view your application status and inspection results by visiting the' },
      ],
      'faq 4': [
        { page: 'https://www.lighthousepointfl.gov/DocumentCenter/View/945/LHP-Revised-Fees-as-of-9-12-22-Final-PDF', quote: '40-year inspection program (required by Broward County)' },
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'Broward County Building Safety Inspection Requirement' },
      ],
      'nextStep': [
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'The City is aware that engineering and architectural firms are sending out notices regarding the Building Safety Inspection requirements.' },
        { page: 'https://www.lighthousepointfl.gov/158/Building-Zoning', quote: 'Broward County requires Building Safety Inspections on all buildings over 25 years old and over 3,500 square feet.' },
      ],
    },
  },
  'broward-bsip/margate': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.margatefl.com/196/Building', quote: '901 NW 66th Avenue Margate FL 33063' },
      { page: 'https://www.margatefl.com/196/Building', quote: 'Phone: 954-970-3004' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.margatefl.com/801/25-Year-Building-Safety-Inspection-Progr', quote: 'you will receive a certified letter with information about what you need to do' },
        { page: 'https://www.margatefl.com/801/25-Year-Building-Safety-Inspection-Progr', quote: 'ProjectDox - Apply and upload Structural & Electrical Engineer Reports' },
      ],
      'lede': [
        { page: 'https://www.margatefl.com/801/25-Year-Building-Safety-Inspection-Progr', quote: 'for the City of Margate Building Department to review the reports' },
        { page: 'https://www.margatefl.com/801/25-Year-Building-Safety-Inspection-Progr', quote: '25 Year Frequently Asked Questions' },
        { page: 'https://www.margatefl.com/801/25-Year-Building-Safety-Inspection-Progr', quote: '25-Year Building Safety Inspection Incidental Repair Agreement' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'FAILED REPORTS' },
      ],
      'local 1: The notice': [
        { page: 'https://www.margatefl.com/801/25-Year-Building-Safety-Inspection-Progr', quote: 'you will receive a certified letter with information about what you need to do' },
      ],
      'local 2: Filing the report': [
        { page: 'https://www.margatefl.com/801/25-Year-Building-Safety-Inspection-Progr', quote: 'ProjectDox - Apply and upload Structural & Electrical Engineer Reports' },
        { page: 'https://www.margatefl.com/788/Margate-Building-ePermitting-ProjectDox', quote: 'to create an account or log in with an existing account' },
      ],
      'local 3: The forms': [
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'The following are the most common reasons for failed reports and how to correct them.' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'Broward County Form was not used' },
        { page: 'https://www.margatefl.com/197/Permit-Applications-Forms', quote: 'Safety Inspection Report Form - Structural (PDF)' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/7215', quote: 'This report has been based upon the minimum inspection guidelines for building safety inspection as listed in the Broward County' },
      ],
      'local 4: Common reasons it fails': [
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'Appropriate boxes were not checked' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'Architect’s seal is not clear or an original signature was not provided' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'The Architect can upload corrected form to the Building Department through Building e-Permitting - ProjectDox.' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'Architect indicated deficiencies in the building; either structural, electrical or both' },
      ],
      'local 5: After review': [
        { page: 'https://www.margatefl.com/801/25-Year-Building-Safety-Inspection-Progr', quote: 'After review of the reports, if the building is determined to be safe you will not be required to have another Building Safety Inspection for ten (10) years.' },
        { page: 'https://www.margatefl.com/801/25-Year-Building-Safety-Inspection-Progr', quote: 'the owner shall have one hundred-eighty (180) days from the date of the report to obtain the required permit(s) and complete the necessary repairs.' },
      ],
      'local 6: Repairs and permits': [
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'The owner must hire a licensed Contractor to apply for required permits to complete the repairs.' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'Can a building owner apply for the permit and do the required work?' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'Can a handyman repair the roof and take pictures and not have to apply for a permit?' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'Can a handyman do stucco repairs and take pictures and not have to apply for a permit?' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'Can a handyman replace rotted doorframes without applying for a permit?' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'Once repairs have been completed and all permits relating to the repairs have passed final inspection, you will need to upload a new report to the Building Department through Builidng e-Permitting - ProjectDox.' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'The report must state “No Repairs are Required”' },
      ],
      'local 7: Incidental repairs': [
        { page: 'https://www.margatefl.com/DocumentCenter/View/5260', quote: 'we request that you complete this form' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5260', quote: 'for incidental repairs that are non-life threatening.' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'The Architect will provide a date and you must sign the form to acknowledge that the repairs will be' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5260', quote: 'Approval of the Building Official as to acceptance of the time frame for repairs or modifications of deficient conditions that are' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5260', quote: 'NOTARY PUBLIC,' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'When incidental repairs are the only repairs required, the report submitted to the Building Department must state “No Repairs are Required.”' },
      ],
      'local 8: Site visit and close-out': [
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'The Building Department will visit the site to ensure all work has been completed in accordance with the FBC.' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'A final Architect/Engineer’s report will be required to complete the Safety Inspection Certification.' },
      ],
      'faq 1': [
        { page: 'https://www.margatefl.com/801/25-Year-Building-Safety-Inspection-Progr', quote: 'you will receive a certified letter with information about what you need to do' },
        { page: 'https://www.margatefl.com/801/25-Year-Building-Safety-Inspection-Progr', quote: 'please email Andrew Valentino' },
        { page: 'https://www.margatefl.com/196/Building', quote: 'Chief Structural Inspector' },
      ],
      'faq 2': [
        { page: 'https://www.margatefl.com/801/25-Year-Building-Safety-Inspection-Progr', quote: 'ProjectDox - Apply and upload Structural & Electrical Engineer Reports' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'The Architect can upload corrected form to the Building Department through Building e-Permitting - ProjectDox.' },
        { page: 'https://www.margatefl.com/197/Permit-Applications-Forms', quote: 'Safety Inspection Report Form - Electrical (PDF)' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'No. A letter will not be adequate. You are required to submit the BCBRA form.' },
      ],
      'faq 3': [
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'Broward County Form was not used' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'Appropriate boxes were not checked' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'Architect’s seal is not clear or an original signature was not provided' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'Architect indicated deficiencies in the building; either structural, electrical or both' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'You must apply for the required permits for each repair per the Florida Building Code.' },
      ],
      'faq 4': [
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'No. This is a safety inspection of the condition of the building’s structure and the electrical system.' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'If certain repairs are required, you may have to repair it to the current code.' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5262', quote: 'This will be determined during the annual inspection by the City of Margate Fire Department.' },
      ],
      'faq 5': [
        { page: 'https://www.margatefl.com/801/25-Year-Building-Safety-Inspection-Progr', quote: 'the owner shall have one hundred-eighty (180) days from the date of the report to obtain the required permit(s) and complete the necessary repairs.' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5260', quote: 'Repairs or modifications of deficient conditions that are incidental and non-life threatening are not required to be completed within' },
        { page: 'https://www.margatefl.com/DocumentCenter/View/5260', quote: 'Approval of the Building Official as to acceptance of the time frame for repairs or modifications of deficient conditions that are' },
      ],
      'nextStep': [
        { page: 'https://www.margatefl.com/801/25-Year-Building-Safety-Inspection-Progr', quote: 'you will receive a certified letter with information about what you need to do' },
      ],
    },
  },
  'broward-bsip/oakland-park': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.oaklandparkfl.gov/166/Building-Permitting', quote: 'In Person at the Building and Permitting Division located at Sky South Building 1100 Park Lane East, 1st Floor, Oakland Park, FL 33334.' },
      { page: 'https://www.oaklandparkfl.gov/166/Building-Permitting', quote: 'Phone: 954-630-4350' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'Please make sure your package includes the following with this cover sheet:' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'Only the latest Broward County Board of Rules and' },
      ],
      'lede': [
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/13805/FY-2025-Budget-Message-PDF', quote: 'Oakland Park\'s Building & Permitting Division oversees' },
        { page: 'https://oaklandparkfl.gov/Directory.aspx?DID=8', quote: 'Administrative Assistant/Building Safety Inspections Program' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'BUILDING SAFETY INSPECTION - SUBMITTAL FORM' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'The website for submitting online reports can be found at:' },
        { page: 'https://www.oaklandparkfl.gov/172/Building-Permit-Applications-Forms', quote: 'Building Safety Inspection Form-Structural' },
      ],
      'local 1: The city’s submittal form': [
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'BUILDING SAFETY INSPECTION - SUBMITTAL FORM' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'Please make sure your package includes the following with this cover sheet:' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'Year Built' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'Present Use' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'Square Feet' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'BORA List' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: '(Official Use Only)' },
      ],
      'local 2: What the package holds': [
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'Broward County Building Safety Inspection Report Forms' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'Only the latest Broward County Board of Rules and' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'Appeals INSPECTIONS FORMS will be approved.' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'A written letter issued by the Florida Licensed Professional Engineer/Architect stating that each building is structurally and' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'electrically SAFE for continued occupancy.' },
      ],
      'local 3: Filing the report': [
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'The website for submitting online reports can be found at:' },
        { page: 'https://www.oaklandparkfl.gov/166/Building-Permitting', quote: 'In Person at the Building and Permitting Division' },
        { page: 'https://oaklandparkfl.gov/584/Building-Permitting-FAQs', quote: 'Online Submissions Help Desk' },
      ],
      'local 4: The report forms': [
        { page: 'https://www.oaklandparkfl.gov/172/Building-Permit-Applications-Forms', quote: 'Building Safety Inspection Form-Electrical' },
        { page: 'https://www.oaklandparkfl.gov/172/Building-Permit-Applications-Forms', quote: 'Building Safety Inspection Form-Structural' },
        { page: 'https://www.oaklandparkfl.gov/166/Building-Permitting', quote: 'Building Safety Inspection - Structural' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/12513', quote: 'This report has been based upon the minimum inspection guidelines for building safety inspection as listed in the Broward County' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/12513', quote: 'Repairs are required as outlined in the attached inspection report' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/12513', quote: 'No Repairs Required' },
      ],
      'local 5: Who runs it': [
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/13805/FY-2025-Budget-Message-PDF', quote: 'Oakland Park\'s Building & Permitting Division oversees' },
        { page: 'https://oaklandparkfl.gov/Directory.aspx?DID=8', quote: 'Administrative Assistant/Building Safety Inspections Program' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/13805/FY-2025-Budget-Message-PDF', quote: 'A new Administrative Assistant position' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/13805/FY-2025-Budget-Message-PDF', quote: 'The volume of inspections has increased considerably' },
      ],
      'local 6: If it is not filed': [
        { page: 'https://oaklandparkfl.gov/DocumentCenter/View/11252/81622-SM-Agenda?bidId=', quote: 'SPECIAL MAGISTRATE' },
        { page: 'https://oaklandparkfl.gov/DocumentCenter/View/11252/81622-SM-Agenda?bidId=', quote: '40 YEAR BUILDING SAFETY INSPECTION REPORTS' },
        { page: 'https://oaklandparkfl.gov/DocumentCenter/View/11252/81622-SM-Agenda?bidId=', quote: 'FBC (BCA) 110.15' },
        { page: 'https://oaklandparkfl.gov/584/Building-Permitting-FAQs', quote: 'Building Safety Inspection-Orders Imposing Penalty/Lien' },
      ],
      'local 7: Older names': [
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: '25 Year Building Safety Inspection' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: '50/60 Year Building Safety Inspection' },
        { page: 'https://oaklandparkfl.gov/DocumentCenter/View/11252/81622-SM-Agenda?bidId=', quote: '40 YEAR BUILDING SAFETY INSPECTION REPORTS' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/13805/FY-2025-Budget-Message-PDF', quote: '40-Year Building Inspection program' },
      ],
      'faq 1': [
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'Please make sure your package includes the following with this cover sheet:' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'Broward County Building Safety Inspection Report Forms' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'The website for submitting online reports can be found at:' },
      ],
      'faq 2': [
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'Only the latest Broward County Board of Rules and' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'Appeals INSPECTIONS FORMS will be approved.' },
        { page: 'https://www.oaklandparkfl.gov/172/Building-Permit-Applications-Forms', quote: 'Building Safety Inspection Form-Electrical' },
        { page: 'https://www.oaklandparkfl.gov/172/Building-Permit-Applications-Forms', quote: 'Building Safety Inspection Submittal Form' },
      ],
      'faq 3': [
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'FOR ALL INQUIRIES RELATED TO THE BUILDING SAFETY INSPECTION PROGRAM PLEASE CALL' },
        { page: 'https://oaklandparkfl.gov/Directory.aspx?DID=8', quote: 'Administrative Assistant/Building Safety Inspections Program' },
        { page: 'https://oaklandparkfl.gov/584/Building-Permitting-FAQs', quote: 'BUILDING DIVISION MAIN NUMBER' },
      ],
      'faq 4': [
        { page: 'https://oaklandparkfl.gov/DocumentCenter/View/11252/81622-SM-Agenda?bidId=', quote: '40 YEAR BUILDING SAFETY INSPECTION REPORTS' },
        { page: 'https://oaklandparkfl.gov/584/Building-Permitting-FAQs', quote: 'Building Safety Inspection-Orders Imposing Penalty/Lien' },
      ],
      'faq 5': [
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'DATE OF SUBMITTAL' },
      ],
      'nextStep': [
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'Year Built' },
        { page: 'https://www.oaklandparkfl.gov/DocumentCenter/View/16078/2026-Building-Safety-Inspection-Submittal-Form', quote: 'Please make sure your package includes the following with this cover sheet:' },
      ],
    },
  },
  'broward-bsip/pembroke-park': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: '3150 SW 52nd Avenue, Pembroke Park, Florida, 33023' },
      { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Phone: 954-966-4600' },
      { page: 'https://www.tppfl.gov/338/Building-Safety-Inspection-Program-BSIP', quote: 'Town Hall 3150 SW 52nd Ave. Pembroke Park, FL 33023 Phone: 954-966-4600' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.tppfl.gov/338/Building-Safety-Inspection-Program-BSIP', quote: 'BSIP Recertification Application' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Building Safety Inspection Report Submittal Application' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Please make sure your package includes the following with this application:' },
      ],
      'lede': [
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Town of Pembroke Park Building Department' },
        { page: 'https://www.tppfl.gov/338/Building-Safety-Inspection-Program-BSIP', quote: 'Town Hall' },
        { page: 'https://www.tppfl.gov/338/Building-Safety-Inspection-Program-BSIP', quote: 'BSIP Master Packet' },
        { page: 'https://www.tppfl.gov/338/Building-Safety-Inspection-Program-BSIP', quote: 'BSIP Recertification Application (Building Safety Inspection Report Submittal Application Form)' },
        { page: 'https://www.tppfl.gov/338/Building-Safety-Inspection-Program-BSIP', quote: 'Broward County Uniform Building Permit Application' },
        { page: 'https://www.tppfl.gov/338/Building-Safety-Inspection-Program-BSIP', quote: 'Property Appraiser Report' },
        { page: 'https://www.tppfl.gov/338/Building-Safety-Inspection-Program-BSIP', quote: 'Board Policy 05-05' },
        { page: 'https://www.tppfl.gov/338/Building-Safety-Inspection-Program-BSIP', quote: 'BSIP ELECTRICAL Inspection Form' },
        { page: 'https://www.tppfl.gov/338/Building-Safety-Inspection-Program-BSIP', quote: 'BSIP STRUCTURAL Inspection Form' },
      ],
      'local 1: The Town’s application': [
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Building Safety Inspection Report Submittal Application' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Folio #' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Building Sq. Ft.' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Owner\'s Agent' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Associated Professional # 1:' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Repairs Required Submittal' },
      ],
      'local 2: Its checklist': [
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Please make sure your package includes the following with this application:' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Broward County Uniform Building Permit Application' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Building Safety Inspection Report Form' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Broward County Property Appraisers Report' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Architect / Structural Engineer\'s Cover Letter (Including Repair Recommendations if required)' },
      ],
      'local 3: The notice number': [
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Tracking # from Notification:' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1173/Board-Policy-05-05', quote: 'By June of each year, BORA will provide each local jurisdiction with a list of buildings and structures due for' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1173/Board-Policy-05-05', quote: 'From June through August, the Building Official shall notify the building owner or association by certified' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1173/Board-Policy-05-05', quote: 'mail return receipt that their properties are due for inspection.' },
      ],
      'local 4: The master packet': [
        { page: 'https://www.tppfl.gov/338/Building-Safety-Inspection-Program-BSIP', quote: 'BSIP Master Packet' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1205/BSIP-Master-Packet', quote: 'Building Safety Inspection Report Submittal Application' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1205/BSIP-Master-Packet', quote: 'PROPERTY APPRAISER REPORT' },
      ],
      'local 5: Sending it now': [
        { page: 'https://www.tppfl.gov/AlertCenter.aspx?AID=Building-Department-System-Upgrade-16', quote: 'The Town of Pembroke Park Building Department is upgrading from Gov-Easy to CivicPlus to deliver faster, more efficient permitting services!' },
        { page: 'https://www.tppfl.gov/194/Online-Permitting-System', quote: 'Dear Customers, we are currently transitioning to a New Online Permitting System with Civic Plus.' },
        { page: 'https://www.tppfl.gov/194/Online-Permitting-System', quote: 'the current GOV-EASY system is offline for any self' },
        { page: 'https://www.tppfl.gov/194/Online-Permitting-System', quote: 'You must email' },
        { page: 'https://www.tppfl.gov/194/Online-Permitting-System', quote: 'Submit Applications, Forms, and Required Documents' },
        { page: 'https://www.tppfl.gov/194/Online-Permitting-System', quote: 'Any Submissions missing a BDTF will be returned without further processing.' },
      ],
      'local 6: Repairs': [
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Repairs Required Submittal' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Permit Numbers for Repairs:' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Architect / Structural Engineer\'s Cover Letter (Including Repair Recommendations if required)' },
      ],
      'local 7: The policy posted': [
        { page: 'https://www.tppfl.gov/338/Building-Safety-Inspection-Program-BSIP', quote: 'Board Policy 05-05' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1173/Board-Policy-05-05', quote: 'Effective Date: August 9, 2024' },
      ],
      'faq 1': [
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Building Safety Inspection Report Submittal Application' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Please make sure your package includes the following with this application:' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Broward County Uniform Building Permit Application' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Building Safety Inspection Report Form' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Broward County Property Appraisers Report' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Architect / Structural Engineer\'s Cover Letter (Including Repair Recommendations if required)' },
      ],
      'faq 2': [
        { page: 'https://www.tppfl.gov/194/Online-Permitting-System', quote: 'Dear Customers, we are currently transitioning to a New Online Permitting System with Civic Plus.' },
        { page: 'https://www.tppfl.gov/194/Online-Permitting-System', quote: 'You must email' },
        { page: 'https://www.tppfl.gov/194/Online-Permitting-System', quote: 'Any Submissions missing a BDTF will be returned without further processing.' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1257/Building-Department-Document-Transmittal-Form-BTFD-', quote: 'Transmitted to Town of Pembroke Park Building Department VIA:' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1257/Building-Department-Document-Transmittal-Form-BTFD-', quote: 'Hand-Delivery' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1257/Building-Department-Document-Transmittal-Form-BTFD-', quote: 'US Postal Service' },
      ],
      'faq 3': [
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1173/Board-Policy-05-05', quote: 'By June of each year, BORA will provide each local jurisdiction with a list of buildings and structures due for' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1173/Board-Policy-05-05', quote: 'From June through August, the Building Official shall notify the building owner or association by certified' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1173/Board-Policy-05-05', quote: 'mail return receipt that their properties are due for inspection.' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Tracking # from Notification:' },
      ],
      'faq 4': [
        { page: 'https://www.tppfl.gov/338/Building-Safety-Inspection-Program-BSIP', quote: 'Board Policy 05-05' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1173/Board-Policy-05-05', quote: 'Effective Date: August 9, 2024' },
      ],
      'faq 5': [
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: '40 Year Inspection' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Initial 25 Year Inspection' },
        { page: 'https://www.tppfl.gov/338/Building-Safety-Inspection-Program-BSIP', quote: 'BSIP Recertification Application' },
      ],
      'nextStep': [
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Town of Pembroke Park Building Department' },
        { page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form', quote: 'Please make sure your package includes the following with this application:' },
      ],
    },
  },
  'broward-bsip/tamarac': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'First Floor 6011 Nob Hill Road Tamarac, FL 33321-6200' },
      { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Chief Building Official Phone: (954) 597-3420' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.tamarac.gov/DocumentCenter/View/9636', quote: 'BROWARD COUNTY UNIFORM BUILDING PERMIT APPLICATION' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Complete the Building Permit Application.' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'After the application has been submitted and an application number has been assigned, email the number to the Building Department for compliance tracking.' },
      ],
      'lede': [
        { page: 'https://www.tamarac.gov/1671/Building', quote: 'City of Tamarac Building Department' },
        { page: 'https://www.tamarac.gov/1658/Flood-and-Safety-Information', quote: 'Access flood protection resources and Building Safety Inspection Program information for properties throughout the City of Tamarac.' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'The Building Official issues a Notice of Required Inspection to the building owner or association when the property becomes due for inspection.' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Complete the Building Permit Application.' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Provide current ownership documentation from the Broward County Property Appraiser for the property under review.' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'After the application has been submitted and an application number has been assigned, email the number to the Building Department for compliance tracking.' },
      ],
      'local 1: The notice': [
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'The Building Official issues a Notice of Required Inspection to the building owner or association when the property becomes due for inspection.' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Each June, the Broward County Board of Rules and Appeals provides a list of properties that are due for participation in the Building Safety Inspection Program.' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Properties due for their initial 25-year inspection.' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Properties due for their 10-year re-certification.' },
      ],
      'local 2: Opening the application': [
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Complete the Building Permit Application.' },
        { page: 'https://www.tamarac.gov/DocumentCenter/View/9636', quote: 'BROWARD COUNTY UNIFORM BUILDING PERMIT APPLICATION' },
        { page: 'https://www.tamarac.gov/DocumentCenter/View/9636', quote: 'Description of Work: 40Yr/25Yr/10Yr [20____] Bldg Safety Insp Engineer Report' },
      ],
      'local 3: Proof of ownership': [
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Provide current ownership documentation from the Broward County Property Appraiser for the property under review.' },
      ],
      'local 4: The application number': [
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'After the application has been submitted and an application number has been assigned, email the number to the Building Department for compliance tracking.' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Include the assigned application number so the Building Department can track compliance with the inspection program.' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Complete and submit the Building Permit Application.' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Retain the assigned application number.' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Email the application number.' },
      ],
      'local 5: The report forms': [
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Download the official Building Safety Inspection Program forms, required checklists, and supporting documentation needed to complete your inspection submission from the Broward County Board of Rules and Appeals.' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Inspections must conform to the minimum guidelines issued by the Broward County Board of Rules and Appeals, titled' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'General Considerations & Guidelines for Building Safety Inspections' },
      ],
      'local 6: Whose rules apply': [
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Broward County Board of Rules and Appeals Policy #05-05 supersedes State of Florida' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Senate Bill 154 for the Building Safety Inspection Program requirements applicable within Broward County.' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'The Broward County Administrative Provisions of the Florida Building Code establish a Building Safety Inspection Program for our area.' },
      ],
      'local 7: What the page omits': [
        { page: 'https://www.tamarac.gov/1674/EPermits-Online-Services', quote: 'ePermits is a document workflow solution that allows residents, contractors, and City staff to manage construction plan submission, review, and approval online.' },
        { page: 'https://www.tamarac.gov/1674/EPermits-Online-Services', quote: 'Upload plans, supporting documents, and revisions through Electronic Plan Review.' },
      ],
      'faq 1': [
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'The Building Official issues a Notice of Required Inspection to the building owner or association when the property becomes due for inspection.' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Each June, the Broward County Board of Rules and Appeals provides a list of properties that are due for participation in the Building Safety Inspection Program.' },
      ],
      'faq 2': [
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Complete the Building Permit Application.' },
        { page: 'https://www.tamarac.gov/DocumentCenter/View/9636', quote: 'BROWARD COUNTY UNIFORM BUILDING PERMIT APPLICATION' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Provide current ownership documentation from the Broward County Property Appraiser for the property under review.' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'After the application has been submitted and an application number has been assigned, email the number to the Building Department for compliance tracking.' },
      ],
      'faq 3': [
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Download the official Building Safety Inspection Program forms, required checklists, and supporting documentation needed to complete your inspection submission from the Broward County Board of Rules and Appeals.' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Inspections must conform to the minimum guidelines issued by the Broward County Board of Rules and Appeals, titled' },
      ],
      'faq 4': [
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Broward County Board of Rules and Appeals Policy #05-05 supersedes State of Florida' },
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'Senate Bill 154 for the Building Safety Inspection Program requirements applicable within Broward County.' },
      ],
      'faq 5': [
        { page: 'https://www.tamarac.gov/DocumentCenter/View/9636', quote: 'Description of Work: 40Yr/25Yr/10Yr [20____] Bldg Safety Insp Engineer Report' },
      ],
      'nextStep': [
        { page: 'https://www.tamarac.gov/1657/Building-Safety-Inspection-Program', quote: 'The Building Official issues a Notice of Required Inspection to the building owner or association when the property becomes due for inspection.' },
        { page: 'https://www.tamarac.gov/1671/Building', quote: 'City of Tamarac Building Department' },
      ],
    },
  },
  'broward-bsip/weston': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.westonfl.org/government/building-code-services/contact-us', quote: 'Building Code Services offices are located inside the Administrative Services Center 17250 Royal Palm Boulevard Weston, FL 33326' },
      { page: 'https://www.westonfl.org/government/building-code-services/contact-us', quote: 'Phone: 954-385-0500' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'NEED TO SUBMIT A BUILDING INSPECTION REPORT, YOU CAN SUBMIT REPORTS ONLINE IN OUR EPERMITS PORTAL' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'Create on-line account in our ePermits portal to upload all documents' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'A Uniform Building Permit Application is required to be completed that has the correct folio, address and building number of each building.' },
      ],
      'lede': [
        { page: 'https://www.westonfl.org/government/building-code-services/contact-us', quote: 'City of Weston Building Code Services' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'The Broward County Board of Rules and Appeals (BORA) adopted new regulations for Building Inspections (formerly known as the 40-Year Inspection Program).' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'NEED TO SUBMIT A BUILDING INSPECTION REPORT, YOU CAN SUBMIT REPORTS ONLINE IN OUR EPERMITS PORTAL' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'A Uniform Building Permit Application is required to be completed that has the correct folio, address and building number of each building.' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'One structural and one electrical report is required per building.' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'A photo of the building that includes the building number and address is required to be submitted.' },
      ],
      'local 1: The program’s name': [
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'The Broward County Board of Rules and Appeals (BORA) adopted new regulations for Building Inspections (formerly known as the 40-Year Inspection Program).' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'Per BORA, the Program was revised to be consistent with the requirements of Florida law, F.S.553.899.' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'The major change to the program is that buildings will now be required to have that initial inspection at 25 years of age instead of 40.' },
      ],
      'local 2: Filing the report': [
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'NEED TO SUBMIT A BUILDING INSPECTION REPORT, YOU CAN SUBMIT REPORTS ONLINE IN OUR EPERMITS PORTAL' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'Create on-line account in our ePermits portal to upload all documents' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'for a step by step guide on how to register an account, associate a license and upload all required documents.' },
      ],
      'local 3: The permit application': [
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'A Uniform Building Permit Application is required to be completed that has the correct folio, address and building number of each building.' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'The application can be found on-line under Permitting Services.' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'Incorrect information on the application will cause a delay in the review process.' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'One application can be used for required reports.' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'The owner is responsible for submitting the report.' },
      ],
      'local 4: What goes with it': [
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'One structural and one electrical report is required per building.' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'A photo of the building that includes the building number and address is required to be submitted.' },
        { page: 'https://www.westonfl.org/government/building-code-services', quote: 'Plans must be submitted electronically for review online digitally/signed and sealed' },
      ],
      'local 5: After filing': [
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'If no work is required the file is closed out and archived.' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'Once your account is created you may contact the Building Department for assistance if required' },
        { page: 'https://www.westonfl.org/government/building-code-services/contact-us', quote: 'Phone: 954-385-0500' },
      ],
      'local 6: Repairs': [
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'If repairs are required a building permit must be applied for each discipline separately by a licensed general contractor and electrical contractor in accordance with all the provisions of the Florida Building Code.' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'If no work is required the file is closed out and archived.' },
      ],
      'local 7: Who runs the office': [
        { page: 'https://www.westonfl.org/government/building-code-services', quote: 'Weston\'s Building Code and Permitting Services Department enforces the Florida Building Code and Broward County regulations.' },
        { page: 'https://www.westonfl.org/government/building-code-services', quote: 'Weston’s Building Official, Reginald Cox, oversees the department' },
        { page: 'https://www.westonfl.org/government/building-code-services/contact-us', quote: 'Services provided by C.A.P. Government , Inc.' },
        { page: 'https://www.westonfl.org/government/building-code-services/contact-us', quote: 'Building Code Services offices are located inside the Administrative Services Center 17250 Royal Palm Boulevard Weston, FL 33326' },
      ],
      'local 8: The notice': [
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'For additional program information you may visit The Broward County Board of Rules and Appeals Website' },
      ],
      'faq 1': [
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'NEED TO SUBMIT A BUILDING INSPECTION REPORT, YOU CAN SUBMIT REPORTS ONLINE IN OUR EPERMITS PORTAL' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'Create on-line account in our ePermits portal to upload all documents' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'for a step by step guide on how to register an account, associate a license and upload all required documents.' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'A Uniform Building Permit Application is required to be completed that has the correct folio, address and building number of each building.' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'A photo of the building that includes the building number and address is required to be submitted.' },
      ],
      'faq 2': [
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'One structural and one electrical report is required per building.' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'A Uniform Building Permit Application is required to be completed that has the correct folio, address and building number of each building.' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'One application can be used for required reports.' },
      ],
      'faq 3': [
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'If repairs are required a building permit must be applied for each discipline separately by a licensed general contractor and electrical contractor in accordance with all the provisions of the Florida Building Code.' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'If no work is required the file is closed out and archived.' },
      ],
      'faq 4': [
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'For additional program information you may visit The Broward County Board of Rules and Appeals Website' },
      ],
      'faq 5': [
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'The Broward County Board of Rules and Appeals (BORA) adopted new regulations for Building Inspections (formerly known as the 40-Year Inspection Program).' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'Per BORA, the Program was revised to be consistent with the requirements of Florida law, F.S.553.899.' },
        { page: 'https://www.westonfl.org/government/building-code-services/25-year-or-older-building-inspection-program', quote: 'The major change to the program is that buildings will now be required to have that initial inspection at 25 years of age instead of 40.' },
      ],
      'nextStep': [
        { page: 'https://www.westonfl.org/government/building-code-services/contact-us', quote: 'City of Weston Building Code Services' },
      ],
    },
  },
  'broward-bsip/wilton-manors': {
    read: '2026-10-17',
    office: [
      { page: 'https://www.wiltonmanors.gov/Directory.aspx?did=18', quote: 'Physical Address 2020 Wilton Drive Wilton Manors, FL 33305' },
      { page: 'https://www.wiltonmanors.gov/Directory.aspx?did=18', quote: 'Phone Number (954) 390-2180' },
      { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'please contact the Community Development Services Department by calling (954) 390-2180' },
    ],
    rows: {
      'heroSub': [
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'Building Safety Inspection Program' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'BSIP - FBC Chapter Section 110.15' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'BSIP Structural Inspection Form' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'BSIP Electrical Inspection Form' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'Broward BORA Policy 05-05' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'Building permit applications and building permit inspection requests are now accepted online. Simply visit the Online Services page and click on the Building Permits link.' },
      ],
      'lede': [
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'please contact the Community Development Services Department by calling (954) 390-2180' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'The City has contracted with Calvin, Giordano & Associates, a SAFEBUILT Company, for building services assistance.' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'Building Safety Inspection Program' },
        { page: 'https://www.wiltonmanors.gov/132/Construction-Services', quote: 'The Construction Services Division is responsible for the administration of the Florida Building Code, fire inspections, issuance of building permits and job-site inspections.' },
      ],
      'local 1: Where the documents are': [
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'Building Safety Inspection Program' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'BSIP - FBC Chapter Section 110.15' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'BSIP Structural Inspection Form' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'BSIP Electrical Inspection Form' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'Broward BORA Policy 05-05' },
      ],
      'local 2: The code section': [
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8466/BSIP---FBC-Chapter-1-Section-11015', quote: 'BROWARD COUNTY AMENDMENTS' },
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8466/BSIP---FBC-Chapter-1-Section-11015', quote: 'BORA by written policy has established the guidelines' },
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8466/BSIP---FBC-Chapter-1-Section-11015', quote: 'The Building Official shall enforce the Building' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'Building Official, Chief' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'The City has contracted with Calvin, Giordano & Associates, a SAFEBUILT Company, for building services assistance.' },
      ],
      'local 3: The report forms': [
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8467/FILLABLE-STRUCTURAL---BSIP-Inspection-Form-2023', quote: 'STRUCTURAL SAFETY INSPECTION REPORT FORM' },
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8467/FILLABLE-STRUCTURAL---BSIP-Inspection-Form-2023', quote: 'No Repairs Required' },
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8467/FILLABLE-STRUCTURAL---BSIP-Inspection-Form-2023', quote: 'Repairs are Required as Outlined in the Attached Inspection Report' },
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8467/FILLABLE-STRUCTURAL---BSIP-Inspection-Form-2023', quote: 'This report has been based upon the minimum inspection guidelines for building safety inspection as listed in the Broward County' },
      ],
      'local 4: Filing online': [
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'Building permit applications and building permit inspection requests are now accepted online. Simply visit the Online Services page and click on the Building Permits link.' },
        { page: 'https://www.wiltonmanors.gov/132/Construction-Services', quote: 'All permits are now submitted online and can be monitored online.' },
      ],
      'local 5: Digital signatures': [
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'Digital Signature Affidavit' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'Building Safety Inspection Program' },
      ],
      'local 6: Code compliance': [
        { page: 'https://www.wiltonmanors.gov/AgendaCenter/ViewFile/Agenda/_07022025-1745', quote: 'CODE COMPLIANCE UNIT' },
        { page: 'https://www.wiltonmanors.gov/AgendaCenter/ViewFile/Agenda/_07022025-1745', quote: 'Special Magistrate Hearing' },
        { page: 'https://www.wiltonmanors.gov/AgendaCenter/ViewFile/Agenda/_07022025-1745', quote: 'FBC (2014) 110.15 40 Year Inspection Program, 40 Year Building Safety Inspection' },
      ],
      'local 7: An older policy copy': [
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8469/Broward-BORA-Policy-05-05', quote: 'Effective Date: May 11, 2023' },
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8469/Broward-BORA-Policy-05-05', quote: 'Within ninety (90) days of receiving the Notice of Required Building Safety Inspection, the owner or' },
      ],
      'local 8: Who is exempt': [
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8466/BSIP---FBC-Chapter-1-Section-11015', quote: 'The following are exempt from this program:' },
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8466/BSIP---FBC-Chapter-1-Section-11015', quote: 'U.S. Government Buildings' },
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8466/BSIP---FBC-Chapter-1-Section-11015', quote: 'State of Florida Buildings' },
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8466/BSIP---FBC-Chapter-1-Section-11015', quote: 'Buildings built on Indian Reservations' },
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8466/BSIP---FBC-Chapter-1-Section-11015', quote: 'Broward County School Board' },
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8466/BSIP---FBC-Chapter-1-Section-11015', quote: 'One- and Two-Family Dwellings' },
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8466/BSIP---FBC-Chapter-1-Section-11015', quote: 'Fee Simple Townhouses as defined in the Florida' },
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8466/BSIP---FBC-Chapter-1-Section-11015', quote: 'Minor Structures, defined as buildings or structures in' },
      ],
      'faq 1': [
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'Building Safety Inspection Program' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'BSIP - FBC Chapter Section 110.15' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'BSIP Structural Inspection Form' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'BSIP Electrical Inspection Form' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'Broward BORA Policy 05-05' },
      ],
      'faq 2': [
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'Building permit applications and building permit inspection requests are now accepted online. Simply visit the Online Services page and click on the Building Permits link.' },
        { page: 'https://www.wiltonmanors.gov/132/Construction-Services', quote: 'All permits are now submitted online and can be monitored online.' },
      ],
      'faq 3': [
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8466/BSIP---FBC-Chapter-1-Section-11015', quote: 'The Building Official shall enforce the Building' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'The City has contracted with Calvin, Giordano & Associates, a SAFEBUILT Company, for building services assistance.' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'Building Official, Chief' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'Please reach out to your plan reviewer or inspector to discuss plan review comments' },
      ],
      'faq 4': [
        { page: 'https://www.wiltonmanors.gov/AgendaCenter/ViewFile/Agenda/_07022025-1745', quote: 'CODE COMPLIANCE UNIT' },
        { page: 'https://www.wiltonmanors.gov/AgendaCenter/ViewFile/Agenda/_07022025-1745', quote: 'Special Magistrate Hearing' },
        { page: 'https://www.wiltonmanors.gov/AgendaCenter/ViewFile/Agenda/_07022025-1745', quote: 'FBC (2014) 110.15 40 Year Inspection Program, 40 Year Building Safety Inspection' },
      ],
      'faq 5': [
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8469/Broward-BORA-Policy-05-05', quote: 'All buildings or structures that have performed a building safety inspection under the prior program ("40-Year' },
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8469/Broward-BORA-Policy-05-05', quote: 'Building Safety Inspection Program") are deemed compliant with F.S.553.899' },
      ],
      'nextStep': [
        { page: 'https://www.wiltonmanors.gov/DocumentCenter/View/8466/BSIP---FBC-Chapter-1-Section-11015', quote: 'The Building Official shall enforce the Building' },
        { page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications', quote: 'please contact the Community Development Services Department by calling (954) 390-2180' },
      ],
    },
  },
};
