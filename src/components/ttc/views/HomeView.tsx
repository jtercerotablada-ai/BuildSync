import React from 'react';
import type { Lang } from '@/lib/ttc/i18n';
import { Hero } from '@/components/ttc/mp/Hero';
import { TwoPaths } from '@/components/ttc/mp/TwoPaths';
import { Typologies } from '@/components/ttc/mp/Typologies';
import { RecertBand } from '@/components/ttc/mp/RecertBand';
import { EngineerSection } from '@/components/ttc/mp/EngineerSection';
import { HowWeWork } from '@/components/ttc/mp/HowWeWork';
import { BIMExperience } from '@/components/ttc/mp/BIMExperience';
import { SouthFloridaMap } from '@/components/ttc/mp/SouthFloridaMap';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';

/**
 * Home: nine sections, each with one job.
 *
 *   Hero            what · where · who · one action
 *   TwoPaths        which client am I, and which door do I take
 *   Typologies      do you do my kind of building
 *   RecertBand      the clocks on existing buildings, per jurisdiction
 *   EngineerSection who is responsible
 *   HowWeWork       what happens after I write
 *   BIMExperience   how the design side is coordinated
 *   SouthFloridaMap where, exactly
 *   ContactCTA      the action, again
 *
 * Rhythm: dark · light · concrete · dark video · light · concrete · dark ·
 * light · dark close. `lang` is read by every section from the URL; the prop
 * exists so the two route files are explicit about what they render.
 */
export function HomeView({ lang }: { lang: Lang }) {
  void lang;
  return (
    <>
      <Hero />
      <TwoPaths n="01" />
      <Typologies n="02" />
      <RecertBand />
      <EngineerSection n="03" variant="teaser" />
      <HowWeWork n="04" />
      <BIMExperience n="05" />
      <SouthFloridaMap n="06" />
      <ContactCTA n="07" />
    </>
  );
}
