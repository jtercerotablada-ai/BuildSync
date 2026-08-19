import { NextResponse } from 'next/server';
import type { RiskCategory, SiteClass } from '@/lib/load-gen/types';

// USGS Seismic Design Web Service — ASCE 7-22 dataset.  Returns the design
// spectral accelerations (SDS/SD1) for the site class directly, which is how
// ASCE 7-22 works (the Fa/Fv tables were removed; site effects are embedded
// in the USGS multi-period spectra).
//
// NOTE: the legacy /ws/designmaps/asce7-22.json endpoint now 301-redirects to
// an http:// URL that resets — call the new canonical endpoint directly.
// CloudFront also resets bare clients: send a browser-like User-Agent and retry.
const USGS_URL = 'https://earthquake.usgs.gov/ws/building-codes/asce7-22/calculate';
const UA = 'Mozilla/5.0 (compatible; TTC-LoadGen/1.0; +https://ttcivilstructural.com)';

const VALID_SITE: Record<string, string> = {
  A: 'A', B: 'B', BC: 'BC', C: 'C', CD: 'CD', D: 'D', DE: 'DE', E: 'E', Default: 'DEFAULT',
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const risk = (body.riskCategory ?? 'II') as RiskCategory;
  const siteClass = (body.siteClass ?? 'Default') as SiteClass;

  if (!isFinite(lat) || !isFinite(lng)) {
    return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
  }
  if (siteClass === 'F') {
    return NextResponse.json(
      { error: 'Site Class F requires a site-specific ground-motion analysis (§11.4.8) — USGS mapped values do not apply.' },
      { status: 422 }
    );
  }
  const usgsSite = VALID_SITE[siteClass] ?? 'DEFAULT';
  const url = `${USGS_URL}?latitude=${lat}&longitude=${lng}&riskCategory=${risk}&siteClass=${usgsSite}&title=TTC-LoadGen`;

  let json: unknown = null;
  let lastErr = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': UA },
        next: { revalidate: 86400 },
      });
      if (res.ok) { json = await res.json(); break; }
      lastErr = `USGS service returned ${res.status}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : 'network error';
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  if (json === null) {
    return NextResponse.json({ error: `USGS service unreachable (${lastErr})` }, { status: 502 });
  }

  // Exact field names verified against the live service (all lowercase; PGA is 'pgam').
  const data = (json as { response?: { data?: Record<string, unknown> } })?.response?.data ?? {};
  const num = (...keys: string[]): number | null => {
    for (const k of keys) {
      const v = data[k];
      if (typeof v === 'number' && isFinite(v)) return v;
    }
    return null;
  };

  const sds = num('sds');
  const sd1 = num('sd1');
  if (sds === null || sd1 === null) {
    return NextResponse.json(
      { error: 'USGS response missing SDS/SD1 (site may require site-specific analysis at this location/class).' },
      { status: 422 }
    );
  }

  return NextResponse.json({
    sds,
    sd1,
    s1: num('s1'),
    ss: num('ss'),
    sms: num('sms'),
    sm1: num('sm1'),
    tl: num('tl'),
    ts: num('ts'),
    pga: num('pgam'),
    sdc: typeof data['sdc'] === 'string' ? data['sdc'] : null,
    source: 'USGS',
    attribution: 'U.S. Geological Survey Seismic Design Web Services',
  });
}
