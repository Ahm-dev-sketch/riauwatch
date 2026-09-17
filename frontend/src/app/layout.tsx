import type { Metadata } from "next";
import { DM_Sans, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-source-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://riauwatch.pages.dev"
).replace(/\/+$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "RIAUWATCH — Pemantauan Karhutla, Cuaca & Kualitas Udara Riau",
    template: "%s | RIAUWATCH",
  },
  description:
    "Platform pemantauan lingkungan publik independen Provinsi Riau: Titik Panas Satelit NASA FIRMS, Indeks Kualitas Udara PM2.5, Prakiraan Cuaca, dan Risiko Kebakaran Hutan Lahan real-time.",
  keywords: [
    "Riau",
    "Pekanbaru",
    "Dumai",
    "Karhutla",
    "Titik Panas",
    "Hotspot Riau",
    "Kualitas Udara Riau",
    "PM2.5",
    "ISPU Riau",
    "Cuaca Riau",
    "Kebakaran Hutan",
    "Gambut Riau",
    "NASA FIRMS",
    "Lingkungan Hidup",
    "Indonesia",
  ],
  authors: [{ name: "RIAUWATCH", url: SITE_URL }],
  creator: "RIAUWATCH",
  publisher: "RIAUWATCH",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: SITE_URL,
    siteName: "RIAUWATCH",
    title: "RIAUWATCH — Pemantauan Karhutla, Cuaca & Kualitas Udara Riau",
    description:
      "Pantau titik panas satelit NASA, kualitas udara PM2.5, prakiraan cuaca, dan risiko kebakaran hutan lahan di 12 Kabupaten/Kota Provinsi Riau secara real-time.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RIAUWATCH — Karhutla, Cuaca & Kualitas Udara Riau",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RIAUWATCH — Pemantauan Karhutla, Cuaca & Kualitas Udara Riau",
    description:
      "Pantau titik panas satelit NASA, kualitas udara PM2.5, cuaca, dan risiko karhutla di Provinsi Riau.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "Kzt0lxdU6kdJOTxJuQpeD6AA33-X9a0-8qRbUBEPY38",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      "url": SITE_URL,
      "name": "RIAUWATCH",
      "description": "Platform Pemantauan Karhutla, Cuaca & Kualitas Udara Provinsi Riau",
      "inLanguage": "id-ID",
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#webapp`,
      "name": "RIAUWATCH",
      "url": SITE_URL,
      "applicationCategory": "EnvironmentalApplication",
      "operatingSystem": "All",
      "browserRequirements": "Requires JavaScript. Requires HTML5.",
      "description": "Pemantauan titik panas satelit NASA FIRMS, indeks ISPU PM2.5, dan risiko kebakaran hutan lahan Provinsi Riau.",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${dmSans.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} h-full`}
    >
      <head>
        <meta name="theme-color" content="#2c1e18" />
        <meta name="google-site-verification" content="Kzt0lxdU6kdJOTxJuQpeD6AA33-X9a0-8qRbUBEPY38" />
        <link rel="manifest" href="/manifest.json" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-rw-smoke-50 text-rw-smoke-900 font-sans antialiased">
        <a href="#main-content" className="skip-link">
          Langsung ke konten utama
        </a>
        {children}
      </body>
    </html>
  );
}
