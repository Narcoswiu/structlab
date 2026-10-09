import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/dashboard",
        "/account",
        "/design",
        "/learn",
        "/labs",
        "/invite/",
        "/unsubscribe/",
        "/auth/",
        "/login",
        "/forgot-password",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
