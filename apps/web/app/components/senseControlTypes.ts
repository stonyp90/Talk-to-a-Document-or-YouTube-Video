/** Input adapters stay mounted; only an explicit user action starts capture. */
export type SenseChannelControl = {
  start(): void;
  stop(): void;
};

export type SenseChannelActivity = {
  active: boolean;
  connecting: boolean;
};

export type SenseActivity = {
  listening: boolean;
  motion: boolean;
  connecting: boolean;
};
