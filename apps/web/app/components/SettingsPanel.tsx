"use client";
import styles from "./SettingsPanel.module.css";

export type AppSettings = {
  language: string;
  theme: string;
  assistantName: string;
  voiceOutput: boolean;
  voiceSpeed: number;
  cameraEnabled: boolean;
  videoPreviewOpacity: number;
  handPreference: "left" | "right";
  keyboardEnabled: boolean;
  nonVerbalTracking: boolean;
};

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => void;
}

export function SettingsPanel({
  open,
  onClose,
  settings,
  onUpdate,
}: SettingsPanelProps) {
  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
      >
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>General</h3>
          <div className={styles.row}>
            <label>Assistant name</label>
            <input
              type="text"
              className={styles.textInput}
              value={settings.assistantName}
              onChange={(e) => onUpdate("assistantName", e.target.value)}
            />
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Voice &amp; Audio</h3>
          <div className={styles.row}>
            <label>Voice output</label>
            <button
              className={styles.toggle}
              aria-pressed={settings.voiceOutput}
              onClick={() => onUpdate("voiceOutput", !settings.voiceOutput)}
            >
              {settings.voiceOutput ? "On" : "Off"}
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Camera &amp; Motion</h3>
          <div className={styles.row}>
            <label>Camera</label>
            <button
              className={styles.toggle}
              aria-pressed={settings.cameraEnabled}
              onClick={() =>
                onUpdate("cameraEnabled", !settings.cameraEnabled)
              }
            >
              {settings.cameraEnabled ? "On" : "Off"}
            </button>
          </div>
          <div className={styles.row}>
            <label>Hand preference</label>
            <button
              className={styles.toggle}
              onClick={() =>
                onUpdate(
                  "handPreference",
                  settings.handPreference === "left" ? "right" : "left",
                )
              }
            >
              {settings.handPreference === "left" ? "Left" : "Right"}
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Keyboard</h3>
          <div className={styles.row}>
            <label>Enable keyboard input</label>
            <button
              className={styles.toggle}
              aria-pressed={settings.keyboardEnabled}
              onClick={() =>
                onUpdate("keyboardEnabled", !settings.keyboardEnabled)
              }
            >
              {settings.keyboardEnabled ? "On" : "Off"}
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Non-Verbal Tracking</h3>
          <div className={styles.row}>
            <label>Tracking</label>
            <button
              className={styles.toggle}
              aria-pressed={settings.nonVerbalTracking}
              onClick={() =>
                onUpdate(
                  "nonVerbalTracking",
                  !settings.nonVerbalTracking,
                )
              }
            >
              {settings.nonVerbalTracking ? "On" : "Off"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
