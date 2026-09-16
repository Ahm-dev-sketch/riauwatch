/**
 * Modul Geolocation Lintas Perangkat (iOS/Apple Safari, Android, Windows, macOS)
 * & Reverse Geocoding Universal (Dalam & Luar Provinsi Riau).
 */

import { resolveRiauLocation, RIAU_KABUPATEN_GEOMETRY } from "./geo";

export interface GeoLocationResult {
  latitude: number;
  longitude: number;
  source: "gps" | "network" | "ip_fallback";
}

export interface UniversalLocationInfo {
  inRiau: boolean;
  cityOrDistrict: string;
  fullLocationName: string;
  closestRiauKabupaten: string;
  closestRiauKabupatenId: number;
  distanceToRiauKm: number;
}

export interface GridAirQuality {
  pm25: number;
  pm10: number;
  isModelEstimate: boolean;
}

/**
 * Fallback estimasi lokasi via IP publik jika GPS perangkat dinonaktifkan/ditolak
 */
export async function getIpGeolocation(): Promise<GeoLocationResult | null> {
  const endpoints = [
    "https://ipapi.co/json/",
    "https://freeipapi.com/api/json",
    "https://ipwhois.app/json/",
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        const lat = Number(data.latitude ?? data.lat);
        const lon = Number(data.longitude ?? data.lon);
        if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
          return {
            latitude: lat,
            longitude: lon,
            source: "ip_fallback",
          };
        }
      }
    } catch {
      // Coba endpoint alternatif berikutnya
    }
  }

  // Default titik tengah Riau jika seluruh IP lookup gagal
  return {
    latitude: 0.5333,
    longitude: 101.45,
    source: "ip_fallback",
  };
}

/**
 * Deteksi apakah koordinat berada di dalam wilayah administratif Provinsi Riau
 */
export function isCoordinateInsideRiau(lat: number, lon: number): boolean {
  return lon >= 99.8 && lon <= 103.95 && lat >= -1.8 && lat <= 2.75;
}

function calcEuclideanDistKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * 111.32;
  const dLon = (lon2 - lon1) * 111.32 * Math.cos(((lat1 + lat2) * Math.PI) / 360);
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

/**
 * Reverse Geocoding pintar untuk mengenali lokasi pengguna di dalam maupun di luar Riau (misal: Padang, Medan, Jambi, Jakarta)
 */
export async function reverseGeocodeUniversal(
  lat: number,
  lon: number,
  providedAreaName?: string | null,
): Promise<UniversalLocationInfo> {
  const inRiau = isCoordinateInsideRiau(lat, lon);
  const riauResolved = resolveRiauLocation(lat, lon, providedAreaName);

  // Cari kabupaten Riau yang paling dekat
  let closestKab = RIAU_KABUPATEN_GEOMETRY[0];
  let minDistance = Infinity;

  for (const kab of RIAU_KABUPATEN_GEOMETRY) {
    const dist = calcEuclideanDistKm(lat, lon, kab.centroid[0], kab.centroid[1]);
    if (dist < minDistance) {
      minDistance = dist;
      closestKab = kab;
    }
  }

  if (inRiau && !riauResolved.isBorderSector) {
    return {
      inRiau: true,
      cityOrDistrict: riauResolved.kabupatenName,
      fullLocationName: riauResolved.fullDescription,
      closestRiauKabupaten: riauResolved.kabupatenName,
      closestRiauKabupatenId: riauResolved.kabupatenId,
      distanceToRiauKm: 0,
    };
  }

  // Jika di luar Riau, coba fetch nama kota sebenarnya dari reverse geocoding publik
  let externalCityName = "";
  let externalProvinceName = "";

  try {
    const geoUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=id`;
    const res = await fetch(geoUrl, { cache: "no-store", signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      externalCityName = data.city || data.locality || data.principalSubdivision || "";
      externalProvinceName = data.principalSubdivision || data.countryName || "";
    }
  } catch {
    // Fallback heuristic jika lookup reverse geocode offline
    if (lat < -0.3 && lon < 101.0) externalCityName = "Sumatera Barat";
    else if (lat < -0.8 && lon >= 102.0) externalCityName = "Jambi";
    else if (lat > 1.8 && lon < 100.2) externalCityName = "Sumatera Utara";
    else externalCityName = "Luar Provinsi Riau";
  }

  const cityName = externalCityName
    ? `${externalCityName}${externalProvinceName && !externalCityName.includes(externalProvinceName) ? `, ${externalProvinceName}` : ""}`
    : `Luar Riau (Koordinat: ${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`;

  return {
    inRiau: false,
    cityOrDistrict: externalCityName || "Luar Riau",
    fullLocationName: cityName,
    closestRiauKabupaten: closestKab.name,
    closestRiauKabupatenId: closestKab.id,
    distanceToRiauKm: Math.round(minDistance),
  };
}

/**
 * Ambil data kualitas udara model satelit (CAMS Open-Meteo) presisi di titik koordinat manapun di bumi
 */
export async function fetchGridAirQuality(lat: number, lon: number): Promise<GridAirQuality | null> {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5,pm10`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      const current = data.current;
      if (current && typeof current.pm2_5 === "number") {
        return {
          pm25: current.pm2_5,
          pm10: current.pm10 ?? current.pm2_5 * 1.35,
          isModelEstimate: true,
        };
      }
    }
  } catch {
    // Non-critical
  }
  return null;
}
