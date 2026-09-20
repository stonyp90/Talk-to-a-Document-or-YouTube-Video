import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { palette as c } from "../design";

export type ToastState = "pending" | "success" | "error" | "info";

export type ToastItem = {
  id: string;
  message: string;
  state: ToastState;
  duration?: number;
};

const stateColors: Record<ToastState, string> = {
  pending: c.hudPanel,
  success: "rgba(77, 124, 15, 0.9)",
  error: "rgba(185, 28, 28, 0.9)",
  info: c.hudPanel,
};

const stateLabels: Record<ToastState, string> = {
  pending: "◌",
  success: "✓",
  error: "✕",
  info: "●",
};

function ToastBubble({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withDelay(0, withTiming(1, { duration: 280 }));
    translateY.value = withDelay(0, withTiming(0, { duration: 280 }));

    if (item.state !== "pending" && item.duration !== 0) {
      const timeout = item.duration ?? 3200;
      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 200 });
      }, timeout);
      return () => clearTimeout(timer);
    }
  }, [item.state, item.duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.toast, animatedStyle]}>
      <View
        style={[
          styles.indicator,
          { backgroundColor: stateColors[item.state] },
        ]}
      >
        <Text style={styles.indicatorText}>{stateLabels[item.state]}</Text>
      </View>
      <Text style={styles.toastText} numberOfLines={2}>
        {item.message}
      </Text>
      {item.state === "pending" ? (
        <View style={styles.spinner} />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={() => onDismiss(item.id)}
          hitSlop={8}
          style={styles.dismiss}
        >
          <Text style={styles.dismissText}>×</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

export function ToastLayer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  const visible = toasts.slice(-3);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {visible.map((item) => (
        <ToastBubble key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    zIndex: 100,
    gap: 8,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(13, 15, 18, 0.88)",
    borderRadius: 16,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  indicator: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  indicatorText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  toastText: {
    flex: 1,
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 13,
    lineHeight: 18,
  },
  spinner: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderTopColor: c.coral,
  },
  dismiss: {
    minWidth: 32,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 18,
  },
});
