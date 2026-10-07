"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { figureNumber, renderBeamFigure } from "@/lib/content/beam-figure";
import { explainBeam } from "@/lib/engineering/beam-steps";
import {
  maxMoment,
  solveReactions,
  type Beam,
  type BeamLoad,
} from "@/lib/engineering/beam";
import { cn } from "@/lib/utils";
import { NumberField } from "./NumberField";

type Scheme = "simple" | "overhang" | "cantilever";
type LabLoad = BeamLoad & { id: number };
type LabState = {
  scheme: Scheme;
  length: number;
  /** положение на втората опора при греда с конзола */
  xB: number;
  loads: LabLoad[];
};

const schemes: { id: Scheme; label: string }[] = [
  { id: "simple", label: "Проста греда" },
  { id: "overhang", label: "Греда с конзола" },
  { id: "cantilever", label: "Конзола" },
];

// Готови примери – същите като решените в Глава 1 на учебника.
const presets: { label: string; state: LabState }[] = [
  {
    label: "Сила върху проста греда",
    state: {
      scheme: "simple",
      length: 6,
      xB: 6,
      loads: [{ id: 1, type: "force", x: 2.4, value: 30 }],
    },
  },
  {
    label: "Разпределен товар",
    state: {
      scheme: "simple",
      length: 4,
      xB: 4,
      loads: [{ id: 1, type: "distributed", x1: 0, x2: 4, value: 10 }],
    },
  },
  {
    label: "Конзола",
    state: {
      scheme: "cantilever",
      length: 3,
      xB: 3,
      loads: [
        { id: 1, type: "distributed", x1: 0, x2: 3, value: 8 },
        { id: 2, type: "force", x: 3, value: 10 },
      ],
    },
  },
  {
    label: "Греда с конзола",
    state: {
      scheme: "overhang",
      length: 5,
      xB: 4,
      loads: [{ id: 1, type: "force", x: 5, value: 12 }],
    },
  },
];

const loadNames = {
  force: "Сила",
  distributed: "Разпределен товар",
  moment: "Момент",
} as const;

const MAX_LENGTH = 30;
const MAX_LOADS = 6;

function toBeam(state: LabState): Beam {
  return {
    length: state.length,
    supports:
      state.scheme === "cantilever"
        ? { type: "cantilever", fixedAt: "left" }
        : {
            type: "simple",
            xA: 0,
            xB: state.scheme === "simple" ? state.length : state.xB,
          },
    // без служебното поле id
    loads: state.loads.map((load): BeamLoad =>
      load.type === "distributed"
        ? { type: load.type, x1: load.x1, x2: load.x2, value: load.value }
        : { type: load.type, x: load.x, value: load.value },
    ),
  };
}

/** Какво не е наред с въведените данни – или null, ако всичко е валидно. */
function findProblem(state: LabState): string | null {
  if (
    state.scheme === "overhang" &&
    !(state.xB > 0 && state.xB < state.length)
  ) {
    return "Втората опора трябва да е между началото и края на гредата.";
  }
  for (const load of state.loads) {
    if (load.type === "distributed") {
      if (load.x1 < 0 || load.x2 > state.length) {
        return "Разпределеният товар излиза извън гредата.";
      }
      if (!(load.x2 > load.x1)) {
        return "Краят на разпределения товар трябва да е след началото му.";
      }
    } else if (load.x < 0 || load.x > state.length) {
      return "Има товар извън гредата.";
    }
  }
  return null;
}

export function BeamLab() {
  const [state, setState] = useState<LabState>(presets[0]!.state);
  const [showSteps, setShowSteps] = useState(false);
  const [nextId, setNextId] = useState(10);

  const problem = findProblem(state);
  const solution = useMemo(() => {
    if (problem) return null;
    const beam = toBeam(state);
    return {
      svg: renderBeamFigure(beam, {
        title:
          "Схема на гредата и диаграми на напречната сила и огъващия момент",
      }),
      reactions: solveReactions(beam),
      peak: maxMoment(beam),
      steps: explainBeam(beam),
    };
  }, [state, problem]);

  function updateLoad(id: number, patch: Partial<BeamLoad>) {
    setState((current) => ({
      ...current,
      loads: current.loads.map((load) =>
        load.id === id ? ({ ...load, ...patch } as LabLoad) : load,
      ),
    }));
  }

  function addLoad(type: BeamLoad["type"]) {
    const middle = Math.round((state.length / 2) * 10) / 10;
    const load: LabLoad =
      type === "force"
        ? { id: nextId, type, x: middle, value: 10 }
        : type === "distributed"
          ? { id: nextId, type, x1: 0, x2: state.length, value: 5 }
          : { id: nextId, type, x: middle, value: 10 };
    setNextId(nextId + 1);
    setState((current) => ({ ...current, loads: [...current.loads, load] }));
  }

  function changeLength(length: number) {
    // При смяна на дължината товарите и опората остават вътре в гредата.
    setState((current) => ({
      ...current,
      length,
      xB:
        current.scheme === "overhang"
          ? Math.min(current.xB, length * 0.8)
          : length,
      loads: current.loads.map((load) =>
        load.type === "distributed"
          ? {
              ...load,
              x1: Math.min(load.x1, length),
              x2: Math.min(load.x2, length),
            }
          : { ...load, x: Math.min(load.x, length) },
      ),
    }));
  }

  function changeScheme(scheme: Scheme) {
    setState((current) => ({
      ...current,
      scheme,
      xB:
        scheme === "overhang"
          ? Math.round(current.length * 8) / 10
          : current.length,
    }));
  }

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
            onClick={() => setState(preset.state)}
          >
            {preset.label}
          </Button>
        ))}
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <section
          aria-label="Данни за гредата"
          className="flex min-w-0 flex-[1_1_320px] flex-col gap-5 rounded-2xl border border-line bg-surface p-5"
        >
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-extrabold">Греда</h2>
            <div
              role="group"
              aria-label="Вид на гредата"
              className="flex flex-wrap gap-2"
            >
              {schemes.map((scheme) => (
                <Button
                  key={scheme.id}
                  variant={state.scheme === scheme.id ? "default" : "outline"}
                  aria-pressed={state.scheme === scheme.id}
                  onClick={() => changeScheme(scheme.id)}
                >
                  {scheme.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <NumberField
              label="Дължина L"
              unit="m"
              value={state.length}
              min={0.5}
              max={MAX_LENGTH}
              onChange={changeLength}
              className="flex-[1_1_120px]"
            />
            {state.scheme === "overhang" ? (
              <NumberField
                label="Втора опора при x"
                unit="m"
                value={state.xB}
                min={0.1}
                max={MAX_LENGTH}
                onChange={(xB) => setState((current) => ({ ...current, xB }))}
                className="flex-[1_1_120px]"
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-extrabold">Товари</h2>
            {state.loads.length === 0 ? (
              <p className="text-sm text-dim">Няма товари. Добави поне един.</p>
            ) : null}
            <ul className="flex flex-col gap-3">
              {state.loads.map((load, index) => (
                <li
                  key={load.id}
                  className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">
                      {index + 1}. {loadNames[load.type]}
                    </span>
                    <Button
                      variant="ghost"
                      aria-label={`Премахни товар ${index + 1}`}
                      className="px-2.5"
                      onClick={() =>
                        setState((current) => ({
                          ...current,
                          loads: current.loads.filter(
                            (item) => item.id !== load.id,
                          ),
                        }))
                      }
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {load.type === "distributed" ? (
                      <>
                        <NumberField
                          label={`q${index + 1} (надолу)`}
                          unit="kN/m"
                          value={load.value}
                          min={-1000}
                          max={1000}
                          onChange={(value) => updateLoad(load.id, { value })}
                          className="flex-[1_1_90px]"
                        />
                        <NumberField
                          label="от x"
                          unit="m"
                          value={load.x1}
                          min={0}
                          max={MAX_LENGTH}
                          onChange={(x1) => updateLoad(load.id, { x1 })}
                          className="flex-[1_1_70px]"
                        />
                        <NumberField
                          label="до x"
                          unit="m"
                          value={load.x2}
                          min={0}
                          max={MAX_LENGTH}
                          onChange={(x2) => updateLoad(load.id, { x2 })}
                          className="flex-[1_1_70px]"
                        />
                      </>
                    ) : (
                      <>
                        <NumberField
                          label={
                            load.type === "force"
                              ? `F${index + 1} (надолу)`
                              : `M${index + 1} (по часовниковата)`
                          }
                          unit={load.type === "force" ? "kN" : "kN·m"}
                          value={load.value}
                          min={-1000}
                          max={1000}
                          onChange={(value) => updateLoad(load.id, { value })}
                          className="flex-[1_1_110px]"
                        />
                        <NumberField
                          label="при x"
                          unit="m"
                          value={load.x}
                          min={0}
                          max={MAX_LENGTH}
                          onChange={(x) => updateLoad(load.id, { x })}
                          className="flex-[1_1_90px]"
                        />
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {state.loads.length < MAX_LOADS ? (
              <div className="flex flex-wrap gap-2">
                {(["force", "distributed", "moment"] as const).map((type) => (
                  <Button
                    key={type}
                    variant="outline"
                    onClick={() => addLoad(type)}
                  >
                    <Plus aria-hidden="true" className="size-4" />
                    {loadNames[type]}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-dim">Най-много {MAX_LOADS} товара.</p>
            )}
          </div>
        </section>

        <section
          aria-label="Резултат"
          aria-live="polite"
          className="flex min-w-0 flex-[2_1_420px] flex-col gap-4"
        >
          {problem || !solution ? (
            <p role="alert" className="rounded-2xl bg-warn-bg p-5 text-warn-fg">
              {problem}
            </p>
          ) : (
            <>
              <div
                className="rounded-2xl border border-line bg-surface p-4 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: solution.svg }}
              />
              <dl className="flex flex-wrap gap-3">
                {solution.reactions.forces.map((reaction, index) => (
                  <div
                    key={index}
                    className="flex flex-[1_1_130px] flex-col gap-1 rounded-xl bg-surface-2 p-4"
                  >
                    <dt className="text-xs text-dim">
                      Реакция {index === 0 ? "A" : "B"}
                    </dt>
                    <dd className="font-mono text-xl">
                      {figureNumber(reaction.value)} kN
                    </dd>
                  </div>
                ))}
                {solution.reactions.moment ? (
                  <div className="flex flex-[1_1_130px] flex-col gap-1 rounded-xl bg-surface-2 p-4">
                    <dt className="text-xs text-dim">Момент в запъването</dt>
                    <dd className="font-mono text-xl">
                      {figureNumber(solution.reactions.moment.value)} kN·m
                    </dd>
                  </div>
                ) : null}
                <div className="flex flex-[1_1_130px] flex-col gap-1 rounded-xl bg-surface-2 p-4">
                  <dt className="text-xs text-dim">Най-голям момент</dt>
                  <dd className="font-mono text-xl">
                    {figureNumber(Math.abs(solution.peak.M))} kN·m
                  </dd>
                  <dd className="text-xs text-dim">
                    при x = {figureNumber(solution.peak.x)} m
                  </dd>
                </div>
              </dl>

              <Button
                variant="outline"
                aria-expanded={showSteps}
                className="self-start"
                onClick={() => setShowSteps((value) => !value)}
              >
                {showSteps
                  ? "Скрий решението"
                  : "Покажи решението стъпка по стъпка"}
              </Button>
              {showSteps ? (
                <ol className="flex flex-col gap-3">
                  {solution.steps.map((step, index) => (
                    <li
                      key={step.title}
                      className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5"
                    >
                      <h3 className="font-extrabold">
                        <span className="mr-2 font-mono text-sm text-primary">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {step.title}
                      </h3>
                      {step.lines.map((line) => (
                        <p
                          key={line}
                          className={cn(
                            "leading-[1.6] text-muted-foreground",
                            /[=·]/.test(line) &&
                              "font-mono text-[15px] text-foreground",
                          )}
                        >
                          {line}
                        </p>
                      ))}
                      {step.table ? (
                        <div
                          tabIndex={0}
                          role="region"
                          aria-label="Таблица с характерните стойности"
                          className="overflow-x-auto"
                        >
                          <table className="w-full border-collapse font-mono text-[15px]">
                            <thead>
                              <tr>
                                {step.table.head.map((cell) => (
                                  <th
                                    key={cell}
                                    scope="col"
                                    className="border border-line bg-surface-2 px-3 py-2 text-left font-bold"
                                  >
                                    {cell}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {step.table.rows.map((row) => (
                                <tr key={row.join("|")}>
                                  {row.map((cell, cellIndex) => (
                                    <td
                                      key={cellIndex}
                                      className="border border-line px-3 py-2"
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
