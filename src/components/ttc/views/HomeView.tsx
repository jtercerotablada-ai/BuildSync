import React from 'react';
import type { Lang } from '@/lib/ttc/i18n';
import { Hero } from '@/components/ttc/mp/Hero';
import { ProgramSection } from '@/components/ttc/mp/ProgramSection';
import { NewBuildings } from '@/components/ttc/mp/NewBuildings';
import { EngineerSection } from '@/components/ttc/mp/EngineerSection';
import { PartnerSection } from '@/components/ttc/mp/PartnerSection';
import { SouthFloridaMap } from '@/components/ttc/mp/SouthFloridaMap';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { HomeAddress } from './meta';

/**
 * Home: eight sections, each with one job. Existing buildings come first —
 * the reader with a deadline is the one holding a county notice — and each
 * county has its own section, because Miami-Dade and Broward run different
 * programs on different clocks.
 *
 *   Hero             what · where · one action · four links into the page
 *   ProgramSection   Miami-Dade: building recertification      (#miami-dade)
 *   ProgramSection   Broward: Building Safety Inspection Program  (#broward)
 *   NewBuildings     the design side, and its four services (#new-buildings)
 *   EngineerSection  who is responsible
 *   PartnerSection   who we work with — two licensed firms, one team
 *   SouthFloridaMap  where, exactly
 *   ContactCTA       the action, again
 *
 * The two program sections are ONE component rendered twice, so their rows
 * line up label for label; each prints only its own county's numbers, taken
 * from that service's timing row in site.ts. The three anchor ids are the
 * targets of the hero strip (`hero.caps`).
 *
 * Not here any more: the two client doors and the recertification video band
 * (deleted), the typology grid and the five-step process (both on /services).
 *
 * Rhythm: dark · paper · concrete · graphite · paper · concrete · paper ·
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
      <ProgramSection slug="building-recertification" n="01" surface="paper" />
      <ProgramSection slug="broward-bsip" n="02" surface="concrete" mirrored />
      <NewBuildings n="03" />
      <EngineerSection n="04" variant="teaser" />
      <PartnerSection n="05" lang={lang} />
      <SouthFloridaMap n="06" />
      <ContactCTA n="07" />
    </>
  );
}
