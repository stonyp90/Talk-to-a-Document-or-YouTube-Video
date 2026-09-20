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
import { AppPreferences, TopNav } from "./TopNav";
import { LanguageProvider } from "../i18n/LanguageProvider";
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

const landing = () => mount(<TopNav page="landing" />);

/** The same bar, read by someone whose page is in French. */
const landingInFrench = () =>
  render(
    <LanguageProvider language="fr" dictionary={dictionaryFor("fr")}>
      <TopNav page="landing" />
    </LanguageProvider>,
  );

const navigation = () => screen.getByRole("navigation", { name: "Primary" });

afterEach(cleanup);

describe("the fixed top menu", () => {
  it("carries the way into the app as a voice mark, not a plain button", () => {
    landing();
    const open = screen.getByRole("link", { name: "Open the app" });
    expect(open).toHaveAttribute("href", "/en/app");
    expect(open.querySelector(".nav-orb")).toBeInTheDocument();
    // The rings are drawn, not written: nothing for a screen reader to read.
    expect(open.querySelector(".nav-orb")).toHaveAttribute("aria-hidden");
  });

  it("names the app Sense to Action while retaining the wave logo", () => {
    mount(<TopNav page="app" mode="human" onModeChange={() => {}} />);
    const brand = screen.getByRole("link", { name: "Sense to Action home" });
    expect(brand).toHaveTextContent("Sense to Action");
    expect(brand.querySelector(".brand-mark")).toHaveAttribute(
      "src",
      "/brand/ursly-mark.svg",
    );
    expect(brand.querySelector(".brand-dot")).toBeNull();
  });

  it("preserves the existing landing brand", () => {
    landing();
    const brand = screen.getByRole("link", { name: "Ursly home" });
    expect(brand).toHaveTextContent("ursly.");
    expect(brand.querySelector(".brand-mark")).toHaveAttribute(
      "src",
      "/brand/ursly-mark.svg",
    );
  });

  it("keeps the app header to the brand and input choices", () => {
    mount(<TopNav page="app" mode="human" onModeChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "Sense" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Back to the story" }),
    ).toBeNull();
    expect(screen.queryByRole("link", { name: "Français" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Use .* theme/ })).toBeNull();
  });

  it("keeps story, language and theme available together in settings", () => {
    mount(<AppPreferences />);
    expect(
      screen.getByRole("link", { name: "Back to the story" }),
    ).toHaveAttribute("href", "/en");
    expect(screen.getByRole("link", { name: "Français" })).toHaveAttribute(
      "href",
      "/fr",
    );
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    const toggle = screen.getByRole("button", { name: "Use dark theme" });
    fireEvent.click(toggle);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    fireEvent.click(screen.getByRole("button", { name: "Use light theme" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("represents the immersive experience as human senses", () => {
    mount(<TopNav page="app" mode="immersive" onModeChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "Sense" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByText("Legacy")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("reflects keyboard selection without leaving the application", () => {
    const onModeChange = vi.fn();
    mount(<TopNav page="app" mode="text" onModeChange={onModeChange} />);
    expect(
      screen.getByRole("radio", { name: "Keyboard to action" }),
    ).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Sense" }));
    expect(onModeChange).toHaveBeenCalledWith("human");
  });

  /**
   * The drawer is the whole menu on a narrow screen, and the part of the page
   * most often reworded without anyone reaching for French. Its four labels
   * come from the dictionary, so they are checked there rather than spelled
   * out again: a key that goes missing reads English to a French reader, and
   * a key that is renamed reads English to both.
   */
  it("speaks French in the narrow-screen drawer", () => {
    landingInFrench();
    const trigger = screen.getByRole("button", { name: french["Open menu"] });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-label", french["Close menu"]);
    const panel = document.getElementById("mobile-navigation");
    expect(panel).toBeInTheDocument();
    expect(
      within(panel as HTMLElement).getByText(french.Navigate),
    ).toBeInTheDocument();
    fireEvent.click(
      within(panel as HTMLElement).getByRole("button", {
        name: french.Close,
      }),
    );
    expect(trigger).toHaveAttribute("aria-label", french["Open menu"]);
  });

  it("speaks French in the bar itself", () => {
    landingInFrench();
    const open = screen.getByRole("link", { name: french["Open the app"] });
    expect(open).toHaveAttribute("href", "/fr/app");
    expect(open.querySelector(".nav-cta-short")).toHaveTextContent(french.App);
  });

  it("provides a mobile menu", () => {
    landing();
    const trigger = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(trigger);
    const panel = document.getElementById("mobile-navigation");
    expect(panel).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(
      screen.getByRole("button", { name: "Open menu" }),
    ).toBeInTheDocument();
  });
});
