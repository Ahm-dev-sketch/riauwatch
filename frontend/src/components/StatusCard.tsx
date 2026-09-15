"use client";

import type { DomainStatus } from "@/lib/types";

// Status is ALWAYS text + icon + color, never color alone.

interface StatusCardProps {
  title: string;
  description: string;
  status: DomainStatus | null;
  icon: React.ReactNode;
}

function getDomainHealth(status: DomainStatus | null): {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
} {
  if (!status) {
    return {
      label: "Memuat...",
      color: "text-rw-gray-600",
      bgColor: "bg-rw-gray-100",
      icon: (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ),
    };
  }

  if (status.degraded) {
    return {
      label: "Terdegradasi",
      color: "text-rw-orange-600",
      bgColor: "bg-rw-orange-100",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    };
  }

  return {
    label: "Aktif",
    color: "text-rw-green-700",
    bgColor: "bg-rw-green-100",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  };
}

function formatAge(isoDate: string | null): string {
  if (!isoDate) return "Tidak tersedia";
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

export function StatusCard({ title, description, status, icon }: StatusCardProps) {
  const health = getDomainHealth(status ?? null);

  return (
    <div className="rounded-xl border border-rw-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rw-green-50 text-rw-green-700">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-rw-gray-900">{title}</h3>
            <p className="text-xs text-rw-gray-600 mt-0.5">{description}</p>
          </div>
        </div>

        <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${health.bgColor} ${health.color}`}>
          {health.icon}
          {health.label}
        </div>
      </div>

      {status && (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-rw-gray-100 pt-3">
          <div>
            <span className="text-xs text-rw-gray-500 block">Observasi terakhir</span>
            <span className="text-sm font-medium text-rw-gray-800">
              {formatAge(status.last_observation_at)}
            </span>
          </div>
          <div>
            <span className="text-xs text-rw-gray-500 block">Update terakhir</span>
            <span className="text-sm font-medium text-rw-gray-800">
              {formatAge(status.last_successful_run_at)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
