"use client";

import { useState, useCallback } from "react";
import { lookupAdministrativeArea, getAirQualityLatest, getHotspots, getRiskCurrent, getWeatherCurrent } from "@/lib/api";
import type { AdminAreaLookupResponse, AirQualityLatestResponse, HotspotsResponse, RiskCurrentResponse, WeatherCurrentResponse } from "@/lib/types";
import { MockBadge } from "./MockBadge";

// ---------------------------------------------------------------------------
// Wind direction label
// ---------------------------------------------------------------------------

function windDirectionLabel(deg: number | null): string {
  if (deg === null) return "-";
  const dirs = ["Utara", "Timur Laut", "Timur", "Tenggara", "Selatan", "Barat Daya", "Barat", "Barat Laut"];
  return dirs[Math.round(deg / 45) % 8];
}

// ---------------------------------------------------------------------------
// Main Location Panel
// ---------------------------------------------------------------------------

export function LocationPanel() {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [area, setArea] = useState<AdminAreaLookupResponse | null>(null);
  const [aq, setAq] = useState<AirQualityLatestResponse | null>(null);
  const [hotspots, setHotspots] = useState<HotspotsResponse | null>(null);
  const [risk, setRisk] = useState<RiskCurrentResponse | null>(null);
  const [weather, setWeather] = useState<WeatherCurrentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const loadLocationData = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    try {
      // Parallel lookups
      const nearStr = `${lat},${lon}`;
      const [areaRes, aqRes, hotspotRes, riskRes, weatherRes] = await Promise.all([
        lookupAdministrativeArea(lat, lon),
        getAirQualityLatest({ near: nearStr }),
        getHotspots({ bbox: `${lon - 1},${lat - 1},${lon + 1},${lat + 1}`, limit: 50 }),
        getRiskCurrent(),
        getWeatherCurrent({ near: nearStr }),
      ]);

      setArea(areaRes);
      setAq(aqRes);
      setHotspots(hotspotRes);
      setRisk(riskRes);
      setWeather(weatherRes);
    } catch {
      setError("Gagal memuat data lokasi");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation tidak didukung di browser ini");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        loadLocationData(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setDenied(true);
        } else {
          setError("Tidak dapat menentukan lokasi Anda");
        }
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }, [loadLocationData]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-rw-gray-900 flex items-center gap-2">
          <svg className="h-5 w-5 text-rw-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="4" />
            <line x1="12" y1="20" x2="12" y2="22" />
            <line x1="2" y1="12" x2="4" y2="12" />
            <line x1="20" y1="12" x2="22" y2="12" />
          </svg>
          Lokasi Saya
        </h2>
        <MockBadge />
      </div>

      {/* Geolocation button */}
      {!coords && !loading && (
        <div className="rounded-xl border border-rw-gray-200 bg-white p-5 shadow-sm text-center">
          <svg className="h-8 w-8 text-rw-gray-300 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <p className="text-sm text-rw-gray-600 mb-3">
            Gunakan lokasi Anda untuk melihat data lingkungan terdekat
          </p>
          <button
            type="button"
            onClick={handleGeolocate}
            className="inline-flex items-center gap-2 rounded-lg bg-rw-peat-900 px-4 py-2 text-sm font-medium text-white hover:bg-rw-peat-800 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
              <line x1="12" y1="2" x2="12" y2="4" />
              <line x1="12" y1="20" x2="12" y2="22" />
              <line x1="2" y1="12" x2="4" y2="12" />
              <line x1="20" y1="12" x2="22" y2="12" />
            </svg>
            Gunakan Lokasi Saya
          </button>
          <p className="text-[10px] text-rw-gray-400 mt-2">
            Koordinat hanya digunakan untuk lookup ini dan tidak disimpan.
          </p>
        </div>
      )}

      {/* Denied state */}
      {denied && (
        <div className="rounded-xl border border-rw-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-rw-orange-600">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="text-sm font-medium">Akses lokasi ditolak</span>
          </div>
          <p className="text-xs text-rw-gray-500 mt-1">
            Anda dapat mengaktifkan akses lokasi di pengaturan browser, atau pilih kabupaten dari filter.
          </p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
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
      )}

      {/* Loading state */}
      {loading && (
        <div className="rounded-xl border border-rw-gray-200 bg-white p-5 shadow-sm">
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-rw-gray-100 rounded w-1/3" />
            <div className="h-4 bg-rw-gray-100 rounded w-2/3" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-20 bg-rw-gray-100 rounded" />
              <div className="h-20 bg-rw-gray-100 rounded" />
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {coords && area && !loading && (
        <>
          {/* Area info */}
          <div className="rounded-xl border border-rw-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <svg className="h-4 w-4 text-rw-sienna-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="text-sm font-semibold text-rw-gray-900">{area.name}</span>
              <span className="text-xs text-rw-gray-500">({area.level})</span>
            </div>
            <p className="text-xs text-rw-gray-500">
              Koordinat: {coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}
            </p>
          </div>

          {/* Nearest AQ station */}
          {aq && aq.stations.length > 0 && (
            <div className="rounded-xl border border-rw-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-rw-gray-900 mb-2">Stasiun Kualitas Udara Terdekat</h3>
              {aq.stations.slice(0, 1).map((s) => {
                const pm25 = s.observations.find((o) => o.pollutant === "pm25");
                return (
                  <div key={s.station_id}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-rw-gray-700">{s.station_name || `Stasiun #${s.station_id}`}</span>
                      {s.distance_km != null && (
                        <span className="text-xs text-rw-gray-500">{s.distance_km.toFixed(1)} km</span>
                      )}
                    </div>
                    {pm25 && (
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-lg font-bold text-rw-gray-900 font-mono">{pm25.value.toFixed(1)}</span>
                        <span className="text-xs text-rw-gray-500">{pm25.unit}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Nearby hotspots count */}
          {hotspots && (
            <div className="rounded-xl border border-rw-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-rw-gray-900 mb-2">Titik Panas di Sekitar</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-rw-gray-900">{hotspots.count}</span>
                <span className="text-sm text-rw-gray-500">titik panas dalam radius 100km</span>
              </div>
              {hotspots.disclaimer && (
                <p className="text-[10px] text-rw-gray-400 mt-1 italic">
                  {hotspots.disclaimer}
                </p>
              )}
            </div>
          )}

          {/* Area risk */}
          {risk && risk.assessments.length > 0 && (
            <div className="rounded-xl border border-rw-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-rw-gray-900 mb-2">Risiko Kebakaran</h3>
              {risk.assessments.filter((a) => a.area_name === area.name).slice(0, 1).map((a) => (
                <div key={a.area_id} className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${
                    a.risk_level === "HIGH" ? "text-rw-red-600" : a.risk_level === "MEDIUM" ? "text-rw-orange-600" : "text-rw-mangrove-700"
                  }`}>
                    {a.risk_level === "HIGH" ? "Risiko Tinggi" : a.risk_level === "MEDIUM" ? "Risiko Sedang" : "Risiko Rendah"}
                  </span>
                  {a.score != null && (
                    <span className="text-xs font-mono text-rw-gray-600">{Math.round(a.score * 100)}%</span>
                  )}
                </div>
              ))}
              {risk.assessments.filter((a) => a.area_name === area.name).length === 0 && (
                <p className="text-xs text-rw-gray-500 italic">Risiko belum dihitung untuk {area.name}</p>
              )}
            </div>
          )}

          {/* Weather */}
          {weather && (
            <div className="rounded-xl border border-rw-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-rw-gray-900 mb-2">Cuaca Saat Ini</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-rw-gray-500 text-xs">Suhu</span>
                  <p className="font-medium text-rw-gray-800">{weather.observation.temperature_c?.toFixed(1) ?? "-"}°C</p>
                </div>
                <div>
                  <span className="text-rw-gray-500 text-xs">Kelembapan</span>
                  <p className="font-medium text-rw-gray-800">{weather.observation.humidity_pct?.toFixed(1) ?? "-"}%</p>
                </div>
                <div>
                  <span className="text-rw-gray-500 text-xs">Angin</span>
                  <p className="font-medium text-rw-gray-800">{weather.observation.wind_speed_kmh?.toFixed(1) ?? "-"} km/h {windDirectionLabel(weather.observation.wind_direction_deg)}</p>
                </div>
                <div>
                  <span className="text-rw-gray-500 text-xs">Hujan</span>
                  <p className="font-medium text-rw-gray-800">{weather.observation.precipitation_mm?.toFixed(1) ?? "-"} mm</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
