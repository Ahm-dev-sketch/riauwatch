"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MockBadge } from "@/components/MockBadge";
import { StatusCard } from "@/components/StatusCard";
import { HotspotMap } from "@/components/HotspotMap";
import { FilterPanel, type FilterState } from "@/components/FilterPanel";
import { Legend } from "@/components/Legend";
import { RiskBadge } from "@/components/RiskBadge";
import { HotspotSummary } from "@/components/HotspotSummary";
import { HotspotDisclaimer } from "@/components/HotspotDisclaimer";
import {
  getStatus,
  getHotspots,
  getHotspotsSummary,
  getRiskCurrent,
} from "@/lib/api";
import type {
  StatusResponse,
  HotspotsResponse,
  HotspotsSummaryResponse,
  RiskCurrentResponse,
} from "@/lib/types";

export default function HomePage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [hotspots, setHotspots] = useState<HotspotsResponse | null>(null);
  const [summary, setSummary] = useState<HotspotsSummaryResponse | null>(null);
  const [risk, setRisk] = useState<RiskCurrentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: "",
    dateTo: "",
    kabupatenId: "",
    minConfidence: "",
  });
  const [layers, setLayers] = useState({ hotspots: true, boundaries: false });
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  // Load data on mount and when filters change
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const params = {
          date_from: filters.dateFrom || undefined,
          date_to: filters.dateTo || undefined,
          kabupaten_id: filters.kabupatenId ? Number(filters.kabupatenId) : undefined,
          min_confidence: filters.minConfidence || undefined,
        };

        const [statusRes, hotspotsRes, summaryRes, riskRes] = await Promise.all([
          getStatus(),
          getHotspots({ ...params, limit: 2000 }),
          getHotspotsSummary(params),
          getRiskCurrent(),
        ]);

        if (!cancelled) {
          setStatus(statusRes);
          setHotspots(hotspotsRes);
          setSummary(summaryRes);
          setRisk(riskRes);
          setGeneratedAt(statusRes.generated_at);
        }
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [filters]);

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  const handleLayerToggle = useCallback((layer: "hotspots" | "boundaries") => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main id="main-content" className="flex-1">
        {/* Hero: Answer "Bagaimana kondisi Riau sekarang?" */}
        <section className="bg-white border-b border-rw-gray-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl sm:text-3xl font-bold text-rw-green-900 tracking-tight">
                    Bagaimana kondisi Riau sekarang?
                  </h1>
                  <MockBadge />
                </div>
                {generatedAt && (
                  <p className="text-sm text-rw-gray-500">
                    Data diperbarui:{" "}
                    <time dateTime={generatedAt} className="font-medium text-rw-gray-700">
                      {new Date(generatedAt).toLocaleString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Status cards: 1) Air Quality, 2) Fire Risk, 3) Hotspots */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatusCard
              title="Kualitas Udara"
              description="Data observasi udara dari stasiun pemantau"
              status={status?.air_quality ?? null}
              icon={
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M17.5 19H9a7 7 0 116.71-9h1.79a4.5 4.5 0 110 9z" />
                </svg>
              }
            />
            <StatusCard
              title="Risiko Kebakaran"
              description="Penilaian risiko kebakaran hutan dan lahan"
              status={status?.hotspots ?? null}
              icon={
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 2c.5 3.5 3 5.5 3 8.5a3 3 0 01-6 0c0-3 2.5-5 3-8.5z" />
                  <path d="M12 22c4.42 0 8-3.58 8-8 0-3.35-2.08-6.46-4-8.5" />
                </svg>
              }
            />
            <StatusCard
              title="Titik Panas"
              description="Deteksi panas satelit (VIIRS/MODIS)"
              status={status?.hotspots ?? null}
              icon={
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <circle cx="12" cy="12" r="7" opacity="0.5" />
                  <circle cx="12" cy="12" r="10" opacity="0.3" />
                </svg>
              }
            />
          </div>
        </section>

        {/* Risk overview (if available) */}
        {risk && risk.assessments.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-4">
            <h2 className="text-lg font-semibold text-rw-gray-900 mb-3 flex items-center gap-2">
              <svg className="h-5 w-5 text-rw-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Ringkasan Risiko per Kabupaten
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {risk.assessments.slice(0, 6).map((a) => (
                <RiskBadge key={a.area_id} assessment={a} compact />
              ))}
            </div>
            {risk.note && (
              <p className="mt-2 text-xs text-rw-gray-500 italic">
                Catatan: {risk.note}
              </p>
            )}
          </section>
        )}

        {/* Map + sidebar */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-6">
          <h2 className="text-lg font-semibold text-rw-gray-900 mb-3 flex items-center gap-2">
            <svg className="h-5 w-5 text-rw-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
            Peta Titik Panas Riau
          </h2>

          <div className="flex flex-col lg:flex-row gap-4">
            {/* Sidebar: filters, legend, summary */}
            <aside className="lg:w-[300px] flex-shrink-0 space-y-4" aria-label="Panel sisi peta">
              <FilterPanel filters={filters} onChange={handleFilterChange} />
              <Legend visibleLayers={layers} onToggle={handleLayerToggle} />
              <HotspotSummary summary={summary} loading={loading} />
            </aside>

            {/* Map */}
            <div className="flex-1 min-w-0">
              <HotspotMap hotspots={hotspots} loading={loading} />
              <div className="mt-3">
                <HotspotDisclaimer />
              </div>
            </div>
          </div>
        </section>

        {/* Data freshness footer */}
        <section className="bg-rw-gray-100 border-t border-rw-gray-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-rw-gray-500">
              <span className="font-medium text-rw-gray-600">
                Status data:
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1">
                  {status?.hotspots?.degraded ? (
                    <span className="text-rw-orange-600">⚠</span>
                  ) : (
                    <span className="text-rw-green-700">●</span>
                  )}
                  Hotspots
                </span>
                <span className="flex items-center gap-1">
                  {status?.air_quality?.degraded ? (
                    <span className="text-rw-orange-600">⚠</span>
                  ) : (
                    <span className="text-rw-green-700">●</span>
                  )}
                  Kualitas Udara
                </span>
                <span className="flex items-center gap-1">
                  {status?.weather?.degraded ? (
                    <span className="text-rw-orange-600">⚠</span>
                  ) : (
                    <span className="text-rw-green-700">●</span>
                  )}
                  Cuaca
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
