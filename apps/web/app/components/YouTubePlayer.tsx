"use client";

import { useEffect, useRef } from "react";

type YouTubePlayerProps = {
  videoId: string;
  className?: string;
};

/**
 * Embeds a YouTube video as an immersive background. The iframe is styled to
 * fill its container and plays silently in the background while the reader
 * interacts with the overlay UI.
 */
export function YouTubePlayer({ videoId, className }: YouTubePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // The iframe loads the YouTube embed with autoplay, no controls, and
    // minimal branding so it reads as a background rather than a player.
    if (!iframeRef.current) return;
    const iframe = iframeRef.current;
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&loop=1&playlist=${videoId}`;
  }, [videoId]);

  return (
    <div className={className} aria-hidden="true">
      <iframe
        ref={iframeRef}
        title=""
        allow="autoplay; encrypted-media"
        allowFullScreen={false}
      />
    </div>
  );
}
