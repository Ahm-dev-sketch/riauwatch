import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://riauwatch.pages.dev"
).replace(/\/+$/, "");

const KABUPATEN_SLUGS = [
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

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/data-sources`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  const kabupatenRoutes: MetadataRoute.Sitemap = KABUPATEN_SLUGS.map((slug) => ({
    url: `${SITE_URL}/kabupaten/${slug}`,
    lastModified: now,
    changeFrequency: "hourly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...kabupatenRoutes];
}
