"use client";

import { useMemo, useState } from "react";
import { renderBendingStressFigure } from "@/lib/content/bending-figure";
import { renderShearStressFigure } from "@/lib/content/shear-figure";
import { labNumber } from "@/lib/labs/format";
import {
  solveStresses,
  stressPresets,
  type StressInput,
  type StressSectionKind,
} from "@/lib/labs/stresses";
import {
  LabChoice,
  LabFigure,
  LabPresets,
  LabResults,
  LabSteps,
} from "./LabParts";
import { NumberField } from "./NumberField";

const kinds: { id: StressSectionKind; label: string }[] = [
  { id: "rect", label: "Правоъгълник" },
  { id: "tee", label: "Сечение „Т“" },
  { id: "ibeam", label: "Сечение „I“" },
];

const MIN_SIZE = 0.1;
const MAX_SIZE = 500;
const MAX_LOAD = 10000;

export function StressLab() {
  const [input, setInput] = useState<StressInput>(stressPresets[0]!.input);
  const set = (patch: Partial<StressInput>) =>
    setInput((current) => ({ ...current, ...patch }));

  const solution = useMemo(() => {
    const solved = solveStresses(input);
    if (!solved.ok) return solved;
    return {
      ...solved,
      sigmaSvg:
        input.M === 0
          ? null
          : renderBendingStressFigure({
              title: `Сечението с неутралната ос и диаграмата на нормалните напрежения: най-голям опън ${labNumber(solved.maxTension)} MPa, най-голям натиск ${labNumber(solved.maxCompression)} MPa`,
              section: solved.rects,
              M: input.M,
            }),
      tauSvg:
        input.Q === 0
          ? null
          : renderShearStressFigure({
              title: `Сечението и диаграмата на тангенциалните напрежения: най-голямо ${labNumber(solved.tauMax)} MPa ${solved.tauAtNeutralAxis ? "на неутралната ос" : `на ${labNumber(solved.tauY)} cm над долния ръб`}`,
              section: solved.rects,
              Q: input.Q,
            }),
    };
  }, [input]);

  const size = (label: string, key: "b" | "h" | "bf" | "tf" | "tw" | "hw") => (
    <NumberField
      explain
      label={label}
      unit="cm"
      value={input[key]}
      min={MIN_SIZE}
      max={MAX_SIZE}
      onChange={(value) => set({ [key]: value })}
      className="flex-[1_1_130px]"
    />
  );

  return (
    <div className="lab flex flex-col gap-6">
      <LabPresets presets={stressPresets} onPick={setInput} />

      <div className="flex flex-wrap items-start gap-6">
        <section
          aria-label="Данни"
          className="sl-card flex min-w-0 flex-[1_1_320px] flex-col gap-5"
        >
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-extrabold">Сечение</h2>
            <LabChoice
              label="Вид на сечението"
              options={kinds}
              value={input.kind}
              onChange={(kind) => set({ kind })}
            />
            <div className="flex flex-wrap gap-3">
              {input.kind === "rect" ? (
                <>
                  {size("Ширина b", "b")}
                  {size("Височина h", "h")}
                </>
              ) : (
                <>
                  {size("Ширина на пояса", "bf")}
                  {size("Дебелина на пояса", "tf")}
                  {size("Дебелина на стеблото", "tw")}
                  {size("Височина на стеблото", "hw")}
                </>
              )}
            </div>
            <p className="text-sm leading-normal text-dim">
              {input.kind === "tee"
                ? "Поясът е горе, стеблото – под него. Сечението се огъва около хоризонталната ос x."
                : input.kind === "ibeam"
                  ? "Двата пояса са еднакви. Сечението се огъва около хоризонталната ос x."
                  : "Сечението се огъва около хоризонталната ос x."}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-extrabold">Разрезни усилия</h2>
            <div className="flex flex-wrap gap-3">
              <NumberField
                explain
                label="Огъващ момент M"
                unit="kN·m"
                value={input.M}
                min={-MAX_LOAD}
                max={MAX_LOAD}
                onChange={(M) => set({ M })}
                className="flex-[1_1_130px]"
              />
              <NumberField
                explain
                label="Напречна сила Q"
                unit="kN"
                value={input.Q}
                min={-MAX_LOAD}
                max={MAX_LOAD}
                onChange={(Q) => set({ Q })}
                className="flex-[1_1_130px]"
              />
            </div>
            <p className="text-sm leading-normal text-dim">
              Положителен M опъва долните влакна. Знакът на Q не променя
              големината на τ.
            </p>
          </div>
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
              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-bold text-dim">
                  Нормални напрежения σ – формула на Навие
                </h2>
                {solution.sigmaSvg ? (
                  <LabFigure svg={solution.sigmaSvg} />
                ) : (
                  <p className="sl-card text-muted-foreground">
                    M = 0 – няма нормални напрежения от огъване.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-bold text-dim">
                  Тангенциални напрежения τ – формула на Журавски
                </h2>
                {solution.tauSvg ? (
                  <LabFigure svg={solution.tauSvg} />
                ) : (
                  <p className="sl-card text-muted-foreground">
                    Q = 0 – няма тангенциални напрежения.
                  </p>
                )}
              </div>
              <LabResults results={solution.results} />
              <LabSteps steps={solution.steps} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
