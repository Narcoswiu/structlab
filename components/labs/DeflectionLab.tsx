"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { renderDeflectionFigure } from "@/lib/content/deflection-figure";
import {
  deflectionPresets,
  deflectionSchemes,
  E_STEEL,
  E_TIMBER_EXAMPLE,
  solveDeflection,
  type DeflectionInput,
} from "@/lib/labs/deflection";
import { labNumber } from "@/lib/labs/format";
import {
  LabChoice,
  LabFigure,
  LabPresets,
  LabResults,
  LabSteps,
  LabVerdict,
} from "./LabParts";
import { NumberField } from "./NumberField";

const inertiaModes: { id: DeflectionInput["inertiaFrom"]; label: string }[] = [
  { id: "rect", label: "Правоъгълник b×h" },
  { id: "value", label: "Въвеждам I_x" },
];

const materials = [
  { E: E_STEEL, label: "Стомана – 21 000" },
  { E: E_TIMBER_EXAMPLE, label: "Дърво – 1 100 (примерна стойност)" },
];

export function DeflectionLab() {
  const [input, setInput] = useState<DeflectionInput>(
    deflectionPresets[0]!.input,
  );
  const set = (patch: Partial<DeflectionInput>) =>
    setInput((current) => ({ ...current, ...patch }));
  const scheme =
    deflectionSchemes.find((item) => item.id === input.scheme) ??
    deflectionSchemes[0]!;

  const solution = useMemo(() => {
    const solved = solveDeflection(input);
    if (!solved.ok) return solved;
    const current =
      deflectionSchemes.find((item) => item.id === input.scheme) ??
      deflectionSchemes[0]!;
    return {
      ...solved,
      svg: renderDeflectionFigure({
        title: `${current.label}: l = ${labNumber(input.l)} m, ${current.loadSymbol} = ${labNumber(input.load)} ${current.loadUnit}. Най-голямо провисване ${labNumber(solved.fMm)} mm ${current.fWhere}. Провисването е начертано увеличено.`,
        scheme: input.scheme,
        l: input.l,
        load: input.load,
        EI: solved.EI,
      }),
    };
  }, [input]);

  return (
    <div className="lab flex flex-col gap-6">
      <LabPresets presets={deflectionPresets} onPick={setInput} />

      <div className="flex flex-wrap items-start gap-6">
        <section
          aria-label="Данни"
          className="sl-card flex min-w-0 flex-[1_1_320px] flex-col gap-5"
        >
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-extrabold">Схема и товар</h2>
            <LabChoice
              label="Схема"
              options={deflectionSchemes}
              value={input.scheme}
              onChange={(next) => set({ scheme: next })}
            />
            <div className="flex flex-wrap gap-3">
              <NumberField
                explain
                label={
                  input.scheme.startsWith("cantilever")
                    ? "Дължина l"
                    : "Отвор l"
                }
                unit="m"
                value={input.l}
                min={0.1}
                max={50}
                onChange={(l) => set({ l })}
                className="flex-[1_1_130px]"
              />
              <NumberField
                explain
                label={`${scheme.loadSymbol} (надолу)`}
                unit={scheme.loadUnit}
                value={input.load}
                min={0}
                max={10000}
                onChange={(load) => set({ load })}
                className="flex-[1_1_130px]"
              />
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
            <div
              role="group"
              aria-label="Бърз избор на E"
              className="flex flex-wrap gap-2"
            >
              {materials.map((material) => (
                <Button
                  key={material.E}
                  variant={input.E === material.E ? "default" : "outline"}
                  aria-pressed={input.E === material.E}
                  className="h-auto py-2 text-left whitespace-normal"
                  onClick={() => set({ E: material.E })}
                >
                  {material.label}
                </Button>
              ))}
            </div>
            <p className="text-sm leading-normal text-dim">
              1 100 kN/cm² за дърво е примерна стойност, както в задачите от
              учебника. В своята задача ползвай E от условието.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-extrabold">Сечение</h2>
            <LabChoice
              label="Как е зададен I_x"
              options={inertiaModes}
              value={input.inertiaFrom}
              onChange={(inertiaFrom) => set({ inertiaFrom })}
            />
            <div className="flex flex-wrap gap-3">
              {input.inertiaFrom === "rect" ? (
                <>
                  <NumberField
                    explain
                    label="Ширина b"
                    unit="cm"
                    value={input.b}
                    min={0.1}
                    max={500}
                    onChange={(b) => set({ b })}
                    className="flex-[1_1_130px]"
                  />
                  <NumberField
                    explain
                    label="Височина h"
                    unit="cm"
                    value={input.h}
                    min={0.1}
                    max={500}
                    onChange={(h) => set({ h })}
                    className="flex-[1_1_130px]"
                  />
                </>
              ) : (
                <NumberField
                  explain
                  label="Инерционен момент I_x"
                  unit="cm⁴"
                  value={input.I}
                  min={0.01}
                  max={10000000}
                  onChange={(I) => set({ I })}
                  className="flex-[1_1_130px]"
                />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-extrabold">Условие за коравина</h2>
            <NumberField
              explain
              label="Допустимо провисване по условието на задачата: l / n; въведи n"
              value={input.limit}
              min={1}
              max={10000}
              onChange={(limit) => set({ limit })}
            />
            <p className="text-sm leading-normal text-dim">
              Числото n идва от условието на твоята задача. Лабораторията не го
              взима от норма.
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
              <LabFigure svg={solution.svg} />
              <LabVerdict ok={solution.withinLimit} text={solution.verdict} />
              <LabResults results={solution.results} />
              <LabSteps steps={solution.steps} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
