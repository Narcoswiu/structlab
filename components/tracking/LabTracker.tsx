"use client";

import { useEffect } from "react";
import type { LabId } from "@/lib/lab-ids";
import { trackEvent } from "./trackEvent";

/** Отбелязва, че лабораторията е отворена. Числата в нея не се записват. */
export function LabTracker({ lab }: { lab: LabId }) {
  useEffect(() => {
    trackEvent({ type: "lab_open", lab });
  }, [lab]);
  return null;
}
