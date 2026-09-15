import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "Beranda" },
  { href: "/data-sources", label: "Sumber Data" },
] as const;

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-rw-gray-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 group" aria-label="RIAUWATCH — Beranda">
          {/* Leaf icon — environmental, not generic */}
          <svg
            className="h-8 w-8 text-rw-green-700 group-hover:text-rw-green-600 transition-colors"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75" />
          </svg>
          <div className="flex flex-col leading-none">
            <span className="text-lg font-bold tracking-tight text-rw-green-900">
              RIAUWATCH
            </span>
            <span className="hidden sm:block text-xs text-rw-gray-600">
              Pemantauan Lingkungan Riau
            </span>
          </div>
        </Link>

        <nav aria-label="Navigasi utama">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-rw-gray-700 hover:bg-rw-gray-100 hover:text-rw-green-800 transition-colors"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
