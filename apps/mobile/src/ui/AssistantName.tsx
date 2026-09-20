import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { palette as c, spacing } from "../design";

const PRESETS = ["Aria", "Nova", "Sage", "Echo"];
const STORAGE_KEY = "ursly-assistant-name";

export function AssistantName({
  value,
  onChange,
  t,
}: {
  value: string;
  onChange: (name: string) => void;
  t: (key: string) => string;
}) {
  const [draft, setDraft] = useState(value);

  const save = async () => {
    const trimmed = draft.trim();
    if (trimmed) {
      await AsyncStorage.setItem(STORAGE_KEY, trimmed);
      onChange(trimmed);
    }
  };

  const reset = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setDraft("Sense to Action");
    onChange("Sense to Action");
  };

  const selectPreset = async (name: string) => {
    setDraft(name);
    await AsyncStorage.setItem(STORAGE_KEY, name);
    onChange(name);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>{t("Give your assistant a name")}</Text>

      <View style={styles.presets}>
        {PRESETS.map((name) => (
          <Pressable
            key={name}
            accessibilityRole="button"
            onPress={() => selectPreset(name)}
            style={[
              styles.preset,
              draft === name && styles.presetActive,
            ]}
          >
            <Text
              style={[
                styles.presetText,
                draft === name && styles.presetTextActive,
              ]}
            >
              {name}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={t("Custom name")}
          placeholderTextColor={c.muted}
          maxLength={30}
        />
        <Pressable
          accessibilityRole="button"
          onPress={save}
          disabled={!draft.trim() || draft.trim() === value}
          style={[
            styles.saveButton,
            (!draft.trim() || draft.trim() === value) &&
              styles.saveButtonDisabled,
          ]}
        >
          <Text style={styles.saveText}>{t("Save")}</Text>
        </Pressable>
        {value !== "Sense to Action" && (
          <Pressable
            accessibilityRole="button"
            onPress={reset}
            style={styles.resetButton}
          >
            <Text style={styles.resetText}>{t("Reset")}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  hint: {
    color: c.muted,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  presets: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  preset: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 36,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 8,
    backgroundColor: c.white,
  },
  presetActive: {
    borderColor: c.coral,
    backgroundColor: c.selectedBg,
  },
  presetText: {
    color: c.ink,
    fontSize: 13,
  },
  presetTextActive: {
    color: c.accent,
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  input: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 8,
    backgroundColor: c.white,
    color: c.ink,
    fontSize: 14,
  },
  saveButton: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: c.coral,
    borderRadius: 8,
    backgroundColor: c.coral,
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveText: {
    color: c.white,
    fontSize: 13,
    fontWeight: "600",
  },
  resetButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 8,
    backgroundColor: c.white,
    justifyContent: "center",
  },
  resetText: {
    color: c.muted,
    fontSize: 13,
  },
});
