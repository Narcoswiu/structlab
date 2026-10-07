/** Праща събитие към сървъра. Никога не хвърля грешка и не пречи на четенето. */
export function trackEvent(event: Record<string, string>): void {
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      // заявката да завърши, дори потребителят да напусне страницата
      keepalive: true,
    }).catch(() => {});
  } catch {
    // проследяването е второстепенно
  }
}
