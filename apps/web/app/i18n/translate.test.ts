import { describe, expect, it } from "vitest";
import { createTranslator } from "./translate";

describe("createTranslator", () => {
  const t = createTranslator({
    Send: "Envoyer",
    "Uploading · {percent}%": "Téléversement · {percent} %",
  });

  it("returns the English key when no translation exists", () => {
    expect(t("Stop")).toBe("Stop");
  });

  it("translates a known key", () => {
    expect(t("Send")).toBe("Envoyer");
  });

  it("interpolates named values in either language", () => {
    expect(t("Uploading · {percent}%", { percent: 42 })).toBe(
      "Téléversement · 42 %",
    );
    const english = createTranslator({});
    expect(english("Uploading · {percent}%", { percent: 7 })).toBe(
      "Uploading · 7%",
    );
  });

  it("leaves unknown placeholders untouched", () => {
    expect(t("Hello {name}")).toBe("Hello {name}");
  });
});
