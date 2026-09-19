import * as Haptics from "expo-haptics";

export const haptic = {
  selectPlanet() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
  openConversation() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  flyBack() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  voiceCommand() {
    Haptics.selectionAsync();
  },
};
