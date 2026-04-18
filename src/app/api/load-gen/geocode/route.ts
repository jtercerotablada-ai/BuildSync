import { NextResponse } from 'next/server';

// Free address → lat/lng via OpenStreetMap Nominatim. Usage policy requires:
//   • An identifying User-Agent string (we use our domain)
//   • Max 1 request/sec/IP (we don't enforce here — for heavy traffic we'd
//     add a simple server-side rate limiter or caching)
// Docs: https://nominatim.org/release-docs/latest/api/Search/

export async function POST(req: Request) {
  const { address } = await req.json().catch(() => ({ address: '' }));
  if (!address || typeof address !== 'string' || address.trim().length < 3) {
    return NextResponse.json({ error: 'address required' }, { status: 400 });
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', address);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');

  try {
    const r = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'ttcivilstructural.com Load Generator (contact: info@ttcivilstructural.com)',
        'Accept-Language': 'en',
      },
      cache: 'no-store',
    });
    if (!r.ok) {
      return NextResponse.json(
        { error: `nominatim ${r.status}` },
        { status: 502 }
      );
    }
    const data = (await r.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    if (!data?.length) {
      return NextResponse.json({ error: 'no results' }, { status: 404 });
    }
    const hit = data[0];
    return NextResponse.json({
      lat: parseFloat(hit.lat),
      lng: parseFloat(hit.lon),
      formattedAddress: hit.display_name,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'geocode failed' },
      { status: 502 }
    );
  }
}
