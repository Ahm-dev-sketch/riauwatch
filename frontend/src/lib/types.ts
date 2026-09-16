// TypeScript types mirroring the RIAUWATCH API contracts & WebGIS domain models.
// Source of truth: backend/app/api/models.py & WebGIS extensions

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
// Hotspots & Unified FIRMS Detections (MODIS + VIIRS)
// ---------------------------------------------------------------------------

export type SensorType = "VIIRS" | "MODIS" | "MERGED";
export type ConfidenceCategory = "high" | "nominal" | "low";

export interface HotspotProperties {
  id?: number | string | null;
  satellite: string;
  instrument: string | null;
  confidence: string | null;
  confidence_value: number | null;
  confidence_category?: ConfidenceCategory;
  daynight: string | null;
  frp?: number | null;
  acquired_at: string;
  area_name: string | null;
  kabupaten_id?: number | null;
  hotspot_indication: boolean;
  sensor?: SensorType;
  raw_detections_count?: number;
  in_peatland?: boolean;
}

export interface HotspotFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] }; // [lon, lat]
  properties: HotspotProperties;
}

export interface HotspotsResponse {
  type: "FeatureCollection";
  features: HotspotFeature[];
  disclaimer: string;
  count: number;
  total_raw_count?: number;
  active_clusters_count?: number;
}

export interface HotspotSummaryItem {
  kabupaten_id: number;
  kabupaten_name: string;
  count: number;
  raw_count?: number;
}

export interface HotspotsSummaryResponse {
  items: HotspotSummaryItem[];
  total: number;
  total_raw?: number;
}

// ---------------------------------------------------------------------------
// Air Quality & Health Advisory
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
// Weather & Wind Vector
// ---------------------------------------------------------------------------

export interface WeatherObservation {
  valid_time: string;
  is_forecast: boolean;
  temperature_c: number | null;
  humidity_pct: number | null;
  precipitation_mm: number | null;
  wind_speed_kmh: number | null;
  wind_direction_deg: number | null;
  cloud_cover_pct?: number | null;
  soil_moisture_m3?: number | null;
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

export interface WindPoint {
  lat: number;
  lon: number;
  name: string;
  speed_kmh: number;
  direction_deg: number;
}

// ---------------------------------------------------------------------------
// Dual-Index Risk Models
// ---------------------------------------------------------------------------

export interface RiskAssessment {
  area_id: number;
  area_name: string;
  assessed_for: string;
  horizon: string;
  model_version: string;
  risk_level: string | null;
  score: number | null;
  fire_hazard_index?: number | null;
  fire_risk_level?: string | null; // "Rendah" | "Sedang" | "Tinggi" | "Ekstrem"
  air_quality_hazard_index?: number | null;
  air_quality_level?: string | null; // "Baik" | "Sedang" | "Tidak Sehat" | "Sangat Tidak Sehat" | "Berbahaya"
  pm25_value?: number | null;
  cloud_cover_pct?: number | null;
  factors: Record<string, unknown>;
}

export interface RiskCurrentResponse {
  assessments: RiskAssessment[];
  note: string | null;
}

// ---------------------------------------------------------------------------
// Administrative Areas (GeoJSON) & KHG
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
  geometry: { type: "MultiPolygon"; coordinates: number[][][][] };
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
