// TypeScript types mirroring the Phase 4 backend API contracts.
// Source of truth: backend/app/api/models.py

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export interface DomainStatus {
  last_observation_at: string | null;
  last_successful_run_at: string | null;
  degraded: boolean;
}

export interface StatusResponse {
  hotspots: DomainStatus;
  air_quality: DomainStatus;
  weather: DomainStatus;
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Hotspots (GeoJSON)
// ---------------------------------------------------------------------------

export interface HotspotProperties {
  satellite: string;
  instrument: string | null;
  confidence: string | null;
  confidence_value: number | null;
  daynight: string | null;
  acquired_at: string;
  area_name: string | null;
  hotspot_indication: boolean;
}

export interface HotspotFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: HotspotProperties;
}

export interface HotspotsResponse {
  type: "FeatureCollection";
  features: HotspotFeature[];
  disclaimer: string;
  count: number;
}

export interface HotspotSummaryItem {
  kabupaten_id: number;
  kabupaten_name: string;
  count: number;
}

export interface HotspotsSummaryResponse {
  items: HotspotSummaryItem[];
  total: number;
}

// ---------------------------------------------------------------------------
// Air Quality
// ---------------------------------------------------------------------------

export interface AQObservation {
  pollutant: string;
  value: number;
  unit: string;
  observed_at: string;
  age_seconds: number;
}

export interface AQStationLatest {
  station_id: number;
  station_name: string | null;
  external_id: string;
  distance_km: number | null;
  observations: AQObservation[];
  category: string | null;
}

export interface AirQualityLatestResponse {
  stations: AQStationLatest[];
}

export interface AQHistoryPoint {
  observed_at: string;
  value: number;
  unit: string;
}

export interface AirQualityHistoryResponse {
  station_id: number;
  pollutant: string;
  unit: string;
  points: AQHistoryPoint[];
}

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------

export interface WeatherObservation {
  valid_time: string;
  is_forecast: boolean;
  temperature_c: number | null;
  humidity_pct: number | null;
  precipitation_mm: number | null;
  wind_speed_kmh: number | null;
  wind_direction_deg: number | null;
  age_seconds: number | null;
}

export interface WeatherCurrentResponse {
  area_id: number;
  area_name: string;
  observation: WeatherObservation;
}

export interface WeatherForecastResponse {
  area_id: number;
  area_name: string;
  forecast: WeatherObservation[];
}

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------

export interface RiskAssessment {
  area_id: number;
  area_name: string;
  assessed_for: string;
  horizon: string;
  model_version: string;
  risk_level: string | null;
  score: number | null;
  factors: Record<string, unknown>;
}

export interface RiskCurrentResponse {
  assessments: RiskAssessment[];
  note: string | null;
}

// ---------------------------------------------------------------------------
// Administrative Areas (GeoJSON)
// ---------------------------------------------------------------------------

export interface AdminAreaProperties {
  id: number;
  name: string;
  level: string;
  kode_bps: string | null;
  parent_id: number | null;
}

export interface AdminAreaFeature {
  type: "Feature";
  geometry: { type: "MultiPolygon"; coordinates: number[][][][][] };
  properties: AdminAreaProperties;
}

export interface AdminAreasResponse {
  type: "FeatureCollection";
  features: AdminAreaFeature[];
}

export interface AdminAreaLookupResponse {
  id: number;
  name: string;
  level: string;
}

// ---------------------------------------------------------------------------
// Meta / Data Sources
// ---------------------------------------------------------------------------

export interface DataSourceInfo {
  key: string;
  name: string;
  provider_url: string;
  license_note: string;
  attribution: string;
  update_interval_seconds: number | null;
  active: boolean;
}

export interface MetaDataSourcesResponse {
  sources: DataSourceInfo[];
}
