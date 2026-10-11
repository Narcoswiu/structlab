import { sectionIdForTitle } from "@/lib/content/sections";

/**
 * Търсене в текста на главите – чисти функции, без база и без външни услуги.
 *
 * Главата се реже на парчета по секции (## …) и подсекции (### …). Въпросът
 * се сравнява с всяко парче по думи: малки букви, без препинателни знаци и
 * служебни думи, без окончания (членове, множествено число) и до първите пет
 * букви – така „напрежение“, „напрежения“ и „напреженията“ съвпадат.
 * Речникът на термините добавя синоними и означения („W“ → „съпротивителен
 * момент“, „тежище“ → „център на тежестта“).
 */

export type ContentMode = "easy" | "detailed";

export type ChapterSource = {
  moduleSlug: string;
  chapterSlug: string;
  number: number;
  title: string;
  summary: string;
  mode: ContentMode;
  body: string;
};

export type Chunk = {
  moduleSlug: string;
  chapterSlug: string;
  chapterNumber: number;
  chapterTitle: string;
  /** за какво е главата – термин в резюмето значи, че главата е за него */
  chapterSummary: string;
  mode: ContentMode;
  /** постоянният id на секцията (за връзка към нея); null, ако е непозната */
  sectionId: string | null;
  sectionTitle: string;
  subsectionTitle: string | null;
  text: string;
};

export type RankedChunk = Chunk & { score: number };

/** Колко знака от учебника най-много се подават на модела с един въпрос. */
export const EXCERPT_BUDGET = 12_000;
/** Най-много парчета в един отговор към модела. */
export const MAX_PROMPT_CHUNKS = 8;
/** Колко откъса се показват, когато се търси само в уроците. */
export const LESSON_EXCERPTS = 3;
/** Дължина на един показан откъс (знаци) – реже се само между абзаци. */
export const LESSON_EXCERPT_CHARS = 1400;

const FENCE = /^(```|~~~)/;

/** Реже главата на парчета по „## “ и „### “. */
export function splitChapter(source: ChapterSource): Chunk[] {
  const chunks: Chunk[] = [];
  let sectionTitle = "Въведение";
  let subsectionTitle: string | null = null;
  let lines: string[] = [];
  let inFence = false;

  const flush = () => {
    const text = lines.join("\n").trim();
    lines = [];
    if (!text) return;
    chunks.push({
      moduleSlug: source.moduleSlug,
      chapterSlug: source.chapterSlug,
      chapterNumber: source.number,
      chapterTitle: source.title,
      chapterSummary: source.summary,
      mode: source.mode,
      sectionId: sectionIdForTitle(sectionTitle) ?? null,
      sectionTitle,
      subsectionTitle,
      text,
    });
  };

  for (const line of source.body.split("\n")) {
    if (FENCE.test(line)) inFence = !inFence;
    const heading = inFence ? null : /^(##|###)\s+(.+?)\s*$/.exec(line);
    if (!heading) {
      lines.push(line);
      continue;
    }
    flush();
    if (heading[1] === "##") {
      sectionTitle = heading[2]!;
      subsectionTitle = null;
    } else {
      subsectionTitle = heading[2]!;
    }
  }
  flush();
  return chunks;
}

// ---------------------------------------------------------------- думи

const STOP_WORDS = new Set(
  `а ако ами бе без би бил била било били бих бъде в във вече ви вие все всеки
  всички го да дали до дори е един една едно едни за защо защото и из или им
  има имам искам как каква какво какви какъв кажи като кога когато кое кои кой
  който която което които коя къде ли ме между ми много мога може можеш моля
  му на над най нали например не него нея ни ние нещо но няма обясни означава
  от още по под пред представлява през при се си са само след сме според става
  сте съм със същ също та така там те тези ти то това този тази тук тя трябва
  ще я
  колко колкото толкова кому чий чия чие
  здравей здравейте здрасти привет благодаря мерси довиждане чао
  накратко изобщо всъщност значи пак гласи
  разбирам разбрах знам питам търся интересува помогни помощ обяснете кажете
  дай дайте кажи намери напиши покажи разкажи реши
  the and for with what how why`
    .split(/\s+/)
    .filter(Boolean),
);

/**
 * Думи от „скелета“ на главите и от всекидневната реч. Срещат се в заглавия и
 * удебелен текст („Пример 1“, „Стъпка 2“, „Рецептата“), но не са понятия: само
 * по такава дума не се познава за какво е въпросът.
 */
const GENERIC_WORD_LIST = `пример задача стъпка решение рецепта формула въпрос
  отговор внимание проверка извод случай начин правило вид част число стойност
  резултат час минута ден година време днес утре вчера добре лошо голям малък
  нов стар човек място работя правя зная мисля казвам`;

/** Кратки думи, които са термини и не бива да се изхвърлят. */
const KEEP_SHORT = new Set(["ос"]);

const ARTICLE_SUFFIXES = [
  "ията",
  "ият",
  "ите",
  "ата",
  "ето",
  "ът",
  "ят",
  "та",
  "то",
  "те",
  "ия",
];

/**
 * Основата на една дума (вече с малки букви) или null, ако думата не носи
 * смисъл за търсенето (служебна дума, число, твърде къса).
 */
export function stem(word: string): string | null {
  if (STOP_WORDS.has(word) || /^\d+$/.test(word)) return null;
  let base = word;
  if (/[а-я]/.test(base)) {
    // „знаците“ → „знаци“ → „знак“
    if (base.length >= 6 && base.endsWith("ците")) base = base.slice(0, -2);
    for (const suffix of ARTICLE_SUFFIXES) {
      if (base.endsWith(suffix) && base.length - suffix.length >= 2) {
        base = base.slice(0, -suffix.length);
        break;
      }
    }
    if (base.length >= 4 && base.endsWith("ци")) {
      // „знаци“ → „знак“, „участъци“ → „участък“
      base = `${base.slice(0, -2)}к`;
    } else if (base.length >= 3 && /[аеиоуъюя]$/.test(base)) {
      base = base.slice(0, -1);
    }
    if (base.length === 2 && !KEEP_SHORT.has(base)) return null;
  }
  if (base.length < 2 || (base.length < 3 && !KEEP_SHORT.has(base))) {
    return null;
  }
  return base.slice(0, 5);
}

/** Основите на думите в текста, в реда им. */
export function tokenize(text: string): string[] {
  const stems: string[] = [];
  for (const word of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
    const value = stem(word);
    if (value) stems.push(value);
  }
  return stems;
}

const GENERIC_WORDS = new Set(tokenize(GENERIC_WORD_LIST));

// ------------------------------------------------------------ синоними

export type GlossaryTerm = {
  preferred: string;
  also_ok?: string[];
  avoid?: string[];
  symbol?: string;
};

export type SynonymIndex = {
  /** група → изрази (предпочитан, синоними) → основи на думите */
  groups: string[][][];
  /** означение („W“, „Q“) → групите, които го носят */
  symbols: Map<string, number[]>;
};

export const EMPTY_SYNONYMS: SynonymIndex = { groups: [], symbols: new Map() };

/**
 * Прави таблица на синонимите от речника. Влизат и изразите от „avoid“: в
 * учебника не се ползват, но студентите питат и с тях.
 */
export function buildSynonymIndex(terms: GlossaryTerm[]): SynonymIndex {
  const groups: string[][][] = [];
  const symbols = new Map<string, number[]>();
  for (const term of terms) {
    const phrases = [
      term.preferred,
      ...(term.also_ok ?? []),
      ...(term.avoid ?? []),
    ]
      .map((phrase) => tokenize(phrase))
      .filter((stems) => stems.length > 0);
    if (phrases.length === 0) continue;
    const index = groups.push(phrases) - 1;
    for (const symbol of (term.symbol ?? "").split(",")) {
      const value = symbol.trim();
      // само означения от една „дума“: W, Q, I_xy, σ
      if (!/^[\p{L}_]{1,6}$/u.test(value)) continue;
      symbols.set(value, [...(symbols.get(value) ?? []), index]);
    }
  }
  return { groups, symbols };
}

/** Едно понятие от въпроса: дума или термин с неговите синоними. */
type Unit = {
  alternatives: string[][];
  /** означенията, с които е попитано („Q“, „W“) – търсят се и във формулите */
  symbols: string[];
  /** термин от речника – ако го няма в учебника, въпросът е извън него */
  isTerm: boolean;
  weight: number;
  /** брои ли се при преценката „покрит ли е въпросът“ */
  counts: boolean;
};

function sameStems(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

function buildUnits(
  text: string,
  synonyms: SynonymIndex,
  weight: number,
  counts: boolean,
): Unit[] {
  const units: Unit[] = [];
  const seen = new Map<number, Unit>();
  const addGroup = (group: number, symbol?: string) => {
    let unit = seen.get(group);
    if (!unit) {
      unit = {
        alternatives: synonyms.groups[group]!,
        symbols: [],
        isTerm: true,
        weight,
        counts,
      };
      seen.set(group, unit);
      units.push(unit);
    }
    if (symbol && !unit.symbols.includes(symbol)) unit.symbols.push(symbol);
  };

  // означения: „W“, „Q“ – сравняват се точно, с главни и малки букви
  for (const raw of text.split(/\s+/)) {
    const word = raw.replace(/^[^\p{L}]+|[^\p{L}\p{N}_]+$/gu, "");
    // „I_x“ е инерционният момент „I“ с индекс
    const symbol = synonyms.symbols.has(word) ? word : word.split("_")[0]!;
    for (const group of synonyms.symbols.get(symbol) ?? []) {
      addGroup(group, symbol);
    }
  }

  const stems = tokenize(text);
  const used = new Array<boolean>(stems.length).fill(false);
  // най-дългите изрази първи: „центробежен инерционен момент“ преди
  // „инерционен момент“
  const phrases = synonyms.groups
    .flatMap((group, index) => group.map((phrase) => ({ phrase, index })))
    .sort((a, b) => b.phrase.length - a.phrase.length);
  for (const { phrase, index } of phrases) {
    for (let at = 0; at + phrase.length <= stems.length; at++) {
      const window = stems.slice(at, at + phrase.length);
      if (!sameStems(window, phrase)) continue;
      if (used.slice(at, at + phrase.length).some(Boolean)) continue;
      for (let i = at; i < at + phrase.length; i++) used[i] = true;
      addGroup(index);
    }
  }

  const singles = new Set<string>();
  stems.forEach((value, i) => {
    if (used[i] || singles.has(value)) return;
    singles.add(value);
    units.push({
      alternatives: [[value]],
      symbols: [],
      isTerm: false,
      weight,
      counts,
    });
  });
  return units;
}

// ------------------------------------------------------------- оценка

type IndexedChunk = {
  chunk: Chunk;
  stems: string[];
  counts: Map<string, number>;
  /** означенията във формулите ($Q$, $W_x$) и колко пъти се срещат */
  symbols: Map<string, number>;
  headingSymbols: Set<string>;
  bigrams: Set<string>;
  subsection: Set<string>;
  section: Set<string>;
  title: Set<string>;
  summary: Set<string>;
  bold: Set<string>[];
  /** удебеленото, което прилича на въведен термин, а не на изречение */
  terms: Set<string>[];
};

const GREEK: Record<string, string> = {
  sigma: "σ",
  tau: "τ",
  varepsilon: "ε",
  epsilon: "ε",
  lambda: "λ",
};

/** Буквите във формулите: „$W_x = I_x / y$“ → W, x, I, x, y. */
function mathSymbols(text: string): string[] {
  const out: string[] = [];
  for (const span of text.matchAll(/\$+([^$]+)\$+/g)) {
    for (const match of span[1]!.matchAll(/\\([A-Za-z]+)|([A-Za-z]+)/g)) {
      const symbol = match[1] ? GREEK[match[1]] : match[2];
      if (symbol) out.push(symbol);
    }
  }
  return out;
}

// Едно и също парче се разчита веднъж, колкото и въпроса да се зададат.
const indexed = new WeakMap<Chunk, IndexedChunk>();

function indexChunk(chunk: Chunk): IndexedChunk {
  const ready = indexed.get(chunk);
  if (ready) return ready;
  const item = buildIndex(chunk);
  indexed.set(chunk, item);
  return item;
}

function buildIndex(chunk: Chunk): IndexedChunk {
  const stems = tokenize(chunk.text);
  const counts = new Map<string, number>();
  const bigrams = new Set<string>();
  stems.forEach((value, i) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
    if (i > 0) bigrams.add(`${stems[i - 1]} ${value}`);
  });
  const spans = [...chunk.text.matchAll(/\*\*([^*\n]+)\*\*/g)].map((match) => ({
    raw: match[1]!,
    stems: new Set(tokenize(match[1]!)),
  }));
  const bold = spans.map((span) => span.stems);
  // „**Стъпка 1.**“ и „**А ако стълбът е по-висок?**“ са изречения
  const terms = spans
    .filter(
      (span) =>
        span.stems.size <= MAX_NOTION_WORDS && !/[.?!:]\s*$/.test(span.raw),
    )
    .map((span) => span.stems);
  const symbols = new Map<string, number>();
  for (const symbol of mathSymbols(chunk.text)) {
    symbols.set(symbol, (symbols.get(symbol) ?? 0) + 1);
  }
  const heading = chunk.subsectionTitle ?? "";
  return {
    chunk,
    stems,
    counts,
    symbols,
    headingSymbols: new Set([
      ...(heading.match(/[A-Za-zα-ω]+/g) ?? []),
      ...mathSymbols(heading),
    ]),
    bigrams,
    subsection: new Set(tokenize(chunk.subsectionTitle ?? "")),
    section: new Set(tokenize(chunk.sectionTitle)),
    title: new Set(tokenize(chunk.chapterTitle)),
    summary: new Set(tokenize(chunk.chapterSummary)),
    bold,
    terms,
  };
}

const hasAll = (set: { has(value: string): boolean }, stems: string[]) =>
  stems.every((value) => set.has(value));

function phraseCount(item: IndexedChunk, phrase: string[]): number {
  if (phrase.length === 1) return item.counts.get(phrase[0]!) ?? 0;
  let count = 0;
  for (let at = 0; at + phrase.length <= item.stems.length; at++) {
    if (phrase.every((value, i) => item.stems[at + i] === value)) count += 1;
  }
  return count;
}

/** Колко силно едно понятие присъства в парчето (0 = никак). */
function unitStrength(unit: Unit, item: IndexedChunk): number {
  let best = 0;
  for (const alternative of unit.alternatives) {
    let strength = 0;
    // термин от няколко думи се брои само когато думите са една до друга
    const tf = phraseCount(item, alternative);
    if (tf > 0) {
      strength += Math.min(1 + Math.log(tf), 2.5);
      if (alternative.length > 1) strength += 1;
    }
    // заглавието на подсекцията казва за какво е парчето
    if (hasAll(item.subsection, alternative)) strength += 3;
    else if (hasAll(item.section, alternative)) strength += 1.5;
    // удебелен термин = мястото, където е определен
    if (item.bold.some((span) => hasAll(span, alternative))) strength += 4;
    if (hasAll(item.title, alternative)) strength += 1.5;
    else if (hasAll(item.summary, alternative)) strength += 1.5;
    best = Math.max(best, strength);
  }
  for (const symbol of unit.symbols) {
    let strength = 0;
    const tf = item.symbols.get(symbol) ?? 0;
    if (tf > 0) strength += Math.min(1 + Math.log(tf), 2.5) * 0.8;
    if (item.headingSymbols.has(symbol)) strength += 3;
    best = Math.max(best, strength);
  }
  return best;
}

export type RankOptions = {
  synonyms?: SynonymIndex;
  /** главата, която потребителят чете в момента */
  current?: { module: string; chapter: string };
  /** режимът, в който чете (или запазеният му) */
  preferredMode?: ContentMode;
  /** предишните въпроси от разговора – тежат по-малко */
  history?: string[];
  /** секции, които не се предлагат (въпросите от „Провери се“) */
  excludeSections?: string[];
};

const DEFINITION =
  /(^|\s)(какво\s+(е|са|означава|представлява)|що\s+е|защо|дефиниция|определение)(\s|$)/;
const EXAMPLE = /\d|пример|задач|реши|решен|сметн|изчисл/;

/** Под тази част от „теглото“ на въпроса парчето не се смята за отговор. */
const MIN_COVERAGE = 0.4;
/**
 * Когато в парчето няма нито един термин от въпроса, а само обикновени думи,
 * или когато във въпроса има име, непознато на целия учебник, парчето трябва
 * да покрива повече от половината въпрос. „Колко е часът в Токио?“ –
 * намерена е „час“, но не и „Токио“: точно половината, значи не е отговор.
 */
const MIN_COVERAGE_PLAIN = 0.55;
/** Удебелен текст с повече думи е изречение, а не въведен термин. */
const MAX_NOTION_WORDS = 4;
/** Колко по-напред излиза глава, чието заглавие говори за същото. */
const TITLE_BOOST = 0.5;
const SUMMARY_BOOST = 0.2;
const HEADING_BOOST = 1.5;
/** Парче се показва само ако е поне толкова добро спрямо най-доброто. */
const MIN_RELATIVE = 0.3;

/**
 * Подрежда парчетата по това колко добре отговарят на въпроса – най-доброто
 * първо. Връща празен списък, когато в учебника няма нищо по въпроса.
 */
export function rankChunks(
  question: string,
  chunks: Chunk[],
  options: RankOptions = {},
): RankedChunk[] {
  const synonyms = options.synonyms ?? EMPTY_SYNONYMS;
  const preferredMode = options.preferredMode ?? "easy";
  const excluded = new Set(options.excludeSections ?? ["proveri"]);
  const items = chunks
    .filter((chunk) => !chunk.sectionId || !excluded.has(chunk.sectionId))
    .map(indexChunk);
  if (items.length === 0) return [];

  const units = [
    ...buildUnits(question, synonyms, 1, true),
    ...(options.history ?? []).flatMap((text) =>
      buildUnits(text, synonyms, 0.35, false),
    ),
  ];
  if (units.length === 0) return [];
  // „а защо?“ – въпросът сам не казва нищо; тогава водят предишните
  if (!units.some((unit) => unit.counts)) {
    for (const unit of units) unit.counts = true;
  }

  const strengths = units.map((unit) =>
    items.map((item) => unitStrength(unit, item)),
  );
  const found = strengths.map((row) => row.filter((value) => value > 0).length);
  const rarity = (df: number) => Math.log(1 + items.length / (df + 0.5));
  const knownMax = Math.max(
    0,
    ...units.map((unit, u) =>
      unit.counts && found[u]! > 0 ? rarity(found[u]!) : 0,
    ),
  );
  // Дума, която я няма никъде: ако е термин от речника, въпросът е за нещо
  // извън учебника и тежи с пълна сила; ако е случайна дума, тежи колкото
  // най-рядката намерена – никога по-малко от позната дума.
  const idf = units.map((unit, u) => {
    if (found[u]! > 0) return rarity(found[u]!);
    return unit.isTerm ? rarity(0) : Math.min(rarity(0), knownMax);
  });
  const total = units.reduce(
    (sum, unit, u) => sum + (unit.counts ? idf[u]! : 0),
    0,
  );
  if (total === 0) return [];
  // Във въпроса има име, което го няма никъде в учебника („Франция“,
  // „Токио“): тогава намереното трябва да тежи повече от него. Иначе термин
  // с второ значение („столица“ е и греда от покрив) дава отговор на въпрос
  // за друго. Първата дума не се гледа – тя винаги е с главна буква.
  const properNames = new Set(
    (question.match(/[\p{L}\p{N}]+/gu) ?? [])
      .slice(1)
      .filter((word) => /^\p{Lu}\p{Ll}/u.test(word))
      .flatMap((word) => tokenize(word)),
  );
  const unknown = units.filter(
    (unit, u) => unit.counts && !unit.isTerm && found[u] === 0,
  );
  const hasUnknown = unknown.length > 0;
  const hasUnknownName = unknown.some((unit) =>
    properNames.has(unit.alternatives[0]![0]!),
  );

  // Понятията на учебника: термините от речника, думите от заглавията на
  // главите и подсекциите и това, което е въведено с удебелен текст. Всичко
  // останало са обикновени думи – „балкон“, „линийка“, „Токио“.
  const notions = new Set<string>(synonyms.groups.flat(2));
  for (const item of items) {
    for (const value of item.title) notions.add(value);
    for (const value of item.subsection) notions.add(value);
    for (const span of item.terms) {
      for (const value of span) notions.add(value);
    }
  }
  for (const value of GENERIC_WORDS) notions.delete(value);
  const isNotion = units.map(
    (unit) => unit.isTerm || notions.has(unit.alternatives[0]![0]!),
  );
  const askedStems = new Set(
    units.flatMap((unit) => (unit.counts ? unit.alternatives.flat() : [])),
  );

  // съседни думи от въпроса, които са съседни и в текста („метод на сечението“)
  const singles = units.filter((unit) => unit.counts && !unit.isTerm);
  const pairs = singles
    .slice(1)
    .map(
      (unit, i) =>
        `${singles[i]!.alternatives[0]![0]} ${unit.alternatives[0]![0]}`,
    );

  const lower = question.toLowerCase();
  const wantsDefinition = DEFINITION.test(lower);
  const wantsExample = EXAMPLE.test(lower);

  // Каква част от въпроса е в заглавието и в резюмето на всяка глава: глава,
  // която е за това, излиза пред глава, която само го споменава.
  const chapterKey = (chunk: Chunk) =>
    `${chunk.moduleSlug}/${chunk.chapterSlug}`;
  const chapterBoost = new Map<string, number>();
  for (const item of items) {
    const key = chapterKey(item.chunk);
    if (chapterBoost.has(key)) continue;
    let inTitle = 0;
    let inSummary = 0;
    units.forEach((unit, u) => {
      if (!unit.counts) return;
      if (unit.alternatives.some((alt) => hasAll(item.title, alt))) {
        inTitle += idf[u]!;
      } else if (unit.alternatives.some((alt) => hasAll(item.summary, alt))) {
        inSummary += idf[u]!;
      }
    });
    chapterBoost.set(
      key,
      1 + (TITLE_BOOST * inTitle + SUMMARY_BOOST * inSummary) / total,
    );
  }

  const within = (stems: Set<string>) =>
    stems.size > 0 && hasAll(askedStems, [...stems]);
  const counted = units.filter((unit) => unit.counts);
  /** единствената дума на въпроса, когато той е само една дума */
  const keyword =
    counted.length === 1 && !counted[0]!.isTerm
      ? counted[0]!.alternatives[0]![0]!
      : null;

  let scored = items.map((item, i) => {
    let score = 0;
    let covered = 0;
    let matched = 0;
    let hasTerm = false;
    let rare = false;
    let distinctive = false;
    units.forEach((unit, u) => {
      const strength = strengths[u]![i]!;
      if (strength === 0) return;
      score += unit.weight * idf[u]! * strength;
      if (!unit.counts) return;
      covered += idf[u]!;
      matched += 1;
      if (unit.isTerm) hasTerm = true;
      // дума, която я има в повече от половината парчета, не отличава нищо
      if (found[u]! > items.length / 2) return;
      rare = true;
      // обикновена дума („висок“, „връх“) също – отличава само понятие
      if (isNotion[u]) distinctive = true;
    });
    // Парчето е точно за това, за което се пита: заглавието на подсекцията
    // или удебелен термин в него се състои само от думи от въпроса. При
    // въпрос от една дума („Щайнер“, „гънки“) стига тя да е част от тях.
    const names = [item.subsection, item.title, ...item.terms];
    const defined =
      distinctive &&
      (names.some(within) ||
        (keyword !== null && names.some((stems) => stems.has(keyword))));
    const coverage = covered / total;
    // Отговор е само парче, в което има термин от въпроса, мястото, където
    // е въведено търсеното понятие, или поне две различни думи от въпроса –
    // без дума, която учебникът изобщо не познава, и с понятие сред тях (или
    // всички думи на въпроса наведнъж). Една случайна обща дума („час“,
    // „време“) не стига.
    const plain =
      matched >= 2 && !hasUnknown && (distinctive || covered === total);
    if (!rare || !((hasTerm && distinctive) || defined || plain)) {
      return { item, score: 0, exact: false };
    }
    const needed =
      (hasTerm && !hasUnknownName) || (defined && !hasUnknown)
        ? MIN_COVERAGE
        : MIN_COVERAGE_PLAIN;
    if (coverage < needed) return { item, score: 0, exact: false };

    score += pairs.filter((pair) => item.bigrams.has(pair)).length * 1.5;
    score *= 0.4 + 0.6 * coverage;

    const { chunk } = item;
    if (wantsDefinition && chunk.sectionId === "razberi") score *= 1.25;
    // „какво е …“ не търси решена задача
    if (wantsDefinition && !wantsExample && chunk.sectionId === "primer") {
      score *= 0.75;
    }
    if (wantsExample && chunk.sectionId === "primer") score *= 1.4;
    if (chunk.mode === preferredMode) score *= 1.1;
    score *= chapterBoost.get(chapterKey(chunk))!;
    // на страница на глава: първо тя, после останалите глави от същия модул
    if (options.current && chunk.moduleSlug === options.current.module) {
      score *= chunk.chapterSlug === options.current.chapter ? 1.5 : 1.15;
    }
    return { item, score, exact: within(item.subsection) };
  });
  scored = scored.filter((entry) => entry.score > 0);

  // „Леко“ и „Подробно“ имат едни и същи секции: от всяка глава остава само
  // единият режим – този на потребителя, освен ако другият е много по-добър.
  const bestByChapter = new Map<string, { mine: number; other: number }>();
  for (const { item, score } of scored) {
    const key = chapterKey(item.chunk);
    const best = bestByChapter.get(key) ?? { mine: 0, other: 0 };
    if (item.chunk.mode === preferredMode)
      best.mine = Math.max(best.mine, score);
    else best.other = Math.max(best.other, score);
    bestByChapter.set(key, best);
  }
  scored = scored.filter(({ item }) => {
    const best = bestByChapter.get(chapterKey(item.chunk))!;
    const keepMine = best.mine > 0 && best.mine * 2 >= best.other;
    return (item.chunk.mode === preferredMode) === keepMine;
  });

  // Подсекция, чието заглавие е точно това, за което се пита („Основният
  // закон“), е по-добър отговор от подсекция, която само го споменава. Смята
  // се след избора на режим, за да не измести „Леко“ с „Подробно“.
  for (const entry of scored) {
    if (entry.exact) entry.score *= HEADING_BOOST;
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0]?.score ?? 0;
  return scored
    .filter((entry) => entry.score >= top * MIN_RELATIVE)
    .map(({ item, score }) => ({ ...item.chunk, score }));
}

/**
 * Най-добрите парчета, които се побират в бюджета от знаци. Парчетата от
 * главата, която потребителят чете, излизат първи.
 */
export function selectWithinBudget(
  ranked: RankedChunk[],
  options: {
    budget?: number;
    maxChunks?: number;
    current?: { module: string; chapter: string };
  } = {},
): RankedChunk[] {
  const budget = options.budget ?? EXCERPT_BUDGET;
  const maxChunks = options.maxChunks ?? MAX_PROMPT_CHUNKS;
  const picked: RankedChunk[] = [];
  let used = 0;
  for (const chunk of ranked) {
    if (picked.length >= maxChunks) break;
    const text = cleanChunkText(chunk.text);
    if (picked.length === 0 && text.length > budget) {
      picked.push({ ...chunk, text: trimToBlocks(text, [], budget) });
      break;
    }
    if (used + text.length > budget) continue;
    picked.push({ ...chunk, text });
    used += text.length;
  }
  const isCurrent = (chunk: Chunk) =>
    options.current !== undefined &&
    chunk.moduleSlug === options.current.module &&
    chunk.chapterSlug === options.current.chapter;
  return [...picked.filter(isCurrent), ...picked.filter((c) => !isCurrent(c))];
}

/** Началото на главата, която се чете – когато въпросът е „обясни това“. */
export function currentChapterChunks(
  chunks: Chunk[],
  current: { module: string; chapter: string },
  mode: ContentMode,
): RankedChunk[] {
  const mine = chunks.filter(
    (chunk) =>
      chunk.moduleSlug === current.module &&
      chunk.chapterSlug === current.chapter &&
      chunk.sectionId !== "proveri",
  );
  const inMode = mine.filter((chunk) => chunk.mode === mode);
  return (inMode.length > 0 ? inMode : mine).map((chunk) => ({
    ...chunk,
    score: 0,
  }));
}

// ------------------------------------------------------------ откъси

const FIGURE_LINE = /^\s*!\[[^\]]*\]\(figure:[^)]*\)\s*$/;
const FIGURE_NOTE = "*(виж фигурата в главата)*";

/**
 * Подготвя парче за показване: маха отговорите на въпросите (:::answer), за
 * да не се издават, и заменя фигурите с бележка.
 */
export function cleanChunkText(text: string): string {
  const out: string[] = [];
  // дълбочина на отворените :::блокове; -1 = не сме в :::answer
  const open: number[] = [];
  let answerDepth = -1;
  for (const line of text.split("\n")) {
    const opener = /^(:{3,})\s*([a-z]+)/.exec(line);
    const closer = /^(:{3,})\s*$/.exec(line);
    if (opener) {
      open.push(opener[1]!.length);
      if (opener[2] === "answer" && answerDepth < 0) answerDepth = open.length;
    }
    const hidden = answerDepth >= 0;
    if (closer && open.length > 0) {
      if (open.length === answerDepth) answerDepth = -1;
      open.pop();
    }
    if (hidden) continue;
    out.push(FIGURE_LINE.test(line) ? FIGURE_NOTE : line);
  }
  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Разделя текста на абзаци, без да реже формула $$…$$, :::блок или код. */
export function splitBlocks(text: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let depth = 0;
  let inMath = false;
  let inFence = false;
  for (const line of text.split("\n")) {
    if (FENCE.test(line)) inFence = !inFence;
    if (!inFence) {
      if (/^:{3,}\s*[a-z]+/.test(line)) depth += 1;
      else if (/^:{3,}\s*$/.test(line) && depth > 0) depth -= 1;
      if ((line.split("$$").length - 1) % 2 === 1) inMath = !inMath;
    }
    const closedHere = /^:{3,}\s*$/.test(line);
    if (line.trim() === "" && depth === 0 && !inMath && !inFence) {
      if (current.length > 0) blocks.push(current.join("\n"));
      current = [];
      continue;
    }
    current.push(line);
    if (closedHere && depth === 0 && !inMath && !inFence) {
      blocks.push(current.join("\n"));
      current = [];
    }
  }
  if (current.length > 0) blocks.push(current.join("\n"));
  return blocks;
}

function trimToBlocks(text: string, stems: string[], maxChars: number): string {
  const blocks = splitBlocks(text);
  if (blocks.length === 0) return "";
  const wanted = new Set(stems);
  const hits = blocks.map((block) => {
    if (wanted.size === 0) return 0;
    const inBold = new Set(
      [...block.matchAll(/\*\*([^*\n]+)\*\*/g)].flatMap((m) => tokenize(m[1]!)),
    );
    const present = new Set(tokenize(block));
    let value = 0;
    for (const item of wanted) {
      if (present.has(item)) value += 1;
      if (inBold.has(item)) value += 1.5;
    }
    return value;
  });

  // започваме от абзаца, който най-добре отговаря на въпроса
  let start = 0;
  hits.forEach((value, i) => {
    if (value > hits[start]!) start = i;
  });
  // списък без изречението, което го въвежда, не се разбира
  if (
    start > 0 &&
    /^\s*([-*]|\d+\.)\s/.test(blocks[start]!) &&
    /[^:]:\s*$/.test(blocks[start - 1]!)
  ) {
    start -= 1;
  }

  const picked = [blocks[start]!];
  let length = picked[0]!.length;
  for (let i = start + 1; i < blocks.length; i++) {
    if (length + blocks[i]!.length + 2 > maxChars) break;
    picked.push(blocks[i]!);
    length += blocks[i]!.length + 2;
  }
  // не свършваме с „…са три:“ без самия списък
  while (picked.length > 1 && /[^:]:\s*$/.test(picked[picked.length - 1]!)) {
    picked.pop();
  }
  return picked.join("\n\n");
}

/**
 * Откъс за показване: изчистеният текст на парчето, скъсен до maxChars на
 * границите на абзаците, започвайки от най-подходящия абзац.
 */
export function makeExcerpt(
  text: string,
  question: string,
  synonyms: SynonymIndex = EMPTY_SYNONYMS,
  maxChars: number = LESSON_EXCERPT_CHARS,
): string {
  const stems = buildUnits(question, synonyms, 1, true).flatMap((unit) =>
    unit.alternatives.flat(),
  );
  return trimToBlocks(cleanChunkText(text), stems, maxChars);
}

export type ChapterInfo = {
  moduleSlug: string;
  chapterSlug: string;
  number: number;
  title: string;
  summary: string;
};

/** Главите, чието заглавие или резюме е най-близо до въпроса. */
export function relatedChapters(
  question: string,
  chapters: ChapterInfo[],
  synonyms: SynonymIndex = EMPTY_SYNONYMS,
  limit = 3,
): ChapterInfo[] {
  const units = buildUnits(question, synonyms, 1, true);
  return chapters
    .map((chapter) => {
      const title = new Set(tokenize(chapter.title));
      const all = new Set([...title, ...tokenize(chapter.summary)]);
      let score = 0;
      for (const unit of units) {
        if (unit.alternatives.some((alt) => hasAll(title, alt))) score += 2;
        else if (unit.alternatives.some((alt) => hasAll(all, alt))) score += 1;
      }
      return { chapter, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.chapter.number - b.chapter.number)
    .slice(0, limit)
    .map((entry) => entry.chapter);
}

// ---------------------------------------------------------- оцветяване

/** Най-много толкова израза се оцветяват в един откъс. */
const MAX_HIGHLIGHTS = 12;

/**
 * Думите и изразите от откъса, които отговарят на въпроса – точно както са
 * написани в текста („съпротивителният момент“, „центъра на тежестта“), за да
 * ги оцвети панелът. Формулите и кодът не се гледат.
 */
export function highlightTerms(
  markdown: string,
  question: string,
  synonyms: SynonymIndex = EMPTY_SYNONYMS,
): string[] {
  const phrases = buildUnits(question, synonyms, 1, true)
    .flatMap((unit) => unit.alternatives)
    // най-дългите първи: „инерционен момент“ преди „момент“
    .sort((a, b) => b.length - a.length);
  if (phrases.length === 0) return [];

  // формулите и кодът стават интервали – местата на думите се запазват
  const text = markdown.replace(
    /\$\$[\s\S]*?\$\$|\$[^$\n]*\$|`[^`\n]*`/g,
    (m) => " ".repeat(m.length),
  );
  const words: { start: number; end: number; stem: string }[] = [];
  for (const match of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const value = stem(match[0].toLowerCase());
    if (!value) continue;
    words.push({
      start: match.index,
      end: match.index + match[0].length,
      stem: value,
    });
  }

  const found = new Map<string, string>();
  const used = new Array<boolean>(words.length).fill(false);
  for (const phrase of phrases) {
    for (let at = 0; at + phrase.length <= words.length; at++) {
      if (!phrase.every((value, i) => words[at + i]!.stem === value)) continue;
      if (used.slice(at, at + phrase.length).some(Boolean)) continue;
      const surface = text.slice(
        words[at]!.start,
        words[at + phrase.length - 1]!.end,
      );
      // между думите на израза може да има само „на“, „за“ и интервали
      if (!/^[\p{L}\p{N} -]+$/u.test(surface) || surface.length > 60) continue;
      for (let i = at; i < at + phrase.length; i++) used[i] = true;
      found.set(surface.toLowerCase(), surface);
    }
  }
  return [...found.values()]
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_HIGHLIGHTS);
}

// ------------------------------------------------- предложени въпроси

const QUESTION_HEADING = /^(какво|какъв|каква|какви)\s+(е|са)\s/i;

export type SuggestedQuestion = {
  question: string;
  moduleSlug: string;
  chapterSlug: string;
};

/**
 * Готови въпроси от главите, които потребителят може да чете: подсекциите
 * на „Разбери“, чието заглавие е термин, въведен с удебелен текст в тях
 * („Закон на Хук“ → „Какво означава „закон на Хук“?“). Първи са въпросите
 * от главата, която се чете, после от нейния модул, после от останалите –
 * по един на глава. „seed“ сменя кои точно се падат.
 */
export function suggestQuestions(
  chunks: Chunk[],
  options: {
    current?: { module: string; chapter: string };
    preferredMode?: ContentMode;
    limit?: number;
    seed?: number;
  } = {},
): SuggestedQuestion[] {
  const mode = options.preferredMode ?? "easy";
  const limit = options.limit ?? 3;
  const seed = Math.abs(Math.trunc(options.seed ?? 0));
  const { current } = options;

  // основите на всички думи, които учебникът пише с малка буква
  const ordinary = new Set<string>();
  for (const chunk of chunks) {
    for (const word of chunk.text.match(/\p{Ll}[\p{L}\p{N}]*/gu) ?? []) {
      const value = stem(word);
      if (value) ordinary.add(value);
    }
  }

  const byChapter = new Map<string, SuggestedQuestion[]>();
  const seen = new Set<string>();
  for (const chunk of chunks) {
    if (chunk.mode !== mode || chunk.sectionId !== "razberi") continue;
    const heading = chunk.subsectionTitle;
    if (!heading) continue;
    const stems = tokenize(heading);
    if (stems.length === 0 || stems.length > MAX_NOTION_WORDS) continue;
    if (stems.every((value) => GENERIC_WORDS.has(value))) continue;
    const term = [...chunk.text.matchAll(/\*\*([^*\n]+)\*\*/g)]
      .map((match) => match[1]!)
      .find((raw) => sameStems(tokenize(raw), stems));
    if (!term) continue;
    // Главната буква остава само при име („Ритеров разрез“): ако първата
    // дума я има и с малка буква някъде в учебника, значи е обикновена дума.
    const first = /^[\p{L}\p{N}]+/u.exec(heading)?.[0] ?? "";
    const lowered = first.toLowerCase();
    const firstStem = stem(lowered);
    const isName = firstStem !== null && !ordinary.has(firstStem);
    const name = isName ? heading : lowered + heading.slice(first.length);
    // „Какво е герберова греда“ вече е въпрос
    const question = QUESTION_HEADING.test(heading)
      ? `${heading}?`
      : `Какво означава „${name}“?`;
    if (seen.has(question.toLowerCase())) continue;
    seen.add(question.toLowerCase());
    const key = `${chunk.moduleSlug}/${chunk.chapterSlug}`;
    byChapter.set(key, [
      ...(byChapter.get(key) ?? []),
      {
        question,
        moduleSlug: chunk.moduleSlug,
        chapterSlug: chunk.chapterSlug,
      },
    ]);
  }

  const currentKey = current ? `${current.module}/${current.chapter}` : null;
  const mine = currentKey ? (byChapter.get(currentKey) ?? []) : [];
  const others = [...byChapter.entries()]
    .filter(([key]) => key !== currentKey)
    .map(([, list]) => list);
  const sameModule = others.filter(
    (list) => current && list[0]!.moduleSlug === current.module,
  );
  const rest = others.filter((list) => !sameModule.includes(list));
  // от коя глава да започне редът – за да не са все едни и същи
  const rotate = <T>(list: T[]) =>
    list.map((_, i) => list[(seed + i) % list.length]!);
  const order = [...rotate(sameModule), ...rotate(rest), mine];

  const picked: SuggestedQuestion[] = [];
  const taken = new Map<SuggestedQuestion[], number>();
  const take = (list: SuggestedQuestion[]) => {
    const count = taken.get(list) ?? 0;
    if (count >= list.length || picked.length >= limit) return false;
    picked.push(list[(seed + count) % list.length]!);
    taken.set(list, count + 1);
    return true;
  };
  // от главата, която се чете – два, за да остане място и за други глави;
  // после по един на глава, докато се събере исканият брой
  take(mine);
  take(mine);
  for (let added = true; added && picked.length < limit;) {
    added = false;
    for (const list of order) added = take(list) || added;
  }
  return picked;
}
