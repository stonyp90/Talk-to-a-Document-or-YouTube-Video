import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Language, TranslationKey } from "./i18n";
import { NavIcon, Touch, palette as c } from "./design";

export type MobileDestination = "home" | "chat" | "source";

type Props = {
  destination: MobileDestination;
  language: Language;
  motion: boolean;
  t: (key: TranslationKey) => string;
  onNavigate: (destination: MobileDestination) => void;
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
  t,
  onNavigate,
}: Props) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={
        language === "fr" ? "Navigation principale" : "Main navigation"
      }
      style={s.bar}
    >
      {items.map((item) => {
        const selected = destination === item.id;
        return (
          <Touch
            key={item.id}
            label={t(item.accessibilityLabel)}
            motion={motion}
            selected={selected}
            accessibilityRole="tab"
            onPress={() => onNavigate(item.id)}
            style={[s.item, selected && s.itemSelected]}
          >
            <NavIcon kind={item.icon} color={selected ? c.ink : c.muted} />
            <Text style={[s.label, selected && s.labelSelected]}>
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
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 18,
    gap: 4,
  },
  itemSelected: {
    backgroundColor: c.lavender,
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
});
