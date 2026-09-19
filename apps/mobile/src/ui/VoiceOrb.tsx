import React, { useEffect } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { palette } from "../design";

export function VoiceOrb({
  listening,
  onPress,
}: {
  listening: boolean;
  onPress?: () => void;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (listening) {
      scale.value = withRepeat(
        withTiming(1.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [listening]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View>
        <Animated.View
          style={[
            styles.orb,
            { backgroundColor: listening ? palette.coral : palette.muted },
            animatedStyle,
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  orb: { width: 48, height: 48, borderRadius: 24 },
});
