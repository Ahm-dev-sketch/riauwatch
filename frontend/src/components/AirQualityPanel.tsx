"use client";

import { useEffect, useState, useRef } from "react";
import { getAirQualityLatest, getAirQualityHistory } from "@/lib/api";
import type { AirQualityLatestResponse, AirQualityHistoryResponse, AQStationLatest, AQHistoryPoint } from "@/lib/types";
import { MockBadge } from "./MockBadge";

// ---------------------------------------------------------------------------
// ISPU Category Breakpoint Table (Indonesian Standard — PM2.5)
// Source: Peraturan Pemerintah No. 22/2021 tentang Perlindungan dan Pengelolaan
// Lingkungan Hidup, referensi standar ISPU — KLHK
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
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
  },
  {
    label: "Sedang",
    min: 15.6,
    max: 55.4,
    color: "text-rw-orange-600",
    bgColor: "bg-rw-orange-100",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="8" y1="15" x2="16" y2="15" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
  },
  {
    label: "Tidak Sehat",
    min: 55.5,
    max: 150.4,
    color: "text-rw-red-600",
    bgColor: "bg-rw-red-100",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
  },
  {
    label: "Sangat Tidak Sehat",
    min: 150.5,
    max: 250.4,
    color: "text-purple-700",
    bgColor: "bg-purple-100",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    label: "Berbahaya",
    min: 250.5,
    max: Infinity,
    color: "text-red-900",
    bgColor: "bg-red-200",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
];

// PM10 breakpoints (ug/m3) based on Indonesian ISPU standard
const ISPU_PM10: ISPUBreakpoint[] = [
  {
    label: "Baik",
    min: 0,
    max: 50,
    color: "text-rw-green-700",
    bgColor: "bg-rw-green-100",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
  },
  {
    label: "Sedang",
    min: 51,
    max: 150,
    color: "text-rw-orange-600",
    bgColor: "bg-rw-orange-100",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="8" y1="15" x2="16" y2="15" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
  },
  {
    label: "Tidak Sehat",
    min: 151,
    max: 350,
    color: "text-rw-red-600",
    bgColor: "bg-rw-red-100",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
  },
  {
    label: "Sangat Tidak Sehat",
    min: 351,
    max: 420,
    color: "text-purple-700",
    bgColor: "bg-purple-100",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    label: "Berbahaya",
    min: 421,
    max: Infinity,
    color: "text-red-900",
    bgColor: "bg-red-200",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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
// SVG Line Chart for AQ History with Interactive Hover Tooltip
// ---------------------------------------------------------------------------

function AQHistoryChart({ data, pollutant }: { data: AQHistoryPoint[]; pollutant: string }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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
    padding.top + (1 - (v - minVal) / Math.max(1, maxVal - minVal)) * (height - padding.top - padding.bottom);

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
  const breakpoints = pollutant === "pm25" ? ISPU_PM25 : ISPU_PM10;

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    const relX = Math.max(padding.left, Math.min(width - padding.right, svgX));
    const idx = Math.round(((relX - padding.left) / (width - padding.left - padding.right)) * (data.length - 1));
    if (idx >= 0 && idx < data.length) {
      setHoveredIdx(idx);
    }
  };

  const hoveredPoint = hoveredIdx != null ? data[hoveredIdx] : null;
  const hoveredCategory = hoveredPoint ? getISPUCategory(hoveredPoint.value, breakpoints) : null;
  const hoveredTime = hoveredPoint
    ? new Date(hoveredPoint.observed_at).toLocaleString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <div className="w-full space-y-2">
      {/* Interactive Tooltip & Detail Bar on Hover */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-rw-smoke-50 rounded-lg border border-rw-smoke-200 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-rw-smoke-500 font-medium">
            {hoveredPoint ? "Waktu Pengamatan:" : "Detail:"}
          </span>
          <span className="font-semibold text-rw-peat-900">
            {hoveredTime ? `${hoveredTime} WIB` : "Arahkan kursor ke grafik untuk detail per jam"}
          </span>
        </div>
        {hoveredPoint && hoveredCategory && (
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1">
              <span className="text-rw-smoke-500 font-medium">Konsentrasi:</span>
              <span className="rw-readout font-bold text-rw-peat-900 text-sm">
                {hoveredPoint.value.toFixed(1)}
              </span>
              <span className="text-[10px] text-rw-smoke-500">{hoveredPoint.unit}</span>
            </div>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${hoveredCategory.bgColor} ${hoveredCategory.color}`}>
              {hoveredCategory.icon}
              <span>{hoveredCategory.label}</span>
            </div>
          </div>
        )}
      </div>

      <div className="w-full overflow-x-auto select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair touch-none"
          role="img"
          aria-label={`Grafik tren ${pollutantLabel} 24 jam terakhir`}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoveredIdx(null)}
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

          {/* Data points */}
          {data.map((p, i) => (
            <circle
              key={i}
              cx={xScale(i)}
              cy={yScale(p.value)}
              r={hoveredIdx === i ? "4" : "2"}
              fill={hoveredIdx === i ? "#b45309" : "#8b4513"}
            />
          ))}

          {/* Hover Crosshair and Active Point */}
          {hoveredIdx != null && hoveredPoint && (
            <g pointerEvents="none">
              <line
                x1={xScale(hoveredIdx)}
                y1={padding.top}
                x2={xScale(hoveredIdx)}
                y2={height - padding.bottom}
                stroke="#8b4513"
                strokeWidth="1.5"
                strokeDasharray="3,3"
                opacity="0.8"
              />
              <circle
                cx={xScale(hoveredIdx)}
                cy={yScale(hoveredPoint.value)}
                r="6"
                fill="#b45309"
                stroke="#ffffff"
                strokeWidth="2.5"
              />
            </g>
          )}

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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Station Card
// ---------------------------------------------------------------------------

function StationCard({
  station,
  selectedPollutant,
  isSelected,
  onSelectStation,
  onSelectPollutant,
}: {
  station: AQStationLatest;
  selectedPollutant: string;
  isSelected: boolean;
  onSelectStation: () => void;
  onSelectPollutant: (pollutant: string) => void;
}) {
  const availablePollutants = station.observations.map((o) => o.pollutant);
  const currentObs = station.observations.find((o) => o.pollutant === selectedPollutant) ?? station.observations[0];
  const activePollutant = currentObs ? currentObs.pollutant : selectedPollutant;
  const breakpoints = activePollutant === "pm25" ? ISPU_PM25 : ISPU_PM10;
  const category = currentObs ? getISPUCategory(currentObs.value, breakpoints) : null;

  return (
    <div
      onClick={onSelectStation}
      className={`rw-instrument-panel rounded-xl border cursor-pointer transition-all p-4 shadow-2xs hover:shadow-md ${
        isSelected
          ? "border-rw-sienna-600 ring-2 ring-rw-sienna-600/20 bg-rw-sienna-50/20"
          : "border-rw-smoke-200 bg-white hover:border-rw-smoke-300"
      }`}
      style={{ borderLeftColor: isSelected ? "var(--rw-sienna-600)" : "var(--rw-sienna-400)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-rw-peat-900">
              {station.station_name || `Stasiun #${station.station_id}`}
            </h4>
            {isSelected && (
              <span className="text-[10px] bg-rw-sienna-600 text-white font-semibold px-1.5 py-0.5 rounded">
                Aktif di Grafik
              </span>
            )}
          </div>
          {station.distance_km != null && station.distance_km > 0 && (
            <p className="text-xs text-rw-smoke-500 mt-0.5">
              {station.distance_km.toFixed(1)} km dari titik acuan
            </p>
          )}
        </div>
        {category && (
          <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${category.bgColor} ${category.color}`}>
            {category.icon}
            <span>{category.label}</span>
          </div>
        )}
      </div>

      {/* Pollutant selector */}
      {availablePollutants.length > 1 && (
        <div className="flex gap-1.5 mt-3 mb-3" onClick={(e) => e.stopPropagation()}>
          {availablePollutants.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                onSelectPollutant(p);
                onSelectStation();
              }}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedPollutant === p
                  ? "bg-rw-sienna-600 text-white shadow-2xs"
                  : "bg-rw-smoke-100 text-rw-smoke-700 hover:bg-rw-smoke-200"
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
          <span className="rw-readout text-2xl font-bold text-rw-peat-900">
            {currentObs.value.toFixed(1)}
          </span>
          <span className="text-sm text-rw-smoke-500">{currentObs.unit}</span>
        </div>
      ) : (
        <p className="text-sm text-rw-smoke-500 italic mb-2">
          Data tidak tersedia untuk polutan ini
        </p>
      )}

      {/* Metadata */}
      <div className="flex items-center justify-between text-xs text-rw-smoke-500">
        <span>
          {currentObs ? `Diperbarui ${formatAge(currentObs.age_seconds)}` : ""}
        </span>
        <span className="text-[11px] text-rw-sienna-700 font-medium">
          {isSelected ? "✓ Sedang Ditampilkan" : "Klik untuk Lihat Tren →"}
        </span>
      </div>

      {/* ISPU Reference Note */}
      {category && (
        <div className="mt-2.5 pt-2 border-t border-rw-smoke-100">
          <p className="text-[10px] text-rw-smoke-400 leading-relaxed">
            Kategori ISPU — KLHK (PP No. 22/2021).
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
    return () => {
      cancelled = true;
    };
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
    return () => {
      cancelled = true;
    };
  }, [selectedStation, selectedPollutant]);

  if (loading) {
    return (
      <div className="rounded-xl border border-rw-smoke-200 bg-white p-5 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-rw-smoke-100 rounded w-1/3" />
          <div className="h-4 bg-rw-smoke-100 rounded w-2/3" />
          <div className="h-4 bg-rw-smoke-100 rounded w-1/2" />
        </div>
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

  if (!data || data.stations.length === 0) {
    return (
      <div className="rounded-xl border border-rw-smoke-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-rw-smoke-500">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <span className="text-sm font-medium">Data kualitas udara sementara tidak tersedia</span>
        </div>
      </div>
    );
  }

  const activeStationObj = data.stations.find((s) => s.station_id === selectedStation) ?? data.stations[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-rw-peat-900 flex items-center gap-2 font-display">
            <svg className="h-5 w-5 text-rw-sienna-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M17.5 19H9a7 7 0 116.71-9h1.79a4.5 4.5 0 110 9z" />
            </svg>
            Pemantauan Kualitas Udara Riau
          </h2>
          <p className="text-xs text-rw-smoke-500 mt-0.5">
            Pantauan polutan partikulat dari seluruh stasiun SPKUA di Provinsi Riau
          </p>
        </div>
        <MockBadge />
      </div>

      {stale && (
        <div className="rounded-lg border border-rw-haze-700/30 bg-rw-haze-50 p-3">
          <p className="text-xs text-rw-smoke-700 flex items-center gap-1.5 font-medium">
            <svg className="h-3.5 w-3.5 text-rw-haze-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Data mungkin tertunda — pembacaan terakhir lebih dari 6 jam yang lalu
          </p>
        </div>
      )}

      {/* Interactive 24-Hour Trend Chart Card with Station & Pollutant Switcher */}
      {history && history.points.length > 0 && (
        <div className="rounded-xl border border-rw-smoke-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-rw-smoke-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-rw-peat-900 flex items-center gap-2">
                <span>Tren {history.pollutant === "pm25" ? "PM2.5" : history.pollutant.toUpperCase()} — 24 Jam Terakhir</span>
              </h3>
              <p className="text-xs text-rw-smoke-500 mt-0.5">
                Stasiun terpilih: <strong className="text-rw-sienna-700">{activeStationObj?.station_name}</strong>
              </p>
            </div>

            {/* Pollutant Toggle */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto bg-rw-smoke-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setSelectedPollutant("pm25")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  selectedPollutant === "pm25"
                    ? "bg-white text-rw-sienna-700 shadow-2xs font-bold"
                    : "text-rw-smoke-600 hover:text-rw-smoke-900"
                }`}
              >
                PM2.5
              </button>
              <button
                type="button"
                onClick={() => setSelectedPollutant("pm10")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  selectedPollutant === "pm10"
                    ? "bg-white text-rw-sienna-700 shadow-2xs font-bold"
                    : "text-rw-smoke-600 hover:text-rw-smoke-900"
                }`}
              >
                PM10
              </button>
            </div>
          </div>

          {/* Interactive Station Switcher Pills Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-rw-smoke-700 uppercase tracking-wide">
                Pilih Stasiun Pemantau ({data.stations.length} Stasiun Tersedia):
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.stations.map((st) => {
                const isCurrent = st.station_id === selectedStation;
                return (
                  <button
                    key={st.station_id}
                    type="button"
                    onClick={() => setSelectedStation(st.station_id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
                      isCurrent
                        ? "bg-rw-peat-900 text-white border-rw-peat-900 shadow-2xs font-semibold"
                        : "bg-white text-rw-smoke-700 border-rw-smoke-200 hover:border-rw-smoke-400 hover:bg-rw-smoke-50"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${isCurrent ? "bg-rw-sienna-400" : "bg-rw-smoke-300"}`} />
                    <span>{st.station_name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chart */}
          <AQHistoryChart data={history.points} pollutant={history.pollutant} />
        </div>
      )}

      {/* Station list header */}
      <div className="pt-2">
        <h3 className="text-sm font-bold text-rw-peat-900 mb-2">
          Daftar Stasiun Pemantau & Pembacaan Terkini
        </h3>
        <p className="text-xs text-rw-smoke-500 mb-3">
          Klik pada salah satu stasiun di bawah untuk melihat grafik tren dan riwayat 24 jamnya.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.stations.map((station) => (
            <StationCard
              key={station.station_id}
              station={station}
              selectedPollutant={selectedPollutant}
              isSelected={station.station_id === selectedStation}
              onSelectStation={() => setSelectedStation(station.station_id)}
              onSelectPollutant={(p) => {
                setSelectedPollutant(p);
                setSelectedStation(station.station_id);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
