"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MockBadge } from "@/components/MockBadge";
import type { HotspotsSummaryResponse, StatusResponse } from "@/lib/types";

interface HeroProps {
  status: StatusResponse | null;
  summary: HotspotsSummaryResponse | null;
  generatedAt: string | null;
}

export function Hero({ status, summary, generatedAt }: HeroProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -5% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hotspotCount = summary?.total ?? 0;
  const rawCount = summary?.total_raw ?? null;
  const hotspotState = status
    ? status.hotspots.degraded
      ? "Terdegradasi"
      : "Berjalan"
    : "Memuat";
  const pillClass =
    hotspotState === "Terdegradasi"
      ? "border-rw-orange-600 bg-rw-orange-100 text-rw-orange-600"
      : hotspotState === "Berjalan"
        ? "border-rw-mangrove-600 bg-rw-mangrove-100 text-rw-mangrove-700"
        : "border-rw-smoke-400 bg-rw-smoke-100 text-rw-smoke-600";
  const dotClass =
    hotspotState === "Terdegradasi"
      ? "bg-rw-red-600"
      : hotspotState === "Berjalan"
        ? "bg-rw-mangrove-600"
        : "bg-rw-smoke-400";
  const reveal = inView ? "rw-hero-reveal is-inview" : "rw-hero-reveal";

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden border-b border-rw-smoke-200 bg-rw-smoke-50"
    >
      <div
        ref={ref}
        className={`relative mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12 ${reveal}`}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-rw-smoke-200 bg-rw-white px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-rw-peat-900">
                <svg
                  className="h-3.5 w-3.5 text-rw-mangrove-700"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9" />
                  <path d="M7.8 13.2c-2.3-2.3-2.3-6.1 0-8.4" />
                  <path d="M16.2 4.8c4.2 4.2 4.2 11 0 15.2" />
                  <path d="M19.1 7.7c-2.3-2.3-6.1-2.3-8.4 0" />
                  <path d="M12 12l4.5 4.5" />
                  <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                </svg>
                Titik panas · cuaca · kualitas udara
              </span>
              <MockBadge />
            </div>

            <h1
              id="hero-heading"
              className="max-w-3xl text-3xl font-bold tracking-tight text-rw-peat-900 font-display sm:text-4xl lg:text-5xl"
            >
              Bagaimana kondisi Riau sekarang?
            </h1>

            {generatedAt && (
              <p className="text-sm text-rw-smoke-600">
                Data diperbarui:{" "}
                <time dateTime={generatedAt} className="rw-readout font-medium text-rw-peat-900">
                  {new Date(generatedAt).toLocaleString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </p>
            )}
          </div>

          {/* Status summary — double bezel instrument panel */}
          <div className="rounded-2xl border border-rw-smoke-200 bg-rw-smoke-100 p-px">
            <div className="rounded-2xl border border-rw-smoke-100 bg-rw-white p-3 sm:p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-rw-smoke-600">
                    Titik panas terindikasi
                  </h2>
                  <p className="rw-readout mt-1 text-4xl font-bold text-rw-peat-900 sm:text-5xl">
                    {summary ? hotspotCount : "–"}
                  </p>
                  <p className="mt-1 text-xs text-rw-smoke-600">
                    {rawCount !== null
                      ? `klaster dari ${rawCount} deteksi satelit`
                      : "klaster hasil pengelompokan deteksi satelit"}
                  </p>
                </div>

                <div
                  className={`inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium ${pillClass}`}
                >
                  <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
                  {hotspotState}
                </div>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-rw-smoke-600">
                Indikasi, bukan konfirmasi kebakaran di lapangan.
              </p>
            </div>
          </div>

          {/* Refined button-in-button CTA */}
          <div>
            <Link
              href="/data-sources"
              className="inline-flex rounded-full border border-rw-sienna-600 bg-rw-sienna-100 p-[3px] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rw-sienna-600"
            >
              <span className="inline-flex items-center justify-center rounded-full bg-rw-sienna-600 px-8 py-3 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90">
                Sumber Data
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
