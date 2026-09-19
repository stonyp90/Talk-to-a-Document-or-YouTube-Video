import React, { useCallback } from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { GalaxyScene } from "../scene/GalaxyScene";
import { useGalaxyState } from "../scene/useGalaxyState";
import { InputController } from "../input/InputController";
import { ARProvider, useAR } from "../ar/ARProvider";
import { VoiceOrb } from "../ui/VoiceOrb";
import { ARToggle } from "../ui/ARToggle";
import { Breadcrumb } from "../ui/Breadcrumb";
import type { SceneAction, GestureSignal } from "../input/intentionResolver";

function GalaxyScreenInner() {
  const state = useGalaxyState();
  const ar = useAR();

  const handleAction = useCallback(
    (action: SceneAction) => {
      switch (action.type) {
        case "fly-to":
          state.selectPlanet(action.planetId);
          break;
        case "fly-back":
          state.flyBack();
          break;
        case "toggle-reality":
          ar.toggle();
          break;
      }
    },
    [state, ar],
  );

  const handleGesture = useCallback(
    (signal: GestureSignal) => {
      if (signal.type === "tap-planet") state.selectPlanet(signal.planetId);
      if (signal.type === "tap-empty") state.flyBack();
      if (signal.type === "orbit") state.setOrbitAngle(state.orbitAngle + signal.delta);
    },
    [state],
  );

  const selectedPlanet = state.planets.find((p) => p.id === state.selectedId);
  const location = selectedPlanet ? selectedPlanet.name : "Galaxy";

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <GalaxyScene />
      <View style={styles.hud}>
        <View style={styles.topBar}>
          <Breadcrumb location={location} />
          <ARToggle active={ar.active} onToggle={ar.toggle} />
        </View>
        <View style={styles.bottomBar}>
          <VoiceOrb listening={false} />
        </View>
      </View>
      <InputController
        planets={state.planets}
        transcript=""
        onAction={handleAction}
        onGestureSignal={handleGesture}
      />
    </View>
  );
}

export function GalaxyScreen() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <ARProvider>
        <GalaxyScreenInner />
      </ARProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0F12" },
  hud: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    padding: 16,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bottomBar: {
    alignItems: "center",
  },
});
