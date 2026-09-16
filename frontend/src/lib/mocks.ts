// Realistic mock data for Riau province environmental monitoring.
// NEVER serves this data unless NEXT_PUBLIC_USE_MOCKS=true.
// All coordinates are real Riau locations. Timestamps simulate realistic freshness.

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
  HotspotFeature,
} from "./types";
import { fuseAndDeduplicateHotspots } from "./firms";

const NOW = new Date().toISOString();
const TWO_HOURS_AGO = new Date(Date.now() - 2 * 3600_000).toISOString();
const FOUR_HOURS_AGO = new Date(Date.now() - 4 * 3600_000).toISOString();
const SIX_HOURS_AGO = new Date(Date.now() - 6 * 3600_000).toISOString();
const ONE_DAY_AGO = new Date(Date.now() - 24 * 3600_000).toISOString();

export const mockStatus: StatusResponse = {
  generated_at: NOW,
  hotspots: {
    last_observation_at: TWO_HOURS_AGO,
    last_successful_run_at: TWO_HOURS_AGO,
    degraded: false,
  },
  air_quality: {
    last_observation_at: TWO_HOURS_AGO,
    last_successful_run_at: TWO_HOURS_AGO,
    degraded: false,
  },
  weather: {
    last_observation_at: TWO_HOURS_AGO,
    last_successful_run_at: TWO_HOURS_AGO,
    degraded: false,
  },
};

/**
 * Raw satellite detections from VIIRS and MODIS sensor streams.
 * Includes overlapping pairs (within 1 km and <= 3 hours) to demonstrate
 * the spatio-temporal deduplication and sensor fusion engine.
 */
export const mockRawHotspots: HotspotsResponse = {
  type: "FeatureCollection",
  disclaimer:
    "Hotspots are satellite heat indications and are NOT confirmed fires. Ground verification is required; absence of hotspots does not guarantee absence of fire.",
  count: 20,
  features: [
    // 1. Rokan Hilir — VIIRS detection
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [100.8051, 1.6814] },
      properties: {
        id: 1,
        satellite: "NOAA-20",
        instrument: "VIIRS",
        confidence: "nominal",
        confidence_value: 65,
        daynight: "D",
        frp: 14.2,
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Rokan Hilir",
        kabupaten_id: 1,
        hotspot_indication: true,
      },
    },
    // 2. Rokan Hilir — MODIS detection overlapping with item #1 (distance ~0.4 km, same window -> MERGED)
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [100.8080, 1.6830] },
      properties: {
        id: 2,
        satellite: "Terra",
        instrument: "MODIS",
        confidence: "nominal",
        confidence_value: 60,
        daynight: "D",
        frp: 18.5,
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Rokan Hilir",
        kabupaten_id: 1,
        hotspot_indication: true,
      },
    },
    // 3. Dumai — VIIRS detection (high confidence)
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [101.4500, 1.6200] },
      properties: {
        id: 3,
        satellite: "NOAA-20",
        instrument: "VIIRS",
        confidence: "high",
        confidence_value: 86,
        daynight: "D",
        frp: 28.4,
        acquired_at: FOUR_HOURS_AGO,
        area_name: "Kota Dumai",
        kabupaten_id: 2,
        hotspot_indication: true,
      },
    },
    // 4. Kampar — VIIRS detection
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [101.3900, 0.4200] },
      properties: {
        id: 4,
        satellite: "Suomi NPP",
        instrument: "VIIRS",
        confidence: "nominal",
        confidence_value: 55,
        daynight: "D",
        frp: 9.1,
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Kampar",
        kabupaten_id: 3,
        hotspot_indication: true,
      },
    },
    // 5. Kampar — MODIS detection overlapping with item #4
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [101.3850, 0.4180] },
      properties: {
        id: 5,
        satellite: "Aqua",
        instrument: "MODIS",
        confidence: "nominal",
        confidence_value: 52,
        daynight: "D",
        frp: 11.2,
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Kampar",
        kabupaten_id: 3,
        hotspot_indication: true,
      },
    },
    // 6. Pelalawan — VIIRS High (Peatland sector)
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [101.8700, -0.2050] },
      properties: {
        id: 6,
        satellite: "NOAA-20",
        instrument: "VIIRS",
        confidence: "high",
        confidence_value: 92,
        daynight: "D",
        frp: 45.8,
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Pelalawan",
        kabupaten_id: 4,
        hotspot_indication: true,
      },
    },
    // 7. Pelalawan — MODIS detection overlapping with item #6
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [101.8740, -0.2080] },
      properties: {
        id: 7,
        satellite: "Terra",
        instrument: "MODIS",
        confidence: "high",
        confidence_value: 84,
        daynight: "D",
        frp: 38.0,
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Pelalawan",
        kabupaten_id: 4,
        hotspot_indication: true,
      },
    },
    // 8. Pelalawan — Second cluster
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [102.4200, 0.3500] },
      properties: {
        id: 8,
        satellite: "Suomi NPP",
        instrument: "VIIRS",
        confidence: "nominal",
        confidence_value: 68,
        daynight: "D",
        frp: 21.0,
        acquired_at: SIX_HOURS_AGO,
        area_name: "Kab. Pelalawan",
        kabupaten_id: 4,
        hotspot_indication: true,
      },
    },
    // 9. Siak — Peatland cluster
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [101.8500, 0.8200] },
      properties: {
        id: 9,
        satellite: "NOAA-20",
        instrument: "VIIRS",
        confidence: "nominal",
        confidence_value: 58,
        daynight: "D",
        frp: 12.3,
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Siak",
        kabupaten_id: 5,
        hotspot_indication: true,
      },
    },
    // 10. Kuantan Singingi — High confidence
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [101.5200, -0.5800] },
      properties: {
        id: 10,
        satellite: "NOAA-20",
        instrument: "VIIRS",
        confidence: "high",
        confidence_value: 85,
        daynight: "D",
        frp: 34.2,
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Kuantan Singingi",
        kabupaten_id: 6,
        hotspot_indication: true,
      },
    },
    // 11. Indragiri Hulu — High cluster
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [102.3500, -0.4200] },
      properties: {
        id: 11,
        satellite: "Suomi NPP",
        instrument: "VIIRS",
        confidence: "high",
        confidence_value: 88,
        daynight: "D",
        frp: 41.5,
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Indragiri Hulu",
        kabupaten_id: 7,
        hotspot_indication: true,
      },
    },
    // 12. Indragiri Hilir — Heavy peatland fires
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [103.1200, -0.4500] },
      properties: {
        id: 12,
        satellite: "NOAA-20",
        instrument: "VIIRS",
        confidence: "high",
        confidence_value: 95,
        daynight: "D",
        frp: 62.4,
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Indragiri Hilir",
        kabupaten_id: 10,
        hotspot_indication: true,
      },
    },
    // 13. Indragiri Hilir — Overlapping MODIS
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [103.1240, -0.4520] },
      properties: {
        id: 13,
        satellite: "Aqua",
        instrument: "MODIS",
        confidence: "high",
        confidence_value: 85,
        daynight: "D",
        frp: 54.0,
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Indragiri Hilir",
        kabupaten_id: 10,
        hotspot_indication: true,
      },
    },
    // 14. Rokan Hulu
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [100.3200, 0.8500] },
      properties: {
        id: 14,
        satellite: "Suomi NPP",
        instrument: "VIIRS",
        confidence: "nominal",
        confidence_value: 60,
        daynight: "D",
        frp: 14.0,
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Rokan Hulu",
        kabupaten_id: 8,
        hotspot_indication: true,
      },
    },
    // 15. Bengkalis (Duri / Mandau)
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [101.2200, 1.2800] },
      properties: {
        id: 15,
        satellite: "NOAA-20",
        instrument: "VIIRS",
        confidence: "nominal",
        confidence_value: 64,
        daynight: "D",
        frp: 16.8,
        acquired_at: ONE_DAY_AGO,
        area_name: "Kab. Bengkalis",
        kabupaten_id: 9,
        hotspot_indication: true,
      },
    },
    // 16. Pekanbaru — Isolated thermal observation
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [101.4478, 0.5071] },
      properties: {
        id: 16,
        satellite: "NOAA-20",
        instrument: "VIIRS",
        confidence: "nominal",
        confidence_value: 52,
        daynight: "D",
        frp: 7.2,
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kota Pekanbaru",
        kabupaten_id: 11,
        hotspot_indication: true,
      },
    },
  ],
};

// Process initial fusion
const initialFusion = fuseAndDeduplicateHotspots(mockRawHotspots.features);

export const mockHotspots: HotspotsResponse = {
  type: "FeatureCollection",
  disclaimer:
    "Hotspots are satellite heat indications and are NOT confirmed fires. Ground verification is required; absence of hotspots does not guarantee absence of fire.",
  count: initialFusion.fusedFeatures.length,
  total_raw_count: initialFusion.totalRawDetections,
  active_clusters_count: initialFusion.activeClustersCount,
  features: initialFusion.fusedFeatures,
};

export const mockHotspotsSummary: HotspotsSummaryResponse = {
  total: initialFusion.activeClustersCount,
  total_raw: initialFusion.totalRawDetections,
  items: Object.entries(initialFusion.clusterCountsByKabupaten).map(([name, count], idx) => ({
    kabupaten_id: idx + 1,
    kabupaten_name: name,
    count,
    raw_count: initialFusion.rawCountsByKabupaten[name] || count,
  })),
};

// ---------------------------------------------------------------------------
// Air Quality — Official Riau SPKUA Stations
// ---------------------------------------------------------------------------

export const mockAirQuality: AirQualityLatestResponse = {
  stations: [
    {
      station_id: 1,
      station_name: "Stasiun Pekanbaru - Tampan",
      external_id: "spkua-pku-01",
      distance_km: 0.6,
      observations: [
        {
          pollutant: "pm25",
          value: 45.5,
          unit: "µg/m³",
          observed_at: TWO_HOURS_AGO,
          age_seconds: 7200,
        },
        {
          pollutant: "pm10",
          value: 62.1,
          unit: "µg/m³",
          observed_at: TWO_HOURS_AGO,
          age_seconds: 7200,
        },
      ],
      category: "Sedang",
    },
    {
      station_id: 2,
      station_name: "Stasiun Pekanbaru - Sukajadi",
      external_id: "spkua-pku-02",
      distance_km: 4.2,
      observations: [
        {
          pollutant: "pm25",
          value: 48.2,
          unit: "µg/m³",
          observed_at: TWO_HOURS_AGO,
          age_seconds: 7200,
        },
        {
          pollutant: "pm10",
          value: 66.4,
          unit: "µg/m³",
          observed_at: TWO_HOURS_AGO,
          age_seconds: 7200,
        },
      ],
      category: "Sedang",
    },
    {
      station_id: 3,
      station_name: "Stasiun Dumai - Pelintung",
      external_id: "spkua-dum-01",
      distance_km: 120.3,
      observations: [
        {
          pollutant: "pm25",
          value: 32.0,
          unit: "µg/m³",
          observed_at: TWO_HOURS_AGO,
          age_seconds: 7200,
        },
        {
          pollutant: "pm10",
          value: 48.0,
          unit: "µg/m³",
          observed_at: TWO_HOURS_AGO,
          age_seconds: 7200,
        },
      ],
      category: "Sedang",
    },
    {
      station_id: 4,
      station_name: "Stasiun Duri / Mandau - Bengkalis",
      external_id: "spkua-bks-01",
      distance_km: 95.8,
      observations: [
        {
          pollutant: "pm25",
          value: 58.0,
          unit: "µg/m³",
          observed_at: TWO_HOURS_AGO,
          age_seconds: 7200,
        },
        {
          pollutant: "pm10",
          value: 78.5,
          unit: "µg/m³",
          observed_at: TWO_HOURS_AGO,
          age_seconds: 7200,
        },
      ],
      category: "Tidak Sehat",
    },
    {
      station_id: 5,
      station_name: "Stasiun Siak Sri Indrapura",
      external_id: "spkua-siak-01",
      distance_km: 68.4,
      observations: [
        {
          pollutant: "pm25",
          value: 28.4,
          unit: "µg/m³",
          observed_at: TWO_HOURS_AGO,
          age_seconds: 7200,
        },
        {
          pollutant: "pm10",
          value: 41.2,
          unit: "µg/m³",
          observed_at: TWO_HOURS_AGO,
          age_seconds: 7200,
        },
      ],
      category: "Sedang",
    },
    {
      station_id: 6,
      station_name: "Stasiun Kampar - Bangkinang",
      external_id: "spkua-kmp-01",
      distance_km: 54.1,
      observations: [
        {
          pollutant: "pm25",
          value: 24.1,
          unit: "µg/m³",
          observed_at: TWO_HOURS_AGO,
          age_seconds: 7200,
        },
        {
          pollutant: "pm10",
          value: 36.8,
          unit: "µg/m³",
          observed_at: TWO_HOURS_AGO,
          age_seconds: 7200,
        },
      ],
      category: "Sedang",
    },
    {
      station_id: 7,
      station_name: "Stasiun Pelalawan - Pangkalan Kerinci",
      external_id: "spkua-plw-01",
      distance_km: 72.0,
      observations: [
        {
          pollutant: "pm25",
          value: 68.9,
          unit: "µg/m³",
          observed_at: TWO_HOURS_AGO,
          age_seconds: 7200,
        },
        {
          pollutant: "pm10",
          value: 92.4,
          unit: "µg/m³",
          observed_at: TWO_HOURS_AGO,
          age_seconds: 7200,
        },
      ],
      category: "Tidak Sehat",
    },
    {
      station_id: 8,
      station_name: "Stasiun Rokan Hilir - Bagan Siapi-api",
      external_id: "spkua-rohil-01",
      distance_km: 145.0,
      observations: [
        {
          pollutant: "pm25",
          value: 48.0,
          unit: "µg/m³",
          observed_at: TWO_HOURS_AGO,
          age_seconds: 7200,
        },
        {
          pollutant: "pm10",
          value: 63.5,
          unit: "µg/m³",
          observed_at: TWO_HOURS_AGO,
          age_seconds: 7200,
        },
      ],
      category: "Sedang",
    },
    {
      station_id: 9,
      station_name: "Stasiun Indragiri Hulu - Rengat",
      external_id: "spkua-inhu-01",
      distance_km: 130.2,
      observations: [
        {
          pollutant: "pm25",
          value: 52.0,
          unit: "µg/m³",
          observed_at: TWO_HOURS_AGO,
          age_seconds: 7200,
        },
        {
          pollutant: "pm10",
          value: 71.2,
          unit: "µg/m³",
          observed_at: TWO_HOURS_AGO,
          age_seconds: 7200,
        },
      ],
      category: "Sedang",
    },
  ],
};

// ---------------------------------------------------------------------------
// Weather — Current & Forecast with Cloud Cover & Wind Vectors
// ---------------------------------------------------------------------------

export const mockWeather: WeatherCurrentResponse = {
  area_id: 11,
  area_name: "Kota Pekanbaru",
  observation: {
    valid_time: TWO_HOURS_AGO,
    is_forecast: false,
    temperature_c: 32.0,
    humidity_pct: 58.0,
    precipitation_mm: 0.0,
    wind_speed_kmh: 12.5,
    wind_direction_deg: 165, // Dari Tenggara/Selatan
    cloud_cover_pct: 35.0,
    soil_moisture_m3: 0.13,
    age_seconds: 7200,
  },
};

function generateForecast(hours: number): WeatherForecastResponse["forecast"] {
  const now = Date.now();
  const forecast: WeatherForecastResponse["forecast"] = [];
  for (let i = 1; i <= hours; i++) {
    const t = new Date(now + i * 3600_000);
    const hourOfDay = t.getHours();
    const tempBase = 28 + Math.sin(((hourOfDay - 6) * Math.PI) / 12) * 4;
    const humidity = 75 - Math.sin(((hourOfDay - 6) * Math.PI) / 12) * 15;
    const precipChance = hourOfDay >= 14 && hourOfDay <= 17 ? 0.3 : 0.05;
    const precip = Math.random() < precipChance ? Math.round(Math.random() * 6 * 10) / 10 : 0;
    const clouds = Math.round((30 + Math.sin(i * 0.5) * 20) * 10) / 10;

    forecast.push({
      valid_time: t.toISOString(),
      is_forecast: true,
      temperature_c: Math.round(tempBase * 10) / 10,
      humidity_pct: Math.round(humidity * 10) / 10,
      precipitation_mm: precip,
      wind_speed_kmh: Math.round((8 + Math.random() * 8) * 10) / 10,
      wind_direction_deg: 160 + Math.round(Math.random() * 20 - 10),
      cloud_cover_pct: clouds,
      soil_moisture_m3: 0.14,
      age_seconds: null,
    });
  }
  return forecast;
}

export const mockWeatherForecast: WeatherForecastResponse = {
  area_id: 11,
  area_name: "Kota Pekanbaru",
  forecast: generateForecast(24),
};

// ---------------------------------------------------------------------------
// Modul 2: Arsitektur Dual-Index Risiko per Kabupaten (12 Wilayah Riau)
// Memisahkan Potensi Kebakaran (Fire Hazard) dan Paparan Kualitas Udara (Air Quality Hazard)
// ---------------------------------------------------------------------------

export const mockRisk: RiskCurrentResponse = {
  assessments: [
    {
      area_id: 11,
      area_name: "Kota Pekanbaru",
      assessed_for: TWO_HOURS_AGO,
      horizon: "48h",
      model_version: "rules-v0.1",
      risk_level: "LOW",
      score: 18.0,
      fire_hazard_index: 18.0,
      fire_risk_level: "Rendah",
      air_quality_hazard_index: 68.0,
      air_quality_level: "Tidak Sehat",
      pm25_value: 45.5,
      cloud_cover_pct: 35.0,
      factors: {
        hotspot_density_48h: 0.0,
        rainfall_7d: 31.8,
        humidity_24h: 69.9,
        temperature_24h_max: 33.7,
        wind_24h_mean: 8.5,
        fuel_index: 0.13,
      },
    },
    {
      area_id: 2,
      area_name: "Kota Dumai",
      assessed_for: TWO_HOURS_AGO,
      horizon: "48h",
      model_version: "rules-v0.1",
      risk_level: "MEDIUM",
      score: 28.0,
      fire_hazard_index: 28.0,
      fire_risk_level: "Sedang",
      air_quality_hazard_index: 55.0,
      air_quality_level: "Sedang",
      pm25_value: 32.0,
      cloud_cover_pct: 40.0,
      factors: {
        hotspot_density_48h: 0.01,
        rainfall_7d: 46.6,
        humidity_24h: 73.2,
        temperature_24h_max: 33.3,
        wind_24h_mean: 7.8,
        fuel_index: 0.27,
      },
    },
    {
      area_id: 4,
      area_name: "Kab. Pelalawan",
      assessed_for: TWO_HOURS_AGO,
      horizon: "48h",
      model_version: "rules-v0.1",
      risk_level: "HIGH",
      score: 82.0,
      fire_hazard_index: 82.0,
      fire_risk_level: "Tinggi",
      air_quality_hazard_index: 78.0,
      air_quality_level: "Tidak Sehat",
      pm25_value: 68.9,
      cloud_cover_pct: 20.0,
      factors: {
        hotspot_density_48h: 0.08,
        rainfall_7d: 14.2,
        humidity_24h: 58.0,
        temperature_24h_max: 34.8,
        wind_24h_mean: 14.0,
        fuel_index: 0.11,
      },
    },
    {
      area_id: 10,
      area_name: "Kab. Indragiri Hilir",
      assessed_for: TWO_HOURS_AGO,
      horizon: "48h",
      model_version: "rules-v0.1",
      risk_level: "HIGH",
      score: 88.0,
      fire_hazard_index: 88.0,
      fire_risk_level: "Ekstrem",
      air_quality_hazard_index: 75.0,
      air_quality_level: "Tidak Sehat",
      pm25_value: 65.0,
      cloud_cover_pct: 25.0,
      factors: {
        hotspot_density_48h: 0.12,
        rainfall_7d: 11.5,
        humidity_24h: 56.4,
        temperature_24h_max: 35.0,
        wind_24h_mean: 15.8,
        fuel_index: 0.10,
      },
    },
    {
      area_id: 7,
      area_name: "Kab. Indragiri Hulu",
      assessed_for: TWO_HOURS_AGO,
      horizon: "48h",
      model_version: "rules-v0.1",
      risk_level: "HIGH",
      score: 76.0,
      fire_hazard_index: 76.0,
      fire_risk_level: "Tinggi",
      air_quality_hazard_index: 62.0,
      air_quality_level: "Tidak Sehat",
      pm25_value: 52.0,
      cloud_cover_pct: 30.0,
      factors: {
        hotspot_density_48h: 0.06,
        rainfall_7d: 18.0,
        humidity_24h: 62.0,
        temperature_24h_max: 34.2,
        wind_24h_mean: 13.6,
        fuel_index: 0.14,
      },
    },
    {
      area_id: 9,
      area_name: "Kab. Bengkalis",
      assessed_for: TWO_HOURS_AGO,
      horizon: "48h",
      model_version: "rules-v0.1",
      risk_level: "MEDIUM",
      score: 42.0,
      fire_hazard_index: 42.0,
      fire_risk_level: "Sedang",
      air_quality_hazard_index: 72.0,
      air_quality_level: "Tidak Sehat",
      pm25_value: 58.0,
      cloud_cover_pct: 45.0,
      factors: {
        hotspot_density_48h: 0.02,
        rainfall_7d: 28.5,
        humidity_24h: 68.0,
        temperature_24h_max: 33.6,
        wind_24h_mean: 16.0,
        fuel_index: 0.22,
      },
    },
    {
      area_id: 5,
      area_name: "Kab. Siak",
      assessed_for: TWO_HOURS_AGO,
      horizon: "48h",
      model_version: "rules-v0.1",
      risk_level: "LOW",
      score: 22.0,
      fire_hazard_index: 22.0,
      fire_risk_level: "Rendah",
      air_quality_hazard_index: 40.0,
      air_quality_level: "Sedang",
      pm25_value: 28.4,
      cloud_cover_pct: 50.0,
      factors: {
        hotspot_density_48h: 0.01,
        rainfall_7d: 47.3,
        humidity_24h: 74.5,
        temperature_24h_max: 33.1,
        wind_24h_mean: 7.6,
        fuel_index: 0.35,
      },
    },
    {
      area_id: 3,
      area_name: "Kab. Kampar",
      assessed_for: TWO_HOURS_AGO,
      horizon: "48h",
      model_version: "rules-v0.1",
      risk_level: "LOW",
      score: 25.0,
      fire_hazard_index: 25.0,
      fire_risk_level: "Sedang",
      air_quality_hazard_index: 35.0,
      air_quality_level: "Sedang",
      pm25_value: 24.1,
      cloud_cover_pct: 30.0,
      factors: {
        hotspot_density_48h: 0.01,
        rainfall_7d: 47.1,
        humidity_24h: 69.7,
        temperature_24h_max: 31.9,
        wind_24h_mean: 9.2,
        fuel_index: 0.26,
      },
    },
    {
      area_id: 1,
      area_name: "Kab. Rokan Hilir",
      assessed_for: TWO_HOURS_AGO,
      horizon: "48h",
      model_version: "rules-v0.1",
      risk_level: "MEDIUM",
      score: 54.0,
      fire_hazard_index: 54.0,
      fire_risk_level: "Tinggi",
      air_quality_hazard_index: 58.0,
      air_quality_level: "Tidak Sehat",
      pm25_value: 48.0,
      cloud_cover_pct: 35.0,
      factors: {
        hotspot_density_48h: 0.03,
        rainfall_7d: 26.0,
        humidity_24h: 64.0,
        temperature_24h_max: 34.0,
        wind_24h_mean: 13.0,
        fuel_index: 0.18,
      },
    },
    {
      area_id: 8,
      area_name: "Kab. Rokan Hulu",
      assessed_for: TWO_HOURS_AGO,
      horizon: "48h",
      model_version: "rules-v0.1",
      risk_level: "LOW",
      score: 28.0,
      fire_hazard_index: 28.0,
      fire_risk_level: "Sedang",
      air_quality_hazard_index: 30.0,
      air_quality_level: "Baik",
      pm25_value: 18.0,
      cloud_cover_pct: 40.0,
      factors: {
        hotspot_density_48h: 0.01,
        rainfall_7d: 48.2,
        humidity_24h: 74.5,
        temperature_24h_max: 32.7,
        wind_24h_mean: 7.1,
        fuel_index: 0.40,
      },
    },
    {
      area_id: 6,
      area_name: "Kab. Kuantan Singingi",
      assessed_for: TWO_HOURS_AGO,
      horizon: "48h",
      model_version: "rules-v0.1",
      risk_level: "MEDIUM",
      score: 65.0,
      fire_hazard_index: 65.0,
      fire_risk_level: "Tinggi",
      air_quality_hazard_index: 50.0,
      air_quality_level: "Sedang",
      pm25_value: 36.0,
      cloud_cover_pct: 28.0,
      factors: {
        hotspot_density_48h: 0.04,
        rainfall_7d: 21.0,
        humidity_24h: 66.0,
        temperature_24h_max: 33.8,
        wind_24h_mean: 11.2,
        fuel_index: 0.20,
      },
    },
    {
      area_id: 12,
      area_name: "Kab. Kepulauan Meranti",
      assessed_for: TWO_HOURS_AGO,
      horizon: "48h",
      model_version: "rules-v0.1",
      risk_level: "LOW",
      score: 15.0,
      fire_hazard_index: 15.0,
      fire_risk_level: "Rendah",
      air_quality_hazard_index: 25.0,
      air_quality_level: "Sedang",
      pm25_value: 20.0,
      cloud_cover_pct: 55.0,
      factors: {
        hotspot_density_48h: 0.0,
        rainfall_7d: 48.6,
        humidity_24h: 77.0,
        temperature_24h_max: 33.0,
        wind_24h_mean: 8.2,
        fuel_index: 0.38,
      },
    },
  ],
  note: null,
};

// ---------------------------------------------------------------------------
// Air Quality History
// ---------------------------------------------------------------------------

const STATION_BASE_PM25: Record<number, number> = {
  1: 45.5, // Pekanbaru Tampan
  2: 48.2, // Pekanbaru Sukajadi
  3: 32.0, // Dumai Pelintung
  4: 58.0, // Duri / Mandau
  5: 28.4, // Siak Sri Indrapura
  6: 24.1, // Kampar Bangkinang
  7: 68.9, // Pelalawan
  8: 48.0, // Rokan Hilir
  9: 52.0, // Indragiri Hulu
};

export function getMockAirQualityHistory(
  stationId: number,
  pollutant: string = "pm25",
  hours: number = 24,
): AirQualityHistoryResponse {
  const now = Date.now();
  const base = STATION_BASE_PM25[stationId] ?? 35.0;
  const multiplier = pollutant === "pm10" ? 1.35 : 1.0;
  const points: { observed_at: string; value: number; unit: string }[] = [];

  for (let i = 0; i < hours; i++) {
    const t = new Date(now - (hours - 1 - i) * 3600_000);
    const hourOfDay = t.getHours();
    const diurnal = Math.sin(((hourOfDay - 6) * Math.PI) / 12) * 6;
    const jitter = Math.sin((i + stationId) * 0.9) * 4;
    const val = Math.max(5, (base + diurnal + jitter) * multiplier);

    points.push({
      observed_at: t.toISOString(),
      value: Math.round(val * 10) / 10,
      unit: "µg/m³",
    });
  }

  return {
    station_id: stationId,
    pollutant,
    unit: "µg/m³",
    points,
  };
}

export const mockAirQualityHistory: AirQualityHistoryResponse = getMockAirQualityHistory(1, "pm25", 24);

// ---------------------------------------------------------------------------
// Administrative Areas
// ---------------------------------------------------------------------------

const RIUA_KABUPATEN: Array<{ id: number; name: string; bbox: number[][] }> = [
  { id: 1, name: "Kab. Rokan Hilir", bbox: [[100.3, 1.4], [101.4, 2.6]] },
  { id: 2, name: "Kota Dumai", bbox: [[101.2, 1.5], [101.6, 1.8]] },
  { id: 3, name: "Kab. Kampar", bbox: [[100.5, -0.2], [101.6, 0.9]] },
  { id: 4, name: "Kab. Pelalawan", bbox: [[101.5, -0.4], [103.0, 0.7]] },
  { id: 5, name: "Kab. Siak", bbox: [[101.3, 0.5], [102.5, 1.4]] },
  { id: 6, name: "Kab. Kuantan Singingi", bbox: [[101.0, -1.0], [101.9, -0.1]] },
  { id: 7, name: "Kab. Indragiri Hulu", bbox: [[101.8, -0.9], [102.8, -0.1]] },
  { id: 8, name: "Kab. Rokan Hulu", bbox: [[99.9, 0.3], [101.0, 1.6]] },
  { id: 9, name: "Kab. Bengkalis", bbox: [[101.1, 1.0], [102.4, 1.95]] },
  { id: 10, name: "Kab. Indragiri Hilir", bbox: [[102.4, -1.1], [103.8, 0.1]] },
  { id: 11, name: "Kota Pekanbaru", bbox: [[101.35, 0.45], [101.55, 0.65]] },
  { id: 12, name: "Kab. Kepulauan Meranti", bbox: [[102.4, 0.6], [103.5, 1.5]] },
];

function bboxToMultiPolygon(bbox: number[][]): { type: "MultiPolygon"; coordinates: number[][][][] } {
  const [[west, south], [east, north]] = bbox;
  return {
    type: "MultiPolygon",
    coordinates: [[[[west, south], [east, south], [east, north], [west, north], [west, south]]]],
  };
}

export const mockAdminAreas: AdminAreasResponse = {
  type: "FeatureCollection",
  features: RIUA_KABUPATEN.map((k) => ({
    type: "Feature" as const,
    geometry: bboxToMultiPolygon(k.bbox),
    properties: {
      id: k.id,
      name: k.name,
      level: "kabupaten_kota",
      kode_bps: null,
      parent_id: null,
    },
  })),
};

function findArea(lat: number, lon: number): AdminAreaLookupResponse | null {
  for (const k of RIUA_KABUPATEN) {
    const [[west, south], [east, north]] = k.bbox;
    if (lat >= south && lat <= north && lon >= west && lon <= east) {
      return { id: k.id, name: k.name, level: "kabupaten_kota" };
    }
  }
  return { id: 11, name: "Kota Pekanbaru", level: "kabupaten_kota" };
}

export const mockAdminLookup: AdminAreaLookupResponse = findArea(0.53, 101.44)!;

// ---------------------------------------------------------------------------
// Param-aware mock filtering with FIRMS Fusion
// ---------------------------------------------------------------------------

const MOCK_CONF_RANK: Record<string, number> = {
  low: 0,
  l: 0,
  nominal: 1,
  n: 1,
  high: 2,
  h: 2,
};

function mockConfRank(value: string | null): number {
  if (!value) return -1;
  return MOCK_CONF_RANK[value] ?? 1;
}

export function filterMockHotspots(params: Record<string, string>): HotspotsResponse {
  let features: HotspotFeature[] = mockRawHotspots.features;

  if (params.kabupaten_id) {
    const id = Number(params.kabupaten_id);
    const targetName = RIUA_KABUPATEN.find((k) => k.id === id)?.name;
    features = targetName ? features.filter((f) => f.properties.area_name?.includes(targetName) || targetName.includes(f.properties.area_name || "")) : [];
  }
  if (params.min_confidence) {
    const min = mockConfRank(params.min_confidence);
    features = features.filter((f) => mockConfRank(f.properties.confidence) >= min);
  }
  if (params.date_from) {
    features = features.filter((f) => (f.properties.acquired_at ?? "") >= params.date_from);
  }
  if (params.date_to) {
    const end = params.date_to.length <= 10 ? `${params.date_to}T23:59:59.999Z` : params.date_to;
    features = features.filter((f) => (f.properties.acquired_at ?? "") <= end);
  }

  // Deduplicate and fuse
  const fusion = fuseAndDeduplicateHotspots(features);

  return {
    type: "FeatureCollection",
    disclaimer:
      "Hotspots are satellite heat indications and are NOT confirmed fires. Ground verification is required; absence of hotspots does not guarantee absence of fire.",
    count: fusion.fusedFeatures.length,
    total_raw_count: fusion.totalRawDetections,
    active_clusters_count: fusion.activeClustersCount,
    features: fusion.fusedFeatures,
  };
}

export function summarizeMockHotspots(params: Record<string, string>): HotspotsSummaryResponse {
  const filtered = filterMockHotspots(params);
  const fusion = fuseAndDeduplicateHotspots(filtered.features);

  const items = Object.entries(fusion.clusterCountsByKabupaten).map(([name, count], idx) => ({
    kabupaten_id: idx + 1,
    kabupaten_name: name,
    count,
    raw_count: fusion.rawCountsByKabupaten[name] || count,
  }));

  return {
    total: fusion.activeClustersCount,
    total_raw: fusion.totalRawDetections,
    items,
  };
}

// ---------------------------------------------------------------------------
// Meta Data Sources
// ---------------------------------------------------------------------------

export const mockDataSources: MetaDataSourcesResponse = {
  sources: [
    {
      key: "firms_viirs_nrt",
      name: "NASA FIRMS VIIRS NRT",
      provider_url: "https://firms.modaps.eosdis.nasa.gov/api/area/",
      license_note: "NASA open data; attribution requested",
      attribution: "Fire detections courtesy of NASA FIRMS (LANCE/EOSDIS)",
      update_interval_seconds: 7200,
      active: true,
    },
    {
      key: "firms_modis_nrt",
      name: "NASA FIRMS MODIS NRT",
      provider_url: "https://firms.modaps.eosdis.nasa.gov/api/area/",
      license_note: "NASA open data; attribution requested",
      attribution: "Fire detections courtesy of NASA FIRMS (LANCE/EOSDIS)",
      update_interval_seconds: 7200,
      active: true,
    },
    {
      key: "geoboundaries",
      name: "geoBoundaries Administrative Boundaries",
      provider_url: "https://www.geoboundaries.org/",
      license_note: "CC-BY 4.0",
      attribution: "geoBoundaries (Runfola et al., 2020)",
      update_interval_seconds: null,
      active: true,
    },
    {
      key: "open_meteo",
      name: "Open-Meteo Weather API",
      provider_url: "https://api.open-meteo.com/v1/forecast",
      license_note: "Free for non-commercial use with attribution",
      attribution: "Weather data by Open-Meteo.com",
      update_interval_seconds: 7200,
      active: true,
    },
    {
      key: "openaq_v3",
      name: "OpenAQ v3 Air Quality API",
      provider_url: "https://api.openaq.org/v3/",
      license_note: "Open data; attribution to OpenAQ and originating monitor network required",
      attribution: "Air quality data via OpenAQ",
      update_interval_seconds: 7200,
      active: true,
    },
  ],
};
