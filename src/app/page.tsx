"use client";

import { useEffect, useState, useCallback } from "react";

export const dynamic = "force-dynamic";

function ARRDashboard() {
  const [currentARR, setCurrentARR] = useState<number | null>(null);
  const [growthRate, setGrowthRate] = useState(0);
  const [baseARR, setBaseARR] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [time, setTime] = useState("");
  const [perSecond, setPerSecond] = useState(0);

  // Fetch config from API
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        setBaseARR(data.arr);
        setGrowthRate(data.growth);
        setUpdatedAt(data.updatedAt);
        setCurrentARR(data.arr);
        setPerSecond(
          (data.arr * data.growth) / (365.25 * 24 * 3600)
        );
      });
  }, []);

  // Tick every second, accumulating growth since updatedAt
  useEffect(() => {
    if (baseARR === 0 || updatedAt === 0) return;

    const dollarPerSecond = (baseARR * growthRate) / (365.25 * 24 * 3600);

    const tick = () => {
      const elapsedSeconds = (Date.now() - updatedAt) / 1000;
      setCurrentARR(baseARR + elapsedSeconds * dollarPerSecond);
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [baseARR, growthRate, updatedAt]);

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (currentARR === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <span className="loading-text">Initializing</span>
      </div>
    );
  }

  const { whole, cents } = splitCurrency(currentARR);
  const dailyRate = perSecond * 86400;

  return (
    <div className="dash-wrapper">
      {/* Ambient background */}
      <div className="dash-bg">
        <div className="dash-orb dash-orb-1" />
        <div className="dash-orb dash-orb-2" />
        <div className="dash-orb dash-orb-3" />
        <div className="dash-grid" />
        <div className="dash-scanline" />
        <div className="dash-vignette" />
      </div>

      {/* Noise texture */}
      <div className="dash-noise" />

      {/* Main content */}
      <div className="dash-content">
        <div className="dash-brand">lempire</div>

        <div className="dash-label">
          <span className="dash-label-line" />
          Annual Recurring Revenue
          <span className="dash-label-line dash-label-line-r" />
        </div>

        <div className="dash-amount dash-amount-glow">
          <span className="dash-dollar">$</span>
          {whole}
          <span className="dash-cents">.{cents}</span>
        </div>

        <div className="dash-metrics">
          <div className="dash-metric">
            <span className="dash-metric-value">
              +{(growthRate * 100).toFixed(0)}%
            </span>
            <span className="dash-metric-label">YoY Growth</span>
          </div>
          <div className="dash-metric">
            <span className="dash-metric-value">
              +${formatCompact(dailyRate)}
            </span>
            <span className="dash-metric-label">Per Day</span>
          </div>
          <div className="dash-metric">
            <span className="dash-metric-value">
              +${perSecond.toFixed(2)}
            </span>
            <span className="dash-metric-label">Per Second</span>
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

function splitCurrency(value: number): { whole: string; cents: string } {
  const dollars = Math.floor(value);
  const cents = Math.floor((value - dollars) * 100);
  return {
    whole: dollars.toLocaleString("en-US"),
    cents: String(cents).padStart(2, "0"),
  };
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + "M";
  if (value >= 1_000) return (value / 1_000).toFixed(1) + "K";
  return value.toFixed(0);
}

export default function Home() {
  return <ARRDashboard />;
}
