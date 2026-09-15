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
    <div className="rounded-xl border border-rw-gray-200 bg-white shadow-sm p-4">
      <h3 className="text-sm font-semibold text-rw-gray-900 mb-3">Legenda & Layer</h3>

      {/* Layer toggles */}
      <div className="space-y-2 mb-4">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={visibleLayers.hotspots}
            onChange={() => onToggle("hotspots")}
            className="h-4 w-4 rounded border-rw-gray-300 text-rw-green-600 focus:ring-rw-green-600"
          />
          <span className="text-sm text-rw-gray-700 group-hover:text-rw-gray-900">Titik Panas</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={visibleLayers.boundaries}
            onChange={() => onToggle("boundaries")}
            className="h-4 w-4 rounded border-rw-gray-300 text-rw-green-600 focus:ring-rw-green-600"
          />
          <span className="text-sm text-rw-gray-700 group-hover:text-rw-gray-900">Batas Wilayah</span>
        </label>
      </div>

      {/* Placeholder layers (data not yet available) */}
      <div className="border-t border-rw-gray-100 pt-3 mb-3">
        <span className="text-xs text-rw-gray-500 font-medium">Segera Hadir</span>
        <div className="mt-2 space-y-2 opacity-50">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded border border-dashed border-rw-gray-300 bg-rw-gray-50" />
            <span className="text-sm text-rw-gray-500">Kualitas Udara</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded border border-dashed border-rw-gray-300 bg-rw-gray-50" />
            <span className="text-sm text-rw-gray-500">Cuaca</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded border border-dashed border-rw-gray-300 bg-rw-gray-50" />
            <span className="text-sm text-rw-gray-500">Risiko Kebakaran</span>
          </div>
        </div>
      </div>

      {/* Hotspot color legend */}
      <div className="border-t border-rw-gray-100 pt-3">
        <span className="text-xs text-rw-gray-500 font-medium">Confidence Titik Panas</span>
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-rw-red-600 ring-1 ring-white" />
            <span className="text-xs text-rw-gray-700">High (&ge;70%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-rw-amber-600 ring-1 ring-white" />
            <span className="text-xs text-rw-gray-700">Nominal (&ge;30%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-rw-green-600 ring-1 ring-white" />
            <span className="text-xs text-rw-gray-700">Low (&lt;30%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-rw-green-600 ring-2 ring-rw-green-200" />
            <span className="text-xs text-rw-gray-700">Cluster</span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-rw-gray-500 leading-relaxed">
        Peta: OpenFreeMap &copy; OpenMapTiles &middot; Data: &copy; OpenStreetMap
      </p>
    </div>
  );
}
