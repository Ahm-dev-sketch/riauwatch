"use client";

import { useEffect, useState } from "react";
import { getRiskCurrent } from "@/lib/api";
import type { RiskCurrentResponse, RiskAssessment } from "@/lib/types";
import { MockBadge } from "./MockBadge";

// ---------------------------------------------------------------------------
// Risk level → visual (text + icon + color — never color alone)
// ---------------------------------------------------------------------------

function getRiskVisual(level: string | null) {
  switch (level) {
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
        label: "Belum Dihitung",
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
  wind_speed_avg_kmh: "Kecepatan Angin",
};

const FACTOR_VALUE_MAP: Record<string, string> = {
  increasing: "Meningkat ↗ (Waspada)",
  decreasing: "Menurun ↘ (Membaik)",
  stable: "Stabil → (Tetap)",
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

function humanizeValue(rawKey: string, rawVal: string | number): string {
  const str = String(rawVal).toLowerCase();
  if (FACTOR_VALUE_MAP[str]) return FACTOR_VALUE_MAP[str];

  if (rawKey === "hotspot_count_7d" || rawKey === "hotspot_density_48h") {
    return `${rawVal} titik terdeteksi`;
  }
  if (rawKey === "dry_spell_days") {
    return `${rawVal} hari berturut-turut`;
  }
  if (rawKey === "rainfall_7d") {
    return `${rawVal} mm`;
  }
  if (rawKey.includes("humidity")) {
    return `${rawVal}%`;
  }
  if (rawKey.includes("temp")) {
    return `${rawVal}°C`;
  }
  if (rawKey.includes("wind")) {
    return `${rawVal} km/jam`;
  }

  return String(rawVal);
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
  if (Array.isArray(factors)) {
    return factors.map((f) => ({
      name: String((f as Record<string, unknown>).name ?? ""),
      value: (f as Record<string, unknown>).value as string | number,
      reason: String((f as Record<string, unknown>).reason ?? ""),
    }));
  }
  return Object.entries(factors).map(([key, val]) => ({
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
// Risk Card — full detail for one area
// ---------------------------------------------------------------------------

function RiskCard({ assessment }: { assessment: RiskAssessment }) {
  const visual = getRiskVisual(assessment.risk_level);

  return (
    <div
      className={`rw-instrument-panel rounded-xl border ${
        assessment.risk_level === "HIGH"
          ? "border-rw-red-200"
          : assessment.risk_level === "MEDIUM"
            ? "border-rw-orange-200"
            : "border-rw-smoke-200"
      } bg-white p-5 shadow-sm`}
      style={{
        borderLeftColor:
          assessment.risk_level === "HIGH"
            ? "var(--rw-red-600)"
            : assessment.risk_level === "MEDIUM"
              ? "var(--rw-orange-600)"
              : "var(--rw-mangrove-600)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-rw-peat-900">{assessment.area_name}</h3>
          <p className="text-xs text-rw-smoke-500 mt-0.5">
            {humanizeHorizon(assessment.horizon)} ·{" "}
            {new Date(assessment.assessed_for).toLocaleString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${visual.bgColor} ${visual.color}`}>
          {visual.icon}
          {visual.label}
        </div>
      </div>

      {/* Score bar */}
      {assessment.score != null && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-rw-smoke-600">Tingkat Potensi Kebakaran</span>
            <span className="rw-readout text-xs font-bold text-rw-peat-900">
              {Math.round(assessment.score * 100)}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-rw-smoke-100">
            <div
              className={`h-full rounded-full transition-all ${
                assessment.risk_level === "HIGH"
                  ? "bg-rw-red-600"
                  : assessment.risk_level === "MEDIUM"
                    ? "bg-rw-orange-600"
                    : "bg-rw-mangrove-600"
              }`}
              style={{ width: `${Math.round(assessment.score * 100)}%` }}
              role="progressbar"
              aria-valuenow={Math.round(assessment.score * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Tingkat potensi kebakaran: ${Math.round(assessment.score * 100)}%`}
            />
          </div>
        </div>
      )}

      {/* Factors */}
      <RiskFactors factors={assessment.factors} />

      {/* Human-friendly note */}
      <div className="mt-4 pt-2.5 border-t border-rw-smoke-100">
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

export function RiskDetailPanel({ kabupatenId }: { kabupatenId?: number }) {
  const [data, setData] = useState<RiskCurrentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = kabupatenId ? { kabupaten_id: kabupatenId } : undefined;
        const res = await getRiskCurrent(params);
        if (!cancelled) setData(res);
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
  }, [kabupatenId]);

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
        <div className="flex items-center gap-2 text-rw-orange-600">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="text-sm font-medium">{error}</span>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data!.assessments.map((a) => (
          <RiskCard key={a.area_id} assessment={a} />
        ))}
      </div>
    </div>
  );
}
