"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { figureNumber } from "@/lib/content/beam-figure";
import { renderSectionFigure } from "@/lib/content/section-figure";
import {
  findOverlap,
  sectionProperties,
  steinerTable,
  type Rect,
} from "@/lib/engineering/section";
import { NumberField } from "./NumberField";

type LabRect = Rect & { id: number };

// Готови примери – същите сечения като в Глава 2 на учебника.
const presets: { label: string; rects: LabRect[] }[] = [
  {
    label: "Сечение „Т“",
    rects: [
      { id: 1, b: 2, h: 10, x: 5, y: 0 },
      { id: 2, b: 12, h: 2, x: 0, y: 10 },
    ],
  },
  {
    label: "Сечение „Г“",
    rects: [
      { id: 1, b: 2, h: 10, x: 0, y: 0 },
      { id: 2, b: 6, h: 2, x: 2, y: 0 },
    ],
  },
  {
    label: "Двойно „Т“",
    rects: [
      { id: 1, b: 12, h: 2, x: 0, y: 0 },
      { id: 2, b: 2, h: 12, x: 5, y: 2 },
      { id: 3, b: 12, h: 2, x: 0, y: 14 },
    ],
  },
  {
    label: "Кухо сечение",
    rects: [
      { id: 1, b: 10, h: 16, x: 0, y: 0 },
      { id: 2, b: 6, h: 12, x: 2, y: 2, hole: true },
    ],
  },
];

const MAX_RECTS = 8;
const MAX_SIZE = 500;

const fmt = (value: number, unit: string) => `${figureNumber(value)} ${unit}`;

export function SectionLab() {
  const [rects, setRects] = useState<LabRect[]>(presets[0]!.rects);
  const [nextId, setNextId] = useState(10);
  const [showTable, setShowTable] = useState(false);

  const solution = useMemo(() => {
    const plain: Rect[] = rects.map(({ b, h, x, y, hole }) => ({
      b,
      h,
      x,
      y,
      hole,
    }));
    if (plain.length === 0)
      return { ok: false, problem: "Добави поне един правоъгълник." } as const;
    try {
      const props = sectionProperties(plain);
      const overlap = findOverlap(plain);
      const asymmetric = Math.abs(props.Ixy) > 1e-6;
      return {
        ok: true,
        props,
        rows: steinerTable(plain),
        overlap,
        asymmetric,
        svg: renderSectionFigure(plain, {
          title: "Сечението с центъра на тежестта и осите",
          principal: asymmetric,
        }),
      } as const;
    } catch {
      return {
        ok: false,
        problem: "Плътната площ трябва да е по-голяма от площта на отворите.",
      } as const;
    }
  }, [rects]);

  function update(id: number, patch: Partial<Rect>) {
    setRects((current) =>
      current.map((rect) => (rect.id === id ? { ...rect, ...patch } : rect)),
    );
  }

  function add() {
    const top = rects.length
      ? Math.max(...rects.filter((r) => !r.hole).map((r) => r.y + r.h), 0)
      : 0;
    setRects((current) => [
      ...current,
      { id: nextId, b: 4, h: 2, x: 0, y: top },
    ]);
    setNextId(nextId + 1);
  }

  const results = solution.ok
    ? [
        { name: "Площ A", value: fmt(solution.props.A, "cm²") },
        {
          name: "Център на тежестта",
          value: `x = ${figureNumber(solution.props.xc)}; y = ${figureNumber(solution.props.yc)} cm`,
        },
        { name: "I_x", value: fmt(solution.props.Ix, "cm⁴") },
        { name: "I_y", value: fmt(solution.props.Iy, "cm⁴") },
        { name: "I_xy", value: fmt(solution.props.Ixy, "cm⁴") },
        { name: "I_1", value: fmt(solution.props.I1, "cm⁴") },
        { name: "I_2", value: fmt(solution.props.I2, "cm⁴") },
        { name: "Ъгъл α", value: `${figureNumber(solution.props.alpha)}°` },
        { name: "W_x горе", value: fmt(solution.props.WxTop, "cm³") },
        { name: "W_x долу", value: fmt(solution.props.WxBottom, "cm³") },
        { name: "i_x", value: fmt(solution.props.ix, "cm") },
        { name: "i_y", value: fmt(solution.props.iy, "cm") },
      ]
    : [];

  return (
    <div className="lab flex flex-col gap-6">
      <section
        aria-label="Готови примери"
        className="flex flex-wrap items-center gap-2"
      >
        <span className="text-sm font-bold text-dim">Примери от учебника:</span>
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            onClick={() => setRects(preset.rects)}
          >
            {preset.label}
          </Button>
        ))}
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <section
          aria-label="Правоъгълници"
          className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 rounded-2xl border border-line bg-surface p-5"
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-extrabold">Правоъгълници</h2>
            <p className="text-sm leading-normal text-dim">
              x и y са координатите на долния ляв ъгъл. Всички размери са в cm.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {rects.map((rect, index) => (
              <li
                key={rect.id}
                className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">
                    {index + 1}. {rect.hole ? "Отвор" : "Правоъгълник"}
                  </span>
                  <Button
                    variant="ghost"
                    aria-label={`Премахни правоъгълник ${index + 1}`}
                    className="px-2.5"
                    onClick={() =>
                      setRects((current) =>
                        current.filter((item) => item.id !== rect.id),
                      )
                    }
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-3">
                  <NumberField
                    label={`b${index + 1} (ширина)`}
                    unit="cm"
                    value={rect.b}
                    min={0.01}
                    max={MAX_SIZE}
                    onChange={(b) => update(rect.id, { b })}
                    className="flex-[1_1_80px]"
                  />
                  <NumberField
                    label={`h${index + 1} (височина)`}
                    unit="cm"
                    value={rect.h}
                    min={0.01}
                    max={MAX_SIZE}
                    onChange={(h) => update(rect.id, { h })}
                    className="flex-[1_1_80px]"
                  />
                  <NumberField
                    label={`x${index + 1}`}
                    unit="cm"
                    value={rect.x}
                    min={-MAX_SIZE}
                    max={MAX_SIZE}
                    onChange={(x) => update(rect.id, { x })}
                    className="flex-[1_1_70px]"
                  />
                  <NumberField
                    label={`y${index + 1}`}
                    unit="cm"
                    value={rect.y}
                    min={-MAX_SIZE}
                    max={MAX_SIZE}
                    onChange={(y) => update(rect.id, { y })}
                    className="flex-[1_1_70px]"
                  />
                </div>
                <label className="flex min-h-11 items-center gap-3 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={rect.hole === true}
                    onChange={(event) =>
                      update(rect.id, { hole: event.target.checked })
                    }
                    className="size-5 flex-none accent-(--sl-blue)"
                  />
                  Това е отвор (изважда се)
                </label>
              </li>
            ))}
          </ul>
          {rects.length < MAX_RECTS ? (
            <Button variant="outline" className="self-start" onClick={add}>
              <Plus aria-hidden="true" className="size-4" />
              Правоъгълник
            </Button>
          ) : (
            <p className="text-sm text-dim">
              Най-много {MAX_RECTS} правоъгълника.
            </p>
          )}
        </section>

        <section
          aria-label="Резултат"
          aria-live="polite"
          className="flex min-w-0 flex-[2_1_420px] flex-col gap-4"
        >
          {!solution.ok ? (
            <p role="alert" className="rounded-2xl bg-warn-bg p-5 text-warn-fg">
              {solution.problem}
            </p>
          ) : (
            <>
              {solution.overlap ? (
                <p
                  role="alert"
                  className="rounded-2xl bg-warn-bg p-5 text-warn-fg"
                >
                  Правоъгълници {solution.overlap[0] + 1} и{" "}
                  {solution.overlap[1] + 1} се застъпват. Общата им площ се брои
                  два пъти и резултатите са грешни – раздели сечението на части
                  без застъпване.
                </p>
              ) : null}
              <div
                className="rounded-2xl border border-line bg-surface p-4 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: solution.svg }}
              />
              <dl className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                {results.map((item) => (
                  <div
                    key={item.name}
                    className="flex flex-col gap-1 rounded-xl bg-surface-2 p-4"
                  >
                    <dt className="text-xs text-dim">{item.name}</dt>
                    <dd className="font-mono text-[15px]">{item.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm leading-normal text-dim">
                {solution.asymmetric
                  ? "Сечението няма ос на симетрия по x или y: главните оси 1 и 2 са завъртени на ъгъл α спрямо x (обратно на часовниковата стрелка при положителна стойност)."
                  : "I_xy = 0: осите x и y са главни."}
              </p>

              <Button
                variant="outline"
                aria-expanded={showTable}
                className="self-start"
                onClick={() => setShowTable((value) => !value)}
              >
                {showTable
                  ? "Скрий таблицата на Щайнер"
                  : "Покажи таблицата на Щайнер"}
              </Button>
              {showTable ? (
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Таблица на Щайнер"
                  className="overflow-x-auto rounded-2xl border border-line bg-surface p-4"
                >
                  <table className="w-full border-collapse font-mono text-sm">
                    <thead>
                      <tr>
                        {[
                          "№",
                          "A, cm²",
                          "x, cm",
                          "y, cm",
                          "I_x собств.",
                          "I_y собств.",
                          "d_x",
                          "d_y",
                          "A·d_y²",
                          "A·d_x²",
                          "A·d_x·d_y",
                        ].map((head) => (
                          <th
                            key={head}
                            scope="col"
                            className="border border-line bg-surface-2 px-2.5 py-2 text-left font-bold whitespace-nowrap"
                          >
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {solution.rows.map((row, index) => (
                        <tr key={index}>
                          {[
                            String(index + 1),
                            figureNumber(row.A),
                            figureNumber(row.x),
                            figureNumber(row.y),
                            figureNumber(row.IxOwn),
                            figureNumber(row.IyOwn),
                            figureNumber(row.dx),
                            figureNumber(row.dy),
                            figureNumber(row.AdY2),
                            figureNumber(row.AdX2),
                            figureNumber(row.AdXdY),
                          ].map((cell, cellIndex) => (
                            <td
                              key={cellIndex}
                              className="border border-line px-2.5 py-2 whitespace-nowrap"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-3 font-sans text-sm leading-normal text-dim">
                    I_x = Σ(I_x собств. + A·d_y²); I_y = Σ(I_y собств. +
                    A·d_x²); I_xy = Σ A·d_x·d_y. Отворите участват с отрицателна
                    площ.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
