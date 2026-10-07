import { JetBrains_Mono, Literata, Manrope, Unbounded } from "next/font/google";

// next/font сваля шрифтовете при build и ги сервира от нашия домейн –
// браузърът на потребителя не прави заявки към Google.
// (стойностите трябва да са изписани буквално – изискване на next/font)

export const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-unbounded",
  display: "swap",
});

export const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  display: "swap",
});

export const literata = Literata({
  subsets: ["latin", "cyrillic"],
  variable: "--font-literata",
  display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const fontVariables = [
  unbounded.variable,
  manrope.variable,
  literata.variable,
  jetbrainsMono.variable,
].join(" ");
