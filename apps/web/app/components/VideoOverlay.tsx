"use client";
import { useEffect, useRef } from 'react';
import styles from './VideoOverlay.module.css';

interface VideoOverlayProps {
  active: boolean;
  opacity?: number;
  cameraUnavailable?: boolean;
  stream?: MediaStream | null;
}

export function VideoOverlay({ active, opacity = 0.15, cameraUnavailable = false, stream = null }: VideoOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!active && !cameraUnavailable) return null;

  if (cameraUnavailable) {
    return (
      <div className={styles.ghostState}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
        <span>Camera unavailable</span>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      data-testid="video-overlay"
      className={styles.videoOverlay}
      style={{ opacity }}
      autoPlay
      muted
      playsInline
    />
  );
}
