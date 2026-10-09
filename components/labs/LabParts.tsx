"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { isSafeSvg } from "@/lib/content/svg";
import type { LabResult, LabStep } from "@/lib/labs/format";
import { cn } from "@/lib/utils";

/** Общи части на лабораториите: примери, избор, фигура, резултати, стъпки. */

export function LabPresets<T>({
  presets,
  onPick,
}: {
  presets: readonly { label: string; input: T }[];
  onPick: (input: T) => void;
}) {
  return (
    <section
      aria-label="Готови примери"
      className="flex flex-wrap items-center gap-2"
    >
      <span className="text-sm font-bold text-dim">Примери от учебника:</span>
      {presets.map((preset) => (
        <Button
          key={preset.label}
          variant="outline"
          className="h-auto py-2 whitespace-normal"
          onClick={() => onPick(preset.input)}
        >
          {preset.label}
        </Button>
      ))}
    </section>
  );
}

/** Избор на една от няколко възможности – бутони с aria-pressed. */
export function LabChoice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option.id}
          variant={value === option.id ? "default" : "outline"}
          aria-pressed={value === option.id}
          className="h-auto py-2 text-left whitespace-normal"
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

/** SVG фигура от чист чертожник; непроверена фигура не се вгражда. */
export function LabFigure({
  svg,
  className,
}: {
  svg: string;
  className?: string;
}) {
  if (!isSafeSvg(svg)) return null;
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface p-4 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/**
 * „I_x“ → I с долен индекс x. Долната черта остава в текста (скрита за окото),
 * за да се чете и търси по същия начин, както е записано в учебника.
 */
export function Sym({ text }: { text: string }) {
  const parts = text.split(/_([A-Za-zА-Яа-я0-9]+)/);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <sub key={index}>
            <span className="sr-only">_</span>
            {part}
          </sub>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function LabResults({ results }: { results: readonly LabResult[] }) {
  return (
    <dl className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
      {results.map((item) => (
        <div
          key={item.name}
          className="flex flex-col gap-1 rounded-xl bg-surface-2 p-4"
        >
          <dt className="text-xs text-dim">
            <Sym text={item.name} />
          </dt>
          <dd className="font-mono text-[15px]">{item.value}</dd>
          {item.note ? (
            <dd className="text-xs leading-normal text-dim">
              <Sym text={item.note} />
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

/** Присъда с думи и знак – цветът само я подсилва. */
export function LabVerdict({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p
      className={cn(
        "rounded-2xl p-5 leading-[1.6] font-bold",
        ok ? "bg-success-bg text-success-fg" : "bg-warn-bg text-warn-fg",
      )}
    >
      <span aria-hidden="true" className="mr-2">
        {ok ? "✓" : "✗"}
      </span>
      <Sym text={text} />
    </p>
  );
}

/** Ред-сметка: започва с означение и равенство („σ_долу = …“). */
function isFormula(line: string): boolean {
  const head = line.split(" = ")[0] ?? "";
  return line.includes(" = ") && head.length <= 24 && !head.includes(" ");
}

export function LabSteps({ steps }: { steps: readonly LabStep[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        aria-expanded={open}
        className="self-start"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Скрий сметките" : "Покажи как се смята"}
      </Button>
      {open ? (
        <ol className="flex flex-col gap-3">
          {steps.map((step, index) => (
            <li key={step.title} className="sl-card flex flex-col gap-2">
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
                    "leading-[1.6] break-words text-muted-foreground",
                    isFormula(line) && "font-mono text-[15px] text-foreground",
                  )}
                >
                  <Sym text={line} />
                </p>
              ))}
            </li>
          ))}
        </ol>
      ) : null}
    </>
  );
}
