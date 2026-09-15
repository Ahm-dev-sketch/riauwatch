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
          <svg className="h-4 w-4 text-rw-sienna-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
          Panduan Simbol & Kategori Tingkat Kepercayaan Peta
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {/* High — Solid Black */}
          <div className="flex items-start gap-2.5 rounded-lg bg-rw-smoke-50 p-3 border border-rw-smoke-200">
            <span className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-slate-900 ring-2 ring-slate-400" />
            <div>
              <strong className="text-slate-900 block font-bold text-[13px]">Tinggi (High ≥70%) — Hitam</strong>
              <span className="text-rw-smoke-600 text-[11px] leading-relaxed block mt-0.5">
                Radiasi anomali termal sangat kuat terdeteksi sensor satelit. Potensi api aktif berkobar tinggi.
              </span>
            </div>
          </div>

          {/* Nominal — Amber / Orange */}
          <div className="flex items-start gap-2.5 rounded-lg bg-rw-smoke-50 p-3 border border-rw-smoke-200">
            <span className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-amber-500 ring-2 ring-amber-200" />
            <div>
              <strong className="text-amber-800 block font-bold text-[13px]">Sedang (Nominal 30–69%) — Oranye</strong>
              <span className="text-rw-smoke-600 text-[11px] leading-relaxed block mt-0.5">
                Anomali panas standar terdeteksi pada permukaan lahan atau tutupan vegetasi.
              </span>
            </div>
          </div>

          {/* Low — Mangrove Green */}
          <div className="flex items-start gap-2.5 rounded-lg bg-rw-smoke-50 p-3 border border-rw-smoke-200">
            <span className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-green-600 ring-2 ring-green-200" />
            <div>
              <strong className="text-green-800 block font-bold text-[13px]">Rendah (Low &lt;30%) — Hijau</strong>
              <span className="text-rw-smoke-600 text-[11px] leading-relaxed block mt-0.5">
                Suhu permukaan tanah lebih hangat dari sekitar (memerlukan pengecekan lapangan).
              </span>
            </div>
          </div>

          {/* Cluster */}
          <div className="flex items-start gap-2.5 rounded-lg bg-rw-smoke-50 p-3 border border-rw-smoke-200">
            <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-green-700 text-[9px] font-bold text-white">
              5+
            </span>
            <div>
              <strong className="text-rw-peat-900 block font-bold text-[13px]">Klaster Titik Panas</strong>
              <span className="text-rw-smoke-600 text-[11px] leading-relaxed block mt-0.5">
                Kumpulan titik berdekatan. Klik lingkaran klaster untuk memperbesar otomatis ke lokasi spesifik.
              </span>
            </div>
          </div>

          {/* Boundary */}
          <div className="flex items-start gap-2.5 rounded-lg bg-rw-smoke-50 p-3 border border-rw-smoke-200 sm:col-span-2 lg:col-span-2">
            <span className="mt-2 h-0.5 w-5 flex-shrink-0 border-t-2 border-dashed border-rw-sienna-700" />
            <div>
              <strong className="text-rw-sienna-900 block font-bold text-[13px]">Garis Batas Kabupaten/Kota</strong>
              <span className="text-rw-smoke-600 text-[11px] leading-relaxed block mt-0.5">
                Garis batas resmi 12 Kabupaten/Kota di Riau. Arahkan kursor atau klik wilayah untuk membuka detail khusus kabupaten/kota.
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
            <strong>Catatan Integritas Data:</strong> Titik panas (*hotspot*) merupakan hasil deteksi anomali termal sensor satelit NASA VIIRS & MODIS. Titik panas adalah <strong>indikasi</strong>, BUKAN konfirmasi kebakaran pasti di lapangan. Ketiadaan titik panas tidak menjamin tidak adanya kebakaran (misal tertutup asap tebal atau awan).
          </span>
        </p>
      </div>
    </div>
  );
}
