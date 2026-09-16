"use client";

import { useEffect, useState } from "react";
import { getRiskCurrent, getAirQualityLatest } from "@/lib/api";
import type { RiskCurrentResponse, RiskAssessment, AQStationLatest } from "@/lib/types";
import { MockBadge } from "./MockBadge";
import { convertPm25, getPm25ForArea } from "@/lib/aqi";

// ---------------------------------------------------------------------------
// Risk level → visual (text + icon + color — never color alone)
// ---------------------------------------------------------------------------

function getRiskVisual(level: string | null) {
  const norm = (level || "").toUpperCase();
  switch (norm) {
    case "EXTREME":
    case "VERY_HIGH":
    case "VERY HIGH":
      return {
        label: "Risiko Sangat Tinggi",
        color: "text-purple-700",
        bgColor: "bg-purple-100",
        borderColor: "border-purple-300",
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
      };
    case "HIGH":
      return {
        label: "Risiko Tinggi",
        color: "text-rw-red-600",
        bgColor: "bg-rw-red-100",
        borderColor: "border-rw-red-200",
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
      };
    case "MODERATE":
    case "MEDIUM":
      return {
        label: "Risiko Sedang",
        color: "text-rw-orange-600",
        bgColor: "bg-rw-orange-100",
        borderColor: "border-rw-orange-200",
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        ),
      };
    case "LOW":
      return {
        label: "Risiko Rendah",
        color: "text-rw-green-700",
        bgColor: "bg-rw-green-100",
        borderColor: "border-rw-green-200",
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ),
      };
    default:
      return {
        label: "Data Belum Cukup",
        color: "text-rw-gray-600",
        bgColor: "bg-rw-gray-100",
        borderColor: "border-rw-gray-200",
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        ),
      };
  }
}

function normalizeScore(score: number | null): number | null {
  if (score === null || score === undefined) return null;
  const val = score > 1.0 ? score : score * 100;
  return Math.min(100, Math.max(0, Math.round(val)));
}

// ---------------------------------------------------------------------------
// Humanize technical factor names & values into plain, friendly Indonesian
// ---------------------------------------------------------------------------

const FACTOR_NAME_MAP: Record<string, string> = {
  hotspot_count_7d: "Titik Panas (7 Hari Terakhir)",
  recent_trend: "Kecenderungan Titik Panas",
  dry_spell_days: "Hari Tanpa Hujan",
  vegetation_condition: "Kondisi Lahan & Vegetasi",
  hotspot_density_48h: "Kerapatan Titik Panas (48 Jam)",
  rainfall_7d: "Curah Hujan (7 Hari Terakhir)",
  humidity_24h: "Kelembapan Udara Rata-rata",
  humidity_avg_pct: "Kelembapan Udara Rata-rata",
  temperature_24h_max: "Suhu Udara Tertinggi",
  wind_speed_24h: "Kecepatan Angin",
  wind_24h_mean: "Kecepatan Angin",
  wind_speed_avg_kmh: "Kecepatan Angin",
  fuel_index: "Kondisi Bahan Bakar/Gambut",
};

const FACTOR_VALUE_MAP: Record<string, string> = {
  increasing: "Tren Meningkat (Waspada)",
  decreasing: "Tren Menurun (Membaik)",
  stable: "Stabil (Tetap)",
  stressed: "Kering & Mudah Terbakar",
  moderate: "Cukup Lembap",
  good: "Lembap & Aman",
};

function humanizeName(rawKey: string): string {
  if (FACTOR_NAME_MAP[rawKey]) return FACTOR_NAME_MAP[rawKey];
  return rawKey
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatNum(val: string | number, decimals: number = 1): string {
  const n = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(n)) return String(val);
  return n.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function humanizeValue(rawKey: string, rawVal: string | number): string {
  if (rawVal === null || rawVal === undefined || rawVal === "-" || rawVal === "") {
    return "Tidak tersedia";
  }

  const str = String(rawVal).toLowerCase();
  if (FACTOR_VALUE_MAP[str]) return FACTOR_VALUE_MAP[str];

  if (rawKey === "hotspot_count_7d") {
    return `${formatNum(rawVal, 0)} titik terdeteksi`;
  }
  if (rawKey === "hotspot_density_48h") {
    const n = Number(rawVal);
    if (n === 0 || isNaN(n)) return "0 titik / km²";
    return `${formatNum(rawVal, 3)} titik / km²`;
  }
  if (rawKey === "dry_spell_days") {
    return `${formatNum(rawVal, 0)} hari berturut-turut`;
  }
  if (rawKey === "rainfall_7d") {
    return `${formatNum(rawVal, 1)} mm`;
  }
  if (rawKey.includes("humidity")) {
    return `${formatNum(rawVal, 1)}%`;
  }
  if (rawKey.includes("temp") || rawKey.includes("temperature")) {
    return `${formatNum(rawVal, 1)}°C`;
  }
  if (rawKey.includes("wind")) {
    return `${formatNum(rawVal, 1)} km/jam`;
  }
  if (rawKey.includes("fuel")) {
    return `${formatNum(rawVal, 2)} m³/m³`;
  }

  return formatNum(rawVal, 1);
}

function humanizeHorizon(horizon: string): string {
  if (horizon === "48h") return "Prakiraan 2 Hari ke Depan (48 Jam)";
  if (horizon === "24h") return "Prakiraan 24 Jam ke Depan";
  if (horizon === "72h") return "Prakiraan 3 Hari ke Depan";
  if (horizon === "current") return "Kondisi Terkini";
  return `Prakiraan: ${horizon}`;
}

interface RiskFactor {
  name: string;
  value: string | number;
  reason: string;
}

function parseFactors(factors: Record<string, unknown>): RiskFactor[] {
  if (!factors) return [];
  // 1. If factors contains an inner "factors" array (from rules engine)
  if (Array.isArray((factors as { factors?: unknown[] }).factors)) {
    return (factors as { factors: Record<string, unknown>[] }).factors
      .filter((f) => f && typeof f === "object")
      .map((f) => ({
        name: String(f.name ?? ""),
        value: f.value != null ? (f.value as string | number) : "-",
        reason: String(f.reason ?? ""),
      }));
  }
  // 2. If factors is directly an array
  if (Array.isArray(factors)) {
    return factors.map((f) => ({
      name: String((f as Record<string, unknown>).name ?? ""),
      value: (f as Record<string, unknown>).value != null ? ((f as Record<string, unknown>).value as string | number) : "-",
      reason: String((f as Record<string, unknown>).reason ?? ""),
    }));
  }
  // 3. Fallback for flat dictionary
  const skipKeys = new Set(["level", "score", "model_version", "observed_window", "insufficient", "note"]);
  return Object.entries(factors)
    .filter(([k, v]) => !skipKeys.has(k) && typeof v !== "object")
    .map(([key, val]) => ({
      name: key,
      value: val as string | number,
      reason: typeof val === "string" ? val : String(val),
    }));
}

function RiskFactors({ factors }: { factors: Record<string, unknown> }) {
  const parsed = parseFactors(factors);
  if (parsed.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <h4 className="text-xs font-semibold text-rw-smoke-700 uppercase tracking-wide">
        Faktor Penyebab Risiko
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {parsed.map((f, i) => {
          const friendlyName = humanizeName(f.name);
          const friendlyValue = humanizeValue(f.name, f.value);
          const isReasonDifferent =
            f.reason &&
            f.reason !== String(f.value) &&
            f.reason !== f.name &&
            !f.reason.includes(f.name);

          return (
            <div
              key={i}
              className="flex flex-col justify-between rounded-lg bg-rw-smoke-50 px-3 py-2.5 border border-rw-smoke-200/70"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-medium text-rw-smoke-700">{friendlyName}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="rw-readout text-xs font-semibold text-rw-peat-900 bg-white px-2 py-0.5 rounded border border-rw-smoke-200">
                  {friendlyValue}
                </span>
              </div>
              {isReasonDifferent && (
                <p className="text-[11px] text-rw-smoke-500 mt-1 leading-snug">{f.reason}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk Card — full detail for one area with Dual-Index Architecture
// ---------------------------------------------------------------------------

function RiskCard({
  assessment,
  stations,
  isUserLocation = false,
}: {
  assessment: RiskAssessment;
  stations?: AQStationLatest[] | null;
  isUserLocation?: boolean;
}) {
  const visual = getRiskVisual(assessment.risk_level);
  const displayScore = normalizeScore(assessment.fire_hazard_index ?? assessment.score);
  const fireLevel = assessment.fire_risk_level || (displayScore && displayScore >= 75 ? "Ekstrem" : displayScore && displayScore >= 50 ? "Tinggi" : displayScore && displayScore >= 25 ? "Sedang" : "Rendah");
  
  const resolvedPm25 = assessment.pm25_value ?? getPm25ForArea(assessment.area_name, stations);
  const aqResult = convertPm25(resolvedPm25);
  const aqLevel = assessment.air_quality_level || aqResult.ispu.category;
  const ispuScore = aqResult.ispu.value;

  return (
    <div
      className={`rw-instrument-panel rounded-xl border bg-white p-5 shadow-sm space-y-4 ${
        isUserLocation ? "border-rw-sienna-600 ring-2 ring-rw-sienna-600/20" : visual.borderColor
      }`}
      style={{
        borderLeftColor:
          isUserLocation
            ? "var(--rw-sienna-600)"
            : visual.color.includes("red")
              ? "var(--rw-red-600)"
              : visual.color.includes("purple")
                ? "#7e22ce"
                : visual.color.includes("orange")
                  ? "var(--rw-orange-600)"
                  : visual.color.includes("green")
                    ? "var(--rw-mangrove-600)"
                    : "var(--rw-smoke-400)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-rw-smoke-100 pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-rw-peat-900">{assessment.area_name}</h3>
            {isUserLocation && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rw-sienna-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>Lokasi Anda</span>
              </span>
            )}
          </div>
          <p className="text-xs text-rw-smoke-500 mt-0.5">
            {humanizeHorizon(assessment.horizon)} &middot;{" "}
            {new Date(assessment.assessed_for).toLocaleString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${visual.bgColor} ${visual.color}`}>
          {visual.icon}
          <span>{visual.label}</span>
        </div>
      </div>

      {/* Dual-Index Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Index 1: Fire Hazard */}
        <div className="rounded-xl border border-rw-smoke-200 bg-rw-smoke-50/60 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rw-smoke-800 flex items-center gap-1.5">
              <svg className="h-4 w-4 text-rw-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
              </svg>
              Potensi Api Lokal
            </span>
            <span className="text-xs font-bold text-rw-red-700 bg-rw-red-100 px-2 py-0.5 rounded">
              {fireLevel}
            </span>
          </div>
          {displayScore != null && (
            <div>
              <div className="flex items-center justify-between text-[11px] text-rw-smoke-600 mb-1">
                <span>Indeks Bahaya Api</span>
                <span className="rw-readout font-bold text-rw-peat-900">{displayScore}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-rw-smoke-200">
                <div
                  className="h-full rounded-full bg-rw-red-600 transition-all"
                  style={{ width: `${displayScore}%` }}
                />
              </div>
            </div>
          )}
          <p className="text-[11px] text-rw-smoke-500 leading-snug">
            Mengukur konsentrasi titik panas aktif satelit, kekeringan gambut, dan cuaca di wilayah ini.
          </p>
        </div>

        {/* Index 2: Air Quality Hazard */}
        <div className="rounded-xl border border-rw-smoke-200 bg-rw-smoke-50/60 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rw-smoke-800 flex items-center gap-1.5">
              <svg className="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M17.5 19H9a7 7 0 116.71-9h1.79a4.5 4.5 0 110 9z" />
              </svg>
              Paparan Kualitas Udara
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
              aqLevel === "Tidak Sehat" || aqLevel === "Sangat Tidak Sehat" ? "bg-rw-red-100 text-rw-red-700" : aqLevel === "Sedang" ? "bg-amber-100 text-amber-800" : "bg-rw-mangrove-100 text-rw-mangrove-800"
            }`}>
              {aqLevel}
            </span>
          </div>
          <div>
            <div className="flex items-center justify-between text-[11px] text-rw-smoke-600 mb-1">
              <span>Indeks ISPU &middot; PM2.5</span>
              <span className="rw-readout font-bold text-rw-peat-900">ISPU {ispuScore} ({resolvedPm25.toFixed(1)} µg/m³)</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-rw-smoke-200">
              <div
                className={`h-full rounded-full transition-all ${
                  aqLevel === "Tidak Sehat" || aqLevel === "Sangat Tidak Sehat" ? "bg-rw-red-600" : aqLevel === "Sedang" ? "bg-amber-500" : "bg-emerald-600"
                }`}
                style={{ width: `${Math.min(100, Math.max(8, (ispuScore / 300) * 100))}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-rw-smoke-500 leading-snug">
            Merefleksikan paparan kabut asap (termasuk asap kiriman lintas wilayah) dan dampak kesehatan.
          </p>
        </div>
      </div>

      {/* Factors Breakdown */}
      <RiskFactors factors={assessment.factors} />

      {/* Human-friendly note */}
      <div className="pt-2.5 border-t border-rw-smoke-100">
        <p className="text-[11px] text-rw-smoke-500 leading-relaxed">
          <strong className="text-rw-smoke-700">Peringatan Dini:</strong> Analisis dihitung otomatis dari data satelit dan pantauan cuaca untuk deteksi dini karhutla. Kondisi di lapangan tetap memerlukan verifikasi langsung.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Risk Detail Panel
// ---------------------------------------------------------------------------

export function RiskDetailPanel({
  kabupatenId,
  userKabupatenId,
  userKabupatenName,
  onNavigateLocation,
}: {
  kabupatenId?: number;
  userKabupatenId?: number;
  userKabupatenName?: string;
  onNavigateLocation?: () => void;
}) {
  const [data, setData] = useState<RiskCurrentResponse | null>(null);
  const [aqStations, setAqStations] = useState<AQStationLatest[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = kabupatenId ? { kabupaten_id: kabupatenId } : undefined;
        const [res, aqRes] = await Promise.all([
          getRiskCurrent(params),
          getAirQualityLatest().catch(() => null),
        ]);
        if (!cancelled) {
          setData(res);
          if (aqRes) setAqStations(aqRes.stations);
        }
      } catch {
        if (!cancelled) setError("Gagal memuat data risiko");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [kabupatenId, retryCount]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border border-rw-smoke-200 bg-white p-5">
            <div className="h-5 bg-rw-smoke-100 rounded w-1/3 mb-3" />
            <div className="h-4 bg-rw-smoke-100 rounded w-2/3 mb-2" />
            <div className="h-3 bg-rw-smoke-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rw-smoke-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-rw-orange-600">
            <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setRetryCount((c) => c + 1)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rw-peat-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rw-peat-800 transition-colors"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
            </svg>
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  // INSUFFICIENT_DATA state
  if (data && (data.note === "risk_not_yet_computed" || data.assessments.length === 0)) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-rw-peat-900 flex items-center gap-2 font-display">
            <svg className="h-5 w-5 text-rw-sienna-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Penilaian Risiko Kebakaran Hutan & Lahan
          </h2>
          <MockBadge />
        </div>
        <div className="rounded-xl border border-rw-smoke-200 bg-white p-8 text-center shadow-sm">
          <svg className="h-10 w-10 text-rw-smoke-300 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <p className="text-sm font-semibold text-rw-peat-900">
            Data Belum Cukup untuk Penilaian Risiko
          </p>
          <p className="text-xs text-rw-smoke-500 mt-1">
            Penilaian risiko otomatis akan ditampilkan setelah data pengamatan cuaca dan satelit terakumulasi secara lengkap.
          </p>
        </div>
      </div>
    );
  }

  // Susun agar kabupaten/lokasi pengguna selalu tampil di kartu pertama
  const targetId = kabupatenId ?? userKabupatenId;
  const targetName = userKabupatenName;

  const sortedAssessments = [...(data?.assessments ?? [])].sort((a, b) => {
    const isTargetA = (targetId && a.area_id === targetId) || (targetName && a.area_name.includes(targetName));
    const isTargetB = (targetId && b.area_id === targetId) || (targetName && b.area_name.includes(targetName));
    if (isTargetA && !isTargetB) return -1;
    if (!isTargetA && isTargetB) return 1;
    return 0;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-rw-peat-900 flex items-center gap-2 font-display">
            <svg className="h-5 w-5 text-rw-sienna-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Penilaian Risiko Kebakaran Hutan & Lahan
          </h2>
          <p className="text-xs text-rw-smoke-500 mt-0.5">
            Tingkat kerawanan wilayah berdasarkan titik panas, kekeringan, dan kondisi cuaca
          </p>
        </div>
        <MockBadge />
      </div>

      {/* Location Hint Banner if location not yet set */}
      {!userKabupatenName && !kabupatenId && onNavigateLocation && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-rw-smoke-200 bg-rw-smoke-50 px-4 py-3 text-xs text-rw-smoke-700 shadow-2xs">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-rw-sienna-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>
              Ingin memprioritaskan risiko di wilayah Anda? Silakan nyalakan akses GPS atau pilih wilayah Anda di tab <strong>Lokasi Saya</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={onNavigateLocation}
            className="self-start sm:self-auto rounded-lg bg-rw-peat-900 px-3 py-1.5 font-semibold text-white hover:bg-rw-peat-800 transition-colors shadow-2xs text-[11px]"
          >
            Buka Lokasi Saya
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedAssessments.map((a, idx) => {
          const isUserLoc = idx === 0 && Boolean(
            (targetId && a.area_id === targetId) || (targetName && a.area_name.includes(targetName))
          );
          return (
            <RiskCard
              key={a.area_id}
              assessment={a}
              stations={aqStations}
              isUserLocation={isUserLoc}
            />
          );
        })}
      </div>
    </div>
  );
}
