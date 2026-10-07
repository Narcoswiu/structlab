export const siteName = "StructLab";

export const navLinks = [
  { href: "/welcome", label: "Въведение" },
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

/** Страници, които идват в следващ етап. Ключът е адресът (/login, /demo…). */
export const comingSoonPages = {
  welcome: {
    title: "Въведение",
    text: "Обиколката в 7 стъпки показва как работят таблото, учебникът и лабораториите. Подготвяме я.",
  },
  demo: {
    title: "Демо лаборатория",
    text: "BeamLab – лабораторията за греди с живи диаграми Q и M – е в разработка.",
  },
  privacy: {
    title: "Поверителност",
    text: "Политиката за поверителност ще бъде публикувана преди пускането на сайта.",
  },
  terms: {
    title: "Общи условия",
    text: "Общите условия ще бъдат публикувани преди пускането на сайта.",
  },
  contact: {
    title: "Контакт",
    text: "Страницата за контакт ще бъде добавена преди пускането на сайта.",
  },
} as const;

export type ComingSoonSlug = keyof typeof comingSoonPages;
