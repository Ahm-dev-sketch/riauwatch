/**
 * Modul 3: Vektor Arah Angin & Konteks WebGIS Riau
 *
 * Menyediakan data komponen angin permukaan (10 meter) melintasi 12 Kabupaten/Kota di Riau
 * untuk memvisualisasikan arah pergerakan kabut asap (transboundary haze dispersion).
 */

import type { WindPoint } from "./types";

export const RIAU_WIND_GRID_POINTS: WindPoint[] = [
  { lat: 0.53, lon: 101.44, name: "Pekanbaru", speed_kmh: 12.5, direction_deg: 165 }, // Dari Selatan menuju Utara
  { lat: 1.68, lon: 101.45, name: "Dumai", speed_kmh: 14.2, direction_deg: 160 },
  { lat: 1.48, lon: 102.12, name: "Bengkalis", speed_kmh: 16.0, direction_deg: 155 },
  { lat: -0.32, lon: 103.15, name: "Indragiri Hilir", speed_kmh: 15.8, direction_deg: 170 },
  { lat: -0.45, lon: 102.35, name: "Indragiri Hulu", speed_kmh: 13.6, direction_deg: 165 },
  { lat: 0.35, lon: 101.02, name: "Kampar", speed_kmh: 10.4, direction_deg: 160 },
  { lat: 0.98, lon: 102.72, name: "Kepulauan Meranti", speed_kmh: 18.5, direction_deg: 150 },
  { lat: -0.55, lon: 101.45, name: "Kuantan Singingi", speed_kmh: 11.2, direction_deg: 175 },
  { lat: 0.15, lon: 102.05, name: "Pelalawan", speed_kmh: 14.0, direction_deg: 165 },
  { lat: 1.95, lon: 100.82, name: "Rokan Hilir", speed_kmh: 13.0, direction_deg: 160 },
  { lat: 0.85, lon: 100.28, name: "Rokan Hulu", speed_kmh: 9.8, direction_deg: 160 },
  { lat: 0.82, lon: 101.88, name: "Siak", speed_kmh: 13.4, direction_deg: 160 },
];

function getCompassInfo(deg: number): { arrow: string; label: string } {
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return { arrow: "↑", label: "Utara" };
  if (normalized >= 22.5 && normalized < 67.5) return { arrow: "↗", label: "Timur Laut" };
  if (normalized >= 67.5 && normalized < 112.5) return { arrow: "→", label: "Timur" };
  if (normalized >= 112.5 && normalized < 157.5) return { arrow: "↘", label: "Tenggara" };
  if (normalized >= 157.5 && normalized < 202.5) return { arrow: "↓", label: "Selatan" };
  if (normalized >= 202.5 && normalized < 247.5) return { arrow: "↙", label: "Barat Daya" };
  if (normalized >= 247.5 && normalized < 292.5) return { arrow: "←", label: "Barat" };
  return { arrow: "↖", label: "Barat Laut" };
}

/**
 * Konversi kecepatan & derajat arah angin ke GeoJSON FeatureCollection untuk WebGIS layer
 */
export function generateWindGeoJSON(points: WindPoint[] = RIAU_WIND_GRID_POINTS) {
  return {
    type: "FeatureCollection" as const,
    features: points.map((p, idx) => {
      const compass = getCompassInfo(p.direction_deg);
      return {
        type: "Feature" as const,
        id: idx + 1,
        geometry: {
          type: "Point" as const,
          coordinates: [p.lon, p.lat],
        },
        properties: {
          name: p.name,
          speed_kmh: p.speed_kmh,
          direction_deg: p.direction_deg,
          arrow: compass.arrow,
          compass_label: compass.label,
          display_text: `${compass.arrow} ${p.speed_kmh} km/j`,
          full_label: `${p.name}: ${compass.arrow} ${p.speed_kmh} km/j (${compass.label})`,
        },
      };
    }),
  };
}
