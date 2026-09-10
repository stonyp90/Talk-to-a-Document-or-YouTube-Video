import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Language, TranslationKey } from "./i18n";
import { palette as c, serif, Touch, Wave } from "./design";
import {
  findVoiceTriggerMatches,
  normalizeVoiceText,
} from "./voiceCommandMatcher";

export type MobileVoiceActionId =
  | "youtube"
  | "upload"
  | "voice"
  | "summarize"
  | "back"
  | "next"
  | "cancel";

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
  onNotice?: (message: string) => void;
};

const storageKey = "ursly-mobile-voice-triggers-v1";
const actionLabels: Record<MobileVoiceActionId, TranslationKey> = {
  youtube: "Open the YouTube source",
  upload: "Open the PDF picker",
  voice: "Start voice chat",
  summarize: "Prepare a key-ideas summary",
  back: "Go back or undo the last step",
  next: "Go forward to the next step",
  cancel: "Cancel the current action",
};
const actionTitles: Record<MobileVoiceActionId, TranslationKey> = {
  youtube: "YouTube",
  upload: "Upload a PDF",
  voice: "Voice chat",
  summarize: "Key-ideas summary",
  back: "Undo last step",
  next: "Next step",
  cancel: "Cancel action",
};
const actionDescriptions: Record<MobileVoiceActionId, TranslationKey> = {
  youtube: "Open your YouTube source",
  upload: "Choose a PDF from this device",
  voice: "Start a live conversation",
  summarize: "Prepare the main ideas",
  back: "Go back or undo the previous step",
  next: "Continue to the next step",
  cancel: "Stop the current action",
};
const actionReplies: Record<MobileVoiceActionId, TranslationKey> = {
  youtube: "Opening the YouTube source.",
  upload: "Opening the PDF picker.",
  voice: "Starting voice chat.",
  summarize: "Preparing a key-ideas summary.",
  back: "Going back and undoing the last step.",
  next: "Moving forward to the next step.",
  cancel: "Cancelling the current action.",
};
const defaultTriggers: VoiceTrigger[] = [
  { id: "default-back", phrase: "back", action: "back" },
  { id: "default-next", phrase: "next", action: "next" },
  { id: "default-cancel", phrase: "cancel", action: "cancel" },
];
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
  { phrase: "Back", action: "back", result: "undo the last step" },
  { phrase: "Next", action: "next", result: "continue forward" },
  { phrase: "Cancel", action: "cancel", result: "stop the current action" },
];

export function MobileVoiceActions({
  language,
  motion,
  voiceBusy,
  canStartVoice,
  t,
  onAction,
  onNotice,
}: Props) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [action, setAction] = useState<MobileVoiceActionId>("upload");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [triggers, setTriggers] = useState<VoiceTrigger[]>([]);
  const [armed, setArmed] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [heard, setHeard] = useState("");
  const [revealedExample, setRevealedExample] =
    useState<MobileVoiceActionId | null>(null);
  const [notice, setNotice] = useState(t("Voice actions are off"));
  const previousLanguage = useRef(language);
  const armedRef = useRef(false);
  const triggersRef = useRef(triggers);
  const tRef = useRef(t);
  const hydrated = useRef(false);
  const handledTriggers = useRef(new Set<string>());
  const restart = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onActionRef = useRef(onAction);
  triggersRef.current = triggers;
  tRef.current = t;

  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  useEffect(() => {
    if (!armed && !recognizing && triggers.length === 0) {
      const resetNotice = setTimeout(
        () =>
          setNotice(
            t("Create a trigger, then arm voice actions to try it hands-free."),
          ),
        0,
      );
      return () => clearTimeout(resetNotice);
    }
  }, [armed, language, recognizing, t, triggers.length]);
  useEffect(() => {
    if (previousLanguage.current === language) return;
    previousLanguage.current = language;
    if (armed || recognizing) return;
    const resetNotice = setTimeout(
      () =>
        setNotice(
          triggers.length > 0
            ? t("Voice actions are off")
            : t(
                "Create a trigger, then arm voice actions to try it hands-free.",
              ),
        ),
      0,
    );
    return () => clearTimeout(resetNotice);
  }, [armed, language, recognizing, t, triggers.length]);
  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(storageKey).then((value) => {
      if (!mounted) return;
      try {
        const parsed =
          value === null
            ? defaultTriggers
            : (JSON.parse(value) as VoiceTrigger[]);
        if (Array.isArray(parsed)) {
          const validTriggers = parsed.filter(
            (item) => item?.id && item?.phrase && item?.action in actionLabels,
          );
          setTriggers(validTriggers);
          if (validTriggers.length > 0)
            setNotice(tRef.current("Voice actions are off"));
        }
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

  function closeBuilder() {
    setOpen(false);
    setPhrase("");
    setEditingId(null);
    setAction("upload");
  }

  function speak(reply: TranslationKey, onDone?: () => void) {
    void Speech.stop();
    Speech.speak(t(reply), {
      language: language === "fr" ? "fr-FR" : "en-US",
      rate: 0.98,
      onDone,
    });
  }

  function runAction(trigger: VoiceTrigger, transcript = trigger.phrase) {
    const continueListening =
      armedRef.current &&
      !["upload", "voice", "cancel"].includes(trigger.action);
    if (continueListening) {
      armedRef.current = false;
      ExpoSpeechRecognitionModule.stop();
      setArmed(false);
      setRecognizing(false);
    } else if (
      trigger.action === "upload" ||
      trigger.action === "voice" ||
      trigger.action === "cancel"
    ) {
      stopListening();
    }
    setNotice(
      `${t("Triggered action")}: ${trigger.phrase} · ${t(actionLabels[trigger.action])}.`,
    );
    speak(
      actionReplies[trigger.action],
      continueListening ? startListening : undefined,
    );
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
          `${t("Listening for")} ${triggersRef.current.map((item) => `“${item.phrase}”`).join(", ")}.`,
        );
        ExpoSpeechRecognitionModule.start({
          lang: language === "fr" ? "fr-FR" : "en-US",
          interimResults: true,
          continuous: true,
          maxAlternatives: 1,
          contextualStrings: triggersRef.current.map((item) => item.phrase),
        });
      })
      .catch(() =>
        setNotice(t("Voice actions need microphone and speech permissions.")),
      );
  }

  function saveTrigger() {
    const nextPhrase = phrase.trim();
    const normalizedPhrase = normalizeVoiceText(nextPhrase);
    if (!normalizedPhrase) return;
    if (
      triggers.some(
        (trigger) =>
          trigger.id !== editingId &&
          normalizeVoiceText(trigger.phrase) === normalizedPhrase,
      )
    ) {
      setNotice(t("That trigger is already saved. Choose a different phrase."));
      onNotice?.(
        t("That trigger is already saved. Choose a different phrase."),
      );
      return;
    }
    setTriggers((current) => {
      const next = {
        id: editingId ?? `${Date.now()}-${nextPhrase}`,
        phrase: nextPhrase,
        action,
      };
      return editingId
        ? current.map((item) => (item.id === editingId ? next : item))
        : [...current, next];
    });
    setPhrase("");
    setEditingId(null);
    const confirmation = `${t(editingId ? "Updated trigger" : "Saved trigger")}: ${nextPhrase}.`;
    setNotice(confirmation);
    onNotice?.(confirmation);
  }

  useSpeechRecognitionEvent("start", () => {
    handledTriggers.current.clear();
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
    if (!armedRef.current) return;
    const transcript = event.results
      .map((result) => result.transcript)
      .join(" ")
      .trim();
    if (!transcript) return;
    setHeard(transcript);
    for (const match of findVoiceTriggerMatches(
      transcript,
      triggersRef.current,
    )) {
      if (handledTriggers.current.has(match.id)) continue;
      handledTriggers.current.add(match.id);
      runAction(match, transcript);
      if (!armedRef.current) break;
    }
  });
  useSpeechRecognitionEvent("error", () => {
    if (!armedRef.current) return;
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
              "Create a spoken trigger for an app action. Say that word anywhere in a sentence and Ursly acts as soon as it hears it.",
            )}
          </Text>
        </View>
        <Touch
          label={t(open ? "Close trigger builder" : "Create voice trigger")}
          motion={motion}
          onPress={() => (open ? closeBuilder() : setOpen(true))}
          style={s.builderToggle}
        >
          <Text style={s.builderToggleText}>{open ? "×" : "+"}</Text>
        </Touch>
      </View>
      <View
        accessibilityLiveRegion="polite"
        style={[s.statusPanel, armed && s.statusPanelActive]}
      >
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
              <Text accessibilityLiveRegion="polite" style={s.heard}>
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
      <View style={s.exampleHeading}>
        <Text style={s.exampleLabel}>{t("Try an example")}</Text>
        <Text style={s.exampleHint}>
          {t("Try the action or reveal the words to say")}
        </Text>
      </View>
      <View style={s.exampleGrid}>
        {examples.map((example) => (
          <View
            key={example.phrase}
            style={[s.example, example.action === "cancel" && s.exampleWide]}
          >
            <Touch
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
              style={s.exampleMain}
            >
              <View style={s.exampleCopy}>
                <Text style={s.exampleResult}>{t(example.result)}</Text>
                <Text style={s.exampleTry}>{t("Try it")}</Text>
              </View>
              <Text style={s.exampleArrow}>↗</Text>
            </Touch>
            <Touch
              label={t(
                revealedExample === example.action
                  ? "Hide trigger"
                  : "Show trigger",
              )}
              motion={motion}
              onPress={() =>
                setRevealedExample((current) =>
                  current === example.action ? null : example.action,
                )
              }
              style={s.exampleReveal}
              selected={revealedExample === example.action}
            >
              <View style={s.eyeIcon}>
                <View style={s.eyePupil} />
              </View>
              <Text style={s.exampleRevealText}>
                {t(
                  revealedExample === example.action
                    ? "Hide phrase"
                    : "Show phrase",
                )}
              </Text>
            </Touch>
            {revealedExample === example.action && (
              <View style={s.exampleTrigger}>
                <Text style={s.exampleTriggerLabel}>{t("Say this")}</Text>
                <Text style={s.examplePhrase}>“{t(example.phrase)}”</Text>
              </View>
            )}
          </View>
        ))}
      </View>
      <Modal
        visible={open}
        transparent
        animationType={motion ? "slide" : "none"}
        onRequestClose={closeBuilder}
      >
        <SafeAreaView style={s.modalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Close trigger builder")}
            style={s.modalScrim}
            onPress={closeBuilder}
          />
          <View style={s.builderSheet}>
            <View style={s.builderHeader}>
              <Touch
                label={t("Back to voice actions")}
                motion={motion}
                onPress={closeBuilder}
                style={s.builderBack}
              >
                <View style={s.builderBackContent}>
                  <Text style={s.builderBackText}>‹</Text>
                  <Text style={s.builderBackLabel}>{t("Back")}</Text>
                </View>
              </Touch>
              <View style={s.builderHeaderCopy}>
                <Text style={s.builderKicker}>{t("VOICE ACTIONS")}</Text>
                <Text style={s.builderTitle}>{t("Build a trigger")}</Text>
              </View>
              <Touch
                label={t("Close trigger builder")}
                motion={motion}
                onPress={closeBuilder}
                style={s.builderClose}
              >
                <Text style={s.builderCloseText}>×</Text>
              </Touch>
            </View>
            <ScrollView
              style={s.builderScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.builderContent}
            >
              <Text style={s.builderDescription}>
                {t("Voice actions are saved on this device.")}
              </Text>
              <View style={s.builderStep}>
                <Text style={s.builderStepNumber}>01</Text>
                <Text style={s.inputLabel}>{t("Trigger word or phrase")}</Text>
              </View>
              <TextInput
                value={phrase}
                onChangeText={setPhrase}
                accessibilityLabel={t("Trigger word or phrase")}
                placeholder={t("e.g. upload")}
                placeholderTextColor={c.muted}
                autoCapitalize="none"
                style={s.input}
              />
              <View style={s.builderStep}>
                <Text style={s.builderStepNumber}>02</Text>
                <Text style={s.inputLabel}>{t("When I say it…")}</Text>
              </View>
              <Text style={s.builderHint}>
                {t("Choose what Ursly should do.")}
              </Text>
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
                        value === "cancel" && s.actionChoiceWide,
                        action === value && s.actionChoiceSelected,
                      ]}
                    >
                      <View style={s.actionChoiceHeader}>
                        <Text
                          style={[
                            s.actionChoiceTitle,
                            action === value && s.actionChoiceTextSelected,
                          ]}
                        >
                          {t(actionTitles[value])}
                        </Text>
                        {action === value && (
                          <Text style={s.actionSelectedMark}>✓</Text>
                        )}
                      </View>
                      <Text style={s.actionChoiceDescription}>
                        {t(actionDescriptions[value])}
                      </Text>
                    </Touch>
                  ),
                )}
              </View>
              {triggers.length > 0 && (
                <View style={s.savedSection}>
                  <Text style={s.savedSectionTitle}>{t("Saved triggers")}</Text>
                  {triggers.map((trigger) => (
                    <View key={trigger.id} style={s.savedTrigger}>
                      <View style={s.flex}>
                        <Text style={s.savedPhrase}>“{trigger.phrase}”</Text>
                        <Text style={s.savedAction}>
                          {t(actionLabels[trigger.action])}
                        </Text>
                      </View>
                      <Touch
                        label={`${t("Edit trigger")} ${trigger.phrase}`}
                        motion={motion}
                        onPress={() => {
                          setPhrase(trigger.phrase);
                          setAction(trigger.action);
                          setEditingId(trigger.id);
                        }}
                        style={s.remove}
                      >
                        <Text style={s.removeText}>✎</Text>
                      </Touch>
                      <Touch
                        label={`${t("Remove trigger")} ${trigger.phrase}`}
                        motion={motion}
                        onPress={() => {
                          setTriggers((current) =>
                            current.filter((item) => item.id !== trigger.id),
                          );
                          if (editingId === trigger.id) {
                            setPhrase("");
                            setEditingId(null);
                            setAction("upload");
                          }
                          const confirmation = `${t("Removed trigger")}: ${trigger.phrase}.`;
                          setNotice(confirmation);
                          onNotice?.(confirmation);
                        }}
                        style={s.remove}
                      >
                        <Text style={s.removeText}>×</Text>
                      </Touch>
                    </View>
                  ))}
                </View>
              )}
              {!canStartVoice && (
                <Text style={s.supportNote}>
                  {t(
                    "Start voice chat becomes available after you add a PDF or YouTube source.",
                  )}
                </Text>
              )}
              <Text style={s.supportNote}>
                {t(
                  "For uploads, your phone will ask you to choose a local file.",
                )}
              </Text>
            </ScrollView>
            <View style={s.builderFooter}>
              <Touch
                label={t(editingId ? "Update trigger" : "Save trigger")}
                motion={motion}
                disabled={!phrase.trim()}
                onPress={saveTrigger}
                style={s.saveButton}
              >
                <Text style={s.saveText}>
                  {t(editingId ? "Update trigger" : "Save trigger")}
                </Text>
              </Touch>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    alignSelf: "stretch",
    backgroundColor: c.white,
    borderRadius: 24,
    gap: 14,
    padding: 18,
    width: "100%",
  },
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
    backgroundColor: "transparent",
    borderColor: c.line,
    borderWidth: 1,
    borderRadius: 17,
    flexGrow: 0,
    height: 52,
    justifyContent: "center",
    padding: 0,
    width: 52,
  },
  builderToggleText: {
    color: c.ink,
    fontSize: 29,
    fontWeight: "400",
    lineHeight: 32,
    textAlign: "center",
    width: "100%",
  },
  statusPanel: {
    backgroundColor: c.paper,
    borderColor: c.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 12,
    width: "100%",
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
  exampleHeading: {
    alignItems: "flex-start",
    gap: 3,
  },
  exampleLabel: { color: c.ink, fontSize: 15, fontWeight: "800" },
  exampleHint: { color: c.muted, fontSize: 11, lineHeight: 16 },
  exampleGrid: {
    alignContent: "flex-start",
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    width: "100%",
  },
  example: {
    backgroundColor: c.paper,
    borderColor: c.line,
    borderWidth: 1,
    borderRadius: 13,
    flexDirection: "column",
    flexGrow: 0,
    minHeight: 136,
    overflow: "hidden",
    width: "48%",
  },
  exampleWide: {
    width: "100%",
  },
  exampleMain: {
    alignItems: "stretch",
    flexGrow: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 96,
    padding: 13,
    paddingRight: 28,
    width: "100%",
  },
  exampleCopy: {
    alignItems: "flex-start",
    flex: 1,
    gap: 3,
    minWidth: 0,
    width: "100%",
  },
  exampleResult: {
    color: c.ink,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
  },
  exampleTry: {
    color: c.muted,
    fontSize: 10,
    lineHeight: 14,
  },
  exampleArrow: {
    bottom: 8,
    color: c.muted,
    fontSize: 14,
    position: "absolute",
    right: 10,
  },
  exampleReveal: {
    alignItems: "center",
    backgroundColor: "#FDFBF7",
    borderTopColor: c.line,
    borderTopWidth: 1,
    borderRadius: 0,
    flexDirection: "row",
    gap: 6,
    justifyContent: "flex-start",
    minHeight: 39,
    paddingHorizontal: 11,
    paddingVertical: 8,
    width: "100%",
  },
  exampleRevealText: { color: c.ink, fontSize: 10, fontWeight: "700" },
  eyeIcon: {
    alignItems: "center",
    borderColor: c.muted,
    borderRadius: 9,
    borderWidth: 1.7,
    height: 15,
    justifyContent: "center",
    transform: [{ rotate: "-8deg" }],
    width: 23,
  },
  eyePupil: {
    backgroundColor: c.muted,
    borderRadius: 3,
    height: 5,
    width: 5,
  },
  exampleTrigger: {
    alignItems: "center",
    backgroundColor: c.peach,
    borderTopColor: c.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 5,
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  exampleTriggerLabel: { color: c.muted, fontSize: 10 },
  examplePhrase: { color: c.ink, fontSize: 11, fontWeight: "800" },
  builder: {
    backgroundColor: c.lavender,
    borderRadius: 18,
    gap: 10,
    padding: 14,
    width: "100%",
  },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#201A2B80",
  },
  builderSheet: {
    backgroundColor: "#F2EEE8",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: "92%",
    maxHeight: "92%",
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  builderScroll: { flex: 1, minHeight: 0 },
  builderHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingBottom: 10,
  },
  builderHeaderCopy: { flex: 1, gap: 3 },
  builderKicker: {
    color: "#A9513A",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  builderBack: {
    flexGrow: 0,
    minHeight: 40,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  builderBackContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3,
  },
  builderBackText: { color: c.ink, fontSize: 28, lineHeight: 28 },
  builderBackLabel: {
    alignSelf: "center",
    color: c.ink,
    fontSize: 11,
    fontWeight: "700",
  },
  builderClose: {
    backgroundColor: c.white,
    borderRadius: 20,
    flexGrow: 0,
    height: 40,
    width: 40,
  },
  builderCloseText: { color: c.ink, fontSize: 23, fontWeight: "300" },
  builderContent: { gap: 12, paddingBottom: 20 },
  builderStep: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  builderStepNumber: {
    color: "#765B48",
    fontFamily: serif,
    fontSize: 20,
    fontWeight: "700",
  },
  builderTitle: { color: c.ink, fontFamily: serif, fontSize: 25 },
  builderDescription: { color: c.muted, fontSize: 14, lineHeight: 20 },
  inputLabel: { color: c.ink, fontSize: 14, fontWeight: "800", marginTop: 3 },
  builderHint: { color: c.muted, fontSize: 13, lineHeight: 18, marginTop: -5 },
  input: {
    backgroundColor: c.white,
    borderColor: "#D9D0C2",
    borderRadius: 12,
    borderWidth: 1.5,
    color: c.ink,
    minHeight: 56,
    paddingHorizontal: 15,
    fontSize: 17,
  },
  actionChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    width: "100%",
  },
  actionChoice: {
    backgroundColor: c.white,
    borderColor: "#D9D0C2",
    borderRadius: 14,
    flexGrow: 0,
    minHeight: 88,
    padding: 12,
    alignItems: "flex-start",
    width: "48%",
  },
  actionChoiceWide: { width: "100%" },
  actionChoiceSelected: {
    backgroundColor: "#FFE0D5",
    borderColor: c.coral,
    borderWidth: 2,
  },
  actionChoiceHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 6,
    width: "100%",
  },
  actionChoiceTitle: {
    color: c.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 19,
  },
  actionChoiceTextSelected: { color: c.ink, fontWeight: "800" },
  actionChoiceDescription: {
    color: c.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  actionSelectedMark: {
    color: c.coral,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 19,
  },
  saveButton: {
    alignSelf: "stretch",
    backgroundColor: c.ink,
    borderRadius: 13,
    width: "100%",
  },
  builderFooter: {
    backgroundColor: "#F2EEE8",
    borderTopColor: "#D9D1C5",
    borderTopWidth: 1,
    paddingBottom: 4,
    paddingTop: 10,
  },
  saveText: { color: c.paper, fontSize: 13, fontWeight: "700" },
  savedSection: { gap: 8, marginTop: 3 },
  savedSectionTitle: {
    color: c.ink,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  savedTrigger: {
    backgroundColor: c.white,
    borderRadius: 11,
    flexDirection: "row",
    gap: 8,
    padding: 10,
    minWidth: 0,
    width: "100%",
  },
  savedPhrase: { color: c.ink, fontSize: 12, fontWeight: "700" },
  savedAction: { color: c.muted, flexShrink: 1, fontSize: 10, marginTop: 3 },
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
