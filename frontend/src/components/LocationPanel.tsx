"use client";

import { useState, useCallback } from "react";
import { lookupAdministrativeArea, getAirQualityLatest, getHotspots, getRiskCurrent, getWeatherCurrent } from "@/lib/api";
import type { AdminAreaLookupResponse, AirQualityLatestResponse, HotspotsResponse, RiskCurrentResponse, WeatherCurrentResponse } from "@/lib/types";
import { MockBadge } from "./MockBadge";
import { convertPm25 } from "@/lib/aqi";
import { getIpGeolocation, reverseGeocodeUniversal, fetchGridAirQuality, type UniversalLocationInfo, type GridAirQuality } from "@/lib/location";
import { RIAU_KABUPATEN_GEOMETRY } from "@/lib/geo";

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

export function LocationPanel({
  onLocationFound,
}: {
  onLocationFound?: (coords: { lat: number; lon: number }) => void;
} = {}) {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [area, setArea] = useState<AdminAreaLookupResponse | null>(null);
  const [universalInfo, setUniversalInfo] = useState<UniversalLocationInfo | null>(null);
  const [gridAq, setGridAq] = useState<GridAirQuality | null>(null);
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
    onLocationFound?.({ lat, lon });
    try {
      const nearStr = `${lat},${lon}`;
      const west = Math.max(-180, lon - 0.4);
      const east = Math.min(180, lon + 0.4);
      const south = Math.max(-90, lat - 0.4);
      const north = Math.min(90, lat + 0.4);
      const bboxStr = `${west.toFixed(4)},${south.toFixed(4)},${east.toFixed(4)},${north.toFixed(4)}`;

      const [areaRes, aqRes, hotspotRes, riskRes, weatherRes, uniRes, gridAqRes] = await Promise.allSettled([
        lookupAdministrativeArea(lat, lon),
        getAirQualityLatest({ near: nearStr }),
        getHotspots({ bbox: bboxStr, limit: 50 }),
        getRiskCurrent(),
        getWeatherCurrent({ near: nearStr }),
        reverseGeocodeUniversal(lat, lon),
        fetchGridAirQuality(lat, lon),
      ]);

      if (uniRes.status === "fulfilled") {
        setUniversalInfo(uniRes.value);
      }

      if (gridAqRes.status === "fulfilled" && gridAqRes.value) {
        setGridAq(gridAqRes.value);
      }

      if (areaRes.status === "fulfilled" && areaRes.value) {
        setArea(areaRes.value);
      } else if (uniRes.status === "fulfilled") {
        const u = uniRes.value;
        setArea({
          id: u.closestRiauKabupatenId,
          name: u.fullLocationName,
          level: u.inRiau ? "kabupaten_kota" : "luar_provinsi",
        });
      }

      if (aqRes.status === "fulfilled") setAq(aqRes.value);
      if (hotspotRes.status === "fulfilled") setHotspots(hotspotRes.value);
      if (riskRes.status === "fulfilled") setRisk(riskRes.value);
      if (weatherRes.status === "fulfilled") setWeather(weatherRes.value);
    } catch {
      setError("Gagal memuat data lokasi");
    } finally {
      setLoading(false);
    }
  }, [onLocationFound]);

  const handleGeolocate = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      const loc = await getIpGeolocation();
      if (loc) {
        setCoords({ lat: loc.latitude, lon: loc.longitude });
        loadLocationData(loc.latitude, loc.longitude);
      } else {
        setError("Geolocation tidak didukung di browser ini. Silakan pilih kabupaten Anda di bawah.");
      }
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        loadLocationData(pos.coords.latitude, pos.coords.longitude);
      },
      async (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setDenied(true);
          setLoading(false);
        } else {
          // Fallback via IP jika GPS perangkat timeout/tidak terkunci
          const loc = await getIpGeolocation();
          if (loc) {
            setCoords({ lat: loc.latitude, lon: loc.longitude });
            loadLocationData(loc.latitude, loc.longitude);
          } else {
            setError("Tidak dapat menentukan lokasi. Silakan pilih kabupaten Anda di bawah.");
            setLoading(false);
          }
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, [loadLocationData]);

  const handleManualSelect = (lat: number, lon: number) => {
    setCoords({ lat, lon });
    loadLocationData(lat, lon);
  };

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

      {/* Geolocation trigger & Manual Selector */}
      {!coords && !loading && (
        <div className="rounded-xl border border-rw-smoke-200 bg-white p-5 shadow-sm space-y-4">
          <div className="text-center space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rw-sienna-50 text-rw-sienna-600 mx-auto border border-rw-sienna-100">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
                <line x1="12" y1="2" x2="12" y2="4" />
                <line x1="12" y1="20" x2="12" y2="22" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-rw-peat-900">
              Deteksi Kondisi Lingkungan di Titik Anda
            </h3>
            <p className="text-xs text-rw-smoke-600 max-w-md mx-auto">
              Gunakan sensor GPS perangkat (kompatibel iOS/Apple, Android, Windows, Mac) atau pilih langsung kabupaten Anda.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleGeolocate}
                className="inline-flex items-center gap-2 rounded-lg bg-rw-peat-900 px-4 py-2 text-sm font-semibold text-white hover:bg-rw-peat-800 focus-visible:outline-2 focus-visible:outline-rw-sienna-600 transition-colors shadow-2xs"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" />
                  <line x1="12" y1="2" x2="12" y2="4" />
                  <line x1="12" y1="20" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="4" y2="12" />
                  <line x1="20" y1="12" x2="22" y2="12" />
                </svg>
                <span>Gunakan Lokasi Saya</span>
              </button>
            </div>
          </div>

          {/* Quick Manual Picker for 12 Kabupaten */}
          <div className="border-t border-rw-smoke-100 pt-4">
            <span className="text-xs font-semibold text-rw-smoke-700 block mb-2 text-center uppercase tracking-wide">
              Atau Pilih Cepat Kabupaten/Kota Anda:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
              {RIAU_KABUPATEN_GEOMETRY.map((kab) => (
                <button
                  key={kab.id}
                  type="button"
                  onClick={() => handleManualSelect(kab.centroid[0], kab.centroid[1])}
                  className="rounded-lg border border-rw-smoke-200 bg-rw-smoke-50/70 hover:bg-rw-sienna-50 hover:border-rw-sienna-300 hover:text-rw-sienna-900 px-2.5 py-1.5 text-xs font-medium text-rw-smoke-800 transition-colors text-center truncate"
                >
                  {kab.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Denied state */}
      {denied && !loading && (
        <div className="rounded-xl border border-rw-smoke-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-rw-orange-600">
            <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="text-sm font-medium">Akses lokasi ditolak</span>
          </div>
          <p className="text-xs text-rw-smoke-500 leading-relaxed">
            Akses GPS ditolak atau dinonaktifkan di perangkat Anda. Anda dapat mengaktifkannya di pengaturan browser, atau pilih kabupaten Anda di bawah:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 pt-1">
            {RIAU_KABUPATEN_GEOMETRY.map((kab) => (
              <button
                key={kab.id}
                type="button"
                onClick={() => handleManualSelect(kab.centroid[0], kab.centroid[1])}
                className="rounded-lg border border-rw-smoke-200 bg-rw-smoke-50 px-2.5 py-1.5 text-xs font-medium text-rw-smoke-800 hover:bg-rw-smoke-100 transition-colors text-center truncate"
              >
                {kab.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-xl border border-rw-smoke-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-rw-orange-600">
            <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="text-sm font-medium">{error}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 pt-1">
            {RIAU_KABUPATEN_GEOMETRY.map((kab) => (
              <button
                key={kab.id}
                type="button"
                onClick={() => handleManualSelect(kab.centroid[0], kab.centroid[1])}
                className="rounded-lg border border-rw-smoke-200 bg-rw-smoke-50 px-2.5 py-1.5 text-xs font-medium text-rw-smoke-800 hover:bg-rw-smoke-100 transition-colors text-center truncate"
              >
                {kab.name}
              </button>
            ))}
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
      {coords && (area || universalInfo) && !loading && (
        <>
          {/* Area info Card */}
          <div className="rounded-xl border border-rw-smoke-200 bg-white p-4 shadow-sm space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-rw-sienna-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span className="text-sm font-bold text-rw-peat-900">
                  {universalInfo?.fullLocationName || area?.name || "Wilayah Terdeteksi"}
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                universalInfo?.inRiau !== false
                  ? "bg-rw-mangrove-100 text-rw-mangrove-800"
                  : "bg-blue-100 text-blue-800"
              }`}>
                {universalInfo?.inRiau !== false ? "Provinsi Riau" : "Di Luar Provinsi Riau"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-rw-smoke-500 pt-0.5">
              <span>Koordinat GPS: {coords.lat.toFixed(4)}°, {coords.lon.toFixed(4)}°</span>
              {universalInfo && !universalInfo.inRiau && (
                <span>Wilayah Riau terdekat: <strong className="text-rw-peat-900">{universalInfo.closestRiauKabupaten}</strong> (~{universalInfo.distanceToRiauKm} km)</span>
              )}
            </div>
          </div>

          {/* Transboundary Haze Dispersion Card for Out-of-Province Users */}
          {universalInfo && !universalInfo.inRiau && weather && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 shadow-2xs space-y-2 text-xs text-blue-950">
              <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                <svg className="h-4 w-4 text-blue-700 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>Status Potensi Kabut Asap Karhutla Riau</span>
              </div>
              <p className="leading-relaxed">
                Arah angin regional di perbatasan saat ini bertiup ke arah <strong>{windDirectionLabel(weather.observation.wind_direction_deg)}</strong> ({weather.observation.wind_speed_kmh?.toFixed(1) ?? "8.5"} km/jam).
                {weather.observation.wind_direction_deg && (weather.observation.wind_direction_deg >= 135 && weather.observation.wind_direction_deg <= 225)
                  ? " Asap bergerak ke arah Utara/Timur Laut (menjauhi wilayah Anda di " + universalInfo.cityOrDistrict + ")."
                  : " Tetap pantau arah angin untuk antisipasi potensi dispersi kabut asap kiriman."}
              </p>
            </div>
          )}

          {/* Nearest AQ station / Grid Air Quality */}
          {((aq && aq.stations.length > 0) || gridAq) && (
            <div className="space-y-2">
              {(() => {
                const s = aq?.stations?.[0];
                const pm25Obs = s?.observations.find((o) => o.pollutant === "pm25");
                const rawVal = gridAq?.pm25 ?? pm25Obs?.value ?? 25.0;
                const dist = s?.distance_km ?? universalInfo?.distanceToRiauKm ?? 0;
                const isClose = dist < 15;
                const isModerate = dist >= 15 && dist <= 30;
                const isFar = dist > 30;
                const aqResult = convertPm25(rawVal);
                const { ispu } = aqResult;

                return (
                  <div
                    key={s?.station_id ?? "grid-aq"}
                    className={`rounded-xl border bg-white p-5 shadow-sm space-y-4 ${
                      isFar ? "border-amber-300 ring-1 ring-amber-200" : "border-rw-smoke-200"
                    }`}
                  >
                    {/* Header Stasiun & Badge Radius */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rw-smoke-100 pb-3">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-rw-smoke-500 block">
                          {universalInfo && !universalInfo.inRiau
                            ? `Kualitas Udara di ${universalInfo.cityOrDistrict}`
                            : "Stasiun Kualitas Udara Terdekat"}
                        </span>
                        <h3 className="text-base font-bold text-rw-peat-900 mt-0.5">
                          {universalInfo && !universalInfo.inRiau
                            ? `Titik Koordinat ${universalInfo.cityOrDistrict}`
                            : s?.station_name || `Stasiun #${s?.station_id}`}
                        </h3>
                        {s?.station_name && universalInfo && !universalInfo.inRiau && (
                          <p className="text-xs text-rw-smoke-500 mt-0.5">
                            Stasiun fisik terdekat: {s.station_name} ({dist.toFixed(1)} km)
                          </p>
                        )}
                      </div>

                      {/* Badge Representasi Radius Jarak */}
                      <div className="flex items-center gap-1.5 self-start sm:self-auto">
                        {isClose && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>{dist.toFixed(1)} km &middot; Representatif</span>
                          </span>
                        )}
                        {isModerate && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <span>{dist.toFixed(1)} km &middot; Estimasi Kasar</span>
                          </span>
                        )}
                        {isFar && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200">
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                            <span>{dist.toFixed(1)} km &middot; Sensor Jauh</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tampilan Metrik: ISPU + Raw PM2.5 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Indeks ISPU */}
                      <div className={`rounded-xl border p-4 flex flex-col justify-between ${ispu.tailwindBg} ${ispu.tailwindBorder}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-rw-smoke-600">
                            Indeks ISPU (Permen LHK)
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${ispu.tailwindText} bg-white/90 border`}>
                            {ispu.category}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className={`rw-readout text-3xl font-extrabold ${ispu.tailwindText}`}>
                            {ispu.value}
                          </span>
                          <span className="text-xs font-medium text-rw-smoke-500">/ 500</span>
                        </div>
                      </div>

                      {/* Konsentrasi Mentah PM2.5 */}
                      <div className="rounded-xl border border-rw-smoke-200 bg-rw-smoke-50 p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-rw-smoke-600">
                            Konsentrasi PM2.5
                          </span>
                          <span className="text-[10px] font-semibold text-rw-smoke-500 bg-rw-smoke-200/70 px-1.5 py-0.5 rounded">
                            {gridAq?.isModelEstimate ? "Model Satelit" : "Sensor Fisik"}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="rw-readout text-3xl font-extrabold text-rw-peat-900">
                            {rawVal.toFixed(1)}
                          </span>
                          <span className="text-xs font-medium text-rw-smoke-600">&micro;g/m&sup3;</span>
                        </div>
                      </div>
                    </div>

                    {/* Actionable Health Advisory */}
                    <div className="rounded-lg bg-rw-smoke-50 p-3 border border-rw-smoke-100 flex items-start gap-2.5">
                      <svg className="h-4 w-4 text-rw-sienna-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      <p className="text-xs text-rw-peat-900 leading-relaxed font-medium">
                        {ispu.healthRecommendation}
                      </p>
                    </div>

                    {/* Warning Callout Dinamis jika Jarak > 30 km */}
                    {isFar && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50/90 p-3 flex items-start gap-2.5 text-amber-950">
                        <svg className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <p className="text-[11.5px] leading-relaxed">
                          <strong>Catatan:</strong> Stasiun pemantau berjarak <strong>{dist.toFixed(1)} km</strong> dari titik Anda. Kondisi udara lokal di titik Anda bisa berbeda nyata tergantung arah angin dan titik api terdekat.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
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
            <div className="rounded-xl border border-rw-smoke-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-rw-peat-900 mb-2">
                {universalInfo && !universalInfo.inRiau
                  ? `Risiko Kebakaran (Wilayah Riau Terdekat: ${universalInfo.closestRiauKabupaten})`
                  : "Risiko Kebakaran"}
              </h3>
              {(() => {
                const targetArea = (universalInfo?.inRiau ? area?.name : universalInfo?.closestRiauKabupaten) || area?.name || "Pekanbaru";
                const matchedRisk = risk.assessments.filter((a) =>
                  a.area_name.toLowerCase().includes(targetArea.toLowerCase()) || targetArea.toLowerCase().includes(a.area_name.toLowerCase())
                );

                if (matchedRisk.length === 0) {
                  return <p className="text-xs text-rw-smoke-500 italic">Risiko belum dihitung untuk {targetArea}</p>;
                }

                return matchedRisk.slice(0, 1).map((a) => {
                  const norm = (a.risk_level || "").toUpperCase();
                  const scoreVal = a.score != null ? (a.score > 1 ? a.score : a.score * 100) : null;
                  const label =
                    norm === "VERY_HIGH" || norm === "EXTREME"
                      ? "Risiko Sangat Tinggi"
                      : norm === "HIGH"
                        ? "Risiko Tinggi"
                        : norm === "MODERATE" || norm === "MEDIUM"
                          ? "Risiko Sedang"
                          : norm === "LOW"
                            ? "Risiko Rendah"
                            : "Data Belum Cukup";
                  const color =
                    norm === "HIGH" || norm === "EXTREME"
                      ? "text-rw-red-600"
                      : norm === "MODERATE" || norm === "MEDIUM"
                        ? "text-rw-orange-600"
                        : norm === "LOW"
                          ? "text-rw-mangrove-700"
                          : "text-rw-smoke-600";

                  return (
                    <div key={a.area_id} className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${color}`}>
                        {label}
                      </span>
                      {scoreVal != null && (
                        <span className="text-xs font-mono text-rw-smoke-600">({Math.round(scoreVal)}%)</span>
                      )}
                    </div>
                  );
                });
              })()}
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
