import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-rw-smoke-200 bg-rw-peat-950" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Disclaimer — always visible */}
        <div className="rounded-lg border border-rw-haze-700/30 bg-rw-haze-700/10 p-4 mb-6">
          <p className="text-sm text-rw-smoke-300 leading-relaxed">
            <strong className="text-rw-haze-400">Pernyataan Penting:</strong> RIAUWATCH adalah platform pemantauan lingkungan
            independen. Platform ini <strong>BUKAN</strong> layanan darurat dan{" "}
            <strong>BUKAN</strong> situs resmi pemerintah. Untuk informasi resmi dan respon
            darurat, silakan hubungi:
          </p>
          <ul className="mt-2 text-sm text-rw-smoke-400 list-disc list-inside space-y-1">
            <li>
              <a
                href="https://www.bmkg.go.id"
                target="_blank"
                rel="noopener noreferrer"
                className="text-rw-haze-400 underline underline-offset-2 hover:text-rw-haze-500"
              >
                BMKG
              </a>{" "}
              — Badan Meteorologi, Klimatologi, dan Geofisika
            </li>
            <li>
              <a
                href="https://www.bnpb.go.id"
                target="_blank"
                rel="noopener noreferrer"
                className="text-rw-haze-400 underline underline-offset-2 hover:text-rw-haze-500"
              >
                BNPB
              </a>{" "}
              — Badan Nasional Penanggulangan Bencana
            </li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-sm text-rw-smoke-500">
            <span className="font-semibold text-rw-smoke-300 font-display">RIAUWATCH</span>
            {" · "}
            Pemantauan lingkungan independen Provinsi Riau
          </div>
          <nav aria-label="Tautan footer" className="flex items-center gap-4 text-sm">
            <Link
              href="/data-sources"
              className="text-rw-haze-400 hover:text-rw-haze-500 underline underline-offset-2"
            >
              Sumber Data
            </Link>
            <span className="text-rw-smoke-700">|</span>
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rw-smoke-500 hover:text-rw-smoke-300 underline underline-offset-2"
            >
              Data Peta &copy; OpenStreetMap
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
