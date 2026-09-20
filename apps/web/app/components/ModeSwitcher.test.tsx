// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModeSwitcher, type EntryMode } from "./ModeSwitcher";

afterEach(cleanup);

const radios = () => screen.getAllByRole("radio");
const radio = (name: RegExp) => screen.getByRole("radio", { name });

function mount(mode: EntryMode = "human") {
  const onChange = vi.fn();
  render(<ModeSwitcher mode={mode} onChange={onChange} />);
  return onChange;
}

describe("ModeSwitcher", () => {
  it("offers human senses together with keyboard input in one control", () => {
    mount();
    expect(radios().map((item) => item.getAttribute("aria-label"))).toEqual([
      "Sense",
      "Keyboard to action",
    ]);
    expect(screen.queryByRole("radio", { name: "Voice to action" })).toBeNull();
    expect(
      screen.queryByRole("radio", { name: "Motion to action" }),
    ).toBeNull();
  });

  it.each(["voice", "motion"] as const)(
    "maps saved %s preferences to human senses",
    (mode) => {
      mount(mode);
      expect(radio(/^Sense$/)).toHaveAttribute("aria-checked", "true");
      expect(radios()).toHaveLength(2);
    },
  );

  it("keeps Sense clear and shows small status tags on keyboard and brain", () => {
    mount();
    expect(within(radio(/^Sense$/)).queryByText(/^(Beta|Legacy)$/)).toBeNull();
    expect(within(radio(/Keyboard to action/)).getByText("Legacy")).toHaveClass(
      "mode-detail",
    );
    expect(
      within(screen.getByRole("button", { name: "Brain to action" })).getByText(
        "Beta",
      ),
    ).toHaveClass("mode-detail");
    expect(radio(/^Sense$/).querySelector(".icon")).toBeInTheDocument();
  });

  it("keeps brain unavailable without claiming functional support", () => {
    const onChange = mount();
    const brain = screen.getByRole("button", { name: "Brain to action" });
    expect(brain).toHaveAttribute("aria-disabled", "true");
    expect(brain).toHaveClass("mode-brain", "mode-unavailable");
    fireEvent.click(brain);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps keyboard input selectable with its Legacy tag", () => {
    const onChange = mount();
    const keyboard = radio(/Keyboard to action/);
    expect(keyboard).not.toHaveAttribute("aria-disabled");
    fireEvent.click(keyboard);
    expect(onChange).toHaveBeenCalledWith("text");
  });

  it("returns to the shared human sense experience", () => {
    const onChange = mount("text");
    fireEvent.click(radio(/^Sense$/));
    expect(onChange).toHaveBeenCalledWith("human");
  });

  it("walks arrow keys through the available inputs and moves focus", () => {
    const onChange = mount();
    const human = radio(/^Sense$/);
    const keyboard = radio(/Keyboard to action/);
    fireEvent.keyDown(human, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("text");
    expect(keyboard).toHaveFocus();
    fireEvent.keyDown(keyboard, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("human");
    expect(human).toHaveFocus();
    fireEvent.keyDown(human, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("text");
  });

  it("sends Home to human senses and End to the keyboard", () => {
    const onChange = mount("text");
    fireEvent.keyDown(radio(/Keyboard to action/), { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("human");
    fireEvent.keyDown(radio(/^Sense$/), { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith("text");
  });

  it.each(["human", "text"] as const)(
    "keeps only the selected %s input in the tab sequence",
    (mode) => {
      mount(mode);
      expect(radios().filter((item) => item.tabIndex === 0)).toHaveLength(1);
      const selected =
        mode === "human" ? radio(/^Sense$/) : radio(/Keyboard to action/);
      expect(selected).toHaveAttribute("aria-checked", "true");
      expect(selected).toHaveAttribute("tabindex", "0");
    },
  );
});
