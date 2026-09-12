import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { TranslationKey } from "./i18n";
import { Brand, Orbit, Touch, palette as c, serif } from "./design";

/**
 * The gate, as the reader meets it. Two steps and nothing else: the address the
 * code is sent to, then the code. There is no password here to lose, and this
 * screen never sees the session token — it hands the two answers back and the
 * app stores what comes of them.
 */
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

/**
 * Mounted only while the gate is being asked, so a half-typed address or an
 * unused code is gone the moment the screen closes: there is no stale state to
 * reset, and nothing of a sign-in attempt outlives it.
 */
export function MobileSignIn({
  motion,
  t,
  onRequestCode,
  onConfirm,
  onClose,
}: Props) {
  const [step, setStep] = useState<"address" | "code">("address");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const codeField = useRef<TextInput>(null);

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

  const onAddress = step === "address";

  return (
    <Modal
      visible
      animationType={motion ? "fade" : "none"}
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.screen}>
        <KeyboardAvoidingView
          style={s.screen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={s.header}>
              <Brand />
              <Text style={s.counter}>
                {t("SIGN IN")} · {onAddress ? "01" : "02"} / 02
              </Text>
            </View>

            <View style={s.artFrame}>
              <Orbit motion={motion} />
            </View>

            <View style={s.copy}>
              <Text style={s.stepLabel}>
                {onAddress
                  ? t("Your email address").toUpperCase()
                  : t("Your code").toUpperCase()}
              </Text>
              <Text accessibilityRole="header" style={s.title}>
                {onAddress
                  ? t("Sign in to keep exploring")
                  : t("Check your email")}
              </Text>
              <Text style={s.body}>
                {onAddress
                  ? t(
                      "Voice, documents and answers run on a paid model, so they are for signed-in readers. We send a code — no password to remember.",
                    )
                  : `${t("We sent a code to")} ${email.trim()}`}
              </Text>
            </View>

            {onAddress ? (
              <TextInput
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
                editable={!busy}
                style={s.input}
              />
            ) : (
              <TextInput
                ref={codeField}
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

            <Touch
              label={onAddress ? t("Send me a code") : t("Sign in")}
              motion={motion}
              disabled={busy}
              onPress={() => void (onAddress ? send() : confirm())}
              style={s.primary}
            >
              <View style={s.buttonRow}>
                {busy && <ActivityIndicator color={c.ink} />}
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
                    <Text style={s.secondaryText}>{t("Send a new code")}</Text>
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
  input: {
    backgroundColor: c.white,
    borderColor: "#C9C0B5",
    borderWidth: 1,
    borderRadius: 17,
    padding: 17,
    fontSize: 14,
    color: c.ink,
    minHeight: 54,
  },
  codeInput: { letterSpacing: 8, fontSize: 20, fontWeight: "700" },
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
  primary: {
    flexDirection: "row",
    gap: 9,
    backgroundColor: c.coral,
    borderRadius: 16,
    minHeight: 50,
  },
  buttonRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  primaryText: { color: c.ink, fontSize: 14, fontWeight: "800" },
  arrow: { color: c.ink, fontSize: 19 },
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
