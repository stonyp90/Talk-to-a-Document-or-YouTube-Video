"use client";

import { useEffect, useRef, useState } from "react";

const transcript =
  "Ursly turns a document or a captioned video into a conversation. Bring a source, ask by voice or text, and explore what matters. Voice actions help you take the next step. Motion beta previews a future hands-free AR/VR layer without triggering actions from pointer clicks.";

export function IntroVideo() {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) {
      video.current?.pause();
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const pauseWhenHidden = () => {
      if (document.hidden) video.current?.pause();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("visibilitychange", pauseWhenHidden);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="intro-video-trigger"
        onClick={() => {
          setFailed(false);
          setOpen(true);
        }}
      >
        Watch Ursly in 24 seconds <span aria-hidden="true">↗</span>
      </button>
      {open && (
        <div
          className="intro-video-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="intro-video-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="intro-video-title"
            aria-describedby="intro-video-description"
          >
            <div className="intro-video-heading">
              <div>
                <span className="eyebrow">The Ursly story</span>
                <h2 id="intro-video-title">A source. A conversation.</h2>
              </div>
              <button
                type="button"
                className="intro-video-close"
                autoFocus
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <p id="intro-video-description" className="intro-video-lede">
              A quick, high-level look at how Ursly helps ideas become clear.
            </p>
            {!failed ? (
              <video
                ref={video}
                className="intro-video-player"
                controls
                playsInline
                preload="metadata"
                poster="/brand/social-card.png"
                onError={() => setFailed(true)}
              >
                <source src="/brand/ursly-intro.mp4" type="video/mp4" />
                Your browser does not support this video.
              </video>
            ) : (
              <div className="intro-video-fallback" role="status">
                <strong>The intro is unavailable right now.</strong>
                <p>{transcript}</p>
              </div>
            )}
            <details className="intro-video-transcript">
              <summary>Read the intro instead</summary>
              <p>{transcript}</p>
            </details>
          </section>
        </div>
      )}
    </>
  );
}
