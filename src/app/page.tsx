"use client";

import { useEffect, useState, useMemo, useCallback, useRef, memo } from "react";
import { useRouter } from "next/navigation";
import SplitFlapDisplay from "./SplitFlapDisplay";
import NewsTicker from "./NewsTicker";
import StatusBar from "./StatusBar";
import { useNow } from "./arrTickerStore";
import { getSupabaseBrowser } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type ProductConfig = {
  arr: number;
  growth: number;
  monthGrowth: number;
  updatedAt: number;
};

type Config = {
  lemlist: ProductConfig;
  lemwarm: ProductConfig;
  lemcal: ProductConfig;
  claap: ProductConfig;
  taplio: ProductConfig;
  tweethunter: ProductConfig;
};

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
      </div>
    </div>
  );
}

const DEFAULT_VIDEO_ID = "IoVyO6SyKZk";

const VideoBackground = memo(function VideoBackground({
  showVideo,
  playlist,
  muted,
}: {
  showVideo: boolean;
  playlist: string;
  muted: boolean;
}) {
  if (!showVideo) return null;

  const ids = playlist || DEFAULT_VIDEO_ID;
  const firstId = ids.split(",")[0];

  return (
    <div className="dash-video-bg">
      <iframe
        src={`https://www.youtube.com/embed/${firstId}?autoplay=1&mute=${muted ? 1 : 0}&loop=1&playlist=${ids}&controls=0&showinfo=0&modestbranding=1&disablekb=1&fs=0&iv_load_policy=3&rel=0`}
        allow="autoplay"
        className="dash-video-iframe"
      />
      <div className="dash-video-dim" />
    </div>
  );
});

const AmbientBackground = memo(function AmbientBackground() {
  return (
    <>
      <div className="dash-bg">
        <div className="dash-orb dash-orb-1" />
        <div className="dash-vignette" />
      </div>
      <div className="dash-noise" />
    </>
  );
});

// ── Main dashboard ──────────────────────────────────────────
function ARRDashboard() {
  const [config, setConfig] = useState<Config | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [videos, setVideos] = useState<{ youtube_id: string; title: string }[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
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
  const tvModeRef = useRef(tvMode);
  const [showVideo, setShowVideo] = useState(() => !searchParams.has("novideo"));
  const [muted, setMuted] = useState(true);
  const [tvStarted, setTvStarted] = useState(false);

  // Active playlist string for the iframe — only changes on initial load
  // or explicit user action (next/prev/select), NOT on realtime updates,
  // so the currently playing video is never interrupted.
  const [playlist, setPlaylist] = useState("");

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
    // Try localStorage first (local dev fallback), then API
    if (typeof window !== "undefined") {
      const local = localStorage.getItem("arr-config");
      if (local) {
        try {
          setConfig(JSON.parse(local));
          return;
        } catch { /* fall through to API */ }
      }
    }
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
          if (found >= 0) idx = found;
        }
        setCurrentVideoIndex(idx);
        setPlaylist(buildPlaylist(vids, idx));
      }
      if (typeof prefs.show_video === "boolean") setShowVideo(prefs.show_video);
      if (typeof prefs.muted === "boolean") setMuted(prefs.muted);
    });
  }, []);

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
        if (youtube_id) setPlaylist(youtube_id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchVideos]);

  const saveCurrentVideo = useCallback((youtubeId: string) => {
    fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_video: youtubeId }),
    }).catch(() => {});
  }, []);

  const handleNextVideo = useCallback(() => {
    setCurrentVideoIndex((i) => {
      const next = videos.length > 0 ? (i + 1) % videos.length : 0;
      saveCurrentVideo(videos[next]?.youtube_id);
      setPlaylist(buildPlaylist(videos, next));
      return next;
    });
  }, [videos, saveCurrentVideo, buildPlaylist]);

  const handlePrevVideo = useCallback(() => {
    setCurrentVideoIndex((i) => {
      const next = videos.length > 0 ? (i - 1 + videos.length) % videos.length : 0;
      saveCurrentVideo(videos[next]?.youtube_id);
      setPlaylist(buildPlaylist(videos, next));
      return next;
    });
  }, [videos, saveCurrentVideo, buildPlaylist]);

  const handleSelectVideo = useCallback((index: number) => {
    setCurrentVideoIndex(index);
    saveCurrentVideo(videos[index]?.youtube_id);
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
      <VideoBackground showVideo={showVideo} playlist={playlist} muted={muted} />

      {/* Ambient background */}
      <AmbientBackground />

      <ARRDynamic
        config={config}
        onShowHelp={() => setShowHelp(true)}
        onLogout={handleLogout}
        tvMode={tvMode}
        showVideo={showVideo}
        onToggleVideo={() => {
          setShowVideo((v) => {
            const next = !v;
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
      />

      {/* TV start overlay — click to unmute */}
      {tvMode && !tvStarted && (
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

      {/* Help popup */}
      {showHelp && <HelpPopup onClose={() => setShowHelp(false)} />}
    </div>
  );
}

function ARRDynamic({
  config,
  onShowHelp,
  onLogout,
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
}: {
  config: Config;
  onShowHelp: () => void;
  onLogout: () => void;
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
      {/* Two-column layout */}
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

      {/* News ticker */}
      <NewsTicker tvMode={tvMode} />

      {/* Status bar (hidden in TV mode) */}
      {!tvMode && <StatusBar now={now} onShowHelp={onShowHelp} onLogout={onLogout} showVideo={showVideo} onToggleVideo={onToggleVideo} muted={muted} onToggleMuted={onToggleMuted} videos={videos} currentVideoIndex={currentVideoIndex} onNextVideo={onNextVideo} onPrevVideo={onPrevVideo} onSelectVideo={onSelectVideo} />}
    </>
  );
}

export default function Home() {
  return <ARRDashboard />;
}
