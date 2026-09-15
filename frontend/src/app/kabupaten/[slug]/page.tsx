import { KabupatenClient } from "./KabupatenClient";

const SLUG_LIST = [
  "pekanbaru",
  "dumai",
  "bengkalis",
  "indragiri-hilir",
  "indragiri-hulu",
  "kampar",
  "kepulauan-meranti",
  "kuantan-singingi",
  "pelalawan",
  "rokan-hilir",
  "rokan-hulu",
  "siak",
];

export function generateStaticParams() {
  return SLUG_LIST.map((slug) => ({ slug }));
}

export default async function KabupatenPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  return <KabupatenClient slug={resolvedParams.slug} />;
}
