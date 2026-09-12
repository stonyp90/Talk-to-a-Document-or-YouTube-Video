// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React, { createRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TopNav } from "./TopNav";
import { LanguageProvider } from "../i18n/LanguageProvider";
import { MENU_SECTIONS } from "../content/story";
import { appDownloads } from "../content/downloads";
import { dictionaryFor } from "../i18n/dictionaries";
import { french } from "../i18n/fr";

vi.mock("next/navigation", () => ({ usePathname: () => "/en" }));

/** The menu reads its language from context, as it does on a real page. */
const mount = (ui: React.ReactElement) =>
  render(
    <LanguageProvider language="en" dictionary={{}}>
      {ui}
    </LanguageProvider>,
  );

const landing = () =>
  mount(
    <TopNav
      page="landing"
      onReplayIntro={() => {}}
      replayButton={createRef<HTMLButtonElement>()}
    />,
  );

/** The same bar, read by someone whose page is in French. */
const landingInFrench = () =>
  render(
    <LanguageProvider language="fr" dictionary={dictionaryFor("fr")}>
      <TopNav
        page="landing"
        onReplayIntro={() => {}}
        replayButton={createRef<HTMLButtonElement>()}
      />
    </LanguageProvider>,
  );

const navigation = () => screen.getByRole("navigation", { name: "Primary" });

afterEach(cleanup);

describe("the fixed top menu", () => {
  it("numbers the story anchors, so the bar reads as an index", () => {
    landing();
    const indices = navigation().querySelectorAll(".nav-index");
    expect(indices).toHaveLength(MENU_SECTIONS.length);
    // Counted off the menu itself rather than written out here, so a section
    // joining or leaving the bar needs no edit to this test.
    expect([...indices].map((node) => node.textContent)).toEqual(
      MENU_SECTIONS.map((_, position) => String(position + 1).padStart(2, "0")),
    );
    // Decoration: the accessible name stays the section's own name.
    for (const index of indices) expect(index).toHaveAttribute("aria-hidden");
    expect(
      screen.getByRole("link", { name: MENU_SECTIONS[0].label }),
    ).toHaveAttribute("href", `#${MENU_SECTIONS[0].id}`);
  });

  it("carries the way into the app as a voice mark, not a plain button", () => {
    landing();
    const open = screen.getByRole("link", { name: "Open the app" });
    expect(open).toHaveAttribute("href", "/en/app");
    expect(open.querySelector(".nav-orb")).toBeInTheDocument();
    // The rings are drawn, not written: nothing for a screen reader to read.
    expect(open.querySelector(".nav-orb")).toHaveAttribute("aria-hidden");
  });

  it("reports how far the story has been read, for the bar to draw", () => {
    landing();
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: 3000,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: 1000,
      configurable: true,
    });
    window.scrollY = 500;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(navigation().style.getPropertyValue("--nav-progress")).toBe("0.25");
    expect(navigation()).toHaveAttribute("data-scrolled", "true");
  });

  it("leaves the story index behind in the application", () => {
    mount(<TopNav page="app" mode="voice" onModeChange={() => {}} />);
    expect(navigation().querySelectorAll(".nav-index")).toHaveLength(0);
    expect(
      screen.getByRole("link", { name: "Back to the story" }),
    ).toHaveAttribute("href", "/en");
  });

  /**
   * Two ways in, and they are not the same way: "Open the app" opens the web
   * application, "Get the app" descends to the builds you install. A reader
   * who wants the APK must not have to guess which one carries it, so the
   * downloads control is a plain in-page anchor to the applications section
   * rather than something that only reveals itself once pressed.
   */
  it("carries a 'Get the app' that descends to the downloads", () => {
    landing();
    const get = screen.getByRole("link", { name: "Get the app" });
    expect(get).toHaveAttribute("href", "#applications");
    expect(get.querySelector(".icon-download")).toBeInTheDocument();
    // Distinct from the way into the web application, not a second name for it.
    expect(screen.getByRole("link", { name: "Open the app" })).not.toBe(get);
  });

  it("offers the builds themselves once the control is reached", () => {
    landing();
    const get = screen.getByRole("link", { name: "Get the app" });
    expect(screen.queryByRole("link", { name: /Android APK/ })).toBeNull();
    act(() => {
      fireEvent.focus(get);
    });
    for (const build of appDownloads)
      expect(
        screen.getByRole("link", { name: new RegExp(build.label) }),
      ).toHaveAttribute("href", build.url);
  });

  /** From the application the section is a page away, not a scroll away. */
  it("keeps the downloads reachable from the application page", () => {
    mount(<TopNav page="app" mode="voice" onModeChange={() => {}} />);
    expect(screen.getByRole("link", { name: "Get the app" })).toHaveAttribute(
      "href",
      "/en#applications",
    );
  });

  it("names the downloads control in French", () => {
    landingInFrench();
    expect(
      screen.getByRole("link", { name: french["Get the app"] }),
    ).toHaveAttribute("href", "#applications");
  });
});
