/**
 * Data Spasial Kesatuan Hidrologis Gambut (KHG) Provinsi Riau
 * Berdasarkan pemetaan indikatif Badan Restorasi Gambut dan Mangrove (BRGM) & KLHK.
 * Digunakan untuk WebGIS layer overlay dan deteksi apakah titik panas berada di lahan gambut.
 */

export interface KHGFeature {
  type: "Feature";
  properties: {
    id: string;
    nama_khg: string;
    kabupaten: string;
    kedalaman_tipikal: string; // e.g., "Sangat Dalam (> 3 meter)"
    tipe_ekosistem: string;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

export interface KHGCollection {
  type: "FeatureCollection";
  features: KHGFeature[];
}

// Major Peatland Hydrological Units (KHG) covering Riau peat domes:
export const KHG_RIAU_GEOJSON: KHGCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        id: "KHG-01",
        nama_khg: "KHG Sungai Siak - Sungai Kampar",
        kabupaten: "Kab. Siak, Kab. Pelalawan",
        kedalaman_tipikal: "Sangat Dalam (> 3 meter)",
        tipe_ekosistem: "Kubah Gambut Dangkal & Dalam",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [101.40, 0.45],
            [102.30, 0.45],
            [102.50, 0.95],
            [101.80, 1.15],
            [101.40, 0.85],
            [101.40, 0.45],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "KHG-02",
        nama_khg: "KHG Pulau Bengkalis",
        kabupaten: "Kab. Bengkalis",
        kedalaman_tipikal: "Dalam (2 - 3 meter)",
        tipe_ekosistem: "Gambut Pulau Kecil & Pesisir",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [101.95, 1.30],
            [102.45, 1.30],
            [102.55, 1.70],
            [102.15, 1.85],
            [101.95, 1.55],
            [101.95, 1.30],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "KHG-03",
        nama_khg: "KHG Sungai Rokan - Sungai Siak (Mandau)",
        kabupaten: "Kab. Bengkalis, Kab. Rokan Hilir, Kab. Siak",
        kedalaman_tipikal: "Sangat Dalam (> 3 meter)",
        tipe_ekosistem: "Kubah Gambut Duri - Kandis",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [100.90, 1.05],
            [101.60, 1.05],
            [101.65, 1.65],
            [101.10, 1.75],
            [100.85, 1.35],
            [100.90, 1.05],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "KHG-04",
        nama_khg: "KHG Sungai Kampar - Sungai Indragiri",
        kabupaten: "Kab. Pelalawan, Kab. Indragiri Hulu, Kab. Indragiri Hilir",
        kedalaman_tipikal: "Sangat Dalam (> 4 meter)",
        tipe_ekosistem: "Kubah Gambut Teluk Meranti & Semenanjung Kampar",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [102.00, -0.40],
            [103.20, -0.40],
            [103.35, 0.45],
            [102.50, 0.45],
            [102.00, 0.10],
            [102.00, -0.40],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "KHG-05",
        nama_khg: "KHG Sungai Indragiri - Sungai Batanghari",
        kabupaten: "Kab. Indragiri Hilir, Kab. Indragiri Hulu",
        kedalaman_tipikal: "Dalam (2 - 3 meter)",
        tipe_ekosistem: "Kawasan Rawa Gambut Selatan",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [102.40, -1.05],
            [103.65, -1.05],
            [103.55, -0.40],
            [102.60, -0.40],
            [102.40, -0.80],
            [102.40, -1.05],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "KHG-06",
        nama_khg: "KHG Senepis - Sungai Dumai",
        kabupaten: "Kota Dumai, Kab. Rokan Hilir",
        kedalaman_tipikal: "Sedang (1 - 2 meter)",
        tipe_ekosistem: "Rawa Gambut Pesisir Utara",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [101.10, 1.55],
            [101.75, 1.55],
            [101.75, 1.85],
            [101.20, 1.85],
            [101.10, 1.55],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "KHG-07",
        nama_khg: "KHG Pulau Tebing Tinggi & Rangsang",
        kabupaten: "Kab. Kepulauan Meranti",
        kedalaman_tipikal: "Sangat Dalam (> 3 meter)",
        tipe_ekosistem: "Kubah Gambut Pulau Terluar",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [102.50, 0.75],
            [103.30, 0.75],
            [103.35, 1.35],
            [102.60, 1.35],
            [102.50, 0.75],
          ],
        ],
      },
    },
  ],
};

/**
 * Point-in-polygon ray casting algorithm to check if coordinate is in peatland (KHG).
 */
function pointInPolygon(point: [number, number], polygon: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Pre-computed bounding boxes for fast spatial indexing
const KHG_BBOXES = KHG_RIAU_GEOJSON.features.map((f) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const poly = f.geometry.coordinates[0] as number[][];
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, feature: f };
});

/**
 * Check if a given [lat, lon] coordinate is inside Riau's Peatland Hydrological Unit (KHG).
 */
export function isCoordinateInPeatland(lat: number, lon: number): { inPeatland: boolean; khgName?: string } {
  for (const b of KHG_BBOXES) {
    if (lon < b.minX || lon > b.maxX || lat < b.minY || lat > b.maxY) {
      continue;
    }
    const coords = b.feature.geometry.coordinates as number[][][];
    if (coords.length > 0 && pointInPolygon([lon, lat], coords[0])) {
      return { inPeatland: true, khgName: b.feature.properties.nama_khg };
    }
  }
  return { inPeatland: false };
}
