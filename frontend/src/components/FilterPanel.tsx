"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { AdminAreasResponse } from "@/lib/types";

export interface FilterState {
  dateFrom: string;
  dateTo: string;
  kabupatenId: string;
  minConfidence: string;
}

interface FilterPanelProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  adminAreas?: AdminAreasResponse | null;
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

export function FilterPanel({ filters, onChange, adminAreas }: FilterPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [kabupatenSearch, setKabupatenSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeOptions = useMemo(() => {
    if (adminAreas && adminAreas.features && adminAreas.features.length > 0) {
      const items = adminAreas.features
        .filter((f) => f.properties.level === "kabupaten_kota")
        .map((f) => ({
          value: String(f.properties.id),
          label: f.properties.name,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
      return [{ value: "", label: "Semua Kabupaten/Kota" }, ...items];
    }
    return KABUPATEN_OPTIONS;
  }, [adminAreas]);

  const update = (key: keyof FilterState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const reset = () => {
    setKabupatenSearch("");
    setDropdownOpen(false);
    onChange({
      dateFrom: "",
      dateTo: "",
      kabupatenId: "",
      minConfidence: "",
    });
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Auto-focus search input when opened
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  const filteredKabupaten = useMemo(() => {
    if (!kabupatenSearch.trim()) return activeOptions;
    const query = kabupatenSearch.toLowerCase();
    return activeOptions.filter(
      (opt) => opt.value === "" || opt.label.toLowerCase().includes(query)
    );
  }, [kabupatenSearch, activeOptions]);

  const hasFilters = filters.dateFrom || filters.dateTo || filters.kabupatenId || filters.minConfidence;
  const selectedKabupaten = activeOptions.find((k) => k.value === filters.kabupatenId) ?? activeOptions[0];

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

          {/* Searchable Kabupaten Dropdown (Combobox) */}
          <div className="relative" ref={dropdownRef}>
            <div className="flex items-center justify-between mb-1">
              <label id="kabupaten-label" className="block text-xs font-medium text-rw-smoke-600">
                Kabupaten/Kota
              </label>
              {filters.kabupatenId && (
                <button
                  type="button"
                  onClick={() => update("kabupatenId", "")}
                  className="text-[11px] text-rw-sienna-600 hover:text-rw-sienna-800 font-medium"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Hidden native select for test & screen-reader sync */}
            <select
              id="kabupaten"
              value={filters.kabupatenId}
              onChange={(e) => update("kabupatenId", e.target.value)}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            >
              {activeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Interactive Dropdown Trigger */}
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center justify-between rounded-lg border border-rw-smoke-200 bg-white px-3 py-2 text-sm text-rw-smoke-900 focus:border-rw-sienna-600 focus-visible:ring-2 focus-visible:ring-rw-sienna-600 focus-visible:ring-offset-1 outline-none text-left shadow-2xs hover:bg-rw-smoke-50 transition-colors"
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              aria-labelledby="kabupaten-label"
            >
              <span className={`truncate ${filters.kabupatenId ? "font-semibold text-rw-peat-900" : "text-rw-smoke-700"}`}>
                {selectedKabupaten.label}
              </span>
              <svg
                className={`h-4 w-4 text-rw-smoke-400 transition-transform flex-shrink-0 ml-2 ${dropdownOpen ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Searchable Dropdown Popup Menu */}
            {dropdownOpen && (
              <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-rw-smoke-200 bg-white shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                {/* Search input directly inside dropdown */}
                <div className="p-2 border-b border-rw-smoke-100 bg-rw-smoke-50/70">
                  <div className="relative">
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Cari (Pekanbaru, Dumai, dll)..."
                      value={kabupatenSearch}
                      onChange={(e) => setKabupatenSearch(e.target.value)}
                      className="w-full rounded-lg border border-rw-smoke-200 pl-8 pr-7 py-1.5 text-xs text-rw-smoke-900 bg-white placeholder:text-rw-smoke-400 focus:border-rw-sienna-600 focus-visible:ring-2 focus-visible:ring-rw-sienna-600 outline-none"
                    />
                    <svg
                      className="absolute left-2.5 top-2 h-3.5 w-3.5 text-rw-smoke-400"
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
                        className="absolute right-2 top-2 text-rw-smoke-400 hover:text-rw-smoke-700"
                        aria-label="Hapus pencarian"
                      >
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Option list */}
                <div className="max-h-56 overflow-y-auto py-1" role="listbox">
                  {filteredKabupaten.length > 0 ? (
                    filteredKabupaten.map((opt) => {
                      const isSelected = filters.kabupatenId === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            update("kabupatenId", opt.value);
                            setDropdownOpen(false);
                            setKabupatenSearch("");
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                            isSelected
                              ? "bg-rw-sienna-50 text-rw-sienna-900 font-semibold"
                              : "text-rw-smoke-800 hover:bg-rw-smoke-50"
                          }`}
                        >
                          <span>{opt.label}</span>
                          {isSelected && (
                            <svg className="h-3.5 w-3.5 text-rw-sienna-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3 py-4 text-center text-xs text-rw-smoke-500">
                      Tidak ada kabupaten/kota yang cocok dengan &quot;{kabupatenSearch}&quot;
                    </div>
                  )}
                </div>
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
