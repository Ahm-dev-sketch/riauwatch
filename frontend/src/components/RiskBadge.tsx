import type { RiskAssessment } from "@/lib/types";

// Status is ALWAYS text + icon + color, never color alone.
// Risk level: HIGH / MEDIUM / LOW / null (not yet computed)

interface RiskBadgeProps {
  assessment: RiskAssessment | null;
  compact?: boolean;
}

function getRiskVisual(level: string | null) {
  switch (level) {
    case "HIGH":
      return {
        label: "Risiko Tinggi",
        color: "text-rw-red-600",
        bgColor: "bg-rw-red-100",
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
      };
    case "MEDIUM":
      return {
        label: "Risiko Sedang",
        color: "text-rw-orange-600",
        bgColor: "bg-rw-orange-100",
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
        color: "text-rw-green-700",
        bgColor: "bg-rw-green-100",
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ),
      };
    default:
      return {
        label: "Belum Dihitung",
        color: "text-rw-gray-600",
        bgColor: "bg-rw-gray-100",
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        ),
      };
  }
}

export function RiskBadge({ assessment, compact = false }: RiskBadgeProps) {
  if (!assessment) {
    return (
      <div className={`rounded-lg border border-rw-gray-200 ${compact ? "px-3 py-2" : "p-4"} bg-white`}>
        <div className="flex items-center gap-2 text-rw-gray-500 text-sm">
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
    <div className={`rounded-lg border border-rw-gray-200 ${compact ? "px-3 py-2" : "p-4"} bg-white`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`rounded-full p-1 ${visual.bgColor} ${visual.color}`}>
            {visual.icon}
          </div>
          <div>
            <span className="text-sm font-semibold text-rw-gray-900">{assessment.area_name}</span>
            {!compact && (
              <span className="text-xs text-rw-gray-500 ml-2">Model: {assessment.model_version}</span>
            )}
          </div>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${visual.bgColor} ${visual.color}`}>
          {visual.icon}
          {visual.label}
        </div>
      </div>

      {assessment.score != null && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-rw-gray-100">
            <div
              className={`h-full rounded-full transition-all ${
                assessment.risk_level === "HIGH"
                  ? "bg-rw-red-600"
                  : assessment.risk_level === "MEDIUM"
                    ? "bg-rw-orange-600"
                    : "bg-rw-green-600"
              }`}
              style={{ width: `${Math.round(assessment.score * 100)}%` }}
              role="progressbar"
              aria-valuenow={Math.round(assessment.score * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Skor risiko: ${Math.round(assessment.score * 100)}%`}
            />
          </div>
          <span className="text-xs font-mono text-rw-gray-700">{Math.round(assessment.score * 100)}%</span>
        </div>
      )}
    </div>
  );
}
