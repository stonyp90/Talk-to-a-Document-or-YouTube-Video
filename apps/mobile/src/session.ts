import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SessionStore } from "./client";

/**
 * The device half of the session. It is kept apart from the API client on
 * purpose: the client stays free of React Native imports, so it can be run and
 * tested under plain Node, and this file is the one adapter that knows where a
 * phone keeps things.
 *
 * The token is written here and read back at launch. It is never logged, never
 * shown in the interface and never put into an error message.
 */
const key = "ursly-mobile-session-v1";

export function deviceSessionStore(): SessionStore {
  return {
    async read() {
      // Unreadable storage means signed out, not broken: the reader signs in
      // again rather than meeting a crash on launch.
      return (await AsyncStorage.getItem(key).catch(() => null)) ?? "";
    },
    async write(token: string) {
      await AsyncStorage.setItem(key, token).catch(() => undefined);
    },
    async clear() {
      await AsyncStorage.removeItem(key).catch(() => undefined);
    },
  };
}
