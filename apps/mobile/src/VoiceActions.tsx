import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Language, TranslationKey } from "./i18n";
import { palette as c, serif, Touch, Wave } from "./design";

export type MobileVoiceActionId = "youtube" | "upload" | "voice" | "summarize";

type VoiceTrigger = {
  id: string;
  phrase: string;
  action: MobileVoiceActionId;
};

type Props = {
  language: Language;
  motion: boolean;
  voiceBusy: boolean;
  canStartVoice: boolean;
  t: (key: TranslationKey) => string;
  onAction: (action: MobileVoiceActionId) => void;
};

const storageKey = "ursly-mobile-voice-triggers-v1";
const actionLabels: Record<MobileVoiceActionId, TranslationKey> = {
  youtube: "Open the YouTube source",
  upload: "Open the PDF picker",
  voice: "Start voice chat",
  summarize: "Prepare a key-ideas summary",
};
const examples: Array<{
  phrase: TranslationKey;
  action: MobileVoiceActionId;
  result: TranslationKey;
}> = [
  { phrase: "YouTube", action: "youtube", result: "switch to YouTube" },
  { phrase: "Upload", action: "upload", result: "open the PDF picker" },
  { phrase: "Let's talk", action: "voice", result: "start voice chat" },
  {
    phrase: "Summarize this",
    action: "summarize",
    result: "prepare a summary",
  },
];

function normalize(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function MobileVoiceActions({
  language,
  motion,
  voiceBusy,
  canStartVoice,
  t,
  onAction,
}: Props) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [action, setAction] = useState<MobileVoiceActionId>("upload");
  const [triggers, setTriggers] = useState<VoiceTrigger[]>([]);
  const [armed, setArmed] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [heard, setHeard] = useState("");
  const [notice, setNotice] = useState(
    t("Create a trigger, then arm voice actions to try it hands-free."),
  );
  const armedRef = useRef(false);
  const hydrated = useRef(false);
  const lastTrigger = useRef("");
  const restart = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onActionRef = useRef(onAction);

  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);
  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(storageKey).then((value) => {
      if (!mounted) return;
      try {
        const parsed = JSON.parse(value ?? "[]") as VoiceTrigger[];
        if (Array.isArray(parsed))
          setTriggers(
            parsed.filter(
              (item) =>
                item?.id && item?.phrase && item?.action in actionLabels,
            ),
          );
      } catch {
        /* Start with an empty trigger list when storage is invalid. */
      }
      hydrated.current = true;
    });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (hydrated.current)
      void AsyncStorage.setItem(storageKey, JSON.stringify(triggers));
  }, [triggers]);
  useEffect(
    () => () => {
      armedRef.current = false;
      if (restart.current) clearTimeout(restart.current);
      ExpoSpeechRecognitionModule.abort();
    },
    [],
  );
  useEffect(() => {
    if (!voiceBusy || !armedRef.current) return;
    armedRef.current = false;
    ExpoSpeechRecognitionModule.abort();
    setArmed(false);
    setRecognizing(false);
    setNotice(t("Voice actions paused while Ursly is busy."));
  }, [t, voiceBusy]);

  function stopListening() {
    armedRef.current = false;
    if (restart.current) clearTimeout(restart.current);
    ExpoSpeechRecognitionModule.stop();
    setArmed(false);
    setRecognizing(false);
    setNotice(t("Voice actions are off"));
  }

  function runAction(trigger: VoiceTrigger, transcript = trigger.phrase) {
    const key = `${trigger.id}:${normalize(transcript)}`;
    if (lastTrigger.current === key) return;
    lastTrigger.current = key;
    setTimeout(() => {
      if (lastTrigger.current === key) lastTrigger.current = "";
    }, 1400);
    setNotice(
      `${t("Triggered action")}: ${trigger.phrase} · ${t(actionLabels[trigger.action])}.`,
    );
    if (trigger.action === "upload" || trigger.action === "voice")
      stopListening();
    onActionRef.current(trigger.action);
  }

  function startListening() {
    if (voiceBusy) return;
    if (!triggers.length) {
      setOpen(true);
      setNotice(t("Create at least one trigger before arming voice actions."));
      return;
    }
    void ExpoSpeechRecognitionModule.requestPermissionsAsync()
      .then((permission) => {
        if (!permission.granted) {
          setNotice(t("Voice actions need microphone and speech permissions."));
          return;
        }
        armedRef.current = true;
        setArmed(true);
        setNotice(
          `${t("Listening for")} ${triggers.map((item) => `“${item.phrase}”`).join(", ")}.`,
        );
        ExpoSpeechRecognitionModule.start({
          lang: language === "fr" ? "fr-FR" : "en-US",
          interimResults: true,
          continuous: true,
          maxAlternatives: 1,
          contextualStrings: triggers.map((item) => item.phrase),
        });
      })
      .catch(() =>
        setNotice(t("Voice actions need microphone and speech permissions.")),
      );
  }

  function saveTrigger() {
    const nextPhrase = phrase.trim();
    if (!nextPhrase) return;
    setTriggers((current) => [
      ...current,
      { id: `${Date.now()}-${nextPhrase}`, phrase: nextPhrase, action },
    ]);
    setPhrase("");
    setNotice(`${t("Saved trigger")}: ${nextPhrase}.`);
  }

  useSpeechRecognitionEvent("start", () => {
    if (armedRef.current) setRecognizing(true);
  });
  useSpeechRecognitionEvent("end", () => {
    setRecognizing(false);
    if (!armedRef.current) return;
    restart.current = setTimeout(() => {
      if (armedRef.current)
        ExpoSpeechRecognitionModule.start({
          lang: language === "fr" ? "fr-FR" : "en-US",
          interimResults: true,
          continuous: true,
          maxAlternatives: 1,
          contextualStrings: triggers.map((item) => item.phrase),
        });
    }, 250);
  });
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results
      .map((result) => result.transcript)
      .join(" ")
      .trim();
    if (!transcript) return;
    setHeard(transcript);
    if (!event.isFinal) return;
    const spoken = normalize(transcript);
    const match = triggers.find((item) =>
      spoken.includes(normalize(item.phrase)),
    );
    if (match) runAction(match, transcript);
  });
  useSpeechRecognitionEvent("error", () => {
    armedRef.current = false;
    setArmed(false);
    setRecognizing(false);
    setNotice(t("Voice actions need microphone and speech permissions."));
  });

  return (
    <View style={s.card}>
      <View style={s.headingRow}>
        <View style={s.flex}>
          <Text style={s.eyebrow}>{t("VOICE ACTIONS")}</Text>
          <Text style={s.title}>{t("Say a word. Take the next step.")}</Text>
          <Text style={s.description}>
            {t(
              "Create a spoken trigger for an app action. Start with an example or make your own.",
            )}
          </Text>
        </View>
        <Touch
          label={t(open ? "Close trigger builder" : "Create voice trigger")}
          motion={motion}
          onPress={() => setOpen(!open)}
          style={s.builderToggle}
        >
          <Text style={s.builderToggleText}>{open ? "×" : "+"}</Text>
        </Touch>
      </View>
      <View style={[s.statusPanel, armed && s.statusPanelActive]}>
        <View style={s.statusCopy}>
          <View style={[s.dot, armed && s.dotActive]} />
          <View style={s.flex}>
            <Text style={s.statusTitle}>
              {armed
                ? t("Voice actions are listening")
                : t("Voice actions are off")}
            </Text>
            <Text style={s.statusNotice}>{notice}</Text>
            {recognizing && (
              <Text style={s.heard}>
                {t("Heard")}: {heard}
              </Text>
            )}
          </View>
        </View>
        <Touch
          label={t(armed ? "Stop listening" : "Arm voice actions")}
          motion={motion}
          disabled={voiceBusy}
          onPress={armed ? stopListening : startListening}
          style={s.armButton}
        >
          <View style={s.armContent}>
            <Wave motion={false} color={c.ink} />
            <Text style={s.armText}>
              {armed ? t("Stop listening") : t("Arm voice actions")}
            </Text>
          </View>
        </Touch>
      </View>
      <Text style={s.exampleLabel}>{t("Try an example")}</Text>
      <View style={s.exampleGrid}>
        {examples.map((example) => (
          <Touch
            key={example.phrase}
            label={`“${t(example.phrase)}” ${t(example.result)}`}
            motion={motion}
            disabled={voiceBusy}
            onPress={() =>
              runAction({
                id: `example-${example.action}`,
                phrase: t(example.phrase),
                action: example.action,
              })
            }
            style={s.example}
          >
            <View style={s.exampleCopy}>
              <Text style={s.examplePhrase}>“{t(example.phrase)}”</Text>
              <Text style={s.exampleResult}>{t(example.result)}</Text>
            </View>
          </Touch>
        ))}
      </View>
      {open && (
        <View style={s.builder}>
          <Text style={s.builderTitle}>{t("Build a trigger")}</Text>
          <Text style={s.builderDescription}>
            {t("Voice actions are saved on this device.")}
          </Text>
          <Text style={s.inputLabel}>{t("Trigger word or phrase")}</Text>
          <TextInput
            value={phrase}
            onChangeText={setPhrase}
            placeholder="e.g. upload"
            placeholderTextColor={c.muted}
            autoCapitalize="none"
            style={s.input}
          />
          <Text style={s.inputLabel}>{t("When I say it…")}</Text>
          <View style={s.actionChoices}>
            {(Object.keys(actionLabels) as MobileVoiceActionId[]).map(
              (value) => (
                <Touch
                  key={value}
                  label={t(actionLabels[value])}
                  motion={motion}
                  selected={action === value}
                  onPress={() => setAction(value)}
                  style={[
                    s.actionChoice,
                    action === value && s.actionChoiceSelected,
                  ]}
                >
                  <Text
                    style={[
                      s.actionChoiceText,
                      action === value && s.actionChoiceTextSelected,
                    ]}
                  >
                    {t(actionLabels[value])}
                  </Text>
                </Touch>
              ),
            )}
          </View>
          <Touch
            label={t("Save trigger")}
            motion={motion}
            disabled={!phrase.trim()}
            onPress={saveTrigger}
            style={s.saveButton}
          >
            <Text style={s.saveText}>{t("Save trigger")}</Text>
          </Touch>
          {triggers.map((trigger) => (
            <View key={trigger.id} style={s.savedTrigger}>
              <View style={s.flex}>
                <Text style={s.savedPhrase}>“{trigger.phrase}”</Text>
                <Text style={s.savedAction}>
                  {t(actionLabels[trigger.action])}
                </Text>
              </View>
              <Touch
                label={`${t("Remove trigger")} ${trigger.phrase}`}
                motion={motion}
                onPress={() =>
                  setTriggers((current) =>
                    current.filter((item) => item.id !== trigger.id),
                  )
                }
                style={s.remove}
              >
                <Text style={s.removeText}>×</Text>
              </Touch>
            </View>
          ))}
          {!canStartVoice && (
            <Text style={s.supportNote}>
              {t(
                "Start voice chat becomes available after you add a PDF or YouTube source.",
              )}
            </Text>
          )}
          <Text style={s.supportNote}>
            {t("For uploads, your phone will ask you to choose a local file.")}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: c.white, borderRadius: 24, padding: 18, gap: 14 },
  headingRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  flex: { flex: 1 },
  eyebrow: {
    color: "#A9513A",
    fontSize: 9,
    letterSpacing: 1.4,
    fontWeight: "800",
  },
  title: {
    color: c.ink,
    fontFamily: serif,
    fontSize: 27,
    lineHeight: 31,
    marginTop: 6,
  },
  description: { color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  builderToggle: {
    backgroundColor: c.lavender,
    borderRadius: 15,
    flexGrow: 0,
    width: 48,
    height: 48,
  },
  builderToggleText: { color: c.ink, fontSize: 25, fontWeight: "400" },
  statusPanel: {
    backgroundColor: c.paper,
    borderColor: c.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  statusPanelActive: { backgroundColor: c.peach, borderColor: c.coral },
  statusCopy: { flexDirection: "row", gap: 9 },
  dot: {
    backgroundColor: c.muted,
    borderRadius: 5,
    height: 9,
    marginTop: 4,
    width: 9,
  },
  dotActive: { backgroundColor: c.coral },
  statusTitle: { color: c.ink, fontSize: 12, fontWeight: "700" },
  statusNotice: { color: c.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  heard: { color: c.ink, fontSize: 11, marginTop: 4 },
  armButton: { backgroundColor: c.coral, borderRadius: 15, flexGrow: 0 },
  armContent: { flexDirection: "row", gap: 7, alignItems: "center" },
  armText: { color: c.ink, fontSize: 13, fontWeight: "700" },
  exampleLabel: { color: c.muted, fontSize: 11, fontWeight: "700" },
  exampleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  example: {
    backgroundColor: c.paper,
    borderColor: c.line,
    borderRadius: 13,
    flexGrow: 0,
    minWidth: "47%",
    padding: 11,
  },
  exampleCopy: { alignItems: "flex-start", gap: 3 },
  examplePhrase: { color: c.ink, fontSize: 12, fontWeight: "700" },
  exampleResult: { color: c.muted, fontSize: 10 },
  builder: {
    backgroundColor: c.lavender,
    borderRadius: 18,
    gap: 10,
    padding: 14,
  },
  builderTitle: { color: c.ink, fontFamily: serif, fontSize: 22 },
  builderDescription: { color: c.muted, fontSize: 11, lineHeight: 16 },
  inputLabel: { color: c.ink, fontSize: 11, fontWeight: "700", marginTop: 3 },
  input: {
    backgroundColor: c.white,
    borderColor: c.line,
    borderRadius: 12,
    borderWidth: 1,
    color: c.ink,
    minHeight: 46,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  actionChoices: { gap: 7 },
  actionChoice: {
    backgroundColor: c.white,
    borderColor: c.line,
    borderRadius: 11,
    flexGrow: 0,
    minHeight: 42,
    padding: 9,
    alignItems: "flex-start",
  },
  actionChoiceSelected: { backgroundColor: c.peach, borderColor: c.coral },
  actionChoiceText: { color: c.muted, fontSize: 11 },
  actionChoiceTextSelected: { color: c.ink, fontWeight: "700" },
  saveButton: { backgroundColor: c.ink, borderRadius: 13, flexGrow: 0 },
  saveText: { color: c.paper, fontSize: 13, fontWeight: "700" },
  savedTrigger: {
    backgroundColor: c.white,
    borderRadius: 11,
    flexDirection: "row",
    gap: 8,
    padding: 10,
  },
  savedPhrase: { color: c.ink, fontSize: 12, fontWeight: "700" },
  savedAction: { color: c.muted, fontSize: 10, marginTop: 3 },
  remove: {
    backgroundColor: c.peach,
    borderRadius: 9,
    flexGrow: 0,
    height: 34,
    width: 34,
  },
  removeText: { color: c.error, fontSize: 19 },
  supportNote: { color: c.muted, fontSize: 10, lineHeight: 15 },
});
