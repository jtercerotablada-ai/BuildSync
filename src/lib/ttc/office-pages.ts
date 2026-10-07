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
 * county-level page per program (`offices.forms`): Miami-Dade County's
 * recertification page, and Broward's Board of Rules and Appeals.
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

/** The day every address below was opened and read. */
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
  ],
};
