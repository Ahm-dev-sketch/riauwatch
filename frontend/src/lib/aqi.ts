/**
 * Modul Konversi & Interpolasi Kualitas Udara RIAUWATCH
 *
 * Standar yang didukung:
 * 1. ISPU Indonesia (Peraturan Menteri Lingkungan Hidup dan Kehutanan No. 14 Tahun 2020)
 * 2. US-AQI / PSI (US EPA Standard)
 *
 * Formula Linear Interpolation:
 * I = ((I_high - I_low) / (C_high - C_low)) * (C - C_low) + I_low
 */

export type AirQualityCategory =
  | "Baik"
  | "Sedang"
  | "Tidak Sehat"
  | "Sangat Tidak Sehat"
  | "Berbahaya";

export interface IndexDetail {
  value: number;
  category: AirQualityCategory;
  colorHex: string;
  tailwindText: string;
  tailwindBg: string;
  tailwindBorder: string;
  healthRecommendation: string;
}

export interface AirQualityConversionResult {
  rawPm25: number;
  ispu: IndexDetail;
  usAqi: IndexDetail;
}

interface Breakpoint {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
  category: AirQualityCategory;
  colorHex: string;
  tailwindText: string;
  tailwindBg: string;
  tailwindBorder: string;
  recommendation: string;
}

// Tabel Standar ISPU PM2.5 (Permen LHK No. 14 Tahun 2020)
export const ISPU_BREAKPOINTS: Breakpoint[] = [
  {
    cLow: 0.0,
    cHigh: 15.5,
    iLow: 0,
    iHigh: 50,
    category: "Baik",
    colorHex: "#15803d",
    tailwindText: "text-emerald-800",
    tailwindBg: "bg-emerald-50",
    tailwindBorder: "border-emerald-200",
    recommendation: "Kualitas udara sangat baik. Seluruh masyarakat dapat leluasa beraktivitas fisik di luar ruangan.",
  },
  {
    cLow: 15.6,
    cHigh: 55.4,
    iLow: 51,
    iHigh: 100,
    category: "Sedang",
    colorHex: "#b45309",
    tailwindText: "text-amber-800",
    tailwindBg: "bg-amber-50",
    tailwindBorder: "border-amber-200",
    recommendation: "Kelompok rentan (anak-anak, lansia, wanita hamil, penderita asma/paru) disarankan membatasi aktivitas berat di luar ruangan.",
  },
  {
    cLow: 55.5,
    cHigh: 150.4,
    iLow: 101,
    iHigh: 200,
    category: "Tidak Sehat",
    colorHex: "#b91c1c",
    tailwindText: "text-rose-700",
    tailwindBg: "bg-rose-50",
    tailwindBorder: "border-rose-200",
    recommendation: "Gunakan masker respiratori (N95/KN95/KF94) saat berada di luar rumah dan tutup rapat ventilasi/jendela.",
  },
  {
    cLow: 150.5,
    cHigh: 250.4,
    iLow: 201,
    iHigh: 300,
    category: "Sangat Tidak Sehat",
    colorHex: "#7e22ce",
    tailwindText: "text-purple-800",
    tailwindBg: "bg-purple-50",
    tailwindBorder: "border-purple-200",
    recommendation: "Hindari semua aktivitas di luar ruangan. Nyalakan alat pembersih udara (HEPA filter) di dalam rumah.",
  },
  {
    cLow: 250.5,
    cHigh: 500.0,
    iLow: 301,
    iHigh: 500,
    category: "Berbahaya",
    colorHex: "#450a0a",
    tailwindText: "text-red-950",
    tailwindBg: "bg-red-100",
    tailwindBorder: "border-red-400",
    recommendation: "STATUS DARURAT: Tetap berada di dalam ruangan berfilter udara. Segera ke posko kesehatan jika mengalami sesak napas akut.",
  },
];

// Tabel Standar US-AQI / PSI PM2.5 (US EPA Standard)
export const US_AQI_BREAKPOINTS: Breakpoint[] = [
  {
    cLow: 0.0,
    cHigh: 12.0,
    iLow: 0,
    iHigh: 50,
    category: "Baik",
    colorHex: "#15803d",
    tailwindText: "text-emerald-800",
    tailwindBg: "bg-emerald-50",
    tailwindBorder: "border-emerald-200",
    recommendation: "Udara bersih, tidak berisiko bagi kesehatan masyarakat.",
  },
  {
    cLow: 12.1,
    cHigh: 35.4,
    iLow: 51,
    iHigh: 100,
    category: "Sedang",
    colorHex: "#b45309",
    tailwindText: "text-amber-800",
    tailwindBg: "bg-amber-50",
    tailwindBorder: "border-amber-200",
    recommendation: "Individu yang sangat sensitif disarankan mengurangi aktivitas di luar ruangan dalam waktu lama.",
  },
  {
    cLow: 35.5,
    cHigh: 55.4,
    iLow: 101,
    iHigh: 150,
    category: "Tidak Sehat",
    colorHex: "#c2410c",
    tailwindText: "text-orange-800",
    tailwindBg: "bg-orange-50",
    tailwindBorder: "border-orange-200",
    recommendation: "Kelompok sensitif berisiko mengalami gangguan pernapasan; gunakan masker penyaring debu halus.",
  },
  {
    cLow: 55.5,
    cHigh: 150.4,
    iLow: 151,
    iHigh: 200,
    category: "Tidak Sehat",
    colorHex: "#b91c1c",
    tailwindText: "text-rose-700",
    tailwindBg: "bg-rose-50",
    tailwindBorder: "border-rose-200",
    recommendation: "Seluruh warga mulai merasakan dampak kesehatan; kurangi aktivitas di luar dan kenakan masker standar.",
  },
  {
    cLow: 150.5,
    cHigh: 250.4,
    iLow: 201,
    iHigh: 300,
    category: "Sangat Tidak Sehat",
    colorHex: "#7e22ce",
    tailwindText: "text-purple-800",
    tailwindBg: "bg-purple-50",
    tailwindBorder: "border-purple-200",
    recommendation: "Peringatan kesehatan darurat bagi seluruh populasi; isolasi diri di dalam ruangan bersih.",
  },
  {
    cLow: 250.5,
    cHigh: 500.0,
    iLow: 301,
    iHigh: 500,
    category: "Berbahaya",
    colorHex: "#450a0a",
    tailwindText: "text-red-950",
    tailwindBg: "bg-red-100",
    tailwindBorder: "border-red-400",
    recommendation: "Kondisi sangat berbahaya. Hindari bepergian keluar ruangan tanpa perlindungan respirator khusus.",
  },
];

function interpolateIndex(c: number, table: Breakpoint[]): IndexDetail {
  const conc = Math.max(0, c);
  let bp = table.find((b) => conc >= b.cLow && conc <= b.cHigh);

  if (!bp) {
    bp = table[table.length - 1];
  }

  const calculated =
    ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (conc - bp.cLow) + bp.iLow;
  const indexValue = Math.min(500, Math.max(0, Math.round(calculated)));

  return {
    value: indexValue,
    category: bp.category,
    colorHex: bp.colorHex,
    tailwindText: bp.tailwindText,
    tailwindBg: bp.tailwindBg,
    tailwindBorder: bp.tailwindBorder,
    healthRecommendation: bp.recommendation,
  };
}

/**
 * Konversi nilai konsentrasi mentah PM2.5 (ug/m3) menjadi indeks ISPU dan US-AQI
 */
export function convertPm25(rawPm25: number): AirQualityConversionResult {
  return {
    rawPm25,
    ispu: interpolateIndex(rawPm25, ISPU_BREAKPOINTS),
    usAqi: interpolateIndex(rawPm25, US_AQI_BREAKPOINTS),
  };
}

import type { AQStationLatest } from "./types";
import { RIAU_KABUPATEN_GEOMETRY } from "./geo";

function getStationCoords(stationName: string): [number, number] {
  const n = stationName.toLowerCase();
  if (n.includes("tampan")) return [0.48, 101.38];
  if (n.includes("sukajadi")) return [0.52, 101.44];
  if (n.includes("dumai") || n.includes("pelintung")) return [1.62, 101.45];
  if (n.includes("duri") || n.includes("mandau")) return [1.28, 101.22];
  if (n.includes("siak")) return [0.79, 102.04];
  if (n.includes("bangkinang") || n.includes("kampar")) return [0.33, 101.02];
  if (n.includes("pelalawan") || n.includes("kerinci")) return [0.42, 101.86];
  if (n.includes("rokan hilir") || n.includes("bagan")) return [2.16, 100.82];
  if (n.includes("rengat") || n.includes("hulu")) return [-0.37, 102.54];
  return [0.53, 101.44];
}

/**
 * Resolusi nilai observasi PM2.5 aktual dari stasiun SPKUA terdekat untuk kabupaten tertentu
 */
export function getPm25ForArea(
  areaName: string,
  stations?: AQStationLatest[] | null,
): number {
  if (!stations || stations.length === 0) return 35.0;

  const aName = areaName.toLowerCase();

  // 1. Cocokkan langsung nama stasiun yang berada di kabupaten bersangkutan
  const matchedStation = stations.find((s) => {
    const sName = (s.station_name || "").toLowerCase();
    return (
      (aName.includes("pekanbaru") && sName.includes("pekanbaru")) ||
      (aName.includes("dumai") && sName.includes("dumai")) ||
      (aName.includes("bengkalis") && (sName.includes("bengkalis") || sName.includes("duri") || sName.includes("mandau"))) ||
      (aName.includes("siak") && sName.includes("siak")) ||
      (aName.includes("kampar") && sName.includes("kampar")) ||
      (aName.includes("pelalawan") && sName.includes("pelalawan")) ||
      (aName.includes("rokan hilir") && (sName.includes("rokan hilir") || sName.includes("bagan"))) ||
      (aName.includes("indragiri hulu") && (sName.includes("indragiri hulu") || sName.includes("rengat")))
    );
  });

  if (matchedStation) {
    const pm25Obs = matchedStation.observations.find((o) => o.pollutant === "pm25");
    if (pm25Obs && pm25Obs.value != null) return pm25Obs.value;
  }

  // 2. Jika kabupaten belum memiliki sensor fisik langsung, cari stasiun SPKUA aktif dengan jarak terdekat secara geografis
  const kabGeom = RIAU_KABUPATEN_GEOMETRY.find((k) =>
    aName.includes(k.name.toLowerCase()) || k.name.toLowerCase().includes(aName),
  );

  const targetCoords = kabGeom ? kabGeom.centroid : [0.53, 101.44];

  let closestStation = stations[0];
  let minDistance = Infinity;

  for (const s of stations) {
    const sCoords = getStationCoords(s.station_name || "");
    const dLat = targetCoords[0] - sCoords[0];
    const dLon = targetCoords[1] - sCoords[1];
    const distSq = dLat * dLat + dLon * dLon;
    if (distSq < minDistance) {
      minDistance = distSq;
      closestStation = s;
    }
  }

  const nearestObs = closestStation?.observations.find((o) => o.pollutant === "pm25");
  return nearestObs?.value ?? 35.0;
}
