"use client";

import { useEffect, useState } from "react";
import { getWeatherCurrent, getWeatherForecast } from "@/lib/api";
import type { WeatherCurrentResponse, WeatherForecastResponse, WeatherObservation } from "@/lib/types";
import { MockBadge } from "./MockBadge";

// ---------------------------------------------------------------------------
// Wind direction → compass label (Bahasa Indonesia)
// ---------------------------------------------------------------------------

function windDirectionLabel(deg: number | null): string {
  if (deg === null) return "-";
  const dirs = [
    "Utara", "Timur Laut", "Timur", "Tenggara",
    "Selatan", "Barat Daya", "Barat", "Barat Laut",
  ];
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx];
}

function windDirectionIcon(deg: number | null) {
  if (deg === null) return null;
  return (
    <svg
      className="h-4 w-4 text-rw-gray-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      style={{ transform: `rotate(${deg}deg)` }}
    >
      <path d="M12 2l0 20M12 2l-4 4M12 2l4 4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

function formatAge(seconds: number | null): string {
  if (seconds === null) return "";
  if (seconds < 3600) return `${Math.round(seconds / 60)} menit lalu`;
  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

function formatHour(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:00`;
}

// ---------------------------------------------------------------------------
// Weather stat card
// ---------------------------------------------------------------------------

function WeatherStat({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: string | number | null;
  unit: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-rw-gray-100 bg-rw-gray-50 p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-rw-green-700 shadow-sm">
        {icon}
      </div>
      <div>
        <span className="text-xs text-rw-gray-500 block">{label}</span>
        <span className="text-sm font-semibold text-rw-gray-900">
          {value !== null ? value : "-"} {unit}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hourly forecast row
// ---------------------------------------------------------------------------

function ForecastRow({ obs }: { obs: WeatherObservation }) {
  const hour = formatHour(obs.valid_time);
  const temp = obs.temperature_c !== null ? `${obs.temperature_c.toFixed(1)}` : "-";
  const precip = obs.precipitation_mm !== null && obs.precipitation_mm > 0 ? `${obs.precipitation_mm.toFixed(1)}` : null;

  return (
    <div className="flex flex-col items-center gap-1 min-w-[60px] py-2">
      <span className="text-xs font-medium text-rw-gray-600">{hour}</span>
      {/* Temp */}
      <span className="text-sm font-semibold text-rw-gray-900">{temp}°</span>
      {/* Rain indicator */}
      {precip ? (
        <div className="flex items-center gap-0.5 text-rw-blue-600">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2C20 10.48 17.33 6.55 12 2z" />
          </svg>
          <span className="text-[10px] font-mono">{precip}</span>
        </div>
      ) : (
        <div className="h-3" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Weather Panel
// ---------------------------------------------------------------------------

export function WeatherPanel({ kabupatenId }: { kabupatenId?: number }) {
  const [current, setCurrent] = useState<WeatherCurrentResponse | null>(null);
  const [forecast, setForecast] = useState<WeatherForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = kabupatenId ? { kabupaten_id: kabupatenId } : undefined;
        const [currRes, forecastRes] = await Promise.all([
          getWeatherCurrent(params),
          getWeatherForecast({ near: "0.5,101.5", hours: 24 }),
        ]);
        if (!cancelled) {
          setCurrent(currRes);
          setForecast(forecastRes);
        }
      } catch {
        if (!cancelled) setError("Gagal memuat data cuaca");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [kabupatenId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-rw-gray-200 bg-white p-5 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-rw-gray-100 rounded w-1/3" />
          <div className="h-4 bg-rw-gray-100 rounded w-2/3" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-16 bg-rw-gray-100 rounded" />
            <div className="h-16 bg-rw-gray-100 rounded" />
          </div>
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

  if (!current) {
    return (
      <div className="rounded-xl border border-rw-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-rw-gray-500">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <span className="text-sm">Data cuaca sementara tidak tersedia</span>
        </div>
      </div>
    );
  }

  const obs = current.observation;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-rw-gray-900 flex items-center gap-2">
          <svg className="h-5 w-5 text-rw-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M17.5 19H9a7 7 0 116.71-9h1.79a4.5 4.5 0 110 9z" />
          </svg>
          Cuaca
        </h2>
        <MockBadge />
      </div>

      {/* Area name + observation time */}
      <div className="text-sm text-rw-gray-600">
        <span className="font-medium text-rw-gray-800">{current.area_name}</span>
        {obs.age_seconds !== null && (
          <span className="ml-2 text-rw-gray-500">
            Diperbarui {formatAge(obs.age_seconds)}
          </span>
        )}
      </div>

      {/* Current conditions grid */}
      <div className="grid grid-cols-2 gap-3">
        <WeatherStat
          label="Suhu"
          value={obs.temperature_c !== null ? `${obs.temperature_c.toFixed(1)}` : null}
          unit="°C"
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" />
            </svg>
          }
        />
        <WeatherStat
          label="Kelembapan"
          value={obs.humidity_pct !== null ? `${obs.humidity_pct.toFixed(1)}` : null}
          unit="%"
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2C20 10.48 17.33 6.55 12 2z" />
            </svg>
          }
        />
        <WeatherStat
          label="Curah Hujan"
          value={obs.precipitation_mm !== null ? `${obs.precipitation_mm.toFixed(1)}` : null}
          unit="mm"
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M20 17.58A5 5 0 0018 8h-1.26A8 8 0 104 16.25" />
              <line x1="8" y1="16" x2="8.01" y2="21" />
              <line x1="12" y1="18" x2="12.01" y2="23" />
              <line x1="16" y1="16" x2="16.01" y2="21" />
            </svg>
          }
        />
        <WeatherStat
          label="Angin"
          value={obs.wind_speed_kmh !== null ? `${obs.wind_speed_kmh.toFixed(1)}` : null}
          unit={`km/h ${windDirectionLabel(obs.wind_direction_deg)}`}
          icon={windDirectionIcon(obs.wind_direction_deg)}
        />
      </div>

      {/* Stale warning */}
      {obs.age_seconds !== null && obs.age_seconds > 3 * 3600 && (
        <div className="rounded-lg border border-rw-amber-100 bg-rw-amber-100/50 p-2">
          <p className="text-xs text-rw-gray-700 flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-rw-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Data mungkin tertunda
          </p>
        </div>
      )}

      {/* Hourly forecast timeline */}
      {forecast && forecast.forecast.length > 0 && (
        <div className="rounded-xl border border-rw-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-rw-gray-900 mb-3">
            Prakiraan 24 Jam — {forecast.area_name}
          </h3>
          <div className="flex overflow-x-auto gap-1 pb-2 rw-scrollbar">
            {forecast.forecast.map((f, i) => (
              <ForecastRow key={i} obs={f} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
