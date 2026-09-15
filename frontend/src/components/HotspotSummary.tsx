import type { HotspotsSummaryResponse } from "@/lib/types";

interface HotspotSummaryProps {
  summary: HotspotsSummaryResponse | null;
  loading?: boolean;
}

export function HotspotSummary({ summary, loading }: HotspotSummaryProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-rw-gray-200 bg-white p-4 shadow-sm">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-rw-gray-100 rounded w-1/2" />
          <div className="h-3 bg-rw-gray-100 rounded w-3/4" />
          <div className="h-3 bg-rw-gray-100 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="rounded-xl border border-rw-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-rw-gray-900 mb-1">
        Ringkasan Titik Panas
      </h3>
      <p className="text-xs text-rw-gray-500 mb-3">
        Total: <span className="font-semibold text-rw-gray-800">{summary.total}</span> titik panas terdeteksi
      </p>

      {summary.items.length === 0 ? (
        <p className="text-sm text-rw-gray-500 italic">
          Tidak ada titik panas dalam rentang waktu yang dipilih.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[240px] overflow-y-auto rw-scrollbar">
          {summary.items.map((item) => (
            <div
              key={item.kabupaten_id}
              className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-rw-gray-50 transition-colors"
            >
              <span className="text-sm text-rw-gray-700 truncate">{item.kabupaten_name}</span>
              <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rw-amber-100 px-1.5 text-xs font-semibold text-rw-amber-600">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
