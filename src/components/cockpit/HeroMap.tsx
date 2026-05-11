'use client';

import React, { useEffect, useRef } from 'react';
import type { CockpitProject } from './types';
import { TYPE_COLOR, TYPE_LABEL, STATUS_COLOR } from './types';

interface HeroMapProps {
  projects: CockpitProject[];
}

/**
 * World map with one marker per geolocated project.
 *
 * - Tiles: CartoDB Dark Matter (free, no API key, matches the dark theme)
 * - Marker: a custom divIcon shaped like a stamped seal in the project's
 *   TYPE color, with a status ring (green/orange/red)
 * - Click on a marker → navigate to /projects/[id]
 * - Auto-fits the viewport to the marker bounds
 *
 * Dynamically imports leaflet so SSR doesn't choke and the bundle stays
 * lean for routes that don't need a map.
 */
export function HeroMap({ projects }: HeroMapProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const layerRef = useRef<import('leaflet').LayerGroup | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    (async () => {
      const L = await import('leaflet');
      // Patch default icon paths once; markers fail silently otherwise.
      // @ts-expect-error runtime patch for default icon
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (cancelled || !ref.current) return;

      if (!mapRef.current) {
        const map = L.map(ref.current, {
          center: [20, -60],
          zoom: 3,
          zoomControl: true,
          attributionControl: false, // hide the "Leaflet | © OSM · © CARTO" footer
          scrollWheelZoom: false,
        });
        L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          {
            attribution: '',
            subdomains: 'abcd',
            maxZoom: 19,
          }
        ).addTo(map);

        // Enable scroll-wheel zoom only after the user has interacted, so
        // accidental page scrolling doesn't zoom the map.
        map.once('focus', () => map.scrollWheelZoom.enable());
        map.on('click', () => map.scrollWheelZoom.enable());

        mapRef.current = map;
      }

      // Rebuild the marker layer from scratch — simpler than diffing
      if (layerRef.current) {
        layerRef.current.clearLayers();
      } else {
        layerRef.current = L.layerGroup().addTo(mapRef.current);
      }

      const geo = projects.filter(
        (p) => typeof p.latitude === 'number' && typeof p.longitude === 'number'
      );

      const bounds = L.latLngBounds([]);

      for (const p of geo) {
        const fill = p.type ? TYPE_COLOR[p.type] : '#888';
        const ring = STATUS_COLOR[p.status] ?? '#666';
        const html = `
          <div class="cockpit-marker" style="--marker-fill:${fill}; --marker-ring:${ring};">
            <svg viewBox="0 0 32 32" width="32" height="32">
              <circle cx="16" cy="16" r="14" fill="var(--marker-fill)" stroke="var(--marker-ring)" stroke-width="2.5"/>
              <text x="16" y="20" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="11" fill="#0a0a0a">
                ${p.type ? p.type.charAt(0) : '?'}
              </text>
            </svg>
          </div>
        `;
        const icon = L.divIcon({
          html,
          className: 'cockpit-marker-wrap',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([p.latitude!, p.longitude!], { icon }).addTo(
          layerRef.current!
        );

        const popupHtml = `
          <div class="cockpit-marker-popup">
            <div class="cockpit-marker-popup__type" style="color:${fill}">${p.type ? TYPE_LABEL[p.type] : 'Project'}</div>
            <div class="cockpit-marker-popup__name">${escapeHtml(p.name)}</div>
            ${p.location ? `<div class="cockpit-marker-popup__loc">${escapeHtml(p.location)}</div>` : ''}
            ${p.clientName ? `<div class="cockpit-marker-popup__client">${escapeHtml(p.clientName)}</div>` : ''}
            <a class="cockpit-marker-popup__link" href="/projects/${p.id}">Open project →</a>
          </div>
        `;
        marker.bindPopup(popupHtml);
        bounds.extend([p.latitude!, p.longitude!]);
      }

      if (geo.length > 0) {
        mapRef.current.fitBounds(bounds.pad(0.25), { animate: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projects]);

  // Tear down the map on unmount so a navigation back doesn't double-init.
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  return (
    <div className="cockpit-hero-map">
      <div ref={ref} className="cockpit-hero-map__canvas" />
      {projects.filter((p) => p.latitude && p.longitude).length === 0 && (
        <div className="cockpit-hero-map__empty">
          <p>No geolocated projects yet.</p>
          <p className="cockpit-hero-map__empty-hint">
            Add a location when creating a project to see it on the map.
          </p>
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
