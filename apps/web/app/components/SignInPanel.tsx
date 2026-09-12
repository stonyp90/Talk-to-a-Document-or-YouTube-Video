"use client";

import { useId, useState, type FormEvent } from "react";
import { useLanguage } from "../i18n/LanguageProvider";
import {
  confirmSignInCode,
  requestSignInCode,
} from "@/apps/web/src/lib/account";
import { ApiError } from "@/apps/web/src/lib/api";

/**
 * Sign-in, in two steps and no passwords: an address, then the code that was
 * mailed to it. Reading the mailbox is the proof, so there is no credential for
 * the reader to invent, forget or reuse from somewhere less careful.
 *
 * The panel mounts nowhere by itself; the page decides where it belongs.
 */
export function SignInPanel({
  onSignedIn,
  email: initialEmail = "",
}: {
  onSignedIn: (email: string) => void;
  email?: string;
}) {
  const { t } = useLanguage();
  const emailId = useId();
  const codeId = useId();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /**
   * The server's message is already written for a reader and is translated
   * here; anything unexpected falls back to one sentence rather than leaking a
   * status code into the interface.
   */
  function explain(thrown: unknown): string {
    if (thrown instanceof ApiError && thrown.message) return t(thrown.message);
    return t("Something went wrong. Please try again.");
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (thrown) {
      setError(explain(thrown));
    } finally {
      setBusy(false);
    }
  }

  const sendCode = (event: FormEvent) => {
    event.preventDefault();
    return run(async () => {
      await requestSignInCode(email);
      setCode("");
      setStage("code");
    });
  };

  const confirm = (event: FormEvent) => {
    event.preventDefault();
    return run(async () => {
      const session = await confirmSignInCode(email, code);
      onSignedIn(session.email);
    });
  };

  return (
    <section className="card sign-in" aria-labelledby={`${emailId}-title`}>
      <h2 id={`${emailId}-title`} className="sign-in-title">
        {t("Sign in to keep going")}
      </h2>
      <p className="hint">
        {t(
          "Reading a source and answering out loud runs on a paid model. Signing in ties that spending to an account, with a limit, instead of leaving it open to everyone.",
        )}
      </p>

      {stage === "email" ? (
        <form className="sign-in-form" onSubmit={sendCode}>
          <div className="field">
            <label htmlFor={emailId}>{t("Email address")}</label>
            <input
              id={emailId}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("you@example.com")}
            />
          </div>
          <p className="hint">
            {t("We send a one-time code. There is no password to remember.")}
          </p>
          <div className="actions">
            <button type="submit" className="primary" disabled={busy || !email}>
              {busy ? t("Sending…") : t("Send me a code")}
            </button>
          </div>
        </form>
      ) : (
        <form className="sign-in-form" onSubmit={confirm}>
          <div className="field">
            <label htmlFor={codeId}>{t("Your code")}</label>
            <input
              id={codeId}
              type="text"
              name="code"
              autoComplete="one-time-code"
              inputMode="numeric"
              // A pasted code often arrives with spaces around it.
              pattern="\s*\d{4,12}\s*"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          <p className="hint">
            {t("Check {email} for the code. It expires shortly.", { email })}
          </p>
          <div className="actions">
            <button type="submit" className="primary" disabled={busy || !code}>
              {busy ? t("Checking…") : t("Sign in")}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                setStage("email");
                setError("");
              }}
            >
              {t("Use another address")}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="error sign-in-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
