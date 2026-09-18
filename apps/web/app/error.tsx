"use client";

import { useEffect } from "react";

export default function Error({
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
    <div className="shell" style={{ padding: "var(--space-6xl) var(--gutter)" }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <img
          src="/brand/ursly-mark.svg"
          width="48"
          height="48"
          alt=""
          style={{ margin: "0 auto var(--space-lg)" }}
        />
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            margin: "0 0 var(--space-md)",
          }}
        >
          Something went wrong
        </h1>
        <p
          style={{
            color: "var(--muted)",
            margin: "0 0 var(--space-xl)",
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
            border: "1px solid var(--accent)",
            color: "var(--accent)",
            borderRadius: 8,
            padding: "8px 20px",
            fontWeight: 500,
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
