import React from 'react';
import type { Lang } from '@/lib/ttc/i18n';
import { Hero } from '@/components/ttc/mp/Hero';
import { ProgramsSection } from '@/components/ttc/mp/ProgramSection';
import { PricingSection, JurisdictionsSection } from '@/components/ttc/mp/CostSection';
import { NewBuildings } from '@/components/ttc/mp/NewBuildings';
import { PartnerSection } from '@/components/ttc/mp/PartnerSection';
import { Ribbon } from '@/components/ttc/mp/Ribbon';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { HomeAddress } from './meta';

/**
 * Home: seven sections, each with one job, each as short as its job allows.
 * Existing buildings come first — the reader with a deadline is the one
 * holding a county notice.
 *
 *   Hero                 what · where · one action · four links into the page
 *   Ribbon               two moving rows: the buildings, the services
 *   ProgramsSection      the two county programs side by side, each opening
 *                        with what waiting costs (#miami-dade | #broward)
 *   PricingSection       fixed-fee ranges, both counties in one table
 *   JurisdictionsSection the offices we file with
 *   NewBuildings         the design side, and its four services (#new-buildings)
 *   PartnerSection       two licensed firms, one team
 *   ContactCTA           the action, again
 *
 * The two county columns are one column component rendered once per county,
 * so their rows line up label for label; each prints only its own county's
 * numbers, taken from that service's timing row in site.ts. Under 1024px a
 * switch shows one county at a time. The three anchor ids are the targets
 * of the hero strip (`hero.caps`).
 *
 * Not here any more: the engineer (his portrait and account live on /about
 * alone — the owner, 2026-10-20: "not mixed in"), "Engineered for this coast"
 * (the jurisdictions say where, office by office), and the "What waiting can
 * cost" section (the owner, 2026-10-20: said up front, in each county's
 * column, instead).
 *
 * Rhythm: dark · paper · concrete · paper · graphite · concrete · dark
 * close. Every section but one reads `lang` from the URL; PartnerSection is
 * a server component and takes it as a prop.
 *
 * Before the sections: HomeAddress, which draws nothing. It is the page's
 * canonical, hreflang and og:url, printed here because Next's metadata
 * cannot print the home page's address with its trailing slash (meta.tsx).
 */
export function HomeView({ lang }: { lang: Lang }) {
  return (
    <>
      <HomeAddress lang={lang} />
      <Hero />
      <Ribbon lang={lang} />
      <ProgramsSection n="01" />
      <PricingSection n="02" surface="concrete" />
      <JurisdictionsSection n="03" />
      <NewBuildings n="04" />
      <PartnerSection n="05" lang={lang} />
      <ContactCTA />
    </>
  );
}
