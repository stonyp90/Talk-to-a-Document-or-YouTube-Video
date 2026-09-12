// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Pricing } from "./Pricing";
import {
  PAID_PRICE_VARIABLE,
  PAID_URL_VARIABLE,
  resolvePricingCopy,
} from "../content/pricing";

const copy = resolvePricingCopy("en");
const appHref = "/en/app";
const free = copy.plans[0];
const paid = copy.plans[1];
/** The cards, not the bullet points inside them. */
const cards = () =>
  Array.from(
    screen
      .getByRole("list", { name: copy.planListLabel })
      .querySelectorAll<HTMLElement>("[data-plan]"),
  );

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("Pricing", () => {
  it("names the section and puts both ways side by side", () => {
    render(<Pricing appHref={appHref} />);
    const section = screen.getByRole("region", { name: copy.heading });
    expect(section).toHaveAttribute("id", "pricing");
    expect(section).toHaveTextContent(copy.intro);
    const items = cards();
    expect(items).toHaveLength(copy.plans.length);
    items.forEach((item, index) => {
      const entry = copy.plans[index];
      expect(item).toHaveTextContent(entry.name);
      expect(item).toHaveTextContent(entry.deal);
      expect(item).toHaveTextContent(entry.note);
      for (const point of entry.points) expect(item).toHaveTextContent(point);
    });
  });

  it("states the free condition and the paid promise on the cards themselves", () => {
    render(<Pricing appHref={appHref} />);
    const [freeCard, paidCard] = cards();
    expect(freeCard).toHaveTextContent(/used to train the models/i);
    expect(freeCard).toHaveAttribute("data-plan", "free");
    expect(paidCard).toHaveTextContent(/never/i);
    expect(paidCard).toHaveAttribute("data-plan", "paid");
    expect(
      within(freeCard).getByRole("link", { name: free.action }),
    ).toHaveAttribute("href", appHref);
    expect(screen.getByText(copy.promise)).toBeInTheDocument();
  });

  it("says billing is not open rather than inventing a price", () => {
    vi.stubEnv(PAID_PRICE_VARIABLE, "");
    vi.stubEnv(PAID_URL_VARIABLE, "");
    render(<Pricing appHref={appHref} />);
    const paidCard = cards()[1];
    expect(paidCard).toHaveTextContent(paid.amount);
    expect(paidCard).toHaveTextContent(copy.pending);
    expect(
      within(paidCard).queryByRole("link", { name: paid.action }),
    ).not.toBeInTheDocument();
  });

  it("shows the configured figure and sign-up link once billing opens", () => {
    vi.stubEnv(PAID_PRICE_VARIABLE, "9 $ / month");
    vi.stubEnv(PAID_URL_VARIABLE, "https://ursly.io/paid");
    render(<Pricing appHref={appHref} />);
    const paidCard = cards()[1];
    expect(paidCard).toHaveTextContent("9 $ / month");
    expect(paidCard).not.toHaveTextContent(copy.pending);
    expect(
      within(paidCard).getByRole("link", { name: paid.action }),
    ).toHaveAttribute("href", "https://ursly.io/paid");
  });

  it("speaks French when asked, and English for anything else", () => {
    const french = resolvePricingCopy("fr");
    render(<Pricing locale="fr-CA" appHref={appHref} />);
    expect(
      screen.getByRole("heading", { name: french.heading }),
    ).toBeInTheDocument();
    cleanup();
    render(<Pricing locale="de" appHref={appHref} />);
    expect(
      screen.getByRole("heading", { name: copy.heading }),
    ).toBeInTheDocument();
  });
});
