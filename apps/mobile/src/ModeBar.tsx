import React, { useEffect } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { select } from "./haptics";
import type { TranslationKey } from "./i18n";
import { MODES, type EntryMode, type ModeId } from "./modes";
import { palette as c, BrainIcon, KeyboardIcon, Touch, Wave } from "./design";

type Props = {
  mode: EntryMode;
  motion: boolean;
  t: (key: TranslationKey) => string;
  onChoose: (id: ModeId) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

function Glyph({ id, color }: { id: ModeId; color: string }) {
  if (id === "human")
    return (
      <View style={s.wave}>
        <Wave motion={false} color={color} />
      </View>
    );
  if (id === "text") return <KeyboardIcon color={color} />;
  return <BrainIcon color={color} />;
}

function ModeItem({
  item,
  checked,
  color,
  motion,
  t,
  onChoose,
}: {
  item: (typeof MODES)[number];
  checked: boolean;
  color: string;
  motion: boolean;
  t: (key: TranslationKey) => string;
  onChoose: (id: ModeId) => void;
}) {
  const checkedValue = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- reanimated shared values are mutated via .value
    checkedValue.value = motion
      ? withSpring(checked ? 1 : 0, { damping: 15, stiffness: 200 })
      : checked
        ? 1
        : 0;
  }, [checked, motion, checkedValue]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: checkedValue.value,
    transform: [
      {
        scale:
          checkedValue.value === 1 && motion
            ? withSpring(1, { damping: 15 })
            : 0.94 + 0.06 * checkedValue.value,
      },
    ],
  }));

  return (
    <Touch
      label={t(item.label)}
      motion={motion}
      selected={checked}
      disabled={!item.available}
      contentStyle={s.itemContent}
      accessibilityRole="radio"
      onPress={() => {
        select();
        onChoose(item.id);
      }}
      style={s.item}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, s.itemSelected, animatedStyle]}
      />
      <View style={s.itemInner}>
        <Glyph id={item.id} color={color} />
        <View style={s.itemText}>
          <Text style={[s.label, checked && s.labelSelected]} numberOfLines={1}>
            {t(item.short)}
          </Text>
          {item.detail && <Text style={s.detail}>{t(item.detail)}</Text>}
        </View>
      </View>
    </Touch>
  );
}

/** The same compact input preferences as the web header. */
export function ModeBar({ mode, motion, t, onChoose, onLayout }: Props) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t("Control mode")}
      style={s.bar}
      onLayout={onLayout}
    >
      {MODES.map((item) => {
        const checked = item.id === mode;
        const color = checked ? c.accent : c.muted;
        return (
          <ModeItem
            key={item.id}
            item={item}
            checked={checked}
            color={color}
            motion={motion}
            t={t}
            onChoose={onChoose}
          />
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 3,
    minHeight: 52,
    marginHorizontal: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 15,
    backgroundColor: c.white,
  },
  item: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 12 },
  itemContent: { padding: 4, borderRadius: 12 },
  itemSelected: { backgroundColor: c.peach, borderRadius: 11 },
  itemInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  itemText: { alignItems: "flex-start", gap: 1, flexShrink: 1 },
  wave: { width: 20, alignItems: "center", transform: [{ scale: 0.65 }] },
  label: { color: c.muted, fontSize: 11, fontWeight: "600" },
  labelSelected: { color: c.accent, fontWeight: "800" },
  detail: {
    color: c.muted,
    backgroundColor: c.lavender,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
