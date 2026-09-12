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
 * the way in, motion is the beta a reader can already use, and the keyboard is
 * the old way that still works. The order and the two badges are the whole
 * story, so they are asserted here rather than left to a screenshot.
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

  it("selects the beta rather than explaining it away", () => {
    const onChange = mount();
    const motion = radio(/Motion to action/);
    expect(motion).not.toHaveAttribute("aria-disabled");
    fireEvent.click(motion);
    expect(onChange).toHaveBeenCalledWith("motion");
    // Nothing sits between the reader and the mode: no tooltip, no excuse.
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(motion).not.toHaveAttribute("aria-describedby");
  });

  it("keeps the beta badge on a mode that works", () => {
    mount("motion");
    const motion = radio(/Motion to action/);
    expect(motion).toHaveAttribute("aria-checked", "true");
    // Beta is a promise about how well it reads movement, not about whether a
    // reader may use it, so the badge stays on the selected mode.
    expect(within(motion).getByText("Beta")).toHaveClass("mode-detail");
  });

  it("walks the arrow keys through all three modes", () => {
    const onChange = mount();
    fireEvent.keyDown(radio(/Voice to action/), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("motion");
    fireEvent.keyDown(radio(/Motion to action/), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("text");
    fireEvent.keyDown(radio(/Keyboard to action/), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("voice");
    fireEvent.keyDown(radio(/Voice to action/), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("text");
    fireEvent.keyDown(radio(/Keyboard to action/), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("motion");
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
