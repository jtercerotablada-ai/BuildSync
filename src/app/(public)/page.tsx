import React from 'react';
import type { Metadata } from 'next';
import { imagery } from '@/lib/ttc/site';
import { Hero } from '@/components/ttc/mp/Hero';
import { TwoPaths } from '@/components/ttc/mp/TwoPaths';
import { Typologies } from '@/components/ttc/mp/Typologies';
import { VideoBand } from '@/components/ttc/mp/VideoBand';
import { BIMExperience } from '@/components/ttc/mp/BIMExperience';
import { SoftwareBand } from '@/components/ttc/mp/SoftwareBand';
import { EngineeringProcess } from '@/components/ttc/mp/EngineeringProcess';
import { SouthFloridaMap } from '@/components/ttc/mp/SouthFloridaMap';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';

export const metadata: Metadata = {
  title:
    'Tercero Tablada Civil & Structural Engineering Inc. | South Florida',
  description:
    'Structural engineering for South Florida — reinforced-concrete design, building recertification, building safety inspections and BIM coordination for new and existing buildings across Miami-Dade and Broward.',
  alternates: { canonical: '/' },
  openGraph: {
    title:
      'Engineering structures that endure | Tercero Tablada Civil & Structural Engineering Inc.',
    description:
      'Reinforced-concrete design, building recertification, safety inspections and BIM coordination for projects across South Florida.',
    url: '/',
    type: 'website',
  },
};

/**
 * The home page is deliberately short: one idea per section, and each section
 * is either a headline with a photograph or a single moving image with a few
 * lines of copy. Everything that explains — service scopes, process detail,
 * standards, the practice record — lives on the page that owns it and is one
 * click away. Adding a section here should feel expensive.
 *
 * Rhythm: light · light · dark video · dark · light strip · dark video · light
 * · light · dark close. The two video bands never touch.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <TwoPaths />
      <Typologies n="02" />
      <VideoBand
        eyebrow="New structures"
        titleLines={[
          'Engineered before',
          <React.Fragment key="l2">
            it is <span className="mp-serif">poured.</span>
          </React.Fragment>,
        ]}
        plainTitle="Engineered before it is poured"
        body="Every load path is resolved, checked and detailed on paper first — because a column that cannot be reinforced, or a transfer beam discovered in the field, is the most expensive kind of late."
        facts={[
          { k: 'Scope', v: 'Foundations · frame · lateral system' },
          { k: 'Issued as', v: 'Permit-ready drawing set' },
        ]}
        cta={{ href: '/services', label: 'Design services' }}
        clip={imagery.clips.design}
      />
      <BIMExperience n="03" />
      <SoftwareBand n="04" />
      <VideoBand
        eyebrow="Existing buildings"
        titleLines={[
          'Thousands of buildings.',
          <React.Fragment key="l2">
            One <span className="mp-serif">deadline</span> each.
          </React.Fragment>,
        ]}
        plainTitle="Thousands of buildings. One deadline each."
        body="South Florida's recertification requirements reach most buildings at 30 years — 25 on the coast — and then return every ten years, for the life of the structure. We run it end to end: inspection, findings, repair scope, reinspection, submission."
        facts={[
          { k: 'First due at', v: '30 years · 25 coastal' },
          { k: 'Then', v: 'Every 10 years' },
        ]}
        cta={{ href: '/existing-buildings', label: 'Existing-building services' }}
        clip={imagery.clips.existing}
        align="right"
      />
      <EngineeringProcess n="05" />
      <SouthFloridaMap n="06" />
      <ContactCTA n="07" />
    </>
  );
}
