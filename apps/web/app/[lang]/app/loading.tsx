export default function Loading() {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "60dvh",
        padding: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <img
          src="/brand/ursly-mark.svg"
          width="40"
          height="40"
          alt=""
          style={{
            animation: "loader-breathe 2000ms ease-in-out infinite",
          }}
        />
        <span
          className="spinner"
          aria-hidden="true"
          style={{ width: 18, height: 18 }}
        />
      </div>
    </div>
  );
}
