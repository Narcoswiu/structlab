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
  дай дайте кажи намери напиши покажи разкажи реши
  the and for with what how why`
    .split(/\s+/)
    .filter(Boolean),
);

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

function indexChunk(chunk: Chunk): IndexedChunk {
  const stems = tokenize(chunk.text);
  const counts = new Map<string, number>();
  const bigrams = new Set<string>();
  stems.forEach((value, i) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
    if (i > 0) bigrams.add(`${stems[i - 1]} ${value}`);
  });
  const bold = [...chunk.text.matchAll(/\*\*([^*\n]+)\*\*/g)].map(
    (match) => new Set(tokenize(match[1]!)),
  );
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
  // най-рядката намерена.
  const idf = units.map((unit, u) => {
    if (found[u]! > 0) return rarity(found[u]!);
    return unit.isTerm ? rarity(0) : Math.min(rarity(0), knownMax);
  });
  const total = units.reduce(
    (sum, unit, u) => sum + (unit.counts ? idf[u]! : 0),
    0,
  );
  if (total === 0) return [];

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

  let scored = items.map((item, i) => {
    let score = 0;
    let covered = 0;
    let distinctive = false;
    units.forEach((unit, u) => {
      const strength = strengths[u]![i]!;
      if (strength === 0) return;
      score += unit.weight * idf[u]! * strength;
      if (!unit.counts) return;
      covered += idf[u]!;
      // дума, която я има в повече от половината парчета, не отличава нищо
      if (found[u]! <= items.length / 2) distinctive = true;
    });
    const coverage = covered / total;
    if (!distinctive || coverage < MIN_COVERAGE) return { item, score: 0 };

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
    if (
      options.current &&
      chunk.moduleSlug === options.current.module &&
      chunk.chapterSlug === options.current.chapter
    ) {
      score *= 1.5;
    }
    return { item, score };
  });
  scored = scored.filter((entry) => entry.score > 0);

  // „Леко“ и „Подробно“ имат едни и същи секции: от всяка глава остава само
  // единият режим – този на потребителя, освен ако другият е много по-добър.
  const bestByChapter = new Map<string, { mine: number; other: number }>();
  const chapterKey = (chunk: Chunk) =>
    `${chunk.moduleSlug}/${chunk.chapterSlug}`;
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
