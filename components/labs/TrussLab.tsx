"use client";

import { useState } from "react";
import { renderTrussFigure } from "@/lib/content/truss-figure";
import { labNumber, labQuantity } from "@/lib/labs/format";
import {
  defaultTrussInput,
  solveTrussLab,
  trussKind,
  trussKinds,
  trussPresets,
  type TrussInput,
} from "@/lib/labs/truss";
import {
  LabChoice,
  LabFigure,
  LabPresets,
  LabResults,
  LabSteps,
} from "./LabParts";
import { NumberField } from "./NumberField";

const field = "flex-[1_1_130px]";

/** Решението заедно с чертежа и описанието му за екранни четци. */
function solveWithFigure(input: TrussInput) {
  const solved = solveTrussLab(input);
  if (!solved.ok) return solved;
  const current = trussKind(input.kind);
  const peak = (item: { ids: string[]; force: number } | null, name: string) =>
    item
      ? `Най-голям ${name} ${labQuantity(Math.abs(item.force), "kN")} в ${item.ids.length > 1 ? "пръти" : "прът"} ${item.ids.join(", ")}.`
      : `Няма ${name}.`;
  return {
    ...solved,
    svg: renderTrussFigure({
      title: `${current.name}: отвор ${labNumber(input.span)} m, височина ${labNumber(input.height)} m. Опорни реакции: A_h = ${labQuantity(solved.Ah, "kN")}, A_v = ${labQuantity(solved.Av, "kN")}, B_v = ${labQuantity(solved.Bv, "kN")}. ${peak(solved.maxTension, "опън")} ${peak(solved.maxCompression, "натиск")} Опънатите пръти са с плътна линия, натиснатите – с пунктир, нулевите са отбелязани с 0. Всички усилия са в таблицата под чертежа.`,
      joints: solved.truss.joints,
      members: solved.truss.members.map((member, index) => ({
        ...member,
        force: solved.rows[index]!.force,
      })),
      supports: solved.truss.supports,
      loads: solved.truss.loads,
      reactions: solved.reactions,
    }),
  };
}

export function TrussLab() {
  const [input, setInput] = useState<TrussInput>(trussPresets[0]!.input);
  const set = (patch: Partial<TrussInput>) =>
    setInput((current) => ({ ...current, ...patch }));
  const kind = trussKind(input.kind);

  // сметката е лека (най-много 13 пръта) – не се пази между рисуванията
  const solution = solveWithFigure(input);

  return (
    <div className="lab flex flex-col gap-6">
      <LabPresets presets={trussPresets} onPick={setInput} />

      <div className="flex flex-wrap items-start gap-6">
        <section
          aria-label="Данни"
          className="sl-card flex min-w-0 flex-[1_1_320px] flex-col gap-5"
        >
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-extrabold">Геометрия</h2>
            <LabChoice
              label="Вид на фермата"
              options={trussKinds}
              value={input.kind}
              onChange={(next) => setInput(defaultTrussInput(next))}
            />
            <div className="flex flex-wrap gap-3">
              <NumberField
                explain
                label="Отвор l"
                unit="m"
                value={input.span}
                min={1}
                max={100}
                onChange={(span) => set({ span })}
                className={field}
              />
              <NumberField
                explain
                label="Височина h"
                unit="m"
                value={input.height}
                min={0.1}
                max={50}
                onChange={(height) => set({ height })}
                className={field}
              />
            </div>
            <p className="text-sm leading-normal text-dim">
              Опора A е неподвижна, опора B – подвижна. Панелите са с еднаква
              ширина.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-extrabold">Товари във възлите</h2>
            <div className="flex flex-wrap gap-3">
              {kind.loadJoints.map((joint) => (
                <NumberField
                  key={`${kind.id}-${joint.id}`}
                  explain
                  label={`Възел ${joint.id} (${joint.where}), надолу`}
                  unit="kN"
                  value={input.loads[joint.id] ?? 0}
                  min={0}
                  max={10000}
                  onChange={(value) =>
                    setInput((current) => ({
                      ...current,
                      loads: { ...current.loads, [joint.id]: value },
                    }))
                  }
                  className={field}
                />
              ))}
            </div>
            <NumberField
              key={`${kind.id}-horizontal`}
              explain
              label={`Хоризонтална сила във възел ${kind.horizontalJoint} (надясно +)`}
              unit="kN"
              value={input.horizontal}
              min={-10000}
              max={10000}
              onChange={(horizontal) => set({ horizontal })}
            />
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
              <LabFigure
                svg={solution.svg}
                className="p-2 sm:p-4 [&_svg]:mx-auto [&_svg]:max-w-[560px]"
              />
              <LabResults results={solution.results} />
              <div
                tabIndex={0}
                role="region"
                aria-label="Таблица с усилията в прътите"
                className="overflow-x-auto rounded-2xl border border-line bg-surface p-4"
              >
                <table className="w-full border-collapse font-mono text-sm">
                  <caption className="mb-3 text-left font-sans text-sm leading-normal text-dim">
                    Усилия в прътите. Плюс е опън, минус е натиск.
                  </caption>
                  <thead>
                    <tr>
                      {["Прът", "Дължина, m", "Усилие S, kN", "Вид"].map(
                        (head) => (
                          <th
                            key={head}
                            scope="col"
                            className="border border-line bg-surface-2 px-2.5 py-2 text-left font-bold whitespace-nowrap"
                          >
                            {head}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {solution.rows.map((row) => (
                      <tr key={row.id}>
                        <th
                          scope="row"
                          className="border border-line px-2.5 py-2 text-left font-bold whitespace-nowrap"
                        >
                          {row.id}
                        </th>
                        {[
                          labNumber(row.length),
                          labNumber(row.force),
                          row.state,
                        ].map((cell, index) => (
                          <td
                            key={index}
                            className="border border-line px-2.5 py-2 whitespace-nowrap"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <LabSteps steps={solution.steps} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
