# Image credits

## How photography is used on this site

Architectural photography appears **as material, atmosphere and typology** —
never captioned, framed or implied to be a Tercero Tablada project. The work
section shows anonymized *representative engagements*, and the "What we design"
section shows *typologies*, precisely so that no stock photograph is ever
mistaken for the firm's portfolio.

Replace these with real Tercero Tablada project photography when it exists:
that removes the attribution obligation below and makes the site genuinely the
firm's own.

---

## `site/` and `video/` — Pexels, no attribution required

The 43 photographs in `public/ttc/img/site/` and the 4 clips in
`public/ttc/video/` are **Pexels-licensed**: free for commercial use,
modification allowed, **no attribution required and no share-alike**. They do
not appear on `/credits`, because nothing is owed — that page exists for the
Creative Commons images listed further down, which genuinely require it.

What the Pexels licence still forbids, and what therefore applies here:

- Do not redistribute them as a stock library of their own.
- Do not use identifiable people or brands in a way that implies endorsement.
  (`inspect-*` show people; they illustrate *an inspection*, never a Tercero
  Tablada employee, and no caption on the site names them.)

**The rule that matters more than the licence:** these illustrate the KIND of
structure described. A photograph of a house under "Single-family residences"
says *this is the sort of building we engineer*, not *we engineered this one*.
The typologies section prints that distinction in its own footnote and the Work
page repeats it under the gallery. Keep both.

Each file is allocated to exactly ONE placement in `src/lib/ttc/site.ts`
(`imagery`, `typologies`, `paths`). Adding a placement means adding a
photograph — never reusing one.

Renditions: every photograph ships as `name.jpg` (2000w) and `name@sm.jpg`
(900w), served through a `srcset`. Clips ship as `name.mp4` plus
`name-poster.jpg`; the poster is what reduced-motion visitors see and what
paints before the clip arrives, so it is art-directed to work alone.

---

## Legacy Creative Commons images — attribution required

The originals below predate the Pexels set. Attribution for these **is**
published at `/credits`, which is what CC BY / CC BY-SA require for this
medium — a page a visitor can reach, not only a file in the repository. Keep
the two in sync.

## In use — one placement each

Only six of the fourteen images clear the bar for this firm. Each is used in
exactly ONE place; repeating a photograph across pages reads as thin, so pages
without an image of their own open on the plain graphite band instead.

Attribution is also published on the site at `/credits`, which is what
CC BY / CC BY-SA actually require for this medium — a page a visitor can reach,
not only a file in the repository. Keep the two in sync.

| File | Where (exactly one) | Author | License |
|------|---------------------|--------|---------|
| hero-bg.jpg | Home hero | unattributed at import | see note |
| projects/project-02.jpg | Home — "Design new structures" | Jonathan Simcoe | CC0 |
| projects/project-01.jpg | Home — "Evaluate existing buildings" | Antti Leppänen | CC BY 4.0 |
| team.jpg | Expertise | PortlandAppraisalBlog | CC BY-SA 4.0 |
| projects/project-09.jpg | Existing Buildings | Wikimedia contributor | CC BY-SA 2.0 |
| projects/project-12.jpg | Work | Dietmar Rabich | CC BY-SA 4.0 |

Source URLs live on `/credits` (`src/app/(public)/credits/page.tsx`).

**Note on `hero-bg.jpg`:** predates the credits table and arrived without
attribution metadata. Confirm its source and licence, or replace it with owned
photography.

**CC BY-SA is share-alike.** These are displayed unmodified (a CSS filter is
not an adaptation), which is fine — but do not composite them into a new
graphic and publish that without checking the licence terms.

## Pages with no photograph

About, Contact, all seven service detail pages and the legal pages open on the
plain graphite band. They are waiting for real Tercero Tablada photography —
adding it to `imagery.pages` (or to a service's `photo`) is all that is needed.

## Reviewed and rejected

Every remaining image was looked at and ruled out for this firm — kept only so
the decision is not re-litigated. Do not reintroduce them as project
photography.

| File | Subject | Why not |
|------|---------|---------|
| projects/project-03.jpg | UK industrial estate | flat, blue metal shed, no structure visible |
| projects/project-04.jpg | Villa in Lebanon | residential, landscaped, reads as an estate agent |
| projects/project-05.jpg | Office block, Kampala | dirt roads, banana plants — wrong region entirely |
| projects/project-06.jpg | Bridge over the Mura | genuinely structural, but under SNOW — not South Florida |
| projects/project-07.jpg | UK multi-storey car park | road signage, one-way markings, dull |
| projects/project-08.jpg | Pattaya rooftops | urban jumble, no subject |
| projects/project-10.jpg | Barcelona street | pedestrians, graffiti, shopfronts |
| projects/project-11.jpg | Hamburg container port | hazy aerial, logistics not buildings |

## Software marks

`software/` holds third-party brand logos (Autodesk, Revit, Navisworks, CYPE,
BCF, buildingSMART). They are used nominatively to identify the tools in the
workflow, shown unmodified apart from a CSS desaturation filter, and remain
the property of their respective owners.
