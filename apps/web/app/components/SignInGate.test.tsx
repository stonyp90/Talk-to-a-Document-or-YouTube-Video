// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignInGate } from "./SignInGate";
import { LanguageProvider } from "../i18n/LanguageProvider";
import { dictionaryFor } from "../i18n/dictionaries";

vi.mock("@/apps/web/src/lib/account", () => ({
  requestSignInCode: vi.fn().mockResolvedValue(undefined),
  confirmSignInCode: vi.fn().mockResolvedValue({ email: "reader@example.com" }),
}));

const show = (open: boolean, language: "en" | "fr" = "en") =>
  render(
    <LanguageProvider language={language} dictionary={dictionaryFor(language)}>
      <SignInGate
        open={open}
        onSignedIn={() => {}}
        storyHref={`/${language}`}
      />
    </LanguageProvider>,
  );

const gate = () => document.querySelector("dialog.sign-in-gate")!;

afterEach(cleanup);

describe("SignInGate", () => {
  it("stands over the feature as a modal, not beside it in the page", () => {
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.showModal = showModal;
    show(true);
    expect(gate()).toHaveAttribute("open");
    // A modal dialog is the one thing that makes the page behind it inert;
    // an ordinary open dialog would leave the workspace usable underneath.
    expect(showModal).toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Sign in to keep going" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  });

  it("cannot be dismissed to reach the feature behind it", () => {
    show(true);
    const dialog = gate();
    const cancel = new Event("cancel", { cancelable: true, bubbles: true });
    fireEvent(dialog, cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog).toHaveAttribute("open");
    // Nothing in the gate closes it either: the way out is signing in, or
    // leaving the page altogether.
    expect(
      screen.queryByRole("button", { name: /close|skip|dismiss/i }),
    ).not.toBeInTheDocument();
  });

  it("offers the way back to the story, since the menu is behind it", () => {
    show(true, "fr");
    expect(
      screen.getByRole("link", { name: "Retour à l’histoire" }),
    ).toHaveAttribute("href", "/fr");
  });

  it("is not in the way once there is an account", () => {
    show(false);
    expect(gate()).not.toHaveAttribute("open");
  });
});
