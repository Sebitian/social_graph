"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import { compactNumber } from "@/lib/graphUtils";
import { lookupLocationCoords } from "@/lib/geoLookup";

export interface LocationMapItem {
  label: string;
  count: number;
}

interface Props {
  locations: LocationMapItem[];
  accent?: string;
  onSelect?: (label: string) => void;
  className?: string;
}

/** Country / region-only labels — show as chips, not map pins. */
function isVagueRegion(label: string): boolean {
  const clean = label.trim().toLowerCase();
  return (
    clean === "united states" ||
    clean === "usa" ||
    clean === "u.s." ||
    clean === "u.s.a." ||
    clean === "united kingdom" ||
    clean === "uk" ||
    clean === "canada" ||
    clean === "australia" ||
    clean === "europe" ||
    clean === "remote"
  );
}

function shortLabel(label: string): string {
  const city = label.split(",")[0]?.trim() ?? label;
  return city.length > 18 ? `${city.slice(0, 16)}…` : city;
}

export default function LocationMapChart({
  locations,
  accent = "#0A66C2",
  onSelect,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const [hover, setHover] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const { markers, chips } = useMemo(() => {
    const max = Math.max(...locations.map((l) => l.count), 1);
    const markers: {
      label: string;
      count: number;
      lat: number;
      lng: number;
      r: number;
    }[] = [];
    const chips: LocationMapItem[] = [];

    for (const loc of locations) {
      if (isVagueRegion(loc.label)) {
        chips.push(loc);
        continue;
      }
      const geo = lookupLocationCoords(loc.label);
      if (!geo) {
        chips.push(loc);
        continue;
      }
      markers.push({
        ...loc,
        lat: geo.lat,
        lng: geo.lng,
        r: 16 + (loc.count / max) * 18,
      });
    }

    markers.sort((a, b) => b.count - a.count);
    return { markers, chips };
  }, [locations]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: false,
        dragging: true,
        minZoom: 2,
        maxZoom: 7,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Esri World Street Map — public, key-free tiles for demos.
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom',
          maxZoom: 7,
        },
      ).addTo(map);

      const layer = L.layerGroup().addTo(map);
      mapRef.current = map;
      layerRef.current = layer;
      setReady(true);
      requestAnimationFrame(() => map.invalidateSize());
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !map || !layer) return;

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current || !layerRef.current) return;

      layer.clearLayers();

      if (markers.length === 0) {
        map.setView([39.5, -98.35], 3);
        return;
      }

      const bounds = L.latLngBounds([]);

      for (const m of markers) {
        const ll = L.latLng(m.lat, m.lng);
        bounds.extend(ll);

        const size = Math.round(m.r * 2);
        const icon = L.divIcon({
          className: "loc-map-blob",
          html: `<div role="img" aria-label="${m.label}: ${compactNumber(m.count)}" style="
            width:${size}px;height:${size}px;
            border-radius:9999px;
            background:radial-gradient(circle at 35% 30%, ${accent}cc, ${accent}ee 55%, ${accent});
            border:1.5px solid rgba(251,248,242,0.9);
            box-shadow:0 4px 14px rgba(22,26,23,0.18), 0 0 0 ${Math.max(4, m.r * 0.35)}px ${accent}33;
            color:#fff;
            font:700 ${m.r >= 22 ? 13 : 11}px ui-monospace,SFMono-Regular,Menlo,monospace;
            display:flex;align-items:center;justify-content:center;
            cursor:pointer;
          ">${compactNumber(m.count)}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker(ll, { icon });
        marker.on("mouseover", () => setHover(m.label));
        marker.on("mouseout", () => setHover(null));
        marker.on("click", () => onSelectRef.current?.(m.label));
        marker.addTo(layer);
      }

      map.fitBounds(bounds.pad(0.4), {
        animate: false,
        maxZoom: markers.length <= 2 ? 5 : 6,
      });
      requestAnimationFrame(() => map.invalidateSize());
    })();

    return () => {
      cancelled = true;
    };
  }, [markers, accent, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const el = containerRef.current;
    if (!ready || !map || !el) return;
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  if (markers.length === 0 && chips.length === 0) {
    return (
      <div
        className={`flex h-[220px] items-center justify-center px-4 text-sm text-[#5E665F]/80 ${className}`}
      >
        No mappable locations in this roster
      </div>
    );
  }

  return (
    <div className={`loc-map relative ${className}`}>
      <div className="relative h-[240px] w-full overflow-hidden sm:h-[280px]">
        <div ref={containerRef} className="absolute inset-0 z-0 bg-[#0b1220]" />

        {hover ? (
          <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-lg border border-[#D5CDBF] bg-[#FBF8F2] px-2.5 py-1.5 text-xs text-[#161A17]">
            <span className="font-medium">{shortLabel(hover)}</span>
            <span className="ml-2 font-mono text-[#5E665F]">
              {compactNumber(
                markers.find((m) => m.label === hover)?.count ?? 0,
              )}
            </span>
          </div>
        ) : (
          <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-lg border border-[#D5CDBF] bg-[#FBF8F2] px-2 py-1 text-[10px] uppercase tracking-wide text-[#5E665F]/80">
            Employee locations
          </div>
        )}
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-[#D5CDBF] px-3 py-2">
          {chips.map((loc) => (
            <button
              key={loc.label}
              type="button"
              onClick={() => onSelect?.(loc.label)}
              disabled={!onSelect}
              className="rounded-md border border-[#D5CDBF] bg-[#F3EEE4] px-2 py-1 text-[11px] text-[#5E665F] transition hover:bg-[#E7E0D4] hover:text-[#161A17] disabled:cursor-default"
            >
              {loc.label}{" "}
              <span className="font-mono text-[#5E665F]/80">
                {compactNumber(loc.count)}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
