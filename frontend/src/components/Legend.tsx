"use client";

export interface LayerState {
  hotspots: boolean;
  boundaries: boolean;
  khg: boolean;
  wind: boolean;
}

interface LegendProps {
  visibleLayers: LayerState;
  onToggle: (layer: keyof LayerState) => void;
}

export function Legend({ visibleLayers, onToggle }: LegendProps) {
  return (
    <div className="rounded-xl border border-rw-smoke-200 bg-white shadow-sm p-4 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-rw-peat-900 mb-2 flex items-center gap-2">
          <svg className="h-4 w-4 text-rw-sienna-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
          <span>Pilihan Lapisan Peta</span>
        </h3>

        {/* Layer toggles */}
        <div className="space-y-2">
          {/* Hotspots */}
          <label className="flex items-center gap-2.5 cursor-pointer group select-none">
            <input
              type="checkbox"
              aria-label="Tampilkan Lapisan Titik Panas Satelit"
              checked={visibleLayers.hotspots}
              onChange={() => onToggle("hotspots")}
              className="h-4 w-4 rounded border-rw-smoke-300 text-rw-sienna-600 focus-visible:ring-2 focus-visible:ring-rw-sienna-600 focus-visible:ring-offset-1"
            />
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <svg className="h-4 w-4 text-rw-red-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
              <span className="text-xs font-semibold text-rw-smoke-800 group-hover:text-rw-peat-900">
                Titik Panas Satelit (FIRMS)
              </span>
            </div>
          </label>

          {/* Boundaries */}
          <label className="flex items-center gap-2.5 cursor-pointer group select-none">
            <input
              type="checkbox"
              aria-label="Tampilkan Lapisan Batas 12 Kabupaten dan Kota"
              checked={visibleLayers.boundaries}
              onChange={() => onToggle("boundaries")}
              className="h-4 w-4 rounded border-rw-smoke-300 text-rw-sienna-600 focus-visible:ring-2 focus-visible:ring-rw-sienna-600 focus-visible:ring-offset-1"
            />
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <svg className="h-4 w-4 text-rw-sienna-700 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
              <span className="text-xs font-semibold text-rw-smoke-800 group-hover:text-rw-peat-900">
                Batas 12 Kabupaten/Kota
              </span>
            </div>
          </label>

          {/* KHG Peatland */}
          <label className="flex items-center gap-2.5 cursor-pointer group select-none">
            <input
              type="checkbox"
              aria-label="Tampilkan Lapisan Kawasan Hidrologis Gambut"
              checked={visibleLayers.khg}
              onChange={() => onToggle("khg")}
              className="h-4 w-4 rounded border-rw-smoke-300 text-rw-sienna-600 focus-visible:ring-2 focus-visible:ring-rw-sienna-600 focus-visible:ring-offset-1"
            />
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <svg className="h-4 w-4 text-amber-800 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              <span className="text-xs font-semibold text-rw-smoke-800 group-hover:text-rw-peat-900">
                Kawasan Hidrologis Gambut (KHG)
              </span>
            </div>
          </label>

          {/* Wind Vectors */}
          <label className="flex items-center gap-2.5 cursor-pointer group select-none">
            <input
              type="checkbox"
              aria-label="Tampilkan Lapisan Vektor Arah Angin Permukaan"
              checked={visibleLayers.wind}
              onChange={() => onToggle("wind")}
              className="h-4 w-4 rounded border-rw-smoke-300 text-rw-sienna-600 focus-visible:ring-2 focus-visible:ring-rw-sienna-600 focus-visible:ring-offset-1"
            />
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <svg className="h-4 w-4 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
              </svg>
              <span className="text-xs font-semibold text-rw-smoke-800 group-hover:text-rw-peat-900">
                Vektor Arah Angin Permukaan
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Hotspot color legend */}
      <div className="border-t border-rw-smoke-100 pt-3">
        <span className="text-xs font-bold text-rw-smoke-800 block mb-2">Simbol Kepercayaan Hotspot</span>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-slate-900 ring-1 ring-white flex-shrink-0" />
            <span className="text-xs text-rw-smoke-900 font-bold">Tinggi (High ≥70%) — Hitam</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-amber-500 ring-1 ring-white flex-shrink-0" />
            <span className="text-xs text-amber-900 font-medium">Sedang (Nominal 30–69%) — Oranye</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-green-600 ring-1 ring-white flex-shrink-0" />
            <span className="text-xs text-green-900 font-medium">Rendah (Low &lt;30%) — Hijau</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full bg-green-700 ring-2 ring-green-200 flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0">
              5+
            </span>
            <span className="text-xs text-rw-smoke-700">Kumpulan Titik Panas (5+)</span>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-rw-smoke-500 leading-relaxed border-t border-rw-smoke-100 pt-2">
        Peta: &copy; OpenStreetMap contributors
      </p>
    </div>
  );
}
