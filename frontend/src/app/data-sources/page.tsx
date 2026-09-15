"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MockBadge } from "@/components/MockBadge";
import { getDataSources } from "@/lib/api";
import type { MetaDataSourcesResponse } from "@/lib/types";

export default function DataSourcesPage() {
  const [data, setData] = useState<MetaDataSourcesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getDataSources()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main id="main-content" className="flex-1">
        {/* Hero */}
        <section className="bg-white border-b border-rw-smoke-200">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-rw-peat-900 tracking-tight font-display">
                Sumber Data & Transparansi
              </h1>
              <MockBadge />
            </div>
            <p className="text-rw-smoke-600 leading-relaxed max-w-2xl">
              RIAUWATCH mengumpulkan data dari sumber terbuka dan terpercaya untuk memberikan
              gambaran kondisi lingkungan Provinsi Riau. Berikut detail setiap sumber yang kami gunakan.
            </p>
          </div>
        </section>

        {/* Jerebu Strip */}
        <div
          className="rw-jerebu-strip h-2"
          style={{
            background: "linear-gradient(90deg, #276749 0%, #2d8659 40%, #38a169 70%, #276749 100%)",
          }}
          aria-hidden="true"
        />

        {/* Disclaimer — always visible on this page */}
        <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="rounded-lg border border-rw-haze-700/30 bg-rw-haze-700/10 p-4">
            <h2 className="text-sm font-bold text-rw-smoke-900 mb-2 flex items-center gap-2">
              <svg className="h-4 w-4 text-rw-haze-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Pernyataan Penting
            </h2>
            <div className="text-sm text-rw-smoke-800 leading-relaxed space-y-2">
              <p>
                <strong>RIAUWATCH adalah platform independen yang dikelola oleh komunitas.</strong> Platform
                ini <strong>BUKAN</strong> situs resmi pemerintah, bukan lembaga resmi, dan bukan layanan
                darurat.
              </p>
              <p>
                Untuk informasi resmi dan respon darurat, silakan hubungi:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>
                  <a
                    href="https://www.bmkg.go.id"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rw-sienna-600 underline underline-offset-2 hover:text-rw-sienna-700 font-medium"
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
                    className="text-rw-sienna-600 underline underline-offset-2 hover:text-rw-sienna-700 font-medium"
                  >
                    BNPB
                  </a>{" "}
                  — Badan Nasional Penanggulangan Bencana
                </li>
                <li>
                  <a
                    href="https://www.bkpsdm.riau.go.id"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rw-sienna-600 underline underline-offset-2 hover:text-rw-sienna-700 font-medium"
                  >
                    Dinas Lingkungan Hidup Riau
                  </a>
                </li>
              </ul>
              <p>
                Data yang ditampilkan bersifat <strong>informatif</strong> dan tidak menggantikan
                penilaian profesional. Selalu verifikasi dengan sumber resmi sebelum mengambil
                keputusan.
              </p>
            </div>
          </div>
        </section>

        {/* Basemap attribution */}
        <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pb-4">
          <div className="rounded-lg border border-rw-smoke-200 bg-white p-4">
            <h2 className="text-sm font-bold text-rw-smoke-900 mb-2 flex items-center gap-2">
              <svg className="h-4 w-4 text-rw-sienna-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
              Peta Basemap: OpenFreeMap
            </h2>
            <div className="text-sm text-rw-smoke-700 leading-relaxed space-y-2">
              <p>
                Peta dasar menggunakan{" "}
                <a
                  href="https://openfreemap.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rw-sienna-600 underline underline-offset-2 hover:text-rw-sienna-700 font-medium"
                >
                  OpenFreeMap
                </a>
                , layanan peta vektor yang sepenuhnya open-source dan gratis.
              </p>
              <p>
                <strong>Lisensi:</strong> OpenFreeMap dilisensikan di bawah MIT License — gratis
                untuk penggunaan komersial dan non-komersial tanpa batasan. Data peta berasal dari
                OpenStreetMap dan dilisensikan di bawah Open Database License (ODbL).
              </p>
              <p>
                <strong>Atribusi:</strong> Atribusi ditambahkan secara otomatis oleh MapLibre GL JS.
                Atribusi lengkap:
              </p>
              <p className="rw-readout text-xs bg-rw-smoke-50 rounded px-3 py-2 border border-rw-smoke-100">
                OpenFreeMap &copy; OpenMapTiles &middot; Data from OpenStreetMap &copy; OpenStreetMap contributors
              </p>
            </div>
          </div>
        </section>

        {/* Data sources list */}
        <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pb-8">
            <h2 className="text-lg font-semibold text-rw-smoke-900 mb-4">
            Sumber Data Aktif
          </h2>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-xl border border-rw-smoke-200 bg-white p-5">
                  <div className="h-4 bg-rw-smoke-100 rounded w-1/3 mb-3" />
                  <div className="h-3 bg-rw-smoke-100 rounded w-2/3 mb-2" />
                  <div className="h-3 bg-rw-smoke-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : data && data.sources.length > 0 ? (
            <div className="space-y-4">
              {data.sources.map((source) => (
                <article
                  key={source.key}
                  className="rounded-xl border border-rw-smoke-200 bg-white p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-rw-smoke-900">
                          {source.name}
                        </h3>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              source.active
                                ? "bg-rw-mangrove-100 text-rw-mangrove-700"
                                : "bg-rw-smoke-100 text-rw-smoke-600"
                            }`}
                        >
                          {source.active ? "Aktif" : "Nonaktif"}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-rw-smoke-500 block text-xs font-medium mb-0.5">
                            Penyedia
                          </span>
                          <a
                            href={source.provider_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-rw-sienna-600 underline underline-offset-2 hover:text-rw-sienna-700 break-all"
                          >
                            {source.provider_url}
                          </a>
                        </div>
                        <div>
                          <span className="text-rw-smoke-500 block text-xs font-medium mb-0.5">
                            Interval Update
                          </span>
                          <span className="text-rw-smoke-800">
                            {source.update_interval_seconds
                              ? source.update_interval_seconds >= 3600
                                ? `${Math.round(source.update_interval_seconds / 3600)} jam`
                                : `${Math.round(source.update_interval_seconds / 60)} menit`
                              : "Sesuai kebutuhan"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3">
                        <span className="text-rw-smoke-500 block text-xs font-medium mb-0.5">
                          Lisensi
                        </span>
                        <p className="text-sm text-rw-smoke-700">{source.license_note}</p>
                      </div>

                      <div className="mt-2">
                        <span className="text-rw-smoke-500 block text-xs font-medium mb-0.5">
                          Atribusi
                        </span>
                        <p className="text-sm text-rw-smoke-700 rw-readout">{source.attribution}</p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-rw-smoke-200 bg-white p-8 text-center">
              <p className="text-rw-smoke-500">
                Data sumber belum tersedia. Silakan coba lagi nanti.
              </p>
            </div>
          )}
        </section>

        {/* Technical methodology note */}
        <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pb-8">
          <div className="rounded-xl border border-rw-smoke-200 bg-rw-smoke-50 p-5">
            <h2 className="text-sm font-bold text-rw-smoke-900 mb-3">
              Metodologi & Keterbatasan
            </h2>
            <div className="text-sm text-rw-smoke-700 leading-relaxed space-y-3">
              <p>
                <strong>Titik Panas (Hotspots):</strong> Data berasal dari sensor satelit VIIRS
                (Suomi NPP/NOAA-20) dan MODIS (Aqua/Terra). Titik panas menunjukkan anomali suhu
                permukaan yang terdeteksi satelit — ini adalah <em>indikasi</em>, bukan konfirmasi
                kebakaran. Banyak faktor yang dapat menyebabkan false positive, termasuk kilang
                minyak, industri, atau refleksi matahari.
              </p>
              <p>
                <strong>Kualitas Udara:</strong> Data dari stasiun pemantau terdekat yang terhubung
                melalui OpenAQ. Ketersediaan data tergantung pada jaringan stasiun pemantau yang
                terbatas di Provinsi Riau. Nilai yang ditampilkan adalah pembacaan terdekat dan
                mungkin tidak mewakili kondisi di seluruh kabupaten.
              </p>
              <p>
                <strong>Cuaca:</strong> Data dari Open-Meteo, yang mengkombinasikan model cuaca
                numerik dengan data observasi. Akurasi berkurang seiring bertambahnya horizon
                prakiraan.
              </p>
              <p>
                <strong>Risiko Kebakaran:</strong> Model berbasis aturan (rules-v0.1) yang
                mengkombinasikan jumlah titik panas, tren, kondisi kekeringan, dan vegetasi.
                Skor bersifat indikatif dan memerlukan validasi lapangan.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
