"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form";
import { renderReactionsFigure } from "@/lib/content/reactions-figure";
import { labNumber, labQuantity } from "@/lib/labs/format";
import {
  defaultReactionLoad,
  inclinedDirections,
  MAX_REACTION_LOADS,
  reactionLoadKinds,
  reactionsPresets,
  reactionsSchemes,
  solveReactions,
  type InclinedDirection,
  type ReactionLoad,
  type ReactionsInput,
} from "@/lib/labs/reactions";
import {
  LabChoice,
  LabFigure,
  LabPresets,
  LabResults,
  LabSteps,
  LabVerdict,
} from "./LabParts";
import { NumberField } from "./NumberField";

/** Товар с ключ за списъка – ключът не участва в сметките. */
type KeyedLoad = ReactionLoad & { id: number };
type State = Omit<ReactionsInput, "loads"> & { loads: KeyedLoad[] };

const kindName = (kind: ReactionLoad["kind"]) =>
  reactionLoadKinds.find((item) => item.id === kind)?.label ?? "";

const field = "flex-[1_1_120px]";

// ключове за списъка с товари; стойността им няма значение
let loadKey = 0;
const keyed = (input: ReactionsInput): State => ({
  ...input,
  loads: input.loads.map((load) => ({ ...load, id: loadKey++ })),
});

export function ReactionsLab() {
  const [state, setState] = useState<State>(() =>
    keyed(reactionsPresets[0]!.input),
  );
  const set = (patch: Partial<Omit<State, "loads">>) =>
    setState((current) => ({ ...current, ...patch }));
  const update = (id: number, patch: Partial<ReactionLoad>) =>
    setState((current) => ({
      ...current,
      loads: current.loads.map((load) =>
        load.id === id ? ({ ...load, ...patch } as KeyedLoad) : load,
      ),
    }));

  const solution = useMemo(() => {
    const solved = solveReactions(state);
    if (!solved.ok) return solved;
    const fixed = state.scheme === "fixed";
    const reactionText = fixed
      ? `A_h = ${labQuantity(solved.Ah, "kN")}, A_v = ${labQuantity(solved.Av, "kN")}, M_A = ${labQuantity(solved.MA ?? 0, "kN·m")}`
      : `A_h = ${labQuantity(solved.Ah, "kN")}, A_v = ${labQuantity(solved.Av, "kN")}, B_v = ${labQuantity(solved.Bv ?? 0, "kN")}`;
    return {
      ...solved,
      svg: renderReactionsFigure({
        title: `${fixed ? "Греда, запъната в левия край" : `Греда с неподвижна опора A при x = ${labNumber(state.xA)} m и подвижна опора B при x = ${labNumber(state.xB)} m`}, дължина ${labNumber(state.l)} m, ${state.loads.length === 0 ? "без товари" : `товари: ${state.loads.length}`}. Опорни реакции: ${reactionText}. Стрелките на реакциите показват действителните им посоки.`,
        scheme: state.scheme,
        l: state.l,
        xA: state.xA,
        xB: state.xB,
        loads: state.loads,
        reactions: solved,
      }),
    };
  }, [state]);

  const full = state.loads.length >= MAX_REACTION_LOADS;

  return (
    <div className="lab flex flex-col gap-6">
      <LabPresets
        presets={reactionsPresets}
        onPick={(input) => setState(keyed(input))}
      />

      <div className="flex flex-wrap items-start gap-6">
        <section
          aria-label="Данни"
          className="sl-card flex min-w-0 flex-[1_1_320px] flex-col gap-5"
        >
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-extrabold">Греда и опори</h2>
            <LabChoice
              label="Опори"
              options={reactionsSchemes}
              value={state.scheme}
              onChange={(scheme) => set({ scheme })}
            />
            <div className="flex flex-wrap gap-3">
              <NumberField
                explain
                label="Дължина l"
                unit="m"
                value={state.l}
                min={0.5}
                max={100}
                onChange={(l) => set({ l })}
                className={field}
              />
              {state.scheme === "pin-roller" ? (
                <>
                  <NumberField
                    explain
                    label="Опора A при x"
                    unit="m"
                    value={state.xA}
                    min={0}
                    max={state.l}
                    onChange={(xA) => set({ xA })}
                    className={field}
                  />
                  <NumberField
                    explain
                    label="Опора B при x"
                    unit="m"
                    value={state.xB}
                    min={0}
                    max={state.l}
                    onChange={(xB) => set({ xB })}
                    className={field}
                  />
                </>
              ) : null}
            </div>
            <p className="text-sm leading-normal text-dim">
              Оста x започва от левия край на гредата. Всички места се мерят от
              него.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-extrabold">
              Товари ({state.loads.length} от {MAX_REACTION_LOADS})
            </h2>
            {state.loads.length === 0 ? (
              <p className="text-sm text-dim">
                Няма товари – всички реакции са нула. Добави товар от списъка.
              </p>
            ) : null}
            <ul className="flex flex-col gap-3">
              {state.loads.map((load, index) => (
                <li key={load.id}>
                  <fieldset className="flex min-w-0 flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3">
                    <legend className="sr-only">
                      Товар {index + 1}: {kindName(load.kind)}
                    </legend>
                    <div className="flex items-center justify-between gap-2">
                      <span aria-hidden="true" className="text-sm font-bold">
                        {index + 1}. {kindName(load.kind)}
                      </span>
                      <Button
                        variant="ghost"
                        aria-label={`Премахни товар ${index + 1}`}
                        className="min-w-11 px-2.5"
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
                      {load.kind === "inclined" ? (
                        <>
                          <NumberField
                            explain
                            label="Големина F"
                            unit="kN"
                            value={load.F}
                            min={0}
                            max={10000}
                            onChange={(F) => update(load.id, { F })}
                            className={field}
                          />
                          <NumberField
                            explain
                            label="Ъгъл с хоризонталата"
                            unit="°"
                            value={load.angle}
                            min={0}
                            max={90}
                            onChange={(angle) => update(load.id, { angle })}
                            className={field}
                          />
                          <NumberField
                            explain
                            label="Място x"
                            unit="m"
                            value={load.x}
                            min={0}
                            max={state.l}
                            onChange={(x) => update(load.id, { x })}
                            className={field}
                          />
                          <label className="flex min-w-0 flex-[1_1_180px] flex-col gap-1">
                            <span className="text-xs font-bold text-dim">
                              Посока на силата
                            </span>
                            <select
                              value={load.direction}
                              onChange={(event) =>
                                update(load.id, {
                                  direction: event.target
                                    .value as InclinedDirection,
                                })
                              }
                              className={inputClass}
                            >
                              {inclinedDirections.map((direction) => (
                                <option key={direction.id} value={direction.id}>
                                  {direction.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </>
                      ) : load.kind === "vertical" ? (
                        <>
                          <NumberField
                            explain
                            label="F (надолу)"
                            unit="kN"
                            value={load.F}
                            min={0}
                            max={10000}
                            onChange={(F) => update(load.id, { F })}
                            className={field}
                          />
                          <NumberField
                            explain
                            label="Място x"
                            unit="m"
                            value={load.x}
                            min={0}
                            max={state.l}
                            onChange={(x) => update(load.id, { x })}
                            className={field}
                          />
                        </>
                      ) : load.kind === "couple" ? (
                        <>
                          <NumberField
                            explain
                            label="M (обратно на часовниковата +)"
                            unit="kN·m"
                            value={load.M}
                            min={-10000}
                            max={10000}
                            onChange={(M) => update(load.id, { M })}
                            className="flex-[1_1_200px]"
                          />
                          <NumberField
                            explain
                            label="Място x"
                            unit="m"
                            value={load.x}
                            min={0}
                            max={state.l}
                            onChange={(x) => update(load.id, { x })}
                            className={field}
                          />
                          <p className="basis-full text-xs leading-normal text-dim">
                            Момент по часовниковата стрелка се въвежда с минус.
                            Мястото му не променя реакциите.
                          </p>
                        </>
                      ) : load.kind === "uniform" ? (
                        <>
                          <NumberField
                            explain
                            label="q (надолу)"
                            unit="kN/m"
                            value={load.q}
                            min={0}
                            max={10000}
                            onChange={(q) => update(load.id, { q })}
                            className={field}
                          />
                          <NumberField
                            explain
                            label="от x"
                            unit="m"
                            value={load.from}
                            min={0}
                            max={state.l}
                            onChange={(from) => update(load.id, { from })}
                            className={field}
                          />
                          <NumberField
                            explain
                            label="до x"
                            unit="m"
                            value={load.to}
                            min={0}
                            max={state.l}
                            onChange={(to) => update(load.id, { to })}
                            className={field}
                          />
                        </>
                      ) : (
                        <>
                          <NumberField
                            explain
                            label="Най-голямо q (надолу)"
                            unit="kN/m"
                            value={load.q}
                            min={0}
                            max={10000}
                            onChange={(q) => update(load.id, { q })}
                            className={field}
                          />
                          <NumberField
                            explain
                            label="Нулев край при x"
                            unit="m"
                            value={load.zeroAt}
                            min={0}
                            max={state.l}
                            onChange={(zeroAt) => update(load.id, { zeroAt })}
                            className={field}
                          />
                          <NumberField
                            explain
                            label="Край с q при x"
                            unit="m"
                            value={load.peakAt}
                            min={0}
                            max={state.l}
                            onChange={(peakAt) => update(load.id, { peakAt })}
                            className={field}
                          />
                        </>
                      )}
                    </div>
                  </fieldset>
                </li>
              ))}
            </ul>
            {full ? (
              <p className="text-sm text-dim">
                Най-много {MAX_REACTION_LOADS} товара. Премахни някой, за да
                добавиш друг.
              </p>
            ) : (
              <div
                role="group"
                aria-label="Добави товар"
                className="flex flex-wrap gap-2"
              >
                {reactionLoadKinds.map((kind) => (
                  <Button
                    key={kind.id}
                    variant="outline"
                    className="h-auto py-2 text-left whitespace-normal"
                    onClick={() =>
                      setState((current) =>
                        current.loads.length >= MAX_REACTION_LOADS
                          ? current
                          : {
                              ...current,
                              loads: [
                                ...current.loads,
                                {
                                  ...defaultReactionLoad(kind.id, current.l),
                                  id: loadKey++,
                                },
                              ],
                            },
                      )
                    }
                  >
                    + {kind.label}
                  </Button>
                ))}
              </div>
            )}
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
              <LabVerdict ok={solution.balanced} text={solution.verdict} />
              <LabResults results={solution.results} />
              <LabSteps steps={solution.steps} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
