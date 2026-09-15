"use client";

import { useCallback, useRef, useState } from "react";
import type { HotspotsResponse } from "@/lib/types";

// ---------------------------------------------------------------------------
// HotspotList — keyboard-accessible list view of hotspot features.
// Serves three purposes:
//   1. Full a11y fallback when map is mouse-only / screen-reader context
//   2. Basemap failure fallback (tiles don't load, list still works)
//   3. Synced selection with the map via onHighlight callback
// ---------------------------------------------------------------------------

type HotspotFeature = HotspotsResponse["features"][0];

interface HotspotListProps {
  hotspots: HotspotsResponse | null;
  /** Called when user highlights an item (keyboard or click). Map should fly-to + popup. */
  onHighlight?: (feature: HotspotFeature, index: number) => void;
  /** Index of the currently highlighted feature (synced from map). */
  highlightedIndex?: number | null;
  /** When true, displays the tile-failure fallback notice above the list. */
  tileError?: boolean;
  /** Called when the user clicks "Coba Lagi" after a tile error. */
  onRetryTiles?: () => void;
  /** Total count (may differ from features.length when filtered). */
  totalCount?: number;
}

function formatAcquiredAt(acquiredAt: string | null): string {
  if (!acquiredAt) return "-";
  return new Date(acquiredAt).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function confidenceColor(confidence: string | null): string {
  switch (confidence) {
    case "high":
      return "bg-rw-red-100 text-rw-red-600";
    case "nominal":
      return "bg-rw-amber-100 text-rw-amber-600";
    default:
      return "bg-rw-green-100 text-rw-green-700";
  }
}

function confidenceLabel(confidence: string | null): string {
  switch (confidence) {
    case "high":
      return "High";
    case "nominal":
      return "Nominal";
    default:
      return "Low";
  }
}

export function HotspotList({
  hotspots,
  onHighlight,
  highlightedIndex = null,
  tileError = false,
  onRetryTiles,
  totalCount,
}: HotspotListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const [expanded, setExpanded] = useState(true);

  const features = hotspots?.features ?? [];
  const displayCount = totalCount ?? features.length;

  const handleItemClick = useCallback(
    (feature: HotspotFeature, index: number) => {
      onHighlight?.(feature, index);
    },
    [onHighlight],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, feature: HotspotFeature, index: number) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleItemClick(feature, index);
      }
      // Arrow key navigation within the list
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = listRef.current?.querySelectorAll("[role='option']");
        if (!items?.length) return;
        const currentIndex = Array.from(items).indexOf(e.target as Element);
        let nextIndex: number;
        if (e.key === "ArrowDown") {
          nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        }
        (items[nextIndex] as HTMLElement).focus();
      }
    },
    [handleItemClick],
  );

  return (
    <div
      className="rounded-xl border border-rw-gray-200 bg-white shadow-sm"
      role="region"
      aria-label="Daftar Titik Panas"
      data-testid="hotspot-list"
    >
      {/* Tile failure notice */}
      {tileError && (
        <div
          className="flex items-start gap-3 border-b border-rw-amber-200 bg-rw-amber-100/60 px-4 py-3"
          role="alert"
          data-testid="tile-error-notice"
        >
          <svg
            className="h-5 w-5 flex-shrink-0 text-rw-amber-600 mt-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-rw-gray-800">
              Peta dasar tidak dapat dimuat. Data tetap tersedia di daftar.
            </p>
            {onRetryTiles && (
              <button
                type="button"
                onClick={onRetryTiles}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-rw-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-rw-green-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rw-green-600 transition-colors"
                data-testid="retry-tiles-btn"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M1 4v6h6M23 20v-6h-6" />
                  <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
                </svg>
                Coba Lagi
              </button>
            )}
          </div>
        </div>
      )}

      {/* List header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-rw-gray-100">
        <h3 className="text-sm font-semibold text-rw-gray-900">
          Daftar Titik Panas
          <span className="ml-1.5 text-xs font-normal text-rw-gray-500">
            ({displayCount} titik)
          </span>
        </h3>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-rw-green-700 hover:text-rw-green-600 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rw-green-600"
          aria-expanded={expanded}
          aria-controls="hotspot-list-items"
        >
          {expanded ? "Tutup" : "Buka"}
        </button>
      </div>

      {/* List items */}
      {expanded && (
        <ul
          ref={listRef}
          id="hotspot-list-items"
          role="listbox"
          aria-label="Titik panas tersedia"
          className="max-h-[360px] overflow-y-auto rw-scrollbar divide-y divide-rw-gray-50"
          data-testid="hotspot-list-items"
        >
          {features.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-rw-gray-500 italic">
              Tidak ada titik panas dalam rentang filter saat ini.
            </li>
          ) : (
            features.map((feature, index) => {
              const coords = feature.geometry.coordinates;
                  const props = feature.properties as unknown as Record<string, unknown>;
              const isHighlighted = highlightedIndex === index;

              return (
                <li
                  key={index}
                  role="option"
                  aria-selected={isHighlighted}
                  tabIndex={0}
                  data-testid={`hotspot-item-${index}`}
                  data-hotspot-index={index}
                  className={`group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    isHighlighted
                      ? "bg-rw-green-50 ring-1 ring-inset ring-rw-green-600"
                      : "hover:bg-rw-gray-50"
                  }`}
                  onClick={() => handleItemClick(feature, index)}
                  onKeyDown={(e) => handleKeyDown(e, feature, index)}
                >
                  {/* Confidence indicator */}
                  <div className={`mt-0.5 flex-shrink-0 rounded-full p-1 ${confidenceColor(props.confidence as string | null)}`}>
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <circle cx="12" cy="12" r="6" />
                    </svg>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-rw-gray-900 truncate">
                        {(props.area_name as string) || "Lokasi tidak diketahui"}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${confidenceColor(props.confidence as string | null)}`}>
                        {confidenceLabel(props.confidence as string | null)}
                        {props.confidence_value != null && (
                          <span className="ml-0.5 opacity-75">({String(props.confidence_value)}%)</span>
                        )}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-rw-gray-500">
                      <span className="font-mono">{coords[1].toFixed(4)}, {coords[0].toFixed(4)}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={props.acquired_at as string}>
                        {formatAcquiredAt(props.acquired_at as string | null)}
                      </time>
                      <span aria-hidden="true">·</span>
                      <span>{(props.satellite as string) || "-"}</span>
                    </div>
                  </div>

                  {/* "Tampilkan di peta" action */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleItemClick(feature, index);
                    }}
                    className="flex-shrink-0 mt-0.5 rounded-md border border-rw-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-rw-green-700 hover:bg-rw-green-50 hover:border-rw-green-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rw-green-600 transition-colors opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                    aria-label={`Tampilkan di peta: ${(props.area_name as string) || "lokasi ini"}`}
                    data-testid={`show-on-map-${index}`}
                    tabIndex={-1}
                  >
                    <svg className="inline-block h-3 w-3 mr-0.5 -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                    </svg>
                    Tampilkan di peta
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
