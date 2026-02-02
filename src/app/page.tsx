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

function formatARR(value: number): { whole: string; cents: string } {
  const dollars = Math.floor(value);
  const cents = Math.floor((value - dollars) * 100);
  return {
    whole: dollars.toLocaleString("en-US"),
    cents: String(cents).padStart(2, "0"),
  };
}

function formatMonthGrowth(value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? "+" : "-";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + "M";
  if (value >= 1_000) return (value / 1_000).toFixed(1) + "k";
  return value.toFixed(0);
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
  monthGrowth,
  perSecond,
  delay,
}: {
  name: string;
  arr: number | null;
  monthGrowth: number;
  perSecond: number;
  delay: number;
}) {
  if (arr === null) return null;
  const { whole, cents } = formatARR(arr);

  return (
    <div
      className="product-card"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="product-header">
        <span className="product-name">{name}</span>
        <span className="product-per-sec">
          +${perSecond.toFixed(2)}/s
        </span>
      </div>

      <div className="product-arr">
        <span className="product-dollar">$</span>
        {whole}
        <span className="product-cents">.{cents}</span>
      </div>

      <div
        className="product-growth"
        style={{ color: growthColor(monthGrowth) }}
      >
        {formatMonthGrowth(monthGrowth)} this month
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
  const taplioTHMonthGrowth =
    config.taplio.monthGrowth + config.tweethunter.monthGrowth;
  const taplioTHPerSec =
    (config.taplio.arr * config.taplio.growth +
      config.tweethunter.arr * config.tweethunter.growth) /
    (365.25 * 24 * 3600);

  const totalARR =
    (lemlistARR ?? 0) +
    (claapARR ?? 0) +
    (taplioARR ?? 0) +
    (tweethunterARR ?? 0);
  const totalMonthGrowth =
    config.lemlist.monthGrowth +
    config.claap.monthGrowth +
    config.taplio.monthGrowth +
    config.tweethunter.monthGrowth;
  const totalPerSecond = PRODUCTS.reduce(
    (sum, p) =>
      sum + (config[p].arr * config[p].growth) / (365.25 * 24 * 3600),
    0
  );

  const total = formatARR(totalARR);
  const dailyRate = totalPerSecond * 86400;

  const lemlistPerSec =
    (config.lemlist.arr * config.lemlist.growth) / (365.25 * 24 * 3600);
  const claapPerSec =
    (config.claap.arr * config.claap.growth) / (365.25 * 24 * 3600);

  return (
    <div className="dash-wrapper">
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
            name="lemlist"
            arr={lemlistARR}
            monthGrowth={config.lemlist.monthGrowth}
            perSecond={lemlistPerSec}
            delay={0.3}
          />
          <ProductCard
            name="Claap"
            arr={claapARR}
            monthGrowth={config.claap.monthGrowth}
            perSecond={claapPerSec}
            delay={0.5}
          />
          <ProductCard
            name="Taplio & Tweet Hunter"
            arr={taplioTHArr}
            monthGrowth={taplioTHMonthGrowth}
            perSecond={taplioTHPerSec}
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
              <span className="total-dollar">$</span>
              {total.whole}
              <span className="total-cents">.{total.cents}</span>
            </div>

            <div
              className="total-month-growth"
              style={{ color: growthColor(totalMonthGrowth) }}
            >
              {formatMonthGrowth(totalMonthGrowth)} this month
            </div>

            <div className="total-metrics">
              <div className="total-metric">
                <span className="total-metric-value">
                  +${formatCompact(dailyRate)}
                </span>
                <span className="total-metric-label">Per Day</span>
              </div>
              <div className="total-metric">
                <span className="total-metric-value">
                  +${totalPerSecond.toFixed(2)}
                </span>
                <span className="total-metric-label">Per Second</span>
              </div>
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
