import { describe, expect, it } from "vitest";
import { createAskAllowance, isAllowedOrigin } from "./policy";

describe("who may open a live channel", () => {
  it("accepts any origin when none are configured", () => {
    expect(isAllowedOrigin("https://anywhere.example", [])).toBe(true);
  });

  it("accepts an origin the deployment named", () => {
    expect(
      isAllowedOrigin("https://ursly.io", [
        "https://ursly.io",
        "http://localhost:3000",
      ]),
    ).toBe(true);
  });

  it("refuses an origin the deployment did not name", () => {
    expect(isAllowedOrigin("https://evil.example", ["https://ursly.io"])).toBe(
      false,
    );
  });

  it("refuses a browser that sends no origin when origins are configured", () => {
    expect(isAllowedOrigin(undefined, ["https://ursly.io"])).toBe(false);
  });

  it("ignores a trailing slash, which a browser never sends but a variable often carries", () => {
    expect(isAllowedOrigin("https://ursly.io", ["https://ursly.io/"])).toBe(
      true,
    );
  });
});

describe("how many questions one connection may ask", () => {
  it("allows questions up to the limit", () => {
    const allowance = createAskAllowance({ limit: 2, windowMs: 1000 });
    expect(allowance.take(0)).toBe(true);
    expect(allowance.take(0)).toBe(true);
    expect(allowance.take(0)).toBe(false);
  });

  it("allows the next question once the window has passed", () => {
    const allowance = createAskAllowance({ limit: 1, windowMs: 1000 });
    expect(allowance.take(0)).toBe(true);
    expect(allowance.take(999)).toBe(false);
    expect(allowance.take(1000)).toBe(true);
  });

  it("lets a deployment turn the limit off for a suite that hammers it", () => {
    const allowance = createAskAllowance({
      limit: 1,
      windowMs: 1000,
      disabled: true,
    });
    expect(allowance.take(0)).toBe(true);
    expect(allowance.take(0)).toBe(true);
  });
});
