"use client";

import { useMemo, useState } from "react";
import {
  renderBucklingCurveFigure,
  renderBucklingModeFigure,
} from "@/lib/content/buckling-figure";
import { isSafeSvg } from "@/lib/content/svg";
import { effectiveLengthFactor } from "@/lib/engineering/buckling";
import {
  bucklingPresets,
  bucklingSupports,
  solveBuckling,
  type BucklingInput,
  type BucklingSectionKind,
} from "@/lib/labs/buckling";
import { labNumber } from "@/lib/labs/format";
import { cn } from "@/lib/utils";
import {
  LabChoice,
  LabFigure,
  LabPresets,
  LabResults,
  LabSteps,
  LabVerdict,
} from "./LabParts";
import { NumberField } from "./NumberField";

const sections: { id: BucklingSectionKind; label: string }[] = [
  { id: "rect", label: "Правоъгълник" },
  { id: "circle", label: "Кръг" },
  { id: "tube", label: "Тръба" },
];

// схемите не зависят от данните – чертаят се веднъж
const supportCards = bucklingSupports.map((support) => ({
  ...support,
  mu: effectiveLengthFactor(support.id),
  svg: renderBucklingModeFigure(support.id, `Схема: ${support.shape}`),
}));

const one = (value: number) => labNumber(Math.round(value * 10) / 10);

export function BucklingLab() {
  const [input, setInput] = useState<BucklingInput>(bucklingPresets[0]!.input);
  const set = (patch: Partial<BucklingInput>) =>
    setInput((current) => ({ ...current, ...patch }));

  const solution = useMemo(() => {
    const solved = solveBuckling(input);
    if (!solved.ok) return solved;
    return {
      ...solved,
      svg: renderBucklingCurveFigure({
        title: `Критичното напрежение според гъвкавостта: гранична гъвкавост ${one(solved.lambdaLimit)}. Прътът е с гъвкавост ${one(solved.lambda)} – ${solved.valid ? `в областта на Ойлер, критично напрежение ${one(solved.sigmaFormula)} MPa` : "извън областта на Ойлер, формулата не важи"}.`,
        E: input.E,
        sigmaP: input.sigmaP,
        lambda: solved.lambda,
      }),
    };
  }, [input]);

  function changeSection(section: BucklingSectionKind) {
    setInput((current) => ({
      ...current,
      section,
      // тръбата иска вътрешен диаметър, по-малък от външния
      d:
        section === "tube" && !(current.d < current.D)
          ? Math.round(current.D * 8) / 10
          : current.d,
    }));
  }

  const size = (label: string, key: "b" | "h" | "D" | "d") => (
    <NumberField
      explain
      label={label}
      unit="cm"
      value={input[key]}
      min={0.1}
      max={500}
      onChange={(value) => set({ [key]: value })}
      className="flex-[1_1_130px]"
    />
  );

  return (
    <div className="lab flex flex-col gap-6">
      <LabPresets presets={bucklingPresets} onPick={setInput} />

      <div className="flex flex-wrap items-start gap-6">
        <section
          aria-label="Данни"
          className="sl-card flex min-w-0 flex-[1_1_320px] flex-col gap-5"
        >
          <fieldset className="flex min-w-0 flex-col gap-3">
            <legend className="mb-3 text-lg font-extrabold">Подпиране</legend>
            <div className="grid grid-cols-2 gap-2">
              {supportCards.map((support) => {
                const checked = input.support === support.id;
                return (
                  <label
                    key={support.id}
                    className={cn(
                      "flex min-h-11 cursor-pointer flex-col gap-2 rounded-xl border p-3",
                      checked
                        ? "border-primary bg-surface-2"
                        : "border-line-strong",
                    )}
                  >
                    <span className="flex items-start gap-2 text-sm leading-snug font-bold">
                      <input
                        type="radio"
                        name="buckling-support"
                        checked={checked}
                        onChange={() => set({ support: support.id })}
                        className="mt-0.5 size-5 flex-none accent-(--sl-blue)"
                      />
                      <span>{support.label}</span>
                    </span>
                    {isSafeSvg(support.svg) ? (
                      <span
                        className="mx-auto block w-[72px] [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
                        dangerouslySetInnerHTML={{ __html: support.svg }}
                      />
                    ) : null}
                    <span className="text-center font-mono text-sm">
                      μ = {labNumber(support.mu)}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-extrabold">Прът</h2>
            <NumberField
              explain
              label="Дължина l"
              unit="m"
              value={input.l}
              min={0.01}
              max={100}
              onChange={(l) => set({ l })}
            />
            <LabChoice
              label="Вид на сечението"
              options={sections}
              value={input.section}
              onChange={changeSection}
            />
            <div className="flex flex-wrap gap-3">
              {input.section === "rect" ? (
                <>
                  {size("Страна b", "b")}
                  {size("Страна h", "h")}
                </>
              ) : input.section === "circle" ? (
                size("Диаметър d", "D")
              ) : (
                <>
                  {size("Външен диаметър D", "D")}
                  {size("Вътрешен диаметър d", "d")}
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-extrabold">Материал</h2>
            <NumberField
              explain
              label="Модул на еластичност E"
              unit="kN/cm²"
              value={input.E}
              min={1}
              max={100000}
              onChange={(E) => set({ E })}
            />
            <NumberField
              explain
              label="σ_p – граница на пропорционалност – по условието"
              unit="MPa"
              value={input.sigmaP}
              min={1}
              max={2000}
              onChange={(sigmaP) => set({ sigmaP })}
            />
            <NumberField
              explain
              label="Коефициент на сигурност n – по условието"
              value={input.safety}
              min={1}
              max={100}
              onChange={(safety) => set({ safety })}
            />
            <p className="text-sm leading-normal text-dim">
              E = 21 000 kN/cm² е за стомана. σ_p и n идват от условието на
              твоята задача.
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
              <LabVerdict ok={solution.valid} text={solution.verdict} />
              <LabFigure svg={solution.svg} />
              <LabResults results={solution.results} />
              <LabSteps steps={solution.steps} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
