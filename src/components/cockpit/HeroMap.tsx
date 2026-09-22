"use client";

import { useEffect, useMemo, useRef } from "react";
import { holderDeskLabel } from "@/lib/pipelines";
import { formatDwell, type CockpitJob } from "@/lib/cockpit";
import { TYPE_LABEL } from "./types";
import { HOLDER_COLOR } from "./holder-style";
import "./cockpit-map.css";

/**
 * The jobs on a map, one marker per job with a location. The fill is the
 * holder's color (whose desk it is on), the letter is the type, and a stale
 * job gets a white gap plus a red outer ring — visible on every fill,
 * including the dark PE bronze. A job with no stage gets a dashed ring.
 *
 * Leaflet is imported inside the effect so it never runs on the server; its
 * base CSS is already global. Markers are divIcons, so no image assets (and
 * no unpkg patch) are needed.
 */
export function HeroMap({ jobs }: { jobs: CockpitJob[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);

  const geo = useMemo(
    () =>
      jobs.filter(
        (j) =>
          typeof j.latitude === "number" &&
          typeof j.longitude === "number" &&
          Number.isFinite(j.latitude) &&
          Number.isFinite(j.longitude)
      ),
    [jobs]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !ref.current) return;

      if (!mapRef.current) {
        const map = L.map(ref.current, {
          center: [25.9, -80.3],
          zoom: 9,
          zoomControl: true,
          attributionControl: true,
          scrollWheelZoom: false,
        });
        map.attributionControl.setPrefix(false);
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
          {
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
            subdomains: "abcd",
            maxZoom: 19,
          }
        ).addTo(map);
        // Scroll-wheel zoom only after the user engages with the map, so
        // scrolling the page past it never zooms by accident.
        map.on("click", () => map.scrollWheelZoom.enable());
        map.on("mouseout", () => map.scrollWheelZoom.disable());
        mapRef.current = map;
      }

      if (layerRef.current) layerRef.current.clearLayers();
      else layerRef.current = L.layerGroup().addTo(mapRef.current);

      const bounds = L.latLngBounds([]);
      for (const j of geo) {
        const icon = L.divIcon({
          html: markerSvg(j),
          className: "cockpit-marker-wrap",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -14],
        });
        L.marker([j.latitude!, j.longitude!], {
          icon,
          title: j.name,
          keyboard: true,
        })
          .bindPopup(popupHtml(j))
          .addTo(layerRef.current);
        bounds.extend([j.latitude!, j.longitude!]);
      }
      if (geo.length > 0) {
        mapRef.current.fitBounds(bounds.pad(0.25), {
          animate: false,
          maxZoom: 14,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [geo]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  return (
    <section
      aria-label="Job map"
      className="cockpit-hero-map min-w-0 overflow-hidden rounded-lg border border-[#e6e9ef] bg-white"
    >
      <div ref={ref} className="h-[240px] w-full sm:h-[320px]" />
      {geo.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-white/75 px-6 text-center">
          <p className="text-[13px] text-slate-700">No job locations yet.</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Add an address on a project to pin it here.
          </p>
        </div>
      ) : (
        <div className="pointer-events-none absolute right-2 top-2 z-[1000] flex max-w-[calc(100%-4rem)] justify-end flex-wrap gap-x-2.5 gap-y-1 rounded-md bg-white/90 px-2 py-1 text-[10px] text-slate-600 shadow-sm">
          <LegendDot color={HOLDER_COLOR.FIRM} label="Ours" />
          <LegendDot color={HOLDER_COLOR.CLIENT} label="Waiting on others" />
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full border border-dashed border-slate-400" />
            No stage
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full border-2 border-red-600" />
            Stale
          </span>
        </div>
      )}
    </section>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function markerSvg(j: CockpitJob): string {
  const fill = j.holder ? HOLDER_COLOR[j.holder] : "#ffffff";
  const letter = j.type ? j.type.charAt(0) : "?";
  const textColor = j.holder ? "#ffffff" : "#475569";
  const rings = j.stale
    ? `<circle cx="16" cy="16" r="12.5" fill="none" stroke="#ffffff" stroke-width="2"/>
       <circle cx="16" cy="16" r="14.5" fill="none" stroke="#dc2626" stroke-width="2"/>`
    : "";
  const base = j.holder
    ? `<circle cx="16" cy="16" r="11" fill="${fill}" stroke="#ffffff" stroke-width="1.5"/>`
    : `<circle cx="16" cy="16" r="11" fill="${fill}" stroke="#64748b" stroke-width="1.5" stroke-dasharray="3 2"/>`;
  return `<div class="cockpit-marker"><svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">${rings}${base}<text x="16" y="20" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="11" fill="${textColor}">${letter}</text></svg></div>`;
}

function popupHtml(j: CockpitJob): string {
  const type = j.type ? TYPE_LABEL[j.type] : "Project";
  const desk = j.holder ? holderDeskLabel(j.holder) : "No stage set";
  const dwell = formatDwell(j.daysInStage);
  return `<div class="cockpit-popup">
    <div class="cockpit-popup__type">${escapeHtml(type)}</div>
    <div class="cockpit-popup__name">${escapeHtml(j.name)}</div>
    ${j.stageLabel ? `<div class="cockpit-popup__line">${escapeHtml(j.stageLabel)}</div>` : ""}
    <div class="cockpit-popup__line">${escapeHtml(desk)}${dwell ? ` · ${escapeHtml(dwell)}` : ""}${j.stale ? " · Stale" : ""}</div>
    ${j.location ? `<div class="cockpit-popup__line">${escapeHtml(j.location)}</div>` : ""}
    <a class="cockpit-popup__link" href="/projects/${encodeURIComponent(j.id)}">Open project →</a>
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
