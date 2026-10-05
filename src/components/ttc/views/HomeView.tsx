import React from 'react';
import type { Lang } from '@/lib/ttc/i18n';
import { Hero } from '@/components/ttc/mp/Hero';
import { ProgramSection } from '@/components/ttc/mp/ProgramSection';
import { NewBuildings } from '@/components/ttc/mp/NewBuildings';
import { EngineerSection } from '@/components/ttc/mp/EngineerSection';
import { SouthFloridaMap } from '@/components/ttc/mp/SouthFloridaMap';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';

/**
 * Home: seven sections, each with one job. Existing buildings come first —
 * the reader with a deadline is the one holding a county notice — and each
 * county has its own section, because Miami-Dade and Broward run different
 * programs on different clocks.
 *
 *   Hero             what · where · one action · four links into the page
 *   ProgramSection   Miami-Dade: building recertification      (#miami-dade)
 *   ProgramSection   Broward: Building Safety Inspection Program  (#broward)
 *   NewBuildings     the design side, and its four services (#new-buildings)
 *   EngineerSection  who is responsible
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
 * Rhythm: dark · paper · concrete · graphite · paper · paper · dark close.
 * The two paper sections in a row are told apart by the same-surface
 * hairline in mp.css (01). `lang` is read by every section from the URL; the
 * prop exists so the two route files are explicit about what they render.
 */
export function HomeView({ lang }: { lang: Lang }) {
  void lang;
  return (
    <>
      <Hero />
      <ProgramSection slug="building-recertification" n="01" surface="paper" />
      <ProgramSection slug="broward-bsip" n="02" surface="concrete" mirrored />
      <NewBuildings n="03" />
      <EngineerSection n="04" variant="teaser" />
      <SouthFloridaMap n="05" />
      <ContactCTA n="06" />
    </>
  );
}
