import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/privacidade`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/termos`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/seguranca`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
  ];
}
