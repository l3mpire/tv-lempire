"use client";

import { memo, useState, useRef, useEffect } from "react";
import ChatOverlay from "./ChatOverlay";
import Tooltip from "./Tooltip";
import type { VideoPlayerHandle } from "./page";

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

function formatTime(s: number): string {
  const sec = Math.floor(s);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

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
  videoPlayerRef: React.RefObject<VideoPlayerHandle | null>;
  videoBlocked: boolean;
  onSaveProgress: () => void;
  cinemaMode: boolean;
  onToggleCinemaMode: () => void;
};

function VideoSeekBar({ playerRef, onSaveProgress }: { playerRef: React.RefObject<VideoPlayerHandle | null>; onSaveProgress: () => void }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(true);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (playerRef.current) {
      setCurrentTime(playerRef.current.getCurrentTime());
      setDuration(playerRef.current.getDuration());
    }
    const iv = setInterval(() => {
      if (!playerRef.current) return;
      if (!draggingRef.current) {
        setCurrentTime(playerRef.current.getCurrentTime());
        setDuration(playerRef.current.getDuration());
      }
      setPlaying(playerRef.current.getPlayerState() === 1);
    }, 500);
    return () => clearInterval(iv);
  }, [playerRef]);

  const togglePlayPause = () => {
    if (!playerRef.current) return;
    if (playing) {
      playerRef.current.pauseVideo();
      onSaveProgress();
    } else {
      playerRef.current.playVideo();
    }
    setPlaying(!playing);
  };

  if (duration <= 0) return null;

  const pct = (currentTime / duration) * 100;

  return (
    <div className="dash-video-seek">
      <button className="dash-video-seek-playpause" onClick={togglePlayPause} aria-label={playing ? "Pause" : "Play"}>
        {playing ? (
          <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
            <rect x="0" y="0" width="3" height="12" />
            <rect x="7" y="0" width="3" height="12" />
          </svg>
        ) : (
          <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
            <polygon points="0,0 10,6 0,12" />
          </svg>
        )}
      </button>
      <span className="dash-video-seek-time">{formatTime(currentTime)}</span>
      <input
        type="range"
        className="dash-video-seek-bar"
        min={0}
        max={Math.floor(duration)}
        value={Math.floor(currentTime)}
        style={{ background: `linear-gradient(to right, var(--accent) ${pct}%, rgba(255,255,255,0.1) ${pct}%)` }}
        onMouseDown={() => { draggingRef.current = true; }}
        onMouseUp={() => { draggingRef.current = false; }}
        onChange={(e) => {
          const s = Number(e.target.value);
          setCurrentTime(s);
          playerRef.current?.seekTo(s);
        }}
      />
      <span className="dash-video-seek-time">{formatTime(duration)}</span>
    </div>
  );
}

const VideoPicker = memo(function VideoPicker({
  videos,
  currentVideoIndex,
  onSelect,
  playerRef,
  onSaveProgress,
}: {
  videos: VideoInfo[];
  currentVideoIndex: number;
  onSelect: (index: number) => void;
  playerRef: React.RefObject<VideoPlayerHandle | null>;
  onSaveProgress: () => void;
}) {
  return (
    <div className="dash-video-picker">
      {videos.map((v, i) => (
        <button
          key={v.youtube_id}
          className={`dash-video-picker-item${i === currentVideoIndex ? " active" : ""}`}
          onClick={() => onSelect(i)}
        >
          <img
            src={`https://img.youtube.com/vi/${v.youtube_id}/mqdefault.jpg`}
            alt={v.title || v.youtube_id}
            className="dash-video-picker-thumb"
          />
        </button>
      ))}
      <VideoSeekBar playerRef={playerRef} onSaveProgress={onSaveProgress} />
    </div>
  );
});

export default memo(function StatusBar({ now, onShowHelp, onLogout, showVideo, onToggleVideo, muted, onToggleMuted, videos, currentVideoIndex, onNextVideo, onPrevVideo, onSelectVideo, videoPlayerRef, videoBlocked, onSaveProgress, cinemaMode, onToggleCinemaMode }: StatusBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showVideo) return;
    if (videoPlayerRef.current) {
      setIsPlaying(videoPlayerRef.current.getPlayerState() === 1);
    }
    const iv = setInterval(() => {
      if (!videoPlayerRef.current) return;
      setIsPlaying(videoPlayerRef.current.getPlayerState() === 1);
    }, 1000);
    return () => clearInterval(iv);
  }, [showVideo, videoPlayerRef]);

  useEffect(() => {
    if (!pickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerOpen]);

  return (
    <div className="dash-status-bar">
      <div className="dash-status-left">
        <Clock now={now} />
        <ChatOverlay />
      </div>
      <div className="dash-status-right">
        <Tooltip label={showVideo ? "Hide video" : "Show video"}>
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
        </Tooltip>
        <Tooltip label={muted ? "Unmute" : "Mute"}>
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
        </Tooltip>
        {showVideo && videoBlocked && (
          <Tooltip label="Playback blocked — click to play">
            <button
              className="dash-play-blocked"
              aria-label="Start video playback"
              onClick={() => videoPlayerRef.current?.playVideo()}
            >
              <svg width="10" height="12" viewBox="0 0 10 12" fill="white">
                <polygon points="0,0 10,6 0,12" />
              </svg>
            </button>
          </Tooltip>
        )}
        {showVideo && !videoBlocked && (
          <Tooltip label={isPlaying ? "Pause" : "Play"}>
            <button
              className="dash-video-toggle"
              aria-label={isPlaying ? "Pause video" : "Play video"}
              onClick={() => {
                if (isPlaying) {
                  videoPlayerRef.current?.pauseVideo();
                  onSaveProgress();
                } else {
                  videoPlayerRef.current?.playVideo();
                }
                setIsPlaying(!isPlaying);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                {isPlaying ? (
                  <>
                    <rect x="5" y="3" width="4" height="18" rx="1" />
                    <rect x="15" y="3" width="4" height="18" rx="1" />
                  </>
                ) : (
                  <polygon points="6,3 20,12 6,21" />
                )}
              </svg>
            </button>
          </Tooltip>
        )}
        {showVideo && videos.length > 1 && (
          <div className="dash-video-nav" ref={navRef}>
            <Tooltip label="Previous video">
              <button className="dash-video-toggle" onClick={onPrevVideo} aria-label="Previous video">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="19 20 9 12 19 4 19 20" />
                  <line x1="5" y1="19" x2="5" y2="5" />
                </svg>
              </button>
            </Tooltip>
            <Tooltip label="Choose video">
              <button className="dash-video-indicator" onClick={() => setPickerOpen((o) => !o)}>
                {currentVideoIndex + 1}/{videos.length}
              </button>
            </Tooltip>
            <Tooltip label="Next video">
              <button className="dash-video-toggle" onClick={onNextVideo} aria-label="Next video">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 4 15 12 5 20 5 4" />
                  <line x1="19" y1="5" x2="19" y2="19" />
                </svg>
              </button>
            </Tooltip>
            {pickerOpen && (
              <VideoPicker
                videos={videos}
                currentVideoIndex={currentVideoIndex}
                onSelect={(i) => { onSelectVideo(i); setPickerOpen(false); }}
                playerRef={videoPlayerRef}
                onSaveProgress={onSaveProgress}
              />
            )}
          </div>
        )}
        {showVideo && (
          <Tooltip label={cinemaMode ? "Show dashboard" : "Cinema mode"}>
            <button className={`dash-video-toggle${cinemaMode ? " dash-cinema-active" : ""}`} onClick={onToggleCinemaMode} aria-label={cinemaMode ? "Exit cinema mode" : "Enter cinema mode"}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {cinemaMode ? (
                  <>
                    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                    <rect x="7" y="7" width="10" height="10" rx="1" />
                  </>
                ) : (
                  <>
                    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                  </>
                )}
              </svg>
            </button>
          </Tooltip>
        )}
        <span className="dash-ticker-dot" />
        <span className="dash-ticker-text">Live</span>
        <Tooltip label="Help">
          <button className="dash-help-btn" onClick={onShowHelp}>?</button>
        </Tooltip>
        <Tooltip label="Sign out">
          <button className="dash-logout-btn" onClick={onLogout}>Logout</button>
        </Tooltip>
      </div>
    </div>
  );
});
