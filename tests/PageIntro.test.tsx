import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PageIntro } from "@/components/PageIntro";

function renderIntro(dismissed = false) {
  const onDismiss = vi.fn(async () => {});
  render(
    <PageIntro
      id="dashboard"
      title="Табло – твоят начален екран"
      dismissed={dismissed}
      onDismiss={onDismiss}
    >
      Оттук продължаваш откъдето си спрял.
    </PageIntro>,
  );
  return onDismiss;
}

afterEach(cleanup);

describe("PageIntro", () => {
  it("показва заглавието, текста и линк към обиколката", () => {
    renderIntro();
    expect(screen.getByText("КАКВО Е ТАЗИ СТРАНИЦА")).toBeInTheDocument();
    expect(screen.getByText("Табло – твоят начален екран")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Пълна обиколка" }),
    ).toHaveAttribute("href", "/welcome");
  });

  it("не се показва, ако потребителят вече го е скрил", () => {
    renderIntro(true);
    expect(screen.queryByText("КАКВО Е ТАЗИ СТРАНИЦА")).not.toBeInTheDocument();
  });

  it("„Разбрах“ го скрива веднага и записва избора за този екран", async () => {
    const onDismiss = renderIntro();
    await userEvent.click(screen.getByRole("button", { name: "Разбрах" }));
    expect(screen.queryByText("КАКВО Е ТАЗИ СТРАНИЦА")).not.toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalledExactlyOnceWith("dashboard");
  });
});
