"use client";

import { memo, useState, useRef, useEffect } from "react";
import ChatOverlay from "./ChatOverlay";

const Clock = memo(function Clock({ now }: { now: number }) {
  const time = new Date(now).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return <span className="dash-time">{time}</span>;
});

type VideoInfo = { youtube_id: string; title: string };

type StatusBarProps = {
  now: number;
  onShowHelp: () => void;
  onLogout: () => void;
  showVideo: boolean;
  onToggleVideo: () => void;
  muted: boolean;
  onToggleMuted: () => void;
  videos: VideoInfo[];
  currentVideoIndex: number;
  onNextVideo: () => void;
  onPrevVideo: () => void;
  onSelectVideo: (index: number) => void;
};

const VideoPicker = memo(function VideoPicker({
  videos,
  currentVideoIndex,
  onSelect,
  onClose,
}: {
  videos: VideoInfo[];
  currentVideoIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div className="dash-video-picker" ref={ref}>
      {videos.map((v, i) => (
        <button
          key={v.youtube_id}
          className={`dash-video-picker-item${i === currentVideoIndex ? " active" : ""}`}
          onClick={() => { onSelect(i); onClose(); }}
        >
          <img
            src={`https://img.youtube.com/vi/${v.youtube_id}/mqdefault.jpg`}
            alt={v.title || v.youtube_id}
            className="dash-video-picker-thumb"
          />
          <span className="dash-video-picker-title">{v.title || v.youtube_id}</span>
        </button>
      ))}
    </div>
  );
});

export default memo(function StatusBar({ now, onShowHelp, onLogout, showVideo, onToggleVideo, muted, onToggleMuted, videos, currentVideoIndex, onNextVideo, onPrevVideo, onSelectVideo }: StatusBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="dash-status-bar">
      <div className="dash-status-left">
        <Clock now={now} />
        <ChatOverlay />
      </div>
      <div className="dash-status-right">
        <button className="dash-video-toggle" onClick={onToggleVideo} aria-label={showVideo ? "Disable video" : "Enable video"}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {showVideo ? (
              <>
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </>
            ) : (
              <>
                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
                <polygon points="23 7 16 12 23 17 23 7" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </>
            )}
          </svg>
        </button>
        <button className="dash-video-toggle" onClick={onToggleMuted} aria-label={muted ? "Unmute video" : "Mute video"}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {muted ? (
              <>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </>
            ) : (
              <>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </>
            )}
          </svg>
        </button>
        {showVideo && videos.length > 1 && (
          <div className="dash-video-nav">
            <button className="dash-video-toggle" onClick={onPrevVideo} aria-label="Previous video">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="19 20 9 12 19 4 19 20" />
                <line x1="5" y1="19" x2="5" y2="5" />
              </svg>
            </button>
            <button className="dash-video-indicator" onClick={() => setPickerOpen((o) => !o)}>
              {currentVideoIndex + 1}/{videos.length}
            </button>
            <button className="dash-video-toggle" onClick={onNextVideo} aria-label="Next video">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 4 15 12 5 20 5 4" />
                <line x1="19" y1="5" x2="19" y2="19" />
              </svg>
            </button>
            {pickerOpen && (
              <VideoPicker
                videos={videos}
                currentVideoIndex={currentVideoIndex}
                onSelect={onSelectVideo}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
        )}
        <span className="dash-ticker-dot" />
        <span className="dash-ticker-text">Live</span>
        <button className="dash-help-btn" onClick={onShowHelp}>?</button>
        <button className="dash-logout-btn" onClick={onLogout}>Logout</button>
      </div>
    </div>
  );
});
