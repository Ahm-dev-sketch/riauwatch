"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { useRouter } from "next/navigation";
import type { Map, MapLayerMouseEvent, GeoJSONSource } from "maplibre-gl";
import type { HotspotsResponse, AdminAreasResponse } from "@/lib/types";

// Riau province bounding box (approximate center of the province)
const RIAU_CENTER: [number, number] = [101.5, 0.5];
const RIAU_ZOOM = 7;

// OpenFreeMap tiles — MIT licensed, free for non-commercial use, no API key required.
// Attribution is automatic with MapLibre GL (MapLibre adds the © OpenMapTiles and
// © OpenStreetMap attribution in the map controls). See: https://openfreemap.org
// Style "positron" chosen for a clean, readable basemap that lets data layers stand out.
const TILE_STYLE = "https://tiles.openfreemap.org/styles/positron";

// Slug mapping for kabupaten → URL path
const NAME_TO_SLUG: Record<string, string> = {
  "Kab. Rokan Hilir": "rokan-hilir",
  "Kota Dumai": "dumai",
  "Kab. Kampar": "kampar",
  "Kab. Pelalawan": "pelalawan",
  "Kab. Siak": "siak",
  "Kab. Kuantan Singingi": "kuantan-singingi",
  "Kab. Indragiri Hulu": "indragiri-hulu",
  "Kab. Rokan Hulu": "rokan-hulu",
  "Kab. Bengkalis": "bengkalis",
  "Kab. Indragiri Hilir": "indragiri-hilir",
  "Kab. Kepulauan Meranti": "kepulauan-meranti",
};

export interface HotspotMapHandle {
  /** Fly the map to a specific feature's coordinates and open its popup. */
  highlightFeature: (feature: HotspotsResponse["features"][0]) => void;
  /** Force-retry loading the tile style. */
  retryTiles: () => void;
}

interface HotspotMapProps {
  hotspots: HotspotsResponse | null;
  adminAreas?: AdminAreasResponse | null;
  showBoundaries?: boolean;
  loading?: boolean;
  onHotspotClick?: (feature: HotspotsResponse["features"][0]) => void;
  /** Fired when tile loading fails or succeeds after retry. */
  onTileStatusChange?: (error: boolean) => void;
}

type HotspotFeature = HotspotsResponse["features"][0];

function formatAcquiredAt(acquiredAt: string | null): string {
  if (!acquiredAt) return "-";
  return new Date(acquiredAt).toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Render a MapLibre popup for one hotspot feature (shared production path).
function showPopupForFeature(
  map: Map,
  coords: [number, number],
  props: Record<string, unknown>,
  feature: HotspotFeature,
  onHotspotClick?: (feature: HotspotFeature) => void,
): void {
  // Dynamically load Popup to match the maplibregl instance
  import("maplibre-gl").then((maplibregl) => {
    new maplibregl.Popup()
      .setLngLat(coords)
      .setHTML(buildHotspotPopupHtml(props, coords))
      .addTo(map);
  });

  onHotspotClick?.(feature);
}

// Popup HTML for one hotspot feature (single source of truth for both the
// map click handler and the mock-mode E2E hook below).
function buildHotspotPopupHtml(
  props: Record<string, unknown>,
  coords: [number, number],
): string {
  return `
    <div style="font-family:'DM Sans',system-ui,sans-serif;min-width:220px;padding:4px">
      <div style="font-weight:600;font-size:14px;margin-bottom:6px;color:#2c1e18">
        ${(props.area_name as string) || "Lokasi tidak diketahui"}
      </div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:2px 8px;font-size:12px;color:#44403c">
        <span style="color:#57534e">Latitude</span>
        <span style="font-family:'JetBrains Mono',monospace">${coords[1].toFixed(4)}</span>
        <span style="color:#57534e">Longitude</span>
        <span style="font-family:'JetBrains Mono',monospace">${coords[0].toFixed(4)}</span>
        <span style="color:#57534e">Waktu</span>
        <span>${formatAcquiredAt(props.acquired_at as string | null)}</span>
        <span style="color:#57534e">Confidence</span>
        <span>${(props.confidence as string) || "-"} ${props.confidence_value != null ? `(${props.confidence_value}%)` : ""}</span>
        <span style="color:#57534e">Satelit</span>
        <span>${(props.satellite as string) || "-"}</span>
        <span style="color:#57534e">Sumber</span>
        <span>${(props.instrument as string) || (props.satellite as string) || "-"}</span>
      </div>
      <div style="margin-top:8px;padding-top:6px;border-top:1px solid #e7e5e4;font-size:11px;color:#57534e;line-height:1.4">
        <em>Indikasi titik panas, BUKAN kebakaran terkonfirmasi. Verifikasi lapangan diperlukan.</em>
      </div>
    </div>
  `;
}

export const HotspotMap = forwardRef<HotspotMapHandle, HotspotMapProps>(
  function HotspotMap(
    { hotspots, adminAreas, showBoundaries = false, loading, onHotspotClick, onTileStatusChange },
    ref,
  ) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<Map | null>(null);
    const router = useRouter();
    const [mapLoaded, setMapLoaded] = useState(false);
    const tileErrorCountRef = useRef(0);
    const onTileStatusChangeRef = useRef(onTileStatusChange);
    onTileStatusChangeRef.current = onTileStatusChange;

    const reportTileStatus = useCallback((error: boolean) => {
      onTileStatusChangeRef.current?.(error);
    }, []);

    // Expose methods to parent (list syncing + retry)
    useImperativeHandle(ref, () => ({
      highlightFeature(feature: HotspotFeature) {
        const map = mapRef.current;
        if (!map) return;
        const coords = feature.geometry.coordinates as [number, number];
        // Fly to the feature
        map.flyTo({
          center: coords,
          zoom: Math.max(map.getZoom(), 10),
          duration: 800,
        });
        // Open popup
        showPopupForFeature(
          map,
          coords,
          feature.properties as unknown as Record<string, unknown>,
          feature,
          onHotspotClick,
        );
      },
      retryTiles() {
        const map = mapRef.current;
        if (!map) return;
        reportTileStatus(false);
        tileErrorCountRef.current = 0;
        map.setStyle(TILE_STYLE);
      },
    }), [onHotspotClick, reportTileStatus]);

    // Initialize the map
    useEffect(() => {
      if (!mapContainer.current || mapRef.current) return;

      let cancelled = false;

      // Network-level probe: check if tile style is reachable.
      // This catches failures that MapLibre's error event may not surface
      // (e.g. aborted requests, CORS blocks, proxy denials).
      fetch(TILE_STYLE, { method: "HEAD", mode: "no-cors" })
        .catch(() => {
          if (!cancelled) reportTileStatus(true);
        });

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

        // Track tile errors for graceful degradation.
        // MapLibre fires "error" for tile load failures; we debounce so
        // transient network blips don't immediately show the fallback.
        let tileErrorTimer: ReturnType<typeof setTimeout> | null = null;
        map.on("error", (e) => {
          // Only react to tile-related errors (status codes, type "Tile")
          const err = e.error as { status?: number; message?: string } | undefined;
          const isTileError =
            (err?.status != null && err.status >= 400) ||
            (err?.message?.toLowerCase().includes("tile") ?? false);

          if (isTileError) {
            tileErrorCountRef.current += 1;
            // After 3+ tile errors, report as failed
            if (tileErrorCountRef.current >= 3 && !cancelled) {
              reportTileStatus(true);
            } else if (!tileErrorTimer && !cancelled) {
              // Debounce: wait 2s for errors to settle
              tileErrorTimer = setTimeout(() => {
                if (tileErrorCountRef.current >= 2 && !cancelled) {
                  reportTileStatus(true);
                }
                tileErrorTimer = null;
              }, 2000);
            }
          }
        });

        map.on("load", () => {
          if (cancelled) return;
          setMapLoaded(true);
          mapRef.current = map;
          // Report success (tiles loaded fine)
          reportTileStatus(false);
          tileErrorCountRef.current = 0;
          // E2E hook (mock mode only): let Playwright project coordinates to pixels.
          if (process.env.NEXT_PUBLIC_USE_MOCKS === "true") {
            (window as unknown as { __rwMap?: Map }).__rwMap = map;
          }
        });
      });

      return () => {
        cancelled = true;
        mapRef.current?.remove();
        mapRef.current = null;
      };
    }, [reportTileStatus]);

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

      // E2E hooks (mock mode only): expose the wired feature list and a popup
      // trigger that runs the exact production popup code path. GL hit-testing
      // (browser capability, not app logic) is the only step bypassed.
      if (process.env.NEXT_PUBLIC_USE_MOCKS === "true") {
        const w = window as unknown as {
          __rwHotspots?: HotspotFeature[];
          __rwShowHotspotPopup?: (index: number) => boolean;
        };
        w.__rwHotspots = hotspots.features;
        w.__rwShowHotspotPopup = (index: number) => {
          const feature = hotspots.features[index];
          if (!feature) return false;
          const coords = feature.geometry.coordinates as [number, number];
          showPopupForFeature(
            map,
            coords,
            feature.properties as unknown as Record<string, unknown>,
            feature,
            onHotspotClick,
          );
          return true;
        };
      }

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
            "#2d8659", // mangrove-600 (< 5)
            10,
            "#b45309", // haze-600 (5-15)
            30,
            "#b91c1c", // red-600 (15+)
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
            "#b91c1c",   // red-600
            "nominal",
            "#b45309",   // haze-600
            "#2d8659",   // mangrove-600 (low/other)
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
        showPopupForFeature(
          map,
          [coords[0], coords[1]],
          props,
          feature as unknown as HotspotFeature,
          onHotspotClick,
        );
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

    // Add/update boundaries layer
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapLoaded) return;

      const sourceId = "boundaries";
      const fillLayerId = "boundaries-fill";
      const lineLayerId = "boundaries-line";
      const labelLayerId = "boundaries-label";

      // Remove existing
      if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId);
      if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
      if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      if (!showBoundaries || !adminAreas || adminAreas.features.length === 0) return;

      // Add source
      map.addSource(sourceId, {
        type: "geojson",
        data: adminAreas as unknown as GeoJSON.FeatureCollection,
      });

      // Fill layer (transparent fill with highlight on hover)
      map.addLayer({
        id: fillLayerId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": "rgba(139, 69, 19, 0.06)",
          "fill-outline-color": "#8b4513",
        },
      });

      // Line layer
      map.addLayer({
        id: lineLayerId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#8b4513",
          "line-width": 1.5,
          "line-dasharray": [3, 2],
        },
      });

      // Label layer
      map.addLayer({
        id: labelLayerId,
        type: "symbol",
        source: sourceId,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
          "text-size": 11,
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#2c1e18",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
      });

      // Hover effect
      let hoveredId: string | null = null;

      const handleMouseMove = (e: MapLayerMouseEvent) => {
        if (!e.features?.length) return;
        const feature = e.features[0];
        const id = String(feature.properties?.id ?? "");
        if (hoveredId && hoveredId !== id) {
          map.setFeatureState({ source: sourceId, id: hoveredId }, { hover: false });
        }
        hoveredId = id;
        map.setFeatureState({ source: sourceId, id }, { hover: true });
        map.getCanvas().style.cursor = "pointer";
      };

      const handleMouseLeave = () => {
        if (hoveredId) {
          map.setFeatureState({ source: sourceId, id: hoveredId }, { hover: false });
          hoveredId = null;
        }
        map.getCanvas().style.cursor = "";
      };

      const handleClickBoundaries = (e: MapLayerMouseEvent) => {
        if (!e.features?.length) return;
        const feature = e.features[0];
        const name = feature.properties?.name as string;
        if (name && NAME_TO_SLUG[name]) {
          router.push(`/kabupaten/${NAME_TO_SLUG[name]}`);
        }
      };

      map.on("mousemove", fillLayerId, handleMouseMove);
      map.on("mouseleave", fillLayerId, handleMouseLeave);
      map.on("click", fillLayerId, handleClickBoundaries);

      // Update hover paint
      map.setPaintProperty(fillLayerId, "fill-color", [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        "rgba(139, 69, 19, 0.15)",
        "rgba(139, 69, 19, 0.06)",
      ]);

      return () => {
        map.off("mousemove", fillLayerId, handleMouseMove);
        map.off("mouseleave", fillLayerId, handleMouseLeave);
        map.off("click", fillLayerId, handleClickBoundaries);
      };
    }, [adminAreas, showBoundaries, mapLoaded, router]);

    return (
      <div
        className="relative w-full overflow-hidden rounded-xl border border-rw-gray-200 bg-rw-gray-100 shadow-sm"
        data-testid="hotspot-map"
        role="img"
        aria-label="Peta interaktif titik panas Riau"
      >
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
  },
);
