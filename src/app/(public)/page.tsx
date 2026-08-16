import React from 'react';
import type { Metadata } from 'next';
import { imagery } from '@/lib/ttc/site';
import { Hero } from '@/components/ttc/mp/Hero';
import { StatementSection } from '@/components/ttc/mp/StatementSection';
import { TwoPaths } from '@/components/ttc/mp/TwoPaths';
import { Typologies } from '@/components/ttc/mp/Typologies';
import { CoreExpertise } from '@/components/ttc/mp/CoreExpertise';
import { VideoBand } from '@/components/ttc/mp/VideoBand';
import { BIMExperience } from '@/components/ttc/mp/BIMExperience';
import { SoftwareBand } from '@/components/ttc/mp/SoftwareBand';
import { SelectedExperience } from '@/components/ttc/mp/SelectedExperience';
import { ProcessTimeline } from '@/components/ttc/mp/ProcessTimeline';
import { EngineeringProcess } from '@/components/ttc/mp/EngineeringProcess';
import { CredentialsBar } from '@/components/ttc/mp/CredentialsBar';
import { LeadershipProfile } from '@/components/ttc/mp/LeadershipProfile';
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
 * The page alternates light body sections with dark bands, and the two video
 * bands are the loudest things on it — one per half of the practice, placed so
 * they never touch. Adding a third would turn a considered rhythm into a
 * slideshow; if a section needs emphasis, give it a photograph instead.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <StatementSection />
      <TwoPaths />
      <Typologies n="03" />
      <CoreExpertise n="04" />
      <VideoBand
        n="05"
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
          { k: 'Governing codes', v: 'ACI 318 · ASCE 7 · FBC' },
          { k: 'Issued as', v: 'Permit-ready drawing set' },
        ]}
        cta={{ href: '/services', label: 'Design services' }}
        clip={imagery.clips.design}
      />
      <BIMExperience n="06" />
      <SoftwareBand n="07" />
      <VideoBand
        n="08"
        eyebrow="Existing buildings"
        titleLines={[
          'Thousands of buildings.',
          <React.Fragment key="l2">
            One <span className="mp-serif">deadline</span> each.
          </React.Fragment>,
        ]}
        plainTitle="Thousands of buildings. One deadline each."
        body="South Florida's recertification requirements reach most buildings once they pass a set age — and then return every ten years, for the life of the structure. We run it end to end — inspection, findings, repair scope, reinspection, submission."
        facts={[
          { k: 'Service area', v: 'Miami-Dade & Broward' },
          { k: 'Runs from', v: 'County notice to submission' },
        ]}
        cta={{ href: '/existing-buildings', label: 'Existing-building services' }}
        clip={imagery.clips.existing}
        align="right"
      />
      <SelectedExperience n="09" limit={6} />
      <ProcessTimeline n="10" />
      <EngineeringProcess n="11" />
      <CredentialsBar n="12" />
      <LeadershipProfile n="13" />
      <SouthFloridaMap n="14" />
      <ContactCTA n="15" />
    </>
  );
}
