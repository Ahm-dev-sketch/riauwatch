"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { useRouter } from "next/navigation";
import type { Map, MapLayerMouseEvent, GeoJSONSource, StyleSpecification } from "maplibre-gl";
import type { HotspotsResponse, AdminAreasResponse } from "@/lib/types";
import { KHG_RIAU_GEOJSON, isCoordinateInPeatland } from "@/lib/khg";
import { generateWindGeoJSON } from "@/lib/wind";
import { resolveRiauLocation } from "@/lib/geo";

// Riau province coordinates & default view
const RIAU_CENTER: [number, number] = [101.65, 0.55];
const RIAU_ZOOM = 6.8;

// Clean, reliable, 100% free OpenStreetMap standard raster tiles.
// No API key required, zero watermarks, zero duplication.
const DEFAULT_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "osm-raster": {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm-raster-layer",
      type: "raster",
      source: "osm-raster",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

// Slug mapping for kabupaten → URL path
const NAME_TO_SLUG: Record<string, string> = {
  "Kota Pekanbaru": "pekanbaru",
  "Kota Dumai": "dumai",
  "Kab. Bengkalis": "bengkalis",
  "Kab. Indragiri Hilir": "indragiri-hilir",
  "Kab. Indragiri Hulu": "indragiri-hulu",
  "Kab. Kampar": "kampar",
  "Kab. Kepulauan Meranti": "kepulauan-meranti",
  "Kab. Kuantan Singingi": "kuantan-singingi",
  "Kab. Pelalawan": "pelalawan",
  "Kab. Rokan Hilir": "rokan-hilir",
  "Kab. Rokan Hulu": "rokan-hulu",
  "Kab. Siak": "siak",
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
  selectedKabupatenId?: string | number | null;
  showHotspots?: boolean;
  showBoundaries?: boolean;
  showKHG?: boolean;
  showWind?: boolean;
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

// Sub-location descriptor based on Riau geography & coordinates
function describeRiauLocation(lat: number, lon: number, areaName: string | null): string {
  return resolveRiauLocation(lat, lon, areaName).fullDescription;
}

// Render a MapLibre popup for one hotspot feature (shared production path).
function showPopupForFeature(
  map: Map,
  coords: [number, number],
  props: Record<string, unknown>,
  feature: HotspotFeature,
  onHotspotClick?: (feature: HotspotFeature) => void,
): void {
  import("maplibre-gl").then((maplibregl) => {
    new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: "340px" })
      .setLngLat(coords)
      .setHTML(buildHotspotPopupHtml(props, coords))
      .addTo(map);
  });

  onHotspotClick?.(feature);
}

function humanizeConfidence(conf: string | null, confValue: number | null): { label: string; color: string; bg: string } {
  const c = (conf || "").toLowerCase();
  if (c === "h" || c === "high") {
    return {
      label: confValue != null ? `Akurasi Tinggi (${confValue}%)` : "Akurasi Tinggi (≥70%)",
      color: "#ffffff",
      bg: "#0f172a", // Solid Jet Black
    };
  }
  if (c === "n" || c === "nominal") {
    return {
      label: confValue != null ? `Akurasi Sedang (${confValue}%)` : "Akurasi Sedang (30–69%)",
      color: "#92400e",
      bg: "#fef3c7", // Amber
    };
  }
  return {
    label: confValue != null ? `Akurasi Rendah (${confValue}%)` : "Akurasi Rendah (<30%)",
    color: "#1e4d35",
    bg: "#f0fff4", // Mangrove
  };
}

function humanizeSatellite(sat: string | null): string {
  if (!sat) return "Satelit Lingkungan NASA / NOAA";
  const s = sat.toUpperCase().trim();
  if (s === "N" || s === "N20" || s.includes("NOAA-20") || s.includes("NOAA20")) return "Satelit Cuaca NOAA-20 (NASA/NOAA)";
  if (s === "N21" || s.includes("NOAA-21") || s.includes("NOAA21")) return "Satelit Cuaca NOAA-21 (NASA/NOAA)";
  if (s === "SNPP" || s.includes("S-NPP") || s.includes("SUOMI")) return "Satelit Suomi-NPP (NASA/NOAA)";
  if (s.includes("TERRA") || s === "T") return "Satelit Terra (NASA EOS)";
  if (s.includes("AQUA") || s === "A") return "Satelit Aqua (NASA EOS)";
  return `Satelit ${sat}`;
}

function humanizeSensorDetail(sensor: string | null, instrument: string | null, satellite: string | null): string {
  if (sensor === "MERGED") {
    return "Pantauan Ganda (Satelit VIIRS & MODIS)";
  }
  const i = (instrument || satellite || "").toUpperCase();
  if (i.includes("VIIRS") || i === "N" || i.includes("NOAA") || i.includes("SNPP")) return "Kamera Resolusi Tajam (VIIRS 375m)";
  if (i.includes("MODIS") || i.includes("TERRA") || i.includes("AQUA")) return "Kamera Pantauan Luas (MODIS 1km)";
  return "Sensor Satelit Lingkungan";
}

function humanizeFRP(frpVal: number | null): string {
  if (frpVal == null) return "Tidak terukur";
  if (frpVal >= 30) return `${frpVal.toFixed(1)} MW (Intensitas Sangat Panas)`;
  if (frpVal >= 10) return `${frpVal.toFixed(1)} MW (Intensitas Sedang)`;
  return `${frpVal.toFixed(1)} MW (Intensitas Ringan)`;
}

function humanizeDayNight(dn: string | null): { text: string; isDay: boolean } | null {
  if (!dn) return null;
  return dn.toUpperCase() === "D"
    ? { text: "Waktu Siang", isDay: true }
    : { text: "Waktu Malam", isDay: false };
}

// Popup HTML for one hotspot feature (No Emojis — professional SVG icons)
function buildHotspotPopupHtml(
  props: Record<string, unknown>,
  coords: [number, number],
): string {
  const conf = humanizeConfidence(
    props.confidence as string | null,
    props.confidence_value != null ? Number(props.confidence_value) : null,
  );
  const satText = humanizeSatellite(props.satellite as string | null);
  const sensorText = humanizeSensorDetail(
    props.sensor as string | null,
    props.instrument as string | null,
    props.satellite as string | null,
  );
  const dn = humanizeDayNight(props.daynight as string | null);
  const frpVal = props.frp != null ? Number(props.frp) : null;
  const areaName = (props.area_name as string) || null;
  const locationDesc = describeRiauLocation(coords[1], coords[0], areaName);

  // Check Peatland (KHG) status
  const peatCheck = props.in_peatland || isCoordinateInPeatland(coords[1], coords[0]).inPeatland;
  const rawCount = props.raw_detections_count != null ? Number(props.raw_detections_count) : 1;

  return `
    <div style="font-family:'DM Sans',system-ui,sans-serif;min-width:260px;padding:4px">
      <!-- Location Header -->
      <div style="margin-bottom:8px;border-bottom:1px solid #e7e5e4;padding-bottom:6px">
        <div style="font-weight:700;font-size:13.5px;color:#1c1917;line-height:1.3">
          ${locationDesc}
        </div>
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-top:6px">
          <!-- Confidence Badge -->
          <span style="font-size:10px;font-weight:700;color:${conf.color};background:${conf.bg};padding:2px 7px;border-radius:999px">
            ${conf.label}
          </span>
          <!-- Day/Night Badge -->
          ${dn ? `<span style="font-size:10px;font-weight:600;color:#57534e;background:#f5f5f4;padding:2px 6px;border-radius:4px">${dn.text}</span>` : ""}
          <!-- Peatland KHG Badge -->
          ${peatCheck ? `<span style="font-size:10px;font-weight:700;color:#92400e;background:#fef3c7;padding:2px 6px;border-radius:4px;border:1px solid #fde68a">Lahan Gambut (KHG)</span>` : ""}
        </div>
      </div>

      <!-- Attributes Grid -->
      <div style="display:grid;grid-template-columns:auto 1fr;gap:5px 12px;font-size:11.5px;color:#44403c">
        <span style="color:#78716c;font-weight:500">Waktu Pantauan</span>
        <span style="font-weight:600">${formatAcquiredAt(props.acquired_at as string | null)}</span>
        
        <span style="color:#78716c;font-weight:500">Koordinat</span>
        <span style="font-family:'JetBrains Mono',monospace;font-weight:600">${coords[1].toFixed(4)}°, ${coords[0].toFixed(4)}°</span>
        
        <span style="color:#78716c;font-weight:500">Satelit</span>
        <span style="font-weight:600">${satText}</span>
        
        <span style="color:#78716c;font-weight:500">Pemotretan</span>
        <span style="font-weight:600;color:#8b4513">${sensorText}</span>

        ${rawCount > 1 ? `<span style="color:#78716c;font-weight:500">Titik Serupa</span><span style="font-weight:600">${rawCount} pantauan berdekatan digabung</span>` : ""}
        
        ${frpVal != null ? `<span style="color:#78716c;font-weight:500">Kekuatan Panas</span><span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#b91c1c">${humanizeFRP(frpVal)}</span>` : ""}
      </div>

      <!-- Mandatory Trust Disclaimer -->
      <div style="margin-top:8px;padding-top:6px;border-top:1px solid #e7e5e4;font-size:10px;color:#78716c;line-height:1.35">
        <strong>Catatan:</strong> Indikasi suhu panas dari satelit. Bukan kebakaran yang sudah dicek langsung di darat. Pengecekan lapangan tetap diperlukan.
      </div>
    </div>
  `;
}

export const HotspotMap = forwardRef<HotspotMapHandle, HotspotMapProps>(
  function HotspotMap(
    {
      hotspots,
      adminAreas,
      selectedKabupatenId,
      showHotspots = true,
      showBoundaries = false,
      showKHG = true,
      showWind = true,
      loading,
      onHotspotClick,
      onTileStatusChange,
    },
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
        map.flyTo({
          center: coords,
          zoom: Math.max(map.getZoom(), 10),
          duration: 800,
        });
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
        try {
          map.setStyle(DEFAULT_MAP_STYLE);
        } catch (err) {
          console.error("Error setting map style:", err);
        }
      },
    }), [onHotspotClick, reportTileStatus]);

    // Initialize the map
    useEffect(() => {
      if (!mapContainer.current || mapRef.current) return;

      let cancelled = false;
      let resizeObserver: ResizeObserver | null = null;

      import("maplibre-gl").then((maplibregl) => {
        if (cancelled || !mapContainer.current) return;

        const map = new maplibregl.Map({
          container: mapContainer.current,
          style: DEFAULT_MAP_STYLE,
          center: RIAU_CENTER,
          zoom: RIAU_ZOOM,
          minZoom: 4,
          maxZoom: 18,
        });

        map.addControl(new maplibregl.NavigationControl(), "top-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

        if (typeof ResizeObserver !== "undefined" && mapContainer.current) {
          resizeObserver = new ResizeObserver(() => {
            map.resize();
          });
          resizeObserver.observe(mapContainer.current);
        }

        map.on("error", (e) => {
          const err = e.error as { status?: number; message?: string } | undefined;
          const isTileError =
            (err?.status != null && err.status >= 400) ||
            (err?.message?.toLowerCase().includes("tile") ?? false) ||
            (err?.message?.toLowerCase().includes("failed") ?? false);

          if (isTileError) {
            tileErrorCountRef.current += 1;
            if (tileErrorCountRef.current >= 3) {
              reportTileStatus(true);
            }
          }
        });

        map.on("load", () => {
          if (cancelled) return;
          setMapLoaded(true);
          mapRef.current = map;
          map.resize();
          reportTileStatus(false);
          tileErrorCountRef.current = 0;
          if (typeof window !== "undefined") {
            (window as unknown as { __rwMap?: Map }).__rwMap = map;
          }
        });
      });

      return () => {
        cancelled = true;
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        mapRef.current?.remove();
        mapRef.current = null;
      };
    }, [reportTileStatus]);

    // Auto-focus and zoom map when Kabupaten/Kota is selected in filter
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapLoaded) return;

      if (!selectedKabupatenId) {
        map.flyTo({
          center: RIAU_CENTER,
          zoom: RIAU_ZOOM,
          duration: 900,
        });
        return;
      }

      const idNum = Number(selectedKabupatenId);
      const areaFeature = adminAreas?.features.find((f) => f.properties.id === idNum);

      if (areaFeature) {
        try {
          const coords = areaFeature.geometry.coordinates;
          const flatCoords: number[][] = [];
          if (areaFeature.geometry.type === "MultiPolygon") {
            for (const poly of coords) {
              for (const ring of poly) {
                flatCoords.push(...ring);
              }
            }
          } else if ((areaFeature.geometry.type as string) === "Polygon") {
            const polyCoords = coords as unknown as number[][][];
            for (const ring of polyCoords) {
              flatCoords.push(...ring);
            }
          }

          if (flatCoords.length > 0) {
            const lons = flatCoords.map((c) => c[0]);
            const lats = flatCoords.map((c) => c[1]);
            const minLon = Math.min(...lons);
            const maxLon = Math.max(...lons);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const centerLon = (minLon + maxLon) / 2;
            const centerLat = (minLat + maxLat) / 2;

            map.flyTo({
              center: [centerLon, centerLat],
              zoom: Math.max(map.getZoom(), 8.8),
              duration: 900,
            });
            return;
          }
        } catch {
          // Fall through
        }
      }

      // Fallback: center on first area hotspot
      const areaHotspots = hotspots?.features.filter(
        (f) => (f.properties as unknown as Record<string, unknown>).kabupaten_id === idNum
      );
      if (areaHotspots && areaHotspots.length > 0) {
        map.flyTo({
          center: areaHotspots[0].geometry.coordinates as [number, number],
          zoom: 9.0,
          duration: 900,
        });
      }
    }, [selectedKabupatenId, adminAreas, hotspots, mapLoaded]);

    // Add/update KHG (Kesatuan Hidrologis Gambut) Layer (Modul 3)
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapLoaded) return;

      const sourceId = "khg-source";
      const fillLayerId = "khg-fill";
      const lineLayerId = "khg-line";
      const labelLayerId = "khg-label";

      if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId);
      if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
      if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      if (!showKHG) return;

      map.addSource(sourceId, {
        type: "geojson",
        data: KHG_RIAU_GEOJSON as unknown as GeoJSON.FeatureCollection,
      });

      const beforeId = map.getLayer("hotspot-clusters") ? "hotspot-clusters" : undefined;

      // Semi-transparent peatland fill (Vivid Amber/Peat tone)
      map.addLayer(
        {
          id: fillLayerId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": "rgba(217, 119, 6, 0.22)",
            "fill-outline-color": "#b45309",
          },
        },
        beforeId,
      );

      // Peatland boundary border
      map.addLayer(
        {
          id: lineLayerId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": "#b45309",
            "line-width": 2.5,
            "line-dasharray": [4, 2],
          },
        },
        beforeId,
      );

      // KHG Label
      map.addLayer(
        {
          id: labelLayerId,
          type: "symbol",
          source: sourceId,
          layout: {
            "text-field": ["get", "nama_khg"],
            "text-size": 11,
            "text-allow-overlap": false,
          },
          paint: {
            "text-color": "#7c2d12",
            "text-halo-color": "#ffffff",
            "text-halo-width": 2,
          },
        },
        beforeId,
      );
    }, [showKHG, mapLoaded]);

    // Add/update Wind Vector Overlay (Modul 3)
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapLoaded) return;

      const sourceId = "wind-source";
      const circleLayerId = "wind-circles";
      const arrowLayerId = "wind-arrows";
      const labelLayerId = "wind-labels";

      if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId);
      if (map.getLayer(arrowLayerId)) map.removeLayer(arrowLayerId);
      if (map.getLayer(circleLayerId)) map.removeLayer(circleLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      if (!showWind) return;

      map.addSource(sourceId, {
        type: "geojson",
        data: generateWindGeoJSON() as unknown as GeoJSON.FeatureCollection,
      });

      // Distinct circular badge for wind vectors
      map.addLayer({
        id: circleLayerId,
        type: "circle",
        source: sourceId,
        paint: {
          "circle-radius": 13,
          "circle-color": "#2563eb",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Centered directional arrow inside the badge
      map.addLayer({
        id: arrowLayerId,
        type: "symbol",
        source: sourceId,
        layout: {
          "text-field": ["get", "arrow"],
          "text-size": 15,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      // Label below badge (e.g. Pekanbaru: 12.5 km/j)
      map.addLayer({
        id: labelLayerId,
        type: "symbol",
        source: sourceId,
        layout: {
          "text-field": ["get", "display_text"],
          "text-size": 11,
          "text-offset": [0, 1.4],
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#1e3a8a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2.5,
        },
      });
    }, [showWind, mapLoaded]);

    // Add/update hotspot source and layers
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapLoaded) return;

      const sourceId = "hotspots";
      const clusterLayerId = "hotspot-clusters";
      const countLayerId = "hotspot-clusters-count";
      const unclusteredLayerId = "hotspot-points";

      // Remove existing layers and source
      if (map.getLayer(countLayerId)) map.removeLayer(countLayerId);
      if (map.getLayer(clusterLayerId)) map.removeLayer(clusterLayerId);
      if (map.getLayer(unclusteredLayerId)) map.removeLayer(unclusteredLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      if (!showHotspots || !hotspots) return;

      // Add GeoJSON source with clustering
      map.addSource(sourceId, {
        type: "geojson",
        data: hotspots,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      // Expose for E2E testing
      if (typeof window !== "undefined") {
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
            "#d97706", // amber-600 (5-15)
            30,
            "#0f172a", // solid jet black (15+)
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            16,
            10,
            24,
            30,
            32,
          ],
          "circle-stroke-width": 2.5,
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
          "text-size": 12,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      // Individual hotspot points: Distinct Color Scheme
      // High = Solid Black (#0f172a), Nominal = Amber/Orange (#d97706), Low = Mangrove Green (#16a34a)
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
            "#0f172a", // Solid Jet Black for High
            "h",
            "#0f172a", // Solid Jet Black for h
            "nominal",
            "#d97706", // Amber / Oranye for Nominal
            "n",
            "#d97706", // Amber / Oranye for n
            "#16a34a", // Mangrove Green for Low / Other
          ],
          "circle-radius": 7.5,
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
    }, [hotspots, showHotspots, mapLoaded, onHotspotClick]);

    // Add/update boundaries layer
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapLoaded) return;

      const sourceId = "boundaries";
      const fillLayerId = "boundaries-fill";
      const lineLayerId = "boundaries-line";
      const labelLayerId = "boundaries-label";

      if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId);
      if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
      if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      if (!showBoundaries || !adminAreas || adminAreas.features.length === 0) return;

      map.addSource(sourceId, {
        type: "geojson",
        data: adminAreas as unknown as GeoJSON.FeatureCollection,
      });

      const beforeId = map.getLayer("hotspot-clusters") ? "hotspot-clusters" : undefined;

      map.addLayer(
        {
          id: fillLayerId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": "rgba(30, 41, 59, 0.08)",
            "fill-outline-color": "#1e293b",
          },
        },
        beforeId,
      );

      map.addLayer(
        {
          id: lineLayerId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": "#1e293b",
            "line-width": 2,
            "line-dasharray": [4, 2],
          },
        },
        beforeId,
      );

      map.addLayer(
        {
          id: labelLayerId,
          type: "symbol",
          source: sourceId,
          layout: {
            "text-field": ["get", "name"],
            "text-size": 11,
            "text-allow-overlap": false,
          },
          paint: {
            "text-color": "#0f172a",
            "text-halo-color": "#ffffff",
            "text-halo-width": 2,
          },
        },
        beforeId,
      );

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
        className="relative w-full overflow-hidden rounded-xl border border-rw-smoke-200 bg-rw-smoke-100 shadow-sm"
        data-testid="hotspot-map"
        role="img"
        aria-label="Peta interaktif titik panas Riau"
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <div className="flex items-center gap-2 text-sm text-rw-smoke-600">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Memuat peta...
            </div>
          </div>
        )}

        {/* Map Canvas */}
        <div ref={mapContainer} className="w-full h-[400px] sm:h-[500px] lg:h-[600px]" />

        {/* Floating Quick Map Legend Card (Top-Left on Map) */}
        <div className="absolute top-3 left-3 z-10 hidden sm:flex items-center gap-3 bg-white/95 backdrop-blur-xs px-3 py-2 rounded-lg border border-rw-smoke-200/80 shadow-md text-xs pointer-events-none select-none">
          <div className="flex items-center gap-1.5 font-semibold text-rw-peat-900">
            <svg className="h-3.5 w-3.5 text-rw-sienna-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <span>Titik Panas:</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-slate-900 ring-1 ring-white" />
            <span className="text-slate-900 font-bold">Tinggi</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-amber-500 ring-1 ring-white" />
            <span className="text-amber-800 font-medium">Sedang</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-green-600 ring-1 ring-white" />
            <span className="text-green-800 font-medium">Rendah</span>
          </div>
        </div>
      </div>
    );
  },
);
