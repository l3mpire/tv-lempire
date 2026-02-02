"use client";

import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

function ARRDashboard() {
  const [currentARR, setCurrentARR] = useState<number | null>(null);
  const [growthRate, setGrowthRate] = useState(0);
  const [baseARR, setBaseARR] = useState(0);
  const [startTimestamp] = useState(() => Date.now());

  // Fetch config from API
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        setBaseARR(data.arr);
        setGrowthRate(data.growth);
        setCurrentARR(data.arr);
      });
  }, []);

  // Tick every second
  useEffect(() => {
    if (baseARR === 0) return;

    const dollarPerSecond = (baseARR * growthRate) / (365.25 * 24 * 3600);

    const interval = setInterval(() => {
      const elapsedSeconds = (Date.now() - startTimestamp) / 1000;
      setCurrentARR(baseARR + elapsedSeconds * dollarPerSecond);
    }, 1000);

    return () => clearInterval(interval);
  }, [baseARR, growthRate, startTimestamp]);

  if (currentARR === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-zinc-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black select-none">
      <div className="mb-8 text-zinc-500 text-2xl tracking-[0.3em] uppercase">
        lempire
      </div>

      <div className="text-zinc-400 text-xl tracking-widest mb-4">
        Annual Recurring Revenue
      </div>

      <div className="text-green-400 text-[8vw] font-bold tabular-nums leading-none tracking-tight">
        {formatCurrency(currentARR)}
      </div>

      <div className="mt-8 text-zinc-600 text-lg">
        +{(growthRate * 100).toFixed(0)}% YoY
      </div>
    </div>
  );
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    const dollars = Math.floor(value);
    const cents = Math.floor((value - dollars) * 100);
    return (
      "$" +
      dollars.toLocaleString("en-US") +
      "." +
      String(cents).padStart(2, "0")
    );
  }
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Home() {
  return <ARRDashboard />;
}
