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
 * NO LOGO, SEAL OR MARK OF ANY GOVERNMENT IS SHOWN ON THIS SITE (the owner,
 * 2026-10-25: "es ilegal ... quiero evitar problemas de usar esos logos").
 * The two county logos that were here since October 21, 2026 are gone with
 * their files. What the research of 2026-10-21 found: Broward's Terms of Use
 * (broward.org/Terms/Pages/IntellectualPropRights.aspx) say its logos may not
 * be used without prior written permission, except for use that qualifies as
 * fair use; Miami-Dade's published logo guidelines say nothing about use by
 * third parties; neither permission was ever on file; and cities' own brand
 * pages limit their marks (a city seal also falls under Fla. Stat. 165.043).
 * The offices are named in plain text. A mark comes back only with that
 * government's written permission, and programs.test.ts is then changed on
 * purpose.
 */

