import * as Haptics from "expo-haptics";

export const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
export const select = () => Haptics.selectionAsync();
export const success = () =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
export const warn = () =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
export const medium = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
export const heavy = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
