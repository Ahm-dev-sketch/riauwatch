import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sumber Data & Transparansi",
  description:
    "Detail sumber data, lisensi, dan metodologi yang digunakan RIAUWATCH untuk pemantauan lingkungan Provinsi Riau.",
};

export default function DataSourcesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
