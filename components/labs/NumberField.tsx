"use client";

import { useId, useState } from "react";
import { inputClass } from "@/components/ui/form";
import { formatDecimal, parseDecimal } from "@/lib/number-input";
import { cn } from "@/lib/utils";

type NumberFieldProps = {
  label: string;
  /** мерна единица; без нея се показва само надписът (безразмерно число) */
  unit?: string;
  value: number;
  onChange: (value: number) => void;
  /** допустими граници; извън тях полето се отбелязва като грешно */
  min?: number;
  max?: number;
  /**
   * Под грешно поле се изписва какво се очаква – за да не е червеният
   * кант единственият знак. Резултатът остава от последната валидна стойност.
   */
  explain?: boolean;
  className?: string;
};

/**
 * Поле за число с десетична запетая. Докато потребителят пише, пазим текста
 * му такъв, какъвто е; стойността се подава нагоре само когато е валидна.
 */
export function NumberField({
  label,
  unit,
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  explain = false,
  className,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const errorId = useId();
  const shown = draft ?? formatDecimal(value);
  const parsed = parseDecimal(shown);
  const invalid = parsed === null || parsed < min || parsed > max;
  const showError = explain && invalid;

  const field = (
    <label className={cn("flex min-w-0 flex-col gap-1", !explain && className)}>
      <span className="text-xs font-bold text-dim">
        {unit ? `${label}, ${unit}` : label}
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={shown}
        aria-invalid={invalid || undefined}
        aria-describedby={showError ? errorId : undefined}
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          const next = parseDecimal(text);
          if (next !== null && next >= min && next <= max) onChange(next);
        }}
        onBlur={() => setDraft(null)}
        className={cn(
          inputClass,
          "px-3 font-mono text-[15px]",
          invalid && "border-destructive",
        )}
      />
    </label>
  );
  if (!explain) return field;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      {field}
      {showError ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {rangeMessage(min, max)} Резултатът е за последната валидна стойност.
        </p>
      ) : null}
    </div>
  );
}

function rangeMessage(min: number, max: number): string {
  const low = Number.isFinite(min);
  const high = Number.isFinite(max);
  if (low && high) {
    return `Въведи число от ${formatDecimal(min)} до ${formatDecimal(max)}.`;
  }
  if (low) return `Въведи число, не по-малко от ${formatDecimal(min)}.`;
  if (high) return `Въведи число, не по-голямо от ${formatDecimal(max)}.`;
  return "Въведи число.";
}
