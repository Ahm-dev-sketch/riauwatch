import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://riauwatch.id";
  const now = new Date().toISOString();

  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${baseUrl}/data-sources`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
