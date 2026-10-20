/**
 * Every municipality of the two counties, by name. Shown on the home page
 * under the jurisdictions' marks (CostSection) in both languages: place
 * names are not translated, so the lists are shared, and the two counties
 * stay in their own lists.
 *
 * Miami-Dade: the County's list of municipalities (Islandia, dissolved, is
 * not listed). Broward: the 31 municipalities of the County.
 *
 * The home page shows each county's own mark and its `featured` cities
 * first; the municipalities with no mark on file are named in a line right
 * under them ("Also: …"), and every other mark opens under the county's
 * "All N municipalities" disclosure.
 */
export const miamiDadeMunicipalities = [
  'Aventura',
  'Bal Harbour',
  'Bay Harbor Islands',
  'Biscayne Park',
  'Coral Gables',
  'Cutler Bay',
  'Doral',
  'El Portal',
  'Florida City',
  'Golden Beach',
  'Hialeah',
  'Hialeah Gardens',
  'Homestead',
  'Indian Creek',
  'Key Biscayne',
  'Medley',
  'Miami',
  'Miami Beach',
  'Miami Gardens',
  'Miami Lakes',
  'Miami Shores',
  'Miami Springs',
  'North Bay Village',
  'North Miami',
  'North Miami Beach',
  'Opa-locka',
  'Palmetto Bay',
  'Pinecrest',
  'South Miami',
  'Sunny Isles Beach',
  'Surfside',
  'Sweetwater',
  'Virginia Gardens',
  'West Miami',
] as const;

export const browardMunicipalities = [
  'Coconut Creek',
  'Cooper City',
  'Coral Springs',
  'Dania Beach',
  'Davie',
  'Deerfield Beach',
  'Fort Lauderdale',
  'Hallandale Beach',
  'Hillsboro Beach',
  'Hollywood',
  'Lauderdale Lakes',
  'Lauderdale-by-the-Sea',
  'Lauderhill',
  'Lazy Lake',
  'Lighthouse Point',
  'Margate',
  'Miramar',
  'North Lauderdale',
  'Oakland Park',
  'Parkland',
  'Pembroke Park',
  'Pembroke Pines',
  'Plantation',
  'Pompano Beach',
  'Sea Ranch Lakes',
  'Southwest Ranches',
  'Sunrise',
  'Tamarac',
  'West Park',
  'Weston',
  'Wilton Manors',
] as const;

/**
 * The cities the home page shows first, after the county's own mark: each
 * county's seven most populous municipalities with a mark on file (2020
 * census), largest first. Miami Beach has no mark on file (see `marks`), so
 * it is named in the line under these instead, and Miami-Dade's seventh is
 * Coral Gables.
 */
export const featuredMiamiDade = ['Miami', 'Hialeah', 'Miami Gardens', 'Homestead', 'Doral', 'North Miami', 'Coral Gables'] as const;
export const featuredBroward = ['Fort Lauderdale', 'Pembroke Pines', 'Hollywood', 'Miramar', 'Coral Springs', 'Pompano Beach', 'Davie'] as const;

/**
 * The current official mark of each office that has one on file, taken from
 * that government's own website: `file` is public/ttc/img/jurisdictions/
 * <file>.webp, `host` is where it came from (the credits page lists it),
 * and `dark` is a mark its government publishes only in white, drawn in dark
 * ink so it reads on a light surface.
 *
 * Left out on purpose, and why — put one back only with that government's
 * written permission:
 *   Miami Beach          its logo page: "only … in conjunction with official
 *                        municipal business or as required in a grant award"
 *   Surfside             its seal page: the Town's official seal, for official
 *                        business; Florida Statute 165.043
 *   Miami Lakes          its brand guidelines: by the standards or by
 *                        permission of its communications office
 *   Aventura             the only mark on its site is an anniversary edition
 *   Lauderdale Lakes, Lauderhill, Parkland
 *                        published only with white lettering beside the colour
 *   Lazy Lake            no logo, only a letterhead image
 * Their names stay in the lists.
 */
export type Mark = { file: string; host: string; dark?: true };

export const marks: Record<string, Mark> = {
  'Miami-Dade County': { file: 'miami-dade', host: 'miamidade.gov' },
  'Broward County': { file: 'broward', host: 'broward.org' },
  'Miami': { file: 'miami', host: 'miami.gov', dark: true },
  'Hialeah': { file: 'hialeah', host: 'hialeahfl.gov' },
  'Coral Gables': { file: 'coral-gables', host: 'coralgables.com', dark: true },
  'Doral': { file: 'doral', host: 'cityofdoral.com' },
  'Fort Lauderdale': { file: 'fort-lauderdale', host: 'fortlauderdale.gov' },
  'Hollywood': { file: 'hollywood', host: 'hollywoodfl.org' },
  'Pembroke Pines': { file: 'pembroke-pines', host: 'ppines.com' },
  'Bal Harbour': { file: 'bal-harbour', host: 'balharbourfl.gov' },
  'Bay Harbor Islands': { file: 'bay-harbor-islands', host: 'bayharborislands-fl.gov' },
  'Biscayne Park': { file: 'biscayne-park', host: 'biscayneparkfl.gov' },
  'Cutler Bay': { file: 'cutler-bay', host: 'cutlerbay-fl.gov' },
  'El Portal': { file: 'el-portal', host: 'elportalvillage.com' },
  'Florida City': { file: 'florida-city', host: 'floridacityfl.gov' },
  'Golden Beach': { file: 'golden-beach', host: 'goldenbeach.us' },
  'Hialeah Gardens': { file: 'hialeah-gardens', host: 'cityofhialeahgardens.com' },
  'Homestead': { file: 'homestead', host: 'homesteadfl.gov' },
  'Indian Creek': { file: 'indian-creek', host: 'indiancreekvillagefl.gov' },
  'Key Biscayne': { file: 'key-biscayne', host: 'keybiscayne.fl.gov' },
  'Medley': { file: 'medley', host: 'townofmedley.com' },
  'Miami Gardens': { file: 'miami-gardens', host: 'miamigardens-fl.gov' },
  'Miami Shores': { file: 'miami-shores', host: 'msvfl.gov' },
  'Miami Springs': { file: 'miami-springs', host: 'miamisprings-fl.gov' },
  'North Bay Village': { file: 'north-bay-village', host: 'northbayvillage-fl.gov' },
  'North Miami': { file: 'north-miami', host: 'northmiamifl.gov' },
  'North Miami Beach': { file: 'north-miami-beach', host: 'citynmb.com' },
  'Opa-locka': { file: 'opa-locka', host: 'opalockafl.gov' },
  'Palmetto Bay': { file: 'palmetto-bay', host: 'palmettobay-fl.gov', dark: true },
  'Pinecrest': { file: 'pinecrest', host: 'pinecrest-fl.gov' },
  'South Miami': { file: 'south-miami', host: 'somifl.gov' },
  'Sunny Isles Beach': { file: 'sunny-isles-beach', host: 'sibfl.gov' },
  'Sweetwater': { file: 'sweetwater', host: 'cityofsweetwater.fl.gov' },
  'Virginia Gardens': { file: 'virginia-gardens', host: 'virginiagardens-fl.gov' },
  'West Miami': { file: 'west-miami', host: 'cityofwestmiami.gov' },
  'Coconut Creek': { file: 'coconut-creek', host: 'coconutcreek.gov' },
  'Cooper City': { file: 'cooper-city', host: 'coopercity.gov' },
  'Coral Springs': { file: 'coral-springs', host: 'coralsprings.gov' },
  'Dania Beach': { file: 'dania-beach', host: 'daniabeachfl.gov' },
  'Davie': { file: 'davie', host: 'davie-fl.gov' },
  'Deerfield Beach': { file: 'deerfield-beach', host: 'deerfield-beach.com' },
  'Hallandale Beach': { file: 'hallandale-beach', host: 'hallandalebeachfl.gov' },
  'Hillsboro Beach': { file: 'hillsboro-beach', host: 'townofhillsborobeach.com' },
  'Lauderdale-by-the-Sea': { file: 'lauderdale-by-the-sea', host: 'lauderdalebythesea-fl.gov' },
  'Lighthouse Point': { file: 'lighthouse-point', host: 'lighthousepointfl.gov' },
  'Margate': { file: 'margate', host: 'margatefl.com' },
  'Miramar': { file: 'miramar', host: 'miramarfl.gov' },
  'North Lauderdale': { file: 'north-lauderdale', host: 'nlauderdale.org' },
  'Oakland Park': { file: 'oakland-park', host: 'oaklandparkfl.gov' },
  'Pembroke Park': { file: 'pembroke-park', host: 'tppfl.gov' },
  'Plantation': { file: 'plantation', host: 'plantation.org' },
  'Pompano Beach': { file: 'pompano-beach', host: 'pompanobeachfl.gov' },
  'Sea Ranch Lakes': { file: 'sea-ranch-lakes', host: 'searanchlakesfl.org' },
  'Southwest Ranches': { file: 'southwest-ranches', host: 'southwestranches.org' },
  'Sunrise': { file: 'sunrise', host: 'sunrisefl.gov' },
  'Tamarac': { file: 'tamarac', host: 'tamarac.gov' },
  'West Park': { file: 'west-park', host: 'cityofwestpark.org' },
  'Weston': { file: 'weston', host: 'westonfl.org' },
  'Wilton Manors': { file: 'wilton-manors', host: 'wiltonmanors.gov' },
};
