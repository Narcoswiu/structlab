import type { Metadata, Viewport } from "next";
import { publicEnv } from "@/lib/env";
import { fontVariables } from "@/lib/fonts";
import { siteName } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: `${siteName} – инженерството, обяснено ясно`,
    template: `%s · ${siteName}`,
  },
  description:
    "Учебник в два режима и интерактивни лаборатории по Съпротивление на материалите за студенти по строителство.",
  // всяка страница посочва собствения си адрес като каноничен
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    locale: "bg_BG",
    siteName,
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0F1C",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // класът "dark" включва dark: вариантите на shadcn/ui компонентите
    <html lang="bg" className={`dark ${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
