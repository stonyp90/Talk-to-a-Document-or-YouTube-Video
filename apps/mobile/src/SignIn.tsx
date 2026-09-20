import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { TranslationKey } from "./i18n";
import { Brand, Orbit, Touch, Wave, palette as c, serif } from "./design";

type Props = {
  motion: boolean;
  t: (key: TranslationKey) => string;
  onRequestCode: (email: string) => Promise<void>;
  onConfirm: (email: string, code: string) => Promise<void>;
  onClose: () => void;
};

const looksLikeAddress = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const looksLikeCode = (value: string) => /^\d{4,12}$/.test(value);

export function MobileSignIn({
  motion,
  t,
  onRequestCode,
  onConfirm,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(() =>
    Keyboard.isVisible(),
  );
  const [step, setStep] = useState<"address" | "code">("address");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [dictating, setDictating] = useState(false);
  const [heard, setHeard] = useState("");
  const [biometricType, setBiometricType] = useState<
    "fingerprint" | "face" | null
  >(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const codeField = useRef<TextInput>(null);
  const listeningEpoch = useRef(0);

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

  useEffect(() => {
    let mounted = true;
    void LocalAuthentication.hasHardwareAsync().then((hasHardware) => {
      if (!mounted || !hasHardware) return;
      void LocalAuthentication.isEnrolledAsync().then((enrolled) => {
        if (!mounted) return;
        setBiometricAvailable(enrolled);
        if (enrolled) {
          void LocalAuthentication.supportedAuthenticationTypesAsync().then(
            (types) => {
              if (!mounted) return;
              setBiometricType(
                types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
                  ? "face"
                  : "fingerprint",
              );
            },
          );
        }
      });
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => () => {
    listeningEpoch.current += 1;
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      /* Native recognizer may already be gone during unmount. */
    }
  }, []);

  async function send() {
    const address = email.trim();
    if (busy) return;
    if (!looksLikeAddress(address)) {
      setError(t("Enter a valid email address."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onRequestCode(address);
      setStep("code");
      setCode("");
      setNote(t("The code is on its way."));
      setTimeout(() => codeField.current?.focus(), 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    const entered = code.trim();
    if (busy) return;
    if (!looksLikeCode(entered)) {
      setError(t("Enter the code exactly as it appears in the email."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onConfirm(email.trim(), entered);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithBiometric() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t("Sign in"),
        fallbackLabel: t("Use another address"),
        cancelLabel: t("Not right now"),
      });
      if (!result.success) {
        setError(
          result.error === "user_cancel" || result.error === "app_cancel"
            ? ""
            : t("Biometric authentication failed"),
        );
        setBusy(false);
        return;
      }
      await onClose();
    } catch {
      setError(t("Biometric sign-in unavailable"));
    } finally {
      setBusy(false);
    }
  }

  function startDictation() {
    if (dictating) {
      listeningEpoch.current += 1;
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        /* Idempotent from the app's perspective. */
      }
      setDictating(false);
      setHeard("");
      return;
    }
    const epoch = listeningEpoch.current + 1;
    listeningEpoch.current = epoch;
    setHeard("");
    setDictating(true);
    void Promise.resolve()
      .then(() => ExpoSpeechRecognitionModule.requestPermissionsAsync())
      .then((permission) => {
        if (epoch !== listeningEpoch.current) return;
        if (!permission.granted) {
          setDictating(false);
          setError(t("Voice actions need microphone and speech permissions."));
          return;
        }
        try {
          ExpoSpeechRecognitionModule.start({
            lang: "en-US",
            interimResults: true,
            continuous: false,
            maxAlternatives: 1,
          });
        } catch {
          setDictating(false);
          setError(t("Voice actions could not start. Try again."));
        }
      })
      .catch(() => {
        if (epoch !== listeningEpoch.current) return;
        setDictating(false);
        setError(t("Voice actions need microphone and speech permissions."));
      });
  }

  useSpeechRecognitionEvent("result", (event) => {
    if (!dictating) return;
    const transcript = event.results
      .map((result) => result.transcript)
      .join(" ")
      .trim();
    setHeard(transcript);
    if (event.isFinal) {
      const match = transcript.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      if (match) {
        setEmail(match[0]);
      }
      setDictating(false);
      setHeard("");
    }
  });

  useSpeechRecognitionEvent("end", () => {
    if (dictating) {
      setDictating(false);
      setHeard("");
    }
  });

  useSpeechRecognitionEvent("error", () => {
    if (dictating) {
      setDictating(false);
      setHeard("");
      setError(t("Voice actions could not start. Try again."));
    }
  });

  const onAddress = step === "address";

  return (
    <Modal
      visible
      animationType={motion ? "fade" : "none"}
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaProvider>
        <SafeAreaView
          style={s.screen}
          edges={["top", "left", "right", "bottom"]}
        >
          <KeyboardAvoidingView
            style={s.screen}
            behavior={Platform.OS === "ios" ? "height" : undefined}
            keyboardVerticalOffset={insets.top}
          >
            <ScrollView
              contentContainerStyle={[
                s.content,
                keyboardVisible && s.compactContent,
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={s.header}>
                <Brand />
                <Text style={s.counter}>
                  {t("SIGN IN")} · {onAddress ? "01" : "02"} / 02
                </Text>
              </View>

              {!keyboardVisible && (
                <View style={s.artFrame}>
                  <Orbit motion={motion} />
                </View>
              )}

              <View style={s.copy}>
                {!keyboardVisible && (
                  <Text style={s.stepLabel}>
                    {onAddress
                      ? t("Your email address").toUpperCase()
                      : t("Your code").toUpperCase()}
                  </Text>
                )}
                <Text
                  accessibilityRole="header"
                  style={[s.title, keyboardVisible && s.compactTitle]}
                >
                  {onAddress
                    ? t("Sign in to keep exploring")
                    : t("Check your email")}
                </Text>
                {(!keyboardVisible || !onAddress) && (
                  <Text style={s.body}>
                    {onAddress
                      ? t(
                          "Voice, documents and answers run on a paid model, so they are for signed-in readers. We send a code — no password to remember.",
                        )
                      : `${t("We sent a code to")} ${email.trim()}`}
                  </Text>
                )}
              </View>

              {onAddress ? (
                <View style={s.inputRow}>
                  <TextInput
                    testID="signin-email"
                    accessibilityLabel={t("Your email address")}
                    placeholder={t("you@example.com")}
                    placeholderTextColor={c.muted}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    keyboardType="email-address"
                    returnKeyType="send"
                    onSubmitEditing={() => void send()}
                    editable={!busy && !dictating}
                    style={[s.input, s.emailInput]}
                  />
                  <Touch
                    label={t(dictating ? "Stop dictating" : "Dictate email")}
                    motion={motion}
                    disabled={busy}
                    onPress={startDictation}
                    style={[s.micButton, dictating && s.micButtonActive]}
                  >
                    <Wave motion={dictating} color={dictating ? c.coral : c.muted} />
                  </Touch>
                </View>
              ) : (
                <TextInput
                  ref={codeField}
                  testID="signin-code"
                  accessibilityLabel={t("Enter the code")}
                  placeholder="••••••"
                  placeholderTextColor={c.muted}
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="one-time-code"
                  keyboardType="number-pad"
                  maxLength={12}
                  returnKeyType="go"
                  onSubmitEditing={() => void confirm()}
                  editable={!busy}
                  style={[s.input, s.codeInput]}
                />
              )}

              {dictating && heard !== "" && (
                <Text accessibilityLiveRegion="polite" style={s.dictationHeard}>
                  {t("Listening for your email…")} {heard}
                </Text>
              )}

              {note !== "" && error === "" && (
                <View style={s.noteRow}>
                  <View style={s.noteDot} />
                  <Text style={s.note}>{note}</Text>
                </View>
              )}
              {error !== "" && (
                <Text accessibilityRole="alert" style={s.error}>
                  {error}
                </Text>
              )}

              {onAddress && biometricAvailable && (
                <Touch
                  label={
                    biometricType === "face"
                      ? t("Sign in with Face ID")
                      : t("Sign in with your fingerprint")
                  }
                  motion={motion}
                  disabled={busy}
                  onPress={signInWithBiometric}
                  style={s.biometricButton}
                >
                  <View style={s.biometricRow}>
                    <Text style={s.biometricIcon}>
                      {biometricType === "face" ? "◉" : "◍"}
                    </Text>
                    <Text style={s.biometricText}>
                      {biometricType === "face"
                        ? t("Sign in with Face ID")
                        : t("Sign in with your fingerprint")}
                    </Text>
                  </View>
                </Touch>
              )}

              <Touch
                label={onAddress ? t("Send me a code") : t("Sign in")}
                motion={motion}
                disabled={busy}
                onPress={() => void (onAddress ? send() : confirm())}
                style={s.primary}
              >
                <View style={s.buttonRow}>
                  {busy && <ActivityIndicator color={c.coral} />}
                  <Text style={s.primaryText}>
                    {busy
                      ? onAddress
                        ? t("Sending your code…")
                        : t("Signing you in…")
                      : onAddress
                        ? t("Send me a code")
                        : t("Sign in")}
                  </Text>
                  {!busy && <Text style={s.arrow}>↗</Text>}
                </View>
              </Touch>

              <View style={s.actions}>
                {!onAddress && (
                  <>
                    <Touch
                      label={t("Use another address")}
                      motion={motion}
                      disabled={busy}
                      onPress={() => {
                        setStep("address");
                        setError("");
                        setNote("");
                      }}
                      style={s.secondary}
                    >
                      <Text style={s.secondaryText}>
                        {t("Use another address")}
                      </Text>
                    </Touch>
                    <Touch
                      label={t("Send a new code")}
                      motion={motion}
                      disabled={busy}
                      onPress={() => void send()}
                      style={s.secondary}
                    >
                      <Text style={s.secondaryText}>
                        {t("Send a new code")}
                      </Text>
                    </Touch>
                  </>
                )}
                <Touch
                  label={t("Not right now")}
                  motion={motion}
                  disabled={busy}
                  onPress={onClose}
                  style={s.secondary}
                >
                  <Text style={s.secondaryText}>{t("Not right now")}</Text>
                </Touch>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.paper },
  content: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 18,
  },
  compactContent: { gap: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  counter: {
    color: c.muted,
    fontSize: 9,
    letterSpacing: 1.1,
    fontWeight: "700",
  },
  artFrame: { minHeight: 180, alignItems: "center", justifyContent: "center" },
  copy: { gap: 12 },
  stepLabel: {
    color: c.stepLabel,
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
  compactTitle: { fontSize: 28, lineHeight: 32 },
  body: { color: c.muted, fontSize: 15, lineHeight: 23, maxWidth: 430 },
  inputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: {
    backgroundColor: c.white,
    borderColor: c.inputBorder,
    borderWidth: 1,
    borderRadius: 17,
    padding: 17,
    fontSize: 14,
    color: c.ink,
    minHeight: 54,
  },
  emailInput: { flex: 1 },
  codeInput: { letterSpacing: 8, fontSize: 20, fontWeight: "700" },
  micButton: {
    backgroundColor: c.white,
    borderColor: c.inputBorder,
    borderWidth: 1,
    borderRadius: 17,
    flexGrow: 0,
    height: 54,
    width: 54,
    justifyContent: "center",
    alignItems: "center",
  },
  micButtonActive: {
    borderColor: c.coral,
    backgroundColor: c.peach,
  },
  dictationHeard: {
    color: c.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: -8,
  },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  noteDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.coral },
  note: { color: c.ink, fontSize: 12, fontWeight: "600" },
  error: {
    color: c.error,
    backgroundColor: c.errorBg,
    borderRadius: 14,
    padding: 13,
    fontSize: 13,
    lineHeight: 19,
  },
  biometricButton: {
    backgroundColor: c.white,
    borderColor: c.line,
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 48,
  },
  biometricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    justifyContent: "center",
  },
  biometricIcon: {
    color: c.muted,
    fontSize: 18,
  },
  biometricText: {
    color: c.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  primary: {
    flexDirection: "row",
    gap: 9,
    backgroundColor: c.white,
    borderColor: c.coral,
    borderWidth: 1.5,
    borderRadius: 16,
    minHeight: 50,
  },
  buttonRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  primaryText: { color: c.coral, fontSize: 14, fontWeight: "800" },
  arrow: { color: c.coral, fontSize: 19 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  secondary: { paddingHorizontal: 3, minHeight: 46, flexGrow: 0 },
  secondaryText: {
    color: c.muted,
    fontSize: 12,
    textDecorationLine: "underline",
  },
});
