/**
 * Modul 1: Pipeline Deduplikasi & Fusi Data NASA FIRMS (MODIS + VIIRS)
 *
 * Mengatasi 'double-counting' akibat perbedaan resolusi spasial VIIRS (375m) dan MODIS (1km).
 * Melakukan deduplikasi spasio-temporal:
 * - Jarak <= 1 km
 * - Selisih waktu deteksi <= 3 jam
 * Memprioritaskan koordinat resolusi tinggi VIIRS (375m) dan menyimpan nilai FRP maksimum.
 */

import type { HotspotFeature, HotspotProperties, SensorType, ConfidenceCategory } from "./types";
import { isCoordinateInPeatland } from "./khg";
import { resolveRiauLocation } from "./geo";

/**
 * Interface Terpadu Deteksi NASA FIRMS (Unified FIRMS Schema)
 */
export interface UnifiedHotspot {
  id: string | number;
  lat: number;
  lon: number;
  confidence: string;
  confidenceCategory: ConfidenceCategory;
  confidenceValue: number | null;
  frp: number | null;
  acqDatetime: string;
  satellite: string;
  instrument: string | null;
  daynight: string | null;
  areaName: string | null;
  kabupatenId?: number | null;
  sensor: SensorType;
  rawDetectionsCount: number;
  inPeatland?: boolean;
}

/**
 * Hitung jarak lingkaran besar (Great Circle / Haversine) dalam kilometer.
 */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius Bumi dalam km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Normalisasi Kategori Kepercayaan (MODIS & VIIRS):
 * - MODIS: >=80% ('high'), 30-79% ('nominal'), <30% ('low')
 * - VIIRS: 'h'/'high' ('high'), 'n'/'nominal' ('nominal'), 'l'/'low' ('low')
 */
export function normalizeConfidenceCategory(
  confidence: string | null,
  confidenceValue: number | null,
): ConfidenceCategory {
  const confStr = (confidence || "").toLowerCase();

  if (confidenceValue != null) {
    if (confidenceValue >= 80) return "high";
    if (confidenceValue >= 30) return "nominal";
    return "low";
  }

  if (confStr === "h" || confStr === "high") return "high";
  if (confStr === "n" || confStr === "nominal") return "nominal";
  if (confStr === "l" || confStr === "low") return "low";

  // Fallback check based on MODIS instrument if value was passed in string
  const numVal = parseFloat(confStr);
  if (!isNaN(numVal)) {
    if (numVal >= 80) return "high";
    if (numVal >= 30) return "nominal";
    return "low";
  }

  return "nominal";
}

/**
 * Deteksi Tipe Sensor dari Nama Satelit / Instrumen
 */
export function detectSensorType(instrument: string | null, satellite: string | null): "VIIRS" | "MODIS" {
  const str = `${instrument || ""} ${satellite || ""}`.toUpperCase();
  if (str.includes("MODIS") || str.includes("TERRA") || str.includes("AQUA")) {
    return "MODIS";
  }
  return "VIIRS";
}

export interface FusionResult {
  fusedFeatures: HotspotFeature[];
  totalRawDetections: number;
  activeClustersCount: number; // Kluster aktif (non-low atau total)
  rawCountsByKabupaten: Record<string, number>;
  clusterCountsByKabupaten: Record<string, number>;
}

/**
 * Fusi & Deduplikasi Spasio-Temporal Data Hotspot NASA FIRMS (MODIS + VIIRS)
 * Menggabungkan deteksi dalam radius <= 1.0 km dan rentang waktu <= 3 jam.
 */
export function fuseAndDeduplicateHotspots(
  rawFeatures: HotspotFeature[],
  includeLowConfidence: boolean = true,
): FusionResult {
  if (!rawFeatures || rawFeatures.length === 0) {
    return {
      fusedFeatures: [],
      totalRawDetections: 0,
      activeClustersCount: 0,
      rawCountsByKabupaten: {},
      clusterCountsByKabupaten: {},
    };
  }

  // 1. Normalisasi setiap record ke objek terpadu
  const unifiedList: UnifiedHotspot[] = rawFeatures.map((f, idx) => {
    const coords = f.geometry.coordinates;
    const props = f.properties;
    const lon = coords[0];
    const lat = coords[1];
    const sensor = detectSensorType(props.instrument, props.satellite);
    const confCat = normalizeConfidenceCategory(props.confidence, props.confidence_value);
    const frp = props.frp != null ? Number(props.frp) : null;
    const peatlandCheck = isCoordinateInPeatland(lat, lon);
    const resolvedGeo = resolveRiauLocation(lat, lon, props.area_name);

    return {
      id: props.id ?? idx + 1,
      lat,
      lon,
      confidence: props.confidence || "n",
      confidenceCategory: confCat,
      confidenceValue: props.confidence_value != null ? Number(props.confidence_value) : null,
      frp,
      acqDatetime: props.acquired_at || new Date().toISOString(),
      satellite: props.satellite,
      instrument: props.instrument,
      daynight: props.daynight,
      areaName: resolvedGeo.kabupatenName,
      kabupatenId: props.kabupaten_id ?? resolvedGeo.kabupatenId,
      sensor,
      rawDetectionsCount: 1,
      inPeatland: peatlandCheck.inPeatland,
    };
  });

  // 2. Fast Spatial-Grid Spatio-Temporal Clustering (<= 1.0 km & <= 3 hours)
  const visited = new Set<number>();
  const clusters: UnifiedHotspot[] = [];
  const MAX_DISTANCE_KM = 1.0;
  const MAX_TIME_DIFF_MS = 3 * 3600 * 1000; // 3 jam
  const GRID_SIZE = 0.01; // ~1.1 km cell size for O(N) spatial lookup

  // Build Spatial Grid Index
  const grid = new Map<string, number[]>();
  for (let i = 0; i < unifiedList.length; i++) {
    const item = unifiedList[i];
    const gx = Math.floor(item.lat / GRID_SIZE);
    const gy = Math.floor(item.lon / GRID_SIZE);
    const key = `${gx}_${gy}`;
    const list = grid.get(key);
    if (list) {
      list.push(i);
    } else {
      grid.set(key, [i]);
    }
  }

  for (let i = 0; i < unifiedList.length; i++) {
    if (visited.has(i)) continue;
    visited.add(i);

    const base = unifiedList[i];
    const group = [base];
    const baseTime = new Date(base.acqDatetime).getTime();

    const gx = Math.floor(base.lat / GRID_SIZE);
    const gy = Math.floor(base.lon / GRID_SIZE);

    // Check only adjacent 9 cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const neighborKey = `${gx + dx}_${gy + dy}`;
        const neighborIndices = grid.get(neighborKey);
        if (!neighborIndices) continue;

        for (const j of neighborIndices) {
          if (visited.has(j)) continue;
          const candidate = unifiedList[j];
          const candTime = new Date(candidate.acqDatetime).getTime();

          // Check time difference
          if (Math.abs(baseTime - candTime) <= MAX_TIME_DIFF_MS) {
            // Check spatial distance
            const dist = haversineDistanceKm(base.lat, base.lon, candidate.lat, candidate.lon);
            if (dist <= MAX_DISTANCE_KM) {
              visited.add(j);
              group.push(candidate);
            }
          }
        }
      }
    }

    // 3. Fusi group menjadi 1 kluster insiden
    // Prioritaskan koordinat VIIRS (resolusi 375m lebih tajam dari MODIS 1km)
    const viirsItem = group.find((item) => item.sensor === "VIIRS");
    const primaryItem = viirsItem || group[0];

    const hasViirs = group.some((item) => item.sensor === "VIIRS");
    const hasModis = group.some((item) => item.sensor === "MODIS");
    const sensorType: SensorType = hasViirs && hasModis ? "MERGED" : primaryItem.sensor;

    // Hitung FRP maksimum dalam kluster
    const maxFrp = group.reduce<number | null>((max, item) => {
      if (item.frp == null) return max;
      if (max == null) return item.frp;
      return Math.max(max, item.frp);
    }, null);

    // Kategori confidence tertinggi ('high' > 'nominal' > 'low')
    let highestConf: ConfidenceCategory = "low";
    if (group.some((g) => g.confidenceCategory === "high")) highestConf = "high";
    else if (group.some((g) => g.confidenceCategory === "nominal")) highestConf = "nominal";

    const inPeat = group.some((g) => g.inPeatland);

    clusters.push({
      ...primaryItem,
      sensor: sensorType,
      frp: maxFrp,
      confidenceCategory: highestConf,
      confidence: highestConf === "high" ? "h" : highestConf === "nominal" ? "n" : "l",
      rawDetectionsCount: group.length,
      inPeatland: inPeat,
    });
  }

  // 4. Hitung statistik agregasi
  const rawCountsByKabupaten: Record<string, number> = {};
  for (const item of unifiedList) {
    const area = item.areaName || "Tidak Diketahui";
    rawCountsByKabupaten[area] = (rawCountsByKabupaten[area] || 0) + 1;
  }

  const clusterCountsByKabupaten: Record<string, number> = {};
  for (const cl of clusters) {
    const area = cl.areaName || "Tidak Diketahui";
    clusterCountsByKabupaten[area] = (clusterCountsByKabupaten[area] || 0) + 1;
  }

  // 5. Konversi cluster kembali ke GeoJSON FeatureCollection
  const filteredClusters = includeLowConfidence
    ? clusters
    : clusters.filter((c) => c.confidenceCategory !== "low");

  const activeClustersCount = clusters.filter((c) => c.confidenceCategory !== "low").length;

  const fusedFeatures: HotspotFeature[] = filteredClusters.map((c) => {
    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [c.lon, c.lat],
      },
      properties: {
        id: c.id,
        satellite: c.satellite,
        instrument: c.instrument,
        confidence: c.confidence,
        confidence_value: c.confidenceValue,
        confidence_category: c.confidenceCategory,
        daynight: c.daynight,
        frp: c.frp,
        acquired_at: c.acqDatetime,
        area_name: c.areaName,
        kabupaten_id: c.kabupatenId,
        hotspot_indication: true,
        sensor: c.sensor,
        raw_detections_count: c.rawDetectionsCount,
        in_peatland: c.inPeatland,
      } as HotspotProperties,
    };
  });

  return {
    fusedFeatures,
    totalRawDetections: unifiedList.length,
    activeClustersCount: activeClustersCount > 0 ? activeClustersCount : clusters.length,
    rawCountsByKabupaten,
    clusterCountsByKabupaten,
  };
}
