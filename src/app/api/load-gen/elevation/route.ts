import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { lat, lng } = await req.json().catch(() => ({}));
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
  }
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) {
    // graceful degradation — return 0 m elevation so the tool still works
    return NextResponse.json({ elevation_m: 0, source: 'default' });
  }
  const url = new URL('https://maps.googleapis.com/maps/api/elevation/json');
  url.searchParams.set('locations', `${lat},${lng}`);
  url.searchParams.set('key', key);
  const r = await fetch(url.toString(), { cache: 'no-store' });
  const data = await r.json();
  if (data.status !== 'OK' || !data.results?.length) {
    return NextResponse.json({ elevation_m: 0, source: 'default', error: data.status });
  }
  return NextResponse.json({
    elevation_m: data.results[0].elevation,
    source: 'google',
  });
}
