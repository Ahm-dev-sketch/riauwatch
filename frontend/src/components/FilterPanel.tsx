"use client";

import { useState } from "react";

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

const KABUPATEN_OPTIONS = [
  { value: "", label: "Semua Kabupaten/Kota" },
  { value: "1", label: "Kab. Rokan Hilir" },
  { value: "2", label: "Kota Dumai" },
  { value: "3", label: "Kab. Kampar" },
  { value: "4", label: "Kab. Pelalawan" },
  { value: "5", label: "Kab. Siak" },
  { value: "6", label: "Kab. Kuantan Singingi" },
  { value: "7", label: "Kab. Indragiri Hulu" },
  { value: "8", label: "Kab. Rokan Hulu" },
  { value: "9", label: "Kab. Bengkalis" },
  { value: "10", label: "Kab. Indragiri Hilir" },
  { value: "11", label: "Kab. Rokan Hilir" },
  { value: "12", label: "Kab. Meranti" },
  { value: "13", label: "Kab. Kepulauan Meranti" },
  { value: "14", label: "Kab. Siak" },
] as const;

const CONFIDENCE_OPTIONS = [
  { value: "", label: "Semua Confidence" },
  { value: "h", label: "High (≥70%)" },
  { value: "n", label: "Nominal (≥30%)" },
  { value: "l", label: "Low (<30%)" },
] as const;

export function FilterPanel({ filters, onChange }: FilterPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const update = (key: keyof FilterState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const reset = () => {
    onChange({
      dateFrom: "",
      dateTo: "",
      kabupatenId: "",
      minConfidence: "",
    });
  };

  const hasFilters = filters.dateFrom || filters.dateTo || filters.kabupatenId || filters.minConfidence;

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

          {/* Kabupaten */}
          <div>
            <label htmlFor="kabupaten" className="block text-xs font-medium text-rw-smoke-600 mb-1">
              Kabupaten/Kota
            </label>
            <select
              id="kabupaten"
              value={filters.kabupatenId}
              onChange={(e) => update("kabupatenId", e.target.value)}
              className="w-full rounded-lg border border-rw-smoke-200 px-2.5 py-1.5 text-sm text-rw-smoke-800 focus:border-rw-sienna-600 focus-visible:ring-2 focus-visible:ring-rw-sienna-600 focus-visible:ring-offset-1 outline-none"
            >
              {KABUPATEN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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
