/**
 * ─────────────────────────────────────────────────────────────────────────────
 * WHERE EACH OFFICE NAME WAS READ — a record for whoever re-checks them
 * ─────────────────────────────────────────────────────────────────────────────
 * NOT CONTENT. No page, component or content file imports this module, and
 * none may: its only reader is site.test.ts.
 *
 * "Who sent your notice?" on the two county-program pages (`Service.offices`
 * in site.ts) lists each city's building office under the name that city's
 * own page gives it. Until October 7, 2026 every row was also a LINK to that
 * page. It no longer is, and the decision is taken — do not reopen it
 * without the owner:
 *
 *   City and town websites answer crawlers unevenly: a 403 to one, no answer
 *   at all to the next. The on-page check the owner runs after each release
 *   counted 6 of these links as broken on one crawl and 13 on the following
 *   one, while every one of them opened normally in a browser. Which ones
 *   fail depends on where the crawler connects from, so it can be neither
 *   reproduced nor fixed from here — and it changes from crawl to crawl.
 *
 * So the page prints the city and the office as text, and links ONE
 * outside page per program (`offices.forms`): Miami-Dade County's
 * recertification page, and Broward's Board of Rules and Appeals. (A city
 * with a page of its own on this site is linked to THAT page from its row —
 * see cities.ts; the pages those were read on are in city-sources.ts.)
 *
 * The addresses are kept, here, because each name was read on one of them
 * and has to be read there again. City sites move pages without redirecting
 * them, and the addresses search engines list are not always the live ones
 * (see Plantation and Pembroke Pines below). They are kept OUT of site.ts on
 * purpose: the content bundle is sent to the browser with every page that
 * hands a service to a client component, so an address left in a row would
 * still travel with the page, linked or not.
 *
 * TO RE-CHECK — whenever `regulatoryChecked` moves:
 *   1. Open each address IN A BROWSER. Several of these sites refuse scripts
 *      (403) and load normally for a person, so a status code proves nothing.
 *   2. Compare the office's name on the page with the row in site.ts. Fix the
 *      row in site.ts and site.es.ts (the office is the same in both).
 *   3. Fix the address here if the page moved.
 *   4. Move `officeLinksChecked` (site.ts, site.es.ts) and its ISO twin.
 *
 * site.test.ts keeps this list and the rows together: one entry per row, in
 * the same order, under the English row's city.
 */

/** The day every address below was opened and read — except the rows
    added on 2026-10-28, the municipalities the lists lacked and
    unincorporated Broward: Bal Harbour to Virginia Gardens (Miami-Dade),
    Coconut Creek to Unincorporated Broward (Broward). Several of those
    towns have no page for the program, so their name was read on their
    building department's page, their contact page or a town document. */
export const officePagesRead = '2026-10-07';

export type OfficePage = {
  /** `city` of the English row in site.ts. */
  city: string;
  /** The city's OWN page (.gov or the city's domain) the office was read on:
      its page about the program, or its building department's where the
      city has none. Never a third party's. */
  page: string;
};

export const officePages: Record<string, OfficePage[]> = {
  /* Miami-Dade. Two cities have no page for the program alone, so the name
     was read on the building department's: Aventura (its Building Division
     page carries the recertification guidelines and forms) and Miami Gardens
     (Building Services lists recertifications among its services).
     miami.gov, cityofdoral.com and sibfl.gov refuse scripts (403) and load
     normally in a browser. The last row is the county's own page — the one
     the block still links, as `forms`. */
  'building-recertification': [
    { city: 'City of Miami', page: 'https://www.miami.gov/Permits-Construction/Unsafe-Structures-Services/Get-a-Building-Recertification' },
    { city: 'Miami Beach', page: 'https://www.miamibeachfl.gov/city-hall/building/building-recert/' },
    { city: 'Hialeah', page: 'https://www.hialeahfl.gov/201/Building-Recertification-Forms' },
    { city: 'Coral Gables', page: 'https://www.coralgables.com/department/development-services/building-division/services/building-recertification' },
    { city: 'Doral', page: 'https://www.cityofdoral.com/Departments/Building-Department/Building-Recertification-Program' },
    { city: 'North Miami', page: 'https://www.northmiamifl.gov/1713/Milestone-Recertification-3010-year' },
    { city: 'North Miami Beach', page: 'https://www.citynmb.com/1581/Recertification' },
    { city: 'Aventura', page: 'https://www.cityofaventura.com/169/Building-Permits' },
    { city: 'Sunny Isles Beach', page: 'https://www.sibfl.gov/Building-Code/Building-Department/Building-Recertification-Program' },
    { city: 'Miami Gardens', page: 'https://www.miamigardens-fl.gov/190/Building-Services' },
    { city: 'Homestead', page: 'https://www.homesteadfl.gov/565/Building-Recertification' },
    { city: 'Surfside', page: 'https://www.townofsurfsidefl.gov/departments-services/building/40-year-recertification-program' },
    { city: 'Key Biscayne', page: 'https://keybiscayne.fl.gov/services/building_zoning_and_planning/resources/building_recertification.php' },
    { city: 'Bay Harbor Islands', page: 'https://www.bayharborislands-fl.gov/149/Building-Department' },
    { city: 'Cutler Bay', page: 'https://www.cutlerbay-fl.gov/com-dev/page/building-division' },
    { city: 'El Portal', page: 'https://elportalvillage.com/code-enforcement-building-department/' },
    { city: 'Florida City', page: 'https://www.floridacityfl.gov/166/Community-Development' },
    { city: 'Medley', page: 'https://www.townofmedley.com/building-and-zoning-department' },
    { city: 'Miami Lakes', page: 'https://www.miamilakes-fl.gov/departments/building-zoning-and-code-compliance/' },
    { city: 'Miami Springs', page: 'https://www.miamisprings-fl.gov/building/page/building-overview' },
    { city: 'North Bay Village', page: 'https://northbayvillage-fl.gov/building-department/' },
    { city: 'Opa-locka', page: 'https://www.opalockafl.gov/faq.aspx?TID=14' },
    { city: 'Pinecrest', page: 'https://www.pinecrest-fl.gov/Government/Building/Other-Building-Services/Recertification' },
    { city: 'Sweetwater', page: 'https://cityofsweetwater.fl.gov/158/Building-Zoning' },
    { city: 'West Miami', page: 'https://cityofwestmiami.gov/index.asp?SEC=DBC123E0-8D93-4518-8D26-284545C66EE0' },
    { city: 'Bal Harbour', page: 'https://balharbourfl.gov/doing-business/building-permits/' },
    { city: 'Biscayne Park', page: 'https://biscayneparkfl.gov/contact' },
    { city: 'Golden Beach', page: 'https://goldenbeach.us/wp-content/uploads/2023/03/Quick-Reference-guide-outside-agencies-2.28.23.pdf' },
    { city: 'Hialeah Gardens', page: 'https://www.cityofhialeahgardens.com/departments/building' },
    { city: 'Indian Creek', page: 'https://indiancreekvillagefl.gov/government/building-department/' },
    { city: 'Miami Shores', page: 'https://www.msvfl.gov/AbouttheBuildingDepartment' },
    { city: 'Palmetto Bay', page: 'https://www.palmettobay-fl.gov/153/Building-Permits' },
    { city: 'South Miami', page: 'https://www.somifl.gov/115/Building-Division' },
    { city: 'Virginia Gardens', page: 'https://virginiagardens-fl.gov/building-zoning/' },
    { city: 'Unincorporated Miami-Dade', page: 'https://www.miamidade.gov/global/economy/building/recertification.page' },
  ],
  /* Broward. Two cities have no page for the program alone, so the name was
     read on the building department's: Deerfield Beach and Sunrise.
     Plantation's page moved: the address search engines list returns "Page
     Not Found", and the one below is where its Department of Building Safety
     links today. Pembroke Pines' moved too (page 1616 is gone; 1484 is
     live). fortlauderdale.gov, miramarfl.gov, plantation.org, sunrisefl.gov
     and davie-fl.gov refuse scripts (403) and load normally in a browser. */
  'broward-bsip': [
    { city: 'Fort Lauderdale', page: 'https://www.fortlauderdale.gov/Government/Departments/Development-Services/Permitting-Services/Building-Safety-Inspection-Program' },
    { city: 'Hollywood', page: 'https://www.hollywoodfl.org/1312/Building-Safety-Program' },
    { city: 'Pompano Beach', page: 'https://www.pompanobeachfl.gov/government/building-inspections/building-safety-inspection-program' },
    { city: 'Hallandale Beach', page: 'https://www.hallandalebeachfl.gov/1479/Building-Safety-Inspection-Program' },
    { city: 'Deerfield Beach', page: 'https://www.deerfield-beach.com/294/Building-Services' },
    { city: 'Pembroke Pines', page: 'https://www.ppines.com/1484/BSIP-Building-Safety-Inspection-Program' },
    { city: 'Miramar', page: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Building-Permits-Inspections/BSIP' },
    { city: 'Plantation', page: 'https://www.plantation.org/government/departments/building-safety/building-safety-inspection-program' },
    { city: 'Sunrise', page: 'https://www.sunrisefl.gov/departments-services/community-development/building' },
    { city: 'Davie', page: 'https://www.davie-fl.gov/1840/Building-Safety-Inspection-Program' },
    { city: 'Cooper City', page: 'https://www.coopercity.gov/page/building-division' },
    { city: 'Coral Springs', page: 'https://www.coralsprings.gov/Government/Departments/Building/Online-Permitting-eTrakit/Create-an-Online-Account' },
    { city: 'Dania Beach', page: 'https://www.daniabeachfl.gov/building-division' },
    { city: 'Hillsboro Beach', page: 'https://www.townofhillsborobeach.com/196/Building-Department' },
    { city: 'Lauderdale Lakes', page: 'https://www.lauderdalelakes.org/DocumentCenter/View/5806/Building-Safety-Program-Packet' },
    { city: 'Lauderhill', page: 'https://www.lauderhill-fl.gov/departments/development-services/building' },
    { city: 'Lighthouse Point', page: 'https://www.lighthousepointfl.gov/158/Building-Zoning' },
    { city: 'Margate', page: 'https://www.margatefl.com/801/25-Year-Building-Safety-Inspection-Progr' },
    { city: 'Oakland Park', page: 'https://www.oaklandparkfl.gov/166/Building-Permitting' },
    { city: 'Pembroke Park', page: 'https://www.tppfl.gov/DocumentCenter/View/1242/BSIP-Recertification-Application-Building-Safety-Inspection-Report-Submittal-Application-Form' },
    { city: 'Tamarac', page: 'https://www.tamarac.gov/1671/Building' },
    { city: 'Weston', page: 'https://www.westonfl.org/government/building-code-services/contact-us' },
    { city: 'Wilton Manors', page: 'https://www.wiltonmanors.gov/133/Building-Permit-Applications' },
    { city: 'Coconut Creek', page: 'https://coconutcreek.gov/government/city-directory/resilient-design-and-development/building-department' },
    { city: 'Lauderdale-by-the-Sea', page: 'https://www.lauderdalebythesea-fl.gov/152/Building-Division' },
    { city: 'Lazy Lake', page: 'https://img1.wsimg.com/blobby/go/c9ac3036-1c14-499b-b0bc-c0e06f73d318/downloads/87237ebd-d365-4329-bbc5-608970e6ae0f/AGENDA.pdf?ver=1792349876809' },
    { city: 'North Lauderdale', page: 'https://www.nlauderdale.org/departments/community_development/index.php' },
    { city: 'Parkland', page: 'https://www.cityofparkland.org/109/Building-Department' },
    { city: 'Sea Ranch Lakes', page: 'https://searanchlakesfl.org/wp-content/uploads/2023/05/Resolution-2023-04-authorizing-building-department-fees.pdf' },
    { city: 'Southwest Ranches', page: 'https://www.southwestranches.org/departments/building-permitting-and-inspections/' },
    { city: 'West Park', page: 'https://www.cityofwestpark.org/governement/departments/building-department' },
    { city: 'Unincorporated Broward', page: 'https://www.broward.org/Building' },
  ],
};
