import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-rw-gray-200 bg-white" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Disclaimer — always visible */}
        <div className="rounded-lg border border-rw-amber-100 bg-rw-amber-100/50 p-4 mb-6">
          <p className="text-sm text-rw-gray-800 leading-relaxed">
            <strong>Pernyataan Penting:</strong> RIAUWATCH adalah platform pemantauan lingkungan
            independen. Platform ini <strong>BUKAN</strong> layanan darurat dan{" "}
            <strong>BUKAN</strong> situs resmi pemerintah. Untuk informasi resmi dan respon
            darurat, silakan hubungi:
          </p>
          <ul className="mt-2 text-sm text-rw-gray-700 list-disc list-inside space-y-1">
            <li>
              <a
                href="https://www.bmkg.go.id"
                target="_blank"
                rel="noopener noreferrer"
                className="text-rw-green-700 underline underline-offset-2 hover:text-rw-green-600"
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
                className="text-rw-green-700 underline underline-offset-2 hover:text-rw-green-600"
              >
                BNPB
              </a>{" "}
              — Badan Nasional Penanggulangan Bencana
            </li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-sm text-rw-gray-600">
            <span className="font-semibold text-rw-gray-800">RIAUWATCH</span>
            {" · "}
            Pemantauan lingkungan independen Provinsi Riau
          </div>
          <nav aria-label="Tautan footer" className="flex items-center gap-4 text-sm">
            <Link
              href="/data-sources"
              className="text-rw-green-700 hover:text-rw-green-600 underline underline-offset-2"
            >
              Sumber Data
            </Link>
            <span className="text-rw-gray-300">|</span>
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rw-gray-600 hover:text-rw-gray-800 underline underline-offset-2"
            >
              Data Peta &copy; OpenStreetMap
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
