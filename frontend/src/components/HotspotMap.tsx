"use client";

import { useEffect, useRef, useState } from "react";
import type { Map, MapLayerMouseEvent, GeoJSONSource } from "maplibre-gl";
import type { HotspotsResponse } from "@/lib/types";

// Riau province bounding box (approximate center of the province)
const RIAU_CENTER: [number, number] = [101.5, 0.5];
const RIAU_ZOOM = 7;

// OpenFreeMap tiles — MIT licensed, free for non-commercial use, no API key required.
// Attribution is automatic with MapLibre GL (MapLibre adds the © OpenMapTiles and
// © OpenStreetMap attribution in the map controls). See: https://openfreemap.org
// Style "positron" chosen for a clean, readable basemap that lets data layers stand out.
const TILE_STYLE = "https://tiles.openfreemap.org/styles/positron";

interface HotspotMapProps {
  hotspots: HotspotsResponse | null;
  loading?: boolean;
  onHotspotClick?: (feature: HotspotsResponse["features"][0]) => void;
}

export function HotspotMap({ hotspots, loading, onHotspotClick }: HotspotMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize the map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    let cancelled = false;

    import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !mapContainer.current) return;

      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: TILE_STYLE,
        center: RIAU_CENTER,
        zoom: RIAU_ZOOM,
        minZoom: 5,
        maxZoom: 16,
      });

      map.addControl(new maplibregl.NavigationControl(), "top-right");
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

      map.on("load", () => {
        if (cancelled) return;
        setMapLoaded(true);
        mapRef.current = map;
      });

      map.on("error", (e) => {
        console.error("Map error:", e);
      });
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Add/update hotspot source and layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !hotspots) return;

    const sourceId = "hotspots";
    const clusterLayerId = "hotspot-clusters";
    const countLayerId = "hotspot-clusters-count";
    const unclusteredLayerId = "hotspot-points";

    // Remove existing layers and source
    if (map.getLayer(countLayerId)) map.removeLayer(countLayerId);
    if (map.getLayer(clusterLayerId)) map.removeLayer(clusterLayerId);
    if (map.getLayer(unclusteredLayerId)) map.removeLayer(unclusteredLayerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    // Add GeoJSON source with clustering
    map.addSource(sourceId, {
      type: "geojson",
      data: hotspots,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });

    // Cluster circles
    map.addLayer({
      id: clusterLayerId,
      type: "circle",
      source: sourceId,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "step",
          ["get", "point_count"],
          "#2d8659", // green-600 (< 5)
          10,
          "#d69e2e", // amber-600 (5-15)
          30,
          "#c53030", // red-600 (15+)
        ],
        "circle-radius": [
          "step",
          ["get", "point_count"],
          15, // default
          10,
          22,
          30,
          30,
        ],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });

    // Cluster count labels
    map.addLayer({
      id: countLayerId,
      type: "symbol",
      source: sourceId,
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        "text-size": 12,
      },
      paint: {
        "text-color": "#ffffff",
      },
    });

    // Individual hotspot points
    map.addLayer({
      id: unclusteredLayerId,
      type: "circle",
      source: sourceId,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": [
          "match",
          ["get", "confidence"],
          "high",
          "#c53030",   // red-600
          "nominal",
          "#d69e2e",   // amber-600
          "#2d8659",   // green-600 (low/other)
        ],
        "circle-radius": 7,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });

    // Click handler for popups
    const handleClick = (e: MapLayerMouseEvent) => {
      if (!e.features?.length) return;
      const feature = e.features[0];
      const coords = (feature.geometry as { type: string; coordinates: number[] }).coordinates;
      const props = feature.properties as Record<string, unknown>;

      const acquiredAt = props.acquired_at
        ? new Date(props.acquired_at as string).toLocaleString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";

      const html = `
        <div style="font-family:'DM Sans',sans-serif;min-width:220px;padding:4px">
          <div style="font-weight:600;font-size:14px;margin-bottom:6px;color:#1a3a2a">
            ${props.area_name || "Lokasi tidak diketahui"}
          </div>
          <div style="display:grid;grid-template-columns:auto 1fr;gap:2px 8px;font-size:12px;color:#4a5568">
            <span style="color:#718096">Latitude</span>
            <span style="font-family:'JetBrains Mono',monospace">${coords[1].toFixed(4)}</span>
            <span style="color:#718096">Longitude</span>
            <span style="font-family:'JetBrains Mono',monospace">${coords[0].toFixed(4)}</span>
            <span style="color:#718096">Waktu</span>
            <span>${acquiredAt}</span>
            <span style="color:#718096">Confidence</span>
            <span>${props.confidence || "-"} ${props.confidence_value != null ? `(${props.confidence_value}%)` : ""}</span>
            <span style="color:#718096">Satelit</span>
            <span>${props.satellite || "-"}</span>
            <span style="color:#718096">Sumber</span>
            <span>${props.instrument || props.satellite || "-"}</span>
          </div>
          <div style="margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0;font-size:11px;color:#718096;line-height:1.4">
            <em>Indikasi titik panas, BUKAN kebakaran terkonfirmasi. Verifikasi lapangan diperlukan.</em>
          </div>
        </div>
      `;

      // Dynamically load Popup to match the maplibregl instance
      import("maplibre-gl").then((maplibregl) => {
        new maplibregl.Popup()
          .setLngLat(coords as [number, number])
          .setHTML(html)
          .addTo(map);
      });

      onHotspotClick?.(feature as unknown as HotspotsResponse["features"][0]);
    };

    map.on("click", unclusteredLayerId, handleClick);
    map.on("click", clusterLayerId, (e) => {
      if (!e.features?.length) return;
      const clusterId = e.features[0].properties?.cluster_id;
      if (clusterId == null) return;
      const source = map.getSource(sourceId);
      if (source && "getClusterExpansionZoom" in source) {
        (source as GeoJSONSource).getClusterExpansionZoom(clusterId).then((zoom) => {
          if (!map) return;
          map.easeTo({
            center: (e.features![0].geometry as { type: string; coordinates: number[] }).coordinates as [number, number],
            zoom: zoom + 0.5,
            duration: 300,
          });
        }).catch(() => {});
      }
    });

    // Cursor change on hover
    map.on("mouseenter", unclusteredLayerId, () => {
      if (map) map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", unclusteredLayerId, () => {
      if (map) map.getCanvas().style.cursor = "";
    });
    map.on("mouseenter", clusterLayerId, () => {
      if (map) map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", clusterLayerId, () => {
      if (map) map.getCanvas().style.cursor = "";
    });
  }, [hotspots, mapLoaded, onHotspotClick]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-rw-gray-200 bg-rw-gray-100 shadow-sm">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
          <div className="flex items-center gap-2 text-sm text-rw-gray-600">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Memuat peta...
          </div>
        </div>
      )}
      <div ref={mapContainer} className="h-[400px] sm:h-[500px] lg:h-[600px]" />
    </div>
  );
}
