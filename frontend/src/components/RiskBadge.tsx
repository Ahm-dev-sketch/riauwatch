import type { RiskAssessment } from "@/lib/types";

// Status is ALWAYS text + icon + color, never color alone.
// Risk level: HIGH / MEDIUM / LOW / null (not yet computed)

interface RiskBadgeProps {
  assessment: RiskAssessment | null;
  compact?: boolean;
}

function getRiskVisual(level: string | null) {
  const norm = (level || "").toUpperCase();
  switch (norm) {
    case "EXTREME":
    case "VERY_HIGH":
    case "VERY HIGH":
      return {
        label: "Risiko Sangat Tinggi",
        color: "text-purple-700",
        bgColor: "bg-purple-100",
        borderColor: "#7e22ce",
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
      };
    case "HIGH":
      return {
        label: "Risiko Tinggi",
        color: "text-rw-red-600",
        bgColor: "bg-rw-red-100",
        borderColor: "var(--rw-red-600)",
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
      };
    case "MODERATE":
    case "MEDIUM":
      return {
        label: "Risiko Sedang",
        color: "text-rw-orange-600",
        bgColor: "bg-rw-orange-100",
        borderColor: "var(--rw-orange-600)",
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        ),
      };
    case "LOW":
      return {
        label: "Risiko Rendah",
        color: "text-rw-mangrove-700",
        bgColor: "bg-rw-mangrove-100",
        borderColor: "var(--rw-mangrove-600)",
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ),
      };
    default:
      return {
        label: "Data Belum Cukup",
        color: "text-rw-smoke-600",
        bgColor: "bg-rw-smoke-100",
        borderColor: "var(--rw-smoke-400)",
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        ),
      };
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
      <div className={`rw-instrument-panel rounded-lg border border-rw-smoke-200 ${compact ? "px-3 py-2" : "p-4"} bg-white`} style={{ borderLeftColor: "var(--rw-smoke-400)" }}>
        <div className="flex items-center gap-2 text-rw-smoke-500 text-sm">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          Risiko belum dihitung untuk area ini
        </div>
      </div>
    );
  }

  const visual = getRiskVisual(assessment.risk_level);

  return (
    <div className={`rw-instrument-panel rounded-lg border border-rw-smoke-200 ${compact ? "px-3 py-2" : "p-4"} bg-white`} style={{ borderLeftColor: visual.borderColor }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`rounded-full p-1 ${visual.bgColor} ${visual.color}`}>
            {visual.icon}
          </div>
          <div>
            <span className="text-sm font-semibold text-rw-smoke-900">{assessment.area_name}</span>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${visual.bgColor} ${visual.color}`}>
          {visual.icon}
          {visual.label}
        </div>
      </div>

      {assessment.score != null && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-rw-smoke-100">
            <div
              className={`h-full rounded-full transition-all ${
                visual.color.includes("red")
                  ? "bg-rw-red-600"
                  : visual.color.includes("purple")
                    ? "bg-purple-600"
                    : visual.color.includes("orange")
                      ? "bg-rw-orange-600"
                      : "bg-rw-mangrove-600"
              }`}
              style={{ width: `${normalizeScore(assessment.score)}%` }}
              role="progressbar"
              aria-valuenow={normalizeScore(assessment.score)!}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Skor risiko: ${normalizeScore(assessment.score)}%`}
            />
          </div>
          <span className="rw-readout text-xs font-medium text-rw-smoke-700">{normalizeScore(assessment.score)}%</span>
        </div>
      )}
    </div>
  );
}
