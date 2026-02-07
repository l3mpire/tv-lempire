"use client";

import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import SplitFlapDisplay from "./SplitFlapDisplay";
import ChatOverlay from "./ChatOverlay";
import NewsTicker from "./NewsTicker";
import { useNow } from "./arrTickerStore";

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

const Clock = memo(function Clock({ now }: { now: number }) {
  const time = useMemo(
    () =>
      new Date(now).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }),
    [now]
  );

  return <span className="dash-time">{time}</span>;
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

const VideoBackground = memo(function VideoBackground({ showVideo }: { showVideo: boolean }) {
  if (!showVideo) return null;
  return (
    <div className="dash-video-bg">
      <iframe
        src="https://www.youtube.com/embed/IoVyO6SyKZk?autoplay=1&mute=1&loop=1&playlist=IoVyO6SyKZk&controls=0&showinfo=0&modestbranding=1&disablekb=1&fs=0&iv_load_policy=3&rel=0"
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
  const router = useRouter();

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }, [router]);
  const showVideo = useMemo(() => {
    if (typeof window === "undefined") return true;
    return !new URLSearchParams(window.location.search).has("novideo");
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
  }, []);

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
      <VideoBackground showVideo={showVideo} />

      {/* Ambient background */}
      <AmbientBackground />

      <ARRDynamic
        config={config}
        onShowHelp={() => setShowHelp(true)}
        onLogout={handleLogout}
      />

      {/* Help popup */}
      {showHelp && <HelpPopup onClose={() => setShowHelp(false)} />}
    </div>
  );
}

function ARRDynamic({
  config,
  onShowHelp,
  onLogout,
}: {
  config: Config;
  onShowHelp: () => void;
  onLogout: () => void;
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
      <NewsTicker />

      {/* Status bar */}
      <div className="dash-status-bar">
        <div className="dash-status-left">
          <Clock now={now} />
          <ChatOverlay />
        </div>
        <div className="dash-status-right">
          <span className="dash-ticker-dot" />
          <span className="dash-ticker-text">Live</span>
          <button className="dash-help-btn" onClick={onShowHelp}>?</button>
          <button className="dash-logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </div>
    </>
  );
}

export default function Home() {
  return <ARRDashboard />;
}
