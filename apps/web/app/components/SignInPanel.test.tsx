// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SignInPanel } from "./SignInPanel";
import { LanguageProvider } from "../i18n/LanguageProvider";
import { french } from "../i18n/fr";
import { ApiError } from "@/apps/web/src/lib/api";

vi.mock("@/apps/web/src/lib/account", () => ({
  requestSignInCode: vi.fn(),
  confirmSignInCode: vi.fn(),
}));
import {
  confirmSignInCode,
  requestSignInCode,
} from "@/apps/web/src/lib/account";

const show = (onSignedIn = vi.fn(), language: "en" | "fr" = "en") =>
  render(
    <LanguageProvider
      language={language}
      dictionary={language === "fr" ? french : {}}
    >
      <SignInPanel onSignedIn={onSignedIn} />
    </LanguageProvider>,
  );

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const press = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));

beforeEach(() => {
  vi.mocked(requestSignInCode).mockResolvedValue(undefined);
  vi.mocked(confirmSignInCode).mockResolvedValue({
    email: "reader@example.com",
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("asks for an address, then for the code that was mailed to it", async () => {
  const onSignedIn = vi.fn();
  show(onSignedIn);

  fill("Email address", "reader@example.com");
  press("Send me a code");
  expect(requestSignInCode).toHaveBeenCalledWith("reader@example.com");

  fireEvent.change(await screen.findByLabelText("Your code"), {
    target: { value: "123456" },
  });
  press("Sign in");

  expect(await screen.findByRole("button", { name: "Sign in" })).toBeEnabled();
  expect(confirmSignInCode).toHaveBeenCalledWith(
    "reader@example.com",
    "123456",
  );
  expect(onSignedIn).toHaveBeenCalledWith("reader@example.com");
});

it("shows the server's own explanation when a code is refused", async () => {
  vi.mocked(confirmSignInCode).mockRejectedValue(
    new ApiError(
      "That code is not valid. Check it and try again.",
      "CODE_INVALID",
      401,
    ),
  );
  show();

  fill("Email address", "reader@example.com");
  press("Send me a code");
  fireEvent.change(await screen.findByLabelText("Your code"), {
    target: { value: "000000" },
  });
  press("Sign in");

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "That code is not valid. Check it and try again.",
  );
});

it("stays on the address step when the address is refused", async () => {
  vi.mocked(requestSignInCode).mockRejectedValue(
    new ApiError("Enter a valid email address.", "INVALID_EMAIL", 400),
  );
  show();

  fill("Email address", "nope@example.com");
  press("Send me a code");

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Enter a valid email address.",
  );
  expect(screen.queryByLabelText("Your code")).not.toBeInTheDocument();
});

it("never asks the reader to invent a password", () => {
  show();
  expect(document.querySelector('input[type="password"]')).toBeNull();
});

it("lets the reader go back and use another address", async () => {
  show();
  fill("Email address", "reader@example.com");
  press("Send me a code");
  await screen.findByLabelText("Your code");
  press("Use another address");
  expect(screen.getByLabelText("Email address")).toHaveValue(
    "reader@example.com",
  );
});

it("speaks French when the page does", async () => {
  show(vi.fn(), "fr");
  expect(
    screen.getByRole("button", { name: french["Send me a code"] }),
  ).toBeInTheDocument();
  fill(french["Email address"], "reader@example.com");
  press(french["Send me a code"]);
  expect(await screen.findByLabelText(french["Your code"])).toBeInTheDocument();
});
