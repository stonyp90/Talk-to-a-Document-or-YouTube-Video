import React, { useCallback, useRef } from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import { GestureHandlerRootView, GestureDetector } from "react-native-gesture-handler";
import { GalaxyScene } from "../scene/GalaxyScene";
import { useGalaxyState } from "../scene/useGalaxyState";
import { InputController } from "../input/InputController";
import { useGestureInput } from "../input/useGestureInput";
import { screenToPlanet } from "../input/screenToPlanet";
import { useGalaxyVoice } from "../input/useGalaxyVoice";
import { ARProvider, useAR } from "../ar/ARProvider";
import { VoiceOrb } from "../ui/VoiceOrb";
import { ARToggle } from "../ui/ARToggle";
import { Breadcrumb } from "../ui/Breadcrumb";
import type { SceneAction, GestureSignal } from "../input/intentionResolver";

function GalaxyScreenInner() {
  const state = useGalaxyState();
  const ar = useAR();
  const stateRef = useRef(state);
  stateRef.current = state;
  const orbitRef = useRef(state.orbitAngle);
  orbitRef.current = state.orbitAngle;

  const handleAction = useCallback(
    (action: SceneAction) => {
      const s = stateRef.current;
      switch (action.type) {
        case "fly-to":
          s.selectPlanet(action.planetId);
          break;
        case "fly-back":
          s.flyBack();
          break;
        case "toggle-reality":
          ar.toggle();
          break;
      }
    },
    [ar],
  );

  const handleGesture = useCallback(
    (signal: GestureSignal) => {
      const s = stateRef.current;
      if (signal.type === "tap-planet") s.selectPlanet(signal.planetId);
      if (signal.type === "tap-empty") s.flyBack();
      if (signal.type === "orbit") s.setOrbitAngle(s.orbitAngle + signal.delta);
    },
    [],
  );

  const hitTest = useCallback(
    (x: number, y: number): string | null => screenToPlanet(x, y, orbitRef.current),
    [],
  );

  const gesture = useGestureInput(hitTest, handleGesture);
  const voice = useGalaxyVoice();

  const selectedPlanet = state.planets.find((p) => p.id === state.selectedId);
  const location = selectedPlanet ? selectedPlanet.name : "Galaxy";

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <GalaxyScene
          planets={state.planets}
          selectedId={state.selectedId}
          orbitAngle={state.orbitAngle}
        />
        <View style={styles.hud} pointerEvents="none">
          <View style={styles.topBar} pointerEvents="auto">
            <Breadcrumb location={location} />
            <ARToggle active={ar.active} onToggle={ar.toggle} />
          </View>
          <View style={styles.bottomBar} pointerEvents="auto">
            <VoiceOrb listening={voice.listening} onPress={voice.toggleListening} />
          </View>
        </View>
        <InputController
          planets={state.planets}
          transcript={voice.transcript}
          orbitAngle={state.orbitAngle}
          onAction={handleAction}
          onGestureSignal={handleGesture}
        />
      </View>
    </GestureDetector>
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
    ...StyleSheet.absoluteFill,
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
