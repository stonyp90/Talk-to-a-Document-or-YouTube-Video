import React from "react";
import { StyleSheet, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./src/navigator/RootNavigator";

SplashScreen.setOptions({ duration: 350, fade: true });

function showWorkspace() {
  void SplashScreen.hideAsync();
}

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.root} onLayout={showWorkspace}>
        <RootNavigator />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
