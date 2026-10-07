"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui/form";
import { formatDecimal, parseDecimal } from "@/lib/number-input";
import { cn } from "@/lib/utils";

type NumberFieldProps = {
  label: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
  /** допустими граници; извън тях полето се отбелязва като грешно */
  min?: number;
  max?: number;
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
  className,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? formatDecimal(value);
  const parsed = parseDecimal(shown);
  const invalid = parsed === null || parsed < min || parsed > max;

  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-xs font-bold text-dim">
        {label}, {unit}
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={shown}
        aria-invalid={invalid || undefined}
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
}
