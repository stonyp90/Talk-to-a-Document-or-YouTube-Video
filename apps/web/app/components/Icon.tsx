export type IconName =
  | "document"
  | "keyboard"
  | "video"
  | "arrow"
  | "voice"
  | "motion"
  | "brain"
  | "download"
  | "external"
  | "bell"
  | "eye"
  | "play"
  | "close"
  | "sun"
  | "moon"
  | "chat";

const PATHS: Record<IconName, string[]> = {
  document: [
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M14 2v6h6M8 13h8M8 17h5",
  ],
  keyboard: [
    "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
    "M6 9h1m3 0h1m3 0h1m3 0h1M6 12h1m3 0h1m3 0h1m3 0h1M6 15h1m3 0h7",
  ],
  video: [
    "M8 7l9 5-9 5V7Z",
    "M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z",
  ],
  arrow: ["M5 12h14M13 6l6 6-6 6"],
  voice: ["M4 10v4", "M8 6v12", "M12 3v18", "M16 6v12", "M20 10v4"],
  motion: [
    "M8 21V10.5a1.5 1.5 0 0 1 3 0V14",
    "M11 12V6a1.5 1.5 0 0 1 3 0v7",
    "M14 11V8a1.5 1.5 0 0 1 3 0v5",
    "M17 12v-1a1.5 1.5 0 0 1 3 0v4c0 4-2.5 6-6 6h-2.5a4 4 0 0 1-3.5-2l-2.5-4",
  ],
  brain: [
    "M9 4.5a3 3 0 0 0-3 3v.5a3 3 0 0 0-2 2.8A3 3 0 0 0 6.5 14H7",
    "M15 4.5a3 3 0 0 1 3 3v.5a3 3 0 0 1 2 2.8 3 3 0 0 1-2.5 3.2H17",
    "M9 4.5v15M15 4.5v15M9 8h6M9 13h6M9 18h6",
  ],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"],
  external: [
    "M14 4h6v6",
    "M20 4 11 13",
    "M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5",
  ],
  bell: ["M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M10 21h4"],
  eye: [
    "M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z",
    "M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z",
  ],
  play: ["M7 5v14l11-7L7 5Z"],
  close: ["M6 6l12 12", "M18 6 6 18"],
  sun: [
    "M12 3v2",
    "M12 19v2",
    "m4.22 4.22 1.42 1.42",
    "m18.36 18.36 1.42 1.42",
    "M3 12h2",
    "M19 12h2",
    "m4.22 19.78 1.42-1.42",
    "m18.36 5.64 1.42-1.42",
    "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  ],
  moon: ["M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5Z"],
  chat: [
    "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
  ],
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className={`icon icon-${name}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}
