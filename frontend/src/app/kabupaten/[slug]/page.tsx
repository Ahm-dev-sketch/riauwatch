"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MockBadge } from "@/components/MockBadge";
import { AirQualityPanel } from "@/components/AirQualityPanel";
import { WeatherPanel } from "@/components/WeatherPanel";
import { RiskDetailPanel } from "@/components/RiskDetailPanel";
import {
  getHotspotsSummary,
} from "@/lib/api";
import type {
  HotspotsSummaryResponse,
} from "@/lib/types";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Kabupaten slug → ID mapping (mirrors FilterPanel)
// ---------------------------------------------------------------------------

const SLUG_TO_ID: Record<string, number> = {
  "rokan-hilir": 1,
  "dumai": 2,
  "kampar": 3,
  "pelalawan": 4,
  "siak": 5,
  "kuantan-singingi": 6,
  "indragiri-hulu": 7,
  "rokan-hulu": 8,
  "bengkalis": 9,
  "indragiri-hilir": 10,
  "kepulauan-meranti": 12,
};

// Reverse lookup for display name
const ID_TO_NAME: Record<number, string> = {
  1: "Kab. Rokan Hilir",
  2: "Kota Dumai",
  3: "Kab. Kampar",
  4: "Kab. Pelalawan",
  5: "Kab. Siak",
  6: "Kab. Kuantan Singingi",
  7: "Kab. Indragiri Hulu",
  8: "Kab. Rokan Hulu",
  9: "Kab. Bengkalis",
  10: "Kab. Indragiri Hilir",
  12: "Kab. Kepulauan Meranti",
};

// ---------------------------------------------------------------------------
// Not Found (404) for unknown slug
// ---------------------------------------------------------------------------

function KabupatenNotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main-content" className="flex-1 flex items-center justify-center">
        <div className="text-center px-4">
          <div className="rounded-xl border border-rw-gray-200 bg-white p-8 shadow-sm max-w-md mx-auto">
            <svg className="h-12 w-12 text-rw-gray-300 mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            <h1 className="text-xl font-bold text-rw-gray-900 mb-2">
              Kabupaten Tidak Ditemukan
            </h1>
            <p className="text-sm text-rw-gray-500 mb-4">
              Slug kabupaten tidak valid atau belum tersedia di sistem.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg bg-rw-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-rw-green-600 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend note helper
// ---------------------------------------------------------------------------

function getTrendNote(count: number): string {
  if (count === 0) return "Tidak ada titik panas terdeteksi";
  if (count <= 3) return "Jumlah rendah";
  if (count <= 8) return "Jumlah sedang";
  return "Jumlah tinggi — perlu perhatian";
}

// ---------------------------------------------------------------------------
// Main Kabupaten Page
// ---------------------------------------------------------------------------

export default function KabupatenPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [summary, setSummary] = useState<HotspotsSummaryResponse | null>(null);

  // Derive slug validity directly from the URL param — no state/effect needed
  const kabupatenId = SLUG_TO_ID[slug] ?? null;
  const kabupatenName = kabupatenId ? (ID_TO_NAME[kabupatenId] || slug) : "";
  const validSlug = kabupatenId !== null;

  // Load hotspot summary for this kabupaten
  useEffect(() => {
    if (kabupatenId === null) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await getHotspotsSummary({ kabupaten_id: kabupatenId! });
        if (!cancelled) setSummary(res);
      } catch {
        // Non-critical
      }
    }
    load();
    return () => { cancelled = true; };
  }, [kabupatenId]);

  // Invalid slug → 404
  if (!validSlug) {
    return <KabupatenNotFound />;
  }

  const hotspotCount = summary?.items.find((i) => i.kabupaten_id === kabupatenId)?.count ?? 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main id="main-content" className="flex-1">
        {/* Hero */}
        <section className="bg-white border-b border-rw-gray-200">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="flex items-center gap-3 mb-2">
              <Link
                href="/"
                className="text-rw-gray-400 hover:text-rw-gray-600 transition-colors"
                aria-label="Kembali ke Beranda"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold text-rw-green-900 tracking-tight">
                {kabupatenName}
              </h1>
              <MockBadge />
            </div>
            <p className="text-sm text-rw-gray-500">
              Data lingkungan dan risiko kebakaran untuk wilayah {kabupatenName}
            </p>
          </div>
        </section>

        {/* Hotspot summary */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="rounded-xl border border-rw-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-rw-gray-900">Titik Panas</h2>
                <p className="text-xs text-rw-gray-500 mt-0.5">
                  {getTrendNote(hotspotCount)}
                </p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-rw-gray-900 font-mono">{hotspotCount}</span>
                <span className="text-sm text-rw-gray-500">titik</span>
              </div>
            </div>
          </div>
        </section>

        {/* Risk */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-6">
          <RiskDetailPanel kabupatenId={kabupatenId ?? undefined} />
        </section>

        {/* Air Quality */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-6">
          <AirQualityPanel />
        </section>

        {/* Weather */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-6">
          <WeatherPanel kabupatenId={kabupatenId ?? undefined} />
        </section>
      </main>

      <Footer />
    </div>
  );
}
