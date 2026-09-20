/** Serializes input channels without depending on a React render or transport. */
export function createTurnGate() {
  let active: symbol | null = null;
  return {
    begin(): symbol | null {
      if (active) return null;
      active = Symbol("conversation turn");
      return active;
    },
    finish(turn: symbol) {
      if (active === turn) active = null;
    },
    reset() {
      active = null;
    },
  };
}
