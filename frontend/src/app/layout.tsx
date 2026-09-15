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
  weight: ["600", "700"],
  variable: "--font-source-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RIAUWATCH — Pemantauan Lingkungan Riau",
    template: "%s | RIAUWATCH",
  },
  description:
    "Platform pemantauan lingkungan independen untuk Provinsi Riau. Data titik panas, kualitas udara, cuaca, dan risiko kebakaran hutan secara real-time.",
  keywords: [
    "Riau",
    "lingkungan",
    "titik panas",
    "hotspot",
    "kualitas udara",
    "cuaca",
    "kebakaran hutan",
    "pemantauan",
    "Indonesia",
  ],
  authors: [{ name: "RIAUWATCH" }],
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "https://riauwatch.id",
    siteName: "RIAUWATCH",
    title: "RIAUWATCH — Pemantauan Lingkungan Riau",
    description:
      "Platform pemantauan lingkungan independen untuk Provinsi Riau. Data titik panas, kualitas udara, cuaca, dan risiko kebakaran hutan.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RIAUWATCH — Pemantauan Lingkungan Riau",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RIAUWATCH — Pemantauan Lingkungan Riau",
    description:
      "Platform pemantauan lingkungan independen untuk Provinsi Riau.",
  },
  robots: {
    index: true,
    follow: true,
  },
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
      <body className="min-h-full flex flex-col bg-rw-gray-50 text-rw-gray-900 font-sans antialiased">
        <a href="#main-content" className="skip-link">
          Langsung ke konten utama
        </a>
        {children}
      </body>
    </html>
  );
}
