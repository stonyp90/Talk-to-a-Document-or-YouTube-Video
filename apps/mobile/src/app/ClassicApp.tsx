import {
  DEFAULT_LANGUAGE,
  Language,
  TranslationKey,
  translate,
  samples,
} from "../i18n";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  useWindowDimensions,
  AppState,
  Easing,
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
import * as Speech from "expo-speech";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { useCameraPermissions } from "expo-camera";
import {
  ApiClient,
  apiOrigin,
  IngestedSource,
  isSignInRequired,
  isUsageLimit,
  Turn,
  updateTranscript,
} from "../client";
import { deviceSessionStore } from "../session";
import { MobileSignIn } from "../SignIn";
import { AssistantName } from "../ui/AssistantName";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeVoice, VoiceStatus } from "../voice";
import {
  palette as c,
  Reveal,
  serif,
  SourceIcon,
  Touch,
  useMotion,
} from "../design";
import {
  MobileSenseControls,
  SenseTestControls,
  SENSE_TEST_MODE,
  type NativeSenseActivity,
} from "../SenseControls";
import { SenseField, SenseOrb, type SenseVisualActivity } from "../ui/SenseOrb";
import type { MobileVoiceActionId } from "../VoiceActions";
import { chatSocketUrl, createChatClient } from "../chat";
import { createTurnGate } from "../conversation/turnGate";
import type { ChatClient } from "../../../../packages/core/src/application/chatClient";
import { YouTubePlayer, extractVideoId } from "../ui/YouTubePlayer";
import { ToastLayer, type ToastItem, type ToastState } from "../ui/ToastLayer";

const origin = apiOrigin(Platform.OS, process.env.EXPO_PUBLIC_API_URL);
/**
 * Where the live discussion is, if there is one. A deployment names it; a
 * developer's machine has it beside the API. With neither, every question goes
 * over the request path exactly as it did before.
 */
const channel = chatSocketUrl(origin, process.env.EXPO_PUBLIC_CHAT_SOCKET_URL);
import FileBrowserView from "../FileBrowserView";
import { createMemoryFileSystem } from "../../../../packages/adapters/src/fileSystem";
import type { FileNode } from "../../../../packages/core/src/domain/fileSystem";
import {
  createFileNavigator,
  type FileNavAction,
} from "../../../../packages/core/src/domain/fileNavigation";

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

function LyricLine({
  turn,
  active,
  motion,
}: {
  turn: Turn;
  active: boolean;
  motion: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: active ? 1 : 0,
      duration: motion ? 500 : 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [active, motion, anim]);

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: turn.role === "user" ? [0.2, 0.4] : [0.25, 1],
  });
  const fontSize = anim.interpolate({
    inputRange: [0, 1],
    outputRange: turn.role === "user" ? [14, 15] : [15, 22],
  });
  const lineHeight = anim.interpolate({
    inputRange: [0, 1],
    outputRange: turn.role === "user" ? [20, 22] : [22, 32],
  });
  const letterSpacing = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -0.5],
  });
  const color = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [c.muted, turn.role === "user" ? c.softMuted : c.coral],
  });
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, turn.role === "user" ? -8 : 0],
  });

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateX }],
        marginBottom: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [14, turn.role === "user" ? 16 : 24],
        }),
      }}
    >
      <Animated.Text
        selectable={active}
        style={[
          turn.role === "user" ? s.lyricsUserText : s.lyricsText,
          {
            fontSize,
            lineHeight,
            letterSpacing,
            color,
            fontWeight: active ? "600" : "400",
          },
        ]}
      >
        {turn.text}
      </Animated.Text>
    </Animated.View>
  );
}

function LyricsView({
  turns,
  motion,
}: {
  turns: Turn[];
  motion: boolean;
}) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const contentRef = useRef<View>(null);

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: motion });
    }, 100);
  }, [turns.length, motion]);

  return (
    <ScrollView
      ref={scrollRef}
      style={s.lyricsContainer}
      contentContainerStyle={s.lyricsContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View ref={contentRef} onLayout={() => {
        scrollRef.current?.scrollToEnd({ animated: motion });
      }}>
        {turns.map((turn, index) => (
          <LyricLine
            key={turn.id}
            turn={turn}
            active={index === turns.length - 1}
            motion={motion}
          />
        ))}
      </View>
    </ScrollView>
  );
}

export function ClassicApp() {
  const motion = useMotion();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [availableHeight, setAvailableHeight] = useState(height);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [commandSettingsOpen, setCommandSettingsOpen] = useState(false);
  const [senseActivity, setSenseActivity] = useState<NativeSenseActivity>({
    listening: false,
    motion: false,
    connecting: false,
  });
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const [assistantName, setAssistantName] = useState("ursly");

  useEffect(() => {
    AsyncStorage.getItem("ursly-assistant-name").then((stored) => {
      if (stored) setAssistantName(stored);
    });
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translate(language, key),
    [language],
  );
  const suggestions = useMemo(
    () =>
      (
        ["Summarize the essentials", "Explain simply", "Key takeaways"] as const
      ).map(t),
    [t],
  );
  const statuses = {
    ended: t("At your own pace"),
    connecting: t("Connecting…"),
    connected: t("Session active"),
    reconnecting: t("Reconnecting…"),
    error: t("Connection interrupted"),
  };
  const sampleText = samples[language];
  const [sheet, setSheet] = useState<"source" | "about" | "reading" | null>(
    null,
  );
  const [sourceTab, setSourceTab] = useState<"pdf" | "youtube">("pdf");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<IngestedSource>();
  const [busy, setBusy] = useState<"pdf" | "youtube" | "chat" | null>(null);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const toastId = useRef(0);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState<VoiceStatus>("ended");
  const [muted, setMuted] = useState(false);
  const [mode, setMode] = useState<"mock" | "live" | "unknown">("unknown");
  // Who is reading. Everything that spends provider credit waits for this.
  const [account, setAccount] = useState<{ email: string } | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const [fileBrowserOpen, setFileBrowserOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingSeen, setOnboardingSeen] = useState(() => {
    let initial = false;
    AsyncStorage.getItem("ursly-onboarding-seen").then((v) => {
      if (v === "true") setOnboardingSeen(true);
    }).catch(() => {});
    return initial;
  });
  const [replayOnboarding, setReplayOnboarding] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const voice = useRef<NativeVoice | null>(null);
  const chat = useRef<ChatClient | null>(null);
  const [turnGate] = useState(createTurnGate);
  const socketTurn = useRef<{ id: string; token: symbol } | null>(null);
  const [fileSystem] = useState(createMemoryFileSystem);
  const fileNavigatorRef = useRef<ReturnType<
    typeof createFileNavigator
  > | null>(null);
  /** What the channel calls this conversation, so a question is a short frame. */
  const sourceId = useRef<string | undefined>(undefined);
  const sourceRef = useRef<IngestedSource | undefined>(undefined);
  const operation = useRef(0);
  const sequence = useRef(0);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const followTranscript = useRef(true);
  const composer = useRef<React.ComponentRef<typeof TextInput>>(null);
  const active = ["connecting", "connected", "reconnecting"].includes(status);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    if (onboardingSeen && !replayOnboarding) return;
    if (turns.length > 0) return;
    const steps = 4;
    let cancelled = false;
    let currentStep = 0;
    function tick() {
      if (cancelled) return;
      if (currentStep > steps) {
        AsyncStorage.setItem("ursly-onboarding-seen", "true").catch(() => {});
        setOnboardingSeen(true);
        setReplayOnboarding(false);
        return;
      }
      setOnboardingStep(currentStep);
      const delay =
        currentStep === 0 ? 1800 : currentStep >= steps ? 4000 : 3200;
      currentStep++;
      setTimeout(tick, delay);
    }
    tick();
    return () => {
      cancelled = true;
    };
  }, [onboardingSeen, replayOnboarding, turns.length]);

  const onboardingToasts = useMemo(() => {
    if (onboardingStep === 0) return null;
    const messages = [
      t("The logo breath with you."),
      t("Color is emotion. Size is depth."),
      t("Pulse means it is listening."),
      t("Tap the logo to add a source."),
    ];
    return messages.slice(0, Math.min(onboardingStep, messages.length));
  }, [onboardingStep, t]);

  const lastSpokenIndex = useRef<string>("");
  useEffect(() => {
    if (busy) return;
    const lastAssistant = turns
      .map((t, i) => ({ t, i }))
      .reverse()
      .find(({ t }) => t.role === "assistant");
    if (!lastAssistant || !lastAssistant.t.text.trim()) return;
    const key = `${lastAssistant.i}:${lastAssistant.t.text.length}`;
    if (lastSpokenIndex.current === key) return;
    lastSpokenIndex.current = key;
    Speech.stop();
    Speech.speak(lastAssistant.t.text, {
      language: language === "fr" ? "fr-FR" : "en-US",
      rate: 0.95,
    });
  }, [turns, busy, language]);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

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

  function showToast(message: string, state: ToastState = "info") {
    const id = String(++toastId.current);
    setToasts((prev) => [...prev, { id, message, state }]);
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function updateToastState(id: string, state: ToastState) {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, state } : t)),
    );
  }

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
        if (mounted) setAccount(session ?? (__DEV__ ? { email: "dev@example.com" } : null));
      })
      .catch(() => {
        if (mounted && __DEV__) setAccount({ email: "dev@example.com" });
      });
    // In dev mode, skip sign-in entirely so the app loads straight to the workspace.
    if (__DEV__) {
      setAccount({ email: "dev@example.com" });
    }
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "background") {
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
    showToast(t("You are signed out."), "success");
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
        if (
          "askId" in event &&
          event.askId &&
          event.askId !== socketTurn.current?.id
        )
          return;
        if (event.type === "started") {
          setTurns((previous) => [
            ...previous,
            { id: event.askId, role: "assistant", text: "" },
          ]);
          showToast(t("Generating answer"), "pending");
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
          if (socketTurn.current) turnGate.finish(socketTurn.current.token);
          socketTurn.current = null;
          sourceId.current = event.sourceId;
          setTurns((previous) =>
            previous.map((turn) =>
              turn.id === event.askId ? { ...turn, text: event.text } : turn,
            ),
          );
          setBusy((current) => (current === "chat" ? null : current));
          showToast(t("Answer ready"), "success");
          return;
        }
        if (event.type === "failed") {
          if (socketTurn.current) turnGate.finish(socketTurn.current.token);
          socketTurn.current = null;
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
    turnGate.reset();
    socketTurn.current = null;
    setBusy(null);
    sourceRef.current = result;
    openChannel();
    setSource(result);
    setTurns([]);
    setQuestion("");
    setUrl("");
    setError("");
    setSheet(null);
    if (result.kind !== "youtube") setVideoUrl(null);
    showToast(t("Source ready"), "success");
  }
  async function ingest(kind: "pdf" | "youtube") {
    if (busy) return;
    if (needsSignIn()) return;
    const current = ++operation.current;
    setBusy(kind);
    setError("");
    stop();
    Keyboard.dismiss();
    const toastRef = String(++toastId.current);
    setToasts((prev) => [
      ...prev,
      {
        id: toastRef,
        message:
          kind === "youtube"
            ? t("Getting your source ready…")
            : t("Getting your source ready…"),
        state: "pending",
        duration: 0,
      },
    ]);
    try {
      let result: IngestedSource;
      if (kind === "pdf") {
        const selection = await DocumentPicker.getDocumentAsync({
          type: "application/pdf",
          copyToCacheDirectory: true,
          multiple: false,
        });
        if (selection.canceled) {
          setToasts((prev) => prev.filter((t) => t.id !== toastRef));
          return;
        }
        result = await api.pdf(selection.assets[0]);
      } else {
        if (url.trim()) {
          const vid = extractVideoId(url.trim());
          if (vid) setVideoUrl(vid);
        }
        result = await api.youtube(url);
      }
      if (current === operation.current) {
        setToasts((prev) => prev.filter((t) => t.id !== toastRef));
        installSource(result);
      }
    } catch (caught) {
      setToasts((prev) => prev.filter((t) => t.id !== toastRef));
      if (current === operation.current) fail(caught);
    } finally {
      if (current === operation.current) setBusy(null);
    }
  }
  async function askPrompt(text: string) {
    const submitted = text.trim();
    if (!source) {
      showToast(t("Add a source first, then wave to ask."), "info");
      return;
    }
    if (!submitted || busy) return;
    if (needsSignIn()) return;
    const turn = turnGate.begin();
    if (!turn) return;
    const current = operation.current;
    setBusy("chat");
    setError("");
    Keyboard.dismiss();
    showToast(t("Question sent"), "pending");

    // The open channel is the fast path: a short frame on a connection that
    // already exists, and an answer that arrives as it is written.
    const askId = String(++sequence.current) + "a";
    if (chat.current?.ready) {
      socketTurn.current = { id: askId, token: turn };
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
      socketTurn.current = null;
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
      showToast(t("Answer ready"), "success");
    } catch (caught) {
      if (current === operation.current) fail(caught);
    } finally {
      turnGate.finish(turn);
      if (current === operation.current) setBusy(null);
    }
  }
  async function ask() {
    return askPrompt(question);
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
    showToast(t("Voice action received"), "info");
    if (action === "open") {
      setFileBrowserOpen(true);
      showToast("Opening files", "info");
      return;
    }
    if (action === "upload") {
      void ingest("pdf");
      return;
    }
    if (action === "youtube") {
      setError("");
      setSourceTab("youtube");
      setSheet("source");
      return;
    }
    if (action === "voice") {
      startVoice();
      return;
    }
    if (action === "summarize") {
      void askPrompt(t("Summarize the essentials"));
      return;
    }
    if (action === "back") {
      setSheet(null);
      setFileBrowserOpen(false);
      setError("");
      return;
    }
    if (action === "next") {
      if (!source) setSheet("source");
      else composer.current?.focus();
      return;
    }
    operation.current++;
    turnGate.reset();
    socketTurn.current = null;
    stop();
    setBusy(null);
    setSheet(null);
    setError("");
    setQuestion("");
  }
  function handleFileNav(action: FileNavAction) {
    fileNavigatorRef.current?.dispatch(action);
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
  const visualActivity: SenseVisualActivity =
    busy || senseActivity.connecting
      ? "thinking"
      : senseActivity.listening || active
        ? "listening"
        : senseActivity.motion
          ? "motion"
          : "idle";
  const compact = height < 700 || keyboardVisible || !!source;
  const closeSheetLabel =
    sheet === "about" ? t("Close settings") : t("Close source picker");
  const notice = error ? (
    <View style={s.notice} accessibilityLiveRegion="polite">
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
    </View>
  ) : null;

  return (
    <SafeAreaView style={s.screen} edges={["top", "left", "right", "bottom"]}>
      <StatusBar barStyle="dark-content" />
      <Animated.View
        style={[
          s.screen,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <KeyboardAvoidingView
          style={s.screen}
          behavior={Platform.OS === "ios" ? "height" : undefined}
          keyboardVerticalOffset={insets.top}
          onLayout={(event) =>
            setAvailableHeight(event.nativeEvent.layout.height)
          }
        >
        <SenseField motion={motion} />
        {videoUrl ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <YouTubePlayer videoId={videoUrl} playing />
          </View>
        ) : null}
        <View
          style={s.workspace}
          accessibilityElementsHidden={!!sheet || signInOpen}
          importantForAccessibility={
            sheet || signInOpen ? "no-hide-descendants" : "auto"
          }
        >
          {source && (
            <View style={s.statusBar}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Change source")}
                accessibilityValue={{ text: source.sourceName }}
                onPress={() => setSheet("source")}
                style={s.sourceChip}
              >
                <SourceIcon kind={source.kind} color={c.accent} />
                <Text numberOfLines={1} style={s.sourceName}>
                  {source.sourceName}
                </Text>
                <Text style={s.secondary}>↗</Text>
              </Pressable>
            </View>
          )}
          {!sheet && notice}
          <View style={s.stage}>
            {turns.length ? (
              <LyricsView turns={turns} motion={motion} />
            ) : !keyboardVisible ? (
              <View style={s.origin}>
                {!(source && height < 700) && (
                  <SenseOrb
                    motion={motion}
                    activity={visualActivity}
                    compact={compact}
                    onPress={() => setSheet("source")}
                  />
                )}
                <Text accessibilityRole="header" style={s.wordmark}>
                  ursly.
                </Text>
                {source ? (
                  <>
                    <Text accessibilityRole="header" style={s.title}>
                      {t("What are you curious about?")}
                    </Text>
                    <View style={s.suggestions}>
                      {suggestions.map((prompt) => (
                        <Pressable
                          key={prompt}
                          accessibilityRole="button"
                          accessibilityLabel={prompt}
                          disabled={!!busy}
                          onPress={() => void askPrompt(prompt)}
                          style={s.suggestion}
                        >
                          <Text style={s.suggestionText}>{prompt}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
          {busy && (
            <View style={s.progress} accessibilityLiveRegion="polite">
              <ActivityIndicator color={c.accent} />
              <Text style={s.caption}>
                {busy === "chat"
                  ? t("Thinking…")
                  : t("Getting your source ready…")}
              </Text>
            </View>
          )}
          {mode === "mock" && source && (
            <Text style={s.demo}>
              {t("Demo mode · voice and answers are simulated.")}
            </Text>
          )}
          {source && (
            <View style={s.composer}>
              <TextInput
                ref={composer}
                accessibilityLabel={t("Ask a question")}
                placeholder={t("Ask a question")}
                placeholderTextColor={c.muted}
                style={s.questionInput}
                value={question}
                onChangeText={setQuestion}
                editable={!busy}
                multiline
                returnKeyType="send"
                blurOnSubmit={false}
                onSubmitEditing={() => void ask()}
              />
              <Touch
                label={t("Send")}
                motion={motion}
                disabled={!!busy || !question.trim()}
                onPress={() => void ask()}
                style={s.send}
              >
                <Text style={s.sendText}>↑</Text>
              </Touch>
            </View>
          )}
          <View style={s.dock}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Menu")}
              onPress={() => setSheet("about")}
              style={s.menuButton}
            >
              <Text style={s.menuText}>{t("menu")}</Text>
            </Pressable>
          </View>
        </View>
        {onboardingToasts && (
          <View style={s.onboardingToasts} accessibilityLiveRegion="polite">
            {onboardingToasts.map((msg, i) => (
              <View
                key={i}
                style={s.onboardingToast}
              >
                <Text style={s.onboardingToastText}>{msg}</Text>
              </View>
            ))}
          </View>
        )}
        <ToastLayer toasts={toasts} onDismiss={dismissToast} />
        {!!sheet && (
          <View style={s.modalRoot} accessibilityViewIsModal>
            <Pressable
              accessibilityLabel={closeSheetLabel}
              onPress={() => setSheet(null)}
              style={s.scrim}
            />
            <Reveal
              motion={motion}
              style={[
                s.sheet,
                { maxHeight: Math.min(height * 0.82, availableHeight - 24) },
              ]}
            >
              <View style={s.sheetHeader}>
                <Text accessibilityRole="header" style={s.sheetTitle}>
                  {sheet === "about"
                    ? t("Workspace settings")
                    : sheet === "reading"
                      ? t("The source")
                      : t("Add a source")}
                </Text>
                <Touch
                  label={closeSheetLabel}
                  motion={motion}
                  onPress={() => setSheet(null)}
                >
                  <Text style={s.secondary}>×</Text>
                </Touch>
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={s.sheetContent}
              >
                {sheet === "source" && (
                  <>
                    <View accessibilityRole="tablist" style={s.tabs}>
                      {(["pdf", "youtube"] as const).map((kind) => (
                        <Touch
                          key={kind}
                          label={kind === "pdf" ? "PDF" : "YouTube"}
                          motion={motion}
                          selected={sourceTab === kind}
                          accessibilityRole="tab"
                          onPress={() => setSourceTab(kind)}
                          style={[s.tab, sourceTab === kind && s.selected]}
                        >
                          <Text style={s.buttonText}>
                            {kind === "pdf" ? "PDF" : "YouTube"}
                          </Text>
                        </Touch>
                      ))}
                    </View>
                    {sourceTab === "pdf" ? (
                      <Touch
                        label={t("Import a PDF")}
                        motion={motion}
                        disabled={!!busy}
                        onPress={() => void ingest("pdf")}
                        style={s.importButton}
                      >
                        <SourceIcon kind="pdf" color={c.accent} />
                        <Text style={s.buttonText}>{t("Import a PDF")}</Text>
                        <Text style={s.caption}>{t("PDF · up to 25 MB")}</Text>
                      </Touch>
                    ) : (
                      <>
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
                          style={s.urlInput}
                          editable={!busy}
                        />
                        <Touch
                          label={t("Load video")}
                          motion={motion}
                          onPress={() => void ingest("youtube")}
                          disabled={!!busy || !url.trim()}
                          style={s.addSource}
                        >
                          <Text style={s.buttonText}>{t("Load video")}</Text>
                        </Touch>
                      </>
                    )}
                    {busy && <ActivityIndicator color={c.accent} />}
                    {notice}
                    {source && (
                      <Touch
                        label={t("The source")}
                        motion={motion}
                        onPress={() => setSheet("reading")}
                        style={s.secondaryButton}
                      >
                        <Text style={s.secondary}>{t("The source")}</Text>
                      </Touch>
                    )}
                  </>
                )}
                {sheet === "reading" && (
                  <>
                    <Text style={s.sheetTitle}>{source?.sourceName}</Text>
                    <Text selectable style={s.messageText}>
                      {source?.text}
                    </Text>
                  </>
                )}
                {sheet === "about" && (
                  <>
                    <AssistantName
                      value={assistantName}
                      onChange={setAssistantName}
                      t={t}
                    />

                    <View style={s.settingsSection}>
                      <Text style={s.settingsSectionTitle}>{t("Inputs")}</Text>
                      <View style={s.settingsCard}>
                        <View style={s.settingsRow}>
                          <View style={s.settingsRowContent}>
                            <Text style={s.settingsRowTitle}>
                              {t("Motion tracking")}
                            </Text>
                            <Text style={s.settingsRowDescription}>
                              {t("Camera tracks gestures to navigate.")}
                            </Text>
                          </View>
                          <Pressable
                            accessibilityRole="switch"
                            accessibilityState={{ checked: cameraEnabled }}
                            onPress={async () => {
                              if (cameraEnabled) {
                                setCameraEnabled(false);
                                showToast(t("Camera disabled"), "info");
                              } else {
                                let permission = cameraPermission;
                                if (!permission?.granted) {
                                  permission = await requestCameraPermission();
                                }
                                if (permission?.granted) {
                                  setCameraEnabled(true);
                                  showToast(t("Camera enabled"), "success");
                                } else {
                                  showToast(t("Camera permission required"), "error");
                                }
                              }
                            }}
                            style={[
                              s.toggle,
                              cameraEnabled && s.toggleActive,
                            ]}
                          >
                            <View
                              style={[
                                s.toggleThumb,
                                cameraEnabled && s.toggleThumbActive,
                              ]}
                            />
                          </Pressable>
                        </View>
                      </View>
                    </View>

                    <View style={s.settingsSection}>
                      <Text style={s.settingsSectionTitle}>
                        {t("Commands")}
                      </Text>
                      <View style={s.settingsCard}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            setSheet(null);
                            setCommandSettingsOpen(true);
                          }}
                          style={s.settingsRow}
                        >
                          <View style={s.settingsRowContent}>
                            <Text style={s.settingsRowTitle}>
                              {t("Customize commands")}
                            </Text>
                            <Text style={s.settingsRowDescription}>
                              {t(
                                "Customize voice triggers and gestures.",
                              )}
                            </Text>
                          </View>
                          <Text style={s.settingsChevron}>→</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={s.settingsSection}>
                      <Text style={s.settingsSectionTitle}>
                        {t("App language")}
                      </Text>
                      <View style={s.settingsCard}>
                        <View style={s.languageRow}>
                          {(["en", "fr"] as const).map((value) => (
                            <Pressable
                              key={value}
                              accessibilityRole="radio"
                              accessibilityState={{
                                selected: language === value,
                              }}
                              onPress={() => {
                                setLanguage(value);
                                showToast(
                                  value === "en"
                                    ? t("Language set to English")
                                    : t("Langue définie sur français"),
                                  "info",
                                );
                              }}
                              style={[
                                s.languageOption,
                                language === value && s.languageOptionActive,
                              ]}
                            >
                              <Text
                                style={[
                                  s.languageOptionText,
                                  language === value &&
                                    s.languageOptionTextActive,
                                ]}
                              >
                                {value === "en" ? "English" : "Français"}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    </View>

                    {source && (
                      <View style={s.settingsSection}>
                        <Text style={s.settingsSectionTitle}>
                          {t("Audio")}
                        </Text>
                        <View style={s.settingsCard}>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => {
                              if (active) {
                                stop();
                                showToast(t("Session stopped"), "info");
                              } else {
                                startVoice();
                                showToast(t("Voice session started"), "success");
                              }
                            }}
                            disabled={!!busy}
                            style={s.settingsRow}
                          >
                            <View style={s.settingsRowContent}>
                              <Text style={s.settingsRowTitle}>
                                {active
                                  ? t("Stop session")
                                  : t("Start voice conversation")}
                              </Text>
                              {active && (
                                <Text style={s.settingsRowDescription}>
                                  {muted
                                    ? t("Microphone muted")
                                    : statuses[status]}
                                </Text>
                              )}
                            </View>
                            {active && (
                              <Pressable
                                accessibilityRole="button"
                                onPress={() => {
                                  voice.current?.setMuted(!muted);
                                  setMuted(!muted);
                                  showToast(
                                    !muted
                                      ? t("Microphone muted")
                                      : t("Microphone unmuted"),
                                    "info",
                                  );
                                }}
                                disabled={status !== "connected"}
                                style={s.muteButton}
                              >
                                <Text style={s.muteButtonText}>
                                  {muted ? t("Unmute") : t("Mute")}
                                </Text>
                              </Pressable>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    )}

                    <View style={s.settingsSection}>
                      <Text style={s.settingsSectionTitle}>
                        {t("Your account")}
                      </Text>
                      <View style={s.settingsCard}>
                        {account ? (
                          <>
                            <View style={s.settingsRow}>
                              <View style={s.settingsRowContent}>
                                <Text style={s.settingsRowTitle}>
                                  {account.email}
                                </Text>
                                <Text style={s.settingsRowDescription}>
                                  {t("Signed in as")}
                                </Text>
                              </View>
                            </View>
                            <View style={s.settingsDivider} />
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => {
                                void signOut();
                                showToast(t("Signed out"), "success");
                              }}
                              style={s.settingsRow}
                            >
                              <Text style={s.settingsRowTitle}>
                                {t("Sign out")}
                              </Text>
                            </Pressable>
                          </>
                        ) : (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => {
                              setSheet(null);
                              setSignInOpen(true);
                            }}
                            style={s.settingsRow}
                          >
                            <Text style={s.settingsRowTitle}>
                              {t("Sign in")}
                            </Text>
                            <Text style={s.settingsRowDescription}>
                              {t("Sign in to continue")}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </View>

                    <View style={s.settingsSection}>
                      <Text style={s.settingsSectionTitle}>{t("Demo")}</Text>
                      <View style={s.settingsCard}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={trySample}
                          style={s.settingsRow}
                        >
                          <Text style={s.settingsRowTitle}>
                            {t("Try a sample text")}
                          </Text>
                        </Pressable>
                        <View style={s.settingsDivider} />
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            setSheet(null);
                            setOnboardingStep(0);
                            setReplayOnboarding(true);
                          }}
                          style={s.settingsRow}
                        >
                          <Text style={s.settingsRowTitle}>
                            {t("Replay intro")}
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    {SENSE_TEST_MODE && (
                      <View style={s.settingsSection}>
                        <SenseTestControls t={t} />
                      </View>
                    )}

                    {notice}
                  </>
                )}
              </ScrollView>
            </Reveal>
          </View>
        )}
        {signInOpen && (
          <MobileSignIn
            motion={motion}
            t={t}
            onRequestCode={async (email) => {
              // In dev mode, skip the actual email and auto-confirm
              if (__DEV__) {
                setAccount({ email: email.trim() || "test@example.com" });
                setSignInOpen(false);
                setError("");
                return;
              }
              await api.requestSignInCode(email);
            }}
            onConfirm={async (email, code) => {
              // In dev mode, accept any code
              if (__DEV__) {
                setAccount({ email: email.trim() || "test@example.com" });
                setSignInOpen(false);
                setError("");
                return;
              }
              setAccount(await api.confirmSignInCode(email, code));
              setSignInOpen(false);
              setError("");
            }}
            onClose={() => setSignInOpen(false)}
          />
        )}
      </KeyboardAvoidingView>
      </Animated.View>
      {fileBrowserOpen && (
        <FileBrowserView
          fs={fileSystem}
          rootId="root"
          navigatorRef={fileNavigatorRef}
          onClose={() => setFileBrowserOpen(false)}
          onFileSelect={(node: FileNode) => {
            showToast(node.name);
            setFileBrowserOpen(false);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.paper },
  flex: { flex: 1 },
  workspace: { flex: 1, paddingHorizontal: 16, paddingBottom: 8 },
  statusBar: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
  },
  settingsButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  orbitControl: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  orbitLine: {
    position: "absolute",
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: c.accent,
    borderRadius: 12,
  },
  orbitLeft: { transform: [{ rotate: "-35deg" }, { scaleX: 0.48 }] },
  orbitRight: { transform: [{ rotate: "35deg" }, { scaleX: 0.48 }] },
  orbitCenter: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.accent,
  },
  sourceChip: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.white,
    borderRadius: 16,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  sourceName: { flexShrink: 1, fontSize: 12, color: c.ink },
  stage: { flex: 1, minHeight: 0, justifyContent: "center" },
  origin: { alignItems: "center", justifyContent: "center", gap: 18 },
  wordmark: {
    textAlign: "center",
    color: c.ink,
    fontSize: 20,
    fontWeight: "300",
    letterSpacing: -0.5,
    marginTop: -8,
  },
  title: {
    textAlign: "center",
    color: c.ink,
    fontSize: 27,
    fontWeight: "400",
    letterSpacing: -1,
  },
  addSource: {
    alignSelf: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.strongLine,
    backgroundColor: c.white,
    paddingHorizontal: 10,
    minHeight: 48,
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  buttonText: { fontSize: 14, color: c.accent, fontWeight: "600" },
  secondary: { fontSize: 18, color: c.ink },
  suggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  suggestion: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.white,
  },
  suggestionText: { fontSize: 12, color: c.ink },
  messages: { paddingVertical: 16, gap: 14 },
  message: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.white,
    padding: 16,
    gap: 8,
  },
  userMessage: { backgroundColor: c.peach, marginLeft: 24 },
  author: { color: c.muted, fontSize: 11, fontWeight: "600" },
  messageText: { color: c.ink, fontSize: 15, lineHeight: 23 },
  lyricsContainer: { flex: 1 },
  lyricsContent: {
    paddingVertical: 40,
    justifyContent: "center",
    minHeight: "100%",
  },
  lyricsText: {
    fontFamily: serif,
    textAlign: "center",
  },
  lyricsUserText: {
    textAlign: "center",
    fontStyle: "italic",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderWidth: 1,
    borderColor: c.strongLine,
    borderRadius: 22,
    padding: 6,
    backgroundColor: c.white,
    marginBottom: 10,
  },
  questionInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    padding: 10,
    paddingTop: 12,
    color: c.ink,
    fontSize: 14,
  },
  send: { width: 44, height: 44, borderRadius: 16, backgroundColor: c.coral },
  sendText: { fontSize: 24, color: c.ink },
  dock: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    maxWidth: "100%",
    padding: 6,
    borderWidth: 1,
    borderColor: c.strongLine,
    borderRadius: 24,
    backgroundColor: c.white,
  },
  menuButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  menuText: {
    color: c.ink,
    fontSize: 14,
    fontWeight: "400",
    letterSpacing: 0.5,
  },
  onboardingToasts: {
    position: "absolute",
    bottom: 80,
    left: 20,
    right: 20,
    alignItems: "center",
    gap: 8,
    zIndex: 100,
  },
  onboardingToast: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: c.ink,
    opacity: 0.88,
  },
  onboardingToastText: {
    color: c.paper,
    fontSize: 13,
    fontWeight: "400",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  progress: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
  },
  caption: { color: c.muted, fontSize: 12, lineHeight: 18 },
  demo: { color: c.muted, fontSize: 10, textAlign: "center", marginBottom: 6 },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    backgroundColor: c.errorBg,
    borderRadius: 16,
  },
  errorText: { flex: 1, color: c.error, fontSize: 13, lineHeight: 18 },
  modalRoot: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    zIndex: 50,
  },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: c.scrim },
  sheet: {
    backgroundColor: c.white,
    borderRadius: 24,
    margin: 12,
    borderWidth: 1,
    borderColor: c.line,
    overflow: "hidden",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingLeft: 20,
    paddingRight: 8,
    minHeight: 60,
    gap: 8,
  },
  sheetTitle: { flexShrink: 1, color: c.ink, fontWeight: "600", fontSize: 19 },
  sheetContent: { padding: 20, paddingTop: 0, gap: 20 },
  tabs: {
    flexDirection: "row",
    padding: 4,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 16,
  },
  tab: { flex: 1, borderRadius: 12 },
  selected: { backgroundColor: c.peach },
  importButton: {
    borderWidth: 1,
    borderColor: c.strongLine,
    borderStyle: "dashed",
    borderRadius: 18,
    paddingVertical: 20,
    gap: 8,
  },
  urlInput: {
    borderWidth: 1,
    borderColor: c.inputBorder,
    borderRadius: 14,
    minHeight: 48,
    padding: 12,
    fontSize: 14,
    color: c.ink,
  },
  secondaryButton: { borderWidth: 1, borderColor: c.line, borderRadius: 16 },
  settingLabel: { color: c.ink, fontSize: 14, fontWeight: "600", marginTop: 4 },
  settingsSection: { gap: 8 },
  settingsSectionTitle: {
    color: c.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingLeft: 4,
  },
  settingsCard: {
    backgroundColor: c.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
    minHeight: 56,
  },
  settingsRowContent: { flex: 1, gap: 2 },
  settingsRowTitle: { color: c.ink, fontSize: 15, fontWeight: "500" },
  settingsRowDescription: { color: c.muted, fontSize: 13, lineHeight: 18 },
  settingsChevron: { color: c.muted, fontSize: 18 },
  settingsDivider: { height: 1, backgroundColor: c.line, marginHorizontal: 16 },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.line,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleActive: { backgroundColor: c.coral },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: c.white,
  },
  toggleThumbActive: { alignSelf: "flex-end" },
  languageRow: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
  },
  languageOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.line,
  },
  languageOptionActive: {
    backgroundColor: c.peach,
    borderColor: c.coral,
  },
  languageOptionText: { color: c.ink, fontSize: 14, fontWeight: "500" },
  languageOptionTextActive: { color: c.accent, fontWeight: "600" },
  muteButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.line,
  },
  muteButtonText: { color: c.accent, fontSize: 13, fontWeight: "600" },
});
