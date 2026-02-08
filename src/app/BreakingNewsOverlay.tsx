"use client";

import { useEffect, useState, useRef, useCallback } from "react";

type BNMessage = {
  id: string;
  content: string;
  userName: string;
};

const SCROLL_SPEED = 80; // px per second

const TV_AUTO_DISMISS_MS = 30_000;

export default function BreakingNewsOverlay({
  onPause,
  onResume,
  tvMode = false,
}: {
  onPause: () => void;
  onResume: () => void;
  tvMode?: boolean;
}) {
  const [message, setMessage] = useState<BNMessage | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number>(0);
  const offsetRef = useRef(0);
  const lastTimeRef = useRef(0);
  const textWidthRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Listen for breakingNews CustomEvent dispatched by ChatOverlay
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail as BNMessage;
      if (!msg?.id) return;
      setMessage({ id: msg.id, content: msg.content, userName: msg.userName });
      offsetRef.current = 0;
      lastTimeRef.current = 0;
    };

    window.addEventListener("breakingNews", handler);
    return () => window.removeEventListener("breakingNews", handler);
  }, []);

  // Play sound and pause video when message activates
  useEffect(() => {
    if (!message) return;

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      const audio = new Audio("/sounds/breaking-news.wav");
      audio.volume = 0.7;
      audio.play().catch(() => {});
      audioRef.current = audio;
    } catch {
      // Audio may fail in some environments
    }

    onPause();
  }, [message, onPause]);

  const handleDismiss = useCallback(() => {
    setMessage(null);
    offsetRef.current = 0;
    onResume();
  }, [onResume]);

  // Auto-dismiss after 30s in TV mode
  useEffect(() => {
    if (!message || !tvMode) return;
    const timer = setTimeout(handleDismiss, TV_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, tvMode, handleDismiss]);

  // Measure text width
  const measureText = useCallback(() => {
    if (textRef.current) {
      textWidthRef.current = textRef.current.scrollWidth;
    }
  }, []);

  // Scroll animation: continuous loop until dismissed
  useEffect(() => {
    if (!message) return;

    // Wait a frame for render, then measure
    requestAnimationFrame(() => {
      measureText();

      const tick = (timestamp: number) => {
        if (lastTimeRef.current === 0) {
          lastTimeRef.current = timestamp;
        }

        const delta = (timestamp - lastTimeRef.current) / 1000;
        lastTimeRef.current = timestamp;

        if (textWidthRef.current > 0) {
          offsetRef.current += SCROLL_SPEED * delta;

          if (offsetRef.current >= textWidthRef.current) {
            offsetRef.current -= textWidthRef.current;
          }
        }

        if (trackRef.current) {
          trackRef.current.style.transform = `translateX(-${offsetRef.current}px)`;
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = 0;
    };
  }, [message, measureText]);

  if (!message) return null;

  return (
    <div className="bn-overlay">
      <div className="bn-flash" />

      <div className="bn-content">
        <div className="bn-header">BREAKING NEWS</div>

        <div className="bn-ticker-wrap">
          <div ref={trackRef} className="bn-ticker-track">
            <span ref={textRef} className="bn-ticker-text">
              {message.content}
              <span className="bn-ticker-spacer" />
            </span>
            <span className="bn-ticker-text">
              {message.content}
              <span className="bn-ticker-spacer" />
            </span>
          </div>
        </div>

        <button className="bn-ok-btn" onClick={handleDismiss}>
          OK
        </button>
      </div>
    </div>
  );
}
