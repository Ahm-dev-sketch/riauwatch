import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Detail Kabupaten",
  description: "Data lingkungan dan risiko kebakaran per kabupaten di Provinsi Riau.",
};

export default function KabupatenLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
