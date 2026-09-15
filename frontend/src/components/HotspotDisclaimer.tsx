/**
 * Permanent disclaimer — appears on every page, in the footer, and in hotspot popups.
 * This is NOT optional — it's a core trust requirement.
 */
export function HotspotDisclaimer() {
  return (
    <div className="rounded-lg border border-rw-haze-700/20 bg-rw-haze-50 p-3" role="note">
      <p className="text-xs text-rw-smoke-700 leading-relaxed">
        <svg
          className="inline-block h-3.5 w-3.5 mr-1 text-rw-haze-600 -mt-0.5"
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
        <strong>Peringatan:</strong> Titik panas adalah indikasi deteksi panas dari sensor satelit.
        Ini <strong>BUKAN</strong> kebakaran terkonfirmasi. Verifikasi lapangan diperlukan untuk memastikan.
        Ketiadaan titik panas tidak menjamin tidak adanya kebakaran.
      </p>
    </div>
  );
}
