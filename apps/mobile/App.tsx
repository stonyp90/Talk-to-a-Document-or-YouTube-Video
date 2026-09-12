import {
  DEFAULT_LANGUAGE,
  Language,
  TranslationKey,
  translate,
  samples,
} from "./src/i18n";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import {
  ApiClient,
  apiOrigin,
  IngestedSource,
  isSignInRequired,
  isUsageLimit,
  Turn,
  updateTranscript,
} from "./src/client";
import { deviceSessionStore } from "./src/session";
import { MobileSignIn } from "./src/SignIn";
import { NativeVoice, VoiceStatus } from "./src/voice";
import {
  Bell,
  Brand,
  Orbit,
  palette as c,
  Reveal,
  serif,
  SourceIcon,
  Touch,
  useMotion,
  Wave,
} from "./src/design";
import { MobileVoiceActions } from "./src/VoiceActions";
import type { MobileVoiceActionId } from "./src/VoiceActions";
import { MobileBottomNav, type MobileDestination } from "./src/BottomNav";
import { chatSocketUrl, createChatClient } from "./src/chat";
import type { ChatClient } from "../../packages/core/src/application/chatClient";

const origin = apiOrigin(Platform.OS, process.env.EXPO_PUBLIC_API_URL);
/**
 * Where the live discussion is, if there is one. A deployment names it; a
 * developer's machine has it beside the API. With neither, every question goes
 * over the request path exactly as it did before.
 */
const channel = chatSocketUrl(origin, process.env.EXPO_PUBLIC_CHAT_SOCKET_URL);

const api = new ApiClient(
  origin,
  fetch,
  // The session outlives the process: the token the device kept is read back at
  // launch, so a signed-in reader is not asked again every time they return.
  deviceSessionStore(),
);
function messageOf(error: string, t: (key: TranslationKey) => string) {
  const message = error;
  if (/valid YouTube URL/i.test(message))
    return t("This doesn’t look like a YouTube link. Check it and try again.");
  if (/No captions/i.test(message))
    return t("This video has no captions. Try another video or a PDF.");
  if (/blocked/i.test(message))
    return t(
      "Captions are temporarily unavailable. Try a PDF or try again later.",
    );
  if (/25 MB/i.test(message)) return t("Choose a PDF smaller than 25 MB.");
  if (/413|too large|payload/i.test(message))
    return t("That file is too large. Choose a PDF smaller than 25 MB.");
  if (/401|403|unauthorized|forbidden/i.test(message))
    return t(
      "Ursly could not authorize that request. Check the connection and try again.",
    );
  if (/500|502|503|server error|internal server/i.test(message))
    return t("Ursly’s service had trouble finishing that. Please try again.");
  if (/network|fetch|timed out|aborted/i.test(message))
    return t(
      "The connection failed. Your source is still here — you can try again.",
    );
  return (
    (message && message !== "unknown" ? message : "") ||
    t("Something went wrong. Please try again.")
  );
}

export default function App() {
  const motion = useMotion();
  const [navHeight, setNavHeight] = useState(0);
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const t = (key: TranslationKey) => translate(language, key);
  const suggestions = (
    ["Summarize the essentials", "Explain simply", "Key takeaways"] as const
  ).map(t);
  const statuses = {
    ended: t("At your own pace"),
    connecting: t("Connecting…"),
    connected: t("Session active"),
    reconnecting: t("Reconnecting…"),
    error: t("Connection interrupted"),
  };
  const sampleText = samples[language];
  const [screen, setScreen] = useState<"home" | "conversation">("home");
  const [tab, setTab] = useState<"chat" | "source">("chat");
  const [sheet, setSheet] = useState<"youtube" | "about" | null>(null);
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<IngestedSource>();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<"pdf" | "youtube" | "chat" | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState<VoiceStatus>("ended");
  const [muted, setMuted] = useState(false);
  const [mode, setMode] = useState<"mock" | "live" | "unknown">("unknown");
  // Who is reading. Everything that spends provider credit waits for this.
  const [account, setAccount] = useState<{ email: string } | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const voice = useRef<NativeVoice | null>(null);
  const chat = useRef<ChatClient | null>(null);
  /** What the channel calls this conversation, so a question is a short frame. */
  const sourceId = useRef<string | undefined>(undefined);
  const sourceRef = useRef<IngestedSource | undefined>(undefined);
  const operation = useRef(0);
  const sequence = useRef(0);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const followTranscript = useRef(true);
  const composer = useRef<React.ComponentRef<typeof TextInput>>(null);
  const active = ["connecting", "connected", "reconnecting"].includes(status);

  // The sheet is no longer a native Modal, so it owns the Android back gesture.
  useEffect(() => {
    if (sheet === null) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (busy) return true;
        setSheet(null);
        return true;
      },
    );
    return () => subscription.remove();
  }, [sheet, busy]);

  function showToast(message: string) {
    setToast(message);
  }

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const operationRef = operation;
    const voiceRef = voice;
    const chatRef = chat;
    let mounted = true;
    void api
      .request("/api/health", { method: "GET" })
      .then((response) => response.json())
      .then((health) => {
        if (mounted && (health.mode === "mock" || health.mode === "live"))
          setMode(health.mode);
      })
      .catch(() => {});
    // The session the device kept, checked once at launch. A stale token is
    // dropped by the client itself, so this simply comes back empty.
    void api
      .readSession()
      .then((session) => {
        if (mounted) setAccount(session);
      })
      .catch(() => {});
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        voice.current?.stop();
        setMuted(false);
      }
    });
    return () => {
      mounted = false;
      operationRef.current++;
      listener.remove();
      voiceRef.current?.stop();
      chatRef.current?.close();
      chatRef.current = null;
    };
  }, []);

  function stop() {
    voice.current?.stop();
    voice.current = null;
    setMuted(false);
  }
  /**
   * The gate, in front of everything that spends provider credit: ingestion,
   * extraction, a typed question and a spoken session. Reading, the sample text
   * and the tour stay open, because none of them costs anything.
   */
  function needsSignIn(): boolean {
    if (account) return false;
    setError("");
    setSignInOpen(true);
    return true;
  }
  /** A refusal the reader can act on: sign in again, or come back later. */
  function fail(caught: unknown) {
    if (isSignInRequired(caught)) {
      setAccount(null);
      setError(t("Your session ended. Sign in again to continue."));
      setSignInOpen(true);
      return;
    }
    if (isUsageLimit(caught)) {
      setError(t("You have reached your limit for now. It reopens shortly."));
      return;
    }
    setError(caught instanceof Error ? caught.message : "unknown");
  }
  async function signOut() {
    await api.signOut();
    setAccount(null);
    stop();
    setSheet(null);
    showToast(t("You are signed out."));
  }
  /**
   * Opens the live discussion for a source and keeps it for the whole
   * conversation, so the extraction crosses the network once and every later
   * question is a short frame. With no channel configured, or none that will
   * open, `ask` falls back to the request path on its own.
   */
  function openChannel() {
    chat.current?.close();
    chat.current = null;
    sourceId.current = undefined;
    if (!channel) return;
    const client = createChatClient({
      url: channel,
      reference: () => ({
        sourceId: sourceId.current,
        source: sourceRef.current,
      }),
      onEvent: (event) => {
        if (event.type === "ready") {
          sourceId.current = event.sourceId;
          return;
        }
        if (event.type === "started") {
          setTurns((previous) => [
            ...previous,
            { id: event.askId, role: "assistant", text: "" },
          ]);
          return;
        }
        if (event.type === "delta") {
          setTurns((previous) =>
            previous.map((turn) =>
              turn.id === event.askId
                ? { ...turn, text: turn.text + event.text }
                : turn,
            ),
          );
          return;
        }
        if (event.type === "completed") {
          sourceId.current = event.sourceId;
          setTurns((previous) =>
            previous.map((turn) =>
              turn.id === event.askId ? { ...turn, text: event.text } : turn,
            ),
          );
          setBusy((current) => (current === "chat" ? null : current));
          showToast(t("Answer ready"));
          return;
        }
        if (event.type === "failed") {
          setBusy((current) => (current === "chat" ? null : current));
          setError(event.message);
        }
      },
    });
    chat.current = client;
    client.start();
  }

  function installSource(result: IngestedSource) {
    stop();
    sourceRef.current = result;
    openChannel();
    setSource(result);
    setTurns([]);
    setQuestion("");
    setUrl("");
    setExpanded(false);
    setError("");
    setTab("chat");
    setSheet(null);
    setScreen("conversation");
    showToast(t("Source ready"));
  }
  async function ingest(kind: "pdf" | "youtube") {
    if (busy) return;
    if (needsSignIn()) return;
    const current = ++operation.current;
    setBusy(kind);
    setError("");
    stop();
    Keyboard.dismiss();
    try {
      let result: IngestedSource;
      if (kind === "pdf") {
        const selection = await DocumentPicker.getDocumentAsync({
          type: "application/pdf",
          copyToCacheDirectory: true,
          multiple: false,
        });
        if (selection.canceled) return;
        result = await api.pdf(selection.assets[0]);
      } else result = await api.youtube(url);
      if (current === operation.current) installSource(result);
    } catch (caught) {
      if (current === operation.current) fail(caught);
    } finally {
      if (current === operation.current) setBusy(null);
    }
  }
  async function ask() {
    if (!source || !question.trim() || busy) return;
    if (needsSignIn()) return;
    const current = operation.current;
    const submitted = question.trim();
    setBusy("chat");
    setError("");
    Keyboard.dismiss();

    // The open channel is the fast path: a short frame on a connection that
    // already exists, and an answer that arrives as it is written.
    const askId = String(++sequence.current) + "a";
    if (chat.current?.ready) {
      setTurns((previous) => [
        ...previous,
        { id: askId + "u", role: "user", text: submitted },
      ]);
      if (chat.current.ask(askId, submitted)) {
        setQuestion("");
        return;
      }
      // The socket closed between the check and the send; drop the turn and
      // let the request path answer it rather than leaving it unanswered.
      setTurns((previous) =>
        previous.filter((turn) => turn.id !== askId + "u"),
      );
    }

    try {
      const answer = await api.ask(source, submitted);
      if (current !== operation.current) return;
      const id = String(++sequence.current);
      setTurns((previous) => [
        ...previous,
        { id: id + "u", role: "user", text: submitted },
        { id: id + "a", role: "assistant", text: answer },
      ]);
      setQuestion("");
      showToast(t("Answer ready"));
    } catch (caught) {
      if (current === operation.current) fail(caught);
    } finally {
      if (current === operation.current) setBusy(null);
    }
  }
  function startVoice() {
    if (!source || busy) return;
    if (needsSignIn()) return;
    stop();
    setError("");
    Keyboard.dismiss();
    voice.current = new NativeVoice(
      api,
      source,
      setStatus,
      (event) => {
        if (event.type === "mock.ready") setMode("mock");
        else setTurns((previous) => updateTranscript(previous, event));
      },
      (caught) => {
        // A spoken session reports failures as text, so the object is gone by
        // the time it arrives here. A refused session clears the stored token,
        // and that is the tell: the reader is signed out, not disconnected.
        if (!api.signedIn) {
          setAccount(null);
          setError(t("Your session ended. Sign in again to continue."));
          setSignInOpen(true);
          return;
        }
        setError(caught);
      },
    );
    void voice.current.start();
  }
  function handleVoiceAction(action: MobileVoiceActionId) {
    if ((action === "voice" || action === "summarize") && !source) {
      setError(t("Add a source first, then say let’s talk again."));
      return;
    }
    showToast(t("Voice action received"));
    if (action === "upload") {
      void ingest("pdf");
      return;
    }
    if (action === "youtube") {
      setError("");
      setSheet("youtube");
      return;
    }
    if (action === "voice") {
      setScreen("conversation");
      setTab("chat");
      startVoice();
      return;
    }
    if (action === "summarize") {
      setScreen("conversation");
      setTab("chat");
      setQuestion(t("Summarize the essentials"));
      setTimeout(() => composer.current?.focus(), 0);
      return;
    }
    if (action === "back") {
      stop();
      if (sheet) {
        setSheet(null);
        return;
      }
      if (screen === "conversation") {
        setScreen("home");
        return;
      }
      setTab("chat");
      setError("");
      return;
    }
    if (action === "next") {
      if (screen === "home") {
        if (source) {
          setScreen("conversation");
          setTab("chat");
        } else setSheet("youtube");
        return;
      }
      setTab("chat");
      setTimeout(() => composer.current?.focus(), 0);
      return;
    }
    operation.current++;
    stop();
    setBusy(null);
    setSheet(null);
    setError("");
    setQuestion("");
  }
  function navigate(destination: MobileDestination) {
    if (destination === "home") {
      operation.current++;
      stop();
      setBusy(null);
      setScreen("home");
      setTab("chat");
      Keyboard.dismiss();
      return;
    }
    if (!source) {
      showToast(t("Add a source first to open this section."));
      return;
    }
    setScreen("conversation");
    setTab(destination === "source" ? "source" : "chat");
    Keyboard.dismiss();
  }
  function trySample() {
    operation.current++;
    installSource({
      kind: "pdf",
      sourceName: t("The power of small breaks"),
      text: sampleText,
      characters: sampleText.length,
    });
  }
  const notice = error ? (
    <Reveal motion={motion} style={s.error}>
      <Text accessibilityRole="alert" style={s.errorText}>
        {messageOf(error, t)}
      </Text>
      <Touch
        label={t("Dismiss message")}
        motion={motion}
        onPress={() => setError("")}
      >
        <Text style={s.errorText}>×</Text>
      </Touch>
    </Reveal>
  ) : null;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.screen} edges={["top", "left", "right", "bottom"]}>
        <KeyboardAvoidingView
          style={s.screen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {screen === "home" ? (
            <ScrollView
              key="home"
              style={s.homeScroll}
              contentContainerStyle={s.homeContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={s.header}>
                <Brand />
                <View style={s.headerActions}>
                  <Touch
                    label={t("Notifications")}
                    onPress={() => showToast(t("You're all caught up."))}
                    motion={motion}
                    style={s.bellButton}
                  >
                    <Bell />
                  </Touch>
                  <Touch
                    label={t("About Ursly and language")}
                    onPress={() => setSheet("about")}
                    motion={motion}
                    style={s.infoButton}
                  >
                    <Text style={s.tabLabel}>{language.toUpperCase()}</Text>
                  </Touch>
                </View>
              </View>
              <Reveal motion={motion} style={s.hero}>
                <View style={s.rowBetween}>
                  <Text style={s.heroEyebrow}>
                    {t("A LITTLE MORE CLARITY")}
                  </Text>
                  <View style={s.smallDot} />
                </View>
                <View style={s.heroMain}>
                  <Text style={s.heroTitle}>
                    {t("Your ideas.")}
                    {"\n"}
                    <Text style={{ color: c.lime }}>{t("Made clear.")}</Text>
                  </Text>
                  <View style={s.heroArt}>
                    <Orbit motion={motion} />
                  </View>
                </View>
                <Text style={s.heroDescription}>
                  {t("A document. A video.")}
                  {"\n"}
                  {t("And the conversation begins.")}
                </Text>
                <View style={s.heroFooter}>
                  <View style={s.heroLine} />
                  <Text style={s.heroFooterText}>
                    {t("Less scrolling. More understanding.")}
                  </Text>
                </View>
              </Reveal>
              <Reveal motion={motion} delay={70}>
                <View style={s.sectionHeading}>
                  <Text style={s.heading}>{t("Let’s explore")}</Text>
                  <Text style={s.sectionNote}>{t("Your choice")}</Text>
                </View>
                <View style={s.importRow}>
                  <Touch
                    label={t("Import a PDF")}
                    onPress={() => void ingest("pdf")}
                    motion={motion}
                    disabled={!!busy}
                    style={[s.importCard, { backgroundColor: c.peach }]}
                  >
                    <View style={s.importInner}>
                      <View style={s.rowBetween}>
                        <View style={s.iconTile}>
                          <SourceIcon kind="pdf" />
                        </View>
                        <Text style={s.diagonalArrow}>↗</Text>
                      </View>
                      <View>
                        <Text style={s.importTitle}>{t("A document")}</Text>
                        <Text style={s.importCaption}>
                          {t("PDF · up to 25 MB")}
                        </Text>
                      </View>
                    </View>
                  </Touch>
                  <Touch
                    label={t("Add a YouTube video")}
                    onPress={() => {
                      setError("");
                      setSheet("youtube");
                    }}
                    motion={motion}
                    disabled={!!busy}
                    style={[s.importCard, { backgroundColor: c.lavender }]}
                  >
                    <View style={s.importInner}>
                      <View style={s.rowBetween}>
                        <View style={s.iconTile}>
                          <SourceIcon kind="youtube" />
                        </View>
                        <Text style={s.diagonalArrow}>↗</Text>
                      </View>
                      <View>
                        <Text style={s.importTitle}>{t("A video")}</Text>
                        <Text style={s.importCaption}>
                          {t("Paste a YouTube link")}
                        </Text>
                      </View>
                    </View>
                  </Touch>
                </View>
              </Reveal>
              {busy && (
                <View style={s.loading} accessibilityLiveRegion="polite">
                  <ActivityIndicator color={c.ink} />
                  <Text style={s.body}>{t("Getting your source ready…")}</Text>
                </View>
              )}
              {notice}
              {source ? (
                <Reveal motion={motion} delay={100}>
                  <Touch
                    label={t("Resume conversation")}
                    onPress={() => setScreen("conversation")}
                    motion={motion}
                    disabled={!!busy}
                    style={s.resume}
                  >
                    <View style={s.resumeInner}>
                      <View style={s.resumeIcon}>
                        <SourceIcon kind={source.kind} />
                      </View>
                      <View style={s.flex}>
                        <Text style={s.eyebrow}>
                          {t("PICK UP WHERE YOU LEFT OFF")}
                        </Text>
                        <Text numberOfLines={2} style={s.resumeTitle}>
                          {source.sourceName}
                        </Text>
                      </View>
                      <Text style={s.diagonalArrow}>→</Text>
                    </View>
                  </Touch>
                </Reveal>
              ) : (
                <Reveal motion={motion} delay={140}>
                  <Touch
                    label={t("Try a sample text")}
                    onPress={trySample}
                    motion={motion}
                    disabled={!!busy}
                    style={s.sample}
                  >
                    <View style={s.resumeInner}>
                      <View style={s.sampleStar}>
                        <Text style={s.star}>✦</Text>
                      </View>
                      <View style={s.flex}>
                        <Text style={s.sampleTitle}>
                          {t("A little taste of Ursly")}
                        </Text>
                        <Text style={s.caption}>
                          {t("Explore Ursly with a short read.")}
                        </Text>
                      </View>
                      <Text style={s.diagonalArrow}>→</Text>
                    </View>
                  </Touch>
                </Reveal>
              )}
              <MobileVoiceActions
                language={language}
                motion={motion}
                voiceBusy={!!busy || active}
                canStartVoice={!!source}
                t={t}
                onAction={handleVoiceAction}
                onNotice={showToast}
              />
              <Reveal motion={motion} delay={180} style={s.how}>
                <Text style={s.eyebrow}>{t("A NEW WAY TO LEARN")}</Text>
                <View style={s.steps}>
                  {[
                    ["01", t("Add")],
                    ["02", t("Ask")],
                    ["03", t("Understand")],
                  ].map(([number, label]) => (
                    <View key={number} style={s.step}>
                      <Text style={s.stepNumber}>{number}</Text>
                      <Text style={s.stepText}>{label}</Text>
                    </View>
                  ))}
                </View>
              </Reveal>
              <Text style={s.signature}>
                {t("Make room for your next aha.")}
              </Text>
              {mode === "mock" && (
                <Text style={s.demoFootnote}>
                  {t("Demo space · simulated answers and audio")}
                </Text>
              )}
            </ScrollView>
          ) : (
            <>
              <View style={s.workspaceHeader}>
                <Touch
                  label={t("Back to sources")}
                  onPress={() => {
                    stop();
                    setScreen("home");
                    Keyboard.dismiss();
                  }}
                  motion={motion}
                  disabled={!!busy}
                >
                  <Text style={s.back}>
                    ‹ <Text style={s.backLabel}>{t("Sources")}</Text>
                  </Text>
                </Touch>
                <Brand small />
                <Touch
                  label={t("About Ursly and language")}
                  onPress={() => setSheet("about")}
                  motion={motion}
                  style={{ width: 84 }}
                >
                  <Text style={s.tabLabel}>{language.toUpperCase()}</Text>
                </Touch>
              </View>
              <View style={s.tabs}>
                {(["chat", "source"] as const).map((value) => (
                  <Touch
                    key={value}
                    label={
                      value === "chat" ? t("Conversation") : t("The source")
                    }
                    onPress={() => {
                      setTab(value);
                      Keyboard.dismiss();
                    }}
                    selected={tab === value}
                    motion={motion}
                    style={[s.tab, tab === value && s.tabSelected]}
                  >
                    <Text
                      style={[s.tabLabel, tab === value && { color: c.ink }]}
                    >
                      {value === "chat" ? t("Conversation") : t("The source")}
                    </Text>
                  </Touch>
                ))}
              </View>
              {active && (
                <View style={s.pinnedVoice}>
                  <Text accessibilityLiveRegion="polite" style={s.statusText}>
                    {muted ? t("Microphone muted") : statuses[status]}
                  </Text>
                  <View style={s.voiceButtons}>
                    <Touch
                      label={
                        muted ? t("Unmute microphone") : t("Mute microphone")
                      }
                      motion={motion}
                      onPress={() => {
                        voice.current?.setMuted(!muted);
                        setMuted(!muted);
                      }}
                      disabled={status !== "connected"}
                      style={s.secondaryDark}
                    >
                      <Text style={s.buttonLight}>
                        {muted ? t("Unmute") : t("Mute")}
                      </Text>
                    </Touch>
                    <Touch
                      label={t("Stop session")}
                      motion={motion}
                      onPress={stop}
                      style={s.primary}
                    >
                      <Text style={s.buttonInk}>{t("■  End session")}</Text>
                    </Touch>
                  </View>
                  <Touch
                    label={t("Continue by typing")}
                    motion={motion}
                    onPress={() => {
                      stop();
                      composer.current?.focus();
                    }}
                  >
                    <Text style={s.textLinkLight}>
                      {t("Continue by typing")}
                    </Text>
                  </Touch>
                </View>
              )}
              <ScrollView
                key={tab}
                ref={scroll}
                contentContainerStyle={s.chatContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={32}
                onScroll={({
                  nativeEvent: {
                    contentOffset,
                    contentSize,
                    layoutMeasurement,
                  },
                }) => {
                  followTranscript.current =
                    contentOffset.y + layoutMeasurement.height >=
                    contentSize.height - 80;
                }}
                onContentSizeChange={() => {
                  if (
                    tab === "chat" &&
                    turns.length &&
                    followTranscript.current
                  )
                    scroll.current?.scrollToEnd({ animated: motion });
                }}
              >
                {source && (
                  <Reveal motion={motion} style={s.sourceSummary}>
                    <View style={s.sourceBadge}>
                      <SourceIcon kind={source.kind} />
                    </View>
                    <View style={s.flex}>
                      <Text style={s.eyebrow}>
                        {source.kind === "youtube"
                          ? t("YOUTUBE VIDEO")
                          : t("YOUR DOCUMENT")}
                      </Text>
                      <Text
                        style={s.sourceName}
                        numberOfLines={tab === "chat" ? 2 : undefined}
                      >
                        {source.sourceName}
                      </Text>
                      <Text style={s.caption}>
                        {source.characters.toLocaleString(
                          language === "en" ? "en-CA" : "fr-CA",
                        )}
                        {language === "en"
                          ? " characters · ready to explore"
                          : " caractères · prêt à explorer"}
                      </Text>
                    </View>
                  </Reveal>
                )}
                {tab === "source" ? (
                  <Reveal motion={motion} delay={60} style={s.readingCard}>
                    <Text style={s.readingTitle}>
                      {t("It all starts here.")}
                    </Text>
                    <Text style={s.readingHint}>
                      {t("Your source text, always close at hand.")}
                    </Text>
                    <Text selectable style={s.sourceText}>
                      {expanded
                        ? source?.text
                        : (source?.text.slice(0, 600) ?? "") +
                          ((source?.text.length ?? 0) > 600 ? "…" : "")}
                    </Text>
                    {(source?.text.length ?? 0) > 600 && (
                      <Touch
                        label={
                          expanded ? t("Show less") : t("Read the full text")
                        }
                        motion={motion}
                        onPress={() => setExpanded(!expanded)}
                        style={s.outline}
                      >
                        <Text style={s.buttonInk}>
                          {expanded
                            ? t("Show less ↑")
                            : t("Read the full text ↓")}
                        </Text>
                      </Touch>
                    )}
                    <Touch
                      label={t("Ask about this source")}
                      motion={motion}
                      onPress={() => setTab("chat")}
                      style={s.primary}
                    >
                      <Text style={s.buttonInk}>{t("Let’s talk →")}</Text>
                    </Touch>
                  </Reveal>
                ) : (
                  <>
                    <Reveal motion={motion} delay={65} style={s.voiceCard}>
                      <View style={s.rowBetween}>
                        <View style={s.flex}>
                          <Text style={s.voiceEyebrow}>
                            {t("THE JOY OF UNDERSTANDING")}
                          </Text>
                          <Text style={s.voiceTitle}>
                            {active
                              ? t("Let’s talk it through.")
                              : t("Think out loud.")}
                          </Text>
                        </View>
                        <Wave
                          motion={motion && active && !muted}
                          color={c.coral}
                          large
                        />
                      </View>
                      <View style={s.statusRow}>
                        <View
                          style={[
                            s.statusDot,
                            {
                              backgroundColor:
                                status === "error"
                                  ? c.coral
                                  : active
                                    ? c.lime
                                    : c.lilac,
                            },
                          ]}
                        />
                        <Text
                          accessibilityLiveRegion="polite"
                          style={s.statusText}
                        >
                          {muted ? t("Microphone muted") : statuses[status]}
                        </Text>
                        {(status === "connecting" ||
                          status === "reconnecting") && (
                          <ActivityIndicator size="small" color={c.lime} />
                        )}
                      </View>
                      {!active && (
                        <Touch
                          label={t("Start voice conversation")}
                          motion={motion}
                          onPress={startVoice}
                          disabled={!!busy}
                          style={s.primary}
                        >
                          <View style={s.buttonRow}>
                            <Wave motion={false} />
                            <Text style={s.buttonInk}>{t("Let’s talk")}</Text>
                            <Text style={s.arrow}>↗</Text>
                          </View>
                        </Touch>
                      )}
                      {mode === "mock" && (
                        <Text style={s.demoNotice}>
                          {t("Demo mode · voice and answers are simulated.")}
                        </Text>
                      )}
                    </Reveal>
                    {notice}
                    {!turns.length && (
                      <Reveal
                        motion={motion}
                        delay={100}
                        style={s.conversationEmpty}
                      >
                        <Text style={s.emptyTitle}>
                          {t("The best question")}
                          {"\n"}
                          {t("is yours.")}
                        </Text>
                        <Text style={s.emptyCaption}>
                          {t("A detail to clarify, an idea to explore…")}
                        </Text>
                        <View style={s.suggestions}>
                          {suggestions.map((prompt, index) => (
                            <Touch
                              key={prompt}
                              label={prompt}
                              motion={motion}
                              disabled={!!busy}
                              onPress={() => {
                                setQuestion(prompt);
                                composer.current?.focus();
                              }}
                              style={s.suggestion}
                            >
                              <View style={s.suggestionInner}>
                                <Text
                                  style={[
                                    s.suggestionSymbol,
                                    {
                                      color: ["#A9513A", "#6E5D4C", "#536C39"][
                                        index
                                      ],
                                    },
                                  ]}
                                >
                                  {["✦", "≈", "↗"][index]}
                                </Text>
                                <Text style={s.suggestionText}>{prompt}</Text>
                                <Text style={s.suggestionArrow}>+</Text>
                              </View>
                            </Touch>
                          ))}
                        </View>
                      </Reveal>
                    )}
                    {turns.map((turn) => (
                      <Reveal
                        key={turn.id}
                        motion={motion}
                        style={[
                          s.message,
                          turn.role === "user"
                            ? s.userMessage
                            : s.assistantMessage,
                        ]}
                      >
                        <View style={s.messageHeader}>
                          {turn.role === "assistant" && (
                            <View style={s.miniBrand}>
                              <Wave motion={false} color={c.coral} />
                            </View>
                          )}
                          <Text style={s.messageRole}>
                            {turn.role === "user" ? t("YOU") : "URSLY"}
                          </Text>
                        </View>
                        <Text selectable style={s.messageText}>
                          {turn.text}
                        </Text>
                      </Reveal>
                    ))}
                    {busy === "chat" && (
                      <View style={s.loading} accessibilityLiveRegion="polite">
                        <ActivityIndicator color={c.coral} />
                        <Text style={s.caption}>
                          {t("Ursly is preparing an answer…")}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </ScrollView>
              {tab === "chat" && (
                <View style={s.composerWrap}>
                  <View style={s.composer}>
                    <TextInput
                      ref={composer}
                      accessibilityLabel={t("Your question")}
                      placeholder={t("What’s on your mind?")}
                      placeholderTextColor={c.muted}
                      value={question}
                      onChangeText={setQuestion}
                      multiline
                      style={s.questionInput}
                      editable={!busy}
                    />
                    <Touch
                      label={t("Send question")}
                      motion={motion}
                      onPress={() => void ask()}
                      disabled={!!busy || !question.trim()}
                      style={s.send}
                    >
                      {busy === "chat" ? (
                        <ActivityIndicator color={c.ink} />
                      ) : (
                        <Text style={s.sendArrow}>↑</Text>
                      )}
                    </Touch>
                  </View>
                  <Text style={s.composerHint}>
                    {t("Grounded in your source. Explored through your eyes.")}
                  </Text>
                </View>
              )}
            </>
          )}
          <MobileBottomNav
            destination={screen === "home" ? "home" : tab}
            language={language}
            motion={motion}
            sourceReady={!!source}
            t={t}
            onNavigate={navigate}
            onLayout={(event) => setNavHeight(event.nativeEvent.layout.height)}
          />
          {toast && (
            <View
              pointerEvents="box-none"
              style={[s.toastWrap, { bottom: navHeight + 12 }]}
            >
              <View
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={s.toast}
              >
                <Text style={s.toastText}>{toast}</Text>
                <Touch
                  label={t("Dismiss message")}
                  motion={motion}
                  onPress={() => setToast("")}
                  style={s.toastClose}
                >
                  <Text style={s.toastCloseText}>×</Text>
                </Touch>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
        {sheet !== null && (
          <KeyboardAvoidingView
            style={s.modalRoot}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Close window")}
              style={s.scrim}
              disabled={!!busy}
              onPress={() => setSheet(null)}
            />
            <SafeAreaView style={s.sheet} edges={["bottom"]}>
              <ScrollView
                style={{ flexShrink: 1 }}
                contentContainerStyle={{ gap: 18, paddingBottom: 8 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={s.sheetHandle} />
                <View style={s.rowBetween}>
                  <Text style={s.sheetTitle}>
                    {sheet === "youtube"
                      ? t("One video. New ideas.")
                      : t("Hi there, we’re Ursly.")}
                  </Text>
                  <Touch
                    label={t("Close")}
                    onPress={() => setSheet(null)}
                    motion={motion}
                    disabled={!!busy}
                  >
                    <Text style={s.close}>×</Text>
                  </Touch>
                </View>
                {sheet === "about" && (
                  <View style={{ gap: 10 }}>
                    <Text style={s.aboutTitle}>{t("Your account")}</Text>
                    {account ? (
                      <>
                        <Text style={s.caption}>
                          {t("Signed in as")} {account.email}
                        </Text>
                        <Touch
                          label={t("Sign out")}
                          motion={motion}
                          onPress={() => void signOut()}
                          style={[s.tab, { backgroundColor: c.white }]}
                        >
                          <Text style={s.tabLabel}>{t("Sign out")}</Text>
                        </Touch>
                      </>
                    ) : (
                      <Touch
                        label={t("Sign in to continue")}
                        motion={motion}
                        onPress={() => {
                          setSheet(null);
                          setSignInOpen(true);
                        }}
                        style={[s.tab, { backgroundColor: c.lavender }]}
                      >
                        <Text style={s.tabLabel}>{t("Sign in")}</Text>
                      </Touch>
                    )}
                  </View>
                )}
                {sheet === "about" && (
                  <View style={{ gap: 10 }}>
                    <Text style={s.aboutTitle}>{t("App language")}</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {(["en", "fr"] as const).map((value) => (
                        <Touch
                          key={value}
                          label={value === "en" ? "English" : "Français"}
                          selected={language === value}
                          motion={motion}
                          onPress={() => setLanguage(value)}
                          style={[
                            s.tab,
                            {
                              backgroundColor:
                                language === value ? c.lavender : c.white,
                            },
                          ]}
                        >
                          <Text style={s.tabLabel}>
                            {value === "en" ? "English" : "Français"}
                            {language === value ? " ✓" : ""}
                          </Text>
                        </Touch>
                      ))}
                    </View>
                  </View>
                )}
                {sheet === "youtube" ? (
                  <>
                    <Text style={s.sheetCaption}>
                      {t("Paste a YouTube link with captions.")}
                      {"\n"}
                      {t("We’ll get the text. You bring the curiosity.")}
                    </Text>
                    <View style={s.urlRow}>
                      <TextInput
                        accessibilityLabel={t("YouTube link")}
                        placeholder="https://youtube.com/watch?v=…"
                        placeholderTextColor={c.muted}
                        value={url}
                        onChangeText={setUrl}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        returnKeyType="go"
                        onSubmitEditing={() => {
                          if (url.trim()) void ingest("youtube");
                        }}
                        style={[s.urlInput, { flex: 1 }]}
                        editable={!busy}
                      />
                      <Touch
                        label={t("Load video")}
                        motion={motion}
                        onPress={() => void ingest("youtube")}
                        disabled={!!busy || !url.trim()}
                        style={s.send}
                      >
                        {busy === "youtube" ? (
                          <ActivityIndicator color={c.ink} />
                        ) : (
                          <Text style={s.sendArrow}>↑</Text>
                        )}
                      </Touch>
                    </View>
                    {notice}
                  </>
                ) : (
                  <>
                    <Text style={s.sheetCaption}>
                      {t(
                        "Your documents and videos have something to say. Ursly helps you explore them, one question at a time.",
                      )}
                    </Text>
                    <View style={s.aboutNote}>
                      <Text style={s.aboutTitle}>
                        {t("Your curiosity takes it from here.")}
                      </Text>
                      <Text style={s.body}>
                        {t(
                          "Add a source, read its text and chat by typing or speaking. Conversation history stays in the current session.",
                        )}
                      </Text>
                    </View>
                    <Text style={s.caption}>
                      {mode === "mock"
                        ? t("This space uses demo answers, captions and audio.")
                        : t(
                            "Voice requires microphone access and a connected service.",
                          )}
                    </Text>
                    <Text style={s.caption}>
                      {t(
                        "Animations follow your device’s accessibility preferences.",
                      )}
                    </Text>
                  </>
                )}
              </ScrollView>
            </SafeAreaView>
          </KeyboardAvoidingView>
        )}
        {signInOpen && (
          <MobileSignIn
            motion={motion}
            t={t}
            onRequestCode={(email) => api.requestSignInCode(email)}
            onConfirm={async (email, code) => {
              setAccount(await api.confirmSignInCode(email, code));
              setSignInOpen(false);
              setError("");
            }}
            onClose={() => setSignInOpen(false)}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.paper },
  homeScroll: { flex: 1 },
  flex: { flex: 1 },
  homeContent: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 25,
    gap: 22,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 1,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoButton: {
    borderRadius: 24,
    backgroundColor: c.lavender,
    width: 45,
    height: 45,
  },
  bellButton: {
    borderRadius: 23,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: "transparent",
    width: 45,
    height: 45,
  },
  infoLetter: { fontFamily: serif, fontSize: 20, color: c.ink },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  hero: {
    backgroundColor: c.ink,
    borderRadius: 29,
    padding: 23,
    overflow: "hidden",
  },
  heroEyebrow: {
    color: "#D4C9BF",
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: "700",
  },
  smallDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.lime },
  heroMain: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 156,
    marginTop: 8,
  },
  heroTitle: {
    fontFamily: serif,
    fontSize: 37,
    lineHeight: 43,
    letterSpacing: -1.7,
    color: c.paper,
    flex: 1,
    zIndex: 1,
  },
  heroArt: {
    width: 113,
    height: 142,
    justifyContent: "center",
    alignItems: "center",
    transform: [{ scale: 0.78 }],
    marginRight: -7,
  },
  heroDescription: {
    color: "#E3DDD5",
    fontSize: 15,
    lineHeight: 22,
    marginTop: -3,
  },
  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
  },
  heroLine: { width: 22, height: 1, backgroundColor: c.coral },
  heroFooterText: { color: "#CDC1B5", fontSize: 11 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 13,
  },
  heading: {
    fontSize: 21,
    fontWeight: "700",
    letterSpacing: -0.6,
    color: c.ink,
  },
  sectionNote: { fontSize: 11, color: c.muted },
  importRow: { flexDirection: "row", gap: 12 },
  importCard: { flex: 1, borderRadius: 23 },
  importInner: { width: "100%", padding: 3, gap: 22 },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF70",
    alignItems: "center",
    justifyContent: "center",
  },
  diagonalArrow: { fontSize: 24, color: c.ink, fontWeight: "300" },
  importTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: c.ink,
    letterSpacing: -0.4,
  },
  importCaption: {
    marginTop: 6,
    color: "#615767",
    fontSize: 11,
    lineHeight: 16,
  },
  sample: {
    backgroundColor: c.white,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: c.line,
  },
  resumeInner: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    gap: 12,
  },
  sampleStar: {
    width: 39,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "#EDF0DF",
  },
  star: { fontSize: 27, color: "#677C4A" },
  sampleTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: c.ink,
    marginBottom: 4,
  },
  caption: { fontSize: 12, color: c.muted, lineHeight: 18 },
  how: { paddingHorizontal: 2, paddingTop: 1 },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.3,
    color: c.muted,
    fontWeight: "700",
  },
  steps: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 16,
  },
  step: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepNumber: { fontFamily: serif, color: "#88776A", fontSize: 17 },
  stepText: { fontSize: 11, color: c.ink },
  signature: {
    color: "#746B63",
    fontFamily: serif,
    fontStyle: "italic",
    fontSize: 16,
    textAlign: "center",
    paddingTop: 3,
  },
  demoFootnote: {
    textAlign: "center",
    fontSize: 10,
    color: c.muted,
    marginTop: -12,
  },
  resume: { backgroundColor: c.lavender, borderRadius: 22 },
  resumeIcon: {
    width: 40,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
  },
  resumeTitle: { fontSize: 14, fontWeight: "600", color: c.ink, marginTop: 4 },
  loading: {
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  body: { fontSize: 14, lineHeight: 22, color: c.muted },
  toastWrap: {
    position: "absolute",
    left: 18,
    right: 18,
    zIndex: 20,
    elevation: 20,
  },
  toast: {
    minHeight: 48,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: 16,
    backgroundColor: c.ink,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: c.ink,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  toastText: { flex: 1, color: c.paper, fontSize: 12, lineHeight: 18 },
  toastClose: { flexGrow: 0, width: 38, height: 38 },
  toastCloseText: { color: c.paper, fontSize: 22, fontWeight: "300" },
  error: {
    paddingLeft: 15,
    borderRadius: 16,
    backgroundColor: c.errorBg,
    flexDirection: "row",
    alignItems: "center",
  },
  errorText: { flex: 1, fontSize: 13, lineHeight: 20, color: c.error },
  workspaceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  back: { color: c.ink, fontSize: 28 },
  backLabel: { fontSize: 13, fontWeight: "600" },
  tabs: {
    alignSelf: "center",
    backgroundColor: c.paper,
    borderColor: c.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    marginBottom: 10,
    padding: 3,
    width: "100%",
  },
  tab: { flex: 1, borderRadius: 10, minHeight: 34 },
  tabSelected: { backgroundColor: c.white },
  tabLabel: { color: c.muted, fontSize: 13, fontWeight: "600" },
  chatContent: { padding: 22, gap: 18, paddingBottom: 28 },
  sourceSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: 20,
    backgroundColor: c.lavender,
  },
  sourceBadge: {
    backgroundColor: "#F5F1EA",
    width: 44,
    height: 48,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceName: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
    color: c.ink,
    marginVertical: 3,
  },
  pinnedVoice: {
    backgroundColor: c.ink,
    marginHorizontal: 22,
    padding: 12,
    gap: 6,
    borderRadius: 20,
  },
  voiceCard: { backgroundColor: c.ink, borderRadius: 25, padding: 21, gap: 15 },
  voiceEyebrow: {
    color: "#C8BDB1",
    fontSize: 8,
    letterSpacing: 1.1,
    fontWeight: "700",
  },
  voiceTitle: {
    fontFamily: serif,
    color: c.paper,
    fontSize: 33,
    letterSpacing: -0.8,
    marginTop: 7,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  statusDot: { height: 6, width: 6, borderRadius: 4 },
  statusText: { fontSize: 12, color: "#E1DAD2" },
  voiceButtons: { flexDirection: "row", gap: 10 },
  secondaryDark: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#6D6576",
    borderRadius: 16,
  },
  primary: { backgroundColor: c.coral, borderRadius: 17, flexGrow: 1 },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  buttonInk: { color: c.ink, fontSize: 15, fontWeight: "700" },
  buttonLight: { color: c.paper, fontSize: 14, fontWeight: "600" },
  arrow: { fontSize: 23, color: c.ink, marginLeft: 6 },
  textLinkLight: {
    color: "#E1DAD2",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  demoNotice: {
    color: "#D1C5B9",
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
  },
  conversationEmpty: { paddingVertical: 8 },
  emptyTitle: {
    fontFamily: serif,
    fontSize: 27,
    color: c.ink,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  emptyCaption: { fontSize: 13, color: c.muted, marginTop: 8, lineHeight: 19 },
  suggestions: { gap: 8, marginTop: 18 },
  suggestion: {
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 15,
  },
  suggestionInner: {
    flexDirection: "row",
    gap: 11,
    alignItems: "center",
    width: "100%",
  },
  suggestionSymbol: { fontSize: 23, width: 25, textAlign: "center" },
  suggestionText: { flex: 1, fontSize: 13, color: c.ink },
  suggestionArrow: { color: c.muted, fontSize: 18 },
  message: { borderRadius: 21, padding: 18, gap: 10 },
  userMessage: {
    backgroundColor: c.lavender,
    marginLeft: 26,
    borderBottomRightRadius: 6,
  },
  assistantMessage: {
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: c.line,
    marginRight: 12,
    borderBottomLeftRadius: 6,
  },
  messageHeader: { flexDirection: "row", gap: 7, alignItems: "center" },
  messageRole: {
    color: "#6E5D4C",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  miniBrand: { height: 18, width: 23, transform: [{ scale: 0.65 }] },
  messageText: { color: c.ink, fontSize: 15, lineHeight: 24 },
  composerWrap: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 5,
    borderTopWidth: 1,
    borderColor: c.line,
    backgroundColor: c.paper,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderWidth: 1,
    borderColor: "#DCD3CB",
    borderRadius: 23,
    backgroundColor: c.white,
    padding: 6,
  },
  questionInput: {
    flex: 1,
    color: c.ink,
    fontSize: 14,
    padding: 11,
    paddingTop: 13,
    minHeight: 46,
    maxHeight: 124,
  },
  send: { backgroundColor: c.coral, borderRadius: 18, width: 46, height: 46 },
  sendArrow: { fontSize: 25, color: c.ink, fontWeight: "500" },
  composerHint: {
    color: c.muted,
    fontSize: 9,
    textAlign: "center",
    marginTop: 7,
  },
  readingCard: {
    backgroundColor: c.white,
    padding: 21,
    borderRadius: 24,
    gap: 17,
  },
  readingTitle: { fontFamily: serif, color: c.ink, fontSize: 27 },
  readingHint: { color: c.muted, fontSize: 13, lineHeight: 20 },
  sourceText: { color: c.ink, fontSize: 16, lineHeight: 28 },
  outline: { borderWidth: 1, borderColor: c.line, borderRadius: 15 },
  modalRoot: { ...StyleSheet.absoluteFill, justifyContent: "flex-end" },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: c.scrim },
  sheet: {
    padding: 24,
    gap: 18,
    backgroundColor: c.paper,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: "90%",
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: "#CFC7C0",
    width: 34,
    height: 4,
    borderRadius: 3,
  },
  sheetTitle: { flex: 1, fontFamily: serif, fontSize: 26, color: c.ink },
  close: { color: c.ink, fontSize: 26 },
  sheetCaption: { color: c.muted, fontSize: 14, lineHeight: 22 },
  urlRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  urlInput: {
    backgroundColor: c.white,
    borderColor: "#C9C0B5",
    borderWidth: 1,
    borderRadius: 17,
    padding: 17,
    fontSize: 14,
    color: c.ink,
    minHeight: 54,
  },
  aboutNote: {
    backgroundColor: c.lavender,
    padding: 18,
    borderRadius: 20,
    gap: 9,
  },
  aboutTitle: { color: c.ink, fontWeight: "700", fontSize: 17 },
});
