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
 *   • LICENSE. Every photograph, and the hero clip, is Pexels-licensed: free
 *     for commercial use, no attribution required, modification allowed. The
 *     other clip, `bimAssembly`, comes from the firm's paid Artgrid
 *     subscription — also commercial use with no attribution, but a
 *     different license. Provenance of every file (source
 *     id, author, what it replaced) lives in `docs/IMAGE-CREDITS.md`, outside
 *     the served tree. Record anything you add there.
 *
 *   • NEVER caption a stock photograph as a Tercero Tablada project. These
 *     illustrate TYPOLOGIES and SERVICES — the kind of structure the practice
 *     engineers — not completed work. Real project photography replaces them
 *     one entry at a time, without touching a component.
 *
 *   • ONE PLACEMENT PER ASSET. Repeating a photograph across the site reads as
 *     thin. `site.ts` allocates each of these at most once; if you add a
 *     placement, add a photograph. (A service's card photo reappearing as the
 *     hero of that same service's page — and, for the two county programs, as
 *     the plate of that program's home section — is one placement seen from
 *     different doors, not a reuse. So is a SHARED section component rendered
 *     on more than one page — SouthFloridaMap on Home and Contact, the
 *     EngineerSection plate on the Home teaser and About: one slot in
 *     site.ts, one placement.) Two entries are spares with no placement at
 *     all, `frameCraneSky` and `midriseBalconies`; each says so where it is
 *     declared.
 *
 *   • `alt` SAYS WHAT IS IN THE PICTURE, in English, and `altEs` says the
 *     same in Spanish; `Img` prints the one for the page's language on every
 *     photograph. (It used to print `alt=""` wherever a photo was
 *     atmospheric, which is nearly everywhere: a search engine was told
 *     nothing about any image on the site.) A slot where the photograph is
 *     only a backdrop still keeps it away from screen readers — with
 *     `aria-hidden`, not with an empty alt. So write what a person would see:
 *     never a keyword, never a county's number, never a place or a job the
 *     frame does not show.
 *
 *   • SIX FILES PER PHOTOGRAPH, or it does not go in this table. Each entry
 *     points at a 2000-wide master plus 1200 (`@md`) and 900 (`@sm`)
 *     renditions, each as JPEG and as AVIF. `Img` builds its `srcset` from all
 *     six; a missing rung silently hands a retina card the 2000w file, which
 *     is exactly the weight problem the rungs exist to solve. The sharp
 *     recipe that makes them is in `docs/IMAGE-CREDITS.md`.
 *
 *   • `pos` IS A FOCAL POINT, not a crop. Most photographs are fine centred in
 *     any box. A few portrait frames are shown in wide slots, where a centred
 *     cover crop keeps the middle third — which is where a person's torso is,
 *     not their head. `pos` moves the crop window to the subject in every slot
 *     the photo lands in, overriding each slot's default `object-position`.
 */

export type Photo = {
  /** 2000w master (or the native width when the source is narrower). */
  src: string;
  /** 1200px-wide rendition — the rung a retina card or a DPR-3 phone needs. */
  md: string;
  /** 900px-wide rendition, for cards and grids at 1x. */
  sm: string;
  /** The same three widths as AVIF, offered first; JPEG is the fallback. */
  avif: { src: string; md: string; sm: string };
  /** What the picture shows, in English… */
  alt: string;
  /** …and in Spanish, for the pages under /es. */
  altEs: string;
  /** Intrinsic size of `src`. */
  w: number;
  h: number;
  /** Optional CSS `object-position` focal point, e.g. '50% 30%'. */
  pos?: string;
};

const p = (
  name: string,
  w: number,
  h: number,
  alt: string,
  altEs: string,
  pos?: string,
): Photo => ({
  src: `/ttc/img/site/${name}.jpg`,
  md: `/ttc/img/site/${name}@md.jpg`,
  sm: `/ttc/img/site/${name}@sm.jpg`,
  avif: {
    src: `/ttc/img/site/${name}.avif`,
    md: `/ttc/img/site/${name}@md.avif`,
    sm: `/ttc/img/site/${name}@sm.avif`,
  },
  w,
  h,
  alt,
  altEs,
  ...(pos ? { pos } : {}),
});

/* ═══════════════════════════════════════════════════════════════════════════
   PHOTOGRAPHS
   ═══════════════════════════════════════════════════════════════════════════ */

const catalogue = {
  /* ── Residential ────────────────────────────────────────────────────── */
  houseConcreteGarden: p(
    'house-concrete-garden', 2000, 2500,
    'Contemporary concrete-and-glass house seen from its garden',
    'Casa contemporánea de concreto y vidrio vista desde su jardín',
  ),
  housePalm: p(
    'house-palm', 2000, 3000,
    'White two-storey house with balconies, framed by a palm',
    'Casa blanca de dos pisos con balcones, enmarcada por una palma',
  ),
  houseDarkBrick: p(
    'house-dark-brick', 2000, 2666,
    'Dark brick and render house with a cantilevered upper floor',
    'Casa de ladrillo oscuro y estuco con el piso superior en voladizo',
  ),
  houseWhiteTree: p(
    'house-white-tree', 2000, 2667,
    'White modern house with deep window reveals behind a mature tree',
    'Casa moderna blanca de ventanas remetidas, detrás de un árbol grande',
  ),
  houseTownhouses: p(
    'house-townhouses', 2000, 1333,
    'Row of modern townhouses sharing party walls',
    'Hilera de townhouses modernos que comparten muros medianeros',
  ),
  /* Took the gallery slot of `house-concrete-carport`, a CGI render whose
     parked car carried a European number plate — a detail that tells a South
     Florida visitor the picture is from somewhere else. */
  houseModernLevels: p(
    'house-modern-levels', 2000, 1289,
    'Modern house of stacked rectangular volumes at different levels',
    'Casa moderna de volúmenes rectangulares apilados a distintos niveles',
  ),

  /* ── Concrete as a material ─────────────────────────────────────────── */
  concreteBeamColumn: p(
    'concrete-beam-column', 2000, 3000,
    'Cast concrete beam meeting a column at a haunched junction',
    'Viga de concreto que llega a una columna en una unión acartelada',
  ),
  concreteVault: p(
    'concrete-vault', 2000, 1333,
    'Pair of curved concrete shells meeting overhead',
    'Dos cascarones curvos de concreto que se encuentran en lo alto',
  ),
  concreteRamp: p(
    'concrete-ramp', 2000, 2667,
    'Concrete ramp and beam structure passing beneath a tower',
    'Rampa y estructura de vigas de concreto que pasan bajo una torre',
  ),
  concreteStair: p(
    'concrete-stair', 2000, 3000,
    'Concrete stair against a board-marked wall',
    'Escalera de concreto junto a un muro que conserva la marca de las tablas del encofrado',
  ),
  concreteSteppedGold: p(
    'concrete-stepped-gold', 2000, 1333,
    'Stepped concrete facade in late afternoon light',
    'Fachada escalonada de concreto a la luz del final de la tarde',
  ),

  /* ── Chosen to replace line-art on the service cards ─────────────────
     These carry a card on their own. The diagrams they replaced explained a
     service accurately and moved nobody; a photograph has to do the opposite,
     so these are picked for drama first and legibility of subject second. The
     card's title and summary carry the meaning. */
  analysisTowersUp: p(
    'analysis-towers-up', 2000, 1333,
    'Looking straight up the gap between two concrete towers',
    'Vista hacia arriba por el espacio entre dos torres de concreto',
  ),
  bimWireframeModel: p(
    'bim-wireframe-model', 2000, 2500,
    'Wireframe model of a building’s structure and services',
    'Modelo alámbrico de la estructura y las instalaciones de un edificio',
  ),
  peerTowerBw: p(
    'peer-tower-bw', 2000, 1333,
    'Fluted concrete tower seen from its base against a flat sky',
    'Torre de concreto estriada vista desde su base contra un cielo uniforme',
  ),
  southFloridaAerial: p(
    'south-florida-aerial', 2000, 1125,
    'Aerial across the South Florida built fabric toward the coast',
    'Vista aérea del tejido urbano del Sur de Florida hacia la costa',
  ),

  /* ── Reinforcement ──────────────────────────────────────────────────── */
  /* Replaced `rebar-cage-up`, which was loose column bars shot against the sky.
     Juan's read, and he is right: it looked like a steel yard, not like design.
     A cast frame shows the thing the service actually produces — flat slabs,
     columns and edge beams standing before anything is clad. */
  concreteFrameSlabs: p(
    'concrete-frame-slabs', 2000, 1333,
    'Cast concrete frame under construction — flat slabs, columns and edge beams before cladding',
    'Estructura de concreto en construcción: losas planas, columnas y vigas de borde antes del revestimiento',
  ),
  foundationMatPit: p(
    'foundation-mat-pit', 2000, 1339,
    'Mat foundation reinforcement laid out inside an excavation, a worker checking the bars',
    'Acero de refuerzo de una losa de cimentación colocado dentro de una excavación, con un trabajador que revisa las varillas',
  ),
  rebarBundles: p(
    'rebar-bundles', 2000, 3000,
    'Bundled reinforcing bar stacked on site',
    'Atados de varillas de refuerzo apilados en la obra',
  ),
  /* Gallery only, where the cell is a 4:3 cover crop: the hands and the tie
     sit dead centre of the portrait frame, so no focal point is needed. */
  rebarTyingHands: p(
    'rebar-tying-hands', 2000, 2804,
    'Hands tying a reinforcement intersection with pliers',
    'Manos que amarran un cruce de varillas de refuerzo con unas pinzas',
  ),
  rebarSlabCrew: p(
    'rebar-slab-crew', 2000, 1500,
    'Two workers placing reinforcement across a suspended slab',
    'Dos trabajadores colocan el acero de refuerzo de una losa de entrepiso',
  ),
  rebarCageTower: p(
    'rebar-cage-tower', 2000, 1500,
    'Tall reinforcement cage standing before the pour',
    'Armadura de refuerzo alta, en pie antes del vaciado del concreto',
  ),

  /* ── Frames under construction ──────────────────────────────────────── */
  /* Was the home "I am building something new" door, and has had no placement
     since the two doors left the home page (2026-10-04) — a spare, kept
     because it is the cleanest new-build frame in the set. It replaced
     `frame-tower-sunlit`, which was byte-identical to the gallery's
     `frame-tower` (one photograph in two places) and read as a derelict frame
     on a dirt lot. This is the opposite: a clean cast-in-place frame, formwork
     on the top deck, the crane that is building it against open sky.
     Retouched once, and only to remove a legible crane-rental name from the
     counter-jib panel and a small maker's mark — see docs/IMAGE-CREDITS.md. */
  frameCraneSky: p(
    'frame-crane-sky', 2000, 1415,
    'Cast-in-place concrete frame of a tower under construction, the tower crane above it against a clear sky',
    'Estructura de concreto vaciado en sitio de una torre en construcción, con la grúa torre encima contra un cielo despejado',
  ),
  frameSlabEdges: p(
    'frame-slab-edges', 2000, 2667,
    'Stacked slab edges of a concrete frame seen from below',
    'Bordes de losa superpuestos de una estructura de concreto, vistos desde abajo',
  ),
  frameUnderConstruction: p(
    'frame-under-construction', 2000, 1298,
    'Reinforced-concrete frame of a building under construction',
    'Estructura de concreto reforzado de un edificio en construcción',
  ),
  frameCraneClean: p(
    'frame-crane-clean', 2000, 2500,
    'Multi-storey reinforced-concrete frame under a tower crane, floor plates open to the sky',
    'Estructura de concreto reforzado de varios pisos bajo una grúa torre, con las losas abiertas al cielo',
  ),
  frameGolden: p(
    'frame-golden', 2000, 1600,
    'Open concrete frame lit low across the floor plates',
    'Estructura de concreto abierta, con luz rasante sobre las losas',
  ),
  frameCurvedBalconies: p(
    'frame-curved-balconies', 2000, 3000,
    'Curved white balcony slabs cantilevered from a residential tower',
    'Losas curvas de balcón, blancas, en voladizo desde una torre residencial',
  ),

  /* ── South Florida ──────────────────────────────────────────────────── */
  miamiBrickell: p(
    'miami-brickell', 2000, 1333,
    'Miami skyline across Biscayne Bay',
    'Horizonte de Miami al otro lado de la bahía de Biscayne',
  ),
  miamiCondoAerial: p(
    'miami-condo-aerial', 2000, 1338,
    'Aerial view of coastal condominium towers in South Florida',
    'Vista aérea de torres de condominios en la costa del Sur de Florida',
  ),
  miamiBeachDusk: p(
    'miami-beach-dusk', 2000, 1335,
    'South Florida coastline and buildings at dusk from the air',
    'La costa y los edificios del Sur de Florida al atardecer, desde el aire',
  ),
  miamiResidentialTowers: p(
    'miami-residential-towers', 2000, 1333,
    'Line of residential towers along the South Florida waterfront',
    'Hilera de torres residenciales frente al agua en el Sur de Florida',
  ),
  miamiTowersUp: p(
    'miami-towers-up', 2000, 2667,
    'Looking up between two residential towers',
    'Vista hacia arriba entre dos torres residenciales',
  ),
  miamiSkylineTeal: p(
    'miami-skyline-teal', 2000, 1312,
    'Miami skyline seen from the water under moving cloud',
    'Horizonte de Miami visto desde el agua bajo nubes en movimiento',
  ),

  /* ── The two county programs ────────────────────────────────────────────
     One per program, white concrete against water in midday light, so the two
     home sections mirror each other. Both are views of SEVERAL buildings, on
     purpose — the ordinary balconied concrete stock these programs reach.
     One recognisable building beside the word "recertification" says that
     building has a problem. The frame these replace said it outright:
     `recert-balconies-bw` was a derelict facade with broken glass and razor
     wire.

     Keep it that way. Each was taken in the county whose program it
     illustrates (docs/IMAGE-CREDITS.md), so the pairing in `site.ts` is
     honest — but the alt text names no city, county or building, and no
     caption may: nothing here shows a building that received a notice, and
     nothing here is a Tercero Tablada project.

     The Miami-Dade frame is the SECOND one tried. The first (an aerial,
     Pexels 4366059) was a soft video-quality still centred on one hotel
     complex with an excavator at its foot; the review caught all three. This
     one is a sharp 4032px still of a row of condominium towers across the
     water. Retouched once: faint lettering on one office parapet, unreadable
     at this size, was blurred into the wall. See docs/IMAGE-CREDITS.md.

     Its focal point matters only in boxes narrower than the 3:2 frame (the
     4:5 plate): 28% puts the three residential towers in the window. Wider
     boxes crop top and bottom only; 42% keeps the buildings, which sit in the
     upper half of the frame, inside a short wide band. */
  recertMiamiDade: p(
    'recert-miami-dade', 2000, 1333,
    'A row of white residential high-rise buildings reflected in calm water under a blue sky, in South Florida',
    'Una hilera de edificios residenciales blancos de gran altura reflejados en agua tranquila bajo un cielo azul, en el Sur de Florida',
    '28% 42%',
  ),
  bsipBroward: p(
    'bsip-broward', 2000, 1333,
    'Aerial view along a South Florida waterway lined with mid-rise and high-rise residential buildings, the ocean beyond them',
    'Vista aérea de un canal del Sur de Florida bordeado de edificios residenciales de mediana y gran altura, con el océano al fondo',
  ),

  /* ── Existing mid-rise stock ────────────────────────────────────────── */
  /* `midriseBalconies` was the home "I own or manage an existing building"
     door; like `frameCraneSky` it has had no placement since 2026-10-04. */
  midriseBalconies: p(
    'midrise-balconies', 2000, 1348,
    'Cantilevered balconies stacked up an existing residential building',
    'Balcones en voladizo, uno sobre otro, en un edificio residencial existente',
  ),
  midriseGlassBalconies: p(
    'midrise-glass-balconies', 2000, 2500,
    'Glass-railed balconies cantilevered from a concrete residential frame',
    'Balcones con barandas de vidrio en voladizo sobre una estructura residencial de concreto',
  ),
  midriseClean: p(
    'midrise-clean', 2000, 2500,
    'Clean modern mid-rise residential facade',
    'Fachada limpia y moderna de un edificio residencial de mediana altura',
  ),

  /* ── Inspection, assessment & repair ────────────────────────────────── */
  /* Portrait frames that land in 16:9 service cards and wide page heroes. A
     centred crop of either keeps torsos and loses heads — the two inspectors
     became legs behind a railing — so both carry a focal point. */
  inspectBalconyPair: p(
    'inspect-balcony-pair', 2000, 3000,
    'Two inspectors on a cantilevered balcony of an existing building',
    'Dos inspectores en un balcón en voladizo de un edificio existente',
    '50% 30%',
  ),
  inspectWall: p(
    'inspect-wall', 2000, 3000,
    'Engineer examining a cracked masonry and concrete wall up close',
    'Ingeniero que examina de cerca un muro de mampostería y concreto con grietas',
    '50% 30%',
  ),
  /* The "Repairs to existing structures" typology. It replaced
     `facade-repair-rope`, a rope-access worker with a paint roller — which
     read as repainting and undersold the structural scope. This is the repair
     itself: mortar being worked into the soffit of a concrete beam. The
     helmet's printed company name was retouched out, so no brand rides along
     with the claim; see docs/IMAGE-CREDITS.md. */
  repairSoffitTrowel: p(
    'repair-soffit-trowel', 2000, 1333,
    'Worker in a hard hat patching the underside of a concrete beam with a trowel',
    'Trabajador con casco que repara con una llana la cara inferior de una viga de concreto',
  ),
} as const;

export const photo = catalogue;

export type PhotoKey = keyof typeof catalogue;

/* ═══════════════════════════════════════════════════════════════════════════
   VIDEO
   ═══════════════════════════════════════════════════════════════════════════
   Two short silent loops, H.264, 1920-wide, trimmed to 10–12 s and encoded to
   sit under ~3 MB each. Every one ships with a poster frame: the poster is
   what a reduced-motion visitor sees, what paints before the clip is
   buffered, and what a data-saver connection is left with. A loop that only
   works when it plays is not usable — treat the poster as the real asset.

   There were three. The recertification band and its aerial clip
   (`existing-midrise`) were retired on 2026-10-04: the county-program
   sections that now follow the hero are photographs, so no second video
   starts downloading right behind the hero's.

   PHONE RENDITIONS. A phone shows these through a dark scrim at a few hundred
   CSS px, so the 1080p file is weight it cannot see. Each placed clip also
   ships `<name>-mobile.mp4` (≤ 720 wide, H.264 High, CRF 27–31 with a
   maxrate cap, faststart, no audio track, same length and frame count as the
   desktop file) and a matching `<name>-mobile-poster.jpg`. A full-bleed clip
   (today only the hero) gets a 608×1080 PORTRAIT crop — the phone box is
   portrait, so a landscape file would spend two thirds of its pixels
   off-screen. The hero crop is centred on the phone framing its CSS already
   asked for (`object-position: 56% 22%`); a full-bleed clip with no such rule
   is cropped on the frame centre. The model clip is not full-bleed — it was
   cut for a 16:9 stage — so its phone file is the same frame at 720×406.
   `VideoLoop` offers the mobile file under `(max-width: 700px)`.

   POSTERS IN AVIF. The poster is what a phone downloads at high priority
   before anything is on screen, so each one also ships as `<poster>.avif`
   (sharp, quality 45, 4:2:0: the hero's phone frame went from 89 KB to
   52 KB, seen through the scrim there is no telling them apart). The JPEG
   stays as the fallback and as the frame a crawler is given.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Clip = {
  src: string;
  poster: string;
  /** What the clip shows — printed on its poster frame. English, Spanish. */
  alt: string;
  altEs: string;
  /** Intrinsic size of `src` (the desktop file). */
  w: number;
  h: number;
  /** ≤720px-wide rendition for phones; VideoLoop picks it at `(max-width: 700px)`. */
  mobile?: string;
  /** The poster matching `mobile`, same framing. */
  mobilePoster?: string;
  /** The same two posters as AVIF, for the browsers that take it. */
  posterAvif: string;
  mobilePosterAvif?: string;
};

const v = (
  name: string,
  alt: string,
  altEs: string,
  { mobile = false }: { mobile?: boolean } = {},
): Clip => ({
  src: `/ttc/video/${name}.mp4`,
  poster: `/ttc/video/${name}-poster.jpg`,
  posterAvif: `/ttc/video/${name}-poster.avif`,
  alt,
  altEs,
  w: 1920,
  h: 1080,
  ...(mobile
    ? {
        mobile: `/ttc/video/${name}-mobile.mp4`,
        mobilePoster: `/ttc/video/${name}-mobile-poster.jpg`,
        mobilePosterAvif: `/ttc/video/${name}-mobile-poster.avif`,
      }
    : {}),
});

const clips = {
  heroMiami: v(
    'hero-miami',
    'Aerial pass over the Miami waterfront and its concrete towers',
    'Recorrido aéreo sobre el frente costero de Miami y sus torres de concreto',
    { mobile: true },
  ),
  /* The only clip that is not photography, and the only one that earns the
     exception: it is a structural model assembling floor plate by floor plate,
     which is the one thing on this site a camera cannot be pointed at. It
     replaced the inline SVG wireframe in what was the home BIM stage — a
     drawing of a model, which is not a model. `site.ts` now allocates it to
     the home new-buildings section that took that stage's place.

     The source runs 5.25 s one-way, so it ships as a palindrome — forward,
     then reversed with the duplicated frames dropped at both the turn and the
     loop point. The model builds and unbuilds; it never snaps back to a bare
     top plate. 250 frames, 10.4 s, seamless. */
  bimAssembly: v(
    'bim-assembly',
    'A structural model assembling floor plate by floor plate, seen in wireframe',
    'Modelo estructural que se arma piso por piso, en vista alámbrica',
    { mobile: true },
  ),
} as const;

export const video = clips;
