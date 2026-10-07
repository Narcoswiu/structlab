export const siteName = "StructLab";

export const navLinks = [
  { href: "/welcome", label: "Въведение" },
  { href: "/demo", label: "Демо" },
  { href: "/#features", label: "Възможности" },
  { href: "/#spec", label: "Специалности" },
  { href: "/#ai", label: "AI асистент" },
  { href: "/#prices", label: "Цени" },
] as const;

export type PricePlan = {
  name: string;
  /** цена в EUR; null = още не е решена (виж docs/DECISIONS.md) */
  priceEur: number | null;
  features: string[];
  recommended: boolean;
};

export const pricePlans: PricePlan[] = [
  {
    name: "Семестър",
    priceEur: null,
    features: [
      "Модулите на семестъра",
      "Всички лаборатории",
      "AI асистент с месечен лимит",
    ],
    recommended: false,
  },
  {
    name: "Цяла година",
    priceEur: null,
    features: ["Двата семестъра", "Лични задания", "Разширен AI асистент"],
    recommended: true,
  },
];

export const footerLinks = [
  { href: "/welcome", label: "Въведение" },
  { href: "/demo", label: "Демо" },
  { href: "/privacy", label: "Поверителност" },
  { href: "/terms", label: "Общи условия" },
  { href: "/contact", label: "Контакт" },
] as const;

/** Публичните страници с истинско съдържание – за sitemap.xml. */
export const publicPaths = [
  "/",
  "/welcome",
  "/demo",
  "/demo/uchebnik",
  "/demo/laboratoriya",
  "/request-invite",
  "/contact",
  "/privacy",
  "/terms",
] as const;
