/**
 * Every municipality of the two counties, by name. Shown on the home page
 * under each county's own logo (home/HomeWhere.tsx) in both languages: place names
 * are not translated, so the lists are shared, and the two counties stay in
 * their own lists.
 *
 * Miami-Dade: the County's list of municipalities (Islandia, dissolved, is
 * not listed). Broward: the 31 municipalities of the County.
 *
 * The home page shows each COUNTY's logo and, under it, every municipality
 * by name as plain text. It shows no city seal or logo (the owner, October
 * 21, 2026, after the legal audit: Fla. Stat. 165.043 makes using a
 * municipality's or county's official seal without its express approval a
 * second-degree misdemeanor, and cities' own brand pages limit their marks
 * to official business or ask for permission).
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
 * The logo of each COUNTY, taken from that county's own website. Only the
 * two counties are here (October 21, 2026); the 57 city marks that used to
 * be were removed, and their files deleted. The researched rules, read
 * 2026-10-21: Broward's Terms of Use (broward.org/Terms/Pages/
 * IntellectualPropRights.aspx) say its logos may not be used without prior
 * written permission, except for use that qualifies as fair use; Miami-Dade's
 * published logo guidelines say nothing about use by third parties. Neither
 * permission is on file. To keep a county's logo with certainty, ask in
 * writing (Miami-Dade Communications Department, Graphics Manager,
 * 305-375-2340; Broward Public Communications Office, broward.org/PublicInfo)
 * and keep the answer; to drop one, delete its line here and its file.
 *
 * Taken from that government's own website: `file` is public/ttc/img/jurisdictions/
 * <file>.webp, `host` is where it came from (the credits page lists it),
 * and `dark` is a mark its government publishes only in white, drawn in dark
 * ink so it reads on a light surface.
 *
 * No city mark is shown: put one back only with that city's written
 * permission.
 */
export type Mark = { file: string; host: string; dark?: true };

export const marks: Record<string, Mark> = {
  'Miami-Dade County': { file: 'miami-dade', host: 'miamidade.gov' },
  'Broward County': { file: 'broward', host: 'broward.org' },
};
