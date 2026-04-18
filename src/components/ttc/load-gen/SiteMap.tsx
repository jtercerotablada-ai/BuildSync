'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { LocationData } from '@/lib/load-gen/types';

interface Props {
  location: LocationData | null;
}

/**
 * Lightweight Google Maps embed (or graceful fallback panel).
 * Loads the Maps JavaScript API only when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is
 * present in the environment. If the key is missing, shows a "map coming
 * soon" placeholder and the tool still works via the address text input.
 */
export function SiteMap({ location }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey) return;
    if (typeof window === 'undefined') return;
    // Dynamic import so the bundle doesn't pay for the loader when key is absent
    // v2 loader uses functional API: setOptions() + importLibrary()
    import('@googlemaps/js-api-loader')
      .then(async (mod) => {
        mod.setOptions({ key: apiKey, v: 'weekly' });
        await mod.importLibrary('maps');
        await mod.importLibrary('marker');
      })
      .then(() => setReady(true))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Maps failed to load'));
  }, [apiKey]);

  useEffect(() => {
    if (!ready || !ref.current) return;
    const g = (window as unknown as { google?: typeof google }).google;
    if (!g) return;
    const center = location
      ? { lat: location.lat, lng: location.lng }
      : { lat: 25.7617, lng: -80.1918 }; // Miami default
    const map = new g.maps.Map(ref.current, {
      center,
      zoom: location ? 15 : 5,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#1b1b1f' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#c9a84c' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a30' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f2740' }] },
      ],
    });
    if (location) {
      new g.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map,
        title: location.formattedAddress,
      });
    }
  }, [ready, location]);

  if (!apiKey) {
    return (
      <div className="lg-map lg-map--placeholder">
        <div className="lg-map__placeholder-inner">
          <div className="lg-map__pin">📍</div>
          <div className="lg-map__heading">Map requires Google Maps API key</div>
          <div className="lg-map__hint">
            Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> and{' '}
            <code>GOOGLE_MAPS_SERVER_KEY</code> in Vercel env vars to enable the
            interactive map. The Load Generator still works by typing an address
            in the Site Data panel.
          </div>
          {location && (
            <div className="lg-map__coords">
              {location.formattedAddress ?? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="lg-map lg-map--placeholder">
        <div className="lg-map__placeholder-inner">
          <div className="lg-map__heading">Map load error</div>
          <div className="lg-map__hint">{err}</div>
        </div>
      </div>
    );
  }

  return <div ref={ref} className="lg-map" />;
}
