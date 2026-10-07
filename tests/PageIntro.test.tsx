import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { PageIntro } from "@/components/PageIntro";

function renderIntro(id = "test-screen") {
  return render(
    <PageIntro id={id} title="Табло – твоят начален екран">
      Оттук продължаваш откъдето си спрял.
    </PageIntro>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("PageIntro", () => {
  it("показва заглавието, текста и линк към обиколката", () => {
    renderIntro();
    expect(screen.getByText("КАКВО Е ТАЗИ СТРАНИЦА")).toBeInTheDocument();
    expect(screen.getByText("Табло – твоят начален екран")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Пълна обиколка" }),
    ).toHaveAttribute("href", "/welcome");
  });

  it("се скрива след „Разбрах“ и остава скрито при ново отваряне", async () => {
    const { unmount } = renderIntro();
    await userEvent.click(screen.getByRole("button", { name: "Разбрах" }));
    expect(screen.queryByText("КАКВО Е ТАЗИ СТРАНИЦА")).not.toBeInTheDocument();

    unmount();
    renderIntro();
    expect(screen.queryByText("КАКВО Е ТАЗИ СТРАНИЦА")).not.toBeInTheDocument();
  });

  it("помни избора отделно за всеки екран", async () => {
    const first = renderIntro("screen-a");
    await userEvent.click(screen.getByRole("button", { name: "Разбрах" }));
    first.unmount();

    renderIntro("screen-b");
    expect(screen.getByText("КАКВО Е ТАЗИ СТРАНИЦА")).toBeInTheDocument();
  });
});
