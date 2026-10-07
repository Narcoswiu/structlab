"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatQuantity } from "@/lib/format";
import { derivePersonalTask } from "@/lib/personal-task";
import { Eyebrow } from "./SectionHeading";

// Номерът се обработва само в браузъра – не се изпраща и не се записва никъде.
export function PersonalTaskDemo() {
  const [facultyNumber, setFacultyNumber] = useState("3147");
  const task = derivePersonalTask(facultyNumber);

  const values = task
    ? [
        { label: "Сила F", value: formatQuantity(task.F, "kN") },
        { label: "Момент M", value: formatQuantity(task.M, "kN·m") },
        { label: "Товар q", value: formatQuantity(task.q, "kN/m") },
        { label: "Дължина a", value: formatQuantity(task.a, "m", 1) },
      ]
    : [];

  return (
    <section className="pt-16 lg:pt-[104px]">
      <div className="flex flex-wrap items-center gap-8 rounded-[20px] border border-line bg-surface p-6 sm:gap-10 sm:p-10">
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
          <Eyebrow>ПРОБВАЙ</Eyebrow>
          <h2 className="text-[26px] leading-[1.2] font-extrabold sm:text-[32px]">
            Твоето задание за секунда
          </h2>
          <p className="leading-[1.6] text-muted-foreground">
            Въведи факултетния си номер – вариантът се изчислява по формулите от
            листа на курсовата.
          </p>
          <Label
            htmlFor="fac"
            className="text-sm font-bold text-muted-foreground"
          >
            Факултетен номер
          </Label>
          <Input
            id="fac"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={12}
            value={facultyNumber}
            onChange={(event) => setFacultyNumber(event.target.value)}
            className="h-[54px] max-w-[280px] rounded-xl border-line-strong bg-background px-[18px] font-mono text-[22px] md:text-[22px] dark:bg-background"
          />
        </div>
        <div
          className="flex min-w-0 flex-[1_1_380px] flex-col gap-3"
          aria-live="polite"
        >
          <span className="text-[13px] font-semibold text-dim">
            Курсова №1 · схема 1 · k₂ = {task?.k2 ?? "–"}, k₃ ={" "}
            {task?.k3 ?? "–"}, k₄ = {task?.k4 ?? "–"}
          </span>
          {task ? (
            <div className="flex flex-wrap gap-3">
              {values.map((item) => (
                <div
                  key={item.label}
                  className="flex flex-[1_1_140px] flex-col gap-1 rounded-[14px] bg-surface-2 p-[18px]"
                >
                  <span className="text-[13px] text-dim">{item.label}</span>
                  <span className="font-mono text-2xl">{item.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="rounded-[14px] bg-warn-bg p-[18px] text-warn-fg">
              Въведи поне 4 цифри.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
