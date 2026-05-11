'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

import { CommandBar } from '@/components/cockpit/CommandBar';
import { HeroMap } from '@/components/cockpit/HeroMap';
import { KpiStack } from '@/components/cockpit/KpiStack';
import { PipelineStrip } from '@/components/cockpit/PipelineStrip';
import { QuadrantGrid } from '@/components/cockpit/QuadrantGrid';
import { ActivityStream } from '@/components/cockpit/ActivityStream';
import type { CockpitData } from '@/components/cockpit/types';

import '@/components/cockpit/cockpit.css';

/**
 * CEO Cockpit — opinionated home for the firm's owner.
 * Single-page command center: map + KPIs + pipeline + 4 quadrants + activity.
 * Differentiated from Asana by being engineering-firm-shaped:
 *  - 4 project types × 5 lifecycle gates
 *  - geographic map at center
 *  - compliance watch panel (recerts + permits)
 *  - P.E. sign queue (waiting on the owner's seal)
 */
export default function HomePage() {
  const { data: session } = useSession();
  const [data, setData] = useState<CockpitData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    (async () => {
      try {
        const res = await fetch('/api/dashboard/ceo', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as CockpitData;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unknown error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="cockpit">
        <div className="cockpit-error">
          <h2>Couldn&rsquo;t load the cockpit</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="cockpit">
        <div className="cockpit-loading">Loading cockpit…</div>
      </div>
    );
  }

  const overdueCount = data.criticalPath.filter(
    (t) => new Date(t.dueDate).getTime() < Date.now()
  ).length;
  const expiringCompliance = data.compliance.filter((p) => {
    if (!p.endDate) return false;
    const days = (new Date(p.endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    return days <= 14;
  }).length;

  return (
    <div className="cockpit">
      <CommandBar
        userName={session?.user?.name}
        alerts={{
          overdueCount,
          pendingSignatures: data.kpis.pendingSignatures,
          expiringCompliance,
        }}
      />

      <section className="cockpit-hero">
        <HeroMap projects={data.projects} />
        <KpiStack data={data} />
      </section>

      <PipelineStrip projects={data.projects} />

      <QuadrantGrid data={data} />

      <ActivityStream items={data.activity} />
    </div>
  );
}
