import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site-url";

// Само страниците с истинско съдържание. Временните „Скоро“ не са тук.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 }];
}
