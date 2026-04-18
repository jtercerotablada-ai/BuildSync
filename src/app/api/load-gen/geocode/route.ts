import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { address } = await req.json().catch(() => ({ address: '' }));
  if (!address || typeof address !== 'string' || address.trim().length < 3) {
    return NextResponse.json({ error: 'address required' }, { status: 400 });
  }
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'GOOGLE_MAPS_SERVER_KEY not configured' },
      { status: 503 }
    );
  }
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('key', key);
  const r = await fetch(url.toString(), { cache: 'no-store' });
  const data = await r.json();
  if (data.status !== 'OK' || !data.results?.length) {
    return NextResponse.json(
      { error: data.error_message || data.status || 'no results' },
      { status: 404 }
    );
  }
  const first = data.results[0];
  return NextResponse.json({
    lat: first.geometry.location.lat,
    lng: first.geometry.location.lng,
    formattedAddress: first.formatted_address,
  });
}
