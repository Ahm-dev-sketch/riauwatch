"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MockBadge } from "@/components/MockBadge";
import { StatusCard } from "@/components/StatusCard";
import { HotspotMap, type HotspotMapHandle } from "@/components/HotspotMap";
import { HotspotList } from "@/components/HotspotList";
import { FilterPanel, type FilterState } from "@/components/FilterPanel";
import { Legend, type LayerState } from "@/components/Legend";
import { RiskBadge } from "@/components/RiskBadge";
import { HotspotSummary } from "@/components/HotspotSummary";
import { HotspotDisclaimer } from "@/components/HotspotDisclaimer";
import { AirQualityPanel } from "@/components/AirQualityPanel";
import { WeatherPanel } from "@/components/WeatherPanel";
import { RiskDetailPanel } from "@/components/RiskDetailPanel";
import { LocationPanel } from "@/components/LocationPanel";
import {
  getStatus,
  getHotspots,
  getRiskCurrent,
  getAdministrativeAreas,
} from "@/lib/api";
import { fuseAndDeduplicateHotspots } from "@/lib/firms";
import type {
  StatusResponse,
  HotspotsResponse,
  HotspotsSummaryResponse,
  RiskCurrentResponse,
  AdminAreasResponse,
} from "@/lib/types";

type HotspotFeature = HotspotsResponse["features"][0];

const TAB_IDS = ["overview", "air", "weather", "risk", "location"] as const;
type TabId = (typeof TAB_IDS)[number];

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "overview", label: "Ringkasan", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { id: "air", label: "Kualitas Udara", icon: "M17.5 19H9a7 7 0 116.71-9h1.79a4.5 4.5 0 110 9z" },
  { id: "weather", label: "Cuaca", icon: "M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" },
  { id: "risk", label: "Risiko", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
  { id: "location", label: "Lokasi Saya", icon: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" },
];

export default function HomePage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [hotspots, setHotspots] = useState<HotspotsResponse | null>(null);
  const [summary, setSummary] = useState<HotspotsSummaryResponse | null>(null);
  const [risk, setRisk] = useState<RiskCurrentResponse | null>(null);
  const [adminAreas, setAdminAreas] = useState<AdminAreasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: "",
    dateTo: "",
    kabupatenId: "",
    minConfidence: "",
  });
  const [layers, setLayers] = useState<LayerState>({
    hotspots: true,
    boundaries: false,
    khg: true,
    wind: true,
  });
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [tileError, setTileError] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  const mapRef = useRef<HotspotMapHandle>(null);

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

        const [statusRes, hotspotsRes, riskRes, adminRes] = await Promise.all([
          getStatus(),
          getHotspots({ ...params, limit: 2000 }),
          getRiskCurrent(),
          getAdministrativeAreas({ level: "kabupaten_kota", simplify: 0.01 }),
        ]);

        if (!cancelled) {
          const fusion = fuseAndDeduplicateHotspots(hotspotsRes.features);
          const fusedHotspots: HotspotsResponse = {
            ...hotspotsRes,
            count: fusion.fusedFeatures.length,
            total_raw_count: fusion.totalRawDetections,
            active_clusters_count: fusion.activeClustersCount,
            features: fusion.fusedFeatures,
          };

          const fusedSummary: HotspotsSummaryResponse = {
            total: fusion.activeClustersCount,
            total_raw: fusion.totalRawDetections,
            items: Object.entries(fusion.clusterCountsByKabupaten).map(([name, count], idx) => ({
              kabupaten_id: idx + 1,
              kabupaten_name: name,
              count,
              raw_count: fusion.rawCountsByKabupaten[name] || count,
            })),
          };

          setStatus(statusRes);
          setHotspots(fusedHotspots);
          setSummary(fusedSummary);
          setRisk(riskRes);
          setAdminAreas(adminRes);
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

  const handleLayerToggle = useCallback((layer: keyof LayerState) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  // List ↔ Map syncing
  const handleListHighlight = useCallback((feature: HotspotFeature, index: number) => {
    setHighlightedIndex(index);
    mapRef.current?.highlightFeature(feature);
  }, []);

  const handleMapClick = useCallback((feature: HotspotFeature) => {
    if (!hotspots) return;
    const idx = hotspots.features.indexOf(feature);
    if (idx >= 0) setHighlightedIndex(idx);
  }, [hotspots]);

  const handleTileStatusChange = useCallback((error: boolean) => {
    setTileError(error);
  }, []);

  const handleRetryTiles = useCallback(() => {
    mapRef.current?.retryTiles();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main id="main-content" className="flex-1">
        {/* Hero: Answer "Bagaimana kondisi Riau sekarang?" */}
        <section className="bg-white border-b border-rw-smoke-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl sm:text-3xl font-bold text-rw-peat-900 tracking-tight font-display">
                    Bagaimana kondisi Riau sekarang?
                  </h1>
                  <MockBadge />
                </div>
                {generatedAt && (
                  <p className="text-sm text-rw-smoke-600">
                    Data diperbarui:{" "}
                    <time dateTime={generatedAt} className="rw-readout font-medium text-rw-smoke-800">
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

        {/* Jerebu Strip — atmospheric band reflecting current air quality */}
        <section
          className="rw-jerebu-strip h-2"
          style={{
            background: status?.air_quality?.degraded
              ? "linear-gradient(90deg, #b45309 0%, #d97706 40%, #f59e0b 70%, #b45309 100%)"
              : "linear-gradient(90deg, #276749 0%, #2d8659 40%, #38a169 70%, #276749 100%)",
          }}
          aria-hidden="true"
        />

        {/* Tab navigation — proper tablist semantics */}
        <section className="bg-white border-b border-rw-smoke-200 sticky top-16 z-30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div
              role="tablist"
              aria-label="Panel navigasi"
              className="flex overflow-x-auto gap-1 -mb-px"
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                const panelId = `tabpanel-${tab.id}`;
                const tabId = `tab-${tab.id}`;
                return (
                  <button
                    key={tab.id}
                    id={tabId}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={panelId}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={(e) => {
                      const currentIdx = TAB_IDS.indexOf(tab.id);
                      let nextIdx: number;
                      if (e.key === "ArrowRight") {
                        nextIdx = (currentIdx + 1) % TAB_IDS.length;
                      } else if (e.key === "ArrowLeft") {
                        nextIdx = (currentIdx - 1 + TAB_IDS.length) % TAB_IDS.length;
                      } else if (e.key === "Home") {
                        nextIdx = 0;
                      } else if (e.key === "End") {
                        nextIdx = TAB_IDS.length - 1;
                      } else {
                        return;
                      }
                      e.preventDefault();
                      setActiveTab(TAB_IDS[nextIdx]);
                      document.getElementById(`tab-${TAB_IDS[nextIdx]}`)?.focus();
                    }}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-rw-sienna-600 ${
                      isActive
                        ? "border-rw-sienna-600 text-rw-peat-900"
                        : "border-transparent text-rw-smoke-500 hover:text-rw-smoke-800 hover:border-rw-smoke-300"
                    }`}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d={tab.icon} />
                    </svg>
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Status cards — always visible */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <h2 className="sr-only">Status Sistem</h2>
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
              title="Cuaca & Potensi Karhutla"
              description="Pantauan parameter meteorologi & estimasi risiko"
              status={status?.weather ?? null}
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

        {/* Tab content */}
        {activeTab === "overview" && (
          <div
            id="tabpanel-overview"
            role="tabpanel"
            aria-labelledby="tab-overview"
            tabIndex={0}
          >
            {/* Risk overview */}
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
                  <p className="mt-2 text-xs text-rw-gray-600 italic">
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
                {/* Sidebar: filters, legend, summary, keyboard list */}
                <aside className="lg:w-[300px] flex-shrink-0 space-y-4" aria-label="Panel sisi peta">
                  <FilterPanel filters={filters} onChange={handleFilterChange} adminAreas={adminAreas} />
                  <Legend visibleLayers={layers} onToggle={handleLayerToggle} />
                  <HotspotSummary summary={summary} loading={loading} />
                  <HotspotList
                    hotspots={hotspots}
                    onHighlight={handleListHighlight}
                    highlightedIndex={highlightedIndex}
                    tileError={tileError}
                    onRetryTiles={handleRetryTiles}
                    totalCount={summary?.total}
                  />
                </aside>

                {/* Map */}
                <div className="flex-1 min-w-0">
                  <HotspotMap
                    ref={mapRef}
                    hotspots={hotspots}
                    adminAreas={adminAreas}
                    selectedKabupatenId={filters.kabupatenId}
                    showHotspots={layers.hotspots}
                    showBoundaries={layers.boundaries}
                    showKHG={layers.khg}
                    showWind={layers.wind}
                    loading={loading}
                    onHotspotClick={handleMapClick}
                    onTileStatusChange={handleTileStatusChange}
                  />
                  <div className="mt-3">
                    <HotspotDisclaimer />
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === "air" && (
          <div
            id="tabpanel-air"
            role="tabpanel"
            aria-labelledby="tab-air"
            tabIndex={0}
          >
            <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
              <AirQualityPanel />
            </section>
          </div>
        )}

        {activeTab === "weather" && (
          <div
            id="tabpanel-weather"
            role="tabpanel"
            aria-labelledby="tab-weather"
            tabIndex={0}
          >
            <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
              <WeatherPanel />
            </section>
          </div>
        )}

        {activeTab === "risk" && (
          <div
            id="tabpanel-risk"
            role="tabpanel"
            aria-labelledby="tab-risk"
            tabIndex={0}
          >
            <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
              <RiskDetailPanel />
            </section>
          </div>
        )}

        {activeTab === "location" && (
          <div
            id="tabpanel-location"
            role="tabpanel"
            aria-labelledby="tab-location"
            tabIndex={0}
          >
            <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
              <LocationPanel />
            </section>
          </div>
        )}

        {/* Data freshness footer */}
        <section className="bg-rw-smoke-100 border-t border-rw-smoke-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-rw-smoke-600">
              <span className="font-medium text-rw-smoke-700">
                Status data:
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5">
                  {status?.hotspots?.degraded ? (
                    <svg className="h-3.5 w-3.5 text-rw-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-rw-mangrove-600" aria-hidden="true" />
                  )}
                  Hotspots
                </span>
                <span className="flex items-center gap-1.5">
                  {status?.air_quality?.degraded ? (
                    <svg className="h-3.5 w-3.5 text-rw-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-rw-mangrove-600" aria-hidden="true" />
                  )}
                  Kualitas Udara
                </span>
                <span className="flex items-center gap-1.5">
                  {status?.weather?.degraded ? (
                    <svg className="h-3.5 w-3.5 text-rw-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-rw-mangrove-600" aria-hidden="true" />
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
