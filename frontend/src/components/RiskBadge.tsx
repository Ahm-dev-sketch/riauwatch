import type { RiskAssessment } from "@/lib/types";

interface RiskBadgeProps {
  assessment: RiskAssessment | null;
  compact?: boolean;
}

function getFireRiskColor(level: string | null): { text: string; bg: string; border: string } {
  const norm = (level || "").toUpperCase();
  switch (norm) {
    case "EKSTREM":
    case "EXTREME":
      return { text: "text-purple-800", bg: "bg-purple-100", border: "border-purple-300" };
    case "TINGGI":
    case "HIGH":
    case "VERY_HIGH":
      return { text: "text-rw-red-700", bg: "bg-rw-red-100", border: "border-rw-red-200" };
    case "SEDANG":
    case "MODERATE":
    case "MEDIUM":
      return { text: "text-rw-orange-700", bg: "bg-rw-orange-100", border: "border-rw-orange-200" };
    case "RENDAH":
    case "LOW":
    default:
      return { text: "text-rw-mangrove-800", bg: "bg-rw-mangrove-100", border: "border-rw-mangrove-200" };
  }
}

function getAirQualityColor(level: string | null): { text: string; bg: string; border: string } {
  const norm = (level || "").toUpperCase();
  switch (norm) {
    case "BERBAHAYA":
      return { text: "text-red-950", bg: "bg-red-200", border: "border-red-400" };
    case "SANGAT TIDAK SEHAT":
      return { text: "text-purple-800", bg: "bg-purple-100", border: "border-purple-300" };
    case "TIDAK SEHAT":
      return { text: "text-rw-red-700", bg: "bg-rw-red-100", border: "border-rw-red-200" };
    case "SEDANG":
      return { text: "text-amber-800", bg: "bg-amber-100", border: "border-amber-200" };
    case "BAIK":
    default:
      return { text: "text-rw-mangrove-800", bg: "bg-rw-mangrove-100", border: "border-rw-mangrove-200" };
  }
}

function normalizeScore(score: number | null): number | null {
  if (score === null || score === undefined) return null;
  const val = score > 1.0 ? score : score * 100;
  return Math.min(100, Math.max(0, Math.round(val)));
}

export function RiskBadge({ assessment, compact = false }: RiskBadgeProps) {
  if (!assessment) {
    return (
      <div
        className={`rw-instrument-panel rounded-lg border border-rw-smoke-200 ${
          compact ? "px-3 py-2" : "p-4"
        } bg-white`}
        style={{ borderLeftColor: "var(--rw-smoke-400)" }}
      >
        <div className="flex items-center gap-2 text-rw-smoke-500 text-xs">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          Risiko belum dihitung untuk area ini
        </div>
      </div>
    );
  }

  // Dual-index values
  const fireScore = normalizeScore(assessment.fire_hazard_index ?? assessment.score);
  const fireLevel = assessment.fire_risk_level || (fireScore && fireScore >= 75 ? "Ekstrem" : fireScore && fireScore >= 50 ? "Tinggi" : fireScore && fireScore >= 25 ? "Sedang" : "Rendah");
  const fireTheme = getFireRiskColor(fireLevel);

  const aqLevel = assessment.air_quality_level || "Sedang";
  const aqTheme = getAirQualityColor(aqLevel);
  const pm25Val = assessment.pm25_value ?? null;

  return (
    <div
      className={`rw-instrument-panel rounded-xl border border-rw-smoke-200 bg-white ${
        compact ? "p-3.5" : "p-4"
      } shadow-2xs hover:shadow-md transition-shadow`}
      style={{
        borderLeftColor: fireLevel === "Ekstrem" || fireLevel === "Tinggi" ? "var(--rw-red-600)" : "var(--rw-sienna-500)",
      }}
    >
      {/* Kabupaten Header */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="text-sm font-bold text-rw-peat-900 truncate">{assessment.area_name}</span>

        {/* Info Tooltip Icon */}
        <div className="group relative flex items-center">
          <button
            type="button"
            className="text-rw-smoke-400 hover:text-rw-smoke-600 focus-visible:outline-2 focus-visible:outline-rw-sienna-600 rounded"
            aria-label="Informasi dual-indeks risiko"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
          <div className="pointer-events-none absolute right-0 bottom-full mb-1.5 hidden w-56 rounded-lg bg-rw-peat-950 p-2 text-[10.5px] text-white shadow-lg group-hover:block z-20 leading-tight">
            Indeks udara merefleksikan paparan asap dan ISPU aktual, sedangkan indeks kebakaran mengukur konsentrasi titik api aktif di wilayah tersebut.
          </div>
        </div>
      </div>

      {/* Dual Badges (Fire Hazard + Air Quality Hazard) */}
      <div className="grid grid-cols-2 gap-2">
        {/* Fire Hazard Badge */}
        <div className={`flex flex-col rounded-lg px-2.5 py-1.5 border ${fireTheme.bg} ${fireTheme.border}`}>
          <div className="flex items-center gap-1 text-[10.5px] font-semibold text-rw-smoke-700">
            {/* Flame Icon */}
            <svg className="h-3 w-3 text-rw-red-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
            </svg>
            <span>Bahaya Api</span>
          </div>
          <div className="flex items-baseline justify-between gap-1 mt-0.5">
            <span className={`text-xs font-bold ${fireTheme.text}`}>{fireLevel}</span>
            {fireScore != null && (
              <span className="rw-readout text-[11px] font-semibold text-rw-smoke-600">{fireScore}%</span>
            )}
          </div>
        </div>

        {/* Air Quality Hazard Badge */}
        <div className={`flex flex-col rounded-lg px-2.5 py-1.5 border ${aqTheme.bg} ${aqTheme.border}`}>
          <div className="flex items-center gap-1 text-[10.5px] font-semibold text-rw-smoke-700">
            {/* Wind / Cloud Icon */}
            <svg className="h-3 w-3 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M17.5 19H9a7 7 0 116.71-9h1.79a4.5 4.5 0 110 9z" />
            </svg>
            <span>Paparan Udara</span>
          </div>
          <div className="flex items-baseline justify-between gap-1 mt-0.5">
            <span className={`text-xs font-bold truncate ${aqTheme.text}`}>{aqLevel}</span>
            {pm25Val != null && (
              <span className="rw-readout text-[10.5px] font-semibold text-rw-smoke-600">{Math.round(pm25Val)} µg</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
