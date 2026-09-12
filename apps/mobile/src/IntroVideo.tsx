import React, { useEffect, useState } from "react";
import {
  AppState,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { Language, TranslationKey } from "./i18n";
import { palette as c, Touch, serif } from "./design";

const transcript: TranslationKey =
  "The next generation of internet: not a new website, but a new way to use one. Bring a document or a video and Ursly reads it, answering only from it. Say it, and Ursly does it. Motion to action is in beta, built for the headsets coming next. The keyboard still works; it is simply no longer the way in. And nothing ships until the loop closes: concept to production, tested in production, every cycle.";

type Props = {
  motion: boolean;
  language: Language;
  t: (key: TranslationKey) => string;
};

/** One rendering per language: the text is burned into the frames. */
const sources: Record<Language, number> = {
  en: require("../assets/ursly-intro.en.mp4"),
  fr: require("../assets/ursly-intro.fr.mp4"),
};

export function IntroVideo({ motion, language, t }: Props) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const player = useVideoPlayer(sources[language], (video) => {
    video.loop = false;
    video.muted = true;
  });

  useEffect(() => {
    if (open && !failed) player.play();
    else player.pause();
    return () => player.pause();
  }, [failed, open, player]);

  useEffect(() => {
    const subscription = player.addListener("statusChange", ({ status }) => {
      if (status === "error") setFailed(true);
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") player.pause();
    });
    return () => subscription.remove();
  }, [player]);

  function close() {
    player.pause();
    setOpen(false);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Watch the Ursly introduction")}
        onPress={() => {
          setFailed(false);
          setOpen(true);
        }}
        style={s.trigger}
      >
        <Text style={s.triggerText}>{t("Watch the Ursly introduction")}</Text>
        <Text style={s.triggerArrow}>↗</Text>
      </Pressable>
      <Modal
        visible={open}
        animationType={motion ? "fade" : "none"}
        presentationStyle="pageSheet"
        onRequestClose={close}
      >
        <View style={s.screen}>
          <View style={s.heading}>
            <View style={s.headingCopy}>
              <Text style={s.eyebrow}>{t("The Ursly story")}</Text>
              <Text accessibilityRole="header" style={s.title}>
                {t("A source. A conversation.")}
              </Text>
            </View>
            <Touch
              label={t("Close")}
              motion={motion}
              onPress={close}
              style={s.close}
            >
              <Text style={s.closeText}>{t("Close")}</Text>
            </Touch>
          </View>
          <Text style={s.lede}>
            {t(
              "A quick, high-level look at how Ursly helps ideas become clear.",
            )}
          </Text>
          {!failed ? (
            <VideoView
              player={player}
              nativeControls
              contentFit="contain"
              style={s.video}
              onFirstFrameRender={() => setFailed(false)}
            />
          ) : (
            <View style={s.fallback}>
              <Text style={s.fallbackTitle}>
                {t("The intro is unavailable right now.")}
              </Text>
              <Text style={s.fallbackText}>{t(transcript)}</Text>
            </View>
          )}
          <View style={s.transcript}>
            <Text style={s.transcriptTitle}>{t("Read the intro instead")}</Text>
            <Text style={s.transcriptText}>{t(transcript)}</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
  },
  triggerText: { color: c.coral, fontSize: 10, fontWeight: "700" },
  triggerArrow: { color: c.coral, fontSize: 13 },
  screen: { flex: 1, backgroundColor: c.paper, padding: 22, gap: 15 },
  heading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headingCopy: { flex: 1, gap: 6 },
  eyebrow: {
    color: c.coral,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  title: { color: c.ink, fontFamily: serif, fontSize: 29, lineHeight: 34 },
  close: {
    borderWidth: 1,
    borderColor: c.line,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  closeText: { color: c.ink, fontSize: 12, fontWeight: "700" },
  lede: { color: c.muted, fontSize: 14, lineHeight: 21 },
  video: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 14,
    backgroundColor: c.ink,
  },
  fallback: { padding: 18, borderRadius: 14, backgroundColor: c.white, gap: 8 },
  fallbackTitle: { color: c.ink, fontSize: 15, fontWeight: "800" },
  fallbackText: { color: c.muted, fontSize: 13, lineHeight: 20 },
  transcript: { gap: 6 },
  transcriptTitle: { color: c.coral, fontSize: 12, fontWeight: "800" },
  transcriptText: { color: c.muted, fontSize: 12, lineHeight: 19 },
});
