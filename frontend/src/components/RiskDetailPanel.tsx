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
// Factor display — renders factors[] VERBATIM from API
// ---------------------------------------------------------------------------

interface RiskFactor {
  name: string;
  value: string | number;
  reason: string;
}

function parseFactors(factors: Record<string, unknown>): RiskFactor[] {
  // Handle both array format and object format
  if (Array.isArray(factors)) {
    return factors.map((f) => ({
      name: String((f as Record<string, unknown>).name ?? ""),
      value: (f as Record<string, unknown>).value as string | number,
      reason: String((f as Record<string, unknown>).reason ?? ""),
    }));
  }
  // Convert object format to array
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
    <div className="mt-3 space-y-2">
      <h4 className="text-xs font-semibold text-rw-gray-700 uppercase tracking-wide">
        Faktor Penilaian
      </h4>
      <div className="space-y-1.5">
        {parsed.map((f, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-lg bg-rw-gray-50 px-3 py-2 border border-rw-gray-100"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-rw-gray-800">{f.name}</span>
                <span className="text-xs font-mono text-rw-gray-600">{String(f.value)}</span>
              </div>
              {f.reason !== String(f.value) && (
                <p className="text-[11px] text-rw-gray-500 mt-0.5">{f.reason}</p>
              )}
            </div>
          </div>
        ))}
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
    <div className={`rounded-xl border ${assessment.risk_level === "HIGH" ? "border-rw-red-200" : assessment.risk_level === "MEDIUM" ? "border-rw-orange-200" : "border-rw-gray-200"} bg-white p-5 shadow-sm`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-rw-gray-900">{assessment.area_name}</h3>
          <p className="text-xs text-rw-gray-500 mt-0.5">
            Horison: {assessment.horizon} · {new Date(assessment.assessed_for).toLocaleString("id-ID", {
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
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-rw-gray-500">Skor Risiko</span>
            <span className="text-xs font-mono font-semibold text-rw-gray-700">
              {Math.round(assessment.score * 100)}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-rw-gray-100">
            <div
              className={`h-full rounded-full transition-all ${
                assessment.risk_level === "HIGH"
                  ? "bg-rw-red-600"
                  : assessment.risk_level === "MEDIUM"
                    ? "bg-rw-orange-600"
                    : "bg-rw-green-600"
              }`}
              style={{ width: `${Math.round(assessment.score * 100)}%` }}
              role="progressbar"
              aria-valuenow={Math.round(assessment.score * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Skor risiko: ${Math.round(assessment.score * 100)}%`}
            />
          </div>
        </div>
      )}

      {/* Factors — rendered VERBATIM from API */}
      <RiskFactors factors={assessment.factors} />

      {/* Model version footnote */}
      <div className="mt-3 pt-2 border-t border-rw-gray-100">
        <p className="text-[10px] text-rw-gray-400">
          Model: {assessment.model_version} · Bobot awal, belum tervalidasi ilmiah.
          Skor bersifat indikatif dan memerlukan validasi lapangan.
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
    return () => { cancelled = true; };
  }, [kabupatenId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border border-rw-gray-200 bg-white p-5">
            <div className="h-5 bg-rw-gray-100 rounded w-1/3 mb-3" />
            <div className="h-4 bg-rw-gray-100 rounded w-2/3 mb-2" />
            <div className="h-3 bg-rw-gray-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rw-gray-200 bg-white p-5 shadow-sm">
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
          <h2 className="text-lg font-semibold text-rw-gray-900 flex items-center gap-2">
            <svg className="h-5 w-5 text-rw-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Risiko Kebakaran
          </h2>
          <MockBadge />
        </div>
        <div className="rounded-xl border border-rw-gray-200 bg-white p-8 text-center shadow-sm">
          <svg className="h-10 w-10 text-rw-gray-300 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <p className="text-sm font-medium text-rw-gray-700">
            Data belum cukup untuk penilaian risiko
          </p>
          <p className="text-xs text-rw-gray-500 mt-1">
            Penilaian risiko akan tersedia setelah model selesai menghitung.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-rw-gray-900 flex items-center gap-2">
          <svg className="h-5 w-5 text-rw-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Risiko Kebakaran
        </h2>
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
