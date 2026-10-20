import React from 'react';
import type { Lang } from '@/lib/ttc/i18n';
import { Hero } from '@/components/ttc/mp/Hero';
import { ProgramsSection } from '@/components/ttc/mp/ProgramSection';
import { PricingSection, UrgencySection, JurisdictionsSection } from '@/components/ttc/mp/CostSection';
import { NewBuildings } from '@/components/ttc/mp/NewBuildings';
import { PartnerSection } from '@/components/ttc/mp/PartnerSection';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { HomeAddress } from './meta';

/**
 * Home: seven sections, each with one job, each as short as its job allows.
 * Existing buildings come first — the reader with a deadline is the one
 * holding a county notice.
 *
 *   Hero                 what · where · one action · four links into the page
 *   ProgramsSection      the two county programs side by side
 *                        (#miami-dade | #broward)
 *   PricingSection       fixed-fee ranges, both counties in one table
 *   UrgencySection       what waiting can cost
 *   JurisdictionsSection the offices we file with
 *   NewBuildings         the design side, and its four services (#new-buildings)
 *   PartnerSection       two licensed firms, one team
 *   ContactCTA           the action, again
 *
 * The two county columns are one component rendered twice, so their rows
 * line up label for label; each prints only its own county's numbers, taken
 * from that service's timing row in site.ts. The three anchor ids are the
 * targets of the hero strip (`hero.caps`).
 *
 * Not here any more: the engineer (his portrait and account live on /about
 * alone — the owner, 2026-10-20: "not mixed in"), "Engineered for this coast"
 * (the jurisdictions say where, office by office), and the urgency section's
 * second list of what the team does (the county columns say it).
 *
 * Rhythm: dark · paper · paper · graphite · paper · graphite · concrete ·
 * dark close. Every section but one reads `lang` from the URL; PartnerSection
 * is a server component and takes it as a prop.
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
      <ProgramsSection n="01" />
      <PricingSection n="02" />
      <UrgencySection n="03" />
      <JurisdictionsSection n="04" />
      <NewBuildings n="05" />
      <PartnerSection n="06" lang={lang} />
      <ContactCTA n="07" />
    </>
  );
}
