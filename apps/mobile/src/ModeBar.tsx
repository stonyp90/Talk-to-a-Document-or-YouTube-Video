import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { TranslationKey } from "./i18n";
import { MODES, type EntryMode, type ModeId } from "./modes";
import { palette as c, SourceIcon, Touch, Wave } from "./design";

type Props = {
  mode: EntryMode;
  motion: boolean;
  t: (key: TranslationKey) => string;
  onChoose: (id: ModeId) => void;
};

function Glyph({ id, color }: { id: ModeId; color: string }) {
  if (id === "voice") return <Wave motion={false} color={color} />;
  if (id === "text") return <SourceIcon kind="pdf" color={color} />;
  return <Text style={[s.glyph, { color }]}>✦</Text>;
}

/**
 * The sticky control menu at the bottom of every screen, the phone-sized
 * twin of the website's top menu: one mode is always selected, and the beta
 * stays visible so people learn what is coming without being able to pick
 * something that does not work yet.
 */
export function ModeBar({ mode, motion, t, onChoose }: Props) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t("Control mode")}
      style={s.bar}
    >
      {MODES.map((item) => {
        const checked = item.id === mode;
        const color = checked ? c.ink : c.muted;
        return (
          <Touch
            key={item.id}
            label={t(item.label)}
            motion={motion}
            selected={checked}
            accessibilityRole="radio"
            onPress={() => onChoose(item.id)}
            style={[s.item, checked && s.itemSelected]}
          >
            <View style={s.itemInner}>
              <Glyph id={item.id} color={color} />
              <Text style={[s.label, checked && s.labelSelected]}>
                {t(item.short)}
              </Text>
              {item.detail && <Text style={s.detail}>{t(item.detail)}</Text>}
            </View>
          </Touch>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    minHeight: 80,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.line,
    backgroundColor: c.white,
    shadowColor: c.ink,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -5 },
    elevation: 12,
  },
  item: {
    flex: 1,
    minHeight: 62,
    borderRadius: 18,
  },
  itemSelected: {
    backgroundColor: c.lavender,
  },
  itemInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 4,
  },
  glyph: { fontSize: 18, lineHeight: 22 },
  label: {
    color: c.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  labelSelected: {
    color: c.ink,
    fontWeight: "800",
  },
  detail: {
    color: c.accent,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});
