"use client";

import { useState, useMemo } from "react";

export interface FilterState {
  dateFrom: string;
  dateTo: string;
  kabupatenId: string;
  minConfidence: string;
}

interface FilterPanelProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export const KABUPATEN_OPTIONS = [
  { value: "", label: "Semua Kabupaten/Kota" },
  { value: "11", label: "Kota Pekanbaru" },
  { value: "2", label: "Kota Dumai" },
  { value: "9", label: "Kab. Bengkalis" },
  { value: "10", label: "Kab. Indragiri Hilir" },
  { value: "7", label: "Kab. Indragiri Hulu" },
  { value: "3", label: "Kab. Kampar" },
  { value: "12", label: "Kab. Kepulauan Meranti" },
  { value: "6", label: "Kab. Kuantan Singingi" },
  { value: "4", label: "Kab. Pelalawan" },
  { value: "1", label: "Kab. Rokan Hilir" },
  { value: "8", label: "Kab. Rokan Hulu" },
  { value: "5", label: "Kab. Siak" },
] as const;

const CONFIDENCE_OPTIONS = [
  { value: "", label: "Semua Confidence" },
  { value: "h", label: "High (≥70%)" },
  { value: "n", label: "Nominal (≥30%)" },
  { value: "l", label: "Low (<30%)" },
] as const;

export function FilterPanel({ filters, onChange }: FilterPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [kabupatenSearch, setKabupatenSearch] = useState("");

  const update = (key: keyof FilterState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const reset = () => {
    setKabupatenSearch("");
    onChange({
      dateFrom: "",
      dateTo: "",
      kabupatenId: "",
      minConfidence: "",
    });
  };

  const filteredKabupaten = useMemo(() => {
    if (!kabupatenSearch.trim()) return KABUPATEN_OPTIONS;
    const query = kabupatenSearch.toLowerCase();
    return KABUPATEN_OPTIONS.filter(
      (opt) => opt.value === "" || opt.label.toLowerCase().includes(query)
    );
  }, [kabupatenSearch]);

  const hasFilters = filters.dateFrom || filters.dateTo || filters.kabupatenId || filters.minConfidence;
  const selectedKabupaten = KABUPATEN_OPTIONS.find((k) => k.value === filters.kabupatenId);

  return (
    <div className="rounded-xl border border-rw-smoke-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-rw-smoke-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span className="text-sm font-semibold text-rw-smoke-900">Filter</span>
          {hasFilters && (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rw-sienna-600 text-[10px] font-bold text-white">
              !
            </span>
          )}
        </div>
        <svg
          className={`h-4 w-4 text-rw-smoke-500 transition-transform ${expanded ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-rw-smoke-100 px-4 pb-4 pt-3 space-y-3">
          {/* Date range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="dateFrom" className="block text-xs font-medium text-rw-smoke-600 mb-1">
                Dari
              </label>
              <input
                id="dateFrom"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => update("dateFrom", e.target.value)}
                className="w-full rounded-lg border border-rw-smoke-200 px-2.5 py-1.5 text-sm text-rw-smoke-800 focus:border-rw-sienna-600 focus-visible:ring-2 focus-visible:ring-rw-sienna-600 focus-visible:ring-offset-1 outline-none"
              />
            </div>
            <div>
              <label htmlFor="dateTo" className="block text-xs font-medium text-rw-smoke-600 mb-1">
                Sampai
              </label>
              <input
                id="dateTo"
                type="date"
                value={filters.dateTo}
                onChange={(e) => update("dateTo", e.target.value)}
                className="w-full rounded-lg border border-rw-smoke-200 px-2.5 py-1.5 text-sm text-rw-smoke-800 focus:border-rw-sienna-600 focus-visible:ring-2 focus-visible:ring-rw-sienna-600 focus-visible:ring-offset-1 outline-none"
              />
            </div>
          </div>

          {/* Kabupaten with search */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="kabupaten" className="block text-xs font-medium text-rw-smoke-600">
                Kabupaten/Kota ({KABUPATEN_OPTIONS.length - 1} wilayah)
              </label>
              {filters.kabupatenId && (
                <button
                  type="button"
                  onClick={() => update("kabupatenId", "")}
                  className="text-[11px] text-rw-sienna-600 hover:text-rw-sienna-800 font-medium"
                >
                  Reset wilayah
                </button>
              )}
            </div>

            {/* Quick Search Input */}
            <div className="relative mb-1.5">
              <input
                type="text"
                placeholder="Cari (misal: Pekanbaru, Dumai)..."
                value={kabupatenSearch}
                onChange={(e) => setKabupatenSearch(e.target.value)}
                className="w-full rounded-lg border border-rw-smoke-200 pl-7 pr-7 py-1 text-xs text-rw-smoke-800 placeholder:text-rw-smoke-400 focus:border-rw-sienna-600 focus-visible:ring-2 focus-visible:ring-rw-sienna-600 outline-none"
                aria-label="Cari Kabupaten atau Kota"
              />
              <svg
                className="absolute left-2 top-1.5 h-3.5 w-3.5 text-rw-smoke-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {kabupatenSearch && (
                <button
                  type="button"
                  onClick={() => setKabupatenSearch("")}
                  className="absolute right-2 top-1.5 text-xs text-rw-smoke-400 hover:text-rw-smoke-600"
                  aria-label="Hapus pencarian"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              id="kabupaten"
              value={filters.kabupatenId}
              onChange={(e) => update("kabupatenId", e.target.value)}
              className="w-full rounded-lg border border-rw-smoke-200 px-2.5 py-1.5 text-sm text-rw-smoke-800 focus:border-rw-sienna-600 focus-visible:ring-2 focus-visible:ring-rw-sienna-600 focus-visible:ring-offset-1 outline-none"
            >
              {filteredKabupaten.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {filters.kabupatenId && (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-rw-smoke-600">
                <span className="font-medium">Terpilih:</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-rw-sienna-50 text-rw-sienna-700 font-medium">
                  {selectedKabupaten?.label}
                </span>
              </div>
            )}
          </div>

          {/* Confidence */}
          <div>
            <label htmlFor="confidence" className="block text-xs font-medium text-rw-smoke-600 mb-1">
              Confidence Minimum
            </label>
            <select
              id="confidence"
              value={filters.minConfidence}
              onChange={(e) => update("minConfidence", e.target.value)}
              className="w-full rounded-lg border border-rw-smoke-200 px-2.5 py-1.5 text-sm text-rw-smoke-800 focus:border-rw-sienna-600 focus-visible:ring-2 focus-visible:ring-rw-sienna-600 focus-visible:ring-offset-1 outline-none"
            >
              {CONFIDENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={reset}
              className="w-full rounded-lg border border-rw-smoke-200 px-3 py-1.5 text-xs font-medium text-rw-smoke-600 hover:bg-rw-smoke-50 transition-colors"
            >
              Hapus Semua Filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}
