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
      className="h-4 w-4 text-rw-sienna-600"
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
  note,
}: {
  label: string;
  value: string | number | null;
  unit: string;
  icon: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-rw-smoke-200/80 bg-rw-smoke-50/70 p-3.5 shadow-2xs">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white text-rw-sienna-600 shadow-2xs border border-rw-smoke-100 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs text-rw-smoke-500 block font-medium">{label}</span>
        <span className="rw-readout text-sm font-bold text-rw-peat-900 block mt-0.5">
          {value !== null ? value : "-"} {unit}
        </span>
        {note && <p className="text-[10.5px] text-rw-smoke-500 mt-0.5 leading-tight">{note}</p>}
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
    <div className="flex flex-col items-center gap-1 min-w-[64px] py-2 px-1 rounded-lg bg-rw-smoke-50 border border-rw-smoke-100">
      <span className="text-[11px] font-semibold text-rw-smoke-600">{hour}</span>
      <span className="rw-readout text-xs font-bold text-rw-peat-900">{temp}°C</span>
      {precip ? (
        <div className="flex items-center gap-0.5 text-blue-600">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2C20 10.48 17.33 6.55 12 2z" />
          </svg>
          <span className="text-[10px] font-mono font-bold">{precip}</span>
        </div>
      ) : (
        <span className="text-[10px] text-rw-smoke-400">0.0 mm</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Weather Panel
// ---------------------------------------------------------------------------

export function WeatherPanel({
  kabupatenId,
  near,
  userKabupatenName,
}: {
  kabupatenId?: number;
  near?: string;
  userKabupatenName?: string;
}) {
  const [current, setCurrent] = useState<WeatherCurrentResponse | null>(null);
  const [forecast, setForecast] = useState<WeatherForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        let currentParams: { kabupaten_id?: number; near?: string } | undefined;
        let forecastParams: { kabupaten_id?: number; near?: string; hours: number };

        if (kabupatenId) {
          currentParams = { kabupaten_id: kabupatenId };
          forecastParams = { kabupaten_id: kabupatenId, hours: 24 };
        } else if (near) {
          currentParams = { near };
          forecastParams = { near, hours: 24 };
        } else {
          currentParams = undefined;
          forecastParams = { near: "0.5,101.5", hours: 24 };
        }

        const [currRes, forecastRes] = await Promise.all([
          getWeatherCurrent(currentParams),
          getWeatherForecast(forecastParams),
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
    return () => {
      cancelled = true;
    };
  }, [kabupatenId, near, retryCount]);

  if (loading) {
    return (
      <div className="rounded-xl border border-rw-smoke-200 bg-white p-5 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-rw-smoke-100 rounded w-1/3" />
          <div className="h-4 bg-rw-smoke-100 rounded w-2/3" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-16 bg-rw-smoke-100 rounded" />
            <div className="h-16 bg-rw-smoke-100 rounded" />
          </div>
        </div>
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

  if (!current) {
    return (
      <div className="rounded-xl border border-rw-smoke-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-rw-smoke-500">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <span className="text-sm font-medium">Data cuaca sementara tidak tersedia</span>
        </div>
      </div>
    );
  }

  const obs = current.observation;
  const cloudVal = obs.cloud_cover_pct ?? 35.0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-rw-peat-900 flex items-center gap-2 font-display">
              <svg className="h-5 w-5 text-rw-sienna-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M17.5 19H9a7 7 0 116.71-9h1.79a4.5 4.5 0 110 9z" />
              </svg>
              Kondisi Cuaca &amp; Atmosferik
            </h2>
            {userKabupatenName && !kabupatenId && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rw-sienna-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>Lokasi Anda</span>
              </span>
            )}
          </div>
          <div className="text-xs text-rw-smoke-500 mt-0.5">
            Wilayah: <strong className="text-rw-peat-900">{current.area_name}</strong>
            {obs.age_seconds !== null && (
              <span className="ml-2 text-rw-smoke-500">
                &middot; Diperbarui {formatAge(obs.age_seconds)}
              </span>
            )}
          </div>
        </div>
        <MockBadge />
      </div>

      {/* Cloud Cover Context Banner (Modul 3: Integritas Pengamatan Satelit Optik) */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-950">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 mt-0.5">
          {/* Cloud Icon */}
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17.5 19H9a7 7 0 116.71-9h1.79a4.5 4.5 0 110 9z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-blue-900 font-bold">Tutupan Awan ({cloudVal}%):</strong>
            <span className="text-[11px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
              {cloudVal < 30 ? "Cerah / Transparan" : cloudVal < 70 ? "Berawan Sebagian" : "Tertutup Awan Tebal"}
            </span>
          </div>
          <p className="text-[11px] text-blue-900/80 mt-1 leading-relaxed">
            Integritas sensor optik: {cloudVal > 60 ? "Tutupan awan tebal dapat memicu masking (menghalangi sensor satelit mendeteksi titik api kecil di bawahnya)." : "Kondisi langit cerah memungkinkan sensor satelit optik memotret titik panas dengan akurasi optimal."}
          </p>
        </div>
      </div>

      {/* Current conditions grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <WeatherStat
          label="Suhu Permukaan"
          value={obs.temperature_c !== null ? `${obs.temperature_c.toFixed(1)}` : null}
          unit="°C"
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" />
            </svg>
          }
        />
        <WeatherStat
          label="Kelembapan Relatif"
          value={obs.humidity_pct !== null ? `${obs.humidity_pct.toFixed(1)}` : null}
          unit="%"
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2C20 10.48 17.33 6.55 12 2z" />
            </svg>
          }
        />
        <WeatherStat
          label="Curah Hujan Jam Ini"
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
          note={obs.precipitation_mm === 0 ? "Kondisi tidak sedang hujan" : undefined}
        />
        <WeatherStat
          label="Kecepatan &amp; Arah Angin"
          value={obs.wind_speed_kmh !== null ? `${obs.wind_speed_kmh.toFixed(1)}` : null}
          unit={`km/jam (${windDirectionLabel(obs.wind_direction_deg)})`}
          icon={windDirectionIcon(obs.wind_direction_deg)}
        />
      </div>

      {/* Hourly forecast timeline */}
      {forecast && forecast.forecast.length > 0 && (
        <div className="rounded-xl border border-rw-smoke-200 bg-white p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-rw-peat-900">
            Prakiraan Cuaca Per Jam (24 Jam ke Depan) — {forecast.area_name}
          </h3>
          <div className="flex overflow-x-auto gap-2 pb-2 rw-scrollbar">
            {forecast.forecast.map((f, i) => (
              <ForecastRow key={i} obs={f} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
