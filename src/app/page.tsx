"use client";

import { useEffect, useState, useMemo, useCallback, useRef, memo, forwardRef, useImperativeHandle } from "react";
import { useRouter } from "next/navigation";
import SplitFlapDisplay from "./SplitFlapDisplay";
import NewsTicker from "./NewsTicker";
import BreakingNewsOverlay from "./BreakingNewsOverlay";
import StatusBar from "./StatusBar";
import SettingsModal from "./SettingsModal";
import { useNow } from "./arrTickerStore";
import { initPresence, cleanupPresence } from "./presenceStore";
import { getSupabaseBrowser } from "@/lib/supabase";
import type { ProductConfig, Config } from "@/lib/types";
import { extractYoutubeId } from "@/lib/linkify";

export const dynamic = "force-dynamic";

const PRODUCTS = ["lemlist", "lemwarm", "lemcal", "claap", "taplio", "tweethunter"] as const;
type ProductKey = (typeof PRODUCTS)[number];

function computeARR(config: ProductConfig | null, now: number): number | null {
  if (!config || config.arr === 0 || config.updatedAt === 0) return null;
  const dollarPerSecond = (config.arr * config.growth) / (365.25 * 24 * 3600);
  const elapsed = (now - config.updatedAt) / 1000;
  return config.arr + elapsed * dollarPerSecond;
}

type ProductCardProps = {
  name: string;
  logos: string[];
  arr: number | null;
  baseARR: number;
  monthGrowth: number;
  delay: number;
};

const ProductCard = memo(function ProductCard({
  name,
  logos,
  arr,
  baseARR,
  monthGrowth,
  delay,
}: ProductCardProps) {
  if (arr === null) return null;

  return (
    <div
      className="product-card"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="product-name">{name}</div>

      <div className="product-arr-row">
        <div className="product-arr">
          <SplitFlapDisplay value={`$${formatARR(arr)}`} />
        </div>
        <div className="product-logos">
          {logos.map((src) => (
            <img key={src} src={src} alt="" className="product-logo" />
          ))}
        </div>
      </div>

      <div
        className="product-growth"
        style={{ color: growthColor(monthGrowth) }}
      >
        {formatMonthGrowth(monthGrowth)} {formatGrowthLine(monthGrowth, baseARR)}
      </div>
    </div>
  );
});


function formatARR(value: number): string {
  return Math.floor(value).toLocaleString("en-US");
}

function formatMonthGrowth(value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? "+" : "-";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${Math.floor(abs).toLocaleString("en-US")}`;
  return `${sign}${abs.toFixed(0)}`;
}

function formatGrowthLine(monthGrowth: number, baseARR: number): string {
  if (baseARR === 0) return "";

  // MoM = monthGrowth / previous month ARR (baseARR - monthGrowth)
  const prevARR = baseARR - monthGrowth;
  const mom = prevARR > 0 ? (monthGrowth / prevARR) * 100 : 0;

  // YoY = annualized from MoM: (1 + mom%)^12 - 1
  const yoy = (Math.pow(1 + mom / 100, 12) - 1) * 100;

  const momSign = mom >= 0 ? "+" : "";
  const yoySign = yoy >= 0 ? "+" : "";

  return `(${momSign}${mom.toFixed(1)}% MoM · ${yoySign}${yoy.toFixed(0)}% YoY)`;
}

function growthColor(value: number): string {
  if (value > 0) return "var(--accent)";
  if (value < 0) return "var(--negative)";
  return "rgba(255,255,255,0.5)";
}

// ── Help popup ──────────────────────────────────────────────
function HelpPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help-popup" onClick={(e) => e.stopPropagation()}>
        <button className="help-close" onClick={onClose}>×</button>
        <h2>How to read this dashboard</h2>

        <div className="help-section">
          <h3>ARR (Annual Recurring Revenue)</h3>
          <p>
            The main amount displayed is the current ARR, calculated in real-time.
            It increments every second based on the expected annual growth rate.
          </p>
        </div>

        <div className="help-section">
          <h3>Monthly Growth</h3>
          <p>
            <span className="help-green">+311,148</span> = ARR difference vs previous month
          </p>
          <p>
            <strong>MoM</strong> = Month-over-Month growth rate (current vs previous month)
          </p>
          <p>
            <strong>YoY</strong> = Annualized growth if MoM rate continues for 12 months
          </p>
        </div>

        <div className="help-section">
          <h3>Data Source</h3>
          <p>
            Data is fetched from <strong>Holistics.io</strong>.
          </p>
        </div>

        <div className="help-section">
          <h3>Product Groups</h3>
          <ul>
            <li><strong>Sales Engagement</strong> = lemlist + lemwarm + lemcal</li>
            <li><strong>Conversation Intelligence</strong> = Claap</li>
            <li><strong>Social Selling</strong> = Taplio + Tweet Hunter</li>
          </ul>
        </div>

        <div className="help-section">
          <h3>TV Mode</h3>
          <p>
            Append <strong>?tv</strong> to the URL to enable TV mode — designed for
            display on a smart TV or large screen.
          </p>
          <p>
            In this mode the status bar is hidden, only TV-enabled videos are
            played, and the admin can push a video in real-time via the
            &ldquo;Play now&rdquo; button.
          </p>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_VIDEO_ID = "IoVyO6SyKZk";

export type VideoPlayerHandle = {
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  playVideo: () => void;
  pauseVideo: () => void;
};

// ── YouTube IFrame API loader (idempotent) ──────────────────
let ytApiPromise: Promise<void> | null = null;
function loadYouTubeAPI(): Promise<void> {
  if (ytApiPromise) return ytApiPromise;
  if (typeof window !== "undefined" && window.YT?.Player) {
    ytApiPromise = Promise.resolve();
    return ytApiPromise;
  }
  ytApiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return ytApiPromise;
}

const VideoBackground = memo(forwardRef<VideoPlayerHandle, {
  showVideo: boolean;
  playlist: string;
  muted: boolean;
  paused?: boolean;
  initialProgress: number;
  onProgressUpdate: (videoId: string, seconds: number) => void;
  onPlaybackBlocked: (blocked: boolean) => void;
  cinemaMode?: boolean;
}>(function VideoBackground({
  showVideo,
  playlist,
  muted,
  paused,
  initialProgress,
  onProgressUpdate,
  onPlaybackBlocked,
  cinemaMode,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialSeekDoneRef = useRef(false);
  const initialProgressRef = useRef(initialProgress);
  initialProgressRef.current = initialProgress;
  const onProgressUpdateRef = useRef(onProgressUpdate);
  onProgressUpdateRef.current = onProgressUpdate;
  const onPlaybackBlockedRef = useRef(onPlaybackBlocked);
  onPlaybackBlockedRef.current = onPlaybackBlocked;

  useImperativeHandle(ref, () => ({
    seekTo: (s: number) => { try { playerRef.current?.seekTo(s, true); } catch { /* ignore */ } },
    getCurrentTime: () => { try { return playerRef.current?.getCurrentTime() ?? 0; } catch { return 0; } },
    getDuration: () => { try { return playerRef.current?.getDuration() ?? 0; } catch { return 0; } },
    getPlayerState: () => { try { return playerRef.current?.getPlayerState() ?? -1; } catch { return -1; } },
    playVideo: () => { try { playerRef.current?.playVideo(); } catch { /* ignore */ } },
    pauseVideo: () => { try { playerRef.current?.pauseVideo(); } catch { /* ignore */ } },
  }));

  // Create / destroy player when showVideo changes
  useEffect(() => {
    if (!showVideo) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* ignore */ }
        playerRef.current = null;
      }
      if (containerRef.current) containerRef.current.innerHTML = "";
      initialSeekDoneRef.current = false;
      return;
    }

    const ids = (playlist || DEFAULT_VIDEO_ID).split(",");
    let destroyed = false;

    loadYouTubeAPI().then(() => {
      if (destroyed || !containerRef.current) return;
      // Create a child div that YT.Player will replace with an iframe
      const el = document.createElement("div");
      containerRef.current.prepend(el);

      const player = new YT.Player(el, {
        playerVars: {
          autoplay: 1,
          mute: muted ? 1 : 0,
          loop: 1,
          controls: 0,
          showinfo: 0,
          modestbranding: 1,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          rel: 0,
          enablejsapi: 1,
          origin: window.location.origin,
          playlist: ids.join(","),
        },
        videoId: ids[0],
        events: {
          onReady: () => {
            if (destroyed) return;
            player.setLoop(true);

            // Check if autoplay was blocked after a short delay
            setTimeout(() => {
              if (destroyed || !playerRef.current) return;
              const state = playerRef.current.getPlayerState();
              if (state !== YT.PlayerState.PLAYING) {
                onPlaybackBlockedRef.current(true);
              }
            }, 1500);

            // Start progress polling every 10s
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = setInterval(() => {
              try {
                if (!playerRef.current) return;
                const state = playerRef.current.getPlayerState();
                if (state !== YT.PlayerState.PLAYING) return;
                const currentTime = playerRef.current.getCurrentTime();
                const plList = playerRef.current.getPlaylist();
                const plIndex = playerRef.current.getPlaylistIndex();
                const videoId = plList?.[plIndex] ?? ids[0];
                onProgressUpdateRef.current(videoId, currentTime);
              } catch { /* player might not be ready */ }
            }, 10_000);
          },
          onStateChange: (event: YT.OnStateChangeEvent) => {
            if (destroyed) return;
            if (event.data === YT.PlayerState.PLAYING) {
              onPlaybackBlockedRef.current(false);
              // Seek to saved progress on first PLAYING event
              // (onReady is too early — autoplay can override the seek)
              if (!initialSeekDoneRef.current && initialProgressRef.current > 0) {
                player.seekTo(initialProgressRef.current, true);
              }
              initialSeekDoneRef.current = true;
            }
          },
        },
      });
      playerRef.current = player;
    });

    return () => {
      destroyed = true;
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* ignore */ }
        playerRef.current = null;
      }
      if (containerRef.current) containerRef.current.innerHTML = "";
      initialSeekDoneRef.current = false;
    };
  // Recreate only when showVideo or playlist changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showVideo, playlist]);

  // Mute / unmute without recreating the player
  useEffect(() => {
    if (!playerRef.current) return;
    try {
      if (muted) playerRef.current.mute();
      else playerRef.current.unMute();
    } catch { /* ignore */ }
  }, [muted]);

  // Pause / resume without recreating the player
  useEffect(() => {
    if (!playerRef.current) return;
    try {
      if (paused) playerRef.current.pauseVideo();
      else playerRef.current.playVideo();
    } catch { /* ignore */ }
  }, [paused]);

  if (!showVideo) return null;

  return (
    <div className={`dash-video-bg${cinemaMode ? " dash-video-cinema" : ""}`}>
      <div ref={containerRef} />
      {!cinemaMode && <div className="dash-video-dim" />}
    </div>
  );
}));

const AmbientBackground = memo(function AmbientBackground() {
  return (
    <div className="dash-bg">
      <div className="dash-orb dash-orb-1" />
      <div className="dash-vignette" />
    </div>
  );
});

// ── Main dashboard ──────────────────────────────────────────
function ARRDashboard() {
  const [config, setConfig] = useState<Config | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [videos, setVideos] = useState<{ youtube_id: string; title: string }[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const router = useRouter();

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }, [router]);
  const searchParams = useMemo(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);
  const tvMode = useMemo(() => searchParams.has("tv"), [searchParams]);
  const videoParam = useMemo(() => {
    const v = searchParams.get("video");
    return v ? extractYoutubeId(v) : null;
  }, [searchParams]);
  const tvModeRef = useRef(tvMode);
  const [showVideo, setShowVideo] = useState(() => !searchParams.has("novideo"));
  const [muted, setMuted] = useState(true);
  const [tvStarted, setTvStarted] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);
  const [breakingNewsActive, setBreakingNewsActive] = useState(false);
  const [videoBlocked, setVideoBlocked] = useState(false);
  const [cinemaMode, setCinemaMode] = useState(false);
  const [videosLoaded, setVideosLoaded] = useState(false);
  const cinemaModeRef = useRef(false);
  const cinemaVideosRef = useRef<Record<string, number>>({});
  const [tickerSpeed, setTickerSpeed] = useState<1 | 3 | 10>(1);
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);

  // Active playlist string for the iframe — only changes on initial load
  // or explicit user action (next/prev/select), NOT on realtime updates,
  // so the currently playing video is never interrupted.
  const [playlist, setPlaylist] = useState("");

  // Presence tracking: fetch current user and announce online status
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.user?.name) {
          initPresence(data.user.name);
        }
      } catch {
        // Not logged in
      }
    })();
    return () => {
      cancelled = true;
      cleanupPresence();
    };
  }, []);

  const buildPlaylist = useCallback((vids: { youtube_id: string }[], index: number) => {
    if (vids.length === 0) return "";
    const ids = vids.map((v) => v.youtube_id);
    const rotated = [...ids.slice(index), ...ids.slice(0, index)];
    return rotated.join(",");
  }, []);

  // Fetch videos without touching the active playlist (used by realtime)
  const fetchVideos = useCallback(async () => {
    const url = tvModeRef.current ? "/api/videos?tv=1" : "/api/videos";
    try {
      const res = await fetch(url);
      const data = await res.json();
      const newVids = (data.videos || []).map((v: { youtube_id: string; title: string }) => ({ youtube_id: v.youtube_id, title: v.title }));
      setVideos(newVids);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data: Config) => setConfig(data));

    const videoUrl = tvMode ? "/api/videos?tv=1" : "/api/videos";
    const prefsPromise = tvMode
      ? Promise.resolve({})
      : fetch("/api/preferences").then((res) => res.json()).catch(() => ({}));
    Promise.all([
      fetch(videoUrl).then((res) => res.json()).catch(() => ({ videos: [] })),
      prefsPromise,
    ]).then(([videoData, prefs]) => {
      if (videoData.videos?.length) {
        const vids = videoData.videos.map((v: { youtube_id: string; title: string }) => ({ youtube_id: v.youtube_id, title: v.title }));
        setVideos(vids);
        let idx = 0;
        if (typeof prefs.current_video === "string") {
          const found = vids.findIndex((v: { youtube_id: string }) => v.youtube_id === prefs.current_video);
          if (found >= 0) {
            idx = found;
            if (typeof prefs.video_progress === "number") {
              setVideoProgress(prefs.video_progress);
            }
          }
        }
        setCurrentVideoIndex(idx);
        setPlaylist(buildPlaylist(vids, idx));
      }
      if (typeof prefs.show_video === "boolean") setShowVideo(prefs.show_video);
      if (typeof prefs.muted === "boolean") setMuted(prefs.muted);
      if (prefs.ticker_speed === 3 || prefs.ticker_speed === 10) setTickerSpeed(prefs.ticker_speed);
      if (prefs.cinema_videos && typeof prefs.cinema_videos === "object") {
        cinemaVideosRef.current = prefs.cinema_videos;
      }
      setVideosLoaded(true);

      // If ?video= param is present, enter cinema mode with that video
      if (videoParam) {
        setShowVideo(true);
        setMuted(true);
        setCinemaMode(true);
        cinemaModeRef.current = true;
        setPlaylist(videoParam);
        setVideoProgress(0);
      }
    });
  }, []);

  // Snapshot of what was playing before cinema mode (to restore on exit)
  const preCinemaRef = useRef<{ playlist: string; index: number; progress: number } | null>(null);
  // Ref-based accessors so the playYouTube effect doesn't re-subscribe on every change
  const videosRef = useRef(videos);
  videosRef.current = videos;
  const currentVideoIndexRef = useRef(currentVideoIndex);
  currentVideoIndexRef.current = currentVideoIndex;

  // Listen for playYouTube events from LinkedContent (clickable YouTube URLs)
  useEffect(() => {
    const handler = (e: Event) => {
      const { youtubeId } = (e as CustomEvent).detail;
      if (!youtubeId) return;

      // Save current video + seek position before switching
      const vids = videosRef.current;
      const idx = currentVideoIndexRef.current;
      const currentId = vids[idx]?.youtube_id;
      const currentTime = videoPlayerRef.current?.getCurrentTime() ?? 0;
      if (currentId) {
        fetch("/api/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ current_video: currentId, video_progress: Math.floor(currentTime) }),
        }).catch(() => {});
        preCinemaRef.current = {
          playlist: buildPlaylist(vids, idx),
          index: idx,
          progress: currentTime,
        };
      }

      // Resume from saved position if we've watched this video before
      const savedProgress = cinemaVideosRef.current[youtubeId] ?? 0;

      setShowVideo(true);
      setCinemaMode(true);
      cinemaModeRef.current = true;
      setVideoProgress(savedProgress);
      setPlaylist(youtubeId);

      // Update browser URL for easy copy-paste sharing
      const url = new URL(window.location.href);
      url.searchParams.set("video", youtubeId);
      window.history.replaceState({}, "", url.toString());
    };
    window.addEventListener("playYouTube", handler);
    return () => window.removeEventListener("playYouTube", handler);
  }, [buildPlaylist]);

  // Subscribe to realtime video changes from admin
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const channel = supabase.channel("videos")
      .on("broadcast", { event: "videos_changed" }, () => {
        fetchVideos();
      })
      .on("broadcast", { event: "play_now" }, ({ payload }) => {
        if (!tvModeRef.current) return;
        const { youtube_id } = payload;
        if (youtube_id) {
          setVideoProgress(0);
          setPlaylist(youtube_id);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchVideos]);

  const saveCurrentVideo = useCallback((youtubeId: string) => {
    fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_video: youtubeId, video_progress: 0 }),
    }).catch(() => {});
  }, []);

  const saveVideoProgress = useCallback((videoId: string, seconds: number) => {
    const secs = Math.floor(seconds);
    if (cinemaModeRef.current) {
      // Cinema mode: save to cinema_videos map, don't touch current_video
      cinemaVideosRef.current = { ...cinemaVideosRef.current, [videoId]: secs };
      fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cinema_videos: cinemaVideosRef.current }),
      }).catch(() => {});
    } else {
      // Normal mode: save current_video + progress
      fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_video: videoId, video_progress: secs }),
      }).catch(() => {});
    }
  }, []);

  const handleSaveProgress = useCallback(() => {
    const player = videoPlayerRef.current;
    if (!player) return;
    const time = player.getCurrentTime();
    const videoId = videos[currentVideoIndex]?.youtube_id;
    if (videoId) saveVideoProgress(videoId, time);
  }, [videos, currentVideoIndex, saveVideoProgress]);

  const handleNextVideo = useCallback(() => {
    setCurrentVideoIndex((i) => {
      const next = videos.length > 0 ? (i + 1) % videos.length : 0;
      saveCurrentVideo(videos[next]?.youtube_id);
      setVideoProgress(0);
      setPlaylist(buildPlaylist(videos, next));
      return next;
    });
  }, [videos, saveCurrentVideo, buildPlaylist]);

  const handlePrevVideo = useCallback(() => {
    setCurrentVideoIndex((i) => {
      const next = videos.length > 0 ? (i - 1 + videos.length) % videos.length : 0;
      saveCurrentVideo(videos[next]?.youtube_id);
      setVideoProgress(0);
      setPlaylist(buildPlaylist(videos, next));
      return next;
    });
  }, [videos, saveCurrentVideo, buildPlaylist]);

  const handleSelectVideo = useCallback((index: number) => {
    setCurrentVideoIndex(index);
    saveCurrentVideo(videos[index]?.youtube_id);
    setVideoProgress(0);
    setPlaylist(buildPlaylist(videos, index));
  }, [videos, saveCurrentVideo, buildPlaylist]);

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <span className="loading-text">Initializing</span>
      </div>
    );
  }

  return (
    <div className="dash-wrapper">
      {/* Video background */}
      {videosLoaded && <VideoBackground ref={videoPlayerRef} showVideo={showVideo} playlist={playlist} muted={muted} paused={breakingNewsActive} initialProgress={videoProgress} onProgressUpdate={saveVideoProgress} onPlaybackBlocked={setVideoBlocked} cinemaMode={cinemaMode} />}

      {/* Ambient background (hidden in cinema mode) */}
      {!cinemaMode && <AmbientBackground />}

      <ARRDynamic
        config={config}
        onShowHelp={() => setShowHelp(true)}
        onShowSettings={() => setShowSettings(true)}
        tvMode={tvMode}
        showVideo={showVideo}
        onToggleVideo={() => {
          setShowVideo((v) => {
            const next = !v;
            if (!next) {
              // Restore previous video if exiting cinema by hiding video
              if (cinemaMode && preCinemaRef.current) {
                const snap = preCinemaRef.current;
                preCinemaRef.current = null;
                setCurrentVideoIndex(snap.index);
                setVideoProgress(snap.progress);
                setPlaylist(snap.playlist);
              }
              setCinemaMode(false);
              cinemaModeRef.current = false;
              // Clean ?video= from URL
              const url = new URL(window.location.href);
              if (url.searchParams.has("video")) {
                url.searchParams.delete("video");
                window.history.replaceState({}, "", url.pathname + url.search);
              }
            }
            fetch("/api/preferences", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ show_video: next }),
            }).catch(() => {});
            return next;
          });
        }}
        muted={muted}
        onToggleMuted={() => {
          setMuted((m) => {
            const next = !m;
            fetch("/api/preferences", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ muted: next }),
            }).catch(() => {});
            return next;
          });
        }}
        videos={videos}
        currentVideoIndex={currentVideoIndex}
        onNextVideo={handleNextVideo}
        onPrevVideo={handlePrevVideo}
        onSelectVideo={handleSelectVideo}
        videoPlayerRef={videoPlayerRef}
        videoBlocked={videoBlocked}
        onSaveProgress={handleSaveProgress}
        tickerSpeed={tickerSpeed}
        onCycleTickerSpeed={() => {
          setTickerSpeed((s) => {
            const next = s === 1 ? 3 : s === 3 ? 10 : 1;
            fetch("/api/preferences", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ticker_speed: next }),
            }).catch(() => {});
            return next as 1 | 3 | 10;
          });
        }}
        cinemaMode={cinemaMode}
        onToggleCinemaMode={() => {
          setCinemaMode((c) => {
            if (c) {
              // Exiting cinema mode — restore previous video
              if (preCinemaRef.current) {
                const snap = preCinemaRef.current;
                preCinemaRef.current = null;
                setCurrentVideoIndex(snap.index);
                setVideoProgress(snap.progress);
                setPlaylist(snap.playlist);
              }
              // Clean ?video= from URL
              const url = new URL(window.location.href);
              if (url.searchParams.has("video")) {
                url.searchParams.delete("video");
                window.history.replaceState({}, "", url.pathname + url.search);
              }
            }
            cinemaModeRef.current = !c;
            return !c;
          });
        }}
      />

      {/* Breaking News fullscreen overlay */}
      <BreakingNewsOverlay
        onPause={() => setBreakingNewsActive(true)}
        onResume={() => setBreakingNewsActive(false)}
      />

      {/* TV start overlay — click to unmute */}
      {tvMode && !tvStarted && !videoParam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-pointer"
          onClick={() => { setTvStarted(true); setMuted(false); }}
        >
          <div className="text-center">
            <div className="text-6xl mb-6">▶</div>
            <div className="text-2xl font-bold text-white">Click to start</div>
          </div>
        </div>
      )}

      {/* Video param start overlay — click to unmute */}
      {videoParam && !videoStarted && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-pointer"
          onClick={() => {
            setVideoStarted(true);
            setMuted(false);
            videoPlayerRef.current?.playVideo();
          }}
        >
          <div className="text-center">
            <div className="text-6xl mb-6">▶</div>
            <div className="text-2xl font-bold text-white">Click to play</div>
          </div>
        </div>
      )}

      {/* Help popup */}
      {showHelp && <HelpPopup onClose={() => setShowHelp(false)} />}

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

function ARRDynamic({
  config,
  onShowHelp,
  onShowSettings,
  tvMode,
  showVideo,
  onToggleVideo,
  muted,
  onToggleMuted,
  videos,
  currentVideoIndex,
  onNextVideo,
  onPrevVideo,
  onSelectVideo,
  videoPlayerRef,
  videoBlocked,
  onSaveProgress,
  tickerSpeed,
  onCycleTickerSpeed,
  cinemaMode,
  onToggleCinemaMode,
}: {
  config: Config;
  onShowHelp: () => void;
  onShowSettings: () => void;
  tvMode: boolean;
  showVideo: boolean;
  onToggleVideo: () => void;
  muted: boolean;
  onToggleMuted: () => void;
  videos: { youtube_id: string; title: string }[];
  currentVideoIndex: number;
  onNextVideo: () => void;
  onPrevVideo: () => void;
  onSelectVideo: (index: number) => void;
  videoPlayerRef: React.RefObject<VideoPlayerHandle | null>;
  videoBlocked: boolean;
  onSaveProgress: () => void;
  tickerSpeed: 1 | 3 | 10;
  onCycleTickerSpeed: () => void;
  cinemaMode: boolean;
  onToggleCinemaMode: () => void;
}) {
  const now = useNow();
  const lemlistARR = computeARR(config.lemlist, now);
  const lemwarmARR = computeARR(config.lemwarm, now);
  const lemcalARR = computeARR(config.lemcal, now);
  const claapARR = computeARR(config.claap, now);
  const taplioARR = computeARR(config.taplio, now);
  const tweethunterARR = computeARR(config.tweethunter, now);

  if (lemlistARR === null) return null;

  // Computed sums - Sales Engagement (lemlist + lemwarm + lemcal)
  const salesEngagementARR =
    (lemlistARR ?? 0) + (lemwarmARR ?? 0) + (lemcalARR ?? 0);
  const salesEngagementBaseARR =
    config.lemlist.arr + config.lemwarm.arr + config.lemcal.arr;
  const salesEngagementMonthGrowth =
    config.lemlist.monthGrowth + config.lemwarm.monthGrowth + config.lemcal.monthGrowth;

  // Social Selling (taplio + tweethunter)
  const socialSellingARR =
    (taplioARR ?? 0) + (tweethunterARR ?? 0);
  const socialSellingBaseARR = config.taplio.arr + config.tweethunter.arr;
  const socialSellingMonthGrowth =
    config.taplio.monthGrowth + config.tweethunter.monthGrowth;

  // Total (all 6 products)
  const totalARR =
    (lemlistARR ?? 0) +
    (lemwarmARR ?? 0) +
    (lemcalARR ?? 0) +
    (claapARR ?? 0) +
    (taplioARR ?? 0) +
    (tweethunterARR ?? 0);
  const totalBaseARR = PRODUCTS.reduce((sum, p) => sum + config[p].arr, 0);
  const totalMonthGrowth = PRODUCTS.reduce((sum, p) => sum + config[p].monthGrowth, 0);

  return (
    <>
      {/* Two-column layout (hidden in cinema mode) */}
      {!cinemaMode && (
        <>
          <div className="dash-layout">
            {/* Left: product cards */}
            <div className="dash-left">
              <ProductCard
                name="Sales Engagement"
                logos={["/logos/lemlist.svg", "/logos/lemwarm.svg", "/logos/lemcal.svg"]}
                arr={salesEngagementARR}
                baseARR={salesEngagementBaseARR}
                monthGrowth={salesEngagementMonthGrowth}
                delay={0.3}
              />
              <ProductCard
                name="Conversation Intelligence"
                logos={["/logos/claap.svg"]}
                arr={claapARR}
                baseARR={config.claap.arr}
                monthGrowth={config.claap.monthGrowth}
                delay={0.5}
              />
              <ProductCard
                name="Social Selling"
                logos={["/logos/taplio.svg", "/logos/tweethunter.svg"]}
                arr={socialSellingARR}
                baseARR={socialSellingBaseARR}
                monthGrowth={socialSellingMonthGrowth}
                delay={0.7}
              />
            </div>

            {/* Right: total */}
            <div className="dash-right">
              <div className="total-card">
                <div className="total-brand">lempire</div>

                <div className="total-label">
                  <span className="dash-label-line" />
                  Annual Recurring Revenue
                  <span className="dash-label-line dash-label-line-r" />
                </div>

                <div className="total-amount total-amount-glow">
                  <SplitFlapDisplay value={`$${formatARR(totalARR)}`} />
                </div>

                <div
                  className="total-month-growth"
                  style={{ color: growthColor(totalMonthGrowth) }}
                >
                  {formatMonthGrowth(totalMonthGrowth)} {formatGrowthLine(totalMonthGrowth, totalBaseARR)}
                </div>
              </div>
            </div>
          </div>

        </>
      )}

      {/* News ticker (always visible, lighter in cinema mode) */}
      <NewsTicker tvMode={tvMode} cinemaMode={cinemaMode} scrollSpeed={tickerSpeed * 60} />

      {/* Status bar (hidden in TV mode) */}
      {!tvMode && <StatusBar now={now} onShowHelp={onShowHelp} onShowSettings={onShowSettings} showVideo={showVideo} onToggleVideo={onToggleVideo} muted={muted} onToggleMuted={onToggleMuted} videos={videos} currentVideoIndex={currentVideoIndex} onNextVideo={onNextVideo} onPrevVideo={onPrevVideo} onSelectVideo={onSelectVideo} videoPlayerRef={videoPlayerRef} videoBlocked={videoBlocked} onSaveProgress={onSaveProgress} tickerSpeed={tickerSpeed} onCycleTickerSpeed={onCycleTickerSpeed} cinemaMode={cinemaMode} onToggleCinemaMode={onToggleCinemaMode} />}
    </>
  );
}

export default function Home() {
  return <ARRDashboard />;
}
