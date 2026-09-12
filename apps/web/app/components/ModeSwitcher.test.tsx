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

function mount(mode: EntryMode = "voice") {
  const onChange = vi.fn();
  render(<ModeSwitcher mode={mode} onChange={onChange} />);
  return onChange;
}

/**
 * The switcher carries the product argument, not only a preference: voice is
 * the way in, motion is what comes next, and the keyboard is the old way that
 * still works. The order and the two badges are the whole story, so they are
 * asserted here rather than left to a screenshot.
 */
describe("ModeSwitcher", () => {
  it("reads voice first, motion next and the keyboard last", () => {
    mount();
    expect(radios().map((item) => item.getAttribute("aria-label"))).toEqual([
      "Voice to action",
      "Motion to action",
      "Keyboard to action",
    ]);
  });

  it("marks motion as the beta and the keyboard as legacy", () => {
    mount();
    expect(within(radio(/Motion to action/)).getByText("Beta")).toHaveClass(
      "mode-detail",
    );
    expect(within(radio(/Keyboard to action/)).getByText("Legacy")).toHaveClass(
      "mode-detail",
    );
    expect(radio(/Voice to action/).querySelector(".mode-detail")).toBeNull();
  });

  it("demotes the keyboard without disabling it", () => {
    const onChange = mount();
    const keyboard = radio(/Keyboard to action/);
    expect(keyboard).toHaveClass("mode-legacy");
    expect(keyboard).not.toHaveAttribute("aria-disabled");
    fireEvent.click(keyboard);
    expect(onChange).toHaveBeenCalledWith("text");
  });

  it("names the headsets motion is being built for, and stays honest about it", () => {
    mount();
    const motion = radio(/Motion to action/);
    expect(motion).toHaveAttribute("aria-disabled", "true");
    const tooltip = screen.getByRole("tooltip");
    expect(motion).toHaveAttribute("aria-describedby", tooltip.id);
    expect(tooltip).toHaveTextContent(/VR and AR headsets/i);
    expect(tooltip).toHaveTextContent(/not available yet/i);
  });

  it("explains the beta instead of selecting it", () => {
    const onChange = mount();
    const motion = radio(/Motion to action/);
    fireEvent.click(motion);
    expect(onChange).not.toHaveBeenCalled();
    expect(motion).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radiogroup")).toHaveAttribute(
      "data-explaining",
      "true",
    );
  });

  it("steps the arrow keys over the beta sitting in the middle", () => {
    const onChange = mount();
    fireEvent.keyDown(radio(/Voice to action/), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("text");
    fireEvent.keyDown(radio(/Voice to action/), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("text");
    fireEvent.keyDown(radio(/Motion to action/), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("text");
  });

  it("sends Home to voice and End to the keyboard", () => {
    const onChange = mount("text");
    fireEvent.keyDown(radio(/Keyboard to action/), { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("voice");
    fireEvent.keyDown(radio(/Keyboard to action/), { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith("text");
  });

  it("keeps one radio in the tab sequence", () => {
    mount("text");
    expect(radio(/Keyboard to action/)).toHaveAttribute("tabindex", "0");
    expect(radio(/Voice to action/)).toHaveAttribute("tabindex", "-1");
    expect(radio(/Motion to action/)).toHaveAttribute("tabindex", "-1");
  });
});
