"use client";

import { useState } from "react";
import { useLanguage } from "../i18n/LanguageProvider";
import styles from "./ConversationDemo.module.css";

/** The recording is fetched only when the visitor asks to watch it. */
export function ConversationDemo() {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <details
      id="voice-demo"
      className={styles.demo}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{t("Watch a real conversation")}</summary>
      <p>
        {t(
          "A spoken upload command, a document, and two questions. See Ursly in use.",
        )}
      </p>
      {open && (
        <video
          className={styles.player}
          controls
          playsInline
          preload="none"
          poster="/demo/voice-conversation.jpg"
          aria-label={t("Ursly voice conversation demonstration")}
          key={language}
        >
          <source src="/demo/voice-conversation.mp4" type="video/mp4" />
          <track
            kind="captions"
            src="/demo/voice-conversation.en.vtt"
            srcLang="en"
            label="English"
            default={language === "en"}
          />
          <track
            kind="captions"
            src="/demo/voice-conversation.fr.vtt"
            srcLang="fr"
            label="Français"
            default={language === "fr"}
          />
          {t("Your browser cannot play this video.")}
        </video>
      )}
      <p className={styles.note}>
        {t(
          "English audio · English and French captions. Recorded in the app with a generated caller voice and live answers.",
        )}
      </p>
    </details>
  );
}
