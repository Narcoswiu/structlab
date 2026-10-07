import type { MetadataRoute } from "next";
import { publicPaths } from "@/lib/site";
import { absoluteUrl } from "@/lib/site-url";

// Само публичните страници. Вътрешните са изключени и в robots.txt.
export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.map((path) => ({
    url: absoluteUrl(path),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
