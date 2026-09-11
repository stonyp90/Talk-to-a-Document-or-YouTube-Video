import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  isLanguage,
  negotiateLanguage,
  pathLanguage,
} from "./languages";

describe("negotiateLanguage", () => {
  it("falls back to English when nothing is known", () => {
    expect(negotiateLanguage({})).toBe(DEFAULT_LANGUAGE);
    expect(negotiateLanguage({ acceptLanguage: "" })).toBe("en");
    expect(negotiateLanguage({ acceptLanguage: "*" })).toBe("en");
  });

  it("chooses French for any French region", () => {
    expect(negotiateLanguage({ acceptLanguage: "fr-CA,fr;q=0.9,en;q=0.8" })).toBe("fr");
    expect(negotiateLanguage({ acceptLanguage: "fr" })).toBe("fr");
    expect(negotiateLanguage({ acceptLanguage: "FR-fr" })).toBe("fr");
  });

  it("respects quality ordering rather than list order", () => {
    expect(negotiateLanguage({ acceptLanguage: "fr;q=0.3,en-US;q=0.8" })).toBe("en");
    expect(negotiateLanguage({ acceptLanguage: "de,fr;q=0.9,en;q=0.5" })).toBe("fr");
  });

  it("uses English when the browser prefers an unsupported language", () => {
    expect(negotiateLanguage({ acceptLanguage: "de-DE,de;q=0.9" })).toBe("en");
  });

  it("lets a stored preference win over the browser", () => {
    expect(negotiateLanguage({ cookie: "fr", acceptLanguage: "en-US" })).toBe("fr");
    expect(negotiateLanguage({ cookie: "en", acceptLanguage: "fr-CA" })).toBe("en");
    expect(negotiateLanguage({ cookie: "xx", acceptLanguage: "fr-CA" })).toBe("fr");
  });
});

describe("pathLanguage", () => {
  it("reads an explicit language segment", () => {
    expect(pathLanguage("/fr")).toBe("fr");
    expect(pathLanguage("/en/")).toBe("en");
    expect(pathLanguage("/")).toBeUndefined();
    expect(pathLanguage("/french")).toBeUndefined();
    expect(pathLanguage("/de")).toBeUndefined();
  });
});

it("exposes the cookie name and a type guard", () => {
  expect(LANGUAGE_COOKIE).toBe("ursly-language");
  expect(isLanguage("fr")).toBe(true);
  expect(isLanguage("it")).toBe(false);
});
