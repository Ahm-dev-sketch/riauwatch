"use client";

import { useEffect, useState } from "react";
import { getAirQualityLatest, getAirQualityHistory } from "@/lib/api";
import type { AirQualityLatestResponse, AirQualityHistoryResponse, AQStationLatest, AQHistoryPoint } from "@/lib/types";
import { MockBadge } from "./MockBadge";

// ---------------------------------------------------------------------------
// ISPU Category Breakpoint Table (Indonesian Standard — PM2.5)
// Source: Peraturan Pemerintah No. 22/2021 tentang Perlindungan dan Pengelolaan
// Lingkungan Hidup,referensi standar ISPU — KLHK
// Code comment: backend will serve these categories in a later pass (Phase 6+)
// ---------------------------------------------------------------------------

interface ISPUBreakpoint {
  label: string;
  min: number;
  max: number;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}

// PM2.5 breakpoints (ug/m3) based on Indonesian ISPU standard
const ISPU_PM25: ISPUBreakpoint[] = [
  {
    label: "Baik",
    min: 0,
    max: 15.5,
    color: "text-rw-green-700",
    bgColor: "bg-rw-green-100",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    label: "Sedang",
    min: 15.6,
    max: 55.4,
    color: "text-rw-yellow-700",
    bgColor: "bg-rw-yellow-100",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  {
    label: "Tidak Sehat untuk Kelompok Sensitif",
    min: 55.5,
    max: 155.4,
    color: "text-rw-orange-600",
    bgColor: "bg-rw-orange-100",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    label: "Tidak Sehat",
    min: 155.5,
    max: 255.4,
    color: "text-rw-red-600",
    bgColor: "bg-rw-red-100",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    label: "Sangat Tidak Sehat",
    min: 255.5,
    max: 500,
    color: "text-rw-red-800",
    bgColor: "bg-red-200",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
];

// PM10 breakpoints (ug/m3) — also referenced for PM10 where available
const ISPU_PM10: ISPUBreakpoint[] = [
  {
    label: "Baik",
    min: 0,
    max: 50,
    color: "text-rw-green-700",
    bgColor: "bg-rw-green-100",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    label: "Sedang",
    min: 51,
    max: 150,
    color: "text-rw-yellow-700",
    bgColor: "bg-rw-yellow-100",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  {
    label: "Tidak Sehat untuk Kelompok Sensitif",
    min: 151,
    max: 350,
    color: "text-rw-orange-600",
    bgColor: "bg-rw-orange-100",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    label: "Tidak Sehat",
    min: 351,
    max: 420,
    color: "text-rw-red-600",
    bgColor: "bg-rw-red-100",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    label: "Sangat Tidak Sehat",
    min: 421,
    max: 600,
    color: "text-rw-red-800",
    bgColor: "bg-red-200",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
];

function getISPUCategory(value: number, breakpoints: ISPUBreakpoint[]): ISPUBreakpoint {
  for (const bp of breakpoints) {
    if (value >= bp.min && value <= bp.max) return bp;
  }
  return breakpoints[breakpoints.length - 1];
}

function formatAge(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} menit lalu`;
  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

// ---------------------------------------------------------------------------
// SVG Line Chart for AQ History (no external deps)
// ---------------------------------------------------------------------------

function AQHistoryChart({ data, pollutant }: { data: AQHistoryPoint[]; pollutant: string }) {
  if (!data || data.length === 0) return null;

  const width = 600;
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 30, left: 45 };

  const values = data.map((p) => p.value);
  const minVal = Math.floor(Math.min(...values) * 0.9);
  const maxVal = Math.ceil(Math.max(...values) * 1.1);

  const xScale = (i: number) =>
    padding.left + (i / (data.length - 1)) * (width - padding.left - padding.right);
  const yScale = (v: number) =>
    padding.top + (1 - (v - minVal) / (maxVal - minVal)) * (height - padding.top - padding.bottom);

  // Build SVG path
  const pathD = data
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(p.value)}`)
    .join(" ");

  // Area fill path
  const areaD = `${pathD} L ${xScale(data.length - 1)} ${height - padding.bottom} L ${xScale(0)} ${height - padding.bottom} Z`;

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, i) => minVal + (maxVal - minVal) * (i / (yTicks - 1)));

  // X-axis: show every 6th hour label
  const xTicks = data.filter((_, i) => i % 6 === 0 || i === data.length - 1);

  const pollutantLabel = pollutant === "pm25" ? "PM2.5" : pollutant.toUpperCase();

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Grafik tren ${pollutantLabel} 24 jam terakhir`}
      >
        {/* Grid lines */}
        {yTickValues.map((v, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={yScale(v)}
              x2={width - padding.right}
              y2={yScale(v)}
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray="4,4"
            />
            <text
              x={padding.left - 6}
              y={yScale(v) + 3}
              textAnchor="end"
              fontSize="10"
              fill="#718096"
            >
              {Math.round(v)}
            </text>
          </g>
        ))}

        {/* Area fill — peat-sienna tint */}
        <path d={areaD} fill="rgba(139, 69, 19, 0.08)" />

        {/* Line — peat-sienna */}
        <path d={pathD} fill="none" stroke="#8b4513" strokeWidth="2" strokeLinejoin="round" />

        {/* Data points (small dots) */}
        {data.map((p, i) => (
          <circle key={i} cx={xScale(i)} cy={yScale(p.value)} r="2" fill="#8b4513" />
        ))}

        {/* X-axis labels */}
        {xTicks.map((p, i) => {
          const idx = data.indexOf(p);
          const d = new Date(p.observed_at);
          const label = `${d.getHours().toString().padStart(2, "0")}:00`;
          return (
            <text
              key={i}
              x={xScale(idx)}
              y={height - 8}
              textAnchor="middle"
              fontSize="10"
              fill="#718096"
            >
              {label}
            </text>
          );
        })}

        {/* Y-axis label */}
        <text
          x={12}
          y={height / 2}
          textAnchor="middle"
          fontSize="10"
          fill="#718096"
          transform={`rotate(-90, 12, ${height / 2})`}
        >
          {pollutantLabel} (ug/m3)
        </text>
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Station Card
// ---------------------------------------------------------------------------

function StationCard({
  station,
  selectedPollutant,
  onSelectPollutant,
}: {
  station: AQStationLatest;
  selectedPollutant: string;
  onSelectPollutant: (pollutant: string) => void;
}) {
  const availablePollutants = station.observations.map((o) => o.pollutant);
  const currentObs = station.observations.find((o) => o.pollutant === selectedPollutant);
  const breakpoints = selectedPollutant === "pm25" ? ISPU_PM25 : ISPU_PM10;
  const category = currentObs ? getISPUCategory(currentObs.value, breakpoints) : null;

  return (
    <div className="rw-instrument-panel rounded-xl border border-rw-smoke-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow" style={{ borderLeftColor: "var(--rw-sienna-400)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-rw-gray-900">
            {station.station_name || `Stasiun #${station.station_id}`}
          </h4>
          {station.distance_km != null && station.distance_km > 0 && (
            <p className="text-xs text-rw-gray-500 mt-0.5">
              {station.distance_km.toFixed(1)} km dari lokasi Anda
            </p>
          )}
        </div>
        {category && (
          <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${category.bgColor} ${category.color}`}>
            {category.icon}
            <span>{category.label}</span>
          </div>
        )}
      </div>

      {/* Pollutant selector */}
      {availablePollutants.length > 1 && (
        <div className="flex gap-1 mt-3 mb-3">
          {availablePollutants.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onSelectPollutant(p)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedPollutant === p
                  ? "bg-rw-green-100 text-rw-green-800"
                  : "bg-rw-gray-100 text-rw-gray-600 hover:bg-rw-gray-200"
              }`}
            >
              {p === "pm25" ? "PM2.5" : p.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* Current reading */}
      {currentObs ? (
        <div className="flex items-baseline gap-2 mb-2">
          <span className="rw-readout text-2xl font-bold text-rw-gray-900">
            {currentObs.value.toFixed(1)}
          </span>
          <span className="text-sm text-rw-gray-500">{currentObs.unit}</span>
        </div>
      ) : (
        <p className="text-sm text-rw-gray-500 italic mb-2">
          Data tidak tersedia untuk polutan ini
        </p>
      )}

      {/* Metadata */}
      <div className="flex items-center justify-between text-xs text-rw-gray-500">
        <span>
          {currentObs ? `Diperbarui ${formatAge(currentObs.age_seconds)}` : ""}
        </span>
        {station.distance_km != null && station.distance_km > 0 && (
          <span>Stasiun terdekat</span>
        )}
      </div>

      {/* ISPU Reference Note */}
      {category && (
        <div className="mt-2 pt-2 border-t border-rw-gray-100">
          <p className="text-[10px] text-rw-gray-400 leading-relaxed">
            Kategori ISPU — KLHK (Peraturan Pemerintah No. 22/2021). Backend akan menyajikan kategori ini secara resmi di masa mendatang.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Air Quality Panel
// ---------------------------------------------------------------------------

export function AirQualityPanel() {
  const [data, setData] = useState<AirQualityLatestResponse | null>(null);
  const [history, setHistory] = useState<AirQualityHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<number | null>(null);
  const [selectedPollutant, setSelectedPollutant] = useState("pm25");
  const [stale, setStale] = useState(false);

  // Load latest air quality data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await getAirQualityLatest();
        if (cancelled) return;
        setData(res);
        // Auto-select first station
        if (res.stations.length > 0) {
          setSelectedStation(res.stations[0].station_id);
        }
        // Check staleness
        const oldestObs = res.stations.flatMap((s) => s.observations).reduce((oldest, obs) => {
          return obs.age_seconds > oldest ? obs.age_seconds : oldest;
        }, 0);
        setStale(oldestObs > 6 * 3600);
      } catch {
        if (!cancelled) setError("Gagal memuat data kualitas udara");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Load history when station or pollutant changes
  useEffect(() => {
    if (selectedStation === null) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await getAirQualityHistory({
          station_id: selectedStation!,
          pollutant: selectedPollutant,
        });
        if (!cancelled) setHistory(res);
      } catch {
        // History load failure is non-critical
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedStation, selectedPollutant]);

  if (loading) {
    return (
      <div className="rounded-xl border border-rw-gray-200 bg-white p-5 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-rw-gray-100 rounded w-1/3" />
          <div className="h-4 bg-rw-gray-100 rounded w-2/3" />
          <div className="h-4 bg-rw-gray-100 rounded w-1/2" />
        </div>
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

  if (!data || data.stations.length === 0) {
    return (
      <div className="rounded-xl border border-rw-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-rw-gray-500">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <span className="text-sm">Data kualitas udara sementara tidak tersedia</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-rw-gray-900 flex items-center gap-2">
          <svg className="h-5 w-5 text-rw-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M17.5 19H9a7 7 0 116.71-9h1.79a4.5 4.5 0 110 9z" />
          </svg>
          Kualitas Udara
        </h2>
        <MockBadge />
      </div>

      {stale && (
        <div className="rounded-lg border border-rw-haze-700/30 bg-rw-haze-50 p-3">
          <p className="text-xs text-rw-smoke-700 flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-rw-haze-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Data mungkin tertunda — pembacaan terakhir lebih dari 6 jam yang lalu
          </p>
        </div>
      )}

      {/* Station list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.stations.map((station) => (
          <StationCard
            key={station.station_id}
            station={station}
            selectedPollutant={selectedPollutant}
            onSelectPollutant={(p) => {
              setSelectedPollutant(p);
              setSelectedStation(station.station_id);
            }}
          />
        ))}
      </div>

      {/* History chart */}
      {history && history.points.length > 0 && (
        <div className="rounded-xl border border-rw-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-rw-gray-900 mb-3">
            Tren {history.pollutant === "pm25" ? "PM2.5" : history.pollutant.toUpperCase()} — 24 Jam Terakhir
          </h3>
          <AQHistoryChart data={history.points} pollutant={history.pollutant} />
          <p className="mt-2 text-[10px] text-rw-gray-400">
            Stasiun: {data.stations.find((s) => s.station_id === history.station_id)?.station_name || `#${history.station_id}`}
          </p>
        </div>
      )}
    </div>
  );
}
