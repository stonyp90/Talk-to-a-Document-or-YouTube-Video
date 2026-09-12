"use client";

import { useEffect, useRef } from "react";
import { SignInPanel } from "./SignInPanel";
import { useLanguage } from "../i18n/LanguageProvider";

/**
 * The gate in front of the workspace, as a modal dialog rather than a card in
 * the page.
 *
 * Every source read and every answer spoken spends provider credit, so the
 * feature opens for an account or not at all. A card beside the workspace
 * said that while leaving the workspace there to be poked at; a modal dialog
 * is the one thing the platform gives us that makes everything behind it
 * inert, keeps focus inside, and cannot be tabbed around. It refuses Escape
 * for the same reason: dismissing the gate would be a way in.
 *
 * The menu is behind the dialog too, so the way back to the story travels
 * inside it. Signing in is the only other way out, and the API applies the
 * same rule regardless of what any of this draws.
 */
export function SignInGate({
  open,
  onSignedIn,
  storyHref,
}: {
  open: boolean;
  onSignedIn: (email: string) => void;
  /** Where "back to the story" leads, in the reader's language. */
  storyHref: string;
}) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);

  // Open and close the native dialog in step with the prop.
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      // A test DOM may lack the dialog API; the attribute still shows it.
      if (typeof element.showModal === "function") element.showModal();
      else element.setAttribute("open", "");
    } else if (!open && element.open) {
      if (typeof element.close === "function") element.close();
      else element.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="sign-in-gate"
      aria-label={t("Sign in to keep going")}
      // Escape asks to close; the answer is no, because behind it is the
      // thing the gate exists to hold shut.
      onCancel={(event) => event.preventDefault()}
    >
      <div className="sign-in-gate-inner">
        <SignInPanel onSignedIn={onSignedIn} />
        <p className="sign-in-gate-exit">
          <a href={storyHref}>{t("Back to the story")}</a>
        </p>
      </div>
    </dialog>
  );
}
