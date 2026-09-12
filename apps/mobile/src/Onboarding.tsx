import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Language, TranslationKey } from "./i18n";
import {
  Brand,
  Orbit,
  SourceIcon,
  Touch,
  Wave,
  palette as c,
  serif,
} from "./design";
import { IntroVideo } from "./IntroVideo";
import { planOffer, pricingCopy } from "./pricing";

const storageKey = "ursly-mobile-onboarding-v1";
const slideDuration = 5600;

/**
 * Four slides share one layout: art above, copy below. "What it costs" needs
 * two plans side by side and more words than a slide holds, so it carries its
 * own scrolling layout and only borrows the rail label.
 */
type Step =
  | {
      kind: "guide";
      label: TranslationKey;
      title: TranslationKey;
      body: TranslationKey;
      note: TranslationKey;
    }
  | { kind: "pricing"; label: TranslationKey };

const steps: Step[] = [
  {
    kind: "guide",
    label: "Bring a source",
    title: "Start with something worth understanding.",
    body: "Choose a PDF or a captioned YouTube video. Ursly reads it so you can focus on the ideas.",
    note: "PDF up to 25 MB · captioned videos",
  },
  {
    kind: "guide",
    label: "Ask naturally",
    title: "Use your voice when the thought arrives.",
    body: "Start a voice conversation, interrupt freely, or type whenever it feels easier.",
    note: "Voice or text · always in control",
  },
  {
    kind: "guide",
    label: "Go deeper",
    title: "Turn information into your next aha.",
    body: "Ask a follow-up, challenge an idea, or make it simpler. Every answer stays grounded in your source.",
    note: "Ask · follow up · understand",
  },
  {
    kind: "guide",
    label: "Choose your flow",
    title: "Voice, text, or a glimpse of what’s next.",
    body: "Voice is the default way to move through Ursly. Text is always ready, and Motion beta previews a future hands-free AR/VR layer without activating sensors.",
    note: "Voice to action · text fallback · motion beta",
  },
  { kind: "pricing", label: "What it costs" },
];

type Props = {
  motion: boolean;
  language: Language;
  t: (key: TranslationKey) => string;
};

export function MobileOnboarding({ motion, language, t }: Props) {
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
  const current = steps[step];

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
              {t("QUICK TOUR")} · {String(step + 1).padStart(2, "0")} /{" "}
              {String(steps.length).padStart(2, "0")}
            </Text>
            <IntroVideo motion={motion} language={language} t={t} />
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
          {current.kind === "pricing" ? (
            <PricingPanel
              label={`${t("STEP")} ${step + 1} · ${t(current.label).toUpperCase()}`}
              onStartFree={finish}
              t={t}
            />
          ) : (
            <>
              <View style={s.artFrame}>
                {step === 0 ? (
                  <SourceArt t={t} />
                ) : step === 1 ? (
                  <VoiceArt motion={motion} t={t} />
                ) : step === 2 ? (
                  <ChatArt t={t} />
                ) : (
                  <ModeArt motion={motion} t={t} />
                )}
              </View>
              <View style={s.copy}>
                <Text style={s.stepLabel}>
                  {t("STEP")} {step + 1} · {t(current.label).toUpperCase()}
                </Text>
                <Text accessibilityRole="header" style={s.title}>
                  {t(current.title)}
                </Text>
                <Text style={s.body}>{t(current.body)}</Text>
                <View style={s.noteRow}>
                  <View style={s.noteDot} />
                  <Text style={s.note}>{t(current.note)}</Text>
                </View>
              </View>
            </>
          )}
        </Animated.View>

        <View style={s.footer}>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={t("Guide progress")}
            accessibilityValue={{ min: 1, max: steps.length, now: step + 1 }}
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

/**
 * The price, in the same words as the web section. The figure and the sign-up
 * link are configuration: until both exist there is no button and no number,
 * only the standing line that billing is not open and everyone is on the free
 * terms. "Start free" needs no destination here because the reader is already
 * in the app, so it simply ends the tour.
 */
function PricingPanel({
  label,
  onStartFree,
  t,
}: { label: string; onStartFree: () => void } & Pick<Props, "t">) {
  return (
    <ScrollView
      style={p.scroll}
      contentContainerStyle={p.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.stepLabel}>{label}</Text>
      <Text accessibilityRole="header" style={p.heading}>
        {t(pricingCopy.heading)}
      </Text>
      <Text style={s.body}>{t(pricingCopy.intro)}</Text>

      <View
        accessibilityRole="list"
        accessibilityLabel={t(pricingCopy.planListLabel)}
        style={p.plans}
      >
        {pricingCopy.plans.map((plan) => {
          const paid = plan.id === "paid";
          const offer = planOffer(plan);
          return (
            <View
              key={plan.id}
              style={[p.plan, paid ? p.paidPlan : p.freePlan]}
            >
              <Text style={p.name}>{t(plan.name).toUpperCase()}</Text>
              <Text style={[p.amount, offer.announced && p.announced]}>
                {offer.amount ?? t(plan.amount)}
              </Text>
              <Text style={p.cadence}>{t(plan.cadence)}</Text>
              <Text style={p.deal}>{t(plan.deal)}</Text>
              <View style={p.points}>
                {plan.points.map((point) => (
                  <View key={point} style={p.point}>
                    <View style={p.bullet} />
                    <Text style={p.pointText}>{t(point)}</Text>
                  </View>
                ))}
              </View>
              {offer.pending ? (
                <Text style={p.pending}>{t(pricingCopy.pending)}</Text>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(plan.action)}
                  onPress={() =>
                    offer.href
                      ? void Linking.openURL(offer.href).catch(() => undefined)
                      : onStartFree()
                  }
                  style={[p.action, paid ? p.paidAction : p.freeAction]}
                >
                  <Text style={p.actionText}>{t(plan.action)}</Text>
                </Pressable>
              )}
              <Text style={p.note}>{t(plan.note)}</Text>
            </View>
          );
        })}
      </View>

      <Text style={p.promise}>{t(pricingCopy.promise)}</Text>
      <Text style={p.switchNote}>{t(pricingCopy.switchNote)}</Text>
    </ScrollView>
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

function ModeArt({ motion, t }: { motion: boolean } & Pick<Props, "t">) {
  return (
    <View accessible={false} style={art.modeArt}>
      <View style={[art.modeCard, art.modeVoice]}>
        <Wave motion={motion} color={c.ink} />
        <Text style={art.modeLabel}>{t("VOICE")}</Text>
        <Text style={art.modeDetail}>{t("Default")}</Text>
      </View>
      <View style={[art.modeCard, art.modeText]}>
        <SourceIcon kind="pdf" />
        <Text style={art.modeLabel}>{t("TEXT")}</Text>
        <Text style={art.modeDetail}>{t("Classic")}</Text>
      </View>
      <View style={[art.modeCard, art.modeMotion]}>
        <Text style={art.motionGlyph}>✦</Text>
        <Text style={art.modeLabel}>{t("MOTION BETA")}</Text>
        <Text style={art.modeDetail}>{t("Preview only")}</Text>
      </View>
      <View style={art.modeCaption}>
        <View style={art.pillDot} />
        <Text style={art.modeCaptionText}>{t("Always in your control")}</Text>
      </View>
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

const p = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { gap: 12, paddingVertical: 10, paddingBottom: 24 },
  heading: {
    color: c.ink,
    fontFamily: serif,
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.8,
  },
  plans: { gap: 12, marginTop: 6 },
  plan: {
    borderRadius: 18,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: c.line,
  },
  freePlan: { backgroundColor: c.peach },
  paidPlan: { backgroundColor: c.lavender },
  name: {
    color: c.muted,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "800",
  },
  amount: {
    color: c.ink,
    fontFamily: serif,
    fontSize: 25,
    letterSpacing: -0.6,
  },
  // A figure nobody can pay yet is a sentence, not a headline.
  announced: { fontSize: 15, lineHeight: 20 },
  cadence: { color: c.muted, fontSize: 11 },
  deal: { color: c.ink, fontSize: 13, fontWeight: "700", marginTop: 4 },
  points: { gap: 8, marginTop: 6 },
  point: { flexDirection: "row", gap: 8 },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.coral,
    marginTop: 7,
  },
  pointText: { flex: 1, color: c.muted, fontSize: 12, lineHeight: 18 },
  action: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  freeAction: { backgroundColor: c.coral },
  paidAction: { backgroundColor: c.white, borderWidth: 1, borderColor: c.ink },
  actionText: { color: c.ink, fontSize: 13, fontWeight: "800" },
  pending: {
    color: c.ink,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    backgroundColor: c.white,
    borderRadius: 12,
    padding: 11,
    marginTop: 10,
  },
  note: { color: c.muted, fontSize: 11, lineHeight: 16, marginTop: 6 },
  promise: { color: c.ink, fontSize: 12, lineHeight: 19, marginTop: 6 },
  switchNote: { color: c.muted, fontSize: 11, lineHeight: 17 },
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
    borderColor: "#D9D1C5",
  },
  ringInner: { width: 160, height: 160, borderColor: "#C8B6A3" },
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
  modeArt: {
    width: 305,
    height: 250,
    position: "relative",
    justifyContent: "center",
    gap: 8,
  },
  modeCard: {
    width: 205,
    minHeight: 62,
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    shadowColor: c.ink,
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  modeVoice: { alignSelf: "flex-start", backgroundColor: c.peach },
  modeText: { alignSelf: "center", backgroundColor: c.lavender },
  modeMotion: { alignSelf: "flex-end", backgroundColor: c.lime },
  modeLabel: {
    color: c.ink,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  modeDetail: { color: c.muted, fontSize: 10, marginLeft: "auto" },
  motionGlyph: { color: "#677C4A", fontSize: 18 },
  modeCaption: {
    position: "absolute",
    bottom: 5,
    left: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: c.white,
    borderRadius: 18,
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
  modeCaptionText: { color: c.ink, fontSize: 10, fontWeight: "700" },
});
