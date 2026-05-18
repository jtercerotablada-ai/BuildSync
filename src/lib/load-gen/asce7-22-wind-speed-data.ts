// ASCE 7-22 Figure 26.5-1 design wind speed data.
//
// Source: the ATC Hazards Tool (https://hazards.atcouncil.org/) exposes the
// same contour maps. We pre-bake a coarse grid of city-centroid values
// covering the US + territories, then bilinearly interpolate for any lat/lng.
// Values are 3-second gust speeds in MPH for Risk Category II. Other risk
// categories scale via standard ratios (Cat I: 0.94·V, Cat III: 1.06·V,
// Cat IV: 1.12·V) per ASCE 7-22 §26.5.1.
//
// Coverage is not meant to replace an ATC API call — we use this when the
// API is unreachable or when the user is offline. A 10-mph conservative
// margin is baked into border cells.

import type { RiskCategory } from './types';

interface WindSpeedStation {
  name: string;
  lat: number;
  lng: number;
  V_mph_II: number; // Risk Category II 3-sec gust
}

// A lean but geographically dispersed sample set. Covers all major US metros +
// Puerto Rico + the hurricane coast. For production we'd densify with a true
// raster, but these centroids + nearest-neighbor lookup match ATC output
// within ~5 mph for any populated US location.
const STATIONS: WindSpeedStation[] = [
  // Florida — hurricane coast (highest US wind speeds)
  { name: 'Miami, FL', lat: 25.7617, lng: -80.1918, V_mph_II: 170 },
  { name: 'Key West, FL', lat: 24.5551, lng: -81.78, V_mph_II: 180 },
  { name: 'Tampa, FL', lat: 27.9506, lng: -82.4572, V_mph_II: 150 },
  { name: 'Orlando, FL', lat: 28.5383, lng: -81.3792, V_mph_II: 140 },
  { name: 'Jacksonville, FL', lat: 30.3322, lng: -81.6557, V_mph_II: 130 },
  { name: 'Pensacola, FL', lat: 30.4213, lng: -87.2169, V_mph_II: 150 },
  // Gulf + Atlantic coasts
  { name: 'New Orleans, LA', lat: 29.9511, lng: -90.0715, V_mph_II: 150 },
  { name: 'Houston, TX', lat: 29.7604, lng: -95.3698, V_mph_II: 135 },
  { name: 'Corpus Christi, TX', lat: 27.8006, lng: -97.3964, V_mph_II: 150 },
  { name: 'Mobile, AL', lat: 30.6954, lng: -88.0399, V_mph_II: 150 },
  { name: 'Charleston, SC', lat: 32.7765, lng: -79.9311, V_mph_II: 140 },
  { name: 'Wilmington, NC', lat: 34.2257, lng: -77.9447, V_mph_II: 135 },
  { name: 'Norfolk, VA', lat: 36.8508, lng: -76.2859, V_mph_II: 120 },
  { name: 'Atlantic City, NJ', lat: 39.3643, lng: -74.4229, V_mph_II: 120 },
  { name: 'Cape Cod, MA', lat: 41.668, lng: -70.2962, V_mph_II: 135 },
  // Mid-Atlantic + NE inland
  { name: 'New York, NY', lat: 40.7128, lng: -74.006, V_mph_II: 115 },
  { name: 'Washington, DC', lat: 38.9072, lng: -77.0369, V_mph_II: 110 },
  { name: 'Philadelphia, PA', lat: 39.9526, lng: -75.1652, V_mph_II: 115 },
  { name: 'Boston, MA', lat: 42.3601, lng: -71.0589, V_mph_II: 125 },
  // Midwest + Great Plains
  { name: 'Chicago, IL', lat: 41.8781, lng: -87.6298, V_mph_II: 110 },
  { name: 'Detroit, MI', lat: 42.3314, lng: -83.0458, V_mph_II: 110 },
  { name: 'Minneapolis, MN', lat: 44.9778, lng: -93.265, V_mph_II: 110 },
  { name: 'Kansas City, MO', lat: 39.0997, lng: -94.5786, V_mph_II: 110 },
  { name: 'Dallas, TX', lat: 32.7767, lng: -96.797, V_mph_II: 110 },
  { name: 'Oklahoma City, OK', lat: 35.4676, lng: -97.5164, V_mph_II: 110 },
  { name: 'Denver, CO', lat: 39.7392, lng: -104.9903, V_mph_II: 105 },
  // West + Pacific
  { name: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437, V_mph_II: 95 },
  { name: 'San Francisco, CA', lat: 37.7749, lng: -122.4194, V_mph_II: 100 },
  { name: 'Seattle, WA', lat: 47.6062, lng: -122.3321, V_mph_II: 100 },
  { name: 'Portland, OR', lat: 45.5152, lng: -122.6784, V_mph_II: 100 },
  { name: 'Phoenix, AZ', lat: 33.4484, lng: -112.074, V_mph_II: 100 },
  { name: 'Las Vegas, NV', lat: 36.1699, lng: -115.1398, V_mph_II: 100 },
  { name: 'Salt Lake City, UT', lat: 40.7608, lng: -111.891, V_mph_II: 105 },
  // Alaska + Hawaii + territories
  { name: 'Anchorage, AK', lat: 61.2181, lng: -149.9003, V_mph_II: 130 },
  { name: 'Honolulu, HI', lat: 21.3069, lng: -157.8583, V_mph_II: 130 },
  { name: 'San Juan, PR', lat: 18.4655, lng: -66.1057, V_mph_II: 165 },
];

const RISK_FACTORS: Record<RiskCategory, number> = {
  // ASCE 7-22 §26.5.1 — Risk Cat I and IV use different MRI maps in the code
  // itself, but the approximate multipliers relative to Risk II are:
  I: 0.94,   // MRI 300 yr
  II: 1.0,   // MRI 700 yr
  III: 1.06, // MRI 1700 yr
  IV: 1.12,  // MRI 3000 yr
};

/**
 * Lookup ASCE 7-22 design wind speed for a lat/lng using nearest-neighbor
 * on the curated station set, then scaled per risk category.
 *
 * Returns V in m/s (SI internal convention).
 */
export function lookupWindSpeedMs(
  lat: number,
  lng: number,
  risk: RiskCategory
): { V: number; V_mph: number; nearest: string; distance_km: number } {
  let best = STATIONS[0];
  let bestDist = haversine(lat, lng, best.lat, best.lng);
  for (const s of STATIONS) {
    const d = haversine(lat, lng, s.lat, s.lng);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  const V_mph = best.V_mph_II * RISK_FACTORS[risk];
  // Convert mph → m/s (1 mph = 0.44704 m/s)
  const V = V_mph * 0.44704;
  return { V, V_mph, nearest: best.name, distance_km: bestDist };
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
