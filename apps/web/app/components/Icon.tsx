export type IconName = "document" | "video" | "arrow" | "voice";

const PATHS: Record<IconName, string[]> = {
  document: [
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M14 2v6h6M8 13h8M8 17h5",
  ],
  video: [
    "M8 7l9 5-9 5V7Z",
    "M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z",
  ],
  arrow: ["M5 12h14M13 6l6 6-6 6"],
  voice: ["M4 10v4", "M8 6v12", "M12 3v18", "M16 6v12", "M20 10v4"],
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
