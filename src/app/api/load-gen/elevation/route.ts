import { NextResponse } from 'next/server';

// Free elevation lookup via Open-Elevation (https://open-elevation.com/).
// Returns elevation in meters above sea level. If the service is down, we
// degrade gracefully to elevation = 0 so the rest of the tool still works.

export async function POST(req: Request) {
  const { lat, lng } = await req.json().catch(() => ({}));
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
  }

  try {
    const r = await fetch(
      `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`,
      {
        headers: {
          'User-Agent': 'ttcivilstructural.com Load Generator',
        },
        cache: 'no-store',
      }
    );
    if (!r.ok) {
      return NextResponse.json({ elevation_m: 0, source: 'fallback' });
    }
    const data = (await r.json()) as {
      results?: Array<{ elevation: number }>;
    };
    const e = data.results?.[0]?.elevation;
    if (typeof e !== 'number') {
      return NextResponse.json({ elevation_m: 0, source: 'fallback' });
    }
    return NextResponse.json({ elevation_m: e, source: 'open-elevation' });
  } catch {
    return NextResponse.json({ elevation_m: 0, source: 'fallback' });
  }
}
