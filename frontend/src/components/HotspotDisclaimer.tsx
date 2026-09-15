"use client";

/**
 * Map legend guide & permanent disclaimer — explains map symbols, color tiers, and trust notices clearly.
 */
export function HotspotDisclaimer() {
  return (
    <div className="space-y-3">
      {/* Visual Map Symbols Guide */}
      <div className="rounded-xl border border-rw-smoke-200 bg-white p-4 shadow-2xs">
        <h4 className="text-xs font-bold uppercase tracking-wider text-rw-peat-900 mb-3 flex items-center gap-2">
          <svg className="h-4 w-4 text-rw-sienna-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
          Panduan Membaca Simbol & Warna Peta
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {/* High */}
          <div className="flex items-start gap-2.5 rounded-lg bg-rw-smoke-50 p-2.5 border border-rw-smoke-100">
            <span className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded-full bg-rw-red-600 ring-2 ring-rw-red-200" />
            <div>
              <strong className="text-rw-red-600 block font-semibold">Tinggi (High ≥70%)</strong>
              <span className="text-rw-smoke-600 text-[11px] leading-tight block mt-0.5">
                Radiasi panas kuat terdeteksi sensor satelit (potensi tinggi api aktif).
              </span>
            </div>
          </div>

          {/* Nominal */}
          <div className="flex items-start gap-2.5 rounded-lg bg-rw-smoke-50 p-2.5 border border-rw-smoke-100">
            <span className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded-full bg-rw-haze-600 ring-2 ring-rw-haze-200" />
            <div>
              <strong className="text-rw-haze-700 block font-semibold">Sedang (Nominal 30–69%)</strong>
              <span className="text-rw-smoke-600 text-[11px] leading-tight block mt-0.5">
                Anomali termal standar terdeteksi pada permukaan lahan.
              </span>
            </div>
          </div>

          {/* Low */}
          <div className="flex items-start gap-2.5 rounded-lg bg-rw-smoke-50 p-2.5 border border-rw-smoke-100">
            <span className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded-full bg-rw-mangrove-600 ring-2 ring-rw-mangrove-200" />
            <div>
              <strong className="text-rw-mangrove-700 block font-semibold">Rendah (Low &lt;30%)</strong>
              <span className="text-rw-smoke-600 text-[11px] leading-tight block mt-0.5">
                Suhu tanah lebih hangat dari lingkungan sekitar (perlu verifikasi).
              </span>
            </div>
          </div>

          {/* Cluster */}
          <div className="flex items-start gap-2.5 rounded-lg bg-rw-smoke-50 p-2.5 border border-rw-smoke-100">
            <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-rw-mangrove-600 text-[9px] font-bold text-white">
              5+
            </span>
            <div>
              <strong className="text-rw-peat-900 block font-semibold">Klaster Titik Panas</strong>
              <span className="text-rw-smoke-600 text-[11px] leading-tight block mt-0.5">
                Kumpulan titik berdekatan. Klik lingkaran klaster untuk memperbesar peta.
              </span>
            </div>
          </div>

          {/* Boundary */}
          <div className="flex items-start gap-2.5 rounded-lg bg-rw-smoke-50 p-2.5 border border-rw-smoke-100 sm:col-span-2 lg:col-span-2">
            <span className="mt-2 h-0.5 w-5 flex-shrink-0 border-t-2 border-dashed border-rw-sienna-700" />
            <div>
              <strong className="text-rw-sienna-800 block font-semibold">Batas Wilayah Administratif</strong>
              <span className="text-rw-smoke-600 text-[11px] leading-tight block mt-0.5">
                Garis batas resmi 12 Kabupaten/Kota di Riau. Arahkan kursor atau klik wilayah untuk membuka detail lokal.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory Disclaimer */}
      <div className="rounded-xl border border-rw-haze-700/30 bg-rw-haze-50/80 p-3.5" role="note">
        <p className="text-xs text-rw-smoke-800 leading-relaxed flex items-start gap-2">
          <svg
            className="h-4 w-4 flex-shrink-0 text-rw-haze-600 mt-0.5"
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
          <span>
            <strong>Catatan Integritas Data:</strong> Titik panas (*hotspot*) merupakan hasil deteksi anomali termal sensor satelit NASA VIIRS & MODIS. Titik panas adalah <strong>indikasi</strong>, BUKAN konfirmasi kebakaran pasti di lapangan. Ketiadaan titik panas juga tidak menjamin tidak adanya kebakaran (misal tertutup asap tebal/awan).
          </span>
        </p>
      </div>
    </div>
  );
}
