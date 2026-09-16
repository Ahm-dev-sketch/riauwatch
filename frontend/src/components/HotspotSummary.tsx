import { useMemo } from "react";
import type { HotspotsSummaryResponse } from "@/lib/types";

const ALL_12_KABUPATEN = [
  { id: 11, name: "Kota Pekanbaru" },
  { id: 2, name: "Kota Dumai" },
  { id: 9, name: "Kab. Bengkalis" },
  { id: 10, name: "Kab. Indragiri Hilir" },
  { id: 7, name: "Kab. Indragiri Hulu" },
  { id: 3, name: "Kab. Kampar" },
  { id: 12, name: "Kab. Kepulauan Meranti" },
  { id: 6, name: "Kab. Kuantan Singingi" },
  { id: 4, name: "Kab. Pelalawan" },
  { id: 1, name: "Kab. Rokan Hilir" },
  { id: 8, name: "Kab. Rokan Hulu" },
  { id: 5, name: "Kab. Siak" },
];

interface HotspotSummaryProps {
  summary: HotspotsSummaryResponse | null;
  loading?: boolean;
}

export function HotspotSummary({ summary, loading }: HotspotSummaryProps) {
  const clusterCount = summary?.total ?? 0;

  // Gabungkan seluruh 12 Kabupaten/Kota agar terpantau transparan
  const allKabupatenItems = useMemo(() => {
    if (!summary) return [];

    const countMap = new Map<string, number>();
    for (const item of summary.items) {
      countMap.set(item.kabupaten_name, item.count);
    }

    const merged = ALL_12_KABUPATEN.map((k) => {
      // Cari nama yang cocok
      let foundCount = countMap.get(k.name);
      if (foundCount === undefined) {
        for (const [name, count] of countMap.entries()) {
          if (name.includes(k.name) || k.name.includes(name)) {
            foundCount = count;
            break;
          }
        }
      }
      return {
        kabupaten_id: k.id,
        kabupaten_name: k.name,
        count: foundCount ?? 0,
      };
    });

    // Urutkan dari jumlah titik tertinggi, lalu wilayah dengan 0 titik
    return merged.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.kabupaten_name.localeCompare(b.kabupaten_name);
    });
  }, [summary]);

  if (loading) {
    return (
      <div className="rounded-xl border border-rw-smoke-200 bg-white p-4 shadow-sm">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-rw-smoke-100 rounded w-1/2" />
          <div className="h-3 bg-rw-smoke-100 rounded w-3/4" />
          <div className="h-3 bg-rw-smoke-100 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div
      className="rw-instrument-panel rounded-xl border border-rw-smoke-200 bg-white p-4 shadow-sm"
      style={{ borderLeftColor: "var(--rw-haze-500)" }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="text-sm font-bold text-rw-peat-900 flex items-center gap-1.5">
          <svg className="h-4 w-4 text-rw-sienna-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
          </svg>
          <span>Titik Panas Terdeteksi</span>
        </h3>
        <span className="rw-readout text-sm font-bold text-rw-peat-900 bg-rw-smoke-100 px-2.5 py-0.5 rounded border border-rw-smoke-200">
          {clusterCount} Titik
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-rw-smoke-500 mb-3 mt-1.5 border-b border-rw-smoke-100 pb-2">
        <svg className="h-3.5 w-3.5 text-rw-smoke-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span className="leading-tight">
          Pantauan 12 Kabupaten/Kota (24 Jam Terakhir)
        </span>
      </div>

      <div className="space-y-1.5 max-h-[260px] overflow-y-auto rw-scrollbar">
        {allKabupatenItems.map((item) => (
          <div
            key={item.kabupaten_id}
            className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-colors text-xs ${
              item.count > 0 ? "bg-rw-smoke-50/80 hover:bg-rw-smoke-100" : "bg-white hover:bg-rw-smoke-50/50 opacity-80"
            }`}
          >
            <span className={`truncate ${item.count > 0 ? "font-medium text-rw-smoke-900" : "text-rw-smoke-600"}`}>
              {item.kabupaten_name}
            </span>
            <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
              {item.count > 0 ? (
                <span className="rw-readout inline-flex items-center justify-center rounded-full bg-green-700 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-2xs">
                  {item.count} titik
                </span>
              ) : (
                <span className="inline-flex items-center justify-center rounded-full bg-rw-smoke-100 px-2 py-0.5 text-[10px] font-medium text-rw-smoke-500 border border-rw-smoke-200">
                  0 titik &middot; Aman
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
