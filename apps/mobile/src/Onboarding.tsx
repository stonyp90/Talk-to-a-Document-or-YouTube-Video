import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { TranslationKey } from "./i18n";
import {
  Brand,
  Orbit,
  SourceIcon,
  Touch,
  Wave,
  palette as c,
  serif,
} from "./design";

const storageKey = "ursly-mobile-onboarding-v1";
const slideDuration = 5600;

type Step = {
  label: TranslationKey;
  title: TranslationKey;
  body: TranslationKey;
  note: TranslationKey;
};

const steps: Step[] = [
  {
    label: "Bring a source",
    title: "Start with something worth understanding.",
    body: "Choose a PDF or a captioned YouTube video. Ursly reads it so you can focus on the ideas.",
    note: "PDF up to 25 MB · captioned videos",
  },
  {
    label: "Ask naturally",
    title: "Use your voice when the thought arrives.",
    body: "Start a voice conversation, interrupt freely, or type whenever it feels easier.",
    note: "Voice or text · always in control",
  },
  {
    label: "Go deeper",
    title: "Turn information into your next aha.",
    body: "Ask a follow-up, challenge an idea, or make it simpler. Every answer stays grounded in your source.",
    note: "Ask · follow up · understand",
  },
];

type Props = {
  motion: boolean;
  t: (key: TranslationKey) => string;
};

export function MobileOnboarding({ motion, t }: Props) {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [copyOpacity] = useState(() => new Animated.Value(1));
  const [copyOffset] = useState(() => new Animated.Value(0));

  const finish = useCallback(() => {
    setVisible(false);
    void AsyncStorage.setItem(storageKey, "done").catch(() => undefined);
  }, []);

  const advance = useCallback(() => {
    if (step === steps.length - 1) finish();
    else setStep((current) => current + 1);
  }, [finish, step]);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(storageKey)
      .then((value) => {
        if (mounted) setVisible(value !== "done");
      })
      .catch(() => {
        if (mounted) setVisible(true);
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!visible || paused || step === steps.length - 1) return;
    const timer = setTimeout(advance, slideDuration);
    return () => clearTimeout(timer);
  }, [advance, paused, step, visible]);

  useEffect(() => {
    if (!motion || !visible) {
      copyOpacity.setValue(1);
      copyOffset.setValue(0);
      return;
    }
    copyOpacity.setValue(0);
    copyOffset.setValue(12);
    const animation = Animated.parallel([
      Animated.timing(copyOpacity, {
        toValue: 1,
        duration: 430,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(copyOffset, {
        toValue: 0,
        duration: 430,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [copyOffset, copyOpacity, motion, step, visible]);

  if (!ready) return null;

  return (
    <Modal
      visible={visible}
      animationType={motion ? "fade" : "none"}
      presentationStyle="fullScreen"
      onRequestClose={finish}
    >
      <SafeAreaView style={s.screen}>
        <View style={s.header}>
          <Brand />
          <View style={s.headerRight}>
            <Text style={s.counter}>
              {t("QUICK TOUR")} · {String(step + 1).padStart(2, "0")} / 03
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(paused ? "Resume slides" : "Pause slides")}
              onPress={() => setPaused((value) => !value)}
              style={s.pauseButton}
            >
              <Text style={s.pauseIcon}>{paused ? "▶" : "Ⅱ"}</Text>
              <Text style={s.pauseText}>
                {t(paused ? "Resume slides" : "Pause slides")}
              </Text>
            </Pressable>
          </View>
        </View>

        <Animated.View
          style={[
            s.content,
            { opacity: copyOpacity, transform: [{ translateY: copyOffset }] },
          ]}
        >
          <View style={s.artFrame}>
            {step === 0 ? (
              <SourceArt t={t} />
            ) : step === 1 ? (
              <VoiceArt motion={motion} t={t} />
            ) : (
              <ChatArt t={t} />
            )}
          </View>
          <View style={s.copy}>
            <Text style={s.stepLabel}>
              {t("STEP")} {step + 1} · {t(steps[step].label).toUpperCase()}
            </Text>
            <Text accessibilityRole="header" style={s.title}>
              {t(steps[step].title)}
            </Text>
            <Text style={s.body}>{t(steps[step].body)}</Text>
            <View style={s.noteRow}>
              <View style={s.noteDot} />
              <Text style={s.note}>{t(steps[step].note)}</Text>
            </View>
          </View>
        </Animated.View>

        <View style={s.footer}>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={t("Guide progress")}
            accessibilityValue={{ min: 1, max: 3, now: step + 1 }}
            style={s.rail}
          >
            {steps.map((item, index) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityLabel={`${t("Go to step")} ${index + 1}: ${t(item.label)}`}
                onPress={() => setStep(index)}
                style={[s.railItem, index === step && s.railItemActive]}
              >
                <Text
                  style={[s.railNumber, index === step && s.railNumberActive]}
                >
                  0{index + 1}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[s.railLabel, index === step && s.railLabelActive]}
                >
                  {t(item.label)}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={s.actions}>
            <Touch
              label={t("Skip onboarding")}
              motion={motion}
              onPress={finish}
              style={s.skip}
            >
              <Text style={s.skipText}>{t("Skip onboarding")}</Text>
            </Touch>
            {step > 0 && (
              <Touch
                label={t("Back")}
                motion={motion}
                onPress={() => setStep((current) => current - 1)}
                style={s.back}
              >
                <Text style={s.backText}>{t("Back")}</Text>
              </Touch>
            )}
            <Touch
              label={t(step === steps.length - 1 ? "Open Ursly" : "Continue")}
              motion={motion}
              onPress={advance}
              style={s.primary}
            >
              <Text style={s.primaryText}>
                {t(step === steps.length - 1 ? "Open Ursly" : "Continue")}
              </Text>
              <Text style={s.arrow}>↗</Text>
            </Touch>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function SourceArt({ t }: Pick<Props, "t">) {
  return (
    <View accessible={false} style={art.sourceArt}>
      <View style={[art.card, art.pdfCard]}>
        <View style={art.cardTop}>
          <View style={art.iconTile}>
            <SourceIcon kind="pdf" />
          </View>
          <Text style={art.cardLabel}>{t("PDF")}</Text>
        </View>
        <View style={art.lines}>
          <View style={art.line} />
          <View style={art.line} />
          <View style={[art.line, { width: "55%" }]} />
        </View>
      </View>
      <View style={[art.card, art.videoCard]}>
        <View style={art.iconTile}>
          <SourceIcon kind="youtube" />
        </View>
        <Text style={art.videoLabel}>{t("VIDEO")}</Text>
      </View>
      <View style={art.sourcePill}>
        <View style={art.pillDot} />
        <Text style={art.pillText}>{t("SOURCE READY")}</Text>
      </View>
    </View>
  );
}

function VoiceArt({ motion, t }: { motion: boolean } & Pick<Props, "t">) {
  return (
    <View accessible={false} style={art.voiceArt}>
      <View style={art.voiceRings}>
        <View style={art.ring} />
        <View style={[art.ring, art.ringInner]} />
        <View style={art.voiceCore}>
          <Wave motion={motion} color={c.ink} large />
        </View>
      </View>
      <Text style={art.voiceCaption}>{t("LISTENING")}</Text>
      <View style={art.captionPill}>
        <Text style={art.captionText}>{t("Ask it in your own words.")}</Text>
      </View>
    </View>
  );
}

function ChatArt({ t }: Pick<Props, "t">) {
  return (
    <View accessible={false} style={art.chatArt}>
      <View style={[art.bubble, art.questionBubble]}>
        <Text style={art.bubbleText}>{t("What should I remember?")}</Text>
      </View>
      <View style={[art.bubble, art.answerBubble]}>
        <View style={art.answerMark}>
          <Text style={art.answerMarkText}>✦</Text>
        </View>
        <View style={art.answerLines}>
          <View style={art.line} />
          <View style={art.line} />
          <View style={[art.line, { width: "62%" }]} />
        </View>
      </View>
      <Text style={art.chatSpark}>✦</Text>
      <Orbit motion={false} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: c.paper,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerRight: { alignItems: "flex-end", gap: 6 },
  counter: {
    color: c.muted,
    fontSize: 9,
    letterSpacing: 1.1,
    fontWeight: "700",
  },
  pauseButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 2,
  },
  pauseIcon: { color: c.coral, fontSize: 10, fontWeight: "800" },
  pauseText: { color: c.muted, fontSize: 10 },
  content: { flex: 1, justifyContent: "center", gap: 28 },
  artFrame: { minHeight: 260, alignItems: "center", justifyContent: "center" },
  copy: { gap: 12 },
  stepLabel: {
    color: "#A9513A",
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "800",
  },
  title: {
    color: c.ink,
    fontFamily: serif,
    fontSize: 34,
    lineHeight: 39,
    letterSpacing: -1.1,
  },
  body: { color: c.muted, fontSize: 15, lineHeight: 23, maxWidth: 430 },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  noteDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.coral },
  note: { color: c.ink, fontSize: 12, fontWeight: "600" },
  footer: { gap: 18 },
  rail: { flexDirection: "row", gap: 8 },
  railItem: {
    flex: 1,
    gap: 5,
    borderTopWidth: 1,
    borderTopColor: c.line,
    paddingTop: 9,
  },
  railItemActive: { borderTopColor: c.coral },
  railNumber: { color: "#9B9294", fontSize: 10, fontWeight: "700" },
  railNumberActive: { color: c.coral },
  railLabel: { color: c.muted, fontSize: 10 },
  railLabelActive: { color: c.ink, fontWeight: "700" },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  skip: { paddingHorizontal: 3, minHeight: 46 },
  skipText: { color: c.muted, fontSize: 12, textDecorationLine: "underline" },
  back: { borderWidth: 1, borderColor: c.line, minWidth: 70 },
  backText: { color: c.ink, fontSize: 13, fontWeight: "600" },
  primary: {
    flex: 1,
    flexDirection: "row",
    gap: 9,
    backgroundColor: c.coral,
    borderRadius: 16,
    minHeight: 50,
  },
  primaryText: { color: c.ink, fontSize: 14, fontWeight: "800" },
  arrow: { color: c.ink, fontSize: 19 },
});

const art = StyleSheet.create({
  sourceArt: { width: 290, height: 250, position: "relative" },
  card: {
    position: "absolute",
    backgroundColor: c.white,
    borderRadius: 19,
    padding: 15,
    shadowColor: c.ink,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  pdfCard: {
    width: 220,
    height: 160,
    left: 16,
    top: 30,
    transform: [{ rotate: "-6deg" }],
  },
  videoCard: {
    width: 135,
    height: 115,
    right: 8,
    top: 0,
    transform: [{ rotate: "8deg" }],
    alignItems: "center",
    gap: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 9 },
  iconTile: {
    width: 35,
    height: 35,
    borderRadius: 11,
    backgroundColor: c.peach,
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: {
    color: c.muted,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "800",
  },
  videoLabel: {
    color: c.muted,
    fontSize: 9,
    letterSpacing: 1.3,
    fontWeight: "800",
  },
  lines: { gap: 10, marginTop: 25 },
  line: {
    height: 3,
    borderRadius: 3,
    backgroundColor: "#E7E1DB",
    width: "78%",
  },
  sourcePill: {
    position: "absolute",
    left: 66,
    bottom: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: c.lime,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
  pillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#677C4A" },
  pillText: {
    color: "#4D5E39",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  voiceArt: {
    width: 290,
    height: 250,
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
  },
  voiceRings: {
    width: 210,
    height: 210,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: "#D9CDE4",
  },
  ringInner: { width: 160, height: 160, borderColor: "#C7B5DA" },
  voiceCore: {
    width: 112,
    height: 112,
    borderRadius: 42,
    backgroundColor: c.coral,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-8deg" }],
  },
  voiceCaption: {
    color: c.muted,
    letterSpacing: 2,
    fontSize: 9,
    fontWeight: "800",
  },
  captionPill: {
    backgroundColor: c.lavender,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  captionText: { color: c.ink, fontSize: 12, fontWeight: "600" },
  chatArt: {
    width: 300,
    height: 250,
    position: "relative",
    alignItems: "center",
  },
  bubble: { position: "absolute", borderRadius: 18, padding: 13 },
  questionBubble: {
    top: 21,
    left: 14,
    backgroundColor: c.peach,
    borderBottomLeftRadius: 5,
  },
  answerBubble: {
    top: 86,
    right: 13,
    width: 190,
    backgroundColor: c.white,
    flexDirection: "row",
    gap: 10,
    shadowColor: c.ink,
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  bubbleText: { color: c.ink, fontSize: 13, fontWeight: "600" },
  answerMark: {
    width: 25,
    height: 25,
    borderRadius: 8,
    backgroundColor: c.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  answerMarkText: { color: "#5D713E", fontSize: 15 },
  answerLines: { flex: 1, gap: 6, justifyContent: "center" },
  chatSpark: {
    position: "absolute",
    left: 28,
    bottom: 34,
    color: c.coral,
    fontSize: 25,
  },
});
