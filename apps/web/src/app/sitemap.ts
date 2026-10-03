import type { MetadataRoute } from "next";
import { searchMosques, SITE_URL } from "@/lib/api";

// Généré à la demande : la construction ne doit pas dépendre de l'API.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const home: MetadataRoute.Sitemap = [{ url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 }];
  try {
    const mosques = await searchMosques();
    return [...home, ...mosques.map((m) => ({ url: `${SITE_URL}/m/${m.slug}`, changeFrequency: "daily" as const, priority: 0.8 }))];
  } catch {
    return home;
  }
}
