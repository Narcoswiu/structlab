"use client";

import { useEffect } from "react";
import { trackEvent } from "./trackEvent";

type ReadingTrackerProps = {
  module: string;
  chapter: string;
  mode: "easy" | "detailed";
};

const HEARTBEAT_MS = 15_000;

/**
 * Следи четенето на една глава: отваряне, видени секции и „пулс“ на 15 секунди,
 * докато страницата е видима. Показва се само ако потребителят е приел известието.
 */
export function ReadingTracker({ module, chapter, mode }: ReadingTrackerProps) {
  useEffect(() => {
    const ref = { module, chapter };
    trackEvent({ type: "chapter_open", ...ref, mode });

    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (entry.isIntersecting && id && !seen.has(id)) {
            seen.add(id);
            trackEvent({ type: "section_view", ...ref, mode, section: id });
          }
        }
      },
      { rootMargin: "0px 0px -40% 0px" },
    );
    document
      .querySelectorAll(".reader-prose > h2[id]")
      .forEach((heading) => observer.observe(heading));

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        trackEvent({ type: "heartbeat", ...ref });
      }
    }, HEARTBEAT_MS);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [module, chapter, mode]);

  return null;
}
