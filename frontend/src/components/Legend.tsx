"use client";

interface LegendProps {
  visibleLayers: {
    hotspots: boolean;
    boundaries: boolean;
  };
  onToggle: (layer: "hotspots" | "boundaries") => void;
}

export function Legend({ visibleLayers, onToggle }: LegendProps) {
  return (
    <div className="rounded-xl border border-rw-smoke-200 bg-white shadow-sm p-4">
      <h3 className="text-sm font-semibold text-rw-smoke-900 mb-3">Pilihan Lapisan Peta</h3>

      {/* Layer toggles */}
      <div className="space-y-2 mb-4">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={visibleLayers.hotspots}
            onChange={() => onToggle("hotspots")}
            className="h-4 w-4 rounded border-rw-smoke-300 text-rw-sienna-600 focus-visible:ring-2 focus-visible:ring-rw-sienna-600 focus-visible:ring-offset-2"
          />
          <span className="text-sm text-rw-smoke-700 group-hover:text-rw-smoke-900 font-medium">Titik Panas Satelit (NASA FIRMS)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={visibleLayers.boundaries}
            onChange={() => onToggle("boundaries")}
            className="h-4 w-4 rounded border-rw-smoke-300 text-rw-sienna-600 focus-visible:ring-2 focus-visible:ring-rw-sienna-600 focus-visible:ring-offset-2"
          />
          <span className="text-sm text-rw-smoke-700 group-hover:text-rw-smoke-900 font-medium">Batas Wilayah Kabupaten/Kota</span>
        </label>
      </div>

      {/* Hotspot color legend */}
      <div className="border-t border-rw-smoke-100 pt-3">
        <span className="text-xs text-rw-smoke-500 font-medium">Tingkat Kepercayaan Titik Panas</span>
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-rw-red-600 ring-1 ring-white" />
            <span className="text-xs text-rw-smoke-700">Tinggi / High (&ge;70%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-rw-haze-600 ring-1 ring-white" />
            <span className="text-xs text-rw-smoke-700">Sedang / Nominal (&ge;30%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-rw-mangrove-600 ring-1 ring-white" />
            <span className="text-xs text-rw-smoke-700">Rendah / Low (&lt;30%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-rw-mangrove-600 ring-2 ring-rw-mangrove-100" />
            <span className="text-xs text-rw-smoke-700">Klaster Titik Panas</span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-rw-smoke-500 leading-relaxed border-t border-rw-smoke-100 pt-2">
        Peta: &copy; OpenStreetMap contributors
      </p>
    </div>
  );
}
