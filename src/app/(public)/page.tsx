import type { Metadata } from 'next';
import { Hero } from '@/components/ttc/mp/Hero';
import { StatementSection } from '@/components/ttc/mp/StatementSection';
import { TwoPaths } from '@/components/ttc/mp/TwoPaths';
import { CoreExpertise } from '@/components/ttc/mp/CoreExpertise';
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

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatementSection />
      <TwoPaths />
      <CoreExpertise />
      <BIMExperience />
      <SoftwareBand n="05" />
      <SelectedExperience n="06" limit={6} />
      <ProcessTimeline n="07" />
      <EngineeringProcess n="08" />
      <CredentialsBar n="09" />
      <LeadershipProfile n="10" />
      <SouthFloridaMap n="11" />
      <ContactCTA n="12" />
    </>
  );
}
