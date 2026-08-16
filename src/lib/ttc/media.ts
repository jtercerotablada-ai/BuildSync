/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TERCERO TABLADA — media catalogue
 * ─────────────────────────────────────────────────────────────────────────────
 * The raw asset table: every photograph and video clip the public site can
 * draw on, with its real intrinsic size so nothing shifts while it loads.
 *
 * `site.ts` decides WHERE each asset goes. This file only says WHAT exists.
 *
 * ⚠ RULES — keep these when adding assets:
 *
 *   • LICENCE. Everything here is Pexels-licensed: free for commercial use,
 *     no attribution required, modification allowed. That is why there is no
 *     credit obligation for these files (the older CC images under
 *     /ttc/img/projects still carry one — see IMAGE-CREDITS.md and /credits).
 *
 *   • NEVER caption a stock photograph as a Tercero Tablada project. These
 *     illustrate TYPOLOGIES and SERVICES — the kind of structure the practice
 *     engineers — not completed work. Real project photography replaces them
 *     one entry at a time, without touching a component.
 *
 *   • ONE PLACEMENT PER ASSET. Repeating a photograph across the site reads as
 *     thin. `site.ts` allocates each of these exactly once; if you add a
 *     placement, add a photograph.
 *
 *   • `alt` is written for the case where the image is CONTENT. Where a photo
 *     is purely atmospheric the component passes `alt=""` itself — an empty
 *     alt on a decorative image is correct, a described one is noise.
 */

export type Photo = {
  src: string;
  alt: string;
  w: number;
  h: number;
  /** 900px-wide rendition, for cards and grids. */
  sm: string;
};

const p = (name: string, w: number, h: number, alt: string): Photo => ({
  src: `/ttc/img/site/${name}.jpg`,
  sm: `/ttc/img/site/${name}@sm.jpg`,
  w,
  h,
  alt,
});

/* ═══════════════════════════════════════════════════════════════════════════
   PHOTOGRAPHS
   ═══════════════════════════════════════════════════════════════════════════ */

export const photo = {
  /* ── Residential ────────────────────────────────────────────────────── */
  houseConcreteGarden: p(
    'house-concrete-garden', 2000, 2500,
    'Contemporary concrete-and-glass house seen from its garden',
  ),
  houseConcreteCarport: p(
    'house-concrete-carport', 2000, 2500,
    'Modern rendered house with an open carport under the upper floor',
  ),
  housePalm: p(
    'house-palm', 2000, 3000,
    'White two-storey house with balconies, framed by a palm',
  ),
  houseDarkBrick: p(
    'house-dark-brick', 2000, 2666,
    'Dark brick and render house with a cantilevered upper floor',
  ),
  houseWhiteTree: p(
    'house-white-tree', 2000, 2667,
    'White modern house with deep window reveals behind a mature tree',
  ),
  houseTownhouses: p(
    'house-townhouses', 2000, 1333,
    'Row of modern townhouses sharing party walls',
  ),
  houseModernLevels: p(
    'house-modern-levels', 2000, 1289,
    'Modern house of stacked rectangular volumes at different levels',
  ),

  /* ── Concrete as a material ─────────────────────────────────────────── */
  concreteBeamColumn: p(
    'concrete-beam-column', 2000, 3000,
    'Cast concrete beam meeting a column at a haunched junction',
  ),
  concreteFins: p(
    'concrete-fins', 2000, 1331,
    'Rhythm of vertical concrete fins across a facade',
  ),
  concreteVault: p(
    'concrete-vault', 2000, 1333,
    'Pair of curved concrete shells meeting overhead',
  ),
  concreteRamp: p(
    'concrete-ramp', 2000, 2667,
    'Concrete ramp and beam structure passing beneath a tower',
  ),
  concreteStair: p(
    'concrete-stair', 2000, 3000,
    'Concrete stair against a board-marked wall',
  ),
  concreteSteppedGold: p(
    'concrete-stepped-gold', 2000, 1333,
    'Stepped concrete facade in late afternoon light',
  ),

  /* ── Chosen to replace line-art on the service cards ─────────────────
     These carry a card on their own. The diagrams they replaced explained a
     service accurately and moved nobody; a photograph has to do the opposite,
     so these are picked for drama first and legibility of subject second. The
     card's title and summary carry the meaning. */
  analysisTowersUp: p(
    'analysis-towers-up', 2000, 1333,
    'Looking straight up the gap between two concrete towers',
  ),
  bimWireframeModel: p(
    'bim-wireframe-model', 2000, 2500,
    'Wireframe model of a building’s structure and services',
  ),
  recertBalconiesBw: p(
    'recert-balconies-bw', 2000, 3557,
    'Grid of concrete balcony openings up an existing building',
  ),
  peerTowerBw: p(
    'peer-tower-bw', 2000, 1333,
    'Fluted concrete tower seen from its base against a flat sky',
  ),
  southFloridaAerial: p(
    'south-florida-aerial', 2000, 1125,
    'Aerial across the South Florida built fabric toward the coast',
  ),

  /* ── Reinforcement ──────────────────────────────────────────────────── */
  rebarCageUp: p(
    'rebar-cage-up', 2000, 2667,
    'Looking up the inside of a column reinforcement cage against the sky',
  ),
  rebarMatWorkers: p(
    'rebar-mat-workers', 2000, 1333,
    'Crew working across a mat of slab reinforcement',
  ),
  rebarBundles: p(
    'rebar-bundles', 2000, 3000,
    'Bundled reinforcing bar stacked on site',
  ),
  rebarTyingHands: p(
    'rebar-tying-hands', 2000, 2804,
    'Hands tying a reinforcement intersection with pliers',
  ),
  rebarSlabCrew: p(
    'rebar-slab-crew', 2000, 1500,
    'Two workers placing reinforcement across a suspended slab',
  ),
  rebarCageTower: p(
    'rebar-cage-tower', 2000, 1500,
    'Tall reinforcement cage standing before the pour',
  ),

  /* ── Frames under construction ──────────────────────────────────────── */
  frameColumnsSky: p(
    'frame-columns-sky', 2000, 3000,
    'Concrete columns and slab edges of a frame rising against the sky',
  ),
  frameSlabEdges: p(
    'frame-slab-edges', 2000, 2667,
    'Stacked slab edges of a concrete frame seen from below',
  ),
  frameUnderConstruction: p(
    'frame-under-construction', 2000, 1298,
    'Reinforced-concrete frame of a building under construction',
  ),
  frameCurvedCrane: p(
    'frame-curved-crane', 2000, 1333,
    'Curved concrete structure under a tower crane',
  ),
  frameTower: p(
    'frame-tower', 2000, 3000,
    'Concrete core and floor plates of a tower under construction',
  ),
  frameGolden: p(
    'frame-golden', 2000, 1600,
    'Open concrete frame lit low across the floor plates',
  ),
  frameCurvedBalconies: p(
    'frame-curved-balconies', 2000, 3000,
    'Curved white balcony slabs cantilevered from a residential tower',
  ),

  /* ── South Florida ──────────────────────────────────────────────────── */
  miamiBrickell: p(
    'miami-brickell', 2000, 1333,
    'Miami skyline across Biscayne Bay',
  ),
  miamiCondoAerial: p(
    'miami-condo-aerial', 2000, 1338,
    'Aerial view of coastal condominium towers in South Florida',
  ),
  miamiBeachDusk: p(
    'miami-beach-dusk', 2000, 1335,
    'South Florida coastline and buildings at dusk from the air',
  ),
  miamiResidentialTowers: p(
    'miami-residential-towers', 2000, 1333,
    'Line of residential towers along the South Florida waterfront',
  ),
  miamiTowersUp: p(
    'miami-towers-up', 2000, 2667,
    'Looking up between two residential towers',
  ),
  miamiSkylineTeal: p(
    'miami-skyline-teal', 2000, 1312,
    'Miami skyline seen from the water under moving cloud',
  ),

  /* ── Existing mid-rise stock ────────────────────────────────────────── */
  midriseBalconies: p(
    'midrise-balconies', 2000, 1348,
    'Cantilevered balconies stacked up an existing residential building',
  ),
  midriseGlassBalconies: p(
    'midrise-glass-balconies', 2000, 2500,
    'Glass-railed balconies cantilevered from a concrete residential frame',
  ),
  midriseClean: p(
    'midrise-clean', 2000, 2500,
    'Clean modern mid-rise residential facade',
  ),

  /* ── Inspection & assessment ────────────────────────────────────────── */
  inspectBalconyPair: p(
    'inspect-balcony-pair', 2000, 3000,
    'Two inspectors on a cantilevered balcony of an existing building',
  ),
  inspectWall: p(
    'inspect-wall', 2000, 3000,
    'Engineer examining a cracked masonry and concrete wall up close',
  ),
  inspectRoofHelmets: p(
    'inspect-roof-helmets', 2000, 1336,
    'Hard hats and survey equipment set down at a roof edge',
  ),
} as const;

export type PhotoKey = keyof typeof photo;

/* ═══════════════════════════════════════════════════════════════════════════
   VIDEO
   ═══════════════════════════════════════════════════════════════════════════
   Short silent loops, H.264, 1920-wide, trimmed to 10–12 s and encoded to sit
   under ~3 MB each. Every one ships with a poster frame: the poster is what a
   reduced-motion visitor sees, what paints before the clip is buffered, and
   what a data-saver connection is left with. A loop that only works when it
   plays is not usable — treat the poster as the real asset.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Clip = { src: string; poster: string; alt: string; w: number; h: number };

const v = (name: string, alt: string): Clip => ({
  src: `/ttc/video/${name}.mp4`,
  poster: `/ttc/video/${name}-poster.jpg`,
  alt,
  w: 1920,
  h: 1080,
});

export const video = {
  heroMiami: v(
    'hero-miami',
    'Aerial pass over the Miami waterfront and its concrete towers',
  ),
  existingMidrise: v(
    'existing-midrise',
    'Aerial pass over white mid-rise residential buildings in South Florida',
  ),
  /* The only clip that is not photography, and the only one that earns the
     exception: it is a structural model assembling floor plate by floor plate,
     which is the one thing on this site a camera cannot be pointed at. The
     source runs 5.25 s one-way, so it ships as a palindrome — forward, then
     reversed with the duplicated frames dropped at both the turn and the loop
     point. The model builds and unbuilds; it never snaps back to a bare top
     plate. 250 frames, 10.4 s, seamless. */
  bimAssembly: v(
    'bim-assembly',
    'A structural model assembling floor plate by floor plate, seen in wireframe',
  ),
  craneSky: v('crane-sky', 'Two tower cranes crossing against an open sky'),
} as const;
