"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Ursly — Something went wrong</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        style={{
          margin: 0,
          background: "#f8f5ef",
          color: "#292735",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100dvh",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <img
            src="/brand/ursly-mark.svg"
            width="48"
            height="48"
            alt=""
            style={{ margin: "0 auto 24px" }}
          />
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              margin: "0 0 12px",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              color: "#716c78",
              margin: "0 0 24px",
              lineHeight: 1.5,
            }}
          >
            Ursly ran into a problem. The page can try again from where it left
            off.
          </p>
          <button
            type="button"
            onClick={retry}
            style={{
              background: "transparent",
              border: "1px solid #a84332",
              color: "#a84332",
              borderRadius: 8,
              padding: "8px 20px",
              fontWeight: 500,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
