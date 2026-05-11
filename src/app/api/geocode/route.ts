import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-utils";

/**
 * Geocode a free-form location string to { lat, lng, displayName }
 * via OpenStreetMap's Nominatim API. Same approach already used by
 * the public /load-gen tool — free, no API key, fair-use rate-limited.
 *
 * Usage: GET /api/geocode?q=Miami,+FL
 *
 * We proxy the request through our own server (instead of calling
 * Nominatim from the browser directly) so:
 *   - the User-Agent header can identify the app (Nominatim requires it)
 *   - we can add caching / rate limiting later if needed
 *   - the request is authed; this isn't exposed to anonymous traffic
 */
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ error: "Query too short" }, { status: 400 });
    }

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "0");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "BuildSync/1.0 (https://ttcivilstructural.com)",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Geocoding service returned ${res.status}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    if (data.length === 0) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    const top = data[0];
    return NextResponse.json({
      found: true,
      lat: parseFloat(top.lat),
      lng: parseFloat(top.lon),
      displayName: top.display_name,
    });
  } catch (error) {
    console.error("Error in /api/geocode:", error);
    return NextResponse.json({ error: "Geocode failed" }, { status: 500 });
  }
}
