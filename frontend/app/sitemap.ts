import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://refine-nexus-ai.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/login", "/privacy", "/terms"].map((p) => ({ url: base + p, lastModified: new Date() }));
}
