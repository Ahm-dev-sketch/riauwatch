"use client";

/**
 * Visual indicator when running in mock mode.
 * Always visible — prevents mock data from being mistaken for real observations.
 */
export function MockBadge() {
  if (process.env.NEXT_PUBLIC_USE_MOCKS !== "true") return null;

  return (
    <div
      className="rw-mock-badge inline-flex items-center gap-1.5 rounded-full border border-rw-haze-700/40 bg-rw-haze-100 px-3 py-1 text-xs font-semibold text-rw-haze-700 shadow-sm"
      role="status"
      aria-label="Data contoh sedang ditampilkan"
    >
      {/* Beaker/test icon */}
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 3h6M10 9V3M14 9V3M6 21h12M7 14l3-5h4l3 5" />
      </svg>
      Data contoh
    </div>
  );
}
