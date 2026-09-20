import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { palette as c, Touch } from "./design";
import type { TranslationKey } from "./i18n";
import { createSenseTestBus } from "./senseTestBus";

export const SENSE_TEST_MODE =
  __DEV__ && process.env.EXPO_PUBLIC_SENSE_TEST_MODE === "1";
export const senseTestInputs = createSenseTestBus();

function BetaBadge() {
  return (
    <View style={s.betaBadge}>
      <Text style={s.betaText}>BETA</Text>
    </View>
  );
}

/** Only the explicitly flagged development build renders these test adapters. */
export function SenseTestControls({
  t,
}: {
  t: (key: TranslationKey) => string;
}) {
  const [text, setText] = useState("");
  if (!SENSE_TEST_MODE) return null;
  return (
    <View style={s.panel}>
      <View style={s.titleRow}>
        <Text style={s.title}>{t("Simulated inputs")}</Text>
        <BetaBadge />
      </View>
      <Text style={s.subtitle}>Multi-sensory interface prototype</Text>
      <TextInput
        accessibilityLabel="Simulated voice command"
        placeholder={t("Simulated voice command")}
        value={text}
        onChangeText={setText}
        style={s.input}
        autoCapitalize="none"
      />
      <Touch
        label="Send simulated voice"
        motion={false}
        onPress={() => {
          senseTestInputs.emit({ type: "voice", text });
          setText("");
        }}
      >
        <Text style={s.label}>{t("Send simulated voice")}</Text>
      </Touch>
      <View style={s.row}>
        {(
          [
            ["prev", "Tilt left"],
            ["next", "Tilt right"],
            ["ask", "Tilt forward"],
          ] as const
        ).map(([action, label]) => (
          <Touch
            key={action}
            label={label}
            motion={false}
            onPress={() => senseTestInputs.emit({ type: "motion", action })}
          >
            <Text style={s.label}>{t(label)}</Text>
          </Touch>
        ))}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  panel: {
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 16,
    backgroundColor: c.white,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: { color: c.ink, fontWeight: "700", fontSize: 14 },
  subtitle: { color: c.muted, fontSize: 12, marginTop: -4 },
  betaBadge: {
    backgroundColor: c.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  betaText: {
    color: c.white,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  input: {
    color: c.ink,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 10,
    padding: 12,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  label: { color: c.accent, fontSize: 13, padding: 8 },
});
