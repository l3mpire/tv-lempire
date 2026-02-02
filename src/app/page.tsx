"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

function ARRDashboard() {
  const searchParams = useSearchParams();

  // Config via URL params or defaults
  const baseARR = parseFloat(searchParams.get("arr") || "108000000");
  const yearlyGrowthRate = parseFloat(searchParams.get("growth") || "0.30"); // 30% annual growth
  const startTimestamp = useMemo(
    () => parseInt(searchParams.get("t") || String(Date.now())),
    [searchParams]
  );

  // Calculate $ per second from yearly growth
  const dollarPerSecond = (baseARR * yearlyGrowthRate) / (365.25 * 24 * 3600);

  const [currentARR, setCurrentARR] = useState(baseARR);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsedSeconds = (Date.now() - startTimestamp) / 1000;
      setCurrentARR(baseARR + elapsedSeconds * dollarPerSecond);
    }, 1000);

    return () => clearInterval(interval);
  }, [baseARR, dollarPerSecond, startTimestamp]);

  const formatted = formatCurrency(currentARR);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black select-none">
      {/* Logo / Company name */}
      <div className="mb-8 text-zinc-500 text-2xl tracking-[0.3em] uppercase">
        lempire
      </div>

      {/* ARR Label */}
      <div className="text-zinc-400 text-xl tracking-widest mb-4">
        Annual Recurring Revenue
      </div>

      {/* The big number */}
      <div className="text-green-400 text-[8vw] font-bold tabular-nums leading-none tracking-tight">
        {formatted}
      </div>

      {/* Growth rate info */}
      <div className="mt-8 text-zinc-600 text-lg">
        +{(yearlyGrowthRate * 100).toFixed(0)}% YoY
      </div>
    </div>
  );
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    // Show as $XXX,XXX,XXX with cents
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
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-black text-zinc-500">
          Loading...
        </div>
      }
    >
      <ARRDashboard />
    </Suspense>
  );
}
