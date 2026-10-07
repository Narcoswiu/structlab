"use client";

import { useEffect } from "react";
import { trackEvent } from "./trackEvent";

/** Отбелязва, че лабораторията е отворена. Числата в нея не се записват. */
export function LabTracker({ lab }: { lab: "beam" | "section" }) {
  useEffect(() => {
    trackEvent({ type: "lab_open", lab });
  }, [lab]);
  return null;
}
