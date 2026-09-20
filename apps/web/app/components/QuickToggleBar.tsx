"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import styles from './QuickToggleBar.module.css';

interface QuickToggleBarProps {
  voiceActive: boolean;
  cameraActive: boolean;
  onToggleVoice: () => void;
  onToggleCamera: () => void;
}

export function QuickToggleBar({ voiceActive, cameraActive, onToggleVoice, onToggleCamera }: QuickToggleBarProps) {
  const [debouncing, setDebouncing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleToggle = useCallback((toggleFn: () => void) => {
    if (debouncing) return;
    toggleFn();
    setDebouncing(true);
    timeoutRef.current = setTimeout(() => setDebouncing(false), 300);
  }, [debouncing]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={styles.toggleBar} role="toolbar" aria-label="Quick toggles">
      <button
        className={styles.toggleButton}
        onClick={() => handleToggle(onToggleVoice)}
        aria-pressed={voiceActive}
        aria-label="Mic"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </button>
      <button
        className={styles.toggleButton}
        onClick={() => handleToggle(onToggleCamera)}
        aria-pressed={cameraActive}
        aria-label="Camera"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      </button>
    </div>
  );
}
