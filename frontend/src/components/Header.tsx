import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "Beranda" },
  { href: "/data-sources", label: "Sumber Data" },
] as const;

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-rw-smoke-200 bg-rw-peat-900/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 group" aria-label="RIAUWATCH — Beranda">
          {/* Satellite dish icon — monitoring, observation, not generic leaf */}
          <svg
            className="h-7 w-7 text-rw-haze-400 group-hover:text-rw-haze-500 transition-colors"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {/* Parabolic dish */}
            <path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9" />
            <path d="M7.8 13.2c-2.3-2.3-2.3-6.1 0-8.4" />
            <path d="M16.2 4.8c4.2 4.2 4.2 11 0 15.2" />
            <path d="M19.1 7.7c-2.3-2.3-6.1-2.3-8.4 0" />
            {/* Receiver/feed */}
            <path d="M12 12l4.5 4.5" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
            {/* Signal waves */}
            <path d="M2 2l3 3" opacity="0.5" />
            <path d="M19 19l3 3" opacity="0.5" />
          </svg>
          <div className="flex flex-col leading-none">
            <span className="text-lg font-bold tracking-tight text-rw-white font-display">
              RIAUWATCH
            </span>
            <span className="hidden sm:block text-[11px] text-rw-smoke-400 tracking-wide uppercase">
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
                  className="rounded-md px-3 py-2 text-sm font-medium text-rw-smoke-300 hover:bg-rw-peat-800 hover:text-rw-white transition-colors"
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
