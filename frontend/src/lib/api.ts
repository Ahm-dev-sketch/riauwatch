// Typed API client for the RIAUWATCH Phase 4 backend.
// ALL requests go through NEXT_PUBLIC_API_URL/api/v1.
// When NEXT_PUBLIC_USE_MOCKS=true, returns local mock data instead.

import type {
  StatusResponse,
  HotspotsResponse,
  HotspotsSummaryResponse,
  AirQualityLatestResponse,
  AirQualityHistoryResponse,
  WeatherCurrentResponse,
  WeatherForecastResponse,
  RiskCurrentResponse,
  AdminAreasResponse,
  AdminAreaLookupResponse,
  MetaDataSourcesResponse,
} from "./types";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "https://riauwatch-api.vercel.app"
).replace(/\/+$/, "");

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  if (USE_MOCKS) {
    // Dynamic import avoids bundling mock data in production
    const mod = await import("./mocks");
    return mockLookup<T>(path, params ?? {}, mod);
  }

  const url = new URL(`/api/v1${path}`, API_BASE);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const retryAfter = res.headers.get("Retry-After");
    const error = new Error(`API ${res.status}: ${res.statusText}`) as Error & {
      status: number;
      retryAfter: number | null;
    };
    error.status = res.status;
    error.retryAfter = retryAfter ? parseInt(retryAfter, 10) : null;
    throw error;
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Mock router — maps paths to mock data
// ---------------------------------------------------------------------------

function mockLookup<T>(
  path: string,
  params: Record<string, string>,
  mod: typeof import("./mocks"),
): T {
  const mocks = mod;
  if (path === "/status") return mocks.mockStatus as T;
  if (path === "/hotspots") return mocks.filterMockHotspots(params) as T;
  if (path === "/hotspots/summary") return mocks.summarizeMockHotspots(params) as T;
  if (path.startsWith("/air-quality/latest")) return mocks.mockAirQuality as T;
  if (path.startsWith("/air-quality/history")) {
    const stationId = params.station_id ? Number(params.station_id) : 1;
    const pollutant = params.pollutant || "pm25";
    return mocks.getMockAirQualityHistory(stationId, pollutant) as T;
  }
  if (path.startsWith("/weather/current")) return mocks.mockWeather as T;
  if (path.startsWith("/weather/forecast")) return mocks.mockWeatherForecast as T;
  if (path.startsWith("/risk/current")) return mocks.mockRisk as T;
  if (path.startsWith("/administrative-areas/lookup")) return mocks.mockAdminLookup as T;
  if (path.startsWith("/administrative-areas")) return mocks.mockAdminAreas as T;
  if (path === "/meta/data-sources") return mocks.mockDataSources as T;

  // Fallback — return empty-ish to avoid crashes for unimplemented mocks
  console.warn(`[mock] No mock for ${path}, returning empty`);
  return {} as T;
}

// ---------------------------------------------------------------------------
// Public API methods
// ---------------------------------------------------------------------------

export async function getStatus(): Promise<StatusResponse> {
  return fetchJson<StatusResponse>("/status");
}

export async function getHotspots(params?: {
  bbox?: string;
  date_from?: string;
  date_to?: string;
  kabupaten_id?: number;
  min_confidence?: string;
  limit?: number;
  offset?: number;
}): Promise<HotspotsResponse> {
  const p: Record<string, string> = {};
  if (params?.bbox) p.bbox = params.bbox;
  if (params?.date_from) p.date_from = params.date_from;
  if (params?.date_to) p.date_to = params.date_to;
  if (params?.kabupaten_id) p.kabupaten_id = String(params.kabupaten_id);
  if (params?.min_confidence) p.min_confidence = params.min_confidence;
  if (params?.limit) p.limit = String(params.limit);
  if (params?.offset) p.offset = String(params.offset);
  return fetchJson<HotspotsResponse>("/hotspots", p);
}

export async function getHotspotsSummary(params?: {
  date_from?: string;
  date_to?: string;
  kabupaten_id?: number;
  min_confidence?: string;
}): Promise<HotspotsSummaryResponse> {
  const p: Record<string, string> = {};
  if (params?.date_from) p.date_from = params.date_from;
  if (params?.date_to) p.date_to = params.date_to;
  if (params?.kabupaten_id) p.kabupaten_id = String(params.kabupaten_id);
  if (params?.min_confidence) p.min_confidence = params.min_confidence;
  return fetchJson<HotspotsSummaryResponse>("/hotspots/summary", p);
}

export async function getAirQualityLatest(params?: {
  near?: string;
  kabupaten_id?: number;
}): Promise<AirQualityLatestResponse> {
  const p: Record<string, string> = {};
  if (params?.near) p.near = params.near;
  if (params?.kabupaten_id) p.kabupaten_id = String(params.kabupaten_id);
  return fetchJson<AirQualityLatestResponse>("/air-quality/latest", p);
}

export async function getWeatherCurrent(params?: {
  near?: string;
  kabupaten_id?: number;
}): Promise<WeatherCurrentResponse> {
  const p: Record<string, string> = {};
  if (params?.near) p.near = params.near;
  if (params?.kabupaten_id) p.kabupaten_id = String(params.kabupaten_id);
  return fetchJson<WeatherCurrentResponse>("/weather/current", p);
}

export async function getWeatherForecast(params: {
  near: string;
  hours?: number;
}): Promise<WeatherForecastResponse> {
  return fetchJson<WeatherForecastResponse>("/weather/forecast", {
    near: params.near,
    hours: String(params.hours ?? 24),
  });
}

export async function getRiskCurrent(params?: {
  kabupaten_id?: number;
  model_version?: string;
}): Promise<RiskCurrentResponse> {
  const p: Record<string, string> = {};
  if (params?.kabupaten_id) p.kabupaten_id = String(params.kabupaten_id);
  if (params?.model_version) p.model_version = params.model_version;
  return fetchJson<RiskCurrentResponse>("/risk/current", p);
}

export async function getAdministrativeAreas(params?: {
  level?: string;
  simplify?: number;
}): Promise<AdminAreasResponse> {
  const p: Record<string, string> = {};
  if (params?.level) p.level = params.level;
  if (params?.simplify) p.simplify = String(params.simplify);
  return fetchJson<AdminAreasResponse>("/administrative-areas", p);
}

export async function lookupAdministrativeArea(
  lat: number,
  lon: number,
): Promise<AdminAreaLookupResponse> {
  return fetchJson<AdminAreaLookupResponse>("/administrative-areas/lookup", {
    lat: String(lat),
    lon: String(lon),
  });
}

export async function getAirQualityHistory(params: {
  station_id: number;
  pollutant: string;
  from?: string;
  to?: string;
}): Promise<AirQualityHistoryResponse> {
  const p: Record<string, string> = {
    station_id: String(params.station_id),
    pollutant: params.pollutant,
  };
  if (params.from) p.from = params.from;
  if (params.to) p.to = params.to;
  return fetchJson<AirQualityHistoryResponse>("/air-quality/history", p);
}

export async function getDataSources(): Promise<MetaDataSourcesResponse> {
  return fetchJson<MetaDataSourcesResponse>("/meta/data-sources");
}
