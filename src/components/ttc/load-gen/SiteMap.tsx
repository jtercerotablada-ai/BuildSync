'use client';

import React, { useEffect, useRef } from 'react';
import type { LocationData } from '@/lib/load-gen/types';

interface Props {
  location: LocationData | null;
}

/**
 * Leaflet map with CartoDB Dark Matter tiles — 100% free, no API key
 * required. Dynamically imports leaflet so the bundle stays lean for other
 * routes and SSR doesn't try to touch `window`.
 */
export function SiteMap({ location }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markerRef = useRef<import('leaflet').Marker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (mapRef.current) return; // already initialised
    let cancelled = false;

    (async () => {
      const L = await import('leaflet');
      // Leaflet needs its CSS — loaded once, globally, from ttc-globals.css.
      // Fallback: patch default icon image paths so markers render when hosted
      // from arbitrary subdirectories.
      // @ts-expect-error — runtime fix for bundler-absent icon asset paths.
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (cancelled || !ref.current) return;

      const center: [number, number] = location
        ? [location.lat, location.lng]
        : [25.7617, -80.1918]; // Miami default
      const zoom = location ? 15 : 5;

      const map = L.map(ref.current, {
        center,
        zoom,
        zoomControl: true,
        attributionControl: true,
      });

      // CartoDB Dark Matter tiles — free, fits the site's dark theme
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &middot; &copy; <a href="https://carto.com/">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19,
        }
      ).addTo(map);

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-center and reposition marker when the user picks a new location
  useEffect(() => {
    if (!mapRef.current || !location) return;
    (async () => {
      const L = await import('leaflet');
      mapRef.current!.setView([location.lat, location.lng], 15, { animate: true });
      if (markerRef.current) {
        markerRef.current.setLatLng([location.lat, location.lng]);
      } else {
        markerRef.current = L.marker([location.lat, location.lng]).addTo(mapRef.current!);
      }
      if (location.formattedAddress) {
        markerRef.current.bindPopup(location.formattedAddress).openPopup();
      }
    })();
  }, [location]);

  return <div ref={ref} className="lg-map" />;
}
