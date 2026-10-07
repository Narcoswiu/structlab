"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const inputClass =
  "min-h-11 w-full rounded-[10px] border border-line-strong bg-background px-3.5 text-base text-foreground placeholder:text-dim";

type FieldProps = React.ComponentProps<"input"> & {
  label: string;
  hint?: string;
  error?: string;
};

export function Field({ label, hint, error, id, className, ...props }: FieldProps) {
  const fieldId = id ?? props.name;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-bold text-muted-foreground">
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(inputClass, error && "border-destructive", className)}
        {...props}
      />
      {error ? (
        <p id={`${fieldId}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-sm text-dim">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Бутон за форма: докато сървърът работи, е изключен и показва „…“. */
export function SubmitButton({
  children,
  pendingText = "Момент…",
  ...props
}: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}

export function FormMessage({
  kind,
  children,
}: {
  kind: "error" | "success";
  children: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[10px] px-3.5 py-3 text-sm leading-normal",
        kind === "error" ? "bg-warn-bg text-warn-fg" : "bg-success-bg text-success-fg",
      )}
    >
      {children}
    </p>
  );
}
