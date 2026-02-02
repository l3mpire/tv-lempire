"use client";

import { useEffect, useState, useRef } from "react";

export const dynamic = "force-dynamic";

type ProductConfig = {
  arr: number;
  growth: number;
  monthGrowth: number;
  updatedAt: number;
};

type Config = {
  lemlist: ProductConfig;
  claap: ProductConfig;
  taplio: ProductConfig;
  tweethunter: ProductConfig;
};

const PRODUCTS = ["lemlist", "claap", "taplio", "tweethunter"] as const;
type ProductKey = (typeof PRODUCTS)[number];

function useProductTicker(config: ProductConfig | null) {
  const [current, setCurrent] = useState<number | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    if (!config || config.arr === 0 || config.updatedAt === 0) return;

    const dollarPerSecond =
      (config.arr * config.growth) / (365.25 * 24 * 3600);

    const tick = () => {
      const c = configRef.current;
      if (!c) return;
      const elapsed = (Date.now() - c.updatedAt) / 1000;
      setCurrent(c.arr + elapsed * dollarPerSecond);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [config?.arr, config?.growth, config?.updatedAt]);

  return current;
}

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

function formatMonthPercent(monthGrowth: number, arr: number): string {
  if (arr === 0) return "";
  const pct = (monthGrowth / arr) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `(${sign}${pct.toFixed(1)}%)`;
}

function growthColor(value: number): string {
  if (value > 0) return "var(--accent)";
  if (value < 0) return "var(--negative)";
  return "rgba(255,255,255,0.5)";
}

// ── Product card (left column) ──────────────────────────────
function ProductCard({
  name,
  arr,
  baseARR,
  monthGrowth,
  delay,
}: {
  name: string;
  arr: number | null;
  baseARR: number;
  monthGrowth: number;
  delay: number;
}) {
  if (arr === null) return null;

  return (
    <div
      className="product-card"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="product-name">{name}</div>

      <div className="product-arr">
        ${formatARR(arr)}
      </div>

      <div
        className="product-growth"
        style={{ color: growthColor(monthGrowth) }}
      >
        {formatMonthGrowth(monthGrowth)} {formatMonthPercent(monthGrowth, baseARR)}
      </div>
    </div>
  );
}

// ── Main dashboard ──────────────────────────────────────────
function ARRDashboard() {
  const [config, setConfig] = useState<Config | null>(null);
  const [time, setTime] = useState("");

  useEffect(() => {
    // Try localStorage first (local dev fallback), then API
    const local = localStorage.getItem("arr-config");
    if (local) {
      try {
        setConfig(JSON.parse(local));
        return;
      } catch { /* fall through to API */ }
    }
    fetch("/api/config")
      .then((res) => res.json())
      .then((data: Config) => setConfig(data));
  }, []);

  // Individual tickers
  const lemlistARR = useProductTicker(config?.lemlist ?? null);
  const claapARR = useProductTicker(config?.claap ?? null);
  const taplioARR = useProductTicker(config?.taplio ?? null);
  const tweethunterARR = useProductTicker(config?.tweethunter ?? null);

  // Clock
  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!config || lemlistARR === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <span className="loading-text">Initializing</span>
      </div>
    );
  }

  // Computed sums
  const taplioTHArr =
    (taplioARR ?? 0) + (tweethunterARR ?? 0);
  const taplioTHBaseARR = config.taplio.arr + config.tweethunter.arr;
  const taplioTHMonthGrowth =
    config.taplio.monthGrowth + config.tweethunter.monthGrowth;

  const totalARR =
    (lemlistARR ?? 0) +
    (claapARR ?? 0) +
    (taplioARR ?? 0) +
    (tweethunterARR ?? 0);
  const totalBaseARR = PRODUCTS.reduce((sum, p) => sum + config[p].arr, 0);
  const totalMonthGrowth =
    config.lemlist.monthGrowth +
    config.claap.monthGrowth +
    config.taplio.monthGrowth +
    config.tweethunter.monthGrowth;

  return (
    <div className="dash-wrapper">
      {/* Video background */}
      <div className="dash-video-bg">
        <iframe
          src="https://www.youtube.com/embed/IoVyO6SyKZk?autoplay=1&mute=1&loop=1&playlist=IoVyO6SyKZk&controls=0&showinfo=0&modestbranding=1&disablekb=1&fs=0&iv_load_policy=3&rel=0"
          allow="autoplay"
          className="dash-video-iframe"
        />
        <div className="dash-video-dim" />
      </div>

      {/* Ambient background */}
      <div className="dash-bg">
        <div className="dash-orb dash-orb-1" />
        <div className="dash-vignette" />
      </div>
      <div className="dash-noise" />

      {/* Two-column layout */}
      <div className="dash-layout">
        {/* Left: product cards */}
        <div className="dash-left">
          <ProductCard
            name="Sales Engagement"
            arr={lemlistARR}
            baseARR={config.lemlist.arr}
            monthGrowth={config.lemlist.monthGrowth}
            delay={0.3}
          />
          <ProductCard
            name="Conversation Intelligence"
            arr={claapARR}
            baseARR={config.claap.arr}
            monthGrowth={config.claap.monthGrowth}
            delay={0.5}
          />
          <ProductCard
            name="Social Selling"
            arr={taplioTHArr}
            baseARR={taplioTHBaseARR}
            monthGrowth={taplioTHMonthGrowth}
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
              ${formatARR(totalARR)}
            </div>

            <div
              className="total-month-growth"
              style={{ color: growthColor(totalMonthGrowth) }}
            >
              {formatMonthGrowth(totalMonthGrowth)} {formatMonthPercent(totalMonthGrowth, totalBaseARR)}
            </div>
          </div>
        </div>
      </div>

      {/* Status indicators */}
      <div className="dash-ticker">
        <span className="dash-ticker-dot" />
        <span className="dash-ticker-text">Live</span>
      </div>
      <div className="dash-time">{time}</div>
    </div>
  );
}

export default function Home() {
  return <ARRDashboard />;
}
