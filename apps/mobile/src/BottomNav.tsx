import React from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { Language, TranslationKey } from "./i18n";
import { NavIcon, Touch, palette as c } from "./design";

export type MobileDestination = "home" | "chat" | "source";

type Props = {
  destination: MobileDestination;
  language: Language;
  motion: boolean;
  // Conversation and Source lead nowhere until a source is loaded.
  sourceReady: boolean;
  t: (key: TranslationKey) => string;
  onNavigate: (destination: MobileDestination) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

const items: Array<{
  id: MobileDestination;
  label: TranslationKey;
  accessibilityLabel: TranslationKey;
  icon: "home" | "chat" | "source";
}> = [
  {
    id: "home",
    label: "Explore",
    accessibilityLabel: "Open the home screen",
    icon: "home",
  },
  {
    id: "chat",
    label: "Conversation",
    accessibilityLabel: "Open the conversation",
    icon: "chat",
  },
  {
    id: "source",
    label: "Source",
    accessibilityLabel: "Open the source",
    icon: "source",
  },
];

export function MobileBottomNav({
  destination,
  language,
  motion,
  sourceReady,
  t,
  onNavigate,
  onLayout,
}: Props) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={
        language === "fr" ? "Navigation principale" : "Main navigation"
      }
      style={s.bar}
      onLayout={onLayout}
    >
      {items.map((item) => {
        const selected = destination === item.id;
        const waiting = !sourceReady && item.id !== "home";
        return (
          <Touch
            key={item.id}
            label={t(item.accessibilityLabel)}
            motion={motion}
            selected={selected}
            accessibilityRole="tab"
            accessibilityDisabled={waiting}
            onPress={() => onNavigate(item.id)}
            style={[
              s.item,
              selected && s.itemSelected,
              waiting && s.itemWaiting,
            ]}
          >
            <NavIcon
              kind={item.icon}
              color={selected ? c.ink : waiting ? c.lilac : c.muted}
            />
            <Text
              style={[
                s.label,
                selected && s.labelSelected,
                waiting && s.labelWaiting,
              ]}
            >
              {t(item.label)}
            </Text>
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
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 6,
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
    minHeight: 48,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 3,
  },
  itemSelected: {
    backgroundColor: c.lavender,
  },
  itemWaiting: {
    opacity: 0.55,
  },
  label: {
    color: c.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  labelSelected: {
    color: c.ink,
    fontWeight: "800",
  },
  labelWaiting: {
    color: c.lilac,
  },
});
