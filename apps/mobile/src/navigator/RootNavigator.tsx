import React, { useState, useEffect } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GalaxyScreen } from "../screens/GalaxyScreen";
import { ClassicApp } from "../app/ClassicApp";

const ONBOARDING_KEY = "ursly-onboarding-complete";

type Screen = "splash" | "galaxy" | "classic";

export function RootNavigator() {
  const [screen, setScreen] = useState<Screen>("splash");

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((done) => {
      setScreen("galaxy");
    });
  }, []);

  switch (screen) {
    case "splash":
      return (
        <View style={styles.splash}>
          <ActivityIndicator size="large" color="#F47762" />
        </View>
      );
    case "galaxy":
      return <GalaxyScreen />;
    case "classic":
      return <ClassicApp />;
  }
}

const styles = StyleSheet.create({
  splash: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0D0F12" },
});
