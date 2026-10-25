import React from 'react';
import type { Lang } from '@/lib/ttc/i18n';
import { HomeBim } from '@/components/ttc/mp/home/HomeBim';
import { HomeContact } from '@/components/ttc/mp/home/HomeContact';
import { HomeCredentials } from '@/components/ttc/mp/home/HomeCredentials';
import { HomeHero } from '@/components/ttc/mp/home/HomeHero';
import { HomeRibbon } from '@/components/ttc/mp/home/HomeRibbon';
import { HomeServices } from '@/components/ttc/mp/home/HomeServices';
import { HomeStack } from '@/components/ttc/mp/home/HomeStack';
import { HomeStatement } from '@/components/ttc/mp/home/HomeStatement';
import { HomeTools } from '@/components/ttc/mp/home/HomeTools';
import { HomeTypes } from '@/components/ttc/mp/home/HomeTypes';
import { HomeWhere } from '@/components/ttc/mp/home/HomeWhere';
import { Parallax } from '@/components/ttc/mp/home/Parallax';
import '@/app/(public)/home.css';
import '@/app/(public)/home-lower.css';
import '@/app/(public)/home-motion.css';
import { HomeAddress } from './meta';

/**
 * The home page: a PRESENTATION OF THE FIRM, in black, white and gold, in the
 * spirit of a large structural firm's own site. It is not about recertification
 * (the owner, 2026-10-24): Miami-Dade Building Recertification and Broward
 * BSIP are two of EIGHT service names, at the same size and weight as the
 * rest. The build specification is `home-concepts/SPEC.md`; the words are
 * `home` in site.ts and site.es.ts; the guards are views/home.test.ts.
 *
 *   HomeAddress   canonical, hreflang and og:url (draws nothing, meta.tsx)
 *   HomeHero      what, where, the credential words, one action; the film
 *   HomeRibbon    the eight services and the building types, as moving type
 *   HomeServices  the eight services, a photograph and one line each
 *   HomeStatement hurricane wind, high water, decades of salt air
 *   HomeBim       the structural model, the one thing a camera cannot show
 *   HomeTypes     the kinds of building, a rail of illustrative photographs
 *   HomeStack     one photographic pause, then the plates that slide over it:
 *     HomeCredentials  the licenses, the registration, the contractor's card
 *     HomeWhere        the offices the firm files with (the one snow plate)
 *   HomeTools     the free calculators and the guides
 *   HomeContact   "Get in touch." with the real form
 *
 * EVERY SECTION IS A SERVER COMPONENT taking `{ lang }` and reading its words
 * with `getContent(lang)`: the copy of the page is in the HTML and none of it
 * is shipped to the browser as data (the old `useContent()` pattern put both
 * languages' whole copy in the script). The client pieces are the islands
 * inside them: the film, the pause switches, the reveals, the form, and — in
 * the motion slice — the ribbon, the rail and the parallax.
 *
 * ONE ROOT, TWO LANGUAGES. `.mp-home[data-lang]` carries the language so
 * home.css can size a headline per locale (the Spanish hero is three lines of
 * the same shape as the English one, at a smaller size). `/es` renders this
 * same view with `lang="es"`.
 *
 * The page has one `<h1>` (the hero's) and every other section an `<h2>`;
 * cards, credential cards and tool rows are not headings (20 headings, under
 * the owner's ceiling of 23).
 *
 * Styles: home.css (tokens, the hero, the ribbon, the services, the statement,
 * the BIM block), home-lower.css (the rest) and home-motion.css (everything
 * that moves: the reveals, the ribbon, the rail, the slide-over stack, the
 * header's drop-in and progress line), in that order, all imported here so
 * the home is the only route that loads them; mp.css is untouched.
 *
 * MOTION. The reveals are `Reveal fx=…` (primitives.tsx) on the sections'
 * elements; the islands are `RibbonRows` (in HomeRibbon), `TypesRail` (in
 * HomeTypes) and `Parallax` (here, once). Everything else that moves is CSS.
 */
export function HomeView({ lang }: { lang: Lang }) {
  return (
    <div className="mp-home" data-lang={lang}>
      <HomeAddress lang={lang} />
      <Parallax />
      <HomeHero lang={lang} />
      <HomeRibbon lang={lang} />
      <HomeServices lang={lang} />
      <HomeStatement lang={lang} />
      <HomeBim lang={lang} />
      <HomeTypes lang={lang} />
      <HomeStack lang={lang}>
        <HomeCredentials lang={lang} />
        <HomeWhere lang={lang} />
      </HomeStack>
      <HomeTools lang={lang} />
      <HomeContact lang={lang} />
    </div>
  );
}
