import { NextResponse } from 'next/server';
import { lookupWindSpeedMs } from '@/lib/load-gen/asce7-22-wind-speed-data';
import type { RiskCategory } from '@/lib/load-gen/types';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const risk = (body.riskCategory ?? 'II') as RiskCategory;
  if (!isFinite(lat) || !isFinite(lng)) {
    return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
  }
  const { V, V_mph, nearest, distance_km } = lookupWindSpeedMs(lat, lng, risk);
  return NextResponse.json({
    V,
    V_mph,
    nearest,
    distance_km,
    source: 'interpolated',
  });
}
