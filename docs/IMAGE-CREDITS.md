# Image & video credits — ttcivilstructural.com

Internal record. It lived at `public/ttc/img/IMAGE-CREDITS.md` until
2026-09-22, which meant anyone could read it at
`/ttc/img/IMAGE-CREDITS.md`. It now sits outside the served tree. Nothing on
the site links here; the public page is `/credits`, which says only what a
visitor needs to know (licensed stock, not the firm's projects).

## How photography is used on this site

Photography and video appear **as material, atmosphere and typology**. They
are never captioned, framed or implied to be a Tercero Tablada project. The
Work page shows anonymized *representative engagements*, and "What we design"
shows *typologies*, so that no stock photograph can be mistaken for the firm's
portfolio. A photograph of a house under "Single-family residences" says *this
is the sort of building we engineer*, not *we engineered this one*. The
typologies footnote and the note under the Work gallery both say so. Keep
both.

Replace these with real Tercero Tablada photography when it exists, one
catalogue entry at a time (`src/lib/ttc/media.ts`). No component changes.

---

## Licenses

| Source | What | Terms |
|---|---|---|
| **Pexels** | All 41 photographs in `public/ttc/img/site/`; clip `hero-miami` | Free for commercial use, modification allowed, **no attribution required**, no share-alike |
| **Artgrid / Artlist** (the firm's paid subscription) | Clip `bim-assembly` | Commercial use, **no attribution required**. A different license from Pexels: an asset is covered only if it was downloaded while the subscription was active. Record the provenance of any future Artgrid clip here for the same reason. |

The Pexels license still forbids some uses, and they apply here:

- Do not redistribute the files as a stock library of their own.
- Do not use identifiable people or brands in a way that implies endorsement.
  `inspect-*` and `repair-soffit-trowel` show people. They illustrate *an
  inspection* or *a repair*, never a Tercero Tablada employee, and no caption
  names them. Three photographs were **retouched to remove brand marks** so
  that no company rides along with a claim about our work (see the log
  below). The license allows modification. Only the marks were removed;
  nothing about the structure shown was changed.
- The two county-program photographs (`recert-miami-dade`, `bsip-broward`)
  show real buildings that have nothing to do with the firm. They are wide
  views of many buildings so that none is singled out, and **the photograph
  itself is never captioned or alt-described as a particular city or
  building**. Each sits in the section of the county it was taken in (see
  the log), and that is all the page says about it. A named building beside
  a recertification pitch reads as a building with a problem, or as a client.

Nothing on the site requires attribution any more. The legacy Creative
Commons images that did (`projects/project-01…12.jpg`, `hero-bg.jpg`,
`team.jpg`) were no longer shown anywhere and were **deleted on
2026-09-22**, together with their `/credits` rows. `hero-bg.jpg` never had
confirmed provenance.

---

## Where each asset is placed (one placement per asset)

Allocation lives in `src/lib/ttc/site.ts` (`imagery`, `typologies`).
Each photograph is placed at most once. A service's card photo reappearing as
the hero of that service's own page counts as one placement — and for the two
county programs the same photo is also the plate of that program's section on
the home page: one service, one photograph, three doors. A shared section
component rendered on more than one page is one placement too
(SouthFloridaMap on Home and Contact; the EngineerSection plate on the Home
teaser and About) — one slot in `site.ts`, one placement. Adding a placement
means adding a photograph, never reusing one.

Two photographs are **spares with no placement** since 2026-10-04, when the
two doors ("I own or manage an existing building" / "I am building something
new") left the home page: `midrise-balconies` and `frame-crane-sky`. They
stay in the catalogue; delete them if no slot claims them.

"id n/r" = Pexels, but the source id was not recorded at import.

### Photographs — `public/ttc/img/site/`

| File | Key | Placement | Pexels id |
|---|---|---|---|
| concrete-beam-column | concreteBeamColumn | /services hero | 19216762 |
| miami-residential-towers | miamiResidentialTowers | /existing-buildings hero | 8611579 |
| miami-condo-aerial | miamiCondoAerial | /projects hero | 15312055 |
| concrete-stair | concreteStair | /about hero | 2747599 |
| miami-brickell | miamiBrickell | /contact hero | 9768488 |
| concrete-frame-slabs | concreteFrameSlabs | Service: Reinforced Concrete Design | id n/r (commit cdc0ded) |
| analysis-towers-up | analysisTowersUp | Service: Structural Analysis | 9408402 |
| bim-wireframe-model | bimWireframeModel | Service: BIM Coordination | 38289825 |
| **recert-miami-dade** | recertMiamiDade | Service: Miami-Dade Building Recertification — card, service-page hero, Home section 01 (`pos 28% 42%`) *(new 2026-10-04, retouched)* | **12218269** |
| **bsip-broward** | bsipBroward | Service: Broward Building Safety Inspection Program (BSIP) — card, service-page hero, Home section 02 *(new 2026-10-04)* | **18080724** |
| inspect-balcony-pair | inspectBalconyPair | Service: Milestone & Structural Safety Inspections (`pos 50% 30%`) | 8961152 |
| inspect-wall | inspectWall | Service: Condition Assessments (`pos 50% 30%`) | 8961700 |
| peer-tower-bw | peerTowerBw | Service: Peer Review | 15786966 |
| south-florida-aerial | southFloridaAerial | Home + Contact, South Florida section (shared SouthFloridaMap) | 30147234 |
| concrete-ramp | concreteRamp | About engineer plate + Home engineer teaser (shared EngineerSection; shown while `leadership.portrait` is null) | 38539691 |
| frame-under-construction | frameUnderConstruction | Work, engagement 01 | 13094084 |
| midrise-glass-balconies | midriseGlassBalconies | Work, engagement 02 | 11916565 |
| miami-towers-up | miamiTowersUp | Work, engagement 03 | 33664887 |
| rebar-bundles | rebarBundles | Work, engagement 04 | 11891953 |
| frame-slab-edges | frameSlabEdges | Work, engagement 05 | 18411324 |
| rebar-cage-tower | rebarCageTower | Work, engagement 06 | 12709141 |
| house-concrete-garden | houseConcreteGarden | Typology 01, single-family | 13041129 |
| house-townhouses | houseTownhouses | Typology 02, townhouses | 32115995 |
| frame-curved-balconies | frameCurvedBalconies | Typology 03, mid-rise | 15497599 |
| frame-crane-clean | frameCraneClean | Typology 04, mixed-use | 12453934 |
| foundation-mat-pit | foundationMatPit | Typology 05, foundations | 37733181 |
| **repair-soffit-trowel** | repairSoffitTrowel | Typology 06, repairs *(new 2026-09-22, retouched)* | **30580529** |
| **frame-crane-sky** | frameCraneSky | *Spare, no placement since 2026-10-04.* Was Home, "New projects" door *(new 2026-09-22, retouched)* | **38450719** |
| midrise-balconies | midriseBalconies | *Spare, no placement since 2026-10-04.* Was Home, "Existing buildings" door | 27459248 |
| house-modern-levels | houseModernLevels | Work gallery | 323780 |
| concrete-vault | concreteVault | Work gallery | 9039829 |
| house-palm | housePalm | Work gallery | 30211366 |
| rebar-slab-crew | rebarSlabCrew | Work gallery | 11581108 |
| miami-skyline-teal | miamiSkylineTeal | Work gallery | 13356923 |
| frame-golden | frameGolden | Work gallery | 16076663 |
| midrise-clean | midriseClean | Work gallery | 18153132 |
| concrete-stepped-gold | concreteSteppedGold | Work gallery | 28584394 |
| rebar-tying-hands | rebarTyingHands | Work gallery | 36847981 |
| house-dark-brick | houseDarkBrick | Work gallery | 12458357 |
| miami-beach-dusk | miamiBeachDusk | Work gallery | 13356947 |
| house-white-tree | houseWhiteTree | Work gallery | 1974596 |

Pexels photo URL pattern: `https://www.pexels.com/photo/<id>/`.

### Video — `public/ttc/video/`

| File | Key | Placement | Source |
|---|---|---|---|
| hero-miami | heroMiami | Home hero | Pexels video 13846342 (per the 2026-08-16 fetch script) |
| bim-assembly | bimAssembly | Home, new-buildings section (`imagery.clips.bim`; it took the place of the BIM stage on 2026-10-04) | Artgrid, *3d Glowing Transform Sci Fi*, Finn Moeller |

Each clip ships as `<name>.mp4` (1920×1080) + `<name>-poster.jpg`
(1600×900), and as `<name>-mobile.mp4` + `<name>-mobile-poster.jpg` for
phones (see Renditions).

### Brand files — `public/ttc/img/`

The real TT logo masters. **Never redraw them.** The display renditions are
straight resizes of the same files.

| File | Size | Used by |
|---|---|---|
| logo-square.png | 1254×1254 | SaaS auth / error / onboarding pages, JSON-LD `logo` (keep the master here) |
| logo-white.png | 1254×1254 | Email templates (absolute URL; emails already sent still load it) |
| logo-white-wide.png | 2172×827 | Master for the footer lockup |
| logo-horizontal.png | 2172×827 | `company.logo.lockupDark` (unused on the public site) |
| logo-icon.svg / -dark.svg / -favicon.svg | — | SaaS header, favicon, **old emails** (keep `logo-icon.svg`) |
| **logo-square@256.png** | 256×256 | Public header mark on light |
| **logo-white@256.png** | 256×256 | Public header mark on dark, engineer plate |
| **logo-white-wide@640.png** | 640×244 | Public footer lockup |

`docs/brand/logo-stacked.png` is the stacked lockup master. It has no
placement, so it was moved out of `public/` on 2026-09-22 instead of being
deleted. `scripts/make-logos-transparent.py`, a one-off tool from the logo
import, now processes only `logo-horizontal.png` and `logo-square.png`; the
byte-identical `logo-horizontal-wide.png` was deleted (see below).

### Software marks — `public/ttc/img/software/`

Third-party logos (Autodesk, Revit, Navisworks, CYPE, BCF, buildingSMART),
used nominatively to identify the tools in the workflow. They are shown
unmodified apart from a CSS desaturation filter and remain the property of
their owners.

---

## Renditions — how to add a photograph

Every photograph is **six files**. `Img` builds its `srcset` from all of them:

```
<name>.jpg        2000w  mozjpeg q78      <name>.avif      2000w  AVIF q50 effort 4
<name>@md.jpg     1200w  mozjpeg q76      <name>@md.avif   1200w  AVIF q50 effort 4
<name>@sm.jpg      900w  mozjpeg q76      <name>@sm.avif    900w  AVIF q50 effort 4
```

With sharp (use `buildsync-temp/node_modules/sharp`):

```js
const master = `public/ttc/img/site/${name}.jpg`;
await sharp(source).resize({ width: 2000 }).jpeg({ quality: 78, mozjpeg: true }).toFile(master);
await sharp(master).resize({ width: 1200 }).jpeg({ quality: 76, mozjpeg: true }).toFile(`…/${name}@md.jpg`);
await sharp(master).resize({ width: 900 }).jpeg({ quality: 76, mozjpeg: true }).toFile(`…/${name}@sm.jpg`);
for (const [suffix, w] of [['', 2000], ['@md', 1200], ['@sm', 900]])
  await sharp(master).resize({ width: w }).avif({ quality: 50, effort: 4 }).toFile(`…/${name}${suffix}.avif`);
```

Then add `p('<name>', w, h, 'alt', pos?)` to `media.ts` with the master's real
size, and record the source here. Portrait frames shown in wide boxes need a
`pos` focal point. Check the crop in every box the photo lands in.

**Clips.** Desktop file: `-an -c:v libx264 -preset slow -crf 29 -maxrate 2200k
-bufsize 4400k -profile:v high -pix_fmt yuv420p -movflags +faststart`,
1920×1080, 10–12 s, under ~3 MB. Phone file (`-mobile.mp4`, same length and
frame count, no audio, faststart):

- A full-bleed clip (today only the hero): a **608×1080 portrait crop**. The
  hero crop is `crop=608:1080:743:0` of the 1080p file, centered on the phone
  framing the CSS asks for (`object-position: 56% 22%`). A full-bleed clip
  whose slot uses the default position is cropped on the frame center, as
  the retired band clip was. CRF 30–31, maxrate 750–800k.
- The model clip is not full-bleed. It was cut for a 16:9 stage, so its
  phone file is the same frame: `scale=720:-2`, CRF 27, maxrate 800k.

Posters are taken from the same frame as the desktop poster: `-mobile-poster`
is 608×1080 (720×406 for BIM), mozjpeg q74.

---

## Provenance log

Pexels asks for nothing, but a file with no trail is a file nobody can
re-verify. Record the source of anything added from now on.

| Date | File | Source | Replaced / note |
|---|---|---|---|
| 2026-08 | 35 photographs, 34 of them still in the table above | Pexels (ids in the table) | Initial set and the service-card round (`fetch-final.mjs`, `fetch-round2.mjs`). The 35th, recert-balconies-bw, was removed on 2026-10-04. |
| 2026-08-16 | video/hero-miami.mp4 | Pexels video 13846342 | Per the 2026-08-16 `fetch-video.mjs` |
| 2026-08-16 | site/concrete-frame-slabs.jpg | Pexels, id n/r | rebar-cage-up (read as a steel yard) |
| 2026-09-03 | site/frame-crane-clean.jpg | Pexels 12453934 | frame-curved-crane (busy construction shot) |
| 2026-09-03 | site/foundation-mat-pit.jpg | Pexels 37733181 | rebar-mat-workers |
| 2026-09-22 | site/repair-soffit-trowel.jpg | Pexels 30580529 | facade-repair-rope (Pexels 26918635; rope-access painter, read as repainting). **Retouched:** the company name printed on the hard hat was removed (masked, filled from the surrounding helmet); in a follow-up the same day, the printed wordmarks on both black headband straps ("metro" on the right strap, the woven lettering on the left strap and its loose end) were removed the same way, on the full-resolution source, and all six renditions regenerated at unchanged dimensions. |
| 2026-09-22 | site/frame-crane-sky.jpg | Pexels 38450719 (Doğan Alpaslan Demir) | frame-tower-sunlit (Pexels 7459407). It was byte-identical to the gallery's frame-tower, and read as a derelict frame on a dirt lot. **Retouched:** the crane-rental name on the counter-jib panel and a small maker's mark on the machinery house were removed. |
| 2026-09-22 | video/existing-midrise.mp4 | Pexels video 3859468 (Kelly) | Previous clip (Pexels 9432187 per the 2026-08-16 fetch script) showed a legible hotel sign in every frame. New clip: 11 s from 10.4 s into the 2560×1440 source, 0.4 s cross-fade at the loop point. Every frame was checked at full resolution: no names or logos. |
| 2026-09-22 | all `*-mobile.mp4` / `*-mobile-poster.jpg` | Derived from the clips above | Phone renditions, no new footage |
| 2026-09-22 | `@md` + `.avif` renditions of every photo | Derived | 1200w rung and AVIF |
| 2026-10-04 | site/recert-miami-dade.jpg | Pexels 12218269 (Eric Nixon), 4032×3024 — approved and published on Pexels, standard Pexels license | recert-balconies-bw (Pexels 23220600: a derelict facade with broken glass and razor wire). A row of white condominium towers and two office buildings across calm water, seen from a planted waterfront walk. Its Pexels page gives no location; the scene is Brickell Key seen from the Brickell baywalk, in the City of Miami (Miami-Dade County), and the site names neither. **Crop:** 3332×2221 (`left 700, top 330`), which drops a glass tower under a crane and an office block carrying a bank logo at the left edge, and trims sky and foreground planting to 3:2. **Grade:** saturation 0.88. **Retouched:** faint lettering on one office parapet (about 45×12 px at 2000w, unreadable at 100%) was blurred into the surrounding wall on the 2000w master before the renditions were made; nothing else. **Second choice for this slot:** the first, Pexels 4366059 (an aerial by Antonio Cuellar, shipped for a few hours on 2026-10-04 in `0fba786`), was replaced the same night — a soft video-quality still, centred in the 4:5 plate on one hotel complex with an excavator at its foot, and an item Pexels lists as unpublished. Do not reintroduce it. |
| 2026-10-04 | site/bsip-broward.jpg | Pexels 18080724 (Larry Milligan), 6048×4024 | New placement (the Broward BSIP service did not exist). Aerial along a waterway lined with mid-rise and high-rise residential buildings, the ocean beyond. Its Pexels title says Fort Lauderdale and its Pexels description says Hollywood, Florida; both are in Broward County, and the site names neither. **Crop:** 5370×3580 (`left 375, top 250`), which drops the roof parapet the frame was shot over, a sliver of a newer glass tower at the right edge and some empty sky. **Grade:** saturation 0.85, brightness +2%. **Not retouched.** Checked at source resolution (2.7× the master): the sign on posts in the channel, a street sign, the moored yacht, the roof lines and the parked cars carry nothing readable. One cleared lot on the right bank is in the frame. |
| 2026-10-04 | (pair) | — | Both came from about 2,200 Pexels candidates reviewed on contact sheets: midday light, white concrete against water (the Broward frame is an aerial, the Miami-Dade frame is taken from the waterfront). Contact sheets, the inspection crops and `final-pair-preview.jpg` (both photos in the 4:5 plate, 16:10, the 16:9 card and the greyscale service hero) were kept in the session scratchpad under `recert/assets/`, with `gen.cjs`, `retouch.cjs` and `retouch-jobs.json`. |

### Removed 2026-09-22

| File | Why |
|---|---|
| site/frame-tower.jpg (+@sm) | Byte-identical duplicate of frame-tower-sunlit. Its gallery slot went to rebar-tying-hands. |
| site/frame-tower-sunlit.jpg (+@sm) | Replaced by frame-crane-sky |
| site/house-concrete-carport.jpg (+@sm) | CGI house with a European number plate on the car. Its gallery slot went to house-modern-levels. |
| site/facade-repair-rope.jpg (+@sm) | Replaced by repair-soffit-trowel |
| video/crane-sky.* , video/structure-geometry.* | Allocated to `imagery.clips.design` / `.practice`, which no component rendered |
| img/projects/project-01…12.jpg, img/hero-bg.jpg, img/team.jpg | Legacy CC images, shown nowhere. hero-bg had no confirmed provenance. |
| img/logo-tt.svg, img/logo-tt-v2.svg | Hand-drawn TT marks, not the real logo, unreferenced |
| img/logo-horizontal-wide.png | Byte-identical copy of logo-horizontal.png |

### Removed 2026-10-04

| File | Why |
|---|---|
| site/recert-balconies-bw (.jpg, @md.jpg, @sm.jpg, .avif, @md.avif, @sm.avif) | Pexels 23220600. A derelict facade with broken glass and razor wire in its lower third, beside the word "recertification". Replaced by recert-miami-dade. |
| video/existing-midrise.mp4, -poster.jpg, -mobile.mp4, -mobile-poster.jpg | Pexels video 3859468 (Kelly). The home recertification band was removed; the two county-program sections that took its place are photographs, so no second clip loads behind the hero's. Nothing was wrong with the clip itself: every frame had been checked for names and logos. |

### Reviewed and rejected (do not reintroduce)

The deleted CC set is recorded so the decision is not re-litigated:
project-03 (UK industrial shed), -04 (Lebanese villa), -05 (Kampala, dirt
roads), -06 (bridge under snow), -07 (UK car park signage), -08 (Pattaya
rooftops), -10 (Barcelona street), -11 (Hamburg port). Pexels candidates
rejected on 2026-09-22 were 1463917 (the old frame-curved-crane: saturated,
busy site) and 11666822 (shoring props, which read as a blank wall in a 5:4
card). Recurring traps: snow, conifers and pitched Nordic roofs; legible
company names on helmets, cranes and hoardings; European number plates.

Rejected on 2026-10-04 for the two county-program slots: 4366061 and 4366060
(same flight as the chosen Miami-Dade frame, but one distinctive tower stands
dead center in the first, and in the second the facade wordmark that was
retouched out of the chosen frame is larger and close to readable); 9400888
(flat overcast light, a script name readable on a building, construction
fencing in the foreground); 32207987 (a few towers fill the frame, close
enough to be identified, and it is nearer than its pair); 18080725 and
18080723 (new glass towers, one with a monogram sign). Recurring traps in
this subject: building names on parapets and facades; one landmark tower in
an otherwise anonymous row; glossy new glass towers, which are not the stock
these programs reach; and "Florida" searches that return Sarasota, Puerto
Rico, Mexico, Spain or Toronto.
